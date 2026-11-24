// Web Push sin dependencias (WebCrypto): cifrado de mensajes (RFC 8291, aes128gcm) y firma VAPID (RFC 8292).
// Funciona igual en Deno (Edge Functions), Node y navegadores, y se prueba con vitest.

const enc = new TextEncoder()

export const b64u = {
  encode(bytes: Uint8Array): string {
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  },
  decode(text: string): Uint8Array {
    const pad = '='.repeat((4 - (text.length % 4)) % 4)
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + pad)
    return Uint8Array.from(bin, (c) => c.charCodeAt(0))
  },
}

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource }, key, bytes * 8)
  return new Uint8Array(bits)
}

export interface EncryptOptions {
  /** Solo para pruebas con vectores conocidos. */
  salt?: Uint8Array
  senderKeys?: CryptoKeyPair
}

/** Cifra `plaintext` para una suscripción (clave pública del navegador + secreto de autenticación). Devuelve el cuerpo aes128gcm. */
export async function encryptPayload(plaintext: Uint8Array, uaPublic: Uint8Array, authSecret: Uint8Array, opts: EncryptOptions = {}): Promise<Uint8Array> {
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('Clave pública de la suscripción no válida')
  if (authSecret.length !== 16) throw new Error('Secreto de autenticación no válido')
  const sender = opts.senderKeys ?? ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair)
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', sender.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', uaPublic as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, sender.privateKey, 256))

  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const ikm = await hkdf(authSecret, ecdh, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32)
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)

  // Un único registro: texto + delimitador 0x02 (último registro)
  const record = concat(plaintext, new Uint8Array([2]))
  const aes = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['encrypt'])
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, aes, record as BufferSource))

  const rs = new Uint8Array([0, 0, 0x10, 0]) // tamaño de registro 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher)
}

export interface VapidKeys {
  /** Contacto del remitente, p. ej. `mailto:alguien@ejemplo.com` (lo pide el servicio de push). */
  subject: string
  /** Clave pública (65 bytes, base64url). */
  publicKey: string
  /** Clave privada (32 bytes, base64url). Solo en los secretos de la función. */
  privateKey: string
}

export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])) as CryptoKeyPair
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return { publicKey: b64u.encode(pub), privateKey: jwk.d as string }
}

/** Cabecera `Authorization` VAPID para un servicio de push (audiencia = origen del endpoint). */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
  const pub = b64u.decode(keys.publicKey)
  const jwk = { kty: 'EC', crv: 'P-256', x: b64u.encode(pub.slice(1, 33)), y: b64u.encode(pub.slice(33, 65)), d: keys.privateKey }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const header = b64u.encode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64u.encode(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSeconds + 12 * 3600, sub: keys.subject })))
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`) as BufferSource))
  return `vapid t=${header}.${claims}.${b64u.encode(signature)}, k=${keys.publicKey}`
}

export interface PushSubscriptionRow {
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushMessage {
  title: string
  body: string
  url: string
}

export interface SendResult {
  status: number
  /** La suscripción ya no existe (404/410): hay que borrarla. */
  gone: boolean
}

export async function sendWebPush(sub: PushSubscriptionRow, message: PushMessage, keys: VapidKeys, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  const body = await encryptPayload(enc.encode(JSON.stringify(message)), b64u.decode(sub.p256dh), b64u.decode(sub.auth))
  const res = await fetchImpl(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(sub.endpoint, keys),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '3600',
      Urgency: 'normal',
    },
    body: body as BodyInit,
  })
  return { status: res.status, gone: res.status === 404 || res.status === 410 }
}
