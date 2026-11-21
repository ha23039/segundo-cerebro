import type { PaceStatus } from './domain/pace'

export const PACE_LABEL: Record<PaceStatus, string> = {
  adelantado: 'Adelantado',
  en_ritmo: 'En ritmo',
  atrasado: 'Atrasado',
  vencido: 'Vencido',
  sin_hitos: 'Sin hitos',
  completado: 'Completado',
  abandonado: 'Abandonado',
}

/** 'Quedan 12 días', 'Vence hoy', 'Venció hace 3 días'. */
export function daysText(daysLeft: number): string {
  if (daysLeft > 1) return `Quedan ${daysLeft} días`
  if (daysLeft === 1) return 'Queda 1 día'
  if (daysLeft === 0) return 'Vence hoy'
  if (daysLeft === -1) return 'Venció ayer'
  return `Venció hace ${-daysLeft} días`
}
