import { addDays, startOfWeek, type IsoDate } from '../../../lib/dates'
import { isDone, isScheduledDay, periodAt, weekDoneCount } from './schedule'
import type { Habit, LogsByDate, SchedulePeriod, Streak } from './types'

function firstDay(h: Habit): IsoDate {
  return h.schedules.reduce((min, p) => (p.validFrom < min ? p.validFrom : min), h.schedules[0].validFrom)
}

/** Periodo del último día activo de la semana, sin pasar de `until`. Define la N de esa semana. */
function lastPeriodInWeek(h: Habit, weekStart: IsoDate, until: IsoDate): SchedulePeriod | null {
  for (let d = until; d >= weekStart; d = addDays(d, -1)) {
    const p = periodAt(h, d)
    if (p) return p
  }
  return null
}

/**
 * Racha actual. La unidad la da el periodo vigente; al retroceder se detiene en un periodo
 * de otra frecuencia o antes del primer periodo.
 */
export function currentStreak(h: Habit, logs: LogsByDate, today: IsoDate): Streak | null {
  if (h.archivedAt || h.schedules.length === 0) return null
  const current = periodAt(h, today)
  if (!current) return null
  const start = firstDay(h)

  if (current.frequency.kind === 'dias') {
    let value = 0
    for (let d = today; d >= start; d = addDays(d, -1)) {
      const p = periodAt(h, d)
      if (!p) continue // hueco (archivado): no programado
      if (p.frequency.kind !== 'dias') break
      if (!isScheduledDay(h, d)) continue
      if (isDone(h, p, logs.get(d))) value++
      else if (d !== today) break
    }
    return { value, unit: 'dias' }
  }

  let value = 0
  const thisWeek = startOfWeek(today)
  for (let w = thisWeek; addDays(w, 6) >= start; w = addDays(w, -7)) {
    const sunday = addDays(w, 6)
    const ref = lastPeriodInWeek(h, w, w === thisWeek ? today : sunday)
    if (!ref) continue // semana entera sin periodo
    if (ref.frequency.kind !== 'semanal') break
    const met = weekDoneCount(h, logs, w) >= ref.frequency.timesPerWeek
    // Parcial: algún periodo empieza después del lunes o termina antes del domingo
    const partial = h.schedules.some(
      (p) => (p.validFrom > w && p.validFrom <= sunday) || (p.validTo !== null && p.validTo >= w && p.validTo < sunday),
    )
    if (met) value++
    else if (w !== thisWeek && !partial) break
  }
  return { value, unit: 'semanas' }
}
