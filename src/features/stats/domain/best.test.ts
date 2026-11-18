import { describe, expect, test } from 'vitest'
import { addDays, type IsoDate } from '../../../lib/dates'
import { bestScoreStreak, scoreStreak } from '../../dashboard/domain/score'
import { buildExcuses } from '../../habits/domain/excuses'
import { dias, habit, logs, semanal } from '../../habits/domain/testing'
import { currentStreak } from '../../habits/domain/streaks'
import { bestStreak } from './best'

const TODAY = '2026-10-28'
const ALL = [1, 2, 3, 4, 5, 6, 7] as const

function range(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

describe('bestStreak', () => {
  test('diario: la mejor racha es la larga, la actual la corta', () => {
    const h = habit([dias('2026-09-28', [...ALL])])
    const l = logs([...range('2026-09-28', '2026-10-17'), ...range('2026-10-19', '2026-10-27')])
    expect(bestStreak(h, l, TODAY)).toEqual({ value: 20, unit: 'dias' })
    expect(currentStreak(h, l, TODAY)).toEqual({ value: 9, unit: 'dias' })
  })

  test('semanal: mejor tramo de semanas cumplidas', () => {
    const h = habit([semanal('2026-09-14', 2)])
    // semanas del 14, 21 y 28-sep cumplidas; la del 5-oct falla; la del 12-oct cumplida; 19-oct falla
    const l = logs(['2026-09-14', '2026-09-15', '2026-09-21', '2026-09-22', '2026-09-28', '2026-09-29', '2026-10-12', '2026-10-13'])
    expect(bestStreak(h, l, TODAY)).toEqual({ value: 3, unit: 'semanas' })
  })

  test('archivado: conserva su mejor racha', () => {
    const h = habit([dias('2026-10-01', [...ALL], '2026-10-05')], { archivedAt: '2026-10-06T10:00:00Z' })
    expect(bestStreak(h, logs(range('2026-10-01', '2026-10-05')), TODAY)).toEqual({ value: 5, unit: 'dias' })
    expect(currentStreak(h, logs(range('2026-10-01', '2026-10-05')), TODAY)).toBeNull()
  })

  test('sin registros es 0; sin periodos es null', () => {
    expect(bestStreak(habit([dias('2026-10-01', [...ALL])]), new Map(), TODAY)).toEqual({ value: 0, unit: 'dias' })
    expect(bestStreak(habit([dias('2026-10-01', [...ALL])], { schedules: [] }), new Map(), TODAY)).toBeNull()
  })

  test('un descanso no rompe la racha', () => {
    const h = habit([dias('2026-10-19', [...ALL])])
    const l = logs(range('2026-10-19', '2026-10-27').filter((d) => d !== '2026-10-24'))
    expect(bestStreak(h, l, TODAY)).toEqual({ value: 5, unit: 'dias' }) // 19-23, hueco el 24, luego 3
    expect(bestStreak(h, l, TODAY, buildExcuses([{ date: '2026-10-24' }], []))).toEqual({ value: 8, unit: 'dias' })
  })

  test('hoy sin hacer no rompe la racha', () => {
    const h = habit([dias('2026-10-24', [...ALL])])
    expect(bestStreak(h, logs(range('2026-10-24', '2026-10-27')), TODAY)).toEqual({ value: 4, unit: 'dias' })
  })

  test('nunca es menor que la actual', () => {
    const h = habit([dias('2026-10-01', [...ALL])])
    const l = logs(range('2026-10-10', '2026-10-28'))
    expect(bestStreak(h, l, TODAY)!.value).toBeGreaterThanOrEqual(currentStreak(h, l, TODAY)!.value)
  })
})

describe('bestScoreStreak', () => {
  test('mejor racha de días con puntuación ≥ 70', () => {
    const h = habit([dias('2026-10-01', [...ALL])], { id: 'h1' })
    const l = new Map([['h1', logs([...range('2026-10-01', '2026-10-10'), ...range('2026-10-12', '2026-10-27')])]])
    const prio = new Map()
    expect(bestScoreStreak([h], l, prio, TODAY)).toBe(16)
    expect(scoreStreak([h], l, prio, TODAY)).toBe(16)
    expect(bestScoreStreak([], new Map(), prio, TODAY)).toBe(0)
  })
})
