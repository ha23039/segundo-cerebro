import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { addDays, startOfWeek } from '../../lib/dates'
import { toMessage } from '../../lib/errors'
import { focusByDate, recentWeeks, weekFocus } from '../focus/domain/stats'
import { formatMinutes } from '../focus/domain/timer'
import { useDeleteSession, useFocusSessions } from '../focus/hooks'
import { useGoals } from '../goals/hooks'
import { useOnline } from '../layout/useOnline'
import { useTimezone } from '../profile/useToday'
import { formatRange, weekdayLong } from './format'
import { Stepper } from './parts'
import type { useStatsData } from './useStatsData'

const LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function dayLabel(date: string): string {
  return `${weekdayLong(date)} ${Number(date.slice(8))}`
}

export function FocusView({ data }: { data: ReturnType<typeof useStatsData> }) {
  const { today, habits } = data
  const timeZone = useTimezone()
  const online = useOnline()
  const sessions = useFocusSessions()
  const goals = useGoals()
  const remove = useDeleteSession()
  const [offset, setOffset] = useState(0)
  const [confirm, setConfirm] = useState<string | null>(null)

  const all = sessions.data ?? []
  const byDate = focusByDate(all, timeZone)
  const from = startOfWeek(addDays(today, -7 * offset))
  const to = addDays(from, 6)
  const week = weekFocus(byDate, from)
  const max = Math.max(1, ...week.days.map((d) => d.minutes))
  const weeks = recentWeeks(byDate, startOfWeek(today), 8)
  const maxWeek = Math.max(1, ...weeks.map((w) => w.minutes))
  const fmt = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone })
  const inWeek = all.filter((s) => {
    const d = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(s.startedAt))
    return d >= from && d <= to
  })
  const nameOf = (s: (typeof all)[number]) =>
    (s.habitId && habits.find((h) => h.id === s.habitId)?.name) || (s.goalId && goals.data?.find((g) => g.id === s.goalId)?.title) || null

  if (sessions.isPending) return <p className="muted">Cargando…</p>
  if (sessions.isError)
    return (
      <p role="alert" className="error">
        {toMessage(sessions.error)}
      </p>
    )
  if (all.length === 0) {
    return (
      <div className="card empty-state">
        <p className="empty-title">Aún no hay sesiones de foco.</p>
        <p className="muted">Empieza un foco desde la tarjeta «Foco» de Hoy y aquí verás tus minutos por día y semana.</p>
      </div>
    )
  }

  return (
    <div className="stats-view">
      <Stepper
        label={formatRange(from, to)}
        prev="Semana anterior"
        next="Semana siguiente"
        onPrev={() => setOffset((o) => o + 1)}
        onNext={() => setOffset((o) => Math.max(0, o - 1))}
        canNext={offset > 0}
      />

      <div className="stat-cards">
        <section className="card stat" aria-label="Minutos de foco de la semana">
          <p className="eyebrow">Foco</p>
          <p className="stat-value">{week.total > 0 ? formatMinutes(week.total) : '—'}</p>
          <p className="stat-hint muted">{week.sessions} {week.sessions === 1 ? 'sesión' : 'sesiones'}</p>
        </section>
        <section className="card stat" aria-label="Media por día con foco">
          <p className="eyebrow">Media por día</p>
          <p className="stat-value">{week.averageActiveDay === null ? '—' : formatMinutes(week.averageActiveDay)}</p>
          <p className="stat-hint muted">días con foco</p>
        </section>
      </div>

      <section className="card" aria-labelledby="focus-days-title">
        <h2 id="focus-days-title">Minutos por día</h2>
        <ul className="focus-bars">
          {week.days.map((d, i) => (
            <li key={d.date} className="focus-bar" aria-label={`${dayLabel(d.date)}: ${d.minutes === 0 ? 'sin foco' : formatMinutes(d.minutes)}`}>
              <span className="focus-bar-num" aria-hidden="true">
                {d.minutes > 0 ? d.minutes : ''}
              </span>
              <span className="focus-bar-track" aria-hidden="true">
                <span className="focus-bar-fill" style={{ height: `${Math.round((d.minutes / max) * 100)}%` }} />
              </span>
              <span className="focus-bar-day" aria-hidden="true">
                {LETTERS[i]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="focus-weeks-title">
        <h2 id="focus-weeks-title">Últimas semanas</h2>
        <table className="month-table">
          <thead>
            <tr>
              <th scope="col">Semana</th>
              <th scope="col">Minutos</th>
            </tr>
          </thead>
          <tbody>
            {[...weeks].reverse().map((w) => (
              <tr key={w.weekStart}>
                <th scope="row">{formatRange(w.weekStart, addDays(w.weekStart, 6)).split(' – ')[0]}</th>
                <td>
                  <span className="month-cell">
                    <span className="stat-bar" aria-hidden="true">
                      <span className="stat-bar-fill" style={{ width: `${Math.round((w.minutes / maxWeek) * 100)}%` }} />
                    </span>
                    <span className="stat-num">{w.minutes > 0 ? formatMinutes(w.minutes) : '—'}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" aria-labelledby="focus-list-title">
        <h2 id="focus-list-title">Sesiones de la semana</h2>
        {inWeek.length === 0 ? (
          <p className="muted small">No hubo sesiones esta semana.</p>
        ) : (
          <ul className="focus-list">
            {inWeek.map((s) => (
              <li key={s.id} className="focus-item">
                <span className="focus-item-body">
                  <span>
                    {s.kind === 'foco' ? 'Foco' : 'Descanso'} · {formatMinutes(s.actualMinutes)}
                    {nameOf(s) && <span className="muted"> · {nameOf(s)}</span>}
                  </span>
                  <span className="muted small">{fmt.format(new Date(s.startedAt))}</span>
                </span>
                {confirm === s.id ? (
                  <span className="goal-confirm" role="group" aria-label="Confirmar borrado">
                    <button className="btn btn-danger" type="button" disabled={!online} onClick={() => remove.mutate(s.id, { onSettled: () => setConfirm(null) })}>
                      Borrar
                    </button>
                    <button className="btn" type="button" onClick={() => setConfirm(null)}>
                      No
                    </button>
                  </span>
                ) : (
                  <button className="btn icon-btn ghost" type="button" aria-label={`Borrar la sesión de ${fmt.format(new Date(s.startedAt))}`} disabled={!online} onClick={() => setConfirm(s.id)}>
                    <Icon name="close" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {remove.isError && (
          <p role="alert" className="error small">
            {toMessage(remove.error)}
          </p>
        )}
      </section>
    </div>
  )
}
