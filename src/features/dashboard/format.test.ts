import { expect, test } from 'vitest'
import { deltaPts, greeting, pct } from './format'

test('pct', () => {
  expect(pct(null)).toBe('—')
  expect(pct(0.756)).toBe('76 %')
})

test('deltaPts', () => {
  expect(deltaPts(0.8, 0.7)).toBe(10)
  expect(deltaPts(0.5, null)).toBeNull()
})

test('greeting', () => {
  expect(greeting(8)).toBe('Buenos días')
  expect(greeting(15)).toBe('Buenas tardes')
  expect(greeting(22)).toBe('Buenas noches')
})
