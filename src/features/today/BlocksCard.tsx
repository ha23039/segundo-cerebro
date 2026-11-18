import { Link } from 'react-router'
import type { TimeBlock } from '../habits/domain/blocks'

const STATE_LABEL = { ahora: 'Ahora', atrasado: 'Atrasado', despues: null } as const

interface Props {
  blocks: TimeBlock[]
  /** Hay algún hábito activo con hora (distingue "nada con hora" de "ya no queda nada"). */
  anyScheduled: boolean
  isToday: boolean
  rest: boolean
}

/** Los hábitos con hora que faltan por hacer, en orden. Hoy marca el bloque en curso y los que ya pasaron. */
export function BlocksCard({ blocks, anyScheduled, isToday, rest }: Props) {
  return (
    <section className="card blocks-card" aria-labelledby="blocks-title">
      <div className="card-head">
        <h2 id="blocks-title">{isToday ? 'Lo que queda de hoy' : 'Horario del día'}</h2>
        {blocks.length > 0 && <span className="muted small">{blocks.length} con hora</span>}
      </div>

      {blocks.length > 0 ? (
        <ul className="blocks-list">
          {blocks.map((b) => {
            const label = isToday ? STATE_LABEL[b.state] : null
            return (
              <li key={b.habit.id} className={`block-item is-${isToday ? b.state : 'despues'}`}>
                <span className="block-time">{b.end ? `${b.start} – ${b.end}` : b.start}</span>
                <span className="block-name">{b.habit.name}</span>
                {label && <span className="block-tag">{label}</span>}
              </li>
            )
          })}
        </ul>
      ) : !anyScheduled ? (
        <p className="muted small">
          Ponle hora a un hábito al <Link to="/habitos">editarlo</Link> y aparecerá aquí en orden.
        </p>
      ) : (
        <p className="muted small">{rest ? 'Hoy descansas: nada con hora.' : 'No queda nada con hora.'}</p>
      )}
    </section>
  )
}
