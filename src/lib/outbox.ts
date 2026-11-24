import { del, get, set } from 'idb-keyval'
import { useSyncExternalStore } from 'react'
import type { IsoDate } from './dates'

/**
 * Cola de registros de hábitos hechos sin red. Se guarda en el dispositivo (IndexedDB), se muestra sobre los datos
 * del servidor mientras espera y se envía en orden cuando vuelve la conexión. Solo contiene registros de hábitos:
 * lo demás (hábitos, objetivos, notas…) sigue necesitando red.
 */
export interface PendingLog {
  habitId: string
  date: IsoDate
  /** null o 0 borra el registro. */
  value: number | null
}

const cell = (p: Pick<PendingLog, 'habitId' | 'date'>) => `${p.habitId}|${p.date}`

/** Añade un cambio; si ya había otro sobre la misma casilla (hábito + día), lo reemplaza: manda el último. */
export function coalesce(list: readonly PendingLog[], next: PendingLog): PendingLog[] {
  return [...list.filter((p) => cell(p) !== cell(next)), next]
}

/** Aplica los cambios pendientes sobre los registros del servidor (habitId → fecha → valor). */
export function overlay(record: Record<string, Record<IsoDate, number>>, pending: readonly PendingLog[]): Record<string, Record<IsoDate, number>> {
  if (pending.length === 0) return record
  const out = { ...record }
  for (const p of pending) {
    const byDate = { ...out[p.habitId] }
    if (p.value) byDate[p.date] = p.value
    else delete byDate[p.date]
    out[p.habitId] = byDate
  }
  return out
}

/** Un fallo de red se reintenta más tarde; cualquier otro (p. ej. fuera de plazo) descarta el cambio. */
export function isNetworkFailure(e: unknown): boolean {
  const message = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : ''
  return /failed to fetch|networkerror|load failed|network request failed/i.test(message)
}

// ---- Estado en memoria + persistencia ----
let owner: string | null = null
let items: readonly PendingLog[] = []
let failed = 0
let flushing = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const keyOf = (userId: string) => `segundo-cerebro-outbox:${userId}`

async function persist(): Promise<void> {
  if (!owner) return
  if (items.length === 0) await del(keyOf(owner))
  else await set(keyOf(owner), items)
}

/** Carga lo pendiente de este usuario (al abrir la app con sesión). */
export async function loadOutbox(userId: string): Promise<void> {
  owner = userId
  items = (await get<PendingLog[]>(keyOf(userId))) ?? []
  emit()
}

export function enqueueLog(p: PendingLog): void {
  items = coalesce(items, p)
  emit()
  void persist()
}

export const pendingLogs = (): readonly PendingLog[] => items

/** Al cerrar sesión no queda nada del usuario en el dispositivo. */
export async function clearOutbox(): Promise<void> {
  const prev = owner
  owner = null
  items = []
  failed = 0
  emit()
  if (prev) await del(keyOf(prev))
}

export function dismissFailed(): void {
  failed = 0
  emit()
}

/**
 * Envía lo pendiente en orden. Si la red falla se detiene y lo conserva; si el servidor rechaza un cambio
 * (p. ej. fuera de la ventana de 7 días) lo descarta y lo cuenta. Devuelve cuántos se enviaron.
 */
export async function flushOutbox(send: (p: PendingLog) => Promise<void>): Promise<number> {
  if (flushing || items.length === 0) return 0
  flushing = true
  let sent = 0
  try {
    while (items.length > 0) {
      const head = items[0]
      try {
        await send(head)
        sent++
      } catch (e) {
        if (isNetworkFailure(e)) break
        failed++
      }
      // Si mientras se enviaba la casilla cambió otra vez, ese cambio nuevo sigue en la cola
      items = items.filter((p) => p !== head)
      emit()
      await persist()
    }
  } finally {
    flushing = false
    emit()
  }
  return sent
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => void listeners.delete(cb)
}

export function usePendingLogs(): readonly PendingLog[] {
  return useSyncExternalStore(subscribe, () => items)
}

export function useFailedCount(): number {
  return useSyncExternalStore(subscribe, () => failed)
}
