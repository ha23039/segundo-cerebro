import { describe, expect, it } from 'vitest'
import { validateJournal, validateNote } from './schema'

describe('validateJournal', () => {
  it('recorta y acepta texto', () => expect(validateJournal('  hola  ')).toEqual({ ok: true, body: 'hola' }))
  it('rechaza vacío y más de 2000', () => {
    expect(validateJournal('   ').ok).toBe(false)
    expect(validateJournal('x'.repeat(2001)).ok).toBe(false)
    expect(validateJournal('x'.repeat(2000)).ok).toBe(true)
  })
})

describe('validateNote', () => {
  const ok = { title: ' Ideas ', body: '# hola', tags: 'Trabajo, ideas', pinned: false }
  it('normaliza título y etiquetas', () => {
    expect(validateNote(ok)).toEqual({ ok: true, data: { title: 'Ideas', body: '# hola', tags: ['trabajo', 'ideas'], pinned: false } })
  })
  it('exige título y limita cuerpo y etiquetas', () => {
    const r = validateNote({ ...ok, title: ' ', body: 'x'.repeat(20001), tags: 'a'.repeat(31) })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['body', 'tags', 'title'])
  })
})
