import { useMemo } from 'react'
import { addDays } from '../../lib/dates'
import { NO_EXCUSES } from '../habits/domain/excuses'
import type { LogsByDate } from '../habits/domain/types'
import { useHabits, useLogs } from '../habits/hooks'
import { groupByDate, usePriorities } from '../dashboard/priorities'
import { useToday } from '../profile/useToday'
import { useExcuses } from '../rest/hooks'

const NO_LOGS = new Map<string, LogsByDate>()

/** Los mismos datos (y la misma caché) que Hoy, pero con los hábitos archivados: su historial cuenta. */
export function useStatsData() {
  const today = useToday()
  const habitsQuery = useHabits()
  const habits = useMemo(() => habitsQuery.data ?? [], [habitsQuery.data])
  const from = habits.flatMap((h) => h.schedules.map((s) => s.validFrom)).sort()[0] ?? addDays(today, -7)
  const logs = useLogs(from, habitsQuery.isSuccess)
  const priorities = usePriorities(from, habitsQuery.isSuccess)
  const excuses = useExcuses(from, habitsQuery.isSuccess)
  const prioByDate = useMemo(() => groupByDate(priorities.data ?? []), [priorities.data])

  const queries = [habitsQuery, logs, priorities, excuses]
  return {
    today,
    habits,
    logs: logs.data ?? NO_LOGS,
    prioByDate,
    ex: excuses.data ?? NO_EXCUSES,
    loading: habitsQuery.isPending || (habits.length > 0 && queries.some((q) => q.isPending)),
    error: queries.find((q) => q.isError)?.error ?? null,
  }
}
