import { bestScoreStreak, scoreStreak, STREAK_THRESHOLD } from '../dashboard/domain/score'
import { pct } from '../dashboard/format'
import { currentStreak } from '../habits/domain/streaks'
import { bestStreak } from './domain/best'
import { compliance, firstScheduleDate, monthlySeries } from './domain/compliance'
import { countText, monthShort, streakText } from './format'
import { CompletionBar } from './parts'
import type { useStatsData } from './useStatsData'

const MONTHS_SHOWN = 12

export function HistoryView({ data }: { data: ReturnType<typeof useStatsData> }) {
  const { today, habits, logs, prioByDate, ex } = data
  const active = habits.filter((h) => !h.archivedAt)
  const empty = new Map()
  const start = firstScheduleDate(habits) ?? today
  const ratioOf = (c: { done: number; scheduled: number }) => (c.scheduled ? c.done / c.scheduled : null)

  const series = monthlySeries(habits, logs, today, ex).filter((m) => m.count.scheduled > 0).slice(-MONTHS_SHOWN)
  const current = scoreStreak(active, logs, prioByDate, today, ex)
  const best = bestScoreStreak(active, logs, prioByDate, today, ex)

  return (
    <div className="stats-view">
      <div className="stat-cards">
        <section className="card stat" aria-label="Racha global actual">
          <p className="eyebrow">Racha actual</p>
          <p className="stat-value">{current === 1 ? '1 día' : `${current} días`}</p>
          <p className="stat-hint muted">seguidos con {STREAK_THRESHOLD} o más</p>
        </section>
        <section className="card stat" aria-label="Mejor racha global">
          <p className="eyebrow">Mejor racha</p>
          <p className="stat-value">{best === 1 ? '1 día' : `${best} días`}</p>
          <p className="stat-hint muted">desde que empezaste</p>
        </section>
      </div>

      <section className="card" aria-labelledby="history-habits-title">
        <h2 id="history-habits-title">Por hábito</h2>
        <ul className="stat-rows">
          {habits.map((h) => {
            const hl = logs.get(h.id) ?? empty
            const total = compliance(h, hl, start, today, today, ex)
            return (
              <li key={h.id} className="stat-row">
                <div className="stat-row-head">
                  <h3>
                    {h.name} {h.archivedAt && <span className="tag">Archivado</span>}
                  </h3>
                </div>
                <dl className="history-facts">
                  <div>
                    <dt>Racha actual</dt>
                    <dd>{streakText(currentStreak(h, hl, today, ex))}</dd>
                  </div>
                  <div>
                    <dt>Mejor racha</dt>
                    <dd>{streakText(bestStreak(h, hl, today, ex))}</dd>
                  </div>
                  <div>
                    <dt>Cumplimiento total</dt>
                    <dd>
                      {pct(ratioOf(total))} <span className="muted small">{countText(total.done, total.scheduled)}</span>
                    </dd>
                  </div>
                </dl>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card" aria-labelledby="history-months-title">
        <h2 id="history-months-title">Cumplimiento por mes</h2>
        {series.length === 0 ? (
          <p className="muted small">Aún no hay meses con días programados.</p>
        ) : (
          <table className="month-table">
            <thead>
              <tr>
                <th scope="col">Mes</th>
                <th scope="col">Cumplimiento</th>
                <th scope="col">Hechos</th>
              </tr>
            </thead>
            <tbody>
              {series.map(({ month, count }) => (
                <tr key={month}>
                  <th scope="row">{monthShort(month)}</th>
                  <td>
                    <span className="month-cell">
                      <CompletionBar ratio={ratioOf(count)} label={`Cumplimiento de ${monthShort(month)}`} />
                      <span className="stat-num">{pct(ratioOf(count))}</span>
                    </span>
                  </td>
                  <td>{countText(count.done, count.scheduled)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
