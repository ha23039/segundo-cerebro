import { describe, expect, it } from 'vitest'
import { DEFAULT_ORDER, isDefault, move, moveVisible, resolveLayout, toggleHidden, type BlockId } from './layout'

describe('resolveLayout', () => {
  it('sin nada guardado devuelve el orden predeterminado', () => {
    expect(resolveLayout({})).toEqual({ order: DEFAULT_ORDER, hidden: [] })
    expect(resolveLayout(null)).toEqual({ order: DEFAULT_ORDER, hidden: [] })
    expect(resolveLayout([1, 2])).toEqual({ order: DEFAULT_ORDER, hidden: [] })
  })
  it('respeta el orden guardado y añade al final las tarjetas que faltan', () => {
    const r = resolveLayout({ order: ['foco', 'habitos'] })
    expect(r.order.slice(0, 2)).toEqual(['foco', 'habitos'])
    expect([...r.order].sort()).toEqual([...DEFAULT_ORDER].sort())
  })
  it('descarta ids desconocidos y repetidos', () => {
    const r = resolveLayout({ order: ['foco', 'foco', 'inventada', 3, 'habitos'], hidden: ['areas', 'areas', 'nada'] })
    expect(r.order.slice(0, 2)).toEqual(['foco', 'habitos'])
    expect(r.order).toHaveLength(DEFAULT_ORDER.length)
    expect(r.hidden).toEqual(['areas'])
  })
})

describe('move', () => {
  const o: BlockId[] = ['resumen', 'habitos', 'foco']
  it('mueve y no muta', () => {
    expect(move(o, 0, 2)).toEqual(['habitos', 'foco', 'resumen'])
    expect(o).toEqual(['resumen', 'habitos', 'foco'])
  })
  it('índices fuera de rango o iguales no cambian nada', () => {
    expect(move(o, 1, 1)).toEqual(o)
    expect(move(o, -1, 2)).toEqual(o)
    expect(move(o, 0, 9)).toEqual(o)
  })
})

describe('toggleHidden / isDefault', () => {
  it('oculta y vuelve a mostrar', () => {
    const l = resolveLayout({})
    const h = toggleHidden(l, 'areas')
    expect(h.hidden).toEqual(['areas'])
    expect(toggleHidden(h, 'areas').hidden).toEqual([])
    expect(isDefault(l)).toBe(true)
    expect(isDefault(h)).toBe(false)
    expect(isDefault({ ...l, order: move(l.order, 0, 1) })).toBe(false)
  })
})

describe('moveVisible', () => {
  it('sube y baja saltándose las ocultas', () => {
    const l = { order: ['resumen', 'habitos', 'foco', 'areas'] as BlockId[], hidden: ['habitos'] as BlockId[] }
    expect(moveVisible(l, 'foco', -1).order).toEqual(['foco', 'resumen', 'habitos', 'areas'])
    expect(moveVisible(l, 'resumen', 1).order).toEqual(['habitos', 'foco', 'resumen', 'areas'])
  })
  it('en los extremos no hace nada', () => {
    const l = { order: ['resumen', 'foco'] as BlockId[], hidden: [] as BlockId[] }
    expect(moveVisible(l, 'resumen', -1)).toBe(l)
    expect(moveVisible(l, 'foco', 1)).toBe(l)
  })
})
