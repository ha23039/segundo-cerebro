import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { IsoDate } from '../../lib/dates'
import * as api from './api'
import { setInRecord, toLogMaps, type LogsRecord } from './logsCache'
import type { HabitInput } from './schema'

export function useHabits() {
  return useQuery({ queryKey: ['habits'], queryFn: api.fetchHabits })
}

export function useDeletedHabits() {
  return useQuery({ queryKey: ['habits', 'deleted'], queryFn: api.fetchDeletedHabits })
}

export function useLogs(from: IsoDate, to: IsoDate) {
  return useQuery({ queryKey: ['logs', from, to], queryFn: () => api.fetchLogs(from, to), select: toLogMaps })
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

const SET_LOG = ['setLog']

/**
 * Registro optimista. Las mutaciones de un mismo hábito se ejecutan en orden (scope) y la caché
 * solo se refresca cuando no queda ninguna pendiente, para que un toque no pise al siguiente.
 */
export function useSetLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: SET_LOG,
    mutationFn: ({ habitId, date, value }: { habitId: string; date: IsoDate; value: number | null }) =>
      api.setLog(habitId, date, value),
    scope: { id: 'habit-logs' },
    onMutate: async ({ habitId, date, value }) => {
      await queryClient.cancelQueries({ queryKey: ['logs'] })
      const snapshot = queryClient.getQueriesData<LogsRecord>({ queryKey: ['logs'] })
      queryClient.setQueriesData<LogsRecord>({ queryKey: ['logs'] }, (old) =>
        old ? setInRecord(old, habitId, date, value) : old,
      )
      return { snapshot }
    },
    onError: (_e, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: SET_LOG }) === 1) {
        return queryClient.invalidateQueries({ queryKey: ['logs'] })
      }
    },
  })
}
