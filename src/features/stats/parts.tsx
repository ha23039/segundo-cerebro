import { Icon, type IconName } from '../../components/Icon'
import type { DayStatus } from './domain/compliance'
import { STATUS_LABEL } from './format'

const STATUS_ICON: Partial<Record<DayStatus, IconName>> = { hecho: 'check', 'no-hecho': 'close', descanso: 'moon', omitido: 'skip', 'no-programado': 'minus' }

/** Casilla de un día. El estado va en el icono y en el texto accesible, nunca solo en el color. */
export function StatusCell({ status, label, children }: { status: DayStatus; label: string; children?: React.ReactNode }) {
  const icon = STATUS_ICON[status]
  return (
    <span className={`status-cell is-${status}`} role="img" aria-label={`${label}: ${STATUS_LABEL[status]}`}>
      {children}
      {icon && <Icon name={icon} size={14} />}
    </span>
  )
}

/** Barra de cumplimiento; la cifra siempre va en texto al lado. */
export function CompletionBar({ ratio, label }: { ratio: number | null; label: string }) {
  const pct = ratio === null ? null : Math.round(ratio * 100)
  return (
    <span className="stat-bar" role="img" aria-label={pct === null ? `${label}: sin datos` : `${label}: ${pct} %`}>
      <span className="stat-bar-fill" style={{ width: `${pct ?? 0}%` }} />
    </span>
  )
}

export function Legend() {
  const items: DayStatus[] = ['hecho', 'no-hecho', 'omitido', 'descanso', 'no-programado']
  return (
    <ul className="stat-legend" aria-label="Leyenda">
      {items.map((s) => (
        <li key={s}>
          <span className={`status-cell is-${s}`} aria-hidden="true">
            <Icon name={STATUS_ICON[s]!} size={14} />
          </span>
          {STATUS_LABEL[s]}
        </li>
      ))}
    </ul>
  )
}

export function Stepper({ label, prev, next, onPrev, onNext, canNext }: { label: string; prev: string; next: string; onPrev(): void; onNext(): void; canNext: boolean }) {
  return (
    <div className="stepper">
      <button type="button" className="btn icon-btn" aria-label={prev} onClick={onPrev}>
        <Icon name="left" />
      </button>
      <p className="stepper-label" aria-live="polite">
        {label}
      </p>
      <button type="button" className="btn icon-btn" aria-label={next} disabled={!canNext} onClick={onNext}>
        <Icon name="right" />
      </button>
    </div>
  )
}
