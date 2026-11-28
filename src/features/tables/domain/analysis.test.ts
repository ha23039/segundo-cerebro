import { describe, expect, it } from 'vitest'
import { applyFilters, computeStats, equityCurve, findResultColumn, groupResults } from './analysis'
import { computeFormulas } from './formula'
import type { TableColumn, TableRow } from './types'

const col = (id: string, name: string, type: TableColumn['type'], options: TableColumn['options'] = {}): TableColumn => ({ id, tableId: 't', name, type, options, position: 0 })
const row = (id: string, cells: TableRow['cells']): TableRow => ({ id, tableId: 't', cells, createdAt: '' })

describe('estadísticas', () => {
  it('serie vacía', () => {
    const s = computeStats([])
    expect(s).toMatchObject({ n: 0, winRate: null, total: 0, best: null, profitFactor: null, maxDrawdown: 0 })
  })
  it('win rate, total, factor de beneficio y racha', () => {
    const s = computeStats([100, -50, 80, -20, -30, 40])
    expect(s.n).toBe(6)
    expect(s.wins).toBe(3)
    expect(s.winRate).toBe(0.5)
    expect(s.total).toBe(120)
    expect(s.best).toBe(100)
    expect(s.worst).toBe(-50)
    expect(s.profitFactor).toBe(2.2)
    expect(s.bestStreak).toBe(1)
    expect(s.worstStreak).toBe(2)
  })
  it('drawdown máximo desde el último máximo', () => {
    // curva: 100, 50, 130, 80, 60, 100 -> máximo 130, mínimo después 60
    expect(computeStats([100, -50, 80, -50, -20, 40]).maxDrawdown).toBe(70)
    expect(computeStats([-10, -20]).maxDrawdown).toBe(30)
    expect(computeStats([10, 20]).maxDrawdown).toBe(0)
  })
  it('la curva empieza en 0 y acumula', () => {
    expect(equityCurve([100, -50, 25])).toEqual([0, 100, 50, 75])
    expect(equityCurve([0.1, 0.2])).toEqual([0, 0.1, 0.3])
  })
})

describe('agrupar y buscar columnas', () => {
  const cols = [col('p', 'Par', 'lista', { choices: ['EUR/USD', 'GBP/JPY'] }), col('r', 'Resultado', 'numero'), col('k', 'Riesgo', 'numero')]
  const rows = [row('1', { p: 'EUR/USD', r: 100 }), row('2', { p: 'GBP/JPY', r: -40 }), row('3', { p: 'EUR/USD', r: -10 }), row('4', { r: 5 }), row('5', { p: 'EUR/USD' })]
  it('detecta la columna de resultado por su nombre', () => {
    expect(findResultColumn(cols)?.id).toBe('r')
    expect(findResultColumn([col('x', 'Notas', 'texto')])).toBeUndefined()
  })
  it('agrupa por par, de mejor a peor, ignorando filas sin resultado', () => {
    const g = groupResults(cols[0], cols[1], rows, computeFormulas(cols, rows))
    expect(g.map((x) => [x.key, x.n, x.total])).toEqual([['EUR/USD', 2, 90], ['Sin valor', 1, 5], ['GBP/JPY', 1, -40]])
    expect(g[0].winRate).toBe(0.5)
  })
})

describe('agrupar por fecha', () => {
  it('agrupa por mes, en orden cronológico y con los sin fecha al final', () => {
    const cols = [col('d', 'Fecha', 'fecha'), col('r', 'Resultado', 'numero')]
    const rows = [row('1', { d: '2026-11-03', r: 10 }), row('2', { d: '2026-10-28', r: -5 }), row('3', { d: '2026-11-20', r: 5 }), row('4', { r: 1 })]
    const g = groupResults(cols[0], cols[1], rows, computeFormulas(cols, rows))
    expect(g.map((x) => [x.key, x.n, x.total])).toEqual([['2026-10', 1, -5], ['2026-11', 2, 15], ['Sin valor', 1, 1]])
  })
})

describe('filtros', () => {
  const cols = [col('p', 'Par', 'lista', { choices: ['EUR/USD', 'GBP/JPY'] }), col('r', 'Resultado', 'numero'), col('d', 'Fecha', 'fecha'), col('c', 'Ok', 'casilla'), col('n', 'Notas', 'texto')]
  const rows = [
    row('1', { p: 'EUR/USD', r: 100, d: '2026-11-03', c: true, n: 'Ruptura limpia' }),
    row('2', { p: 'GBP/JPY', r: -40, d: '2026-10-28' }),
    row('3', { p: 'EUR/USD', r: -10, d: '2026-11-20', n: 'tarde' }),
  ]
  const run = (rules: Parameters<typeof applyFilters>[0]) => applyFilters(rules, cols, rows, computeFormulas(cols, rows)).map((r) => r.id)
  it('sin reglas devuelve todo', () => expect(run([])).toEqual(['1', '2', '3']))
  it('lista, número, mes, casilla y texto', () => {
    expect(run([{ columnId: 'p', op: 'eq', value: 'EUR/USD' }])).toEqual(['1', '3'])
    expect(run([{ columnId: 'r', op: 'lt', value: '0' }])).toEqual(['2', '3'])
    expect(run([{ columnId: 'r', op: 'gt', value: '-20,5' }])).toEqual(['1', '3'])
    expect(run([{ columnId: 'd', op: 'month', value: '2026-11' }])).toEqual(['1', '3'])
    expect(run([{ columnId: 'c', op: 'eq', value: 'si' }])).toEqual(['1'])
    expect(run([{ columnId: 'c', op: 'empty' }])).toEqual(['2', '3'])
    expect(run([{ columnId: 'n', op: 'contains', value: 'RUPT' }])).toEqual(['1'])
  })
  it('varias reglas se combinan con Y; una regla de una columna borrada se ignora', () => {
    expect(run([{ columnId: 'p', op: 'eq', value: 'EUR/USD' }, { columnId: 'r', op: 'lt', value: '0' }])).toEqual(['3'])
    expect(run([{ columnId: 'borrada', op: 'eq', value: 'x' }])).toEqual(['1', '2', '3'])
  })
})
