import { describe, expect, it } from 'vitest'
import { parseTags, tagCounts, tagsError } from './tags'

describe('parseTags', () => {
  it('separa por comas y saltos, quita #, pasa a minúsculas y deduplica', () => {
    expect(parseTags(' Trabajo, #Ideas ,trabajo,\n lectura ,, ')).toEqual(['trabajo', 'ideas', 'lectura'])
  })
  it('vacío da lista vacía', () => expect(parseTags('  ,, ')).toEqual([]))
})

describe('tagsError', () => {
  it('acepta hasta 10 etiquetas de 30 caracteres', () => {
    expect(tagsError(Array.from({ length: 10 }, (_, i) => `t${i}`))).toBeNull()
    expect(tagsError(['a'.repeat(30)])).toBeNull()
  })
  it('rechaza más de 10 o más largas de 30', () => {
    expect(tagsError(Array.from({ length: 11 }, (_, i) => `t${i}`))).toMatch(/10/)
    expect(tagsError(['a'.repeat(31)])).toMatch(/30/)
  })
})

describe('tagCounts', () => {
  it('ordena por uso y luego alfabéticamente', () => {
    expect(tagCounts([{ tags: ['b', 'a'] }, { tags: ['b'] }, { tags: ['c'] }])).toEqual([
      { tag: 'b', count: 2 },
      { tag: 'a', count: 1 },
      { tag: 'c', count: 1 },
    ])
  })
})
