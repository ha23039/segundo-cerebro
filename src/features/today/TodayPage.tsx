import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { addDays, formatLongDate, startOfWeek } from '../../lib/dates'
import { toMessage } from '../../lib/errors'
import { AreaBreakdown } from '../dashboard/AreaBreakdown'
import { globalStreak, lastDays, rangeCount, ratio } from '../dashboard/domain/summary'
import { greeting, pct } from '../dashboard/format'
import { ProgressRing } from '../dashboard/ProgressRing'
import { StatCard } from '../dashboard/StatCard'
import { WeekChart } from '../dashboard/WeekChart'
import { AREAS } from '../habits/domain/areas'
import { isDone, isDueOn, periodAt } from '../habits/domain/schedule'
import { currentStreak } from '../habits/domain/streaks'
import type { LogsByDate } from '../habits/domain/types'
import { useHabits, useLogs, useSetLog } from '../habits/hooks'
import { ThemeToggle } from '../layout/ThemeToggle'
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
  const [onlyPending, setOnlyPending] = useState(false)
  // La hora del saludo se toma al montar (cambia de franja pocas veces al día)
  const [hour] = useState(() => new Date().getHours())
  const date = addDays(today, -offset)

  const habits = useHabits()
  const active = useMemo(() => habits.data?.filter((h) => !h.archivedAt) ?? [], [habits.data])
  // Rachas y resúmenes necesitan los registros desde el primer periodo de cada hábito
  const from = active.flatMap((h) => h.schedules.map((s) => s.validFrom)).sort()[0] ?? addDays(today, -7)
  const logs = useLogs(from, habits.isSuccess)
  const setLog = useSetLog()
  const logMap = logs.data ?? new Map<string, LogsByDate>()

  const due = active.filter((h) => isDueOn(h, logMap.get(h.id) ?? EMPTY, date))
  const doneOf = (id: string) => {
    const h = due.find((x) => x.id === id)!
    const p = periodAt(h, date)
    return !!p && isDone(h, p, logMap.get(h.id)?.get(date))
  }
  const doneCount = due.filter((h) => doneOf(h.id)).length
  const shown = onlyPending ? due.filter((h) => !doneOf(h.id)) : due
  const loading = habits.isPending || (active.length > 0 && logs.isPending)

  const stats = useMemo(() => {
    if (!logs.data || active.length === 0) return null
    const ws = startOfWeek(today)
    const ms = `${today.slice(0, 8)}01`
    const prevMs = `${addDays(ms, -1).slice(0, 8)}01`
    const sinceMonth = Number(today.slice(8, 10)) - 1
    return {
      week: ratio(rangeCount(active, logs.data, ws, today, today)),
      prevWeek: ratio(rangeCount(active, logs.data, addDays(ws, -7), addDays(today, -7), today)),
      month: ratio(rangeCount(active, logs.data, ms, today, today)),
      prevMonth: ratio(rangeCount(active, logs.data, prevMs, addDays(prevMs, sinceMonth), today)),
      streak: globalStreak(active, logs.data, today),
      days: lastDays(active, logs.data, today, 7),
      areas: AREAS.filter((a) => active.some((h) => h.area === a.id)).map((a) => ({
        area: a.id,
        ratio: ratio(rangeCount(active.filter((h) => h.area === a.id), logs.data!, addDays(today, -29), today, today)),
      })),
    }
  }, [active, logs.data, today])

  const dayRatio = due.length ? doneCount / due.length : null
  const left = due.length - doneCount
  const isToday = offset === 0

  return (
    <div className="today">
      <header className="today-head">
        <div>
          <p className="eyebrow">{isToday ? greeting(hour) : 'Corrigiendo un día anterior'}</p>
          <h1>Hoy</h1>
          <p className="muted today-date">{formatLongDate(date)}</p>
        </div>
        <span className="only-narrow">
          <ThemeToggle />
        </span>
      </header>

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

      {!loading && active.length === 0 && (
        <div className="card empty-state">
          <p className="empty-title">No tienes hábitos para este día.</p>
          <p className="muted">Crea el primero y empieza a medir tu progreso con datos reales.</p>
          <Link className="btn btn-primary" to="/habitos/nuevo">
            Crear un hábito
          </Link>
        </div>
      )}

      {!loading && active.length > 0 && (
        <div className="dash">
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-ring">
              <ProgressRing value={dayRatio ?? 0} />
              <div className="hero-ring-text" aria-hidden="true">
                <strong>{due.length ? `${doneCount}/${due.length}` : '—'}</strong>
                <span>{pct(dayRatio)}</span>
              </div>
            </div>
            <div className="hero-body">
              <h2 id="hero-title" className="hero-title">
                {due.length === 0 ? 'Nada programado' : left === 0 ? 'Día completo' : `Te ${left === 1 ? 'falta' : 'faltan'} ${left} por hacer`}
              </h2>
              <p className="hero-sub">
                {doneCount} de {due.length} hechos
              </p>
              {stats && (
                <ul className="hero-chips" aria-label="Resumen rápido">
                  <li>Racha global: {stats.streak} {stats.streak === 1 ? 'día' : 'días'}</li>
                  <li>Semana: {pct(stats.week)}</li>
                </ul>
              )}
            </div>
          </section>

          {stats && (
            <section className="kpis" aria-label="Resumen">
              <StatCard label="Semana" value={stats.week} prev={stats.prevWeek} hint="vs. semana anterior" />
              <StatCard label="Mes" value={stats.month} prev={stats.prevMonth} hint="vs. mes anterior" />
              <div className="card stat">
                <p className="eyebrow">Racha global</p>
                <p className="stat-value">
                  {stats.streak} <span className="stat-unit">{stats.streak === 1 ? 'día' : 'días'}</span>
                </p>
                <p className="stat-hint muted">seguidos con 80 % o más</p>
              </div>
            </section>
          )}

          <div className="dash-grid">
            <section className="dash-habits" aria-labelledby="habits-title">
              <div className="card-head">
                <h2 id="habits-title">Hábitos del día</h2>
                <div className="pills" role="group" aria-label="Filtro">
                  <button type="button" className="pill" aria-pressed={!onlyPending} onClick={() => setOnlyPending(false)}>
                    Todos
                  </button>
                  <button type="button" className="pill" aria-pressed={onlyPending} onClick={() => setOnlyPending(true)}>
                    Pendientes
                  </button>
                </div>
              </div>
              {due.length === 0 ? (
                <div className="card empty-state">
                  <p className="empty-title">No tienes hábitos para este día.</p>
                  <Link to="/habitos/nuevo">Crear un hábito</Link>
                </div>
              ) : shown.length === 0 ? (
                <p className="card empty-state empty-title">No te queda nada pendiente. Buen trabajo.</p>
              ) : (
                <ul className="today-list">
                  {shown.map((h) => {
                    const habitLogs = logMap.get(h.id) ?? EMPTY
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
              )}
            </section>

            {stats && (
              <aside className="dash-side" aria-label="Progreso">
                <WeekChart days={stats.days} today={today} />
                <AreaBreakdown stats={stats.areas} />
              </aside>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
