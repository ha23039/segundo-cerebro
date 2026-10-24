import type { IsoDate, Weekday } from '../../../lib/dates'
import type { Habit, LogsByDate, SchedulePeriod } from './types'

export function dias(validFrom: IsoDate, days: Weekday[], validTo: IsoDate | null = null, target: number | null = null): SchedulePeriod {
  return { validFrom, validTo, frequency: { kind: 'dias', days }, target }
}

export function semanal(validFrom: IsoDate, timesPerWeek: number, validTo: IsoDate | null = null, target: number | null = null): SchedulePeriod {
  return { validFrom, validTo, frequency: { kind: 'semanal', timesPerWeek }, target }
}

export function habit(schedules: SchedulePeriod[], extra: Partial<Habit> = {}): Habit {
  const last = schedules[schedules.length - 1]
  return {
    id: 'h1',
    name: 'Hábito',
    kind: 'check',
    unit: null,
    position: 1,
    template: { frequency: last.frequency, target: last.target },
    schedules,
    archivedAt: null,
    ...extra,
  }
}

export function logs(dates: IsoDate[], value = 1): LogsByDate {
  return new Map(dates.map((d) => [d, value]))
}
