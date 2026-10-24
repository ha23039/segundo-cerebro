import { expect, test } from 'vitest'
import { frequencySummary, streakLabel } from './format'

test('frequencySummary', () => {
  expect(frequencySummary({ kind: 'dias', days: [1, 3, 5] })).toBe('L-X-V')
  expect(frequencySummary({ kind: 'dias', days: [1, 2, 3, 4, 5] })).toBe('L-V')
  expect(frequencySummary({ kind: 'dias', days: [1, 2, 3, 4, 5, 6, 7] })).toBe('Todos los días')
  expect(frequencySummary({ kind: 'dias', days: [6, 7] })).toBe('S-D')
  expect(frequencySummary({ kind: 'semanal', timesPerWeek: 1 })).toBe('1 vez por semana')
  expect(frequencySummary({ kind: 'semanal', timesPerWeek: 3 })).toBe('3 veces por semana')
})

test('streakLabel', () => {
  expect(streakLabel({ value: 1, unit: 'dias' })).toBe('1 día')
  expect(streakLabel({ value: 9, unit: 'dias' })).toBe('9 días')
  expect(streakLabel({ value: 1, unit: 'semanas' })).toBe('1 semana')
  expect(streakLabel({ value: 0, unit: 'semanas' })).toBe('0 semanas')
})
