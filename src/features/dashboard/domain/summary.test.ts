import { describe, expect, test } from 'vitest'
import { dias, habit, logs, semanal } from '../../habits/domain/testing'
import type { LogsByDate } from '../../habits/domain/types'
import { dayCount, globalStreak, lastDays, rangeCount, ratio } from './summary'

const TODAY = '2026-10-28' // miércoles
const leer = habit([dias('2026-10-19', [1, 2, 3, 4, 5, 6, 7])], { id: 'leer' })
const gym = habit([dias('2026-10-19', [1, 3, 5])], { id: 'gym' })
const map = (entries: [string, LogsByDate][]) => new Map(entries)

describe('dayCount', () => {
  test('un día pasado cuenta los programados y los hechos', () => {
    const l = map([['leer', logs(['2026-10-26'])], ['gym', logs([])]])
    expect(dayCount([leer, gym], l, '2026-10-26', TODAY)).toEqual({ done: 1, scheduled: 2 })
  })

  test('hoy muestra lo pendiente en el total', () => {
    const l = map([['leer', logs([TODAY])]])
    expect(dayCount([leer, gym], l, TODAY, TODAY)).toEqual({ done: 1, scheduled: 2 })
  })

  test('un hábito semanal ya cumplido no penaliza los demás días', () => {
    const w = habit([semanal('2026-10-19', 1)], { id: 'w' })
    const l = map([['w', logs(['2026-10-26'])]])
    expect(dayCount([w], l, '2026-10-27', TODAY)).toEqual({ done: 0, scheduled: 0 })
  })
})

describe('rangeCount', () => {
  test('hoy solo suma lo hecho; los días futuros no cuentan', () => {
    const l = map([['leer', logs(['2026-10-26', '2026-10-27', TODAY])], ['gym', logs(['2026-10-26'])]])
    // lun 26: 2/2 · mar 27: 1/1 · mié 28 (hoy): solo lo hecho 1/1 · jue-dom: futuro
    expect(rangeCount([leer, gym], l, '2026-10-26', '2026-11-01', TODAY)).toEqual({ done: 4, scheduled: 4 })
  })

  test('antes de crear los hábitos no hay nada programado', () => {
    expect(ratio(rangeCount([leer], new Map(), '2026-10-01', '2026-10-07', TODAY))).toBeNull()
  })

  test('con hábitos y sin registros el ratio es 0, no null', () => {
    expect(ratio(rangeCount([leer], new Map(), '2026-10-19', '2026-10-25', TODAY))).toBe(0)
  })
})

describe('globalStreak', () => {
  test('días seguidos con 80 % o más; hoy pendiente no rompe', () => {
    const l = map([['leer', logs(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'])]])
    expect(globalStreak([leer], l, TODAY)).toBe(4)
  })

  test('un día por debajo del umbral la corta', () => {
    const l = map([['leer', logs(['2026-10-26', '2026-10-27'])], ['gym', logs(['2026-10-23'])]])
    // lun 26: leer sí, gym no → 50 % → corta; mar 27: 100 %
    expect(globalStreak([leer, gym], l, TODAY)).toBe(1)
  })

  test('hoy completo suma', () => {
    const l = map([['leer', logs(['2026-10-27', TODAY])]])
    expect(globalStreak([leer], l, TODAY)).toBe(2)
  })
})

test('lastDays devuelve n días con su ratio (null sin nada programado)', () => {
  const l = map([['leer', logs(['2026-10-27'])]])
  const days = lastDays([leer], l, TODAY, 3)
  expect(days.map((d) => [d.date, d.ratio])).toEqual([
    ['2026-10-26', 0],
    ['2026-10-27', 1],
    [TODAY, 0],
  ])
  expect(lastDays([leer], l, '2026-10-19', 2)[0].ratio).toBeNull()
})
