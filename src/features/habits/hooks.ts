import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { IsoDate } from '../../lib/dates'
import * as api from './api'
import type { HabitInput } from './schema'

export function useHabits() {
  return useQuery({ queryKey: ['habits'], queryFn: api.fetchHabits })
}

export function useDeletedHabits() {
  return useQuery({ queryKey: ['habits', 'deleted'], queryFn: api.fetchDeletedHabits })
}

export function useLogs(from: IsoDate, to: IsoDate) {
  return useQuery({ queryKey: ['logs', from, to], queryFn: () => api.fetchLogs(from, to) })
}

export function useHabitMutations() {
  const queryClient = useQueryClient()
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: ['habits'] })
  return {
    create: useMutation({ mutationFn: (i: HabitInput) => api.createHabit(i), onSuccess }),
    update: useMutation({ mutationFn: ({ id, input }: { id: string; input: HabitInput }) => api.updateHabit(id, input), onSuccess }),
    archive: useMutation({ mutationFn: api.archiveHabit, onSuccess }),
    unarchive: useMutation({ mutationFn: api.unarchiveHabit, onSuccess }),
    remove: useMutation({ mutationFn: api.deleteHabit, onSuccess }),
    restore: useMutation({ mutationFn: api.restoreHabit, onSuccess }),
    move: useMutation({ mutationFn: ({ id, dir }: { id: string; dir: 'up' | 'down' }) => api.moveHabit(id, dir), onSuccess }),
  }
}
