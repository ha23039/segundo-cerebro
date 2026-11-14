import type { DayScore } from './domain/score'
import { ProgressRing } from './ProgressRing'

/** Puntuación del día (APEX) con el anillo de progreso (prototipo original). */
export function ScoreCard({ day, isToday }: { day: DayScore | null; isToday: boolean }) {
  const score = day?.score ?? null
  const left = day ? day.habitsTotal - day.habitsDone + (day.prioritiesTotal - day.prioritiesDone) : 0
  return (
    <section className="hero" aria-labelledby="score-title">
      <div className="hero-ring">
        <ProgressRing value={(score ?? 0) / 100} />
        <div className="hero-ring-text" aria-hidden="true">
          <strong>{score ?? '—'}</strong>
          <span>/ 100</span>
        </div>
      </div>
      <div className="hero-body">
        <p className="eyebrow hero-eyebrow">{isToday ? 'Puntuación de hoy' : 'Puntuación del día'}</p>
        <h2 id="score-title" className="hero-title">
          {day === null ? 'Nada programado' : left === 0 ? 'Día completo' : `Te ${left === 1 ? 'falta' : 'faltan'} ${left} por hacer`}
        </h2>
        {day && (
          <p className="hero-sub">
            {day.habitsDone} de {day.habitsTotal} hábitos
            {day.prioritiesTotal > 0 && ` y ${day.prioritiesDone} de ${day.prioritiesTotal} prioridades`}
          </p>
        )}
        <p className="hero-note">Ponderado por importancia; lo parcial suma.</p>
        {score !== null && (
          <div className="hero-bar" aria-hidden="true">
            <span style={{ width: `${score}%` }} />
          </div>
        )}
      </div>
    </section>
  )
}
