// Genera el par de claves age del respaldo. Uso: node scripts/backup/keygen.mjs <archivo-de-clave-privada>
// La clave PÚBLICA se imprime (va al secreto AGE_RECIPIENT de GitHub). La PRIVADA se guarda solo en el archivo
// indicado (permisos 600): guárdala en tu gestor de contraseñas; sin ella no se puede restaurar. Nunca al repo.
import { existsSync, writeFileSync } from 'node:fs'
import { generateIdentity, identityToRecipient } from 'age-encryption'

const out = process.argv[2]
if (!out) {
  console.error('Uso: node scripts/backup/keygen.mjs <archivo-de-clave-privada>')
  process.exit(1)
}
if (existsSync(out)) {
  console.error(`✗ ${out} ya existe: no se sobrescribe.`)
  process.exit(1)
}
const identity = await generateIdentity()
writeFileSync(out, `${identity}\n`, { mode: 0o600 })
console.log(`✓ Clave privada guardada en ${out} (guárdala en tu gestor de contraseñas).`)
console.log(`Clave pública (secreto AGE_RECIPIENT): ${await identityToRecipient(identity)}`)
