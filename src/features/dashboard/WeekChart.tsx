import { formatLongDate, isoWeekday, type IsoDate } from '../../lib/dates'

const LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** Puntuación de los últimos 7 días (0-100) con la línea del umbral de racha. */
export function WeekChart({ days, today, threshold }: { days: { date: IsoDate; score: number | null }[]; today: IsoDate; threshold: number }) {
  const label = (s: number | null) => (s === null ? 'sin nada programado' : `${s} de 100`)
  const summary = days.map((d) => `${formatLongDate(d.date)}: ${d.date === today ? 'en curso, ' : ''}${label(d.score)}`).join('; ')
  return (
    <section className="card chart-card" aria-labelledby="week-chart-title">
      <div className="card-head">
        <h2 id="week-chart-title">Esta semana</h2>
        <span className="muted small">línea: umbral de racha, {threshold}</span>
      </div>
      <div className="week-chart" role="img" aria-label={`Puntuación por día. ${summary}`}>
        <div className="week-threshold" style={{ bottom: `${threshold}%` }} aria-hidden="true" />
        {days.map((d) => (
          <div key={d.date} className="week-col" title={`${formatLongDate(d.date)}: ${label(d.score)}`}>
            <div className="week-track">
              {d.score !== null ? (
                <div
                  className={`week-bar${d.date === today ? ' is-today' : ''}${d.score < threshold ? ' is-below' : ''}`}
                  style={{ height: `${Math.max(4, d.score)}%` }}
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
