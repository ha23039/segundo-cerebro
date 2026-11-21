import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { IsoDate } from '../../lib/dates'
import { buildExcuses } from '../habits/domain/excuses'
import type { Excuses, SkipReason } from '../habits/domain/types'
import * as api from './api'
import type { ExcusesData } from './api'

const KEY = ['excuses']

const toExcuses = (d: ExcusesData): Excuses & { data: ExcusesData } => ({ ...buildExcuses(d.rest, d.skips), data: d })

export function useExcuses(from: IsoDate, enabled = true) {
  return useQuery({ queryKey: [...KEY, from], queryFn: () => api.fetchExcuses(from), select: toExcuses, enabled })
}

type Change =
  | { kind: 'rest'; date: IsoDate; note: string | null }
  | { kind: 'unrest'; date: IsoDate }
  | { kind: 'skip'; habitId: string; date: IsoDate; reason: SkipReason }
  | { kind: 'unskip'; habitId: string; date: IsoDate }

/** Aplica un cambio a la caché (puro: se usa para la actualización optimista). */
export function applyChange(d: ExcusesData, c: Change): ExcusesData {
  switch (c.kind) {
    case 'rest':
      return { ...d, rest: [...d.rest.filter((r) => r.date !== c.date), { date: c.date, note: c.note?.trim() || null }].sort((a, b) => a.date.localeCompare(b.date)) }
    case 'unrest':
      return { ...d, rest: d.rest.filter((r) => r.date !== c.date) }
    case 'skip':
      return { ...d, skips: [...d.skips.filter((s) => !(s.habitId === c.habitId && s.date === c.date)), { habitId: c.habitId, date: c.date, reason: c.reason }] }
    case 'unskip':
      return { ...d, skips: d.skips.filter((s) => !(s.habitId === c.habitId && s.date === c.date)) }
  }
}

function send(c: Change): Promise<void> {
  switch (c.kind) {
    case 'rest':
      return api.setRestDay(c.date, c.note)
    case 'unrest':
      return api.removeRestDay(c.date)
    case 'skip':
      return api.skipHabit(c.habitId, c.date, c.reason)
    case 'unskip':
      return api.unskipHabit(c.habitId, c.date)
  }
}

/**
 * Cambios optimistas en orden (scope). Si uno falla se vuelve a la foto previa y se relee del servidor.
 */
export function useExcuseMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: send,
    scope: { id: 'excuses' },
    onMutate: (c) => {
      void queryClient.cancelQueries({ queryKey: KEY })
      const snapshot = queryClient.getQueriesData<ExcusesData>({ queryKey: KEY })
      queryClient.setQueriesData<ExcusesData>({ queryKey: KEY }, (old) => (old ? applyChange(old, c) : old))
      return { snapshot }
    },
    onError: (_e, _c, ctx) => {
      for (const [key, data] of ctx?.snapshot ?? []) queryClient.setQueryData(key, data)
      void queryClient.invalidateQueries({ queryKey: KEY })
    },
  })
}
