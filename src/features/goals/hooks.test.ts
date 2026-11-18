import { describe, expect, test } from 'vitest'
import type { Goal } from './domain/types'
import { applyMilestoneDone } from './hooks'

const goal = (id: string, done: boolean[]): Goal => ({
  id,
  title: id,
  description: null,
  startDate: '2026-11-01',
  dueDate: '2026-11-30',
  status: 'activo',
  completedAt: null,
  milestones: done.map((d, i) => ({ id: `${id}-m${i}`, title: `Hito ${i}`, done: d, position: i })),
})

describe('applyMilestoneDone', () => {
  test('cambia solo el hito indicado y no toca el original', () => {
    const goals = [goal('a', [false, false]), goal('b', [false])]
    const next = applyMilestoneDone(goals, 'a-m1', true)
    expect(next[0].milestones.map((m) => m.done)).toEqual([false, true])
    expect(next[1]).toBe(goals[1])
    expect(goals[0].milestones[1].done).toBe(false)
  })

  test('un hito desconocido no cambia nada', () => {
    const goals = [goal('a', [true])]
    expect(applyMilestoneDone(goals, 'nope', false)).toEqual(goals)
  })
})
