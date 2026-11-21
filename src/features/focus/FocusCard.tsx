import { useId, useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { toMessage } from '../../lib/errors'
import { useAuth } from '../auth/useAuth'
import type { Goal } from '../goals/domain/types'
import type { Habit } from '../habits/domain/types'
import { focusByDate } from './domain/stats'
import { clampMinutes, elapsedMs, formatClock, formatMinutes, isFinished, MAX_MINUTES, remainingMs } from './domain/timer'
import { useFocusSessions } from './hooks'
import { loadPrefs, savePrefs, setLastResult, useActiveTimer, useLastResult, useNowMs } from './timerStore'

const FOCUS_PRESETS = [15, 25, 45, 60]
const BREAK_PRESETS = [5, 10, 15]

interface Props {
  habits: Habit[]
  goals: Goal[]
  today: string
  timeZone: string
}

/** Temporizador de foco: elige duración y, si quieres, un hábito u objetivo; el tiempo se cuenta con marcas de tiempo. */
export function FocusCard({ habits, goals, today, timeZone }: Props) {
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const { timer, start, stop } = useActiveTimer(userId || null)
  const sessions = useFocusSessions()
  const result = useLastResult()
  const now = useNowMs(timer !== null)
  const titleId = useId()
  const [prefs, setPrefs] = useState(() => loadPrefs(userId))
  const [link, setLink] = useState('')
  const [error, setError] = useState<string | null>(null)

  const todayFocus = focusByDate(sessions.data ?? [], timeZone).get(today)
  const running = timer !== null && !isFinished(timer, now)
  const saving = timer !== null && !running

  function update(next: Partial<typeof prefs>) {
    const p = { ...prefs, ...next }
    setPrefs(p)
    savePrefs(userId, p)
  }

  function begin(kind: 'foco' | 'descanso', minutes: number) {
    setLastResult(null)
    setError(null)
    start({
      kind,
      plannedMinutes: minutes,
      habitId: kind === 'foco' && link.startsWith('h:') ? link.slice(2) : null,
      goalId: kind === 'foco' && link.startsWith('g:') ? link.slice(2) : null,
    })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (prefs.focusMinutes < 1 || prefs.focusMinutes > MAX_MINUTES) {
      setError(`Elige entre 1 y ${MAX_MINUTES} minutos.`)
      return
    }
    begin('foco', prefs.focusMinutes)
  }

  const linkedName = timer
    ? (timer.habitId && habits.find((h) => h.id === timer.habitId)?.name) || (timer.goalId && goals.find((g) => g.id === timer.goalId)?.title) || null
    : null

  return (
    <section id="foco" className="card focus-card" aria-labelledby={titleId}>
      <div className="card-head">
        <h2 id={titleId}>Foco</h2>
        <span className="muted small">
          {todayFocus ? `Hoy: ${formatMinutes(todayFocus.minutes)} · ${todayFocus.sessions} ${todayFocus.sessions === 1 ? 'sesión' : 'sesiones'}` : 'Hoy: sin sesiones'}
        </span>
      </div>

      {timer ? (
        <div className="focus-running">
          <p className="eyebrow">{timer.kind === 'foco' ? 'Foco' : 'Descanso'}{linkedName ? ` · ${linkedName}` : ''}</p>
          <p className="focus-clock" role="timer" aria-live="off" aria-label={`Quedan ${formatClock(remainingMs(timer, now))}`}>
            {formatClock(remainingMs(timer, now))}
          </p>
          <span className="stat-bar" aria-hidden="true">
            <span className="stat-bar-fill" style={{ width: `${Math.round((elapsedMs(timer, now) / (timer.plannedMinutes * 60_000)) * 100)}%` }} />
          </span>
          {saving ? (
            <p className="muted small" role="status">
              Guardando la sesión…
            </p>
          ) : (
            <button type="button" className="btn" onClick={stop}>
              Detener
            </button>
          )}
        </div>
      ) : (
        <>
          {result && (
            <div className="focus-result" role="status">
              <p>{result.discarded ? 'Duró menos de 1 minuto: no se guardó.' : `${result.kind === 'foco' ? 'Sesión' : 'Descanso'} guardada: ${formatMinutes(result.minutes)}.`}</p>
              <div className="row">
                {result.kind === 'foco' && !result.discarded && (
                  <button type="button" className="btn btn-primary" onClick={() => begin('descanso', prefs.breakMinutes)}>
                    <Icon name="moon" />
                    Descansar {prefs.breakMinutes} min
                  </button>
                )}
                <button type="button" className="btn" onClick={() => setLastResult(null)}>
                  Cerrar
                </button>
              </div>
            </div>
          )}

          <form className="stack" onSubmit={submit} noValidate>
            <fieldset className="focus-fieldset">
              <legend>Duración del foco</legend>
              <div className="pills" role="group" aria-label="Minutos de foco">
                {FOCUS_PRESETS.map((m) => (
                  <button key={m} type="button" className="pill" aria-pressed={prefs.focusMinutes === m} onClick={() => update({ focusMinutes: m })}>
                    {m} min
                  </button>
                ))}
              </div>
            </fieldset>

            {(habits.length > 0 || goals.length > 0) && (
              <div>
                <label htmlFor="focus-link">Asociar a (opcional)</label>
                <select id="focus-link" value={link} onChange={(e) => setLink(e.target.value)}>
                  <option value="">Nada en concreto</option>
                  {habits.length > 0 && (
                    <optgroup label="Hábitos">
                      {habits.map((h) => (
                        <option key={h.id} value={`h:${h.id}`}>
                          {h.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {goals.length > 0 && (
                    <optgroup label="Objetivos">
                      {goals.map((g) => (
                        <option key={g.id} value={`g:${g.id}`}>
                          {g.title}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            )}

            <details className="focus-more">
              <summary>
                Ajustes · {prefs.focusMinutes} min de foco, {prefs.breakMinutes} de descanso
              </summary>
              <div className="focus-more-body">
                <div className="focus-custom">
                  <label htmlFor="focus-minutes">Otros minutos</label>
                  <input
                    id="focus-minutes"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_MINUTES}
                    value={prefs.focusMinutes}
                    onChange={(e) => update({ focusMinutes: e.target.value === '' ? 0 : clampMinutes(Number(e.target.value)) })}
                  />
                </div>
                <fieldset className="focus-fieldset">
                  <legend>Duración del descanso</legend>
                  <div className="pills" role="group" aria-label="Minutos de descanso">
                    {BREAK_PRESETS.map((m) => (
                      <button key={m} type="button" className="pill" aria-pressed={prefs.breakMinutes === m} onClick={() => update({ breakMinutes: m })}>
                        {m} min
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
            </details>

            {error && (
              <p role="alert" className="error small">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary">
              <Icon name="clock" />
              Empezar foco
            </button>
          </form>
        </>
      )}
      {sessions.isError && (
        <p role="alert" className="error small">
          {toMessage(sessions.error)}
        </p>
      )}
    </section>
  )
}
