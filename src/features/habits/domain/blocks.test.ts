import { describe, expect, test } from 'vitest'
import { remainingBlocks, toMinutes } from './blocks'
import { dias, habit } from './testing'

const h = (id: string, startTime: string | null, endTime: string | null = null) =>
  habit([dias('2026-10-01', [1])], { id, name: id, startTime, endTime })

describe('remainingBlocks', () => {
  test('ignora los hábitos sin hora y ordena por inicio', () => {
    const r = remainingBlocks([h('tarde', '20:00'), h('sin', null), h('manana', '07:30'), h('noche', '22:30')], 0)
    expect(r.map((b) => b.habit.id)).toEqual(['manana', 'tarde', 'noche'])
  })

  test('marca ahora, después y atrasado según la hora', () => {
    const blocks = [h('a', '09:00', '10:00'), h('b', '18:00', '19:30'), h('c', '22:30')]
    expect(remainingBlocks(blocks, toMinutes('09:30')).map((b) => b.state)).toEqual(['ahora', 'despues', 'despues'])
    expect(remainingBlocks(blocks, toMinutes('10:00')).map((b) => b.state)).toEqual(['atrasado', 'despues', 'despues'])
    expect(remainingBlocks(blocks, toMinutes('22:45')).map((b) => b.state)).toEqual(['atrasado', 'atrasado', 'ahora'])
  })

  test('un bloque sin fin dura 30 minutos', () => {
    const blocks = [h('c', '22:30')]
    expect(remainingBlocks(blocks, toMinutes('22:59'))[0].state).toBe('ahora')
    expect(remainingBlocks(blocks, toMinutes('23:00'))[0].state).toBe('atrasado')
  })

  test('otro día: todo es "después"', () => {
    expect(remainingBlocks([h('a', '09:00', '10:00')], null)[0].state).toBe('despues')
  })

  test('a igualdad de hora, orden alfabético', () => {
    expect(remainingBlocks([h('b', '08:00'), h('a', '08:00')], 0).map((x) => x.habit.id)).toEqual(['a', 'b'])
  })
})
