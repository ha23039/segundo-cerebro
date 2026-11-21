import { addDays, todayIn, type IsoDate } from '../../../lib/dates'
import type { FocusKind } from './timer'

export interface FocusSession {
  id: string
  kind: FocusKind
  startedAt: string
  endedAt: string
  plannedMinutes: number
  actualMinutes: number
  habitId: string | null
  goalId: string | null
}

export interface DayFocus {
  minutes: number
  sessions: number
}

/** Minutos de foco por día. La sesión cuenta en el día (zona del perfil) en que empezó; los descansos no cuentan. */
export function focusByDate(sessions: readonly FocusSession[], timeZone: string): Map<IsoDate, DayFocus> {
  const out = new Map<IsoDate, DayFocus>()
  for (const s of sessions) {
    if (s.kind !== 'foco') continue
    const date = todayIn(timeZone, new Date(s.startedAt))
    const cur = out.get(date) ?? { minutes: 0, sessions: 0 }
    out.set(date, { minutes: cur.minutes + s.actualMinutes, sessions: cur.sessions + 1 })
  }
  return out
}

export interface WeekFocus {
  days: { date: IsoDate; minutes: number }[]
  total: number
  sessions: number
  /** Media de minutos por día con foco; null si no hay ninguno. */
  averageActiveDay: number | null
}

export function weekFocus(byDate: Map<IsoDate, DayFocus>, weekStart: IsoDate): WeekFocus {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i)
    return { date, minutes: byDate.get(date)?.minutes ?? 0 }
  })
  const total = days.reduce((n, d) => n + d.minutes, 0)
  const sessions = days.reduce((n, d) => n + (byDate.get(d.date)?.sessions ?? 0), 0)
  const active = days.filter((d) => d.minutes > 0).length
  return { days, total, sessions, averageActiveDay: active === 0 ? null : Math.round(total / active) }
}

/** Totales de las últimas `n` semanas (la más reciente al final), hasta la semana que empieza en `weekStart`. */
export function recentWeeks(byDate: Map<IsoDate, DayFocus>, weekStart: IsoDate, n = 8): { weekStart: IsoDate; minutes: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const w = addDays(weekStart, -7 * (n - 1 - i))
    return { weekStart: w, minutes: weekFocus(byDate, w).total }
  })
}
