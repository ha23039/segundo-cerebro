import { describe, expect, it } from 'vitest'
import { validateHabit } from '../schema'
import { HABIT_PRESETS } from './presets'

describe('plantillas de hábitos', () => {
  it('tienen ids únicos', () => {
    expect(new Set(HABIT_PRESETS.map((p) => p.id)).size).toBe(HABIT_PRESETS.length)
  })

  it.each(HABIT_PRESETS.map((p) => [p.name, p] as const))('«%s» es un hábito válido tal cual', (_name, p) => {
    const r = validateHabit({
      name: p.name,
      kind: p.kind,
      area: p.area,
      weight: 3,
      unit: p.unit,
      target: p.target,
      frequency: p.frequency,
    })
    expect(r.ok).toBe(true)
  })
})
