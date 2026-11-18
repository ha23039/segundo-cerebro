import { describe, expect, test } from 'vitest'
import { milestoneTitleSchema, validateGoal } from './schema'

const TODAY = '2026-11-18'

describe('validateGoal', () => {
  test('acepta un objetivo válido y recorta los textos', () => {
    expect(validateGoal({ title: '  Correr un 10K ', description: '  ', dueDate: '2026-12-31' }, TODAY)).toEqual({
      ok: true,
      data: { title: 'Correr un 10K', description: null, dueDate: '2026-12-31' },
    })
  })

  test('título obligatorio y de hasta 80 caracteres', () => {
    expect(validateGoal({ title: ' ', dueDate: '2026-12-31' }, TODAY)).toMatchObject({ ok: false, errors: { title: 'Escribe un título' } })
    expect(validateGoal({ title: 'x'.repeat(81), dueDate: '2026-12-31' }, TODAY)).toMatchObject({ ok: false, errors: { title: 'Máximo 80 caracteres' } })
  })

  test('la fecha límite es obligatoria y no puede ser anterior al inicio', () => {
    expect(validateGoal({ title: 'A', dueDate: '' }, TODAY)).toMatchObject({ ok: false, errors: { dueDate: 'Elige una fecha límite' } })
    expect(validateGoal({ title: 'A', dueDate: '2026-11-17' }, TODAY)).toMatchObject({ ok: false, errors: { dueDate: 'La fecha límite no puede ser anterior al inicio' } })
    expect(validateGoal({ title: 'A', dueDate: TODAY }, TODAY).ok).toBe(true)
  })

  test('la descripción admite hasta 500 caracteres', () => {
    expect(validateGoal({ title: 'A', description: 'x'.repeat(501), dueDate: '2026-12-31' }, TODAY)).toMatchObject({ ok: false, errors: { description: 'Máximo 500 caracteres' } })
  })
})

describe('milestoneTitleSchema', () => {
  test('1 a 120 caracteres', () => {
    expect(milestoneTitleSchema.safeParse('  ').success).toBe(false)
    expect(milestoneTitleSchema.safeParse('x'.repeat(121)).success).toBe(false)
    expect(milestoneTitleSchema.parse(' Correr 5 km ')).toBe('Correr 5 km')
  })
})
