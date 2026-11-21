// Restaura un respaldo en una base de datos VACÍA (migraciones aplicadas y sin datos).
// Uso: node scripts/backup/restore.mjs <backup.tar.gz.age> <clave-privada> <DB_URL> [--si-es-produccion]
// Requiere `psql` y `tar`. La BD destino debe tener ya el esquema (npx supabase db push) y la cuenta de
// usuario creada con el MISMO id que el respaldo (el id sale en el aviso de este script).
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decryptBytes } from './age.mjs'
import { nonEmptyTables } from './lib.mjs'

const [archive, keyFile, dbUrl, flag] = process.argv.slice(2)
if (!archive || !keyFile || !dbUrl) {
  console.error('Uso: node scripts/backup/restore.mjs <backup.tar.gz.age> <clave-privada> <DB_URL> [--si-es-produccion]')
  process.exit(1)
}
const local = /@(127\.0\.0\.1|localhost|\[::1\]|host\.docker\.internal)[:/]/.test(dbUrl)
if (!local && flag !== '--si-es-produccion') {
  console.error('✗ La base de datos destino no es local. Si de verdad quieres restaurar ahí, añade --si-es-produccion.')
  process.exit(1)
}

// PSQL permite usar otro cliente (p. ej. "docker exec -i supabase_db_segundo-cerebro psql"); por defecto, psql del sistema.
const [cmd, ...cmdArgs] = (process.env.PSQL ?? 'psql').split(' ')
const psql = (args, input) => spawnSync(cmd, [...cmdArgs, dbUrl, '-X', '-v', 'ON_ERROR_STOP=1', ...args], { encoding: 'utf8', input, maxBuffer: 1 << 30 })
const dir = mkdtempSync(join(tmpdir(), 'restore-'))
try {
  const tarPath = join(dir, 'backup.tar.gz')
  writeFileSync(tarPath, await decryptBytes(readFileSync(archive), readFileSync(keyFile, 'utf8')))
  const data = spawnSync('tar', ['-xzOf', tarPath, 'data.sql'], { encoding: 'utf8', maxBuffer: 1 << 30 })
  if (data.status !== 0 || !data.stdout) throw new Error('El respaldo no contiene data.sql')

  const tables = psql(['-Atc', "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'"])
  if (tables.status !== 0) throw new Error(`No se pudo leer la base de datos: ${tables.stderr}`)
  const counts = {}
  for (const t of tables.stdout.split('\n').filter(Boolean)) counts[t] = Number(psql(['-Atc', `select count(*) from public."${t}"`]).stdout)
  const busy = nonEmptyTables(counts)
  if (busy.length) throw new Error(`La base de datos destino no está vacía: ${busy.join(', ')}. Restaura solo en una base vacía.`)

  const block = data.stdout.match(/COPY "public"\."profiles" \([^)]*\) FROM stdin;\n([\s\S]*?)\n\\\./)
  const ids = (block?.[1] ?? '').split('\n').filter(Boolean).map((l) => l.split('\t')[0])
  console.log(`Cuentas en el respaldo: ${ids.length}${ids.length <= 3 ? ` (${ids.join(', ')})` : ''}`)
  for (const id of ids) {
    const has = psql(['-Atc', `select count(*) from auth.users where id = '${id}'`])
    if (has.stdout.trim() !== '1') throw new Error(`Falta la cuenta con id ${id} en auth.users. Créala con el mismo id (USER_ID=${id} node scripts/create-user.mjs) y repite.`)
  }

  const r = psql(['--single-transaction'], data.stdout)
  if (r.status !== 0) throw new Error(`Falló la restauración (no se aplicó nada): ${r.stderr}`)
  const after = {}
  for (const t of Object.keys(counts)) after[t] = Number(psql(['-Atc', `select count(*) from public."${t}"`]).stdout)
  console.log('✓ Restaurado. Filas por tabla:')
  for (const [t, n] of Object.entries(after)) console.log(`  ${t}: ${n}`)
} catch (e) {
  console.error(`✗ ${e.message}`)
  process.exitCode = 1
} finally {
  rmSync(dir, { recursive: true, force: true })
}
