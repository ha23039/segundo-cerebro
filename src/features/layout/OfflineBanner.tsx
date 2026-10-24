import { useOnline } from './useOnline'

export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <p role="status" className="offline-banner">
      Sin conexión: solo lectura
    </p>
  )
}
