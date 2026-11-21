import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { formatLongDate } from '../../lib/dates'
import { toMessage } from '../../lib/errors'
import { pct } from '../dashboard/format'
import { focusByDate } from '../focus/domain/stats'
import { formatMinutes } from '../focus/domain/timer'
import { useFocusSessions } from '../focus/hooks'
import { goalPace } from '../goals/domain/pace'
import { useGoals } from '../goals/hooks'
import { useJournal } from '../journal/hooks'
import { useTimezone } from '../profile/useToday'
import { countText } from '../stats/format'
import { useStatsData } from '../stats/useStatsData'
import { buildReport, PERIODS, periodRange, rangeDays, type PeriodId } from './report'
import './report.css'

const isPeriod = (v: string | null): v is PeriodId => PERIODS.some((p) => p.id === v)

export function ReportPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('periodo')
  const period: PeriodId = isPeriod(raw) ? raw : 'semana'
  const data = useStatsData()
  const timeZone = useTimezone()
  const sessions = useFocusSessions()
  const goals = useGoals()
  const journal = useJournal()

  const { from, to } = periodRange(period, data.today, data.habits)
  const report = useMemo(() => buildReport(data.habits, data.logs, data.ex, from, to, data.today), [data.habits, data.logs, data.ex, from, to, data.today])

  const focus = useMemo(() => {
    const byDate = focusByDate(sessions.data ?? [], timeZone)
    let minutes = 0
    let count = 0
    for (const d of rangeDays(from, to)) {
      const f = byDate.get(d)
      if (f) {
        minutes += f.minutes
        count += f.sessions
      }
    }
    return { minutes, count }
  }, [sessions.data, timeZone, from, to])

  const entries = (journal.data ?? []).filter((e) => e.date >= from && e.date <= to).length
  const activeGoals = (goals.data ?? []).filter((g) => g.status === 'activo')
  const loading = data.loading
  const periodLabel = PERIODS.find((p) => p.id === period)!.label

  return (
    <div className="report">
      <div className="report-controls no-print">
        <h1>Informe</h1>
        <div>
          <label htmlFor="report-period">Periodo</label>
          <select id="report-period" value={period} onChange={(e) => setParams({ periodo: e.target.value }, { replace: true })}>
            {PERIODS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Imprimir o guardar como PDF
        </button>
        <p className="muted small">En el iPhone: pulsa Imprimir, abre la vista previa con un pellizco hacia fuera, toca Compartir y elige Guardar en Archivos.</p>
      </div>

      {data.error && (
        <p role="alert" className="error">
          {toMessage(data.error)}
        </p>
      )}

      <article className="report-sheet" aria-label="Informe imprimible">
        <header>
          <p className="report-brand">Segundo Cerebro</p>
          <h2>Informe de hábitos · {periodLabel.toLowerCase()}</h2>
          <p className="muted">
            Del {formatLongDate(from)} al {formatLongDate(to)}. Generado el {formatLongDate(data.today)}.
          </p>
        </header>

        {loading ? (
          <p className="muted">Cargando…</p>
        ) : (
          <>
            <dl className="report-summary">
              <div>
                <dt>Cumplimiento</dt>
                <dd>{pct(report.ratio)}</dd>
                <dd className="muted small">{countText(report.total.done, report.total.scheduled)}</dd>
              </div>
              <div>
                <dt>Foco</dt>
                <dd>{formatMinutes(focus.minutes)}</dd>
                <dd className="muted small">{focus.count} {focus.count === 1 ? 'sesión' : 'sesiones'}</dd>
              </div>
              <div>
                <dt>Diario</dt>
                <dd>{entries}</dd>
                <dd className="muted small">{entries === 1 ? 'entrada' : 'entradas'}</dd>
              </div>
            </dl>

            <section aria-labelledby="report-habits">
              <h3 id="report-habits">Hábitos</h3>
              {report.rows.length === 0 ? (
                <p className="muted">No hay hábitos programados en este periodo.</p>
              ) : (
                <div className="report-table-wrap" role="region" aria-label="Tabla de hábitos" tabIndex={0}>
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th scope="col">Hábito</th>
                        <th scope="col">Área</th>
                        <th scope="col" className="num">Hechos</th>
                        <th scope="col" className="num">%</th>
                        <th scope="col" className="num">Racha</th>
                        <th scope="col" className="num">Mejor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((r) => (
                        <tr key={r.id}>
                          <th scope="row">
                            {r.name}
                            {r.archived ? ' (archivado)' : ''}
                          </th>
                          <td>{r.area}</td>
                          <td className="num">{r.done} / {r.scheduled}</td>
                          <td className="num">{pct(r.ratio)}</td>
                          <td className="num">{r.current}</td>
                          <td className="num">{r.best}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {activeGoals.length > 0 && (
              <section aria-labelledby="report-goals">
                <h3 id="report-goals">Objetivos activos</h3>
                <ul className="report-goals">
                  {activeGoals.map((g) => {
                    const p = goalPace(g, data.today)
                    return (
                      <li key={g.id}>
                        <span>{g.title}</span>
                        <span className="muted">
                          {p.total > 0 ? `${p.done} de ${p.total} hitos` : 'sin hitos'} · hasta {formatLongDate(g.dueDate)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </article>
    </div>
  )
}
