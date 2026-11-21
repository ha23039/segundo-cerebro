import { expect, test } from 'vitest'
import { freePosition, groupByDate } from './priorities'

const p = (date: string, position: number) => ({ id: `${date}${position}`, date, position, title: 't', done: false })

test('freePosition rellena huecos y devuelve null con tres', () => {
  expect(freePosition([])).toBe(1)
  expect(freePosition([p('d', 1), p('d', 3)])).toBe(2)
  expect(freePosition([p('d', 1), p('d', 2), p('d', 3)])).toBeNull()
})

test('groupByDate', () => {
  const g = groupByDate([p('a', 1), p('b', 1), p('a', 2)])
  expect(g.get('a')?.length).toBe(2)
  expect(g.get('b')?.length).toBe(1)
})
