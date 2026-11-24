// Genera un par de claves VAPID para los recordatorios. Imprime en pantalla; no escribe ningún archivo.
// La clave PRIVADA va solo a los secretos de la Edge Function (nunca al repositorio). La pública va a VITE_VAPID_PUBLIC_KEY.
import { webcrypto as crypto } from 'node:crypto'

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])
const b64u = (buf) => Buffer.from(buf).toString('base64url')
const publicKey = b64u(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)))
const privateKey = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d

console.log('VAPID_PUBLIC_KEY  (y VITE_VAPID_PUBLIC_KEY en la compilación):')
console.log(publicKey)
console.log('\nVAPID_PRIVATE_KEY (secreto de la función; guárdalo en tu gestor de contraseñas, no en el repo):')
console.log(privateKey)
