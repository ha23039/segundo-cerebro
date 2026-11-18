import type { GoalPace } from './domain/pace'
import { PACE_LABEL } from './format'

export function PaceTag({ status }: { status: GoalPace['status'] }) {
  return <span className={`pace-tag is-${status}`}>{PACE_LABEL[status]}</span>
}

/** Barra de progreso con una marca en el avance que se espera tener hoy (solo en objetivos activos con hitos). */
export function GoalProgress({ pace }: { pace: GoalPace }) {
  const pct = Math.round((pace.progress ?? 0) * 100)
  const showExpected = pace.progress !== null && (pace.status === 'adelantado' || pace.status === 'en_ritmo' || pace.status === 'atrasado' || pace.status === 'vencido')
  return (
    <div
      className="goal-bar"
      role="progressbar"
      aria-label="Progreso del objetivo"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={`${pace.done} de ${pace.total} hitos`}
    >
      <span className="goal-bar-fill" style={{ width: `${pct}%` }} />
      {showExpected && <span className="goal-bar-expected" style={{ left: `${Math.round(pace.expected * 100)}%` }} aria-hidden="true" />}
    </div>
  )
}
