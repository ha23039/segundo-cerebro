import { describe, expect, test } from 'vitest'
import { dueSoon, goalPace } from './pace'
import type { Goal } from './types'

function goal(over: Partial<Goal> = {}, done = 0, total = 0): Goal {
  return {
    id: 'g1',
    title: 'Objetivo',
    description: null,
    startDate: '2026-11-01',
    dueDate: '2026-11-21', // 20 días
    status: 'activo',
    completedAt: null,
    milestones: Array.from({ length: total }, (_, i) => ({ id: `m${i}`, title: `Hito ${i}`, done: i < done, position: i })),
    ...over,
  }
}

describe('goalPace', () => {
  test('lo esperado es el plazo transcurrido', () => {
    const p = goalPace(goal({}, 0, 4), '2026-11-11') // día 10 de 20
    expect(p.expected).toBe(0.5)
    expect(p.expectedMilestones).toBe(2)
    expect(p.daysLeft).toBe(10)
  })

  test('adelantado, en ritmo y atrasado con tolerancia del 10 %', () => {
    const today = '2026-11-11' // esperado 50 %
    expect(goalPace(goal({}, 3, 4), today).status).toBe('adelantado') // 75 %
    expect(goalPace(goal({}, 2, 4), today).status).toBe('en_ritmo') // 50 %
    expect(goalPace(goal({}, 1, 4), today).status).toBe('atrasado') // 25 %
    expect(goalPace(goal({}, 6, 10), today).status).toBe('en_ritmo') // 60 %: justo en el borde
    expect(goalPace(goal({}, 4, 10), today).status).toBe('en_ritmo') // 40 %: justo en el borde
    expect(goalPace(goal({}, 7, 10), today).status).toBe('adelantado')
    expect(goalPace(goal({}, 3, 10), today).status).toBe('atrasado')
  })

  test('antes de empezar no se espera nada; el plazo no pasa de 100 %', () => {
    expect(goalPace(goal({ startDate: '2026-11-05' }, 0, 3), '2026-11-01').expected).toBe(0)
    expect(goalPace(goal({}, 0, 3), '2026-11-21').expected).toBe(1)
  })

  test('sin hitos no hay ritmo, solo plazo', () => {
    const p = goalPace(goal(), '2026-11-11')
    expect(p).toMatchObject({ progress: null, total: 0, status: 'sin_hitos' })
  })

  test('vencido: la fecha límite ya pasó y sigue activo', () => {
    const p = goalPace(goal({}, 1, 4), '2026-11-22')
    expect(p.status).toBe('vencido')
    expect(p.daysLeft).toBe(-1)
  })

  test('el día de la fecha límite todavía no está vencido', () => {
    expect(goalPace(goal({}, 4, 4), '2026-11-21')).toMatchObject({ status: 'en_ritmo', daysLeft: 0 })
    expect(goalPace(goal({}, 1, 4), '2026-11-21').status).toBe('atrasado')
  })

  test('completado y abandonado mandan sobre el ritmo', () => {
    expect(goalPace(goal({ status: 'completado', completedAt: '2026-11-10T10:00:00Z' }, 1, 4), '2026-12-01').status).toBe('completado')
    expect(goalPace(goal({ status: 'abandonado' }, 1, 4), '2026-12-01').status).toBe('abandonado')
  })

  test('plazo de un solo día: se espera todo ese día', () => {
    const g = goal({ startDate: '2026-11-10', dueDate: '2026-11-10' }, 0, 2)
    expect(goalPace(g, '2026-11-10')).toMatchObject({ expected: 1, status: 'atrasado' })
  })
})

describe('dueSoon', () => {
  const g = (id: string, dueDate: string, status: Goal['status'] = 'activo') => goal({ id, title: id, dueDate, status })

  test('activos que vencen en 7 días o menos, y los ya vencidos, por fecha', () => {
    const list = [g('c', '2026-11-25'), g('lejos', '2026-12-20'), g('a', '2026-11-18'), g('vencido', '2026-11-10'), g('hecho', '2026-11-19', 'completado')]
    expect(dueSoon(list, '2026-11-18').map((x) => x.id)).toEqual(['vencido', 'a', 'c'])
  })

  test('el límite son 7 días exactos', () => {
    expect(dueSoon([g('a', '2026-11-25')], '2026-11-18')).toHaveLength(1)
    expect(dueSoon([g('a', '2026-11-26')], '2026-11-18')).toHaveLength(0)
  })
})
