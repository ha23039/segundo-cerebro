import { describe, expect, test } from 'vitest'
import { dias, habit, logs } from '../../habits/domain/testing'
import type { LogsByDate } from '../../habits/domain/types'
import { averageScore, completion, dayScore, lastScores, scoreStreak, type Priority } from './score'

const TODAY = '2026-10-28'
const leer = habit([dias('2026-10-19', [1, 2, 3, 4, 5, 6, 7])], { id: 'leer', weight: 4 })
const agua = habit([dias('2026-10-19', [1, 2, 3, 4, 5, 6, 7], null, 8)], { id: 'agua', kind: 'cantidad', unit: 'vasos', weight: 2 })
const map = (e: [string, LogsByDate][]) => new Map(e)
const prio = (date: string, position: number, done: boolean): Priority => ({ id: `${date}-${position}`, date, position, title: 'P', done })

test('completion: check 0/1, cantidad parcial con tope en 1', () => {
  expect(completion(leer, leer.schedules[0], undefined)).toBe(0)
  expect(completion(leer, leer.schedules[0], 1)).toBe(1)
  expect(completion(agua, agua.schedules[0], 4)).toBe(0.5)
  expect(completion(agua, agua.schedules[0], 20)).toBe(1)
})

describe('dayScore', () => {
  test('ponderado por peso y con lo parcial sumando', () => {
    // leer hecho (4×1) + agua 4/8 (2×0,5) = 5 de 6 → 83
    const l = map([['leer', logs([TODAY])], ['agua', new Map([[TODAY, 4]])]])
    expect(dayScore([leer, agua], l, [], TODAY)).toEqual({ score: 83, habitsDone: 1, habitsTotal: 2, prioritiesDone: 0, prioritiesTotal: 0 })
  })

  test('las prioridades pesan 4 cada una', () => {
    // leer hecho 4 + agua 0 de 2 + prioridades 1 de 2 (4 de 8) = 8 de 14 → 57
    const l = map([['leer', logs([TODAY])]])
    const p = [prio(TODAY, 1, true), prio(TODAY, 2, false)]
    expect(dayScore([leer, agua], l, p, TODAY)?.score).toBe(57)
  })

  test('sin nada que hacer no hay puntuación', () => {
    expect(dayScore([leer], new Map(), [], '2026-10-01')).toBeNull()
  })
})

test('scoreStreak: días seguidos con 70 o más; hoy en curso no rompe', () => {
  const l = map([['leer', logs(['2026-10-25', '2026-10-26', '2026-10-27'])], ['agua', new Map([['2026-10-27', 8], ['2026-10-26', 8], ['2026-10-25', 2]])]])
  // 25: 4+0,5 de 6 = 75 · 26: 100 · 27: 100 · 24: 0 → corta
  expect(scoreStreak([leer, agua], l, new Map(), TODAY)).toBe(3)
})

test('averageScore usa los días cerrados del rango', () => {
  const l = map([['leer', logs(['2026-10-26'])]])
  // 26: 4 de 6 = 67 · 27: 0 → media 33,5 → 34
  expect(averageScore([leer, agua], l, new Map(), '2026-10-26', TODAY, TODAY)).toBe(34)
})

test('averageScore sin días cerrados usa la puntuación de hoy', () => {
  const l = map([['leer', logs([TODAY])]])
  expect(averageScore([leer, agua], l, new Map(), TODAY, TODAY, TODAY)).toBe(67)
})

test('lastScores devuelve n días', () => {
  expect(lastScores([leer], new Map(), new Map(), TODAY, 2).map((d) => d.score)).toEqual([0, 0])
})
