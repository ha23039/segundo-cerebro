import { createClient, type Session } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (ver .env.example)')
}

/** Misma clave que usa supabase-js por defecto; explícita para poder leer la sesión sin red. */
export const AUTH_STORAGE_KEY = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`

export const supabase = createClient<Database>(url, key, { auth: { storageKey: AUTH_STORAGE_KEY } })

/** Sesión guardada en el dispositivo, aunque su token haya caducado (modo solo lectura sin red). */
export function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    const session = raw ? (JSON.parse(raw) as Session) : null
    return session?.user?.id ? session : null
  } catch {
    return null
  }
}
