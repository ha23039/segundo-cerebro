import { useEffect, useState } from 'react'
import { minutesIn } from '../../lib/dates'
import { DEFAULT_TIMEZONE } from './useToday'
import { useProfile } from './useProfile'

/** Minutos desde medianoche en la zona del perfil; se actualiza cada minuto y al volver a la app. */
export function useNowMinutes(): number {
  const timezone = useProfile().data?.timezone ?? DEFAULT_TIMEZONE
  const [now, setNow] = useState(() => minutesIn(timezone))

  useEffect(() => {
    const update = () => setNow(minutesIn(timezone))
    update()
    const id = window.setInterval(update, 60_000)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', update)
    }
  }, [timezone])

  return now
}
