import { Icon } from '../../components/Icon'
import type { DayScore } from './domain/score'
import { ProgressRing } from './ProgressRing'

function RestHero({ note, isToday }: { note: string | null; isToday: boolean }) {
  return (
    <section className="hero is-rest" aria-labelledby="score-title">
      <div className="hero-ring">
        <ProgressRing value={0} />
        <div className="hero-ring-text" aria-hidden="true">
          <Icon name="moon" size={34} />
        </div>
      </div>
      <div className="hero-body">
        <p className="eyebrow hero-eyebrow">{isToday ? 'Hoy' : 'Este día'}</p>
        <h2 id="score-title" className="hero-title">
          Día de descanso
        </h2>
        {note && <p className="hero-sub">{note}</p>}
        <p className="hero-note">No puntúa ni rompe tus rachas. Lo que hagas suma igualmente.</p>
      </div>
    </section>
  )
}

/** Puntuación del día (APEX) con el anillo de progreso (prototipo original). */
export function ScoreCard({ day, isToday, rest = null }: { day: DayScore | null; isToday: boolean; rest?: { note: string | null } | null }) {
  if (rest) return <RestHero note={rest.note} isToday={isToday} />
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
          {day === null ? 'Nada pendiente' : left === 0 ? 'Día completo' : `Te ${left === 1 ? 'falta' : 'faltan'} ${left} por hacer`}
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
