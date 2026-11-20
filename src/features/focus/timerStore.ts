import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { clampMinutes, parseTimer, type ActiveTimer, type FocusKind } from './domain/timer'

/**
 * El temporizador en curso vive en localStorage (por usuario): sobrevive a recargas y es el mismo para todas las
 * pestañas. Si el almacenamiento no está disponible, se mantiene en memoria mientras dure la sesión.
 */
const memory = new Map<string, string>()
const listeners = new Set<() => void>()
let cache: { key: string; raw: string | null; value: ActiveTimer | null } | null = null

const timerKey = (userId: string) => `sc:focus:timer:${userId}`
const prefsKey = (userId: string) => `sc:focus:prefs:${userId}`

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return memory.get(key) ?? null
  }
}

function writeRaw(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    if (value === null) memory.delete(key)
    else memory.set(key, value)
  }
  listeners.forEach((l) => l())
}

function snapshot(key: string): ActiveTimer | null {
  const raw = readRaw(key)
  if (cache && cache.key === key && cache.raw === raw) return cache.value
  let value: ActiveTimer | null = null
  if (raw) {
    try {
      value = parseTimer(JSON.parse(raw))
    } catch {
      value = null
    }
  }
  cache = { key, raw, value }
  return value
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith('sc:focus:timer:')) cb()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', onStorage)
  }
}

export interface StartOptions {
  kind: FocusKind
  plannedMinutes: number
  habitId: string | null
  goalId: string | null
}

export function useActiveTimer(userId: string | null) {
  const key = userId ? timerKey(userId) : ''
  const timer = useSyncExternalStore(subscribe, () => (key ? snapshot(key) : null), () => null)

  const start = useCallback(
    (o: StartOptions) => {
      if (!key) return
      const t: ActiveTimer = { id: crypto.randomUUID(), kind: o.kind, startedAt: Date.now(), plannedMinutes: clampMinutes(o.plannedMinutes), habitId: o.habitId, goalId: o.goalId }
      writeRaw(key, JSON.stringify(t))
    },
    [key],
  )
  const stop = useCallback(() => {
    const t = key ? snapshot(key) : null
    if (key && t && t.stoppedAt === undefined) writeRaw(key, JSON.stringify({ ...t, stoppedAt: Date.now() }))
  }, [key])
  const clear = useCallback(() => {
    if (key) writeRaw(key, null)
  }, [key])

  return { timer, start, stop, clear }
}

/** Reloj de pared que se actualiza cada segundo y al volver a la pestaña; parado si `active` es false. */
export function useNowMs(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const update = () => setNow(Date.now())
    update()
    const id = window.setInterval(update, 1000)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', update)
    }
  }, [active])
  return now
}

export interface FocusPrefs {
  focusMinutes: number
  breakMinutes: number
}
export const DEFAULT_PREFS: FocusPrefs = { focusMinutes: 25, breakMinutes: 5 }

export function loadPrefs(userId: string): FocusPrefs {
  try {
    const raw = readRaw(prefsKey(userId))
    if (!raw) return DEFAULT_PREFS
    const p = JSON.parse(raw) as Partial<FocusPrefs>
    return {
      focusMinutes: typeof p.focusMinutes === 'number' ? clampMinutes(p.focusMinutes) : DEFAULT_PREFS.focusMinutes,
      breakMinutes: typeof p.breakMinutes === 'number' ? clampMinutes(p.breakMinutes) : DEFAULT_PREFS.breakMinutes,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function savePrefs(userId: string, p: FocusPrefs) {
  try {
    localStorage.setItem(prefsKey(userId), JSON.stringify(p))
  } catch {
    memory.set(prefsKey(userId), JSON.stringify(p))
  }
}

/** Resultado de la última sesión guardada, para ofrecer el descanso. Solo en memoria. */
export interface FocusResult {
  kind: FocusKind
  minutes: number
  discarded: boolean
}
let lastResult: FocusResult | null = null
const resultListeners = new Set<() => void>()
export function setLastResult(r: FocusResult | null) {
  lastResult = r
  resultListeners.forEach((l) => l())
}
export function useLastResult(): FocusResult | null {
  return useSyncExternalStore(
    (cb) => {
      resultListeners.add(cb)
      return () => resultListeners.delete(cb)
    },
    () => lastResult,
    () => null,
  )
}
