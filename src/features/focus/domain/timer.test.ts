import { describe, expect, test } from 'vitest'
import { clampMinutes, elapsedMs, formatClock, formatMinutes, isFinished, parseTimer, remainingMs, toSession, type ActiveTimer } from './timer'

const T0 = Date.UTC(2026, 10, 20, 10, 0, 0)
const MIN = 60_000
const timer = (over: Partial<ActiveTimer> = {}): ActiveTimer => ({ id: 'a', kind: 'foco', startedAt: T0, plannedMinutes: 25, habitId: null, goalId: null, ...over })

describe('tiempo del temporizador', () => {
  test('transcurrido y restante salen de las marcas de tiempo', () => {
    const t = timer()
    expect(elapsedMs(t, T0 + 10 * MIN)).toBe(10 * MIN)
    expect(remainingMs(t, T0 + 10 * MIN)).toBe(15 * MIN)
    expect(isFinished(t, T0 + 10 * MIN)).toBe(false)
  })

  test('volver tarde no cuenta el tiempo ocioso: el tope es lo planificado', () => {
    const t = timer()
    expect(elapsedMs(t, T0 + 3 * 60 * MIN)).toBe(25 * MIN)
    expect(remainingMs(t, T0 + 3 * 60 * MIN)).toBe(0)
    expect(isFinished(t, T0 + 25 * MIN)).toBe(true)
  })

  test('un reloj que va hacia atrás no da tiempos negativos', () => {
    expect(elapsedMs(timer(), T0 - 5 * MIN)).toBe(0)
    expect(remainingMs(timer(), T0 - 5 * MIN)).toBe(25 * MIN)
  })

  test('detenido: el tiempo se congela en el momento de parar', () => {
    const t = timer({ stoppedAt: T0 + 7 * MIN + 40_000 })
    expect(elapsedMs(t, T0 + 60 * MIN)).toBe(7 * MIN + 40_000)
    expect(isFinished(t, T0 + MIN)).toBe(true)
  })
})

describe('toSession', () => {
  test('sesión completa: 25 minutos, el fin es inicio + 25', () => {
    const s = toSession(timer(), T0 + 40 * MIN)!
    expect(s).toMatchObject({ actualMinutes: 25, plannedMinutes: 25, kind: 'foco' })
    expect(s.startedAt).toBe(new Date(T0).toISOString())
    expect(s.endedAt).toBe(new Date(T0 + 25 * MIN).toISOString())
  })

  test('detenida a los 7 min 40 s: cuentan 7 minutos completos', () => {
    const s = toSession(timer({ stoppedAt: T0 + 7 * MIN + 40_000 }), T0 + 99 * MIN)!
    expect(s.actualMinutes).toBe(7)
    expect(s.endedAt).toBe(new Date(T0 + 7 * MIN + 40_000).toISOString())
  })

  test('menos de 1 minuto se descarta', () => {
    expect(toSession(timer({ stoppedAt: T0 + 59_000 }), T0 + 5 * MIN)).toBeNull()
    expect(toSession(timer({ stoppedAt: T0 + 60_000 }), T0 + 5 * MIN)).not.toBeNull()
    expect(toSession(timer(), T0 - MIN)).toBeNull()
  })

  test('conserva el id, el tipo y la asociación', () => {
    const s = toSession(timer({ id: 'x1', kind: 'descanso', plannedMinutes: 5, habitId: 'h', goalId: 'g' }), T0 + 5 * MIN)!
    expect(s).toMatchObject({ id: 'x1', kind: 'descanso', actualMinutes: 5, habitId: 'h', goalId: 'g' })
  })
})

describe('formatos y validación', () => {
  test('reloj: los segundos se redondean hacia arriba', () => {
    expect(formatClock(25 * MIN)).toBe('25:00')
    expect(formatClock(24 * MIN + 59_001)).toBe('25:00')
    expect(formatClock(59_000)).toBe('00:59')
    expect(formatClock(1)).toBe('00:01')
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(-5)).toBe('00:00')
  })

  test('minutos legibles', () => {
    expect(formatMinutes(25)).toBe('25 min')
    expect(formatMinutes(60)).toBe('1 h')
    expect(formatMinutes(65)).toBe('1 h 05 min')
  })

  test('clampMinutes acota entre 1 y 240', () => {
    expect([clampMinutes(0), clampMinutes(25.4), clampMinutes(999)]).toEqual([1, 25, 240])
  })

  test('parseTimer acepta lo válido y descarta lo raro', () => {
    expect(parseTimer(timer())).toEqual(timer())
    expect(parseTimer(timer({ stoppedAt: T0 + MIN }))).toEqual(timer({ stoppedAt: T0 + MIN }))
    expect(parseTimer(null)).toBeNull()
    expect(parseTimer('x')).toBeNull()
    expect(parseTimer({ ...timer(), kind: 'siesta' })).toBeNull()
    expect(parseTimer({ ...timer(), plannedMinutes: 0 })).toBeNull()
    expect(parseTimer({ ...timer(), plannedMinutes: 500 })).toBeNull()
    expect(parseTimer({ ...timer(), startedAt: 'ayer' })).toBeNull()
    expect(parseTimer({ ...timer(), id: '' })).toBeNull()
    expect(parseTimer({ ...timer(), habitId: 5 })).toBeNull()
  })
})
