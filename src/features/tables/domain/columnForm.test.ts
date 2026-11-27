import { describe, expect, it } from 'vitest'
import { validateColumnForm, type ColumnFormInput } from './columnForm'
import type { TableColumn } from './types'

const col = (id: string, name: string, type: TableColumn['type']): TableColumn => ({ id, tableId: 't', name, type, options: {}, position: 0 })
const base: ColumnFormInput = { name: 'Nueva', type: 'texto', choices: '', formula: '', decimals: '', footer: 'ninguno' }
const others = [col('a', 'Entrada', 'numero'), col('b', 'Salida', 'numero'), col('c', 'Activo', 'texto'), col('d', 'Doble', 'formula')]

describe('validateColumnForm', () => {
  it('acepta una columna de texto', () => {
    expect(validateColumnForm({ ...base, name: '  Motivo ' }, others)).toEqual({ ok: true, value: { name: 'Motivo', type: 'texto', options: {} } })
  })

  it('valida el nombre: vacío, largo, llaves y repetido sin importar mayúsculas', () => {
    expect(validateColumnForm({ ...base, name: ' ' }, others)).toMatchObject({ ok: false, errors: { name: 'Escribe un nombre' } })
    expect(validateColumnForm({ ...base, name: 'x'.repeat(41) }, others)).toMatchObject({ ok: false })
    expect(validateColumnForm({ ...base, name: 'a{b}' }, others)).toMatchObject({ ok: false })
    expect(validateColumnForm({ ...base, name: 'ENTRADA' }, others)).toMatchObject({ ok: false, errors: { name: 'Ya hay una columna con ese nombre' } })
  })

  it('al editar, el propio nombre no cuenta como repetido', () => {
    expect(validateColumnForm({ ...base, name: 'entrada', type: 'numero' }, others, 'a').ok).toBe(true)
  })

  it('lista: exige opciones sin repetir y con tope', () => {
    const lista = { ...base, type: 'lista' as const }
    expect(validateColumnForm({ ...lista, choices: '' }, others)).toMatchObject({ ok: false, errors: { choices: expect.any(String) } })
    expect(validateColumnForm({ ...lista, choices: 'Compra\nventa\n\nCOMPRA' }, others)).toMatchObject({ ok: false })
    expect(validateColumnForm({ ...lista, choices: 'Compra\n Venta ' }, others)).toMatchObject({ ok: true, value: { options: { choices: ['Compra', 'Venta'] } } })
    expect(validateColumnForm({ ...lista, choices: Array.from({ length: 31 }, (_, i) => `o${i}`).join('\n') }, others).ok).toBe(false)
  })

  it('número: decimales entre 0 y 6 y pie opcional', () => {
    const n = { ...base, type: 'numero' as const }
    expect(validateColumnForm({ ...n, decimals: '2', footer: 'suma' }, others)).toMatchObject({ ok: true, value: { options: { decimals: 2, footer: 'suma' } } })
    expect(validateColumnForm({ ...n, decimals: '7' }, others).ok).toBe(false)
    expect(validateColumnForm({ ...n, decimals: '1,5' }, others).ok).toBe(false)
  })

  it('fórmula: sintaxis, columnas que existen, numéricas y sin usarse a sí misma', () => {
    const f = { ...base, type: 'formula' as const }
    expect(validateColumnForm({ ...f, name: 'Res', formula: '{Salida} - {Entrada}' }, others)).toMatchObject({ ok: true, value: { options: { formula: '{Salida} - {Entrada}' } } })
    expect(validateColumnForm({ ...f, name: 'Res', formula: '{Salida} -' }, others)).toMatchObject({ ok: false, errors: { formula: expect.stringContaining('incompleta') } })
    expect(validateColumnForm({ ...f, name: 'Res', formula: '{Nada} + 1' }, others)).toMatchObject({ ok: false, errors: { formula: 'No existe la columna «Nada»' } })
    expect(validateColumnForm({ ...f, name: 'Res', formula: '{Activo} + 1' }, others)).toMatchObject({ ok: false, errors: { formula: expect.stringContaining('no es numérica') } })
    expect(validateColumnForm({ ...f, name: 'Res', formula: '{Res} + 1' }, others)).toMatchObject({ ok: false, errors: { formula: 'Una fórmula no puede usarse a sí misma' } })
    expect(validateColumnForm({ ...f, name: 'Res', formula: '{Doble} * 2' }, others).ok).toBe(true)
  })
})
