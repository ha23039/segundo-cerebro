import { generateIdentity, identityToRecipient } from 'age-encryption'
import { describe, expect, it } from 'vitest'
import { backupKey, isAgeRecipient, keysToDelete, nonEmptyTables } from './lib.mjs'

describe('backupKey', () => {
  it('usa la fecha UTC', () => expect(backupKey(new Date('2026-11-22T03:00:00Z'))).toBe('backup-2026-11-22.tar.gz.age'))
})

describe('keysToDelete', () => {
  const k = (n: number) => `backup-2026-01-${String(n).padStart(2, '0')}.tar.gz.age`
  it('conserva las 12 más recientes y borra las más antiguas', () => {
    const keys = Array.from({ length: 15 }, (_, i) => k(i + 1))
    expect(keysToDelete([...keys].reverse(), 12)).toEqual([k(1), k(2), k(3)])
  })
  it('con 12 o menos no borra nada', () => {
    expect(keysToDelete(Array.from({ length: 12 }, (_, i) => k(i + 1)), 12)).toEqual([])
    expect(keysToDelete([], 12)).toEqual([])
  })
  it('nunca toca objetos que no son respaldos', () => {
    expect(keysToDelete(['leeme.txt', 'backup-x.tar.gz.age', k(1), k(2)], 1)).toEqual([k(1)])
  })
})

describe('nonEmptyTables', () => {
  it('lista las tablas con datos', () => expect(nonEmptyTables({ habits: 2, notes: 0, goals: 1 })).toEqual(['habits (2)', 'goals (1)']))
})

describe('isAgeRecipient', () => {
  it('acepta una clave pública y rechaza la privada y otros textos', async () => {
    const identity = await generateIdentity()
    const recipient = await identityToRecipient(identity)
    expect(isAgeRecipient(recipient)).toBe(true)
    expect(isAgeRecipient(identity)).toBe(false)
    expect(isAgeRecipient('hola')).toBe(false)
  })
})
