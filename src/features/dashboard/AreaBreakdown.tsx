import { areaLabel, type AreaId } from '../habits/domain/areas'
import { pct } from './format'

export interface AreaStat {
  area: AreaId
  ratio: number | null
}

/** Constancia por área de vida (30 días), de mayor a menor. */
export function AreaBreakdown({ stats }: { stats: AreaStat[] }) {
  const rows = stats.filter((s) => s.ratio !== null).sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
  if (rows.length === 0) return null
  const best = rows[0]
  const worst = rows.length > 1 ? rows[rows.length - 1] : null
  return (
    <section className="card chart-card" aria-labelledby="areas-title">
      <div className="card-head">
        <h2 id="areas-title">Por área</h2>
        <span className="muted small">últimos 30 días</span>
      </div>
      <table className="area-table">
        <caption className="visually-hidden">Cumplimiento por área de vida en los últimos 30 días</caption>
        <tbody>
          {rows.map((s) => (
            <tr key={s.area}>
              <th scope="row">
                <span className={`area-dot area-${s.area}`} aria-hidden="true" />
                {areaLabel(s.area)}
              </th>
              <td className="area-bar-cell" aria-hidden="true">
                <span className="area-bar-track">
                  <span className={`area-bar area-bg-${s.area}`} style={{ width: `${Math.round((s.ratio ?? 0) * 100)}%` }} />
                </span>
              </td>
              <td className="area-value">{pct(s.ratio)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="area-insights">
        <div>
          <p className="eyebrow">Más constante</p>
          <p className="area-insight-name">{areaLabel(best.area)}</p>
        </div>
        {worst && worst.area !== best.area && (
          <div>
            <p className="eyebrow">A reforzar</p>
            <p className="area-insight-name">{areaLabel(worst.area)}</p>
          </div>
        )}
      </div>
    </section>
  )
}
