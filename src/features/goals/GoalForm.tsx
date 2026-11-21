import { useState, type FormEvent } from 'react'
import type { IsoDate } from '../../lib/dates'
import { validateGoal, type GoalErrors, type GoalInput } from './schema'

interface Props {
  initial?: { title: string; description: string | null; dueDate: IsoDate }
  /** Fecha mínima para el límite (inicio del objetivo; al crear, hoy). */
  minDate: IsoDate
  submitLabel: string
  busy: boolean
  serverError: string | null
  onSubmit(input: GoalInput): void
  onCancel?(): void
}

export function GoalForm({ initial, minDate, submitLabel, busy, serverError, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '')
  const [errors, setErrors] = useState<GoalErrors>({})

  function submit(e: FormEvent) {
    e.preventDefault()
    const r = validateGoal({ title, description: description || undefined, dueDate }, minDate)
    if (!r.ok) {
      setErrors(r.errors)
      return
    }
    setErrors({})
    onSubmit(r.data)
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div>
        <label htmlFor="goal-title">Título</label>
        <input
          id="goal-title"
          value={title}
          maxLength={80}
          autoComplete="off"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'goal-title-error' : undefined}
          onChange={(e) => setTitle(e.target.value)}
        />
        {errors.title && <p id="goal-title-error" role="alert" className="error field-error">{errors.title}</p>}
      </div>
      <div>
        <label htmlFor="goal-description">Descripción (opcional)</label>
        <textarea
          id="goal-description"
          rows={2}
          value={description}
          maxLength={500}
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? 'goal-description-error' : undefined}
          onChange={(e) => setDescription(e.target.value)}
        />
        {errors.description && <p id="goal-description-error" role="alert" className="error field-error">{errors.description}</p>}
      </div>
      <div>
        <label htmlFor="goal-due">Fecha límite</label>
        <input
          id="goal-due"
          type="date"
          min={minDate}
          value={dueDate}
          aria-invalid={!!errors.dueDate}
          aria-describedby={errors.dueDate ? 'goal-due-error' : undefined}
          onChange={(e) => setDueDate(e.target.value)}
        />
        {errors.dueDate && <p id="goal-due-error" role="alert" className="error field-error">{errors.dueDate}</p>}
      </div>
      {serverError && (
        <p role="alert" className="error">
          {serverError}
        </p>
      )}
      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Guardando…' : submitLabel}
        </button>
        {onCancel && (
          <button className="btn" type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
