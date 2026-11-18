import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { addDays, formatLongDate, startOfWeek } from '../../lib/dates'
import { toMessage } from '../../lib/errors'
import { AreaBreakdown } from '../dashboard/AreaBreakdown'
import { averageScore, dayScore, lastScores, scoreStreak, STREAK_THRESHOLD, type Priority } from '../dashboard/domain/score'
import { rangeCount, ratio } from '../dashboard/domain/summary'
import { greeting } from '../dashboard/format'
import { groupByDate, usePriorities } from '../dashboard/priorities'
import { PrioritiesCard } from '../dashboard/PrioritiesCard'
import { ScoreCard } from '../dashboard/ScoreCard'
import { WeekChart } from '../dashboard/WeekChart'
import { AREAS } from '../habits/domain/areas'
import { dueSoon } from '../goals/domain/pace'
import { GoalsDueCard } from '../goals/GoalsDueCard'
import { useGoals } from '../goals/hooks'
import { remainingBlocks } from '../habits/domain/blocks'
import { NO_EXCUSES, skipOf } from '../habits/domain/excuses'
import { isDone, isDueOn, periodAt } from '../habits/domain/schedule'
import { currentStreak } from '../habits/domain/streaks'
import type { LogsByDate } from '../habits/domain/types'
import { useHabits, useLogs, useSetLog } from '../habits/hooks'
import { ThemeToggle } from '../layout/ThemeToggle'
import { useOnline } from '../layout/useOnline'
import { useNowMinutes } from '../profile/useNowMinutes'
import { useToday } from '../profile/useToday'
import { useExcuseMutation, useExcuses } from '../rest/hooks'
import { RestCard } from '../rest/RestCard'
import { BlocksCard } from './BlocksCard'
import { DayPicker } from './DayPicker'
import { HabitRow } from './HabitRow'
import './today.css'

const EMPTY: LogsByDate = new Map()
const NO_PRIORITIES: Priority[] = []

function ScoreStat({ label, value, prev, hint }: { label: string; value: number | null; prev: number | null; hint: string }) {
  const d = value === null || prev === null ? null : value - prev
  return (
    <div className="card stat">
      <p className="eyebrow">{label}</p>
      <p className="stat-value">{value ?? '—'}</p>
      <p className="stat-hint">
        {d !== null && <span className={d > 0 ? 'delta up' : d < 0 ? 'delta down' : 'delta'}>{d > 0 ? `+${d}` : d === 0 ? '±0' : d} </span>}
        <span className="muted">{hint}</span>
      </p>
    </div>
  )
}

