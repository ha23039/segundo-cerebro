import type { Database } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import type { FocusSession } from './domain/stats'
import type { SessionToSave } from './domain/timer'

type Row = Database['public']['Tables']['focus_sessions']['Row']
const PAGE = 1000

function toSession(r: Row): FocusSession {
  return {
    id: r.id,
    kind: r.kind === 'descanso' ? 'descanso' : 'foco',
    startedAt: r.started_at,
    endedAt: r.ended_at,
    plannedMinutes: r.planned_minutes,
    actualMinutes: r.actual_minutes,
    habitId: r.habit_id,
    goalId: r.goal_id,
  }
}

/** Todas las sesiones, de la más reciente a la más antigua. Pagina porque PostgREST limita a 1000 filas. */
export async function fetchFocus(): Promise<FocusSession[]> {
  const out: FocusSession[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('focus_sessions')
      .select('*')
      .order('started_at', { ascending: false })
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    out.push(...data.map(toSession))
    if (data.length < PAGE) return out
  }
}

/** Idempotente: el id lo fija el temporizador al empezar, así que reintentar no duplica la sesión. */
export async function saveSession(s: SessionToSave): Promise<void> {
  const { error } = await supabase.from('focus_sessions').upsert(
    {
      id: s.id,
      kind: s.kind,
      started_at: s.startedAt,
      ended_at: s.endedAt,
      planned_minutes: s.plannedMinutes,
      actual_minutes: s.actualMinutes,
      habit_id: s.habitId,
      goal_id: s.goalId,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (error) throw error
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase.from('focus_sessions').delete().eq('id', id)
  if (error) throw error
}
