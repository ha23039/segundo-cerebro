import { useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { addDays, formatLongDate, type IsoDate } from '../../lib/dates'
import { toMessage } from '../../lib/errors'
import type { RestDay } from './api'
import { useExcuseMutation } from './hooks'

/** Días que se pueden planificar por delante (lo mismo que permite la base de datos). */
export const PLAN_AHEAD = 90
const UPCOMING_SHOWN = 5

interface Props {
  date: IsoDate
  today: IsoDate
  restDays: RestDay[]
  disabled: boolean
}

/**
 * Descanso planificado: el día no puntúa ni rompe rachas. Se marca el día que se está viendo
 * o se planifica uno futuro (hasta 90 días).
 */
export function RestCard({ date, today, restDays, disabled }: Props) {
  const change = useExcuseMutation()
  const [note, setNote] = useState('')
  const [planDate, setPlanDate] = useState('')
  const [planNote, setPlanNote] = useState('')
  const current = restDays.find((r) => r.date === date) ?? null
  const upcoming = restDays.filter((r) => r.date > today)
  const last30 = restDays.filter((r) => r.date <= today && r.date > addDays(today, -30)).length
  const isToday = date === today
  const min = addDays(today, 1)
  const max = addDays(today, PLAN_AHEAD)
  const planValid = planDate >= min && planDate <= max
  const alreadyPlanned = restDays.some((r) => r.date === planDate)

  function markCurrent(e: FormEvent) {
    e.preventDefault()
    change.mutate({ kind: 'rest', date, note: note || null }, { onSuccess: () => setNote('') })
  }

  function plan(e: FormEvent) {
    e.preventDefault()
    if (!planValid || alreadyPlanned) return
    change.mutate(
      { kind: 'rest', date: planDate, note: planNote || null },
      {
        onSuccess: () => {
          setPlanDate('')
          setPlanNote('')
        },
      },
    )
  }

  return (
    <section className="card rest-card" aria-labelledby="rest-title">
      <div className="card-head">
        <h2 id="rest-title">Descanso</h2>
        <span className="muted small">
          {last30} en 30 días
        </span>
      </div>

      {current ? (
        <div className="rest-active">
          <span className="rest-badge" aria-hidden="true">
            <Icon name="moon" size={18} />
          </span>
          <div className="rest-active-body">
            <p className="rest-active-title">{isToday ? 'Hoy descansas' : 'Día de descanso'}</p>
            {current.note && <p className="muted small rest-note">{current.note}</p>}
          </div>
          <button
            type="button"
            className="btn"
            disabled={disabled}
            onClick={() => change.mutate({ kind: 'unrest', date })}
          >
            Quitar descanso
          </button>
        </div>
      ) : (
        <form className="rest-form" onSubmit={markCurrent}>
          <p className="muted small rest-help">
            Un descanso planificado no puntúa ni rompe tus rachas. Lo que hagas ese día suma igualmente.
          </p>
          <label htmlFor="rest-note" className="visually-hidden">
            Motivo del descanso (opcional)
          </label>
          <div className="rest-row">
            <input
              id="rest-note"
              value={note}
              maxLength={120}
              placeholder="Motivo (opcional)"
              disabled={disabled}
              onChange={(e) => setNote(e.target.value)}
            />
            <button className="btn" type="submit" disabled={disabled || change.isPending}>
              <Icon name="moon" />
              {isToday ? 'Descansar hoy' : 'Marcar descanso'}
            </button>
          </div>
        </form>
      )}

      <form className="rest-plan" onSubmit={plan} aria-labelledby="rest-plan-title">
        <p id="rest-plan-title" className="eyebrow">
          Planificar
        </p>
        <div className="rest-row">
          <label htmlFor="rest-plan-date" className="visually-hidden">
            Fecha del descanso
          </label>
          <input
            id="rest-plan-date"
            type="date"
            min={min}
            max={max}
            value={planDate}
            disabled={disabled}
            onChange={(e) => setPlanDate(e.target.value)}
          />
          <label htmlFor="rest-plan-note" className="visually-hidden">
            Motivo del descanso planificado (opcional)
          </label>
          <input
            id="rest-plan-note"
            value={planNote}
            maxLength={120}
            placeholder="Motivo (opcional)"
            disabled={disabled}
            onChange={(e) => setPlanNote(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={disabled || !planValid || alreadyPlanned || change.isPending}>
            <Icon name="calendar" />
            Planificar
          </button>
        </div>
        {planDate && !planValid && (
          <p className="error small" role="alert">
            Elige una fecha entre mañana y dentro de {PLAN_AHEAD} días.
          </p>
        )}
        {planValid && alreadyPlanned && <p className="muted small">Ese día ya es de descanso.</p>}
      </form>

      {upcoming.length > 0 && (
        <div>
          <p className="eyebrow">Próximos</p>
          <ul className="rest-list">
            {upcoming.slice(0, UPCOMING_SHOWN).map((r) => (
              <li key={r.date} className="rest-item">
                <Icon name="moon" size={16} className="rest-item-icon" />
                <span className="rest-item-body">
                  <span className="rest-item-date">{formatLongDate(r.date)}</span>
                  {r.note && <span className="muted small">{r.note}</span>}
                </span>
                <button
                  type="button"
                  className="btn icon-btn ghost"
                  aria-label={`Cancelar descanso del ${formatLongDate(r.date)}`}
                  disabled={disabled}
                  onClick={() => change.mutate({ kind: 'unrest', date: r.date })}
                >
                  <Icon name="close" />
                </button>
              </li>
            ))}
          </ul>
          {upcoming.length > UPCOMING_SHOWN && (
            <p className="muted small">y {upcoming.length - UPCOMING_SHOWN} más</p>
          )}
        </div>
      )}

      {change.isError && (
        <p role="alert" className="error">
          {toMessage(change.error)}
        </p>
      )}
    </section>
  )
}
