import { Link } from 'react-router'
import { goalPace } from './domain/pace'
import type { Goal } from './domain/types'
import { daysText } from './format'
import { PaceTag } from './GoalProgress'

/** Objetivos que vencen en 7 días o menos (o ya vencidos). Sin ninguno, no se muestra. */
export function GoalsDueCard({ goals, today }: { goals: Goal[]; today: string }) {
  if (goals.length === 0) return null
  return (
    <section className="card goals-due-card" aria-labelledby="goals-due-title">
      <div className="card-head">
        <h2 id="goals-due-title">Objetivos por vencer</h2>
        <Link to="/objetivos" className="small">
          Ver todos
        </Link>
      </div>
      <ul className="goals-due-list">
        {goals.map((g) => {
          const pace = goalPace(g, today)
          return (
            <li key={g.id} className="goals-due-item">
              <span className="goals-due-body">
                <Link to={`/objetivos/${g.id}`}>{g.title}</Link>
                <span className="muted small">
                  {daysText(pace.daysLeft)}
                  {pace.total > 0 && ` · ${pace.done} de ${pace.total} hitos`}
                </span>
              </span>
              <PaceTag status={pace.status} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
