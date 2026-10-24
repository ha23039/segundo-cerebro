import { expect, test } from 'vitest'
import { buildHeaders } from './headers.mjs'

test('la CSP permite solo el propio origen y la URL de Supabase', () => {
  const headers = buildHeaders('https://abc.supabase.co')
  expect(headers).toContain('/*\n')
  expect(headers).toContain(
    "Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://abc.supabase.co; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  )
  expect(headers).toContain('X-Content-Type-Options: nosniff')
  expect(headers).toContain('Referrer-Policy: strict-origin-when-cross-origin')
})

test('rechaza una URL de Supabase ausente o inválida', () => {
  expect(() => buildHeaders('')).toThrow()
  expect(() => buildHeaders('no es una url')).toThrow()
})
