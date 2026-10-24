import { useState, type KeyboardEvent } from 'react'
import { streakLabel } from '../habits/domain/format'
import type { Habit, SchedulePeriod, Streak } from '../habits/domain/types'

interface Props {
  habit: Habit
  period: SchedulePeriod
  value: number | undefined
  done: boolean
  streak: Streak | null
  disabled: boolean
  onSet(value: number | null): void
}

const MAX = 100000

function StreakBadge({ streak }: { streak: Streak | null }) {
  if (!streak) return null
  return (
    <span className="streak">
      <span aria-hidden="true">🔥 </span>
      <span className="visually-hidden">Racha: </span>
      {streakLabel(streak)}
    </span>
  )
}

function QuantityControl({ habit, period, value, disabled, onSet }: Omit<Props, 'done' | 'streak'>) {
  const current = value ?? 0
  // El padre usa key={current}: al cambiar el valor guardado, el borrador se reinicia
  const [draft, setDraft] = useState(String(current))

  function commit() {
    const n = Number(draft.replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) return setDraft(String(current))
    const v = Math.min(n, MAX)
    if (v !== current) onSet(v || null)
    else setDraft(String(current))
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    }
  }

  return (
    <div className="quantity">
      <button
        className="btn icon-btn"
        type="button"
        aria-label={`Restar 1 a ${habit.name}`}
        disabled={disabled || current <= 0}
        onClick={() => onSet(Math.max(0, current - 1) || null)}
      >
        <span aria-hidden="true">−</span>
      </button>
      <input
        className="quantity-input"
        inputMode="decimal"
        aria-label={`Cantidad de ${habit.name}`}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
      />
      <button
        className="btn icon-btn"
        type="button"
        aria-label={`Sumar 1 a ${habit.name}`}
        disabled={disabled || current >= MAX}
        onClick={() => onSet(current + 1)}
      >
        <span aria-hidden="true">+</span>
      </button>
      <span className="quantity-total">
        {current} / {period.target} {habit.unit}
      </span>
    </div>
  )
}

export function HabitRow(props: Props) {
  const { habit, done, streak, disabled, onSet } = props
  if (habit.kind === 'check') {
    return (
      <li className={`card today-row${done ? ' is-done' : ''}`}>
        <button className="today-toggle" type="button" aria-pressed={done} disabled={disabled} onClick={() => onSet(done ? null : 1)}>
          <span className="check-mark" aria-hidden="true">
            {done ? '✓' : ''}
          </span>
          <span className="today-name">{habit.name}</span>
        </button>
        <StreakBadge streak={streak} />
      </li>
    )
  }
  return (
    <li className={`card today-row today-row-quantity${done ? ' is-done' : ''}`}>
      <div className="today-row-head">
        {done && (
          <span className="check-mark small" role="img" aria-label="Hecho">
            ✓
          </span>
        )}
        <span className="today-name">{habit.name}</span>
        <StreakBadge streak={streak} />
      </div>
      <QuantityControl key={props.value ?? 0} {...props} />
    </li>
  )
}
