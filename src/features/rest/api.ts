import type { IsoDate } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import { isSkipReason } from '../habits/domain/excuses'
import type { SkipReason } from '../habits/domain/types'

export interface RestDay {
  date: IsoDate
  note: string | null
}

export interface HabitSkip {
  habitId: string
  date: IsoDate
  reason: SkipReason
}

/** Forma serializable (la caché se persiste como JSON). Incluye los descansos planificados a futuro. */
export interface ExcusesData {
  rest: RestDay[]
  skips: HabitSkip[]
}

export async function fetchExcuses(from: IsoDate): Promise<ExcusesData> {
  const [rest, skips] = await Promise.all([
    supabase.from('rest_days').select('date, note').gte('date', from).order('date'),
    supabase.from('habit_skips').select('habit_id, date, reason').gte('date', from).order('date'),
  ])
  if (rest.error) throw rest.error
  if (skips.error) throw skips.error
  return {
    rest: rest.data,
    skips: skips.data.map((s) => ({ habitId: s.habit_id, date: s.date, reason: isSkipReason(s.reason) ? s.reason : 'otro' })),
  }
}

export async function setRestDay(date: IsoDate, note: string | null): Promise<void> {
  const { error } = await supabase.from('rest_days').upsert({ date, note: note?.trim() || null }, { onConflict: 'user_id,date' })
  if (error) throw error
}

export async function removeRestDay(date: IsoDate): Promise<void> {
  const { error } = await supabase.from('rest_days').delete().eq('date', date)
  if (error) throw error
}

export async function skipHabit(habitId: string, date: IsoDate, reason: SkipReason): Promise<void> {
  const { error } = await supabase.from('habit_skips').upsert({ habit_id: habitId, date, reason }, { onConflict: 'habit_id,date' })
  if (error) throw error
}

export async function unskipHabit(habitId: string, date: IsoDate): Promise<void> {
  const { error } = await supabase.from('habit_skips').delete().eq('habit_id', habitId).eq('date', date)
  if (error) throw error
}
