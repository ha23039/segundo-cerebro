import { describe, expect, it } from 'vitest'
import { NO_EXCUSES } from '../habits/domain/excuses'
import { dias, habit, logs } from '../habits/domain/testing'
import { buildReport, periodRange } from './report'

const ALL = [1, 2, 3, 4, 5, 6, 7] as const
const h1 = habit([dias('2026-09-15', [...ALL])], { id: 'a', name: 'Leer' })

describe('periodRange', () => {
  it('semana, mes y mes anterior', () => {
    expect(periodRange('semana', '2026-11-21', [h1])).toEqual({ from: '2026-11-16', to: '2026-11-22' })
    expect(periodRange('mes', '2026-11-21', [h1])).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(periodRange('mes-anterior', '2026-01-10', [h1])).toEqual({ from: '2025-12-01', to: '2025-12-31' })
  })
  it('todo: desde el primer periodo hasta hoy', () => {
    expect(periodRange('todo', '2026-11-21', [h1])).toEqual({ from: '2026-09-15', to: '2026-11-21' })
  })
})

describe('buildReport', () => {
  it('sin hábitos no hay filas ni porcentaje', () => {
    const r = buildReport([], new Map(), NO_EXCUSES, '2026-11-16', '2026-11-22', '2026-11-21')
    expect(r.rows).toEqual([])
    expect(r.ratio).toBeNull()
  })

  it('cuenta hechos sobre programados (hoy sin marcar aún no cuenta) y ordena por cumplimiento', () => {
    const peor = habit([dias('2026-09-15', [...ALL])], { id: 'b', name: 'Correr' })
    const l = new Map([
      ['a', logs(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'])],
      ['b', logs(['2026-11-16'])],
    ])
    const r = buildReport([peor, h1], l, NO_EXCUSES, '2026-11-16', '2026-11-22', '2026-11-21')
    expect(r.rows.map((x) => [x.name, x.done, x.scheduled])).toEqual([
      ['Leer', 4, 5],
      ['Correr', 1, 5],
    ])
    expect(r.total).toEqual({ done: 5, scheduled: 10 })
    expect(r.ratio).toBeCloseTo(0.5)
  })

  it('un hábito sin actividad programada en el periodo no aparece', () => {
    const nuevo = habit([dias('2026-12-01', [...ALL])], { id: 'c', name: 'Futuro' })
    expect(buildReport([nuevo], new Map(), NO_EXCUSES, '2026-11-16', '2026-11-22', '2026-11-21').rows).toEqual([])
  })
})
