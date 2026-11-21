import { addDays, startOfWeek, type IsoDate } from '../../../lib/dates'
import { type Count } from '../../dashboard/domain/summary'
import { isExcused, NO_EXCUSES, skipOf } from '../../habits/domain/excuses'
import { isDone, isScheduledDay, periodAt, weekDoneCount, weekTarget } from '../../habits/domain/schedule'
import { isPartialWeek, lastPeriodInWeek } from '../../habits/domain/streaks'
import type { Excuses, Habit, LogsByDate } from '../../habits/domain/types'

export type { Count }

export type DayStatus = 'hecho' | 'no-hecho' | 'no-programado' | 'pendiente' | 'futuro' | 'descanso' | 'omitido'

const EMPTY: LogsByDate = new Map()

export function sumCounts(counts: readonly Count[]): Count {
  return counts.reduce((acc, c) => ({ done: acc.done + c.done, scheduled: acc.scheduled + c.scheduled }), { done: 0, scheduled: 0 })
}

/**
 * Estado de un hábito un día. Lo hecho manda; después un descanso u omisión (solo si ese día tocaba);
 * un hábito semanal sin marcar un día pasado es "no programado" (no hay un día fijo que se falle).
 */
export function dayStatus(h: Habit, logs: LogsByDate, date: IsoDate, today: IsoDate, ex: Excuses = NO_EXCUSES): DayStatus {
  const p = periodAt(h, date)
  if (!p) return 'no-programado'
  if (isDone(h, p, logs.get(date))) return 'hecho'
  if (p.frequency.kind === 'dias' && !isScheduledDay(h, date)) return 'no-programado'
  if (ex.rest.has(date)) return 'descanso'
  if (skipOf(ex, h.id, date)) return 'omitido'
  if (date > today) return 'futuro'
  if (date === today) return 'pendiente'
  return p.frequency.kind === 'dias' ? 'no-hecho' : 'no-programado'
}

/** El jueves decide a qué rango pertenece una semana (convención ISO): diciembre no se lleva la semana de enero. */
const thursdayOf = (weekStart: IsoDate): IsoDate => addDays(weekStart, 3)

/**
 * Cumplimiento de un hábito en un rango. `dias`: día a día (lo excusado no cuenta; hoy solo si está hecho).
 * `semanal`: por semana completa cuyo jueves cae en el rango, hechos (con tope en N) ÷ objetivo de la semana;
 * se excluyen las semanas parciales (cambio de periodo a mitad), las de objetivo 0 (excusadas del todo) y la
 * semana en curso mientras no llegue al objetivo.
 */
export function compliance(h: Habit, logs: LogsByDate, from: IsoDate, to: IsoDate, today: IsoDate, ex: Excuses = NO_EXCUSES): Count {
  let done = 0
  let scheduled = 0
  const end = to < today ? to : today

  for (let d = from; d <= end; d = addDays(d, 1)) {
    const p = periodAt(h, d)
    if (!p || p.frequency.kind !== 'dias' || !isScheduledDay(h, d)) continue
    if (isDone(h, p, logs.get(d))) {
      done++
      scheduled++
    } else if (isExcused(ex, h.id, d) || d === today) {
      continue
    } else {
      scheduled++
    }
  }

  for (let w = startOfWeek(from); w <= end; w = addDays(w, 7)) {
    const thu = thursdayOf(w)
    if (thu < from || thu > to) continue
    const sunday = addDays(w, 6)
    const ref = lastPeriodInWeek(h, w, sunday < today ? sunday : today)
    if (!ref || ref.frequency.kind !== 'semanal' || isPartialWeek(h, w)) continue
    const target = weekTarget(h, logs, w, ref.frequency.timesPerWeek, ex)
    if (target === 0) continue
    const count = weekDoneCount(h, logs, w)
    if (sunday >= today && count < target) continue // semana en curso sin cumplir
    done += Math.min(count, target)
    scheduled += target
  }
  return { done, scheduled }
}

export function totalCompliance(habits: readonly Habit[], logs: Map<string, LogsByDate>, from: IsoDate, to: IsoDate, today: IsoDate, ex: Excuses = NO_EXCUSES): Count {
  return sumCounts(habits.map((h) => compliance(h, logs.get(h.id) ?? EMPTY, from, to, today, ex)))
}

export function weekRange(date: IsoDate): { from: IsoDate; to: IsoDate } {
  const from = startOfWeek(date)
  return { from, to: addDays(from, 6) }
}

/** 'YYYY-MM' del mes de una fecha. */
export const monthOf = (date: IsoDate): string => date.slice(0, 7)

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const idx = y * 12 + (m - 1) + n
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`
}

export function monthRange(month: string): { from: IsoDate; to: IsoDate } {
  return { from: `${month}-01`, to: addDays(`${addMonths(month, 1)}-01`, -1) }
}

export function firstScheduleDate(habits: readonly Habit[]): IsoDate | null {
  return habits.flatMap((h) => h.schedules.map((s) => s.validFrom)).sort()[0] ?? null
}

/** Cumplimiento total por mes, desde el mes del primer periodo hasta el actual (más reciente al final). */
export function monthlySeries(habits: readonly Habit[], logs: Map<string, LogsByDate>, today: IsoDate, ex: Excuses = NO_EXCUSES): { month: string; count: Count }[] {
  const first = firstScheduleDate(habits)
  if (!first) return []
  const out: { month: string; count: Count }[] = []
  for (let m = monthOf(first); m <= monthOf(today); m = addMonths(m, 1)) {
    const { from, to } = monthRange(m)
    out.push({ month: m, count: totalCompliance(habits, logs, from, to, today, ex) })
  }
  return out
}
