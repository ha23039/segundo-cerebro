import { describe, expect, it } from 'vitest'
import { b64u, encryptPayload, generateVapidKeys, sendWebPush, vapidAuthorization } from './webpush'

const enc = new TextEncoder()
const dec = new TextDecoder()

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource }, key, bytes * 8))
}

/** Lado receptor (el navegador), escrito aparte siguiendo el RFC 8291 §3.4, para comprobar que el cifrado se puede descifrar. */
async function decryptAsBrowser(body: Uint8Array, uaPrivate: CryptoKey, uaPublic: Uint8Array, authSecret: Uint8Array): Promise<string> {
  const salt = body.slice(0, 16)
  const rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0)
  const idlen = body[20]
  const asPublic = body.slice(21, 21 + idlen)
  const cipher = body.slice(21 + idlen)
  expect(rs).toBe(4096)
  const asKey = await crypto.subtle.importKey('raw', asPublic as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, uaPrivate, 256))
  const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPublic, ...asPublic])
  const ikm = await hkdf(authSecret, secret, info, 32)
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)
  const aes = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['decrypt'])
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, aes, cipher as BufferSource))
  let end = plain.length
  while (end > 0 && plain[end - 1] === 0) end--
  expect(plain[end - 1]).toBe(2) // delimitador del último registro
  return dec.decode(plain.slice(0, end - 1))
}

async function browserKeys() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  return { pair, pub, auth: crypto.getRandomValues(new Uint8Array(16)) }
}

describe('cifrado del mensaje (aes128gcm)', () => {
  it('el navegador puede descifrar lo que se envía, también con tildes y emojis ausentes', async () => {
    const ua = await browserKeys()
    const text = JSON.stringify({ title: 'Repaso del día', body: 'Te quedan 2 hábitos por hacer hoy', url: '/' })
    const body = await encryptPayload(enc.encode(text), ua.pub, ua.auth)
    expect(await decryptAsBrowser(body, ua.pair.privateKey, ua.pub, ua.auth)).toBe(text)
  })

  it('el cuerpo lleva la cabecera del RFC 8188: sal, tamaño de registro 4096 y clave pública del emisor', async () => {
    const ua = await browserKeys()
    const salt = Uint8Array.from({ length: 16 }, (_, i) => i + 1)
    const body = await encryptPayload(enc.encode('hola'), ua.pub, ua.auth, { salt })
    expect([...body.slice(0, 16)]).toEqual([...salt])
    expect([...body.slice(16, 20)]).toEqual([0, 0, 16, 0])
    expect(body[20]).toBe(65)
    expect(body[21]).toBe(4) // punto sin comprimir
    expect(body.length).toBe(21 + 65 + 'hola'.length + 1 + 16) // texto + delimitador + etiqueta GCM
  })

  it('con otra clave de autenticación no se puede descifrar', async () => {
    const ua = await browserKeys()
    const body = await encryptPayload(enc.encode('secreto'), ua.pub, ua.auth)
    await expect(decryptAsBrowser(body, ua.pair.privateKey, ua.pub, crypto.getRandomValues(new Uint8Array(16)))).rejects.toThrow()
  })

  it('rechaza suscripciones mal formadas', async () => {
    await expect(encryptPayload(enc.encode('x'), new Uint8Array(10), new Uint8Array(16))).rejects.toThrow('Clave pública')
    const ua = await browserKeys()
    await expect(encryptPayload(enc.encode('x'), ua.pub, new Uint8Array(3))).rejects.toThrow('Secreto')
  })
})

describe('VAPID', () => {
  it('genera claves con el tamaño correcto', async () => {
    const k = await generateVapidKeys()
    expect(b64u.decode(k.publicKey)).toHaveLength(65)
    expect(b64u.decode(k.privateKey)).toHaveLength(32)
  })

  it('firma un JWT ES256 verificable con la clave pública, con audiencia, caducidad corta y contacto', async () => {
    const k = await generateVapidKeys()
    const keys = { ...k, subject: 'mailto:contacto@ejemplo.test' }
    const now = 1_800_000_000
    const header = await vapidAuthorization('https://web.push.apple.com/abc/def', keys, now)
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header)!
    expect(m[4]).toBe(k.publicKey)
    const claims = JSON.parse(dec.decode(b64u.decode(m[2])))
    expect(claims).toEqual({ aud: 'https://web.push.apple.com', exp: now + 12 * 3600, sub: 'mailto:contacto@ejemplo.test' })
    const pub = await crypto.subtle.importKey('raw', b64u.decode(k.publicKey) as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64u.decode(m[3]) as BufferSource, enc.encode(`${m[1]}.${m[2]}`) as BufferSource)
    expect(ok).toBe(true)
  })
})

describe('sendWebPush', () => {
  it('envía el mensaje cifrado con las cabeceras de Web Push', async () => {
    const ua = await browserKeys()
    const keys = { ...(await generateVapidKeys()), subject: 'mailto:contacto@ejemplo.test' }
    let seen: { url: string; init: RequestInit } | undefined
    const fake = (async (url: string, init: RequestInit) => {
      seen = { url, init }
      return new Response(null, { status: 201 })
    }) as unknown as typeof fetch
    const sub = { endpoint: 'https://push.example.test/send/1', p256dh: b64u.encode(ua.pub), auth: b64u.encode(ua.auth) }
    const r = await sendWebPush(sub, { title: 'Leer', body: 'Toca ahora', url: '/' }, keys, fake)
    expect(r).toEqual({ status: 201, gone: false })
    const headers = seen!.init.headers as Record<string, string>
    expect(headers['Content-Encoding']).toBe('aes128gcm')
    expect(headers.TTL).toBe('3600')
    expect(headers.Authorization).toMatch(/^vapid t=.+, k=.+$/)
    const text = await decryptAsBrowser(seen!.init.body as Uint8Array, ua.pair.privateKey, ua.pub, ua.auth)
    expect(JSON.parse(text)).toEqual({ title: 'Leer', body: 'Toca ahora', url: '/' })
  })

  it('marca como desaparecidas las suscripciones que el servicio da por borradas (404 y 410)', async () => {
    const ua = await browserKeys()
    const keys = { ...(await generateVapidKeys()), subject: 'mailto:contacto@ejemplo.test' }
    const sub = { endpoint: 'https://push.example.test/send/2', p256dh: b64u.encode(ua.pub), auth: b64u.encode(ua.auth) }
    for (const status of [404, 410]) {
      const fake = (async () => new Response(null, { status })) as unknown as typeof fetch
      expect(await sendWebPush(sub, { title: 'a', body: 'b', url: '/' }, keys, fake)).toEqual({ status, gone: true })
    }
    const fail = (async () => new Response(null, { status: 500 })) as unknown as typeof fetch
    expect((await sendWebPush(sub, { title: 'a', body: 'b', url: '/' }, keys, fail)).gone).toBe(false)
  })
})
