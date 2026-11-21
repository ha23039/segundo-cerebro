import { useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import type { IsoDate } from '../../lib/dates'
import { toMessage } from '../../lib/errors'
import type { Priority } from './domain/score'
import { freePosition, MAX_PRIORITIES, usePriorityMutations } from './priorities'

/** Hasta 3 prioridades por día (APEX). Puntúan en el día. */
export function PrioritiesCard({ date, items, disabled }: { date: IsoDate; items: Priority[]; disabled: boolean }) {
  const { add, toggle, remove } = usePriorityMutations()
  const [title, setTitle] = useState('')
  const position = freePosition(items)
  const error = add.error ?? toggle.error ?? remove.error

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || position === null) return
    add.mutate({ date, position, title }, { onSuccess: () => setTitle('') })
  }

  return (
    <section className="card prio-card" aria-labelledby="prio-title">
      <div className="card-head">
        <h2 id="prio-title">Prioridades</h2>
        <span className="muted small">
          {items.length} de {MAX_PRIORITIES} · máximo diario
        </span>
      </div>
      {items.length > 0 && (
        <ul className="prio-list">
          {items.map((p) => (
            <li key={p.id} className={p.done ? 'prio is-done' : 'prio'}>
              <button
                type="button"
                className="prio-toggle"
                aria-pressed={p.done}
                disabled={disabled}
                onClick={() => toggle.mutate({ id: p.id, done: !p.done })}
              >
                <span className="check-box round" aria-hidden="true">
                  {p.done && <Icon name="check" size={14} />}
                </span>
                <span className="prio-title">{p.title}</span>
              </button>
              <button
                type="button"
                className="btn icon-btn ghost"
                aria-label={`Quitar ${p.title}`}
                disabled={disabled}
                onClick={() => remove.mutate(p.id)}
              >
                <Icon name="minus" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {position !== null && (
        <form className="prio-form" onSubmit={submit}>
          <label htmlFor="prio-new" className="visually-hidden">
            Nueva prioridad
          </label>
          <input
            id="prio-new"
            value={title}
            maxLength={120}
            placeholder={items.length === 0 ? '¿Qué es lo más importante hoy?' : 'Añadir otra prioridad'}
            disabled={disabled}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={disabled || !title.trim() || add.isPending}>
            Añadir
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="error">
          {toMessage(error)}
        </p>
      )}
    </section>
  )
}
