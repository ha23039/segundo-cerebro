import { addDays, startOfWeek, type IsoDate } from '../../../lib/dates'
import { isExcused, NO_EXCUSES } from '../../habits/domain/excuses'
import { isDone, isScheduledDay, periodAt, weekDoneCount, weekTarget } from '../../habits/domain/schedule'
import { isPartialWeek, lastPeriodInWeek } from '../../habits/domain/streaks'
import type { Excuses, Habit, LogsByDate, Streak } from '../../habits/domain/types'

/**
 * Mejor racha histórica, con las mismas reglas que la racha actual (las excusas ni suman ni rompen) y
 * en la unidad del último periodo; un tramo con otra frecuencia reinicia la cuenta. Sirve también para archivados.
 */
export function bestStreak(h: Habit, logs: LogsByDate, today: IsoDate, ex: Excuses = NO_EXCUSES): Streak | null {
  if (h.schedules.length === 0) return null
  const start = h.schedules.reduce((min, p) => (p.validFrom < min ? p.validFrom : min), h.schedules[0].validFrom)
  const latest = h.schedules.reduce((a, b) => (b.validFrom > a.validFrom ? b : a))
  let run = 0
  let best = 0

  if (latest.frequency.kind === 'dias') {
    for (let d = start; d <= today; d = addDays(d, 1)) {
      const p = periodAt(h, d)
      if (!p) continue
      if (p.frequency.kind !== 'dias') {
        run = 0
        continue
      }
      if (!isScheduledDay(h, d)) continue
      if (isDone(h, p, logs.get(d))) {
        run++
        best = Math.max(best, run)
      } else if (isExcused(ex, h.id, d)) continue
      else if (d !== today) run = 0
    }
    return { value: best, unit: 'dias' }
  }

  const thisWeek = startOfWeek(today)
  for (let w = startOfWeek(start); w <= thisWeek; w = addDays(w, 7)) {
    const ref = lastPeriodInWeek(h, w, w === thisWeek ? today : addDays(w, 6))
    if (!ref) continue
    if (ref.frequency.kind !== 'semanal') {
      run = 0
      continue
    }
    const target = weekTarget(h, logs, w, ref.frequency.timesPerWeek, ex)
    if (target === 0) continue
    if (weekDoneCount(h, logs, w) >= target) {
      run++
      best = Math.max(best, run)
    } else if (w !== thisWeek && !isPartialWeek(h, w)) run = 0
  }
  return { value: best, unit: 'semanas' }
}
