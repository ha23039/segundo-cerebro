import { supabase } from '../../lib/supabase'
import type { IsoDate } from '../../lib/dates'
import type { ReviewText } from './domain/review'

export interface SavedReview extends ReviewText {
  id: string
  weekStart: IsoDate
}

/** Las revisiones guardadas (una por semana), de la más reciente a la más antigua. */
export async function fetchReviews(): Promise<SavedReview[]> {
  const { data, error } = await supabase.from('weekly_reviews').select('*').order('week_start', { ascending: false }).limit(200)
  if (error) throw error
  return data.map((r) => ({ id: r.id, weekStart: r.week_start, wentWell: r.went_well, toImprove: r.to_improve, nextFocus: r.next_focus }))
}

/** Crea o reemplaza la revisión de esa semana. */
export async function saveReview(weekStart: IsoDate, t: ReviewText): Promise<void> {
  const { error } = await supabase
    .from('weekly_reviews')
    .upsert({ week_start: weekStart, went_well: t.wentWell, to_improve: t.toImprove, next_focus: t.nextFocus }, { onConflict: 'user_id,week_start' })
  if (error) throw error
}

export async function deleteReview(id: string): Promise<void> {
  const { error } = await supabase.from('weekly_reviews').delete().eq('id', id)
  if (error) throw error
}
