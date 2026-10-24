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

/** La clave no incluye "hoy": al cambiar de día se reutiliza la caché (también sin red). */
export function useLogs(from: IsoDate, enabled = true) {
  return useQuery({ queryKey: ['logs', from], queryFn: () => api.fetchLogs(from), select: toLogMaps, enabled })
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

// Por celda (hábito + fecha): mutaciones en curso y último valor confirmado por el servidor.
const pendingByCell = new Map<string, number>()
const confirmedByCell = new Map<string, number | null>()

function readCell(record: LogsRecord | undefined, habitId: string, date: IsoDate): number | null {
  return record?.[habitId]?.[date] ?? null
}

/**
 * Registro optimista. Las mutaciones se ejecutan en orden (scope) y no se vuelve a descargar
 * nada al terminar bien: el valor ya está en la caché. Si fallan, la celda vuelve al último valor
 * confirmado cuando no quedan más mutaciones pendientes sobre ella.
 */
export function useSetLog() {
  const queryClient = useQueryClient()

  function writeCell(habitId: string, date: IsoDate, value: number | null) {
    queryClient.setQueriesData<LogsRecord>({ queryKey: ['logs'] }, (old) =>
      old ? setInRecord(old, habitId, date, value) : old,
    )
  }

  return useMutation({
    mutationKey: SET_LOG,
    mutationFn: ({ habitId, date, value }: { habitId: string; date: IsoDate; value: number | null }) =>
      api.setLog(habitId, date, value),
    scope: { id: 'habit-logs' },
    onMutate: ({ habitId, date, value }) => {
      const cell = `${habitId}|${date}`
      // Cancela una descarga en curso para que no pise el cambio optimista. No se espera:
      // la cancelación es inmediata y esperar bloquearía el toque mientras haya reintentos.
      void queryClient.cancelQueries({ queryKey: ['logs'] })
      if (!pendingByCell.get(cell)) {
        const [, current] = queryClient.getQueriesData<LogsRecord>({ queryKey: ['logs'] })[0] ?? []
        confirmedByCell.set(cell, readCell(current, habitId, date))
      }
      pendingByCell.set(cell, (pendingByCell.get(cell) ?? 0) + 1)
      writeCell(habitId, date, value)
    },
    onSuccess: (_data, { habitId, date, value }) => {
      confirmedByCell.set(`${habitId}|${date}`, value || null)
    },
    onError: (_e, { habitId, date }) => {
      const cell = `${habitId}|${date}`
      if (pendingByCell.get(cell) === 1) writeCell(habitId, date, confirmedByCell.get(cell) ?? null)
    },
    onSettled: (_d, error, { habitId, date }) => {
      const cell = `${habitId}|${date}`
      const left = (pendingByCell.get(cell) ?? 1) - 1
      if (left > 0) pendingByCell.set(cell, left)
      else {
        pendingByCell.delete(cell)
        confirmedByCell.delete(cell)
      }
      // Tras un fallo, se intenta leer la verdad del servidor cuando ya no queda nada pendiente
      // (sin esperar: la mutación debe mostrarse como fallida enseguida)
      if (error && queryClient.isMutating({ mutationKey: SET_LOG }) === 1) {
        void queryClient.invalidateQueries({ queryKey: ['logs'] })
      }
    },
  })
}
