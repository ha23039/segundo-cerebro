// Imprime (una por línea) las claves a borrar para conservar solo las 12 últimas.
// Entrada: JSON de `aws s3api list-objects-v2` por stdin. Uso: aws … | node scripts/backup/prune.mjs [conservar]
import { keysToDelete } from './lib.mjs'

let raw = ''
for await (const chunk of process.stdin) raw += chunk
const keys = (JSON.parse(raw || '{}').Contents ?? []).map((o) => o.Key)
const keep = Number(process.argv[2] ?? 12)
for (const k of keysToDelete(keys, keep)) console.log(k)
