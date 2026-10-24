/** Fecha de calendario 'YYYY-MM-DD', sin hora ni zona. */
export type IsoDate = string
/** Día de la semana ISO: 1 = lunes … 7 = domingo. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

const DAY_MS = 86_400_000

/** Fecha local de `now` en la zona indicada. */
export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

// Las fechas de calendario se operan en UTC para que el horario de verano no afecte.
function toUtcMs(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUtcMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDays(date: IsoDate, n: number): IsoDate {
  return fromUtcMs(toUtcMs(date) + n * DAY_MS)
}

export function isoWeekday(date: IsoDate): Weekday {
  const day = new Date(toUtcMs(date)).getUTCDay()
  return (day === 0 ? 7 : day) as Weekday
}

export function startOfWeek(date: IsoDate): IsoDate {
  return addDays(date, 1 - isoWeekday(date))
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS)
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz })
    return true
  } catch {
    return false
  }
}
