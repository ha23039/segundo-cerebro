import { formatLongDate, isoWeekday, type IsoDate } from '../../lib/dates'
import { pct } from './format'

const LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const THRESHOLD = 0.8

/** Cumplimiento de los últimos 7 días, con la línea del 80 % que mantiene la racha global. */
export function WeekChart({ days, today }: { days: { date: IsoDate; ratio: number | null }[]; today: IsoDate }) {
  const summary = days.map((d) => `${formatLongDate(d.date)}: ${pct(d.ratio)}`).join('; ')
  return (
    <section className="card chart-card" aria-labelledby="week-chart-title">
      <div className="card-head">
        <h2 id="week-chart-title">Últimos 7 días</h2>
        <span className="muted small">línea: 80 % (racha)</span>
      </div>
      <div className="week-chart" role="img" aria-label={`Cumplimiento diario. ${summary}`}>
        <div className="week-threshold" style={{ bottom: `${THRESHOLD * 100}%` }} aria-hidden="true" />
        {days.map((d) => (
          <div key={d.date} className="week-col" title={`${formatLongDate(d.date)}: ${pct(d.ratio)}`}>
            <div className="week-track">
              {d.ratio !== null ? (
                <div
                  className={`week-bar${d.date === today ? ' is-today' : ''}`}
                  style={{ height: `${Math.max(4, Math.round(d.ratio * 100))}%` }}
                />
              ) : (
                <div className="week-empty" />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="week-labels" aria-hidden="true">
        {days.map((d) => (
          <span key={d.date} className={d.date === today ? 'is-today' : undefined}>
            {LETTERS[isoWeekday(d.date) - 1]}
          </span>
        ))}
      </div>
    </section>
  )
}
