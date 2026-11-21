import { useState } from 'react'
import { addDays } from '../../lib/dates'
import { averageScore } from '../dashboard/domain/score'
import { pct } from '../dashboard/format'
import { areaLabel } from '../habits/domain/areas'
import { periodAt } from '../habits/domain/schedule'
import { compliance, dayStatus, sumCounts, weekRange } from './domain/compliance'
import { countText, formatRange, weekdayLong } from './format'
import { CompletionBar, Legend, StatusCell, Stepper } from './parts'
import type { useStatsData } from './useStatsData'

const LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export function WeekView({ data }: { data: ReturnType<typeof useStatsData> }) {
  const { today, habits, logs, prioByDate, ex } = data
  const [offset, setOffset] = useState(0) // semanas hacia atrás
  const { from, to } = weekRange(addDays(today, -7 * offset))
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i))
  const empty = new Map()

  const rows = habits
    .filter((h) => h.schedules.some((p) => p.validFrom <= to && (p.validTo === null || p.validTo >= from)))
    .map((h) => ({ h, count: compliance(h, logs.get(h.id) ?? empty, from, to, today, ex) }))
  const total = sumCounts(rows.map((r) => r.count))
  const ratioOf = (c: { done: number; scheduled: number }) => (c.scheduled ? c.done / c.scheduled : null)
  const avg = averageScore(habits.filter((h) => !h.archivedAt), logs, prioByDate, from, to, today, ex)

  return (
    <div className="stats-view">
      <Stepper
        label={formatRange(from, to)}
        prev="Semana anterior"
        next="Semana siguiente"
        onPrev={() => setOffset((o) => o + 1)}
        onNext={() => setOffset((o) => Math.max(0, o - 1))}
        canNext={offset > 0}
      />

      <div className="stat-cards">
        <section className="card stat" aria-label="Cumplimiento de la semana">
          <p className="eyebrow">Cumplimiento</p>
          <p className="stat-value">{pct(ratioOf(total))}</p>
          <p className="stat-hint muted">{countText(total.done, total.scheduled)}</p>
        </section>
        <section className="card stat" aria-label="Puntuación media de la semana">
          <p className="eyebrow">Puntuación media</p>
          <p className="stat-value">{avg ?? '—'}</p>
          <p className="stat-hint muted">días cerrados</p>
        </section>
      </div>

      {rows.length === 0 ? (
        <p className="card muted">Ningún hábito estaba activo esta semana.</p>
      ) : (
        <section className="card" aria-labelledby="week-habits-title">
          <h2 id="week-habits-title">Por hábito</h2>
          <div className="week-head" aria-hidden="true">
            {LETTERS.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
          <ul className="stat-rows">
            {rows.map(({ h, count }) => (
              <li key={h.id} className="stat-row">
                <div className="stat-row-head">
                  <h3>
                    {h.name} {h.archivedAt && <span className="tag">Archivado</span>}
                  </h3>
                  <span className="muted small">{areaLabel(h.area)}</span>
                </div>
                <div className="stat-row-body">
                  <div className="stat-row-meter">
                    <CompletionBar ratio={ratioOf(count)} label={`Cumplimiento de ${h.name}`} />
                    <span className="stat-num">
                      {countText(count.done, count.scheduled)} · {pct(ratioOf(count))}
                    </span>
                  </div>
                  <div className="week-cells">
                    {days.map((d) => (
                      <StatusCell key={d} status={dayStatus(h, logs.get(h.id) ?? empty, d, today, ex)} label={`${weekdayLong(d)} ${Number(d.slice(8))}`} />
                    ))}
                  </div>
                </div>
                {periodAt(h, to)?.frequency.kind === 'semanal' && <p className="muted small">Objetivo semanal: cuenta la semana completa, no cada día.</p>}
              </li>
            ))}
          </ul>
          <Legend />
        </section>
      )}
    </div>
  )
}
