import { queryClient } from '../../lib/queryClient'
import { enqueueLog, flushOutbox, isNetworkFailure, pendingLogs, type PendingLog } from '../../lib/outbox'
import * as api from './api'

/** Envía un registro, o lo deja en la cola si no hay red (o si ya hay cambios esperando: se respeta el orden). */
export async function sendLog(v: PendingLog): Promise<void> {
  if (!navigator.onLine || pendingLogs().length > 0) {
    enqueueLog(v)
    if (navigator.onLine) void syncOutbox()
    return
  }
  try {
    await api.setLog(v.habitId, v.date, v.value)
  } catch (e) {
    if (!isNetworkFailure(e)) throw e
    enqueueLog(v)
  }
}

/** Vacía la cola contra el servidor y vuelve a leer los registros (el servidor manda). */
export async function syncOutbox(): Promise<void> {
  const had = pendingLogs().length > 0
  if (!had) return
  await flushOutbox((p) => api.setLog(p.habitId, p.date, p.value))
  await queryClient.invalidateQueries({ queryKey: ['logs'] })
}
