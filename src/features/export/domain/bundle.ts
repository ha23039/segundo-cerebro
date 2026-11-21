import { toCsv, type Cell } from './csv'
import type { ZipFile } from './zip'

/** Todas las tablas del usuario que se exportan (todas las de `public`). */
export const EXPORT_TABLES = [
  'profiles',
  'habits',
  'habit_schedules',
  'habit_logs',
  'habit_skips',
  'rest_days',
  'daily_priorities',
  'goals',
  'milestones',
  'focus_sessions',
  'journal_entries',
  'notes',
] as const
export type ExportTable = (typeof EXPORT_TABLES)[number]
export type Row = Record<string, Cell>
export type ExportData = Record<ExportTable, Row[]>

/** Claves primarias por tabla: el orden estable evita saltarse o repetir filas al paginar. */
export const PRIMARY_KEY: Record<ExportTable, string[]> = {
  profiles: ['user_id'],
  habits: ['id'],
  habit_schedules: ['id'],
  habit_logs: ['habit_id', 'date'],
  habit_skips: ['habit_id', 'date'],
  rest_days: ['user_id', 'date'],
  daily_priorities: ['id'],
  goals: ['id'],
  milestones: ['id'],
  focus_sessions: ['id'],
  journal_entries: ['id'],
  notes: ['id'],
}

/** Columnas derivadas que no son datos del usuario (p. ej. el índice de búsqueda de las notas). */
const DERIVED: Partial<Record<ExportTable, string[]>> = { notes: ['search'] }

export function stripDerived(table: ExportTable, rows: Row[]): Row[] {
  const drop = DERIVED[table]
  if (!drop) return rows
  return rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !drop.includes(k))))
}

export function buildJson(data: ExportData, exportedAt: Date): string {
  return JSON.stringify({ app: 'segundo-cerebro', formato: 1, exportadoEn: exportedAt.toISOString(), tablas: data }, null, 2)
}

export function buildCsvFiles(data: ExportData): ZipFile[] {
  const enc = new TextEncoder()
  return EXPORT_TABLES.map((t) => ({ name: `${t}.csv`, data: enc.encode(toCsv(data[t])) }))
}

export const fileStamp = (d: Date): string => d.toISOString().slice(0, 10)
