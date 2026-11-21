import { useId, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Icon } from '../../components/Icon'
import { addDays, formatLongDate } from '../../lib/dates'
import { toMessage } from '../../lib/errors'
import { useOnline } from '../layout/useOnline'
import { useToday } from '../profile/useToday'
import { useJournal, useJournalMutations } from './hooks'
import { JOURNAL_MAX, validateJournal } from './schema'
import type { JournalEntry } from './domain/types'

const ISO = /^\d{4}-\d{2}-\d{2}$/

function Editor({ date, entry, today }: { date: string; entry: JournalEntry | undefined; today: string }) {
  const online = useOnline()
  const { save, remove } = useJournalMutations()
  const [text, setText] = useState(entry?.body ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const areaId = useId()
  const base = entry?.body ?? ''
  const dirty = text.trim() !== base
  // Si llega una versión más nueva del servidor (p. ej. tras restaurar la caché) y no hay cambios sin guardar, se muestra
  const [seen, setSeen] = useState(base)
  if (seen !== base) {
    setSeen(base)
    if (text.trim() === seen) setText(base)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const v = validateJournal(text)
    if (!v.ok) return setError(v.error)
    setError(null)
    setSaved(false)
    save.mutate({ date, body: v.body }, { onSuccess: () => setSaved(true) })
  }

  return (
    <form className="card journal-editor" onSubmit={submit} noValidate>
      <label htmlFor={areaId}>{date === today ? '¿Cómo fue hoy?' : `Entrada del ${formatLongDate(date)}`}</label>
      <textarea
        id={areaId}
        rows={7}
        value={text}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${areaId}-count`}
        onChange={(e) => {
          setText(e.target.value)
          setSaved(false)
          setError(null)
        }}
      />
      <div className="journal-foot">
        <span id={`${areaId}-count`} className={`small ${text.length > JOURNAL_MAX ? 'error' : 'muted'}`}>
          {text.length} / {JOURNAL_MAX}
        </span>
        {saved && !dirty && (
          <span className="small muted" role="status">
            Guardado
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="error small">
          {error}
        </p>
      )}
      {save.isError && (
        <p role="alert" className="error small">
          {toMessage(save.error)}
        </p>
      )}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={!online || save.isPending || !dirty}>
          {entry ? 'Guardar cambios' : 'Guardar entrada'}
        </button>
        {entry &&
          (confirming ? (
            <span className="goal-confirm" role="group" aria-label="Confirmar eliminación">
              <span>¿Eliminar esta entrada?</span>
              <button type="button" className="btn btn-danger" disabled={!online} onClick={() => remove.mutate(entry.id, {
                    onSuccess: () => {
                      setConfirming(false)
                      setText('')
                      setSaved(false)
                    },
                  })}>
                Sí, eliminar
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>
                No
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn-danger" disabled={!online} onClick={() => setConfirming(true)}>
              Eliminar
            </button>
          ))}
      </div>
    </form>
  )
}

export function JournalView() {
  const today = useToday()
  const [params] = useSearchParams()
  const wanted = params.get('fecha')
  const date = wanted && ISO.test(wanted) && wanted <= today ? wanted : today
  const journal = useJournal()
  const entry = journal.data?.find((e) => e.date === date)
  const link = (d: string) => (d === today ? '/diario' : `/diario?fecha=${d}`)

  return (
    <div className="journal">
      <div className="journal-nav">
        <Link className="btn icon-btn" to={link(addDays(date, -1))} aria-label="Día anterior" replace>
          <Icon name="left" />
        </Link>
        <p className="journal-date">{date === today ? `Hoy · ${formatLongDate(date)}` : formatLongDate(date)}</p>
        {date < today ? (
          <Link className="btn icon-btn" to={link(addDays(date, 1))} aria-label="Día siguiente" replace>
            <Icon name="right" />
          </Link>
        ) : (
          <span className="btn icon-btn is-disabled" aria-hidden="true">
            <Icon name="right" />
          </span>
        )}
      </div>

      {journal.isError && (
        <p role="alert" className="error">
          {toMessage(journal.error)}
        </p>
      )}
      {journal.isPending ? <p className="muted">Cargando…</p> : <Editor key={date} date={date} entry={entry} today={today} />}

      {journal.data && journal.data.length > 0 && (
        <section aria-labelledby="journal-list-title" className="journal-list-wrap">
          <h2 id="journal-list-title">Entradas anteriores</h2>
          <ul className="journal-list">
            {journal.data.map((e) => (
              <li key={e.id}>
                <Link className="card journal-item" to={link(e.date)} aria-current={e.date === date ? 'true' : undefined}>
                  <span className="journal-item-date">{formatLongDate(e.date)}</span>
                  <span className="journal-item-text">{e.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {journal.data && journal.data.length === 0 && !journal.isPending && <p className="muted small">Aún no has escrito nada. Una entrada breve al día basta.</p>}
    </div>
  )
}
