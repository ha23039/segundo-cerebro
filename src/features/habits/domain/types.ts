import type { IsoDate, Weekday } from '../../../lib/dates'
import type { AreaId } from './areas'

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
  area: AreaId
  /** 1..5: importancia en la puntuación del día. */
  weight: number
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

export type SkipReason = 'enfermedad' | 'viaje' | 'imprevisto' | 'descanso' | 'otro'

/**
 * Lo que excusa un día: descansos planificados (todo el día) y omisiones justificadas
 * (un hábito ese día). Lo excusado no puntúa ni rompe rachas; si igualmente se hizo, cuenta.
 */
export interface Excuses {
  rest: ReadonlySet<IsoDate>
  skips: ReadonlyMap<string, ReadonlyMap<IsoDate, SkipReason>>
}
