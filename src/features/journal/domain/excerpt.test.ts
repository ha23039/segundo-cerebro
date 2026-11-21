import { describe, expect, it } from 'vitest'
import { excerpt } from './excerpt'

describe('excerpt', () => {
  it('quita marcas de Markdown y junta espacios', () => {
    expect(excerpt('# Título\n\nUn **texto** con [enlace](https://a.com)')).toBe('Título Un texto con enlace')
  })
  it('recorta con puntos suspensivos', () => {
    const r = excerpt('palabra '.repeat(50), 20)
    expect(r.endsWith('…')).toBe(true)
    expect(r.length).toBeLessThanOrEqual(21)
  })
})
