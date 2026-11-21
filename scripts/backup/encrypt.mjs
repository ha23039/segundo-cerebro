// Cifra un archivo con la clave pública age. Uso: AGE_RECIPIENT=age1… node scripts/backup/encrypt.mjs <entrada> <salida>
import { readFileSync, writeFileSync } from 'node:fs'
import { encryptBytes } from './age.mjs'
import { isAgeRecipient } from './lib.mjs'

const [input, output] = process.argv.slice(2)
const recipient = process.env.AGE_RECIPIENT ?? ''
if (!input || !output) {
  console.error('Uso: AGE_RECIPIENT=age1… node scripts/backup/encrypt.mjs <entrada> <salida>')
  process.exit(1)
}
if (!isAgeRecipient(recipient)) {
  console.error('✗ AGE_RECIPIENT no es una clave pública age válida (empieza por age1…). Nunca uses la privada aquí.')
  process.exit(1)
}
writeFileSync(output, await encryptBytes(readFileSync(input), recipient))
console.log(`✓ Cifrado: ${output}`)
