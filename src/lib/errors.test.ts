import { AuthApiError } from '@supabase/supabase-js'
import { expect, test } from 'vitest'
import { toMessage } from './errors'

test('credenciales inválidas', () => {
  expect(toMessage(new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'))).toBe(
    'Correo o contraseña incorrectos',
  )
})

test('fallo de red', () => {
  expect(toMessage(new TypeError('Failed to fetch'))).toBe('Sin conexión. Inténtalo cuando vuelvas a tener red.')
})

test('fecha fuera de la ventana (SQLSTATE 23514)', () => {
  expect(toMessage({ code: '23514', message: 'Fecha fuera de la ventana de edición' })).toBe(
    'Fecha fuera de la ventana de edición',
  )
})

test('error desconocido', () => {
  expect(toMessage(new Error('boom'))).toBe('Algo salió mal, inténtalo de nuevo')
  expect(toMessage(null)).toBe('Algo salió mal, inténtalo de nuevo')
})