export function TodayPage() {
  const today = useToday()
  const nowMinutes = useNowMinutes()
  const online = useOnline()
  const [offset, setOffset] = useState(0)
  const [onlyPending, setOnlyPending] = useState(false)
  // La hora del saludo se toma al montar (cambia de franja pocas veces al día)
  const [hour] = useState(() => new Date().getHours())
  const date = addDays(today, -offset)

  const habits = useHabits()
  const active = useMemo(() => habits.data?.filter((h) => !h.archivedAt) ?? [], [habits.data])
  // Rachas y medias necesitan los registros desde el primer periodo de cada hábito
  const from = active.flatMap((h) => h.schedules.map((s) => s.validFrom)).sort()[0] ?? addDays(today, -7)
  const logs = useLogs(from, habits.isSuccess)
  const priorities = usePriorities(from, habits.isSuccess)
  const excusesQuery = useExcuses(from, habits.isSuccess)
  const ex = excusesQuery.data ?? NO_EXCUSES
  const restDays = excusesQuery.data?.data.rest
  const changeExcuse = useExcuseMutation()
  const goals = useGoals()
  const setLog = useSetLog()
  const logMap = logs.data ?? new Map<string, LogsByDate>()
  const prioByDate = useMemo(() => groupByDate(priorities.data ?? []), [priorities.data])
  const dayPriorities = prioByDate.get(date) ?? NO_PRIORITIES

  const restDay = restDays?.find((r) => r.date === date) ?? null
  // En la lista: lo que toca (con las excusas), más lo omitido ese día para poder deshacerlo.
  // En un día de descanso se muestra lo que tocaría, como opcional.
  const due = active.filter((h) => {
    const hl = logMap.get(h.id) ?? EMPTY
    if (restDay) return isDueOn(h, hl, date)
    return isDueOn(h, hl, date, ex) || skipOf(ex, h.id, date) !== null
  })
  const isHabitDone = (id: string) => {
    const h = due.find((x) => x.id === id)!
    const p = periodAt(h, date)
    return !!p && isDone(h, p, logMap.get(h.id)?.get(date))
  }
  const isPending = (id: string) => !isHabitDone(id) && skipOf(ex, id, date) === null && !restDay
  const blocks = remainingBlocks(
    due.filter((h) => isPending(h.id)),
    offset === 0 ? nowMinutes : null,
  )
  const shown = onlyPending ? due.filter((h) => isPending(h.id)) : due
  const loading = habits.isPending || (active.length > 0 && (logs.isPending || excusesQuery.isPending))
  const day = logs.data ? dayScore(active, logs.data, dayPriorities, date, ex) : null

  const stats = useMemo(() => {
    if (!logs.data || active.length === 0) return null
    const ws = startOfWeek(today)
    const ms = `${today.slice(0, 8)}01`
    const prevMs = `${addDays(ms, -1).slice(0, 8)}01`
    const intoMonth = Number(today.slice(8, 10)) - 1
    return {
      week: averageScore(active, logs.data, prioByDate, ws, today, today, ex),
      prevWeek: averageScore(active, logs.data, prioByDate, addDays(ws, -7), addDays(today, -7), addDays(today, -7), ex),
      month: averageScore(active, logs.data, prioByDate, ms, today, today, ex),
      prevMonth: averageScore(active, logs.data, prioByDate, prevMs, addDays(prevMs, intoMonth), addDays(prevMs, intoMonth), ex),
      streak: scoreStreak(active, logs.data, prioByDate, today, ex),
      days: lastScores(active, logs.data, prioByDate, today, 7, ex),
      areas: AREAS.filter((a) => active.some((h) => h.area === a.id)).map((a) => ({
        area: a.id,
        ratio: ratio(rangeCount(active.filter((h) => h.area === a.id), logs.data!, addDays(today, -29), today, today, ex)),
      })),
    }
  }, [active, logs.data, prioByDate, today, ex])

  return (
    <div className="today">
      <header className="today-head">
        <div>
          <p className="eyebrow">{offset === 0 ? greeting(hour) : 'Corrigiendo un día anterior'}</p>
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
      {changeExcuse.isError && (
        <p role="alert" className="error">
          {toMessage(changeExcuse.error)}
        </p>
      )}
      {(habits.isError || logs.isError || excusesQuery.isError) && (
        <p role="alert" className="error">
          {toMessage(habits.error ?? logs.error ?? excusesQuery.error)}
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
          <ScoreCard day={day} isToday={offset === 0} rest={restDay} />

          {stats && (
            <section className="kpis" aria-label="Rendimiento">
              <ScoreStat label="Semana" value={stats.week} prev={stats.prevWeek} hint="media · vs. semana anterior" />
              <ScoreStat label="Mes" value={stats.month} prev={stats.prevMonth} hint="media · vs. mes anterior" />
              <div className="card stat">
                <p className="eyebrow">Racha</p>
                <p className="stat-value">
                  {stats.streak} <span className="stat-unit">{stats.streak === 1 ? 'día' : 'días'}</span>
                </p>
                <p className="stat-hint muted">seguidos con {STREAK_THRESHOLD} o más</p>
              </div>
            </section>
          )}

          <div className="dash-grid">
            <section className="card dash-habits" aria-labelledby="habits-title">
              <div className="card-head">
                <h2 id="habits-title">Hábitos de hoy</h2>
                <div className="pills" role="group" aria-label="Filtro">
                  <button type="button" className="pill" aria-pressed={!onlyPending} onClick={() => setOnlyPending(false)}>
                    Todos
                  </button>
                  <button type="button" className="pill" aria-pressed={onlyPending} onClick={() => setOnlyPending(true)}>
                    Pendientes
                  </button>
                </div>
              </div>
              {restDay && due.length > 0 && (
                <p className="rest-banner">
                  <Icon name="moon" size={16} />
                  Día de descanso: nada es obligatorio. Lo que hagas suma a tus rachas.
                </p>
              )}
              {due.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-title">No tienes hábitos para este día.</p>
                  <Link to="/habitos/nuevo">Crear un hábito</Link>
                </div>
              ) : shown.length === 0 ? (
                <p className="empty-state empty-title">{restDay ? 'Hoy no hay nada pendiente: descansa.' : 'No te queda nada pendiente. Buen trabajo.'}</p>
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
                        streak={currentStreak(h, habitLogs, today, ex)}
                        disabled={!online}
                        skip={skipOf(ex, h.id, date)}
                        rest={restDay !== null}
                        onSet={(v) => setLog.mutate({ habitId: h.id, date, value: v })}
                        onSkip={(reason) =>
                          changeExcuse.mutate(
                            reason ? { kind: 'skip', habitId: h.id, date, reason } : { kind: 'unskip', habitId: h.id, date },
                          )
                        }
                      />
                    )
                  })}
                </ul>
              )}
            </section>

            <aside className="dash-side" aria-label="Plan y progreso">
              <PrioritiesCard date={date} items={dayPriorities} disabled={!online} />
              <BlocksCard blocks={blocks} anyScheduled={active.some((h) => h.startTime !== null)} isToday={offset === 0} rest={restDay !== null} />
              <GoalsDueCard goals={dueSoon(goals.data ?? [], today)} today={today} />
              <RestCard date={date} today={today} restDays={restDays ?? []} disabled={!online || !excusesQuery.isSuccess} />
              {stats && <WeekChart days={stats.days} today={today} threshold={STREAK_THRESHOLD} />}
              {stats && <AreaBreakdown stats={stats.areas} />}
            </aside>
          </div>
        </div>
      )}
    </div>
  )
}
