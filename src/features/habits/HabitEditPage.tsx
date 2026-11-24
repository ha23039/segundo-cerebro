import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toMessage } from '../../lib/errors'
import { useOnline } from '../layout/useOnline'
import { HABIT_PRESETS, type HabitPreset } from './domain/presets'
import { HabitForm } from './HabitForm'
import { useHabitMutations, useHabits } from './hooks'
import './habits.css'

export function HabitEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const online = useOnline()
  const habits = useHabits()
  const { create, update } = useHabitMutations()
  const [preset, setPreset] = useState<HabitPreset | undefined>()
  const habit = id ? habits.data?.find((h) => h.id === id) : undefined
  const mutation = id ? update : create

  if (id && habits.isPending) return <p className="muted">Cargando…</p>
  if (id && !habit) return <p role="alert" className="error">No se encontró el hábito.</p>

  return (
    <>
      <h1>{habit ? 'Editar hábito' : 'Nuevo hábito'}</h1>
      {!online && <p className="muted">Sin conexión: no se puede guardar ahora.</p>}
      {!id && (
        <section className="presets" aria-labelledby="presets-title">
          <h2 id="presets-title" className="presets-title">
            Empezar desde una plantilla
          </h2>
          <ul className="presets-list">
            {HABIT_PRESETS.map((p) => (
              <li key={p.id}>
                <button type="button" className="btn chip" aria-pressed={preset?.id === p.id} onClick={() => setPreset(preset?.id === p.id ? undefined : p)}>
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
          <p className="muted small">Carga los valores en el formulario; los puedes cambiar antes de guardar.</p>
        </section>
      )}
      <HabitForm
        key={preset?.id ?? 'vacio'}
        initial={habit}
        preset={preset}
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
