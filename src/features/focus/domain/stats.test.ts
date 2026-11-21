import { describe, expect, test } from 'vitest'
import { focusByDate, recentWeeks, weekFocus, type FocusSession } from './stats'

const s = (startedAt: string, actualMinutes: number, kind: FocusSession['kind'] = 'foco'): FocusSession => ({
  id: startedAt + kind,
  kind,
  startedAt,
  endedAt: startedAt,
  plannedMinutes: actualMinutes,
  actualMinutes,
  habitId: null,
  goalId: null,
})

describe('focusByDate', () => {
  test('suma por día y cuenta las sesiones; los descansos no cuentan', () => {
    const m = focusByDate([s('2026-11-18T09:00:00Z', 25), s('2026-11-18T15:00:00Z', 25), s('2026-11-18T15:30:00Z', 5, 'descanso'), s('2026-11-19T09:00:00Z', 45)], 'Europe/Madrid')
    expect(m.get('2026-11-18')).toEqual({ minutes: 50, sessions: 2 })
    expect(m.get('2026-11-19')).toEqual({ minutes: 45, sessions: 1 })
    expect(m.size).toBe(2)
  })

  test('el día lo da la zona del perfil, no UTC', () => {
    // 23:30 UTC del 18 ya es 00:30 del 19 en Madrid (invierno, UTC+1) y 17:30 del 18 en El Salvador
    const sessions = [s('2026-11-18T23:30:00Z', 25)]
    expect([...focusByDate(sessions, 'Europe/Madrid').keys()]).toEqual(['2026-11-19'])
    expect([...focusByDate(sessions, 'America/El_Salvador').keys()]).toEqual(['2026-11-18'])
  })

  test('sin sesiones, vacío', () => {
    expect(focusByDate([], 'Europe/Madrid').size).toBe(0)
  })
})

describe('weekFocus y recentWeeks', () => {
  const m = focusByDate([s('2026-11-16T09:00:00Z', 30), s('2026-11-18T09:00:00Z', 60), s('2026-11-18T15:00:00Z', 30), s('2026-11-09T09:00:00Z', 20)], 'Europe/Madrid')

  test('semana de lunes a domingo con totales, sesiones y media de días activos', () => {
    const w = weekFocus(m, '2026-11-16')
    expect(w.days.map((d) => d.minutes)).toEqual([30, 0, 90, 0, 0, 0, 0])
    expect(w).toMatchObject({ total: 120, sessions: 3, averageActiveDay: 60 })
  })

  test('semana sin foco: total 0 y sin media', () => {
    expect(weekFocus(m, '2026-10-05')).toMatchObject({ total: 0, sessions: 0, averageActiveDay: null })
  })

  test('las últimas semanas terminan en la indicada', () => {
    const r = recentWeeks(m, '2026-11-16', 3)
    expect(r).toEqual([
      { weekStart: '2026-11-02', minutes: 0 },
      { weekStart: '2026-11-09', minutes: 20 },
      { weekStart: '2026-11-16', minutes: 120 },
    ])
  })
})
