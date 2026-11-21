import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Icon } from '../../components/Icon'
import { toMessage } from '../../lib/errors'
import { useOnline } from '../layout/useOnline'
import { useToday } from '../profile/useToday'
import { goalPace } from './domain/pace'
import type { Goal } from './domain/types'
import { daysText } from './format'
import { GoalForm } from './GoalForm'
import { GoalProgress, PaceTag } from './GoalProgress'
import { useDeletedGoals, useGoalMutations, useGoals } from './hooks'
import './goals.css'

export function GoalsPage() {
  const today = useToday()
  const online = useOnline()
  const navigate = useNavigate()
  const goals = useGoals()
  const deleted = useDeletedGoals()
  const { create, restore } = useGoalMutations()
  const [creating, setCreating] = useState(false)

  const active = goals.data?.filter((g) => g.status === 'activo') ?? []
  const closed = goals.data?.filter((g) => g.status !== 'activo') ?? []

  return (
    <>
      <div className="page-header">
        <h1>Objetivos</h1>
        {!creating && (
          <button className="btn btn-primary" type="button" disabled={!online} onClick={() => setCreating(true)}>
            <Icon name="plus" />
            Nuevo objetivo
          </button>
        )}
      </div>

      {!online && <p className="muted">Sin conexión: puedes consultar, pero no cambiar nada ahora.</p>}

      {creating && (
        <section className="card" aria-labelledby="new-goal-title">
          <h2 id="new-goal-title">Nuevo objetivo</h2>
          <GoalForm
            minDate={today}
            submitLabel="Crear objetivo"
            busy={create.isPending || !online}
            serverError={create.isError ? toMessage(create.error) : null}
            onCancel={() => setCreating(false)}
            onSubmit={async (input) => {
              try {
                const id = await create.mutateAsync(input)
                navigate(`/objetivos/${id}`)
              } catch {
                // el error se muestra con serverError
              }
            }}
          />
        </section>
      )}

      {goals.isPending && <p className="muted">Cargando…</p>}
      {goals.isError && (
        <p role="alert" className="error">
          {toMessage(goals.error)}
        </p>
      )}

      {goals.isSuccess && active.length === 0 && !creating && (
        <div className="card empty-state">
          <p className="empty-title">Aún no tienes objetivos activos.</p>
          <p className="muted">Ponle un plazo y unos hitos a lo que quieres lograr, y verás si vas al ritmo.</p>
        </div>
      )}

      {active.length > 0 && (
        <ul className="goal-list" aria-label="Objetivos activos">
          {active.map((g) => (
            <GoalCard key={g.id} goal={g} today={today} />
          ))}
        </ul>
      )}

      {closed.length > 0 && (
        <section aria-labelledby="closed-title" className="goal-section">
          <h2 id="closed-title">Cerrados</h2>
          <ul className="goal-list">
            {closed.map((g) => (
              <GoalCard key={g.id} goal={g} today={today} />
            ))}
          </ul>
        </section>
      )}

      {deleted.data && deleted.data.length > 0 && (
        <section aria-labelledby="trash-title" className="goal-section">
          <h2 id="trash-title">Papelera</h2>
          <p className="muted small">Se borran definitivamente a los 30 días.</p>
          <ul className="goal-list">
            {deleted.data.map((g) => (
              <li key={g.id} className="card goal-trash">
                <span className="goal-trash-title">{g.title}</span>
                <button className="btn" type="button" disabled={!online} onClick={() => restore.mutate(g.id)}>
                  <Icon name="undo" />
                  Restaurar<span className="visually-hidden"> {g.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function GoalCard({ goal, today }: { goal: Goal; today: string }) {
  const pace = goalPace(goal, today)
  const open = goal.status === 'activo'
  return (
    <li className="card goal-card">
      <div className="goal-card-head">
        <h3>
          <Link to={`/objetivos/${goal.id}`}>{goal.title}</Link>
        </h3>
        <PaceTag status={pace.status} />
      </div>
      <GoalProgress pace={pace} />
      <p className="muted small goal-meta">
        {pace.total > 0 ? `${pace.done} de ${pace.total} hitos` : 'Sin hitos todavía'}
        {open && ` · ${daysText(pace.daysLeft)}`}
      </p>
      {open && pace.progress !== null && pace.status !== 'vencido' && (
        <p className="muted small goal-meta">
          Ritmo esperado: {pace.expectedMilestones} de {pace.total} hoy
        </p>
      )}
    </li>
  )
}
