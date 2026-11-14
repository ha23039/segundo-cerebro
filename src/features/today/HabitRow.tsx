import { useState, type KeyboardEvent } from 'react'
import { Icon } from '../../components/Icon'
import { completion } from '../dashboard/domain/score'
import { areaLabel } from '../habits/domain/areas'
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
      <Icon name="flame" size={15} className="streak-icon" />
      <span className="visually-hidden">Racha: </span>
      {streakLabel(streak)}
    </span>
  )
}

function Side({ habit, streak }: { habit: Habit; streak: Streak | null }) {
  return (
    <span className="today-side">
      <span className="area-tag">
        <span className={`area-dot area-${habit.area}`} aria-hidden="true" />
        {areaLabel(habit.area)}
      </span>
      <StreakBadge streak={streak} />
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
        <Icon name="minus" />
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
        <Icon name="plus" />
      </button>
      <span className="quantity-total">
        {current} / {period.target} {habit.unit}
      </span>
    </div>
  )
}

/** Fila de hábito al estilo APEX: casilla, estado, progreso parcial y área. */
export function HabitRow(props: Props) {
  const { habit, period, value, done, streak, disabled, onSet } = props
  if (habit.kind === 'check') {
    return (
      <li className={`today-row${done ? ' is-done' : ''}`}>
        <button className="today-toggle" type="button" aria-pressed={done} disabled={disabled} onClick={() => onSet(done ? null : 1)}>
          <span className="check-box" aria-hidden="true">
            {done && <Icon name="check" size={14} />}
          </span>
          <span className="today-main">
            <span className="today-name">{habit.name}</span>
            <span className="today-meta">{done ? 'Hecho' : 'Pendiente'}</span>
          </span>
        </button>
        <Side habit={habit} streak={streak} />
      </li>
    )
  }
  const pct = Math.round(completion(habit, period, value) * 100)
  return (
    <li className={`today-row today-row-quantity${done ? ' is-done' : ''}`}>
      <div className="today-row-head">
        <span className="check-box" role="img" aria-label={done ? 'Hecho' : 'Pendiente'}>
          {done && <Icon name="check" size={14} />}
        </span>
        <span className="today-main">
          <span className="today-name">{habit.name}</span>
          <span className="today-meta">{done ? 'Meta cumplida' : `${pct} % de la meta`}</span>
        </span>
        <Side habit={habit} streak={streak} />
      </div>
      <div className="today-progress" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      <QuantityControl key={value ?? 0} {...props} />
    </li>
  )
}
