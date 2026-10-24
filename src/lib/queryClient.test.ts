import { expect, test } from 'vitest'
import { CACHE_MAX_AGE, queryClient } from './queryClient'

const MAX_TIMEOUT = 2 ** 31 - 1 // máximo de setTimeout; por encima el temporizador salta al instante

test('gcTime cabe en un setTimeout (si no, la caché restaurada se borra en el acto)', () => {
  const gcTime = queryClient.getDefaultOptions().queries?.gcTime
  expect(gcTime).toBeLessThanOrEqual(MAX_TIMEOUT)
})

test('la caché persistida no vive más que gcTime', () => {
  const gcTime = queryClient.getDefaultOptions().queries?.gcTime as number
  expect(CACHE_MAX_AGE).toBeLessThanOrEqual(gcTime)
})
