import { describe, expect, it } from 'vitest'
import { buildCsvFiles, buildJson, EXPORT_TABLES, PRIMARY_KEY, stripDerived, type ExportData } from './bundle'
import { csvCell, toCsv } from './csv'
import { crc32, zipStore } from './zip'

describe('csv', () => {
  it('escapa comas, comillas y saltos de línea', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('di "hola"')).toBe('"di ""hola"""')
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"')
  })
  it('neutraliza fórmulas de hoja de cálculo en textos, no en números', () => {
    expect(csvCell('=SUMA(A1)')).toBe("'=SUMA(A1)")
    expect(csvCell('+34 600')).toBe("'+34 600")
    expect(csvCell('@usuario')).toBe("'@usuario")
    expect(csvCell('-cmd')).toBe("'-cmd")
    expect(csvCell(-5)).toBe('-5')
  })
  it('null, listas y objetos', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(['a', 'b'])).toBe('a; b')
    expect(csvCell({ x: 1 })).toBe('"{""x"":1}"')
  })
  it('toCsv: BOM, CRLF y unión de columnas', () => {
    const out = toCsv([{ a: 1 }, { a: 2, b: 'x' }])
    expect(out).toBe('﻿a,b\r\n1,\r\n2,x\r\n')
  })
  it('sin filas solo escribe la cabecera pedida', () => {
    expect(toCsv([], ['a', 'b'])).toBe('﻿a,b\r\n')
  })
})

describe('zip', () => {
  it('crc32 estándar', () => expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926))

  it('estructura válida: cabeceras, tamaños, CRC y directorio central', () => {
    const files = [
      { name: 'a.csv', data: new TextEncoder().encode('hola') },
      { name: 'ñ.csv', data: new TextEncoder().encode('adiós') },
    ]
    const z = zipStore(files, new Date(2026, 10, 21, 10, 30, 0))
    const v = new DataView(z.buffer)
    expect(v.getUint32(0, true)).toBe(0x04034b50)
    expect(v.getUint16(6, true) & 0x0800).toBe(0x0800)
    const end = z.length - 22
    expect(v.getUint32(end, true)).toBe(0x06054b50)
    expect(v.getUint16(end + 10, true)).toBe(2)
    const cdOffset = v.getUint32(end + 16, true)
    expect(v.getUint32(cdOffset, true)).toBe(0x02014b50)
    expect(v.getUint32(cdOffset + 16, true)).toBe(crc32(files[0]!.data))
    const nameLen = v.getUint16(cdOffset + 28, true)
    expect(new TextDecoder().decode(z.slice(cdOffset + 46, cdOffset + 46 + nameLen))).toBe('a.csv')
    // el contenido está al final de la cabecera local
    expect(new TextDecoder().decode(z.slice(30 + 5, 30 + 5 + 4))).toBe('hola')
  })
})

describe('bundle', () => {
  const empty = Object.fromEntries(EXPORT_TABLES.map((t) => [t, []])) as unknown as ExportData

  it('incluye todas las tablas del usuario', () => {
    expect([...EXPORT_TABLES].sort()).toEqual(
      ['daily_priorities', 'focus_sessions', 'goals', 'habit_logs', 'habit_schedules', 'habit_skips', 'habits', 'journal_entries', 'milestones', 'notes', 'profiles', 'rest_days', 'weekly_reviews'].sort(),
    )
  })
  it('cada tabla exportada tiene su clave de orden', () => {
    expect(Object.keys(PRIMARY_KEY).sort()).toEqual([...EXPORT_TABLES].sort())
  })
  it('JSON con versión, fecha y todas las tablas', () => {
    const j = JSON.parse(buildJson(empty, new Date('2026-11-21T10:00:00Z')))
    expect(j.app).toBe('segundo-cerebro')
    expect(j.formato).toBe(1)
    expect(j.exportadoEn).toBe('2026-11-21T10:00:00.000Z')
    expect(Object.keys(j.tablas)).toHaveLength(EXPORT_TABLES.length)
  })
  it('un CSV por tabla', () => {
    expect(buildCsvFiles(empty).map((f) => f.name)).toEqual(EXPORT_TABLES.map((t) => `${t}.csv`))
  })
  it('quita el índice de búsqueda de las notas', () => {
    expect(stripDerived('notes', [{ title: 'x', search: "'x':1" }])).toEqual([{ title: 'x' }])
    expect(stripDerived('goals', [{ title: 'x' }])).toEqual([{ title: 'x' }])
  })
})
