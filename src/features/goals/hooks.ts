import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './api'
import type { Goal, GoalStatus } from './domain/types'
import type { GoalInput } from './schema'

/** Cambia el estado de un hito dentro de la lista de objetivos (pura, para la actualización optimista). */
export function applyMilestoneDone(goals: Goal[], id: string, done: boolean): Goal[] {
  return goals.map((g) => (g.milestones.some((m) => m.id === id) ? { ...g, milestones: g.milestones.map((m) => (m.id === id ? { ...m, done } : m)) } : g))
}

export function useGoals() {
  return useQuery({ queryKey: ['goals'], queryFn: api.fetchGoals })
}

export function useDeletedGoals() {
  return useQuery({ queryKey: ['goals', 'deleted'], queryFn: api.fetchDeletedGoals })
}

export function useGoalMutations() {
  const queryClient = useQueryClient()
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: ['goals'] })
  return {
    create: useMutation({ mutationFn: (i: GoalInput) => api.createGoal(i), onSuccess }),
    update: useMutation({ mutationFn: ({ id, input }: { id: string; input: GoalInput }) => api.updateGoal(id, input), onSuccess }),
    setStatus: useMutation({ mutationFn: ({ id, status }: { id: string; status: GoalStatus }) => api.setGoalStatus(id, status), onSuccess }),
    remove: useMutation({ mutationFn: api.deleteGoal, onSuccess }),
    restore: useMutation({ mutationFn: api.restoreGoal, onSuccess }),
    addMilestone: useMutation({
      mutationFn: ({ goalId, title, position }: { goalId: string; title: string; position: number }) => api.addMilestone(goalId, title, position),
      onSuccess,
    }),
    // Optimista: el hito cambia al instante y vuelve atrás si falla
    toggleMilestone: useMutation({
      mutationFn: ({ id, done }: { id: string; done: boolean }) => api.setMilestoneDone(id, done),
      scope: { id: 'milestones' },
      onMutate: async ({ id, done }) => {
        await queryClient.cancelQueries({ queryKey: ['goals'], exact: true })
        const previous = queryClient.getQueryData<Goal[]>(['goals'])
        if (previous) queryClient.setQueryData<Goal[]>(['goals'], applyMilestoneDone(previous, id, done))
        return { previous }
      },
      onError: (_e, _v, ctx) => {
        if (ctx?.previous) queryClient.setQueryData(['goals'], ctx.previous)
      },
      onSettled: onSuccess,
    }),
    removeMilestone: useMutation({ mutationFn: api.removeMilestone, onSuccess }),
    linkHabit: useMutation({
      mutationFn: ({ habitId, goalId }: { habitId: string; goalId: string | null }) => api.linkHabit(habitId, goalId),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['habits'] }),
    }),
  }
}
