import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, resolvePrefs } from './prefs'

describe('resolvePrefs', () => {
  it('sin nada guardado, los avisos están apagados', () => {
    expect(resolvePrefs({})).toEqual(DEFAULT_PREFS)
    expect(resolvePrefs(null)).toEqual(DEFAULT_PREFS)
    expect(resolvePrefs([])).toEqual(DEFAULT_PREFS)
    expect(DEFAULT_PREFS.enabled).toBe(false)
  })

  it('respeta lo guardado', () => {
    expect(resolvePrefs({ enabled: true, evening: false, eveningTime: '22:30', review: false, habitTimes: false })).toEqual({
      enabled: true,
      habitTimes: false,
      evening: false,
      eveningTime: '22:30',
      review: false,
    })
  })

  it('ignora valores con el tipo o el formato equivocado', () => {
    const r = resolvePrefs({ enabled: 'sí', eveningTime: '25:00', evening: 1 })
    expect(r.enabled).toBe(false)
    expect(r.eveningTime).toBe('21:00')
    expect(r.evening).toBe(true)
  })
})
