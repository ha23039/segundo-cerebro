import { useState } from 'react'
import { addDays, isoWeekday } from '../../lib/dates'
import { pct } from '../dashboard/format'
import { addMonths, compliance, dayStatus, firstScheduleDate, monthOf, monthRange, totalCompliance } from './domain/compliance'
import { countText, dayLong, monthLabel } from './format'
import { Legend, StatusCell, Stepper } from './parts'
import type { useStatsData } from './useStatsData'

const LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export function MonthView({ data }: { data: ReturnType<typeof useStatsData> }) {
  const { today, habits, logs, ex } = data
  const [month, setMonth] = useState(monthOf(today))
  const [habitId, setHabitId] = useState('')
  const habit = habits.find((h) => h.id === habitId) ?? habits[0]
  const { from, to } = monthRange(month)
  const empty = new Map()
  const first = firstScheduleDate(habits)
  const blanks = isoWeekday(from) - 1
  const days: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d)

  const mine = compliance(habit, logs.get(habit.id) ?? empty, from, to, today, ex)
  const all = totalCompliance(habits, logs, from, to, today, ex)
  const ratioOf = (c: { done: number; scheduled: number }) => (c.scheduled ? c.done / c.scheduled : null)

  return (
    <div className="stats-view">
      <Stepper
        label={monthLabel(month)}
        prev="Mes anterior"
        next="Mes siguiente"
        onPrev={() => setMonth((m) => addMonths(m, -1))}
        onNext={() => setMonth((m) => (m < monthOf(today) ? addMonths(m, 1) : m))}
        canNext={month < monthOf(today)}
      />

      <div>
        <label htmlFor="stats-habit">Hábito</label>
        <select id="stats-habit" value={habit.id} onChange={(e) => setHabitId(e.target.value)}>
          {habits.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
              {h.archivedAt ? ' (archivado)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="stat-cards">
        <section className="card stat" aria-label="Cumplimiento del hábito en el mes">
          <p className="eyebrow">{habit.name}</p>
          <p className="stat-value">{pct(ratioOf(mine))}</p>
          <p className="stat-hint muted">{countText(mine.done, mine.scheduled)}</p>
        </section>
        <section className="card stat" aria-label="Cumplimiento total del mes">
          <p className="eyebrow">Todos los hábitos</p>
          <p className="stat-value">{pct(ratioOf(all))}</p>
          <p className="stat-hint muted">{countText(all.done, all.scheduled)}</p>
        </section>
      </div>

      <section className="card" aria-label={`Calendario de ${habit.name}`}>
        {first && month < monthOf(first) && <p className="muted small">Este mes es anterior a tu primer hábito.</p>}
        <div className="month-grid month-head" aria-hidden="true">
          {LETTERS.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
        <div className="month-grid">
          {Array.from({ length: blanks }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {days.map((d) => (
            <StatusCell key={d} status={dayStatus(habit, logs.get(habit.id) ?? empty, d, today, ex)} label={dayLong(d)}>
              <span className="month-day">{Number(d.slice(8))}</span>
            </StatusCell>
          ))}
        </div>
        <Legend />
      </section>
    </div>
  )
}
