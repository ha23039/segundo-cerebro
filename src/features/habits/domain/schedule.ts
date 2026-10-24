import { addDays, isoWeekday, startOfWeek, type IsoDate } from '../../../lib/dates'
import type { Habit, LogsByDate, SchedulePeriod } from './types'

export function periodAt(h: Habit, date: IsoDate): SchedulePeriod | null {
  return h.schedules.find((p) => p.validFrom <= date && (p.validTo === null || date <= p.validTo)) ?? null
}

/** Solo para frecuencia por días: ¿toca ese día de la semana en el periodo vigente? */
export function isScheduledDay(h: Habit, date: IsoDate): boolean {
  const p = periodAt(h, date)
  return p?.frequency.kind === 'dias' && p.frequency.days.includes(isoWeekday(date))
}

export function isDone(h: Habit, p: SchedulePeriod, value: number | undefined): boolean {
  if (value === undefined || value <= 0) return false
  return h.kind === 'check' || value >= (p.target ?? Number.POSITIVE_INFINITY)
}

/** Días hechos en la semana que empieza en `weekStart`, dentro de periodos semanales. */
export function weekDoneCount(h: Habit, logs: LogsByDate, weekStart: IsoDate): number {
  let count = 0
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i)
    const p = periodAt(h, d)
    if (p?.frequency.kind === 'semanal' && isDone(h, p, logs.get(d))) count++
  }
  return count
}

export function isDueOn(h: Habit, logs: LogsByDate, date: IsoDate): boolean {
  if (h.archivedAt) return false
  const p = periodAt(h, date)
  if (!p) return false
  if (p.frequency.kind === 'dias') return isScheduledDay(h, date)
  return weekDoneCount(h, logs, startOfWeek(date)) < p.frequency.timesPerWeek || isDone(h, p, logs.get(date))
}
