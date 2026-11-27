import { describe, expect, it } from 'vitest'
import { compareCells, displayCell, formatNumber, parseNumber, sanitizeCell } from './cells'
import type { TableColumn } from './types'

const col = (type: TableColumn['type'], options: TableColumn['options'] = {}): TableColumn => ({ id: 'c', tableId: 't', name: 'C', type, options, position: 0 })

describe('parseNumber', () => {
  it.each([
    ['12', 12],
    ['12,5', 12.5],
    ['12.5', 12.5],
    ['1.234,56', 1234.56],
    [' -3 ', -3],
    ['.5', 0.5],
  ])('«%s» es %s', (text, n) => expect(parseNumber(text)).toBe(n))
  it.each(['', 'abc', '1,2,3', '12a', '--1', 'Infinity', '1e5'])('«%s» no es un número', (text) => expect(parseNumber(text)).toBeNull())
})

describe('sanitizeCell', () => {
  it('texto: recorta, vacío no se guarda y respeta el máximo', () => {
    expect(sanitizeCell(col('texto'), '  hola ')).toEqual({ ok: true, value: 'hola' })
    expect(sanitizeCell(col('texto'), '   ')).toEqual({ ok: true, value: undefined })
    expect(sanitizeCell(col('texto'), 'x'.repeat(501)).ok).toBe(false)
  })
  it('número: coma decimal, rechaza texto y números enormes', () => {
    expect(sanitizeCell(col('numero'), '1,5')).toEqual({ ok: true, value: 1.5 })
    expect(sanitizeCell(col('numero'), '')).toEqual({ ok: true, value: undefined })
    expect(sanitizeCell(col('numero'), 'abc').ok).toBe(false)
    expect(sanitizeCell(col('numero'), 1e13).ok).toBe(false)
  })
  it('fecha: solo fechas reales', () => {
    expect(sanitizeCell(col('fecha'), '2026-02-28').ok).toBe(true)
    expect(sanitizeCell(col('fecha'), '2026-02-30').ok).toBe(false)
    expect(sanitizeCell(col('fecha'), '28/02/2026').ok).toBe(false)
  })
  it('lista: solo opciones definidas', () => {
    const c = col('lista', { choices: ['Compra', 'Venta'] })
    expect(sanitizeCell(c, 'Compra')).toEqual({ ok: true, value: 'Compra' })
    expect(sanitizeCell(c, 'Otra').ok).toBe(false)
    expect(sanitizeCell(c, '')).toEqual({ ok: true, value: undefined })
  })
  it('casilla: solo se guarda marcada', () => {
    expect(sanitizeCell(col('casilla'), true)).toEqual({ ok: true, value: true })
    expect(sanitizeCell(col('casilla'), false)).toEqual({ ok: true, value: undefined })
  })
  it('ítems: limpia vacíos, conserva el estado y respeta los límites', () => {
    const r = sanitizeCell(col('items'), [{ t: ' a ', d: true }, { t: '  ', d: true }, { t: 'b', d: false }])
    expect(r).toEqual({ ok: true, value: [{ t: 'a', d: true }, { t: 'b', d: false }] })
    expect(sanitizeCell(col('items'), [{ t: 'x'.repeat(101), d: false }]).ok).toBe(false)
    expect(sanitizeCell(col('items'), Array.from({ length: 51 }, (_, i) => ({ t: `i${i}`, d: false }))).ok).toBe(false)
    expect(sanitizeCell(col('items'), [])).toEqual({ ok: true, value: undefined })
  })
  it('fórmula: no se edita', () => expect(sanitizeCell(col('formula'), '1').ok).toBe(false))
})

describe('mostrar y ordenar', () => {
  it('formatea números en español', () => {
    expect(formatNumber(1234.5)).toBe('1234,5')
    expect(formatNumber(2, 2)).toBe('2,00')
    expect(displayCell(col('numero', { decimals: 1 }), 3)).toBe('3,0')
  })
  it('resume los ítems como hechos/total', () => {
    expect(displayCell(col('items'), [{ t: 'a', d: true }, { t: 'b', d: false }])).toBe('1/2')
    expect(displayCell(col('items'), undefined)).toBe('')
  })
  it('las celdas de fórmula muestran su resultado o el error', () => {
    expect(displayCell(col('formula'), undefined, { v: 1.5 })).toBe('1,5')
    expect(displayCell(col('formula'), undefined, { e: '#DIV/0' })).toBe('#DIV/0')
  })
  it('las vacías van siempre al final', () => {
    const c = col('numero')
    expect(compareCells(c, 1, undefined)).toBeLessThan(0)
    expect(compareCells(c, undefined, 1)).toBeGreaterThan(0)
    expect(compareCells(c, 1, 2)).toBeLessThan(0)
    expect(compareCells(col('texto'), 'b', 'a')).toBeGreaterThan(0)
  })
})
