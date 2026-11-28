import { describe, expect, it } from 'vitest'
import { defaultCells, duplicateCells } from './defaults'
import type { TableColumn } from './types'

const col = (id: string, type: TableColumn['type'], options: TableColumn['options'] = {}): TableColumn => ({ id, tableId: 't', name: id, type, options, position: 0 })

describe('valores por defecto', () => {
  const cols = [
    col('t', 'texto', { default: 'EUR' }),
    col('n', 'numero', { default: '12,5' }),
    col('f', 'fecha', { default: 'hoy' }),
    col('l', 'lista', { choices: ['A', 'B'], default: 'B' }),
    col('c', 'casilla', { default: 'si' }),
    col('x', 'numero'),
  ]
  it('rellena cada tipo', () => {
    expect(defaultCells(cols, '2026-11-28')).toEqual({ t: 'EUR', n: 12.5, f: '2026-11-28', l: 'B', c: true })
  })
  it('ignora un valor que ya no es válido (opción borrada, número roto)', () => {
    expect(defaultCells([col('l', 'lista', { choices: ['A'], default: 'Z' }), col('n', 'numero', { default: 'abc' })], 'x')).toEqual({})
  })
})

describe('duplicar', () => {
  it('copia valores y listas sin compartir referencias; deja fuera fórmulas y vacíos', () => {
    const items = [{ t: 'a', d: true }]
    const out = duplicateCells([col('t', 'texto'), col('i', 'items'), col('f', 'formula', { formula: '1' }), col('v', 'numero')], { t: 'hola', i: items, f: 3 as never })
    expect(out).toEqual({ t: 'hola', i: [{ t: 'a', d: true }] })
    expect((out.i as typeof items)[0]).not.toBe(items[0])
  })
})
