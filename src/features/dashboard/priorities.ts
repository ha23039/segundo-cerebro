import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { IsoDate } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import type { Priority } from './domain/score'

export const MAX_PRIORITIES = 3

export async function fetchPriorities(from: IsoDate): Promise<Priority[]> {
  const { data, error } = await supabase
    .from('daily_priorities')
    .select('id, date, position, title, done')
    .gte('date', from)
    .order('date')
    .order('position')
  if (error) throw error
  return data
}

export function groupByDate(list: Priority[]): Map<IsoDate, Priority[]> {
  const out = new Map<IsoDate, Priority[]>()
  for (const p of list) out.set(p.date, [...(out.get(p.date) ?? []), p])
  return out
}

/** Primera posición libre (1..3) del día, o null si ya hay tres. */
export function freePosition(day: Priority[]): number | null {
  for (let pos = 1; pos <= MAX_PRIORITIES; pos++) if (!day.some((p) => p.position === pos)) return pos
  return null
}

export function usePriorities(from: IsoDate, enabled = true) {
  return useQuery({ queryKey: ['priorities', from], queryFn: () => fetchPriorities(from), enabled })
}

export function usePriorityMutations() {
  const queryClient = useQueryClient()
  const onSettled = () => queryClient.invalidateQueries({ queryKey: ['priorities'] })
  return {
    add: useMutation({
      mutationFn: async ({ date, position, title }: { date: IsoDate; position: number; title: string }) => {
        const { error } = await supabase.from('daily_priorities').insert({ date, position, title: title.trim() })
        if (error) throw error
      },
      onSettled,
    }),
    toggle: useMutation({
      mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
        const { error } = await supabase.from('daily_priorities').update({ done }).eq('id', id)
        if (error) throw error
      },
      onMutate: async ({ id, done }) => {
        queryClient.setQueriesData<Priority[]>({ queryKey: ['priorities'] }, (old) =>
          old?.map((p) => (p.id === id ? { ...p, done } : p)),
        )
      },
      onSettled,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('daily_priorities').delete().eq('id', id)
        if (error) throw error
      },
      onSettled,
    }),
  }
}
