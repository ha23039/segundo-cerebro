/** Preferencias de recordatorios (`profiles.reminders`). Sin `enabled` no se envía nada. */
export interface ReminderPrefs {
  enabled: boolean
  /** Avisar a la hora de inicio de los hábitos que la tienen. */
  habitTimes: boolean
  /** Repaso de la tarde: cuántos hábitos quedan. */
  evening: boolean
  eveningTime: string
  /** Domingo a las 19:00 si aún no hiciste la revisión semanal. */
  review: boolean
}

export const DEFAULT_PREFS: ReminderPrefs = { enabled: false, habitTimes: true, evening: true, eveningTime: '21:00', review: true }

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

/** Lee lo guardado con tolerancia: lo que falte o no tenga el tipo esperado toma el valor por defecto. */
export function resolvePrefs(raw: unknown): ReminderPrefs {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const bool = (k: keyof ReminderPrefs, fallback: boolean) => (typeof r[k] === 'boolean' ? (r[k] as boolean) : fallback)
  return {
    enabled: bool('enabled', DEFAULT_PREFS.enabled),
    habitTimes: bool('habitTimes', DEFAULT_PREFS.habitTimes),
    evening: bool('evening', DEFAULT_PREFS.evening),
    eveningTime: typeof r.eveningTime === 'string' && TIME_PATTERN.test(r.eveningTime) ? r.eveningTime : DEFAULT_PREFS.eveningTime,
    review: bool('review', DEFAULT_PREFS.review),
  }
}
