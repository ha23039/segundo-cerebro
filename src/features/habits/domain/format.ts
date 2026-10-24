import type { Frequency, Streak } from './types'

export const WEEKDAYS = [
  { value: 1, short: 'L', long: 'lunes' },
  { value: 2, short: 'M', long: 'martes' },
  { value: 3, short: 'X', long: 'miércoles' },
  { value: 4, short: 'J', long: 'jueves' },
  { value: 5, short: 'V', long: 'viernes' },
  { value: 6, short: 'S', long: 'sábado' },
  { value: 7, short: 'D', long: 'domingo' },
] as const

export function frequencySummary(f: Frequency): string {
  if (f.kind === 'semanal') return `${f.timesPerWeek} ${f.timesPerWeek === 1 ? 'vez' : 'veces'} por semana`
  const days = [...f.days].sort()
  if (days.length === 7) return 'Todos los días'
  if (days.join() === '1,2,3,4,5') return 'L-V'
  return days.map((d) => WEEKDAYS[d - 1].short).join('-')
}

export function streakLabel(s: Streak): string {
  if (s.unit === 'dias') return `${s.value} ${s.value === 1 ? 'día' : 'días'}`
  return `${s.value} ${s.value === 1 ? 'semana' : 'semanas'}`
}
