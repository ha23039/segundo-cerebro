import { describe, expect, test } from 'vitest'
import { addDays, isoWeekday, type IsoDate } from '../../../lib/dates'
import { currentStreak } from './streaks'
import { dias, habit, logs, semanal } from './testing'

const TODAY = '2026-10-28' // miércoles

/** Fechas entre from y to (inclusive) cuyo día de la semana está en `days`. */
function every(from: IsoDate, to: IsoDate, days: number[]): IsoDate[] {
  const out: IsoDate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) if (days.includes(isoWeekday(d))) out.push(d)
  return out
}

describe('racha por días', () => {
  test('hoy pendiente no rompe la racha', () => {
    const h = habit([dias('2026-10-05', [1, 3, 5])])
    expect(currentStreak(h, logs(every('2026-10-05', '2026-10-26', [1, 3, 5])), TODAY)).toEqual({ value: 10, unit: 'dias' })
  })

  test('hoy hecho suma', () => {
    const h = habit([dias('2026-10-05', [1, 3, 5])])
    expect(currentStreak(h, logs(every('2026-10-05', TODAY, [1, 3, 5])), TODAY)?.value).toBe(11)
  })

  test('un día programado sin hacer corta la racha', () => {
    const h = habit([dias('2026-10-05', [1, 3, 5])])
    const l = logs(every('2026-10-05', '2026-10-26', [1, 3, 5]).filter((d) => d !== '2026-10-23'))
    expect(currentStreak(h, l, TODAY)?.value).toBe(1)
  })

  test('el fin de semana no programado no rompe una racha de lunes a viernes', () => {
    const h = habit([dias('2026-10-12', [1, 2, 3, 4, 5])])
    expect(currentStreak(h, logs(every('2026-10-12', '2026-10-27', [1, 2, 3, 4, 5])), TODAY)?.value).toBe(12)
  })

  test('cambiar de L-M-V a L-V no convierte en fallo los martes anteriores', () => {
    const h = habit([dias('2026-10-05', [1, 3, 5], '2026-10-25'), dias('2026-10-26', [1, 2, 3, 4, 5])])
    const l = logs([...every('2026-10-05', '2026-10-25', [1, 3, 5]), '2026-10-26', '2026-10-27'])
    expect(currentStreak(h, l, TODAY)?.value).toBe(11)
  })

  test('cantidad: solo cuenta si alcanza la meta', () => {
    const h = habit([dias('2026-10-26', [1, 2, 3, 4, 5, 6, 7], null, 8)], { kind: 'cantidad', unit: 'vasos' })
    const l = new Map([
      ['2026-10-26', 8],
      ['2026-10-27', 5],
    ])
    expect(currentStreak(h, l, TODAY)?.value).toBe(0)
  })

  test('archivado no tiene racha', () => {
    const h = habit([dias('2026-10-05', [1, 3, 5], '2026-10-27')], { archivedAt: '2026-10-28T08:00:00Z' })
    expect(currentStreak(h, logs(every('2026-10-05', '2026-10-26', [1, 3, 5])), TODAY)).toBeNull()
  })
})

describe('racha semanal', () => {
  test('semanas completas cumplidas; la actual en curso no rompe', () => {
    const h = habit([semanal('2026-10-05', 3)])
    const l = logs([
      '2026-10-05', '2026-10-06', '2026-10-07',
      '2026-10-12', '2026-10-14', '2026-10-16',
      '2026-10-19', '2026-10-20', '2026-10-25',
      '2026-10-26',
    ])
    expect(currentStreak(h, l, TODAY)).toEqual({ value: 3, unit: 'semanas' })
  })

  test('una semana completa sin cumplir corta la racha', () => {
    const h = habit([semanal('2026-10-05', 3)])
    const l = logs([
      '2026-10-05', '2026-10-06', '2026-10-07',
      '2026-10-12', '2026-10-14',
      '2026-10-19', '2026-10-20', '2026-10-25',
    ])
    expect(currentStreak(h, l, TODAY)?.value).toBe(1)
  })

  test('la semana actual cumplida suma', () => {
    const h = habit([semanal('2026-10-19', 2)])
    const l = logs(['2026-10-19', '2026-10-20', '2026-10-26', '2026-10-28'])
    expect(currentStreak(h, l, TODAY)?.value).toBe(2)
  })

  test('la semana parcial de inicio no rompe', () => {
    const h = habit([semanal('2026-10-15', 3)]) // jueves
    const l = logs(['2026-10-16', '2026-10-19', '2026-10-21', '2026-10-23'])
    expect(currentStreak(h, l, TODAY)?.value).toBe(1)
  })

  test('la semana parcial de inicio suma si llegó a N', () => {
    const h = habit([semanal('2026-10-15', 3)])
    const l = logs(['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-19', '2026-10-21', '2026-10-23'])
    expect(currentStreak(h, l, TODAY)?.value).toBe(2)
  })

  test('un hueco de archivado a mitad de semana deja semanas parciales que no rompen', () => {
    const h = habit([semanal('2026-10-05', 2, '2026-10-14'), semanal('2026-10-21', 2)])
    const l = logs(['2026-10-05', '2026-10-06', '2026-10-21', '2026-10-23'])
    expect(currentStreak(h, l, TODAY)?.value).toBe(2)
  })

  test('semanas que cruzan el año', () => {
    const h = habit([semanal('2026-12-14', 2)])
    const l = logs(['2026-12-14', '2026-12-16', '2026-12-21', '2026-12-22', '2026-12-29', '2027-01-02'])
    expect(currentStreak(h, l, '2027-01-06')).toEqual({ value: 3, unit: 'semanas' })
  })
})
