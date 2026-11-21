import { describe, expect, test } from 'vitest'
import { addDays, type IsoDate } from '../../../lib/dates'
import { ratio } from '../../dashboard/domain/summary'
import { buildExcuses } from '../../habits/domain/excuses'
import { dias, habit, logs, semanal } from '../../habits/domain/testing'
import type { SkipReason } from '../../habits/domain/types'
import { addMonths, compliance, dayStatus, monthlySeries, monthRange, sumCounts, totalCompliance, weekRange } from './compliance'

const TODAY = '2026-10-28' // miércoles
const WEEKDAYS = [1, 2, 3, 4, 5] as const

function range(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}
const isWeekday = (d: IsoDate) => new Date(`${d}T00:00:00Z`).getUTCDay() % 6 !== 0
const ex = (rest: IsoDate[], skips: [string, IsoDate, SkipReason][] = []) =>
  buildExcuses(
    rest.map((date) => ({ date })),
    skips.map(([habitId, date, reason]) => ({ habitId, date, reason })),
  )

describe('compliance: hábitos por días', () => {
  const h = habit([dias('2026-10-05', [...WEEKDAYS])])
  const done = logs(range('2026-10-05', '2026-10-23').filter((d) => isWeekday(d) && d !== '2026-10-14'))

  test('semana pasada: hechos ÷ programados', () => {
    expect(compliance(h, done, '2026-10-12', '2026-10-18', TODAY)).toEqual({ done: 4, scheduled: 5 })
  })

  test('semana en curso: los fallos cuentan, hoy pendiente no, lo posterior es futuro', () => {
    expect(compliance(h, done, '2026-10-26', '2026-11-01', TODAY)).toEqual({ done: 0, scheduled: 2 })
    expect(compliance(h, logs([...done.keys(), TODAY]), '2026-10-26', '2026-11-01', TODAY)).toEqual({ done: 1, scheduled: 3 })
  })

  test('con hábitos y sin ningún registro es 0 %, no "—"', () => {
    const c = compliance(h, new Map(), '2026-10-12', '2026-10-18', TODAY)
    expect(c).toEqual({ done: 0, scheduled: 5 })
    expect(ratio(c)).toBe(0)
  })

  test('antes de crear el hábito no hay nada que medir', () => {
    const c = compliance(h, new Map(), '2026-09-14', '2026-09-20', TODAY)
    expect(c).toEqual({ done: 0, scheduled: 0 })
    expect(ratio(c)).toBeNull()
  })

  test('archivado a mitad de semana: solo cuentan los días que aún tocaban', () => {
    const arch = habit([dias('2026-10-05', [...WEEKDAYS], '2026-10-14')], { archivedAt: '2026-10-15T10:00:00Z' })
    const l = logs(['2026-10-12', '2026-10-13'])
    expect(compliance(arch, l, '2026-10-12', '2026-10-18', TODAY)).toEqual({ done: 2, scheduled: 3 })
  })

  test('descansos y omisiones justificadas no cuentan; si se hizo, sí', () => {
    const e = ex(['2026-10-14'], [['h1', '2026-10-15', 'viaje']])
    expect(compliance(h, done, '2026-10-12', '2026-10-18', TODAY, e)).toEqual({ done: 4, scheduled: 4 })
    const hecho = logs([...done.keys(), '2026-10-14'])
    expect(compliance(h, hecho, '2026-10-12', '2026-10-18', TODAY, ex(['2026-10-14']))).toEqual({ done: 5, scheduled: 5 })
  })
})

