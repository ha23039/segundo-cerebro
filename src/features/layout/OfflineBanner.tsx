import { dismissFailed, useFailedCount, usePendingLogs } from '../../lib/outbox'
import { useOnline } from './useOnline'

const plural = (n: number) => (n === 1 ? '1 cambio' : `${n} cambios`)

export function OfflineBanner() {
  const online = useOnline()
  const pending = usePendingLogs().length
  const failed = useFailedCount()
  return (
    <>
      {!online && (
        <p role="status" className="offline-banner">
          Sin conexión: puedes marcar hábitos y se guardarán al volver
          {pending > 0 && ` (${pending === 1 ? '1 cambio pendiente' : `${pending} cambios pendientes`})`}
        </p>
      )}
      {online && pending > 0 && (
        <p role="status" className="offline-banner is-info">
          Guardando {plural(pending)} hechos sin conexión…
        </p>
      )}
      {failed > 0 && (
        <p role="alert" className="offline-banner is-error">
          {plural(failed)} hechos sin conexión no se pudieron guardar (fuera del plazo de 7 días).{' '}
          <button type="button" className="link-btn" onClick={dismissFailed}>
            Entendido
          </button>
        </p>
      )}
    </>
  )
}
