import type { Habit } from './types'

/** Duración que se da a un bloque sin hora de fin, para saber cuándo deja de ser "ahora". */
export const POINT_BLOCK_MINUTES = 30

export type BlockState = 'ahora' | 'despues' | 'atrasado'

export interface TimeBlock {
  habit: Habit
  start: string
  end: string | null
  state: BlockState
}

/** 'HH:MM' → minutos desde medianoche. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Lo que queda por hacer con hora, ordenado por inicio. `nowMinutes` es la hora actual si se mira hoy;
 * con null (otro día) todo cuenta como "después". Un bloque cuya hora ya pasó y sigue sin hacerse es "atrasado".
 */
export function remainingBlocks(habits: readonly Habit[], nowMinutes: number | null): TimeBlock[] {
  return habits
    .filter((h): h is Habit & { startTime: string } => h.startTime !== null)
    .map((habit) => {
      const start = toMinutes(habit.startTime)
      const end = habit.endTime ? toMinutes(habit.endTime) : start + POINT_BLOCK_MINUTES
      const state: BlockState = nowMinutes === null || nowMinutes < start ? 'despues' : nowMinutes < end ? 'ahora' : 'atrasado'
      return { habit, start: habit.startTime, end: habit.endTime, state }
    })
    .sort((a, b) => a.start.localeCompare(b.start) || a.habit.name.localeCompare(b.habit.name, 'es'))
}
