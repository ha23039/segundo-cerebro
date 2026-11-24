import { addDays, isoWeekday, type IsoDate } from '../../../lib/dates'
import type { Excuses, Habit, LogsByDate } from '../../habits/domain/types'
import { buildReport, type HabitReportRow } from '../../report/report'
import { weekRange } from '../../stats/domain/compliance'

export type WeekId = 'actual' | 'anterior'

export interface Week {
  id: WeekId
  from: IsoDate
  to: IsoDate
}

/** La semana en curso y la anterior (lunes a domingo). */
export function reviewWeeks(today: IsoDate): Record<WeekId, Week> {
  const actual = weekRange(today)
  const anterior = weekRange(addDays(actual.from, -7))
  return { actual: { id: 'actual', ...actual }, anterior: { id: 'anterior', ...anterior } }
}

/** El domingo se revisa la semana que termina; el resto de días, la que acaba de terminar. */
export function defaultWeek(today: IsoDate): WeekId {
  return isoWeekday(today) === 7 ? 'actual' : 'anterior'
}

export interface Review {
  ratio: number | null
  previousRatio: number | null
  done: number
  scheduled: number
  /** Hábitos con la semana completa (todo lo programado, hecho). */
  perfect: HabitReportRow[]
  /** Los que más cuestan (por debajo del 70 %), del peor al mejor, hasta 3. */
  weakest: HabitReportRow[]
  rows: HabitReportRow[]
}

const WEAK_BELOW = 0.7

export function buildReview(habits: readonly Habit[], logs: Map<string, LogsByDate>, ex: Excuses, week: Week, today: IsoDate): Review {
  const current = buildReport(habits, logs, ex, week.from, week.to, today)
  const before = weekRange(addDays(week.from, -7))
  const previous = buildReport(habits, logs, ex, before.from, before.to, today)
  const weakest = current.rows
    .filter((r) => (r.ratio ?? 1) < WEAK_BELOW)
    .sort((a, b) => (a.ratio ?? 0) - (b.ratio ?? 0) || a.name.localeCompare(b.name, 'es'))
    .slice(0, 3)
  return {
    ratio: current.ratio,
    previousRatio: previous.ratio,
    done: current.total.done,
    scheduled: current.total.scheduled,
    perfect: current.rows.filter((r) => r.scheduled > 0 && r.done === r.scheduled),
    weakest,
    rows: current.rows,
  }
}

export const REVIEW_LIMITS = { wentWell: 1000, toImprove: 1000, nextFocus: 500 } as const

export interface ReviewText {
  wentWell: string
  toImprove: string
  nextFocus: string
}

export type ReviewTextCheck = { ok: true; value: ReviewText } | { ok: false; error: string }

export function validateReviewText(input: ReviewText): ReviewTextCheck {
  const value = { wentWell: input.wentWell.trim(), toImprove: input.toImprove.trim(), nextFocus: input.nextFocus.trim() }
  if (!value.wentWell && !value.toImprove && !value.nextFocus) return { ok: false, error: 'Escribe al menos una de las tres notas' }
  if (value.wentWell.length > REVIEW_LIMITS.wentWell) return { ok: false, error: `«Qué fue bien» admite hasta ${REVIEW_LIMITS.wentWell} caracteres` }
  if (value.toImprove.length > REVIEW_LIMITS.toImprove) return { ok: false, error: `«Qué mejorar» admite hasta ${REVIEW_LIMITS.toImprove} caracteres` }
  if (value.nextFocus.length > REVIEW_LIMITS.nextFocus) return { ok: false, error: `«Foco de la próxima semana» admite hasta ${REVIEW_LIMITS.nextFocus} caracteres` }
  return { ok: true, value }
}
