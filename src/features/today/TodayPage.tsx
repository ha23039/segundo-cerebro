import { formatLongDate } from '../../lib/dates'
import { useToday } from '../profile/useToday'

export function TodayPage() {
  const today = useToday()
  return (
    <>
      <h1>Hoy</h1>
      <p className="muted">{formatLongDate(today)}</p>
    </>
  )
}
