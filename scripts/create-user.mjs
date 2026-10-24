// Crea la cuenta única de la app. La contraseña se pide por consola (sin eco) y nunca se guarda.
// Uso: SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/create-user.mjs
import { createClient } from '@supabase/supabase-js'
import { createInterface } from 'node:readline'
import { validateCredentials } from './credentials.mjs'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('Define SUPABASE_URL y SUPABASE_SECRET_KEY (la secret key del proyecto) antes de ejecutar.')
  process.exit(1)
}

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY })
let muted = false
// Oculta lo que se escribe mientras se pide una contraseña
const write = rl._writeToOutput?.bind(rl)
rl._writeToOutput = (s) => {
  if (!muted || !write) return write?.(s)
  if (s.includes('\n') || s.includes('\r')) write('\n')
}
const lines = rl[Symbol.asyncIterator]()

async function ask(question, hidden = false) {
  process.stdout.write(question)
  muted = hidden && process.stdin.isTTY
  const { value } = await lines.next()
  muted = false
  if (hidden && !process.stdin.isTTY) process.stdout.write('\n')
  return (value ?? '').trim()
}

const email = await ask('Correo: ')
const password = await ask('Contraseña (mín. 12 caracteres): ', true)
const confirm = await ask('Repite la contraseña: ', true)
rl.close()

const problem = validateCredentials(email, password, confirm)
if (problem) {
  console.error(`✗ ${problem}`)
  process.exit(1)
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
if (error) {
  console.error(`✗ No se pudo crear el usuario: ${error.message}`)
  process.exit(1)
}
console.log(`✓ Usuario creado: ${data.user.email}`)
