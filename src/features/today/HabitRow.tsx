import { useId, useState, type KeyboardEvent } from 'react'
import { Icon } from '../../components/Icon'
import { completion } from '../dashboard/domain/score'
import { areaLabel } from '../habits/domain/areas'
import { SKIP_REASONS, skipReasonLabel } from '../habits/domain/excuses'
import { streakLabel } from '../habits/domain/format'
import type { Habit, SchedulePeriod, SkipReason, Streak } from '../habits/domain/types'

interface Props {
  habit: Habit
  period: SchedulePeriod
  value: number | undefined
  done: boolean
  streak: Streak | null
  disabled: boolean
  /** Omisión justificada de ese día, si la hay. */
  skip: SkipReason | null
  /** El día es de descanso: nada es obligatorio. */
  rest: boolean
  onSet(value: number | null): void
  onSkip(reason: SkipReason | null): void
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

function QuantityControl({ habit, period, value, disabled, onSet }: Pick<Props, 'habit' | 'period' | 'value' | 'disabled' | 'onSet'>) {
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

function SkipPicker({ habit, onPick, onCancel }: { habit: Habit; onPick(r: SkipReason): void; onCancel(): void }) {
  return (
    <div className="skip-picker" role="group" aria-label={`Motivo para omitir ${habit.name}`}>
      <span className="skip-picker-label">¿Por qué no hoy?</span>
      <div className="skip-reasons">
        {SKIP_REASONS.map((r) => (
          <button key={r.id} type="button" className="pill" onClick={() => onPick(r.id)}>
            {r.label}
          </button>
        ))}
        <button type="button" className="btn icon-btn ghost" aria-label="Cancelar" onClick={onCancel}>
          <Icon name="close" />
        </button>
      </div>
      <span className="skip-picker-hint">No puntúa ni rompe la racha.</span>
    </div>
  )
}

// El nombre accesible no repite el del hábito (se asocia con aria-describedby) para que
// "Omitir" no compita con la propia fila al buscar por nombre.
function SkipButton({ nameId, disabled, onClick }: { nameId: string; disabled: boolean; onClick(): void }) {
  return (
    <button type="button" className="btn icon-btn ghost skip-btn" aria-label="Omitir" aria-describedby={nameId} title="Omitir con motivo" disabled={disabled} onClick={onClick}>
      <Icon name="skip" />
    </button>
  )
}

/** Fila de hábito al estilo APEX: casilla, estado, progreso parcial y área; se puede omitir con motivo. */
export function HabitRow(props: Props) {
  const { habit, period, value, done, streak, disabled, skip, rest, onSet, onSkip } = props
  const [picking, setPicking] = useState(false)
  const nameId = useId()
  const canSkip = !done && !rest && !disabled
  const pick = (r: SkipReason) => {
    setPicking(false)
    onSkip(r)
  }

  if (skip) {
    return (
      <li className="today-row is-skipped">
        <span className="today-toggle as-static">
          <span className="check-box skip-box" aria-hidden="true">
            <Icon name="skip" size={13} />
          </span>
          <span className="today-main">
            <span className="today-name" id={nameId}>{habit.name}</span>
            <span className="today-meta">Omitido · {skipReasonLabel(skip)}</span>
          </span>
        </span>
        <button type="button" className="btn ghost undo-btn" aria-describedby={nameId} disabled={disabled} onClick={() => onSkip(null)}>
          <Icon name="undo" size={16} />
          Deshacer
        </button>
      </li>
    )
  }

  const optional = rest && !done
  if (habit.kind === 'check') {
    return (
      <li className={`today-row${done ? ' is-done' : ''}${picking ? ' is-picking' : ''}`}>
        <button className="today-toggle" type="button" aria-pressed={done} disabled={disabled} onClick={() => onSet(done ? null : 1)}>
          <span className="check-box" aria-hidden="true">
            {done && <Icon name="check" size={14} />}
          </span>
          <span className="today-main">
            <span className="today-name" id={nameId}>{habit.name}</span>
            <span className="today-meta">{done ? 'Hecho' : optional ? 'Opcional hoy' : 'Pendiente'}</span>
          </span>
        </button>
        <Side habit={habit} streak={streak} />
        {canSkip && !picking && <SkipButton nameId={nameId} disabled={disabled} onClick={() => setPicking(true)} />}
        {picking && <SkipPicker habit={habit} onPick={pick} onCancel={() => setPicking(false)} />}
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
          <span className="today-name" id={nameId}>{habit.name}</span>
          <span className="today-meta">{done ? 'Meta cumplida' : optional ? `Opcional hoy · ${pct} %` : `${pct} % de la meta`}</span>
        </span>
        <Side habit={habit} streak={streak} />
        {canSkip && !picking && <SkipButton nameId={nameId} disabled={disabled} onClick={() => setPicking(true)} />}
      </div>
      <div className="today-progress" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      {picking ? (
        <SkipPicker habit={habit} onPick={pick} onCancel={() => setPicking(false)} />
      ) : (
        <QuantityControl key={value ?? 0} habit={habit} period={period} value={value} disabled={disabled} onSet={onSet} />
      )}
    </li>
  )
}
