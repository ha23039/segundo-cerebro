import { addDays, isoWeekday, startOfWeek, type IsoDate } from '../../../lib/dates'
import { isExcused, NO_EXCUSES } from './excuses'
import type { Excuses, Habit, LogsByDate, SchedulePeriod } from './types'

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

/**
 * Objetivo real de una semana con frecuencia semanal: cada omisión justificada descuenta una vez,
 * y los descansos quitan días disponibles (no se puede pedir más veces que días libres quedan).
 * Los días excusados en que igualmente se hizo no descuentan nada.
 */
export function weekTarget(h: Habit, logs: LogsByDate, weekStart: IsoDate, timesPerWeek: number, ex: Excuses = NO_EXCUSES): number {
  let skips = 0
  let rests = 0
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i)
    const p = periodAt(h, d)
    if (p && isDone(h, p, logs.get(d))) continue
    if (ex.skips.get(h.id)?.has(d)) skips++
    else if (ex.rest.has(d)) rests++
  }
  return Math.max(0, Math.min(timesPerWeek - skips, 7 - skips - rests))
}

/**
 * ¿Cuenta este hábito ese día? Un día excusado (descanso u omisión) no cuenta salvo que se hiciera.
 * Sin excusas: comportamiento original.
 */
export function isDueOn(h: Habit, logs: LogsByDate, date: IsoDate, ex: Excuses = NO_EXCUSES): boolean {
  if (h.archivedAt) return false
  const p = periodAt(h, date)
  if (!p) return false
  const done = isDone(h, p, logs.get(date))
  if (!done && isExcused(ex, h.id, date)) return false
  if (p.frequency.kind === 'dias') return isScheduledDay(h, date)
  const target = weekTarget(h, logs, startOfWeek(date), p.frequency.timesPerWeek, ex)
  return weekDoneCount(h, logs, startOfWeek(date)) < target || done
}
