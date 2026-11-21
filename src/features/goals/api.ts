import type { Database } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import type { GoalInput } from './schema'
import type { Goal, GoalStatus, Milestone } from './domain/types'

type GoalRow = Database['public']['Tables']['goals']['Row']
type MilestoneRow = Database['public']['Tables']['milestones']['Row']

function toStatus(s: string): GoalStatus {
  return s === 'completado' || s === 'abandonado' ? s : 'activo'
}

function toMilestone(r: MilestoneRow): Milestone {
  return { id: r.id, title: r.title, done: r.done, position: r.position }
}

function toGoal(r: GoalRow & { milestones: MilestoneRow[] }): Goal {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    startDate: r.start_date,
    dueDate: r.due_date,
    status: toStatus(r.status),
    completedAt: r.completed_at,
    milestones: r.milestones.map(toMilestone).sort((a, b) => a.position - b.position),
  }
}

export async function fetchGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*, milestones(*)')
    .is('deleted_at', null)
    .order('due_date')
    .order('created_at')
  if (error) throw error
  return data.map(toGoal)
}

export async function fetchDeletedGoals(): Promise<(Goal & { deletedAt: string })[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*, milestones(*)')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  if (error) throw error
  return data.map((r) => ({ ...toGoal(r), deletedAt: r.deleted_at! }))
}

export async function createGoal(i: GoalInput): Promise<string> {
  const { data, error } = await supabase
    .from('goals')
    .insert({ title: i.title, description: i.description, due_date: i.dueDate })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function updateGoal(id: string, i: GoalInput): Promise<void> {
  const { error } = await supabase.from('goals').update({ title: i.title, description: i.description, due_date: i.dueDate }).eq('id', id)
  if (error) throw error
}

export async function setGoalStatus(id: string, status: GoalStatus): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .update({ status, completed_at: status === 'completado' ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw error
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('goals').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function restoreGoal(id: string): Promise<void> {
  const { error } = await supabase.from('goals').update({ deleted_at: null }).eq('id', id)
  if (error) throw error
}

export async function addMilestone(goalId: string, title: string, position: number): Promise<void> {
  const { error } = await supabase.from('milestones').insert({ goal_id: goalId, title, position })
  if (error) throw error
}

export async function setMilestoneDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.from('milestones').update({ done }).eq('id', id)
  if (error) throw error
}

export async function removeMilestone(id: string): Promise<void> {
  const { error } = await supabase.from('milestones').delete().eq('id', id)
  if (error) throw error
}

export async function linkHabit(habitId: string, goalId: string | null): Promise<void> {
  const { error } = await supabase.from('habits').update({ goal_id: goalId }).eq('id', habitId)
  if (error) throw error
}
