import { expect, test } from 'vitest'
import { validateCredentials } from './credentials.mjs'

test('acepta correo válido y contraseña de 12+ caracteres que coincide', () => {
  expect(validateCredentials('yo@ejemplo.com', 'una-clave-larga', 'una-clave-larga')).toBeNull()
})

test('rechaza correo inválido', () => {
  expect(validateCredentials('no-es-correo', 'una-clave-larga', 'una-clave-larga')).toBe('Correo no válido')
})

test('rechaza contraseña corta', () => {
  expect(validateCredentials('yo@ejemplo.com', 'corta', 'corta')).toBe('La contraseña debe tener al menos 12 caracteres')
})

test('rechaza confirmación distinta', () => {
  expect(validateCredentials('yo@ejemplo.com', 'una-clave-larga', 'otra-clave-larga')).toBe('Las contraseñas no coinciden')
})
