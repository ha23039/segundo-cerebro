import { useState } from 'react'
import { Link } from 'react-router'
import { addDays, formatLongDate } from '../../lib/dates'
import { toMessage } from '../../lib/errors'
import { isDone, isDueOn, periodAt } from '../habits/domain/schedule'
import { currentStreak } from '../habits/domain/streaks'
import type { LogsByDate } from '../habits/domain/types'
import { useHabits, useLogs, useSetLog } from '../habits/hooks'
import { useOnline } from '../layout/useOnline'
import { useToday } from '../profile/useToday'
import { DayPicker } from './DayPicker'
import { HabitRow } from './HabitRow'
import './today.css'

const EMPTY: LogsByDate = new Map()

export function TodayPage() {
  const today = useToday()
  const online = useOnline()
  const [offset, setOffset] = useState(0)
  const date = addDays(today, -offset)

  const habits = useHabits()
  const active = habits.data?.filter((h) => !h.archivedAt) ?? []
  // Las rachas necesitan los registros desde el primer periodo de cada hábito
  const from = active.flatMap((h) => h.schedules.map((s) => s.validFrom)).sort()[0] ?? addDays(today, -7)
  const logs = useLogs(from, habits.isSuccess)
  const setLog = useSetLog()

  const due = active.filter((h) => isDueOn(h, logs.data?.get(h.id) ?? EMPTY, date))
  const doneCount = due.filter((h) => {
    const p = periodAt(h, date)
    return p && isDone(h, p, logs.data?.get(h.id)?.get(date))
  }).length
  const loading = habits.isPending || (active.length > 0 && logs.isPending)

  return (
    <>
      <h1>Hoy</h1>
      <p className="muted today-date">{formatLongDate(date)}</p>
      <DayPicker today={today} offset={offset} onChange={setOffset} />

      {setLog.isError && (
        <p role="alert" className="error">
          {toMessage(setLog.error)}
        </p>
      )}
      {(habits.isError || logs.isError) && (
        <p role="alert" className="error">
          {toMessage(habits.error ?? logs.error)}
        </p>
      )}

      {loading && <p className="muted">Cargando…</p>}

      {!loading && due.length === 0 && (
        <div className="empty">
          <p>No tienes hábitos para este día.</p>
          <Link to="/habitos/nuevo">Crear un hábito</Link>
        </div>
      )}

      {!loading && due.length > 0 && (
        <>
          <p className="today-progress">
            {doneCount} de {due.length} hechos
          </p>
          <ul className="today-list">
            {due.map((h) => {
              const habitLogs = logs.data?.get(h.id) ?? EMPTY
              const period = periodAt(h, date)!
              const value = habitLogs.get(date)
              return (
                <HabitRow
                  key={h.id}
                  habit={h}
                  period={period}
                  value={value}
                  done={isDone(h, period, value)}
                  streak={currentStreak(h, habitLogs, today)}
                  disabled={!online}
                  onSet={(v) => setLog.mutate({ habitId: h.id, date, value: v })}
                />
              )
            })}
          </ul>
        </>
      )}
    </>
  )
}
