import { addDays, type IsoDate } from '../../../lib/dates'
import { NO_EXCUSES } from '../../habits/domain/excuses'
import { isDone, isDueOn, periodAt } from '../../habits/domain/schedule'
import type { Excuses, Habit, LogsByDate } from '../../habits/domain/types'

export interface Count {
  done: number
  scheduled: number
}

const EMPTY: LogsByDate = new Map()

export function ratio(c: Count): number | null {
  return c.scheduled ? c.done / c.scheduled : null
}

/** Lo que tocaba un día y cuánto se hizo. Los semanales cuentan mientras la semana no esté cumplida. */
export function dayCount(habits: Habit[], logs: Map<string, LogsByDate>, date: IsoDate, _today: IsoDate, ex: Excuses = NO_EXCUSES): Count {
  let done = 0
  let scheduled = 0
  for (const h of habits) {
    const p = periodAt(h, date)
    if (!p || h.archivedAt) continue
    const hl = logs.get(h.id) ?? EMPTY
    if (!isDueOn(h, hl, date, ex)) continue
    scheduled++
    if (isDone(h, p, hl.get(date))) done++
  }
  return { done, scheduled }
}

/** Suma de un rango. Los días futuros no cuentan; hoy solo suma lo ya hecho. */
export function rangeCount(habits: Habit[], logs: Map<string, LogsByDate>, from: IsoDate, to: IsoDate, today: IsoDate, ex: Excuses = NO_EXCUSES): Count {
  let done = 0
  let scheduled = 0
  for (let d = from; d <= to && d <= today; d = addDays(d, 1)) {
    const c = dayCount(habits, logs, d, today, ex)
    done += c.done
    scheduled += d === today ? c.done : c.scheduled
  }
  return { done, scheduled }
}

function firstDay(habits: Habit[]): IsoDate | null {
  const all = habits.flatMap((h) => h.schedules.map((s) => s.validFrom)).sort()
  return all[0] ?? null
}

/** Días seguidos con al menos `threshold` de cumplimiento. Hoy sin terminar no rompe. */
export function globalStreak(habits: Habit[], logs: Map<string, LogsByDate>, today: IsoDate, threshold = 0.8): number {
  const start = firstDay(habits)
  if (!start) return 0
  let streak = 0
  for (let d = today; d >= start; d = addDays(d, -1)) {
    const r = ratio(dayCount(habits, logs, d, today))
    if (r === null) continue
    if (r >= threshold) streak++
    else if (d !== today) break
  }
  return streak
}

export function lastDays(habits: Habit[], logs: Map<string, LogsByDate>, today: IsoDate, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1)
    return { date, ratio: ratio(dayCount(habits, logs, date, today)) }
  })
}
