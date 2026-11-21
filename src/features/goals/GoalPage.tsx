import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Icon } from '../../components/Icon'
import { formatLongDate } from '../../lib/dates'
import { toMessage } from '../../lib/errors'
import { areaLabel } from '../habits/domain/areas'
import { useHabits } from '../habits/hooks'
import { useOnline } from '../layout/useOnline'
import { useToday } from '../profile/useToday'
import { goalPace } from './domain/pace'
import type { Goal } from './domain/types'
import { daysText } from './format'
import { GoalForm } from './GoalForm'
import { GoalProgress, PaceTag } from './GoalProgress'
import { useGoalMutations, useGoals } from './hooks'
import { milestoneTitleSchema } from './schema'
import './goals.css'

export function GoalPage() {
  const { id } = useParams()
  const goals = useGoals()
  const goal = goals.data?.find((g) => g.id === id)

  if (goals.isPending) return <p className="muted">Cargando…</p>
  if (!goal) {
    return (
      <>
        <p role="alert" className="error">
          No se encontró el objetivo.
        </p>
        <Link to="/objetivos">Volver a objetivos</Link>
      </>
    )
  }
  return <GoalDetail goal={goal} />
}

function GoalDetail({ goal }: { goal: Goal }) {
  const today = useToday()
  const online = useOnline()
  const navigate = useNavigate()
  const m = useGoalMutations()
  const habits = useHabits()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const pace = goalPace(goal, today)
  const open = goal.status === 'activo'
  const behind = Math.max(0, pace.expectedMilestones - pace.done)
  const linked = habits.data?.filter((h) => h.goalId === goal.id && !h.archivedAt) ?? []
  const linkable = habits.data?.filter((h) => h.goalId === null && !h.archivedAt) ?? []
  const error = [m.update, m.setStatus, m.remove, m.addMilestone, m.toggleMilestone, m.removeMilestone, m.linkHabit].find((x) => x.isError)

  return (
    <div className="goal-detail">
      <Link to="/objetivos" className="back-link">
        Objetivos
      </Link>
      <div className="page-header">
        <h1>{goal.title}</h1>
        <PaceTag status={pace.status} />
      </div>
      {goal.description && <p className="goal-description">{goal.description}</p>}
      {!online && <p className="muted">Sin conexión: puedes consultar, pero no cambiar nada ahora.</p>}
      {error && (
        <p role="alert" className="error">
          {toMessage(error.error)}
        </p>
      )}

      <section className="card goal-pace" aria-labelledby="pace-title">
        <h2 id="pace-title">Ritmo</h2>
        <GoalProgress pace={pace} />
        <ul className="goal-facts">
          <li>{pace.total > 0 ? `${pace.done} de ${pace.total} hitos hechos` : 'Aún no hay hitos: añade el primero para medir el ritmo.'}</li>
          {open && pace.progress !== null && pace.status !== 'vencido' && (
            <li>
              Ritmo esperado: {pace.expectedMilestones} de {pace.total} hoy
              {behind > 0 && ` (te faltan ${behind} para ir al ritmo)`}
            </li>
          )}
          {open && <li>{daysText(pace.daysLeft)}</li>}
          <li className="muted">
            Del {formatLongDate(goal.startDate)} al {formatLongDate(goal.dueDate)}
          </li>
        </ul>
        {open && pace.progress === 1 && <p className="rest-banner">Todos los hitos están hechos: ya puedes completar el objetivo.</p>}
      </section>

      <MilestonesCard goal={goal} disabled={!online} m={m} />

      <section className="card" aria-labelledby="linked-title">
        <h2 id="linked-title">Hábitos vinculados</h2>
        {linked.length === 0 ? (
          <p className="muted small">Ningún hábito vinculado. Vincula los que te acercan a este objetivo.</p>
        ) : (
          <ul className="linked-list">
            {linked.map((h) => (
              <li key={h.id} className="linked-item">
                <span>
                  {h.name} <span className="muted small">· {areaLabel(h.area)}</span>
                </span>
                <button
                  className="btn icon-btn ghost"
                  type="button"
                  aria-label={`Desvincular ${h.name}`}
                  disabled={!online}
                  onClick={() => m.linkHabit.mutate({ habitId: h.id, goalId: null })}
                >
                  <Icon name="close" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {linkable.length > 0 && <LinkHabit habits={linkable} disabled={!online} onLink={(habitId) => m.linkHabit.mutate({ habitId, goalId: goal.id })} />}
      </section>

      <section className="card" aria-labelledby="details-title">
        <h2 id="details-title">Detalles</h2>
        <GoalForm
          initial={goal}
          minDate={goal.startDate}
          submitLabel="Guardar cambios"
          busy={m.update.isPending || !online}
          serverError={null}
          onSubmit={(input) => m.update.mutate({ id: goal.id, input })}
        />
      </section>

      <section className="goal-actions" aria-label="Acciones del objetivo">
        {open ? (
          <>
            <button className="btn btn-primary" type="button" disabled={!online} onClick={() => m.setStatus.mutate({ id: goal.id, status: 'completado' })}>
              <Icon name="check" />
              Completar objetivo
            </button>
            <button className="btn" type="button" disabled={!online} onClick={() => m.setStatus.mutate({ id: goal.id, status: 'abandonado' })}>
              Abandonar
            </button>
          </>
        ) : (
          <button className="btn" type="button" disabled={!online} onClick={() => m.setStatus.mutate({ id: goal.id, status: 'activo' })}>
            <Icon name="undo" />
            Reabrir
          </button>
        )}
        {confirmDelete ? (
          <span className="goal-confirm" role="group" aria-label="Confirmar eliminación">
            <span>¿Mover a la papelera?</span>
            <button
              className="btn btn-danger"
              type="button"
              disabled={!online}
              onClick={() => m.remove.mutate(goal.id, { onSuccess: () => navigate('/objetivos') })}
            >
              Sí, eliminar
            </button>
            <button className="btn" type="button" onClick={() => setConfirmDelete(false)}>
              No
            </button>
          </span>
        ) : (
          <button className="btn btn-danger" type="button" disabled={!online} onClick={() => setConfirmDelete(true)}>
            Eliminar
          </button>
        )}
      </section>
    </div>
  )
}

function MilestonesCard({ goal, disabled, m }: { goal: Goal; disabled: boolean; m: ReturnType<typeof useGoalMutations> }) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  function add(e: FormEvent) {
    e.preventDefault()
    const r = milestoneTitleSchema.safeParse(title)
    if (!r.success) {
      setError(r.error.issues[0].message)
      return
    }
    setError(null)
    const position = goal.milestones.reduce((max, x) => Math.max(max, x.position), 0) + 1
    m.addMilestone.mutate({ goalId: goal.id, title: r.data, position }, { onSuccess: () => setTitle('') })
  }

  return (
    <section className="card" aria-labelledby="milestones-title">
      <h2 id="milestones-title">Hitos</h2>
      {goal.milestones.length > 0 && (
        <ul className="milestone-list">
          {goal.milestones.map((x) => (
            <li key={x.id} className="milestone-item">
              <label className="milestone-check">
                <input type="checkbox" checked={x.done} disabled={disabled} onChange={(e) => m.toggleMilestone.mutate({ id: x.id, done: e.target.checked })} />
                <span className={x.done ? 'is-done' : undefined}>{x.title}</span>
              </label>
              <button
                className="btn icon-btn ghost"
                type="button"
                aria-label={`Quitar hito ${x.title}`}
                disabled={disabled}
                onClick={() => m.removeMilestone.mutate(x.id)}
              >
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="milestone-add" onSubmit={add} noValidate>
        <label htmlFor="milestone-title" className="visually-hidden">
          Nuevo hito
        </label>
        <input
          id="milestone-title"
          value={title}
          maxLength={120}
          placeholder="Nuevo hito"
          autoComplete="off"
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? 'milestone-error' : undefined}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button className="btn" type="submit" disabled={disabled || m.addMilestone.isPending}>
          <Icon name="plus" />
          Añadir hito
        </button>
      </form>
      {error && (
        <p id="milestone-error" role="alert" className="error small">
          {error}
        </p>
      )}
    </section>
  )
}

function LinkHabit({ habits, disabled, onLink }: { habits: { id: string; name: string }[]; disabled: boolean; onLink(id: string): void }) {
  const [id, setId] = useState('')
  return (
    <form
      className="milestone-add"
      onSubmit={(e) => {
        e.preventDefault()
        if (id) {
          onLink(id)
          setId('')
        }
      }}
    >
      <label htmlFor="link-habit" className="visually-hidden">
        Vincular un hábito
      </label>
      <select id="link-habit" value={id} disabled={disabled} onChange={(e) => setId(e.target.value)}>
        <option value="">Vincular un hábito…</option>
        {habits.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
      <button className="btn" type="submit" disabled={disabled || !id}>
        Vincular
      </button>
    </form>
  )
}
