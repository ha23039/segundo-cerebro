import { addDays, type IsoDate } from '../../lib/dates'

const SHORT = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })

function label(today: IsoDate, offset: number): string {
  if (offset === 0) return 'Hoy'
  if (offset === 1) return 'Ayer'
  return SHORT.format(new Date(`${addDays(today, -offset)}T00:00:00Z`))
}

/** Hoy y los 7 días anteriores (la ventana de corrección). */
export function DayPicker({ today, offset, onChange }: { today: IsoDate; offset: number; onChange(offset: number): void }) {
  return (
    <div className="day-picker" role="group" aria-label="Día">
      {Array.from({ length: 8 }, (_, i) => (
        <button key={i} type="button" className="btn day-btn" aria-pressed={offset === i} onClick={() => onChange(i)}>
          {label(today, i)}
        </button>
      ))}
    </div>
  )
}
