import type { IsoDate, Weekday } from '../../lib/dates'
import type { Database } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import type { Frequency, Habit, SchedulePeriod } from './domain/types'
import type { LogsRecord } from './logsCache'
import type { HabitInput } from './schema'

type HabitRow = Database['public']['Tables']['habits']['Row']
type ScheduleRow = Database['public']['Tables']['habit_schedules']['Row']

const PAGE = 1000

function toFrequency(r: Pick<HabitRow, 'frequency' | 'days' | 'times_per_week'>): Frequency {
  return r.frequency === 'semanal'
    ? { kind: 'semanal', timesPerWeek: r.times_per_week ?? 1 }
    : { kind: 'dias', days: (r.days ?? []) as Weekday[] }
}

function toPeriod(r: ScheduleRow): SchedulePeriod {
  return { validFrom: r.valid_from, validTo: r.valid_to, frequency: toFrequency(r), target: r.target }
}

function toHabit(r: HabitRow & { habit_schedules: ScheduleRow[] }): Habit {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind === 'cantidad' ? 'cantidad' : 'check',
    unit: r.unit,
    position: r.position,
    template: { frequency: toFrequency(r), target: r.target },
    schedules: r.habit_schedules.map(toPeriod).sort((a, b) => a.validFrom.localeCompare(b.validFrom)),
    archivedAt: r.archived_at,
  }
}


export async function fetchHabits(): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('*, habit_schedules(*)')
    .is('deleted_at', null)
    .order('position')
    .order('created_at')
  if (error) throw error
  return data.map(toHabit)
}

export async function fetchDeletedHabits(): Promise<(Habit & { deletedAt: string })[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('*, habit_schedules(*)')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  if (error) throw error
  return data.map((r) => ({ ...toHabit(r), deletedAt: r.deleted_at! }))
}

/** Registros entre dos fechas, agrupados por hábito. Pagina porque PostgREST limita a 1000 filas. */
export async function fetchLogs(from: IsoDate, to: IsoDate): Promise<LogsRecord> {
  const out: LogsRecord = {}
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('habit_logs')
      .select('habit_id, date, value')
      .gte('date', from)
      .lte('date', to)
      .order('date')
      .order('habit_id')
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    for (const row of data) (out[row.habit_id] ??= {})[row.date] = row.value
    if (data.length < PAGE) return out
  }
}

function rpcArgs(i: HabitInput) {
  return {
    p_name: i.name,
    p_unit: i.kind === 'cantidad' ? i.unit! : null,
    p_frequency: i.frequency.kind,
    p_days: i.frequency.kind === 'dias' ? i.frequency.days : null,
    p_times_per_week: i.frequency.kind === 'semanal' ? i.frequency.timesPerWeek : null,
    p_target: i.kind === 'cantidad' ? i.target! : null,
  }
}

export async function createHabit(i: HabitInput): Promise<string> {
  // Los tipos generados no reflejan que los parámetros admiten null
  const { data, error } = await supabase.rpc('create_habit', { ...rpcArgs(i), p_kind: i.kind } as never)
  if (error) throw error
  return data as string
}

export async function updateHabit(id: string, i: HabitInput): Promise<void> {
  const { error } = await supabase.rpc('update_habit', { ...rpcArgs(i), p_habit_id: id } as never)
  if (error) throw error
}

export async function archiveHabit(id: string): Promise<void> {
  const { error } = await supabase.rpc('archive_habit', { p_habit_id: id })
  if (error) throw error
}

export async function unarchiveHabit(id: string): Promise<void> {
  const { error } = await supabase.rpc('unarchive_habit', { p_habit_id: id })
  if (error) throw error
}

export async function moveHabit(id: string, dir: 'up' | 'down'): Promise<void> {
  const { error } = await supabase.rpc('move_habit', { p_habit_id: id, p_direction: dir })
  if (error) throw error
}

export async function deleteHabit(id: string): Promise<void> {
  const { error } = await supabase.from('habits').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function restoreHabit(id: string): Promise<void> {
  const { error } = await supabase.from('habits').update({ deleted_at: null }).eq('id', id)
  if (error) throw error
}

/** null o 0 borra el registro; cualquier otro valor lo crea o lo reemplaza. */
export async function setLog(habitId: string, date: IsoDate, value: number | null): Promise<void> {
  if (!value) {
    const { error } = await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('date', date)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('habit_logs')
    .upsert({ habit_id: habitId, date, value }, { onConflict: 'habit_id,date' })
  if (error) throw error
}
