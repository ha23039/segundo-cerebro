import { useState } from 'react'
import { Link } from 'react-router'
import { toMessage } from '../../lib/errors'
import { useOnline } from '../layout/useOnline'
import { frequencySummary } from './domain/format'
import type { Habit } from './domain/types'
import { useHabitMutations, useHabits } from './hooks'
import './habits.css'

function HabitCard({
  habit,
  first,
  last,
  disabled,
  actions,
}: {
  habit: Habit
  first: boolean
  last: boolean
  disabled: boolean
  actions: ReturnType<typeof useHabitMutations> & { onDeleted(name: string): void }
}) {
  const archived = !!habit.archivedAt
  return (
    <li className="card habit-card">
      <div className="habit-card-info">
        <h3>{habit.name}</h3>
        <p className="muted">
          {frequencySummary(habit.template.frequency)}
          {habit.kind === 'cantidad' && ` · ${habit.template.target} ${habit.unit}`}
        </p>
      </div>
      <div className="habit-card-actions">
        {!archived && (
          <>
            <button
              className="btn icon-btn"
              type="button"
              aria-label="Subir"
              title="Subir"
              disabled={disabled || first}
              onClick={() => actions.move.mutate({ id: habit.id, dir: 'up' })}
            >
              <span aria-hidden="true">↑</span>
            </button>
            <button
              className="btn icon-btn"
              type="button"
              aria-label="Bajar"
              title="Bajar"
              disabled={disabled || last}
              onClick={() => actions.move.mutate({ id: habit.id, dir: 'down' })}
            >
              <span aria-hidden="true">↓</span>
            </button>
            <Link className="btn" to={`/habitos/${habit.id}/editar`}>
              Editar
            </Link>
            <button className="btn" type="button" disabled={disabled} onClick={() => actions.archive.mutate(habit.id)}>
              Archivar
            </button>
          </>
        )}
        {archived && (
          <button className="btn" type="button" disabled={disabled} onClick={() => actions.unarchive.mutate(habit.id)}>
            Desarchivar
          </button>
        )}
        <button
          className="btn btn-danger"
          type="button"
          disabled={disabled}
          onClick={() => actions.remove.mutate(habit.id, { onSuccess: () => actions.onDeleted(habit.name) })}
        >
          Borrar
        </button>
      </div>
    </li>
  )
}

export function HabitsPage() {
  const online = useOnline()
  const habits = useHabits()
  const mutations = useHabitMutations()
  const [notice, setNotice] = useState('')
  const failed = Object.values(mutations).find((m) => m.isError)
  const busy = !online || Object.values(mutations).some((m) => m.isPending)

  const active = habits.data?.filter((h) => !h.archivedAt) ?? []
  const archived = habits.data?.filter((h) => h.archivedAt) ?? []
  const actions = { ...mutations, onDeleted: (name: string) => setNotice(`«${name}» se movió a la papelera`) }

  return (
    <>
      <div className="page-header">
        <h1>Hábitos</h1>
        <Link className="btn btn-primary" to="/habitos/nuevo">
          Nuevo hábito
        </Link>
      </div>

      <p role="status" className="muted">
        {notice}
      </p>
      {failed?.error && (
        <p role="alert" className="error">
          {toMessage(failed.error)}
        </p>
      )}
      {habits.isError && (
        <p role="alert" className="error">
          {toMessage(habits.error)}
        </p>
      )}
      {habits.isPending && <p className="muted">Cargando…</p>}

      {habits.isSuccess && active.length === 0 && archived.length === 0 && (
        <p className="empty">Aún no tienes hábitos. Crea el primero con «Nuevo hábito».</p>
      )}

      {active.length > 0 && (
        <section aria-labelledby="activos">
          <h2 id="activos">Activos</h2>
          <ul className="habit-list">
            {active.map((h, i) => (
              <HabitCard key={h.id} habit={h} first={i === 0} last={i === active.length - 1} disabled={busy} actions={actions} />
            ))}
          </ul>
        </section>
      )}

      {archived.length > 0 && (
        <section aria-labelledby="archivados">
          <h2 id="archivados">Archivados</h2>
          <ul className="habit-list">
            {archived.map((h) => (
              <HabitCard key={h.id} habit={h} first last disabled={busy} actions={actions} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
