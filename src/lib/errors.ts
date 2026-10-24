import { isAuthApiError } from '@supabase/supabase-js'

const GENERIC = 'Algo salió mal, inténtalo de nuevo'
const WINDOW = 'Fecha fuera de la ventana de edición'

/** Convierte cualquier error (Auth, PostgREST, red) en un mensaje en español para mostrar. */
export function toMessage(e: unknown): string {
  if (isAuthApiError(e)) {
    if (e.code === 'invalid_credentials') return 'Correo o contraseña incorrectos'
    return GENERIC
  }
  if (e instanceof TypeError && /fetch|network|load failed/i.test(e.message)) {
    return 'Sin conexión. Inténtalo cuando vuelvas a tener red.'
  }
  if (e && typeof e === 'object' && 'code' in e) {
    const { code, message } = e as { code?: string; message?: string }
    if (code === '23514') return message === WINDOW ? WINDOW : 'Datos no válidos'
    if (code === '23505') return 'Ya existe un registro igual'
  }
  return GENERIC
}
