import { useEffect, useState } from 'react'
import { todayIn, type IsoDate } from '../../lib/dates'
import { useProfile } from './useProfile'

export const DEFAULT_TIMEZONE = 'Europe/Madrid'

/** Fecha de hoy en la zona del perfil. Se actualiza sola al pasar la medianoche o al volver a la app. */
export function useToday(): IsoDate {
  const timezone = useProfile().data?.timezone ?? DEFAULT_TIMEZONE
  const [today, setToday] = useState(() => todayIn(timezone))

  useEffect(() => {
    const update = () => setToday(todayIn(timezone))
    update()
    const id = window.setInterval(update, 60_000)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', update)
    }
  }, [timezone])

  return today
}