describe('compliance: hábitos semanales', () => {
  const h = habit([semanal('2026-10-05', 3)])

  test('hechos (con tope en N) ÷ N de la semana', () => {
    expect(compliance(h, logs(['2026-10-12', '2026-10-13']), '2026-10-12', '2026-10-18', TODAY)).toEqual({ done: 2, scheduled: 3 })
    expect(compliance(h, logs(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']), '2026-10-12', '2026-10-18', TODAY)).toEqual({ done: 3, scheduled: 3 })
  })

  test('una semana parcial (creado a mitad de semana) se excluye', () => {
    const tarde = habit([semanal('2026-10-15', 3)])
    expect(compliance(tarde, new Map(), '2026-10-12', '2026-10-18', TODAY)).toEqual({ done: 0, scheduled: 0 })
  })

  test('la semana en curso solo cuenta si ya llegó al objetivo', () => {
    expect(compliance(h, logs(['2026-10-26']), '2026-10-26', '2026-11-01', TODAY)).toEqual({ done: 0, scheduled: 0 })
    expect(compliance(h, logs(['2026-10-26', '2026-10-27', '2026-10-28']), '2026-10-26', '2026-11-01', TODAY)).toEqual({ done: 3, scheduled: 3 })
  })

  test('una omisión rebaja el objetivo; una semana entera excusada se salta', () => {
    expect(compliance(h, logs(['2026-10-12', '2026-10-13']), '2026-10-12', '2026-10-18', TODAY, ex([], [['h1', '2026-10-16', 'enfermedad']]))).toEqual({ done: 2, scheduled: 2 })
    expect(compliance(h, new Map(), '2026-10-12', '2026-10-18', TODAY, ex(range('2026-10-12', '2026-10-18')))).toEqual({ done: 0, scheduled: 0 })
  })

  test('una semana cuenta en el mes de su jueves (cambio de año)', () => {
    const w = habit([semanal('2026-11-30', 1)])
    const hechos = logs(['2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28', '2027-01-04', '2027-01-11'])
    const hoy = '2027-01-13'
    const dic = monthRange('2026-12')
    const ene = monthRange('2027-01')
    // Diciembre: semanas con jueves en diciembre = 3, 10, 17, 24 y 31 (la del 28 acaba en enero)
    expect(compliance(w, hechos, dic.from, dic.to, hoy)).toEqual({ done: 5, scheduled: 5 })
    // Enero: semanas del 4 y del 11 (jueves 7 y 14: la del 11 sigue en curso y está hecha)
    expect(compliance(w, hechos, ene.from, ene.to, hoy)).toEqual({ done: 2, scheduled: 2 })
  })
})

describe('dayStatus', () => {
  const h = habit([dias('2026-10-05', [...WEEKDAYS])])
  const l = logs(['2026-10-26'])

  test('hecho, no hecho, no programado, pendiente y futuro', () => {
    expect(dayStatus(h, l, '2026-10-26', TODAY)).toBe('hecho')
    expect(dayStatus(h, l, '2026-10-27', TODAY)).toBe('no-hecho')
    expect(dayStatus(h, l, '2026-10-24', TODAY)).toBe('no-programado') // sábado
    expect(dayStatus(h, l, TODAY, TODAY)).toBe('pendiente')
    expect(dayStatus(h, l, '2026-10-29', TODAY)).toBe('futuro')
    expect(dayStatus(h, l, '2026-10-02', TODAY)).toBe('no-programado') // antes de crearlo
  })

  test('descanso y omisión (solo si ese día tocaba); lo hecho manda', () => {
    const e = ex(['2026-10-27', '2026-10-24', '2026-10-26'], [['h1', '2026-10-23', 'viaje']])
    expect(dayStatus(h, l, '2026-10-27', TODAY, e)).toBe('descanso')
    expect(dayStatus(h, l, '2026-10-24', TODAY, e)).toBe('no-programado')
    expect(dayStatus(h, l, '2026-10-26', TODAY, e)).toBe('hecho')
    expect(dayStatus(h, l, '2026-10-23', TODAY, e)).toBe('omitido')
  })

  test('un semanal sin marcar un día pasado es "no programado"', () => {
    expect(dayStatus(habit([semanal('2026-10-05', 3)]), new Map(), '2026-10-20', TODAY)).toBe('no-programado')
  })
})

describe('series y rangos', () => {
  test('weekRange y monthRange', () => {
    expect(weekRange('2026-10-28')).toEqual({ from: '2026-10-26', to: '2026-11-01' })
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(monthRange('2028-02').to).toBe('2028-02-29')
    expect(monthRange('2026-12').to).toBe('2026-12-31')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })

  test('monthlySeries cubre desde el primer periodo hasta el mes actual', () => {
    const h = habit([dias('2026-09-14', [...WEEKDAYS])])
    const s = monthlySeries([h], new Map([['h1', logs(range('2026-09-14', '2026-10-28').filter(isWeekday))]]), TODAY)
    expect(s.map((x) => x.month)).toEqual(['2026-09', '2026-10'])
    expect(s[0].count).toEqual({ done: 13, scheduled: 13 }) // laborables del 14 al 30 de septiembre
  })

  test('sin hábitos no hay serie; sumCounts y totalCompliance suman hábitos', () => {
    expect(monthlySeries([], new Map(), TODAY)).toEqual([])
    expect(sumCounts([{ done: 3, scheduled: 4 }, { done: 1, scheduled: 4 }])).toEqual({ done: 4, scheduled: 8 })
    const a = habit([dias('2026-10-05', [...WEEKDAYS])], { id: 'a' })
    const b = habit([dias('2026-10-05', [...WEEKDAYS])], { id: 'b' })
    const l = new Map([['a', logs(['2026-10-12', '2026-10-13'])]])
    expect(totalCompliance([a, b], l, '2026-10-12', '2026-10-13', TODAY)).toEqual({ done: 2, scheduled: 4 })
  })
})
