import { describe, expect, test } from 'vitest'
import { addDays, type IsoDate } from '../../../lib/dates'
import { averageScore, dayScore, lastScores, scoreStreak } from '../../dashboard/domain/score'
import { rangeCount } from '../../dashboard/domain/summary'
import { buildExcuses, isExcused, skipOf } from './excuses'
import { isDueOn, weekTarget } from './schedule'
import { currentStreak } from './streaks'
import { dias, habit, logs, semanal } from './testing'
import type { LogsByDate, SkipReason } from './types'

const TODAY = '2026-10-28' // miércoles; la semana empieza el lunes 26
const ALL = [1, 2, 3, 4, 5, 6, 7] as const

function range(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

const ex = (rest: IsoDate[], skips: [string, IsoDate, SkipReason][] = []) =>
  buildExcuses(
    rest.map((date) => ({ date })),
    skips.map(([habitId, date, reason]) => ({ habitId, date, reason })),
  )

describe('buildExcuses', () => {
  test('indexa descansos y omisiones por hábito', () => {
    const e = ex(['2026-10-25'], [['h1', '2026-10-27', 'viaje']])
    expect(isExcused(e, 'h1', '2026-10-25')).toBe(true) // descanso: todo el día
    expect(isExcused(e, 'otro', '2026-10-25')).toBe(true)
    expect(isExcused(e, 'h1', '2026-10-27')).toBe(true)
    expect(isExcused(e, 'otro', '2026-10-27')).toBe(false)
    expect(skipOf(e, 'h1', '2026-10-27')).toBe('viaje')
    expect(skipOf(e, 'h1', '2026-10-28')).toBeNull()
  })
})

describe('racha por días con excusas', () => {
  const h = habit([dias('2026-10-19', [...ALL])])

  test('un descanso ni suma ni rompe', () => {
    const l = logs(range('2026-10-19', '2026-10-27').filter((d) => d !== '2026-10-24'))
    expect(currentStreak(h, l, TODAY)?.value).toBe(3) // sin excusa se corta el sábado
    expect(currentStreak(h, l, TODAY, ex(['2026-10-24']))?.value).toBe(8)
  })

  test('una omisión justificada de ese hábito ni suma ni rompe', () => {
    const l = logs(range('2026-10-19', '2026-10-27').filter((d) => d !== '2026-10-24'))
    expect(currentStreak(h, l, TODAY, ex([], [['h1', '2026-10-24', 'enfermedad']]))?.value).toBe(8)
    // La omisión de otro hábito no protege a este
    expect(currentStreak(h, l, TODAY, ex([], [['h2', '2026-10-24', 'enfermedad']]))?.value).toBe(3)
  })

  test('si se hizo en un día excusado, igualmente suma', () => {
    const l = logs(range('2026-10-19', '2026-10-27'))
    expect(currentStreak(h, l, TODAY, ex(['2026-10-24']))?.value).toBe(9)
  })
})

describe('frecuencia semanal con excusas', () => {
  const h = habit([semanal('2026-10-05', 3)])

  test('cada omisión descuenta una vez del objetivo; los descansos solo quitan días', () => {
    const none: LogsByDate = new Map()
    expect(weekTarget(h, none, '2026-10-26', 3)).toBe(3)
    expect(weekTarget(h, none, '2026-10-26', 3, ex([], [['h1', '2026-10-26', 'viaje']]))).toBe(2)
    expect(weekTarget(h, none, '2026-10-26', 3, ex(['2026-10-26']))).toBe(3)
    expect(weekTarget(h, none, '2026-10-26', 3, ex(range('2026-10-26', '2026-10-30')))).toBe(2) // quedan sáb y dom
    expect(weekTarget(h, none, '2026-10-26', 3, ex(range('2026-10-26', '2026-11-01')))).toBe(0)
  })

  test('una semana con el objetivo rebajado y cumplido cuenta para la racha', () => {
    // Semana del 19: solo 2 hechas, pero una omisión justificada → objetivo 2, cumplida
    const l = logs(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-20', '2026-10-21'])
    expect(currentStreak(h, l, TODAY)?.value).toBe(0)
    expect(currentStreak(h, l, TODAY, ex([], [['h1', '2026-10-22', 'enfermedad']]))?.value).toBe(3)
  })

  test('una semana entera de descanso (vacaciones) se salta', () => {
    const l = logs(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-12', '2026-10-13', '2026-10-14'])
    expect(currentStreak(h, l, TODAY)?.value).toBe(0)
    expect(currentStreak(h, l, TODAY, ex(range('2026-10-19', '2026-10-25')))?.value).toBe(2)
  })

  test('deja de tocar cuando el objetivo rebajado ya está cumplido', () => {
    const l = logs(['2026-10-26', '2026-10-27'])
    expect(isDueOn(h, l, TODAY)).toBe(true)
    expect(isDueOn(h, l, TODAY, ex([], [['h1', '2026-10-26', 'otro']]))).toBe(true) // el 26 está hecho: no descuenta
    expect(isDueOn(h, l, TODAY, ex([], [['h1', '2026-10-30', 'viaje']]))).toBe(false)
  })
})

describe('puntuación con excusas', () => {
  const leer = habit([dias('2026-10-19', [...ALL])], { id: 'leer', weight: 4 })
  const agua = habit([dias('2026-10-19', [...ALL])], { id: 'agua', weight: 2 })
  const map = (e: [string, LogsByDate][]) => new Map(e)

  test('un día de descanso no puntúa', () => {
    expect(dayScore([leer], map([]), [], TODAY, ex([TODAY]))).toBeNull()
  })

  test('un hábito omitido sale del cálculo', () => {
    const l = map([['leer', logs([TODAY])]])
    expect(dayScore([leer, agua], l, [], TODAY)?.score).toBe(67)
    expect(dayScore([leer, agua], l, [], TODAY, ex([], [['agua', TODAY, 'enfermedad']]))).toMatchObject({ score: 100, habitsTotal: 1 })
  })

  test('la racha de puntuación y las medias saltan los descansos', () => {
    const l = map([['leer', logs(range('2026-10-19', '2026-10-27').filter((d) => d !== '2026-10-25'))]])
    const prio = new Map()
    expect(scoreStreak([leer], l, prio, TODAY)).toBe(2)
    const e = ex(['2026-10-25'])
    expect(scoreStreak([leer], l, prio, TODAY, e)).toBe(8)
    expect(averageScore([leer], l, prio, '2026-10-19', '2026-10-27', TODAY)).toBe(89)
    expect(averageScore([leer], l, prio, '2026-10-19', '2026-10-27', TODAY, e)).toBe(100)
    expect(lastScores([leer], l, prio, TODAY, 7, e).find((d) => d.date === '2026-10-25')).toEqual({ date: '2026-10-25', score: null, rest: true })
  })

  test('la constancia por área no cuenta lo excusado', () => {
    const l = map([['leer', logs(['2026-10-26'])]])
    expect(rangeCount([leer], l, '2026-10-26', '2026-10-27', TODAY)).toEqual({ done: 1, scheduled: 2 })
    expect(rangeCount([leer], l, '2026-10-26', '2026-10-27', TODAY, ex(['2026-10-27']))).toEqual({ done: 1, scheduled: 1 })
  })
})
