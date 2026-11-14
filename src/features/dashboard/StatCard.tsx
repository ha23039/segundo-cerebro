import { Icon } from '../../components/Icon'
import { deltaPts, pct } from './format'

export function StatCard({ label, value, prev, hint }: { label: string; value: number | null; prev?: number | null; hint: string }) {
  const d = prev === undefined ? null : deltaPts(value, prev)
  return (
    <div className="card stat">
      <p className="eyebrow">{label}</p>
      <p className="stat-value">{pct(value)}</p>
      <p className="stat-hint">
        {d !== null && (
          <span className={d > 0 ? 'delta up' : d < 0 ? 'delta down' : 'delta'}>
            <Icon name={d > 0 ? 'trendUp' : d < 0 ? 'trendDown' : 'flat'} size={14} />
            <span className="visually-hidden">{d > 0 ? 'Sube' : d < 0 ? 'Baja' : 'Igual'}</span> {Math.abs(d)} pts{' '}
          </span>
        )}
        <span className="muted">{hint}</span>
      </p>
    </div>
  )
}
