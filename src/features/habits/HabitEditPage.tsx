import { useNavigate, useParams } from 'react-router'
import { toMessage } from '../../lib/errors'
import { useOnline } from '../layout/useOnline'
import { HabitForm } from './HabitForm'
import { useHabitMutations, useHabits } from './hooks'
import './habits.css'

export function HabitEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const online = useOnline()
  const habits = useHabits()
  const { create, update } = useHabitMutations()
  const habit = id ? habits.data?.find((h) => h.id === id) : undefined
  const mutation = id ? update : create

  if (id && habits.isPending) return <p className="muted">Cargando…</p>
  if (id && !habit) return <p role="alert" className="error">No se encontró el hábito.</p>

  return (
    <>
      <h1>{habit ? 'Editar hábito' : 'Nuevo hábito'}</h1>
      {!online && <p className="muted">Sin conexión: no se puede guardar ahora.</p>}
      <HabitForm
        initial={habit}
        busy={mutation.isPending || !online}
        serverError={mutation.isError ? toMessage(mutation.error) : null}
        onCancel={() => navigate('/habitos')}
        onSubmit={async (input) => {
          try {
            if (id) await update.mutateAsync({ id, input })
            else await create.mutateAsync(input)
            navigate('/habitos')
          } catch {
            // el error se muestra con serverError
          }
        }}
      />
    </>
  )
}
