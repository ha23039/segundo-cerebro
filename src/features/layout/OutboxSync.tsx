import { useEffect } from 'react'
import { loadOutbox, usePendingLogs } from '../../lib/outbox'
import { syncOutbox } from '../habits/sync'
import { useAuth } from '../auth/useAuth'
import { useOnline } from './useOnline'

/** Carga la cola del dispositivo y la envía cuando hay red (al volver la conexión y cada 30 s si queda algo). */
export function OutboxSync() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const online = useOnline()
  const pending = usePendingLogs().length

  useEffect(() => {
    if (userId) void loadOutbox(userId).then(() => (navigator.onLine ? syncOutbox() : undefined))
  }, [userId])

  useEffect(() => {
    if (!userId || !online) return
    void syncOutbox()
    if (pending === 0) return
    const t = window.setInterval(() => void syncOutbox(), 30_000)
    return () => window.clearInterval(t)
  }, [userId, online, pending])

  return null
}
