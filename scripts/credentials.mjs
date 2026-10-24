export const MIN_PASSWORD = 12

/** Devuelve el mensaje de error, o null si los datos son válidos. */
export function validateCredentials(email, password, confirm) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Correo no válido'
  if (password.length < MIN_PASSWORD) return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`
  if (password !== confirm) return 'Las contraseñas no coinciden'
  return null
}
