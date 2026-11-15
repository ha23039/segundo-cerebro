import { addDays, type IsoDate } from '../../../lib/dates'
import { NO_EXCUSES } from '../../habits/domain/excuses'
import { isDone, isDueOn, periodAt } from '../../habits/domain/schedule'
import type { Excuses, Habit, LogsByDate, SchedulePeriod } from '../../habits/domain/types'

export interface Priority {
  id: string
  date: IsoDate
  position: number
  title: string
  done: boolean
}

export interface DayScore {
  score: number
  habitsDone: number
  habitsTotal: number
  prioritiesDone: number
  prioritiesTotal: number
}

/** Cada prioridad del día pesa lo mismo que un hábito importante. */
export const PRIORITY_WEIGHT = 4
/** Puntuación mínima para que un día sume a la racha global. */
export const STREAK_THRESHOLD = 70

const EMPTY: LogsByDate = new Map()

/** Grado de cumplimiento de 0 a 1: check entero; cantidad parcial con tope en la meta. */
export function completion(h: Habit, p: SchedulePeriod, value: number | undefined): number {
  if (!value || value <= 0) return 0
  if (h.kind === 'check') return 1
  return Math.min(1, value / (p.target ?? value))
}

/**
 * Puntuación 0-100 del día: hábitos ponderados por peso (lo parcial suma) + prioridades.
 * Un día de descanso no puntúa (null); un hábito omitido con motivo sale del cálculo.
 */
export function dayScore(habits: Habit[], logs: Map<string, LogsByDate>, priorities: Priority[], date: IsoDate, ex: Excuses = NO_EXCUSES): DayScore | null {
  if (ex.rest.has(date)) return null
  let num = 0
  let den = 0
  let habitsDone = 0
  let habitsTotal = 0
  for (const h of habits) {
    const p = periodAt(h, date)
    if (!p || h.archivedAt) continue
    const hl = logs.get(h.id) ?? EMPTY
    if (!isDueOn(h, hl, date, ex)) continue
    const value = hl.get(date)
    num += h.weight * completion(h, p, value)
    den += h.weight
    habitsTotal++
    if (isDone(h, p, value)) habitsDone++
  }
  const prioritiesDone = priorities.filter((x) => x.done).length
  num += PRIORITY_WEIGHT * prioritiesDone
  den += PRIORITY_WEIGHT * priorities.length
  if (den === 0) return null
  return { score: Math.round((100 * num) / den), habitsDone, habitsTotal, prioritiesDone, prioritiesTotal: priorities.length }
}

type PrioritiesByDate = Map<IsoDate, Priority[]>

const scoreAt = (habits: Habit[], logs: Map<string, LogsByDate>, prio: PrioritiesByDate, d: IsoDate, ex: Excuses) =>
  dayScore(habits, logs, prio.get(d) ?? [], d, ex)?.score ?? null

function firstDay(habits: Habit[]): IsoDate | null {
  return habits.flatMap((h) => h.schedules.map((s) => s.validFrom)).sort()[0] ?? null
}

/** Días seguidos con puntuación ≥ 70. Hoy en curso no rompe; los días sin nada programado o de descanso se saltan. */
export function scoreStreak(habits: Habit[], logs: Map<string, LogsByDate>, prio: PrioritiesByDate, today: IsoDate, ex: Excuses = NO_EXCUSES): number {
  const start = firstDay(habits)
  if (!start) return 0
  let streak = 0
  for (let d = today; d >= start; d = addDays(d, -1)) {
    const s = scoreAt(habits, logs, prio, d, ex)
    if (s === null) continue
    if (s >= STREAK_THRESHOLD) streak++
    else if (d !== today) break
  }
  return streak
}

/** Media de la puntuación de los días cerrados del rango; si aún no hay ninguno, la de hoy. */
export function averageScore(
  habits: Habit[],
  logs: Map<string, LogsByDate>,
  prio: PrioritiesByDate,
  from: IsoDate,
  to: IsoDate,
  today: IsoDate,
  ex: Excuses = NO_EXCUSES,
): number | null {
  const scores: number[] = []
  for (let d = from; d <= to && d < today; d = addDays(d, 1)) {
    const s = scoreAt(habits, logs, prio, d, ex)
    if (s !== null) scores.push(s)
  }
  if (scores.length === 0) return from <= today && today <= to ? scoreAt(habits, logs, prio, today, ex) : null
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}

export function lastScores(habits: Habit[], logs: Map<string, LogsByDate>, prio: PrioritiesByDate, today: IsoDate, n: number, ex: Excuses = NO_EXCUSES) {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1)
    return { date, score: scoreAt(habits, logs, prio, date, ex), rest: ex.rest.has(date) }
  })
}
