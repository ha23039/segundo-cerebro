import { expect, test } from 'vitest'
import { setInRecord, toLogMaps, type LogsRecord } from './logsCache'

test('la caché de registros sobrevive a JSON (persistencia en IndexedDB)', () => {
  const record: LogsRecord = { h1: { '2026-10-24': 1 }, h2: { '2026-10-23': 8 } }
  const restored = JSON.parse(JSON.stringify(record)) as LogsRecord
  const maps = toLogMaps(restored)
  expect(maps.get('h1')?.get('2026-10-24')).toBe(1)
  expect(maps.get('h2')?.get('2026-10-23')).toBe(8)
})

test('setInRecord crea, reemplaza y borra sin mutar el original', () => {
  const base: LogsRecord = { h1: { '2026-10-24': 1 } }
  const added = setInRecord(base, 'h2', '2026-10-24', 3)
  expect(added.h2).toEqual({ '2026-10-24': 3 })
  const removed = setInRecord(added, 'h1', '2026-10-24', null)
  expect(removed.h1).toEqual({})
  expect(base).toEqual({ h1: { '2026-10-24': 1 } })
})
