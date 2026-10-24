import { useState, type FormEvent } from 'react'
import type { Weekday } from '../../lib/dates'
import { WEEKDAYS } from './domain/format'
import type { Habit } from './domain/types'
import { validateHabit, type HabitErrors, type HabitInput } from './schema'

interface Props {
  initial?: Habit
  busy: boolean
  serverError: string | null
  onSubmit(input: HabitInput): void
  onCancel(): void
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="error field-error">
      {message}
    </p>
  )
}

export function HabitForm({ initial, busy, serverError, onSubmit, onCancel }: Props) {
  const freq = initial?.template.frequency
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<'check' | 'cantidad'>(initial?.kind ?? 'check')
  const [unit, setUnit] = useState(initial?.unit ?? '')
  const [target, setTarget] = useState(initial?.template.target?.toString() ?? '')
  const [freqKind, setFreqKind] = useState<'dias' | 'semanal'>(freq?.kind ?? 'dias')
  const [days, setDays] = useState<Weekday[]>(freq?.kind === 'dias' ? freq.days : [])
  const [perWeek, setPerWeek] = useState(freq?.kind === 'semanal' ? String(freq.timesPerWeek) : '3')
  const [errors, setErrors] = useState<HabitErrors>({})

  function toggleDay(d: Weekday, on: boolean) {
    setDays((prev) => (on ? [...prev, d].sort() : prev.filter((x) => x !== d)))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const result = validateHabit({
      name,
      kind,
      unit: kind === 'cantidad' ? unit : undefined,
      target: kind === 'cantidad' && target.trim() !== '' ? Number(target.replace(',', '.')) : undefined,
      frequency: freqKind === 'dias' ? { kind: 'dias', days } : { kind: 'semanal', timesPerWeek: Number(perWeek) },
    })
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    onSubmit(result.data)
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div>
        <label htmlFor="habit-name">Nombre</label>
        <input
          id="habit-name"
          value={name}
          maxLength={80}
          autoComplete="off"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'habit-name-error' : undefined}
          onChange={(e) => setName(e.target.value)}
        />
        <FieldError id="habit-name-error" message={errors.name} />
      </div>

      <fieldset className="choice-group">
        <legend>Tipo</legend>
        <label className="choice">
          <input type="radio" name="kind" checked={kind === 'check'} disabled={!!initial} onChange={() => setKind('check')} />
          Sí / no
        </label>
        <label className="choice">
          <input type="radio" name="kind" checked={kind === 'cantidad'} disabled={!!initial} onChange={() => setKind('cantidad')} />
          Cantidad
        </label>
        {initial && <p className="muted hint">El tipo no se puede cambiar después de crear el hábito.</p>}
      </fieldset>

      {kind === 'cantidad' && (
        <div className="row two-cols">
          <div>
            <label htmlFor="habit-target">Meta</label>
            <input
              id="habit-target"
              inputMode="decimal"
              value={target}
              aria-invalid={!!errors.target}
              aria-describedby={errors.target ? 'habit-target-error' : undefined}
              onChange={(e) => setTarget(e.target.value)}
            />
            <FieldError id="habit-target-error" message={errors.target} />
          </div>
          <div>
            <label htmlFor="habit-unit">Unidad</label>
            <input
              id="habit-unit"
              value={unit}
              maxLength={20}
              placeholder="vasos, minutos…"
              aria-invalid={!!errors.unit}
              aria-describedby={errors.unit ? 'habit-unit-error' : undefined}
              onChange={(e) => setUnit(e.target.value)}
            />
            <FieldError id="habit-unit-error" message={errors.unit} />
          </div>
        </div>
      )}

      <fieldset className="stack">
        <legend>Frecuencia</legend>
        <div className="choice-group">
          <label className="choice">
            <input type="radio" name="freq" checked={freqKind === 'dias'} onChange={() => setFreqKind('dias')} />
            Días de la semana
          </label>
          <label className="choice">
            <input type="radio" name="freq" checked={freqKind === 'semanal'} onChange={() => setFreqKind('semanal')} />
            Veces por semana
          </label>
        </div>
        {freqKind === 'dias' ? (
          <div className="weekdays" role="group" aria-label="Días">
            {WEEKDAYS.map((d) => (
              <label key={d.value} className="weekday">
                <input
                  type="checkbox"
                  aria-label={d.long}
                  checked={days.includes(d.value)}
                  onChange={(e) => toggleDay(d.value, e.target.checked)}
                />
                <span aria-hidden="true">{d.short}</span>
              </label>
            ))}
          </div>
        ) : (
          <div>
            <label htmlFor="habit-per-week">Cuántas veces por semana</label>
            <input
              id="habit-per-week"
              type="number"
              inputMode="numeric"
              min={1}
              max={7}
              value={perWeek}
              onChange={(e) => setPerWeek(e.target.value)}
            />
          </div>
        )}
        <FieldError id="habit-frequency-error" message={errors.frequency} />
      </fieldset>

      {serverError && (
        <p role="alert" className="error">
          {serverError}
        </p>
      )}

      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
