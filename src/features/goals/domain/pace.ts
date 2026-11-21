import { daysBetween, type IsoDate } from '../../../lib/dates'
import type { Goal } from './types'

/** Diferencia aceptada entre el avance real y el esperado antes de hablar de adelanto o retraso. */
export const PACE_TOLERANCE = 0.1
/** Días para el aviso "vence pronto" en Hoy. */
export const DUE_SOON_DAYS = 7

export type PaceStatus = 'completado' | 'abandonado' | 'vencido' | 'sin_hitos' | 'adelantado' | 'en_ritmo' | 'atrasado'

export interface GoalPace {
  done: number
  total: number
  /** Hitos hechos ÷ total; null sin hitos. */
  progress: number | null
  /** Parte del plazo transcurrida (0..1): el avance que se espera tener hoy si el ritmo es constante. */
  expected: number
  /** Hitos que tocaría llevar hoy (redondeado). */
  expectedMilestones: number
  /** Días hasta la fecha límite; negativo si ya pasó. */
  daysLeft: number
  status: PaceStatus
}

/**
 * Ritmo esperado: el plazo se reparte de forma lineal entre el inicio y la fecha límite, y se compara el
 * avance real (hitos hechos) con ese avance esperado. Dentro de ±10 puntos es "en ritmo".
 */
export function goalPace(goal: Goal, today: IsoDate): GoalPace {
  const total = goal.milestones.length
  const done = goal.milestones.filter((m) => m.done).length
  const progress = total === 0 ? null : done / total
  const span = daysBetween(goal.startDate, goal.dueDate)
  const elapsed = daysBetween(goal.startDate, today)
  const expected = span === 0 ? (today >= goal.dueDate ? 1 : 0) : Math.min(1, Math.max(0, elapsed / span))
  const daysLeft = daysBetween(today, goal.dueDate)

  let status: PaceStatus
  if (goal.status !== 'activo') status = goal.status
  else if (daysLeft < 0) status = 'vencido'
  else if (progress === null) status = 'sin_hitos'
  else if (progress - expected > PACE_TOLERANCE) status = 'adelantado'
  else if (progress - expected < -PACE_TOLERANCE) status = 'atrasado'
  else status = 'en_ritmo'

  return { done, total, progress, expected, expectedMilestones: Math.round(expected * total), daysLeft, status }
}

/** Objetivos activos que vencen en `days` días o menos, o ya vencidos, por fecha límite. */
export function dueSoon(goals: readonly Goal[], today: IsoDate, days = DUE_SOON_DAYS): Goal[] {
  return goals
    .filter((g) => g.status === 'activo' && daysBetween(today, g.dueDate) <= days)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title, 'es'))
}
