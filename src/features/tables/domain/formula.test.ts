import { describe, expect, it } from 'vitest'
import { computeFormulas, footerValue, formulaRefs, parseFormula, renameInFormula } from './formula'
import type { TableColumn, TableRow } from './types'

const col = (id: string, name: string, type: TableColumn['type'], options: TableColumn['options'] = {}): TableColumn => ({ id, tableId: 't', name, type, options, position: 0 })
const row = (id: string, cells: TableRow['cells']): TableRow => ({ id, tableId: 't', cells, createdAt: '2026-11-27T10:00:00Z' })

describe('parseFormula', () => {
  it('respeta la precedencia y los paréntesis', () => {
    const cols = [col('a', 'A', 'numero'), col('f', 'F', 'formula', { formula: '2 + 3 * {A}' }), col('g', 'G', 'formula', { formula: '(2 + 3) * {A}' })]
    const out = computeFormulas(cols, [row('r', { a: 4 })])
    expect(out.get('r')!.f).toEqual({ v: 14 })
    expect(out.get('r')!.g).toEqual({ v: 20 })
  })

  it('acepta menos unario y decimales sin errores de coma flotante', () => {
    const cols = [col('f', 'F', 'formula', { formula: '-(0.1 + 0.2)' })]
    expect(computeFormulas(cols, [row('r', {})]).get('r')!.f).toEqual({ v: -0.3 })
  })

  it.each([
    ['', 'Escribe la fórmula'],
    ['{A', 'Falta cerrar la llave'],
    ['(1 + 2', 'Falta cerrar el paréntesis'],
    ['1 +', 'incompleta'],
    ['1 2', 'Sobra'],
    ['foo(1)', 'Función desconocida'],
    ['A + 1', 'no es una función'],
    ['SUM(1)', 'necesita una columna'],
    ['1 $ 2', 'no permitido'],
    ['ABS(1, 2)', 'un solo valor'],
  ])('rechaza «%s»', (src, msg) => {
    const r = parseFormula(src)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain(msg)
  })

  it('no ejecuta código: nada de eval', () => {
    for (const src of ['constructor', 'process.exit()', "alert('x')", '__proto__', 'this']) expect(parseFormula(src).ok).toBe(false)
  })

  it('lista las columnas que usa', () => {
    const r = parseFormula('{Salida} - {Entrada} + SUM({Extra})')
    expect(r.ok && formulaRefs(r.ast)).toEqual(['Salida', 'Entrada', 'Extra'])
  })
})

describe('renameInFormula', () => {
  it('renombra sin importar mayúsculas ni espacios y deja el resto', () => {
    expect(renameInFormula('{ entrada } - {Salida} + {entrada}', 'Entrada', 'Compra')).toBe('{Compra} - {Salida} + {Compra}')
  })
})

describe('computeFormulas', () => {
  const cols = [
    col('e', 'Entrada', 'numero'),
    col('s', 'Salida', 'numero'),
    col('r', 'Resultado', 'formula', { formula: '{Salida} - {Entrada}' }),
    col('p', 'Peso', 'formula', { formula: '{Resultado} / SUM({Resultado})' }),
  ]
  const rows = [row('1', { e: 100, s: 130 }), row('2', { e: 50, s: 40 }), row('3', { e: 10 })]
  const out = computeFormulas(cols, rows)

  it('calcula por fila y deja vacío si falta un dato (no 0)', () => {
    expect(out.get('1')!.r).toEqual({ v: 30 })
    expect(out.get('2')!.r).toEqual({ v: -10 })
    expect(out.get('3')!.r).toEqual({ v: null })
  })

  it('mezcla valores de la fila con totales de la columna', () => {
    expect(out.get('1')!.p).toEqual({ v: 1.5 })
    expect(out.get('2')!.p).toEqual({ v: -0.5 })
    expect(out.get('3')!.p).toEqual({ v: null })
  })

  it('SUM, AVG, MIN, MAX y COUNT ignoran las vacías', () => {
    const c = [
      col('n', 'N', 'numero'),
      ...(['SUM', 'AVG', 'MIN', 'MAX', 'COUNT'] as const).map((fn) => col(fn, fn, 'formula', { formula: `${fn}({N})` })),
    ]
    const r = computeFormulas(c, [row('1', { n: 2 }), row('2', {}), row('3', { n: 4 })]).get('1')!
    expect([r.SUM, r.AVG, r.MIN, r.MAX, r.COUNT]).toEqual([{ v: 6 }, { v: 3 }, { v: 2 }, { v: 4 }, { v: 2 }])
  })

  it('dividir entre cero, referencias rotas y tipos no numéricos dan error, no cuelgan', () => {
    const c = [
      col('a', 'A', 'numero'),
      col('t', 'Texto', 'texto'),
      col('d', 'D', 'formula', { formula: '1 / {A}' }),
      col('x', 'X', 'formula', { formula: '{NoExiste} + 1' }),
      col('y', 'Y', 'formula', { formula: '{Texto} + 1' }),
      col('z', 'Z', 'formula', { formula: '(' }),
    ]
    const r = computeFormulas(c, [row('1', { a: 0 })]).get('1')!
    expect(r.d).toEqual({ e: '#DIV/0' })
    expect(r.x).toEqual({ e: '#REF' })
    expect(r.y).toEqual({ e: '#TIPO' })
    expect(r.z).toEqual({ e: '#FÓRMULA' })
  })

  it('detecta ciclos entre fórmulas y en una columna que se suma a sí misma', () => {
    const c = [col('a', 'A', 'formula', { formula: '{B} + 1' }), col('b', 'B', 'formula', { formula: '{A} + 1' }), col('s', 'S', 'formula', { formula: 'SUM({S})' })]
    const r = computeFormulas(c, [row('1', {})]).get('1')!
    expect(r.a).toEqual({ e: '#CICLO' })
    expect(r.b).toEqual({ e: '#CICLO' })
    expect(r.s).toEqual({ e: '#CICLO' })
  })

  it('ROUND y ABS', () => {
    const c = [col('a', 'A', 'numero'), col('r', 'R', 'formula', { formula: 'ROUND({A} / 3, 2)' }), col('b', 'B', 'formula', { formula: 'ABS({A})' })]
    const r = computeFormulas(c, [row('1', { a: -10 })]).get('1')!
    expect(r.r).toEqual({ v: -3.33 })
    expect(r.b).toEqual({ v: 10 })
  })

  it('una tabla vacía no falla', () => {
    expect(computeFormulas(cols, []).size).toBe(0)
  })
})

describe('footerValue', () => {
  it('suma y media de numéricas y de fórmulas, ignorando vacías', () => {
    const cols = [col('e', 'E', 'numero'), col('f', 'F', 'formula', { formula: '{E} * 2' })]
    const rows = [row('1', { e: 1 }), row('2', { e: 3 }), row('3', {})]
    const c = computeFormulas(cols, rows)
    expect(footerValue('suma', cols[0], rows, c)).toEqual({ v: 4 })
    expect(footerValue('media', cols[0], rows, c)).toEqual({ v: 2 })
    expect(footerValue('suma', cols[1], rows, c)).toEqual({ v: 8 })
    expect(footerValue('suma', cols[0], [], c)).toEqual({ v: null })
  })
})
