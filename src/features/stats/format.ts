import type { IsoDate } from '../../lib/dates'
import type { Streak } from '../habits/domain/types'
import type { DayStatus } from './domain/compliance'

export const STATUS_LABEL: Record<DayStatus, string> = {
  hecho: 'hecho',
  'no-hecho': 'no hecho',
  'no-programado': 'no programado',
  pendiente: 'pendiente',
  futuro: 'por llegar',
  descanso: 'día de descanso',
  omitido: 'omitido',
}

const fmt = (opts: Intl.DateTimeFormatOptions, date: IsoDate) => new Intl.DateTimeFormat('es-ES', { ...opts, timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))

/** '26 oct – 1 nov 2026' */
export function formatRange(from: IsoDate, to: IsoDate): string {
  const sameYear = from.slice(0, 4) === to.slice(0, 4)
  const a = fmt(sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }, from)
  return `${a.replace(/\./g, '')} – ${fmt({ day: 'numeric', month: 'short', year: 'numeric' }, to).replace(/\./g, '')}`
}

/** 'octubre de 2026' */
export function monthLabel(month: string): string {
  return fmt({ month: 'long', year: 'numeric' }, `${month}-01`)
}

/** 'oct 2026' */
export function monthShort(month: string): string {
  return fmt({ month: 'short', year: 'numeric' }, `${month}-01`).replace(/\./g, '')
}

/** '5 de octubre' y 'lunes' */
export const dayLong = (date: IsoDate) => fmt({ day: 'numeric', month: 'long' }, date)
export const weekdayLong = (date: IsoDate) => fmt({ weekday: 'long' }, date)

export function streakText(s: Streak | null): string {
  if (!s) return '—'
  const unit = s.unit === 'dias' ? (s.value === 1 ? 'día' : 'días') : s.value === 1 ? 'semana' : 'semanas'
  return `${s.value} ${unit}`
}

export function countText(done: number, scheduled: number): string {
  return scheduled === 0 ? 'sin datos' : `${done} de ${scheduled}`
}
