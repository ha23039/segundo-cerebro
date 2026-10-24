import { describe, expect, test } from 'vitest'
import { validateHabit } from './schema'

const valid = { name: 'Leer', kind: 'check', frequency: { kind: 'dias', days: [1, 3, 5] } }

function errors(input: unknown) {
  const r = validateHabit(input)
  return r.ok ? {} : r.errors
}

describe('validateHabit', () => {
  test('acepta un hábito válido y recorta el nombre', () => {
    const r = validateHabit({ ...valid, name: '  Leer  ' })
    expect(r.ok && r.data.name).toBe('Leer')
  })

  test('nombre vacío o de solo espacios', () => {
    expect(errors({ ...valid, name: '   ' }).name).toBe('Escribe un nombre')
  })

  test('nombre de más de 80 caracteres', () => {
    expect(errors({ ...valid, name: 'x'.repeat(81) }).name).toBe('Máximo 80 caracteres')
    expect(validateHabit({ ...valid, name: 'x'.repeat(80) }).ok).toBe(true)
  })

  test('por días sin días', () => {
    expect(errors({ ...valid, frequency: { kind: 'dias', days: [] } }).frequency).toBe('Elige al menos un día')
  })

  test('veces por semana fuera de rango', () => {
    expect(errors({ ...valid, frequency: { kind: 'semanal', timesPerWeek: 8 } }).frequency).toBe('Entre 1 y 7 veces por semana')
    expect(errors({ ...valid, frequency: { kind: 'semanal', timesPerWeek: 0 } }).frequency).toBe('Entre 1 y 7 veces por semana')
  })

  test('cantidad sin unidad ni meta', () => {
    const e = errors({ ...valid, kind: 'cantidad' })
    expect(e.unit).toBe('Escribe la unidad')
    expect(e.target).toBe('La meta debe ser mayor que 0')
  })

  test('meta demasiado grande', () => {
    expect(errors({ ...valid, kind: 'cantidad', unit: 'pasos', target: 100001 }).target).toBe('Máximo 100000')
  })

  test('cantidad válida', () => {
    const r = validateHabit({ name: 'Agua', kind: 'cantidad', unit: ' vasos ', target: 8, frequency: { kind: 'semanal', timesPerWeek: 5 } })
    expect(r.ok && r.data).toEqual({ name: 'Agua', kind: 'cantidad', unit: 'vasos', target: 8, frequency: { kind: 'semanal', timesPerWeek: 5 } })
  })
})
