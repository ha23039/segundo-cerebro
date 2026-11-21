// Falla si git rastrea archivos que no deben estar en el repo. Se ejecuta en CI y antes de commitear.
import { execFileSync } from 'node:child_process'
import { forbiddenPaths } from './tracked.mjs'

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
const bad = forbiddenPaths(files)
if (bad.length) {
  console.error('Archivos que no deben estar en el repo (añádelos a .gitignore y haz git rm --cached):')
  for (const f of bad) console.error('  ' + f)
  process.exit(1)
}
console.log(`Repo limpio (${files.length} archivos rastreados).`)
