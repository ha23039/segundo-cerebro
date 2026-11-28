import { useId } from 'react'
import { computeStats, equityCurve, findResultColumn, groupResults, numberOf } from './domain/analysis'
import { formatNumber } from './domain/cells'
import type { Computed } from './domain/formula'
import type { TableColumn, TableRow } from './domain/types'

interface Props {
  columns: readonly TableColumn[]
  /** Filas ya filtradas, en el orden en que se crearon. */
  rows: readonly TableRow[]
  computed: Computed
  groupBy: string
  onGroupBy(columnId: string): void
}

const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)} %`)
const money = (n: number | null) => (n === null ? '–' : formatNumber(n, 2))

function Equity({ values, label }: { values: number[]; label: string }) {
  const W = 640
  const H = 160
  const pad = 8
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0)
  const span = max - min || 1
  const x = (i: number) => pad + (values.length === 1 ? 0 : (i * (W - 2 * pad)) / (values.length - 1))
  const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad)
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const last = values[values.length - 1]
  return (
    <svg className="equity" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="none">
      <line className="equity-zero" x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} />
      <path className={`equity-line${last < 0 ? ' is-neg' : ''}`} d={d} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Resumen de resultados: estadísticas, curva de equity y resultado por grupo. Solo aparece si hay una columna «Resultado». */
export function AnalysisPanel({ columns, rows, computed, groupBy, onGroupBy }: Props) {
  const id = useId()
  const result = findResultColumn(columns)
  if (!result) return null

  const values = rows.flatMap((r) => {
    const v = numberOf(result, r, computed)
    return v === null ? [] : [v]
  })
  const s = computeStats(values)
  const curve = equityCurve(values)
  const groupable = columns.filter((c) => c.id !== result.id && (c.type === 'lista' || c.type === 'texto' || c.type === 'casilla'))
  const groupCol = groupable.find((c) => c.id === groupBy)
  const groups = groupCol ? groupResults(groupCol, result, rows, computed) : []
  const maxAbs = Math.max(1, ...groups.map((g) => Math.abs(g.total)))

  return (
    <details className="analysis">
      <summary>Análisis de «{result.name}»</summary>
      {s.n === 0 ? (
        <p className="muted small">Aún no hay resultados que analizar con los filtros actuales.</p>
      ) : (
        <>
          <dl className="stats">
            {[
              ['Operaciones', String(s.n)],
              ['Acierto', pct(s.winRate)],
              ['Total', money(s.total)],
              ['Media', money(s.average)],
              ['Mejor', money(s.best)],
              ['Peor', money(s.worst)],
              ['Factor de beneficio', s.profitFactor === null ? '–' : formatNumber(s.profitFactor, 2)],
              ['Drawdown máx.', money(s.maxDrawdown)],
              ['Racha ganadora', String(s.bestStreak)],
              ['Racha perdedora', String(s.worstStreak)],
            ].map(([k, v]) => (
              <div key={k} className="stat">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          <h3 className="analysis-title">Curva de equity</h3>
          {values.length >= 2 ? (
            <Equity values={curve} label={`Curva de equity: de 0 a ${money(curve[curve.length - 1])} en ${values.length} operaciones`} />
          ) : (
            <p className="muted small">Hacen falta al menos dos operaciones para dibujar la curva.</p>
          )}

          {groupable.length > 0 && (
            <>
              <div className="analysis-group-head">
                <h3 className="analysis-title">Resultado por</h3>
                <label className="visually-hidden" htmlFor={`${id}-g`}>Agrupar por</label>
                <select id={`${id}-g`} value={groupBy} onChange={(e) => onGroupBy(e.target.value)}>
                  <option value="">Elige una columna</option>
                  {groupable.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {groupCol && (
                <div className="group-scroll">
                <table className="group-table">
                  <caption className="visually-hidden">Resultado por {groupCol.name}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{groupCol.name}</th>
                      <th scope="col" className="is-num">Ops.</th>
                      <th scope="col" className="is-num">Acierto</th>
                      <th scope="col">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <tr key={g.key}>
                        <th scope="row">{g.key}</th>
                        <td className="is-num">{g.n}</td>
                        <td className="is-num">{pct(g.winRate)}</td>
                        <td className="group-bar-cell">
                          <span className={`group-bar${g.total < 0 ? ' is-neg' : ''}`} style={{ width: `${(Math.abs(g.total) / maxAbs) * 100}%` }} aria-hidden="true" />
                          <span className="is-num group-val">{money(g.total)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </details>
  )
}
