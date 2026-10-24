import type { IsoDate } from '../../lib/dates'
import type { LogsByDate } from './domain/types'

/** Forma serializable de los registros (la caché se persiste como JSON). habitId → fecha → valor. */
export type LogsRecord = Record<string, Record<IsoDate, number>>

export function toLogMaps(record: LogsRecord): Map<string, LogsByDate> {
  return new Map(Object.entries(record).map(([id, byDate]) => [id, new Map(Object.entries(byDate))]))
}

export function setInRecord(record: LogsRecord, habitId: string, date: IsoDate, value: number | null): LogsRecord {
  const byDate = { ...record[habitId] }
  if (value) byDate[date] = value
  else delete byDate[date]
  return { ...record, [habitId]: byDate }
}
