import { expect, test } from 'vitest'
import type { ExcusesData } from './api'
import { applyChange } from './hooks'

const base: ExcusesData = { rest: [{ date: '2026-11-20', note: null }], skips: [{ habitId: 'h1', date: '2026-11-14', reason: 'viaje' }] }

test('descanso: añade ordenado, reemplaza la nota y se quita', () => {
  const a = applyChange(base, { kind: 'rest', date: '2026-11-16', note: '  Familia ' })
  expect(a.rest).toEqual([{ date: '2026-11-16', note: 'Familia' }, { date: '2026-11-20', note: null }])
  expect(applyChange(a, { kind: 'rest', date: '2026-11-16', note: '' }).rest[0]).toEqual({ date: '2026-11-16', note: null })
  expect(applyChange(a, { kind: 'unrest', date: '2026-11-16' }).rest).toEqual(base.rest)
})

test('omisión: una por hábito y día, se cambia el motivo y se deshace', () => {
  const a = applyChange(base, { kind: 'skip', habitId: 'h1', date: '2026-11-14', reason: 'enfermedad' })
  expect(a.skips).toEqual([{ habitId: 'h1', date: '2026-11-14', reason: 'enfermedad' }])
  expect(applyChange(a, { kind: 'unskip', habitId: 'h1', date: '2026-11-14' }).skips).toEqual([])
  expect(base.skips).toHaveLength(1) // no muta
})
