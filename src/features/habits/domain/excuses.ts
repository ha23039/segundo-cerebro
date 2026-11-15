import type { IsoDate } from '../../../lib/dates'
import type { Excuses, SkipReason } from './types'

export const NO_EXCUSES: Excuses = { rest: new Set(), skips: new Map() }

export const SKIP_REASONS: { id: SkipReason; label: string }[] = [
  { id: 'enfermedad', label: 'Enfermedad' },
  { id: 'viaje', label: 'Viaje' },
  { id: 'imprevisto', label: 'Imprevisto' },
  { id: 'descanso', label: 'Descanso' },
  { id: 'otro', label: 'Otro' },
]

export function skipReasonLabel(r: SkipReason): string {
  return SKIP_REASONS.find((x) => x.id === r)?.label ?? 'Otro'
}

export function isSkipReason(v: string): v is SkipReason {
  return SKIP_REASONS.some((x) => x.id === v)
}

export function skipOf(ex: Excuses, habitId: string, date: IsoDate): SkipReason | null {
  return ex.skips.get(habitId)?.get(date) ?? null
}

export function isExcused(ex: Excuses, habitId: string, date: IsoDate): boolean {
  return ex.rest.has(date) || ex.skips.get(habitId)?.has(date) === true
}

export function buildExcuses(rest: { date: IsoDate }[], skips: { habitId: string; date: IsoDate; reason: SkipReason }[]): Excuses {
  const byHabit = new Map<string, Map<IsoDate, SkipReason>>()
  for (const s of skips) {
    const m = byHabit.get(s.habitId) ?? new Map<IsoDate, SkipReason>()
    m.set(s.date, s.reason)
    byHabit.set(s.habitId, m)
  }
  return { rest: new Set(rest.map((r) => r.date)), skips: byHabit }
}
