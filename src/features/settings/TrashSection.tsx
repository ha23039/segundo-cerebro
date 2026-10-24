import { toMessage } from '../../lib/errors'
import { useDeletedHabits, useHabitMutations } from '../habits/hooks'
import { useOnline } from '../layout/useOnline'
import { useProfile } from '../profile/useProfile'
import { DEFAULT_TIMEZONE } from '../profile/useToday'

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000

export function TrashSection() {
  const online = useOnline()
  const deleted = useDeletedHabits()
  const { restore } = useHabitMutations()
  const timeZone = useProfile().data?.timezone ?? DEFAULT_TIMEZONE
  const fmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone })

  return (
    <section className="stack" aria-labelledby="papelera">
      <h2 id="papelera">Papelera</h2>
      <p className="muted">Los hábitos borrados se pueden restaurar durante 30 días.</p>
      {deleted.isError && (
        <p role="alert" className="error">
          {toMessage(deleted.error)}
        </p>
      )}
      {restore.isError && (
        <p role="alert" className="error">
          {toMessage(restore.error)}
        </p>
      )}
      {deleted.isSuccess && deleted.data.length === 0 && <p>La papelera está vacía.</p>}
      {deleted.isSuccess && deleted.data.length > 0 && (
        <ul className="habit-list">
          {deleted.data.map((h) => (
            <li key={h.id} className="card trash-item">
              <div>
                <strong className="trash-name">{h.name}</strong>
                <p className="muted">
                  se elimina definitivamente el {fmt.format(new Date(Date.parse(h.deletedAt) + RETENTION_MS))}
                </p>
              </div>
              <button
                className="btn"
                type="button"
                aria-label={`Restaurar ${h.name}`}
                disabled={!online || restore.isPending}
                onClick={() => restore.mutate(h.id)}
              >
                Restaurar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
