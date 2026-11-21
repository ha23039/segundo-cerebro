import { Decrypter, Encrypter } from 'age-encryption'

/** Cifra con una clave pública age (formato compatible con la herramienta `age`). */
export async function encryptBytes(data, recipient) {
  const e = new Encrypter()
  e.addRecipient(recipient.trim())
  return e.encrypt(data)
}

/** Descifra con una clave privada age (AGE-SECRET-KEY-1…). */
export async function decryptBytes(data, identity) {
  const d = new Decrypter()
  d.addIdentity(identity.trim())
  return d.decrypt(data, 'uint8array')
}
