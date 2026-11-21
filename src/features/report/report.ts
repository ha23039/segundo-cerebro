import { addDays, type IsoDate } from '../../lib/dates'
import { areaLabel } from '../habits/domain/areas'
import type { Excuses, Habit, LogsByDate } from '../habits/domain/types'
import { currentStreak } from '../habits/domain/streaks'
import { bestStreak } from '../stats/domain/best'
import { addMonths, compliance, monthOf, monthRange, weekRange, sumCounts, firstScheduleDate } from '../stats/domain/compliance'
import { streakText } from '../stats/format'

export type PeriodId = 'semana' | 'mes' | 'mes-anterior' | 'todo'

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mes' },
  { id: 'mes-anterior', label: 'Mes anterior' },
  { id: 'todo', label: 'Todo el historial' },
]

export function periodRange(id: PeriodId, today: IsoDate, habits: readonly Habit[]): { from: IsoDate; to: IsoDate } {
  if (id === 'semana') return weekRange(today)
  if (id === 'mes') return monthRange(monthOf(today))
  if (id === 'mes-anterior') return monthRange(addMonths(monthOf(today), -1))
  return { from: firstScheduleDate(habits) ?? today, to: today }
}

export interface HabitReportRow {
  id: string
  name: string
  area: string
  archived: boolean
  done: number
  scheduled: number
  ratio: number | null
  current: string
  best: string
}

/** Una fila por hábito con actividad programada en el periodo (también archivados); ordenadas por cumplimiento. */
export function buildReport(habits: readonly Habit[], logs: Map<string, LogsByDate>, ex: Excuses, from: IsoDate, to: IsoDate, today: IsoDate) {
  const empty: LogsByDate = new Map()
  const rows: HabitReportRow[] = []
  const counts = []
  for (const h of habits) {
    const l = logs.get(h.id) ?? empty
    const c = compliance(h, l, from, to, today, ex)
    if (c.scheduled === 0) continue
    counts.push(c)
    rows.push({
      id: h.id,
      name: h.name,
      area: areaLabel(h.area),
      archived: h.archivedAt !== null,
      done: c.done,
      scheduled: c.scheduled,
      ratio: c.done / c.scheduled,
      current: streakText(currentStreak(h, l, today, ex)),
      best: streakText(bestStreak(h, l, today, ex)),
    })
  }
  rows.sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0) || a.name.localeCompare(b.name, 'es'))
  const total = sumCounts(counts)
  return { rows, total, ratio: total.scheduled ? total.done / total.scheduled : null }
}

export const rangeDays = (from: IsoDate, to: IsoDate): IsoDate[] => {
  const out: IsoDate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}
