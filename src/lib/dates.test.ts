import { describe, expect, test } from 'vitest'
import { addDays, daysBetween, isValidTimeZone, isoWeekday, startOfWeek, todayIn } from './dates'

describe('todayIn', () => {
  test('cambia de día a medianoche de Madrid en horario de verano', () => {
    expect(todayIn('Europe/Madrid', new Date('2026-10-24T21:59:00Z'))).toBe('2026-10-24')
    expect(todayIn('Europe/Madrid', new Date('2026-10-24T22:00:00Z'))).toBe('2026-10-25')
  })

  test('el día del cambio de hora de octubre dura 25 horas', () => {
    expect(todayIn('Europe/Madrid', new Date('2026-10-25T22:59:00Z'))).toBe('2026-10-25')
    expect(todayIn('Europe/Madrid', new Date('2026-10-25T23:00:00Z'))).toBe('2026-10-26')
  })

  test('el día del cambio de hora de marzo dura 23 horas', () => {
    expect(todayIn('Europe/Madrid', new Date('2027-03-28T21:59:00Z'))).toBe('2027-03-28')
    expect(todayIn('Europe/Madrid', new Date('2027-03-28T22:00:00Z'))).toBe('2027-03-29')
  })
})

describe('aritmética de calendario', () => {
  test('addDays cruza mes, año y bisiesto', () => {
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
  })

  test('isoWeekday usa 1 = lunes y 7 = domingo', () => {
    expect(isoWeekday('2026-10-25')).toBe(7)
    expect(isoWeekday('2026-10-26')).toBe(1)
  })

  test('startOfWeek devuelve el lunes, también cruzando el año', () => {
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19')
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19')
    expect(startOfWeek('2027-01-01')).toBe('2026-12-28')
  })

  test('daysBetween', () => {
    expect(daysBetween('2026-10-19', '2026-10-25')).toBe(6)
    expect(daysBetween('2026-10-25', '2026-10-19')).toBe(-6)
  })
})

test('isValidTimeZone', () => {
  expect(isValidTimeZone('Europe/Madrid')).toBe(true)
  expect(isValidTimeZone('Marte/Olympus')).toBe(false)
})
