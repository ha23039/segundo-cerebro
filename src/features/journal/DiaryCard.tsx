import { Link } from 'react-router'
import { useJournal } from './hooks'
import './journal.css'

/** Acceso al diario desde Hoy: muestra la entrada del día o invita a escribirla. */
export function DiaryCard({ today }: { today: string }) {
  const journal = useJournal()
  const entry = journal.data?.find((e) => e.date === today)
  return (
    <section className="card diary-card" aria-labelledby="diary-card-title">
      <div className="card-head">
        <h2 id="diary-card-title">Diario</h2>
        <Link to="/diario?vista=notas" className="small">
          Notas
        </Link>
      </div>
      {entry ? (
        <>
          <p className="diary-card-text">{entry.body}</p>
          <Link className="btn" to="/diario">
            Editar la entrada de hoy
          </Link>
        </>
      ) : (
        <>
          <p className="muted">{journal.isPending ? 'Cargando…' : 'Aún no has escrito nada hoy.'}</p>
          <Link className="btn btn-primary" to="/diario">
            Escribir hoy
          </Link>
        </>
      )}
    </section>
  )
}
