export type FocusKind = 'foco' | 'descanso'

/** Temporizador en curso. Todo el tiempo se calcula con marcas de tiempo: recargar o bloquear el móvil no lo desajusta. */
export interface ActiveTimer {
  /** Id de la sesión, fijado al empezar: guardar dos veces la misma sesión no la duplica. */
  id: string
  kind: FocusKind
  /** Epoch en ms. */
  startedAt: number
  plannedMinutes: number
  habitId: string | null
  goalId: string | null
  /** Epoch en ms si se detuvo antes de tiempo. */
  stoppedAt?: number
}

export const MIN_MINUTES = 1
export const MAX_MINUTES = 240
const MIN_MS = 60_000

/** Milisegundos transcurridos, con tope en lo planificado (si se vuelve tarde, no cuenta el tiempo ocioso). */
export function elapsedMs(t: ActiveTimer, now: number): number {
  const end = t.stoppedAt ?? now
  return Math.min(t.plannedMinutes * MIN_MS, Math.max(0, end - t.startedAt))
}

export function remainingMs(t: ActiveTimer, now: number): number {
  return t.plannedMinutes * MIN_MS - elapsedMs(t, now)
}

/** Terminó: llegó al tiempo planificado o se detuvo. */
export function isFinished(t: ActiveTimer, now: number): boolean {
  return t.stoppedAt !== undefined || remainingMs(t, now) <= 0
}

export interface SessionToSave {
  id: string
  kind: FocusKind
  startedAt: string
  endedAt: string
  plannedMinutes: number
  actualMinutes: number
  habitId: string | null
  goalId: string | null
}

/**
 * La sesión a guardar, o null si duró menos de 1 minuto (se descarta). Los minutos reales son los completos
 * transcurridos; el fin es el inicio más el tiempo contado, no el momento en que se guarda.
 */
export function toSession(t: ActiveTimer, now: number): SessionToSave | null {
  const elapsed = elapsedMs(t, now)
  const actualMinutes = Math.floor(elapsed / MIN_MS)
  if (actualMinutes < MIN_MINUTES) return null
  return {
    id: t.id,
    kind: t.kind,
    startedAt: new Date(t.startedAt).toISOString(),
    endedAt: new Date(t.startedAt + elapsed).toISOString(),
    plannedMinutes: t.plannedMinutes,
    actualMinutes,
    habitId: t.habitId,
    goalId: t.goalId,
  }
}

/** 'MM:SS' (redondea los segundos hacia arriba para que 0:00 solo salga al terminar). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** '1 h 05 min', '25 min'. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')} min`
}

export function clampMinutes(n: number): number {
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(n)))
}

/** Lee un temporizador guardado y lo valida; cualquier dato raro se descarta. */
export function parseTimer(raw: unknown): ActiveTimer | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
  const id = (v: unknown) => v === null || (typeof v === 'string' && v.length > 0 && v.length <= 64)
  if (typeof r.id !== 'string' || r.id.length === 0 || r.id.length > 64) return null
  if (r.kind !== 'foco' && r.kind !== 'descanso') return null
  if (!num(r.startedAt) || !num(r.plannedMinutes)) return null
  if (r.plannedMinutes !== clampMinutes(r.plannedMinutes as number)) return null
  if (!id(r.habitId) || !id(r.goalId)) return null
  if (r.stoppedAt !== undefined && !num(r.stoppedAt)) return null
  return {
    id: r.id,
    kind: r.kind,
    startedAt: r.startedAt as number,
    plannedMinutes: r.plannedMinutes as number,
    habitId: (r.habitId as string | null) ?? null,
    goalId: (r.goalId as string | null) ?? null,
    ...(r.stoppedAt !== undefined ? { stoppedAt: r.stoppedAt as number } : {}),
  }
}
