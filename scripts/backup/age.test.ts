import { generateIdentity, identityToRecipient } from 'age-encryption'
import { describe, expect, it } from 'vitest'
import { decryptBytes, encryptBytes } from './age.mjs'

describe('cifrado age', () => {
  it('ida y vuelta, y el resultado es una cabecera age y no deja ver el texto', async () => {
    const identity = await generateIdentity()
    const recipient = await identityToRecipient(identity)
    const plain = new TextEncoder().encode('COPY "public"."habits" … secreto')
    const enc = await encryptBytes(plain, recipient)
    expect(new TextDecoder().decode(enc.slice(0, 21))).toBe('age-encryption.org/v1')
    expect(new TextDecoder().decode(enc)).not.toContain('secreto')
    expect(new TextDecoder().decode(await decryptBytes(enc, identity))).toBe('COPY "public"."habits" … secreto')
  })

  it('con otra clave no se puede descifrar', async () => {
    const a = await generateIdentity()
    const b = await generateIdentity()
    const enc = await encryptBytes(new Uint8Array([1, 2, 3]), await identityToRecipient(a))
    await expect(decryptBytes(enc, b)).rejects.toThrow()
  })
})
