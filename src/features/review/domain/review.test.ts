import { describe, expect, it } from 'vitest'
import { dias, habit, logs } from '../../habits/domain/testing'
import { NO_EXCUSES } from '../../habits/domain/excuses'
import { buildReview, defaultWeek, reviewWeeks, validateReviewText } from './review'

// 2026-11-22 es domingo; la semana va del 16 al 22.
const ALL: (1 | 2 | 3 | 4 | 5 | 6 | 7)[] = [1, 2, 3, 4, 5, 6, 7]

describe('semanas de la revisión', () => {
  it('devuelve la semana en curso y la anterior, de lunes a domingo', () => {
    const w = reviewWeeks('2026-11-25')
    expect(w.actual).toMatchObject({ from: '2026-11-23', to: '2026-11-29' })
    expect(w.anterior).toMatchObject({ from: '2026-11-16', to: '2026-11-22' })
  })

  it('el domingo se revisa la semana en curso; el resto de días, la anterior', () => {
    expect(defaultWeek('2026-11-22')).toBe('actual')
    expect(defaultWeek('2026-11-23')).toBe('anterior')
    expect(defaultWeek('2026-11-27')).toBe('anterior')
  })
})

describe('cifras de la revisión', () => {
  const today = '2026-11-23'
  const week = reviewWeeks(today).anterior
  const full = habit([dias('2026-10-01', ALL)], { id: 'a', name: 'Leer' })
  const weak = habit([dias('2026-10-01', ALL)], { id: 'b', name: 'Correr' })
  const logMap = new Map([
    ['a', logs(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'])],
    ['b', logs(['2026-11-16', '2026-11-17'])],
  ])

  it('calcula el cumplimiento, los hábitos perfectos y los que cuestan', () => {
    const r = buildReview([full, weak], logMap, NO_EXCUSES, week, today)
    expect(r.done).toBe(9)
    expect(r.scheduled).toBe(14)
    expect(r.ratio).toBeCloseTo(9 / 14)
    expect(r.perfect.map((p) => p.name)).toEqual(['Leer'])
    expect(r.weakest.map((p) => p.name)).toEqual(['Correr'])
  })

  it('compara con la semana anterior y no inventa nada si no había datos', () => {
    const r = buildReview([full, weak], logMap, NO_EXCUSES, week, today)
    expect(r.previousRatio).toBe(0)
    const none = buildReview([], new Map(), NO_EXCUSES, week, today)
    expect(none.ratio).toBeNull()
    expect(none.previousRatio).toBeNull()
    expect(none.rows).toEqual([])
  })
})

describe('texto de la revisión', () => {
  it('exige al menos una nota y recorta espacios', () => {
    expect(validateReviewText({ wentWell: '  ', toImprove: '', nextFocus: '' }).ok).toBe(false)
    const ok = validateReviewText({ wentWell: '  Bien  ', toImprove: '', nextFocus: '' })
    expect(ok).toEqual({ ok: true, value: { wentWell: 'Bien', toImprove: '', nextFocus: '' } })
  })

  it('respeta los límites', () => {
    expect(validateReviewText({ wentWell: 'x'.repeat(1001), toImprove: '', nextFocus: '' }).ok).toBe(false)
    expect(validateReviewText({ wentWell: '', toImprove: '', nextFocus: 'x'.repeat(501) }).ok).toBe(false)
    expect(validateReviewText({ wentWell: 'x'.repeat(1000), toImprove: 'y'.repeat(1000), nextFocus: 'z'.repeat(500) }).ok).toBe(true)
  })
})
