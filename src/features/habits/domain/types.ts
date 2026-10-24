import type { IsoDate, Weekday } from '../../../lib/dates'

export type Frequency = { kind: 'dias'; days: Weekday[] } | { kind: 'semanal'; timesPerWeek: number }

export interface SchedulePeriod {
  validFrom: IsoDate
  /** Inclusive; null = vigente. */
  validTo: IsoDate | null
  frequency: Frequency
  target: number | null
}

export interface Habit {
  id: string
  name: string
  kind: 'check' | 'cantidad'
  unit: string | null
  position: number
  /** Configuración actual (la que se usa al desarchivar). */
  template: { frequency: Frequency; target: number | null }
  schedules: SchedulePeriod[]
  archivedAt: string | null
}

/** Valor registrado por fecha para un hábito. */
export type LogsByDate = Map<IsoDate, number>

export interface Streak {
  value: number
  unit: 'dias' | 'semanas'
}
