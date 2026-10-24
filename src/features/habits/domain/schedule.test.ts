import { describe, expect, test } from 'vitest'
import { isDone, isDueOn, isScheduledDay, periodAt, weekDoneCount } from './schedule'
import { dias, habit, logs, semanal } from './testing'

describe('periodAt', () => {
  const h = habit([dias('2026-10-05', [1, 3, 5], '2026-10-25'), dias('2026-10-26', [1, 2, 3, 4, 5])])

  test('elige el periodo vigente en cada fecha', () => {
    expect(periodAt(h, '2026-10-25')?.validFrom).toBe('2026-10-05')
    expect(periodAt(h, '2026-10-26')?.validFrom).toBe('2026-10-26')
    expect(periodAt(h, '2030-01-01')?.validFrom).toBe('2026-10-26')
  })

  test('antes del primer periodo no hay ninguno', () => {
    expect(periodAt(h, '2026-10-04')).toBeNull()
  })
})

test('isScheduledDay usa los días del periodo de esa fecha', () => {
  const h = habit([dias('2026-10-05', [1, 3, 5], '2026-10-25'), dias('2026-10-26', [1, 2, 3, 4, 5])])
  expect(isScheduledDay(h, '2026-10-20')).toBe(false) // martes con L-M-V
  expect(isScheduledDay(h, '2026-10-27')).toBe(true) // martes con L-V
  expect(isScheduledDay(h, '2026-10-25')).toBe(false) // domingo
})

test('isDone: check con cualquier valor; cantidad cuando alcanza la meta', () => {
  const check = habit([dias('2026-10-01', [1])])
  expect(isDone(check, check.schedules[0], 1)).toBe(true)
  expect(isDone(check, check.schedules[0], undefined)).toBe(false)

  const agua = habit([dias('2026-10-01', [1, 2, 3, 4, 5, 6, 7], null, 8)], { kind: 'cantidad', unit: 'vasos' })
  expect(isDone(agua, agua.schedules[0], 5)).toBe(false)
  expect(isDone(agua, agua.schedules[0], 8)).toBe(true)
})

test('weekDoneCount cuenta los días hechos de la semana', () => {
  const h = habit([semanal('2026-10-05', 3)])
  expect(weekDoneCount(h, logs(['2026-10-19', '2026-10-21', '2026-10-27']), '2026-10-19')).toBe(2)
})

describe('isDueOn', () => {
  test('por días: solo los días programados', () => {
    const h = habit([dias('2026-10-05', [1, 3, 5])])
    expect(isDueOn(h, new Map(), '2026-10-28')).toBe(true)
    expect(isDueOn(h, new Map(), '2026-10-27')).toBe(false)
  })

  test('semanal: hasta cumplir N; el día en que se marcó sigue visible', () => {
    const h = habit([semanal('2026-10-05', 2)])
    const l = logs(['2026-10-26', '2026-10-28'])
    expect(isDueOn(h, l, '2026-10-28')).toBe(true)
    expect(isDueOn(h, l, '2026-10-29')).toBe(false)
    expect(isDueOn(h, logs(['2026-10-26']), '2026-10-29')).toBe(true)
  })

  test('archivado nunca toca', () => {
    const h = habit([dias('2026-10-05', [1, 2, 3, 4, 5, 6, 7])], { archivedAt: '2026-10-28T10:00:00Z' })
    expect(isDueOn(h, new Map(), '2026-10-28')).toBe(false)
  })

  test('antes de crearse no toca', () => {
    const h = habit([dias('2026-10-28', [1, 2, 3, 4, 5, 6, 7])])
    expect(isDueOn(h, new Map(), '2026-10-27')).toBe(false)
  })
})
