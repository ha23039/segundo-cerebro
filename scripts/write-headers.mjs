// Se ejecuta tras `vite build`: escribe dist/_headers con la URL de Supabase del entorno de build.
import { writeFileSync } from 'node:fs'
import { loadEnv } from 'vite'
import { buildHeaders } from './headers.mjs'

const env = loadEnv(process.env.MODE ?? 'production', process.cwd(), 'VITE_')
const url = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL
writeFileSync('dist/_headers', buildHeaders(url))
console.log(`dist/_headers escrito (connect-src ${new URL(url).origin})`)
