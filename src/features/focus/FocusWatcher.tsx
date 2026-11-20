import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router'
import { Icon } from '../../components/Icon'
import { useAuth } from '../auth/useAuth'
import { formatClock, isFinished, remainingMs, toSession } from './domain/timer'
import { useSaveSession } from './hooks'
import { setLastResult, useActiveTimer, useNowMs } from './timerStore'

const RETRY_MS = 15_000

/**
 * Vive en toda la app: guarda la sesión en cuanto el temporizador termina (aunque el móvil estuviera bloqueado o
 * la app cerrada) y, mientras corre, muestra un aviso fuera de Hoy y el tiempo en el título de la pestaña.
 */
export function FocusWatcher() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const { timer, clear } = useActiveTimer(userId)
  const save = useSaveSession()
  const now = useNowMs(timer !== null)
  const { pathname } = useLocation()
  const lastAttempt = useRef(0)
  const finished = timer !== null && isFinished(timer, now)

  useEffect(() => {
    if (!timer || !finished || save.isPending) return
    if (Date.now() - lastAttempt.current < RETRY_MS) return
    lastAttempt.current = Date.now()
    const s = toSession(timer, Date.now())
    if (!s) {
      clear()
      setLastResult({ kind: timer.kind, minutes: 0, discarded: true })
      return
    }
    save.mutate(s, {
      onSuccess: () => {
        clear()
        setLastResult({ kind: s.kind, minutes: s.actualMinutes, discarded: false })
      },
    })
  }, [timer, finished, now, save, clear])

  const running = timer !== null && !finished
  useEffect(() => {
    if (!running || !timer) return
    const previous = document.title
    document.title = `${formatClock(remainingMs(timer, now))} · ${timer.kind === 'foco' ? 'Foco' : 'Descanso'}`
    return () => {
      document.title = previous
    }
  }, [running, timer, now])

  if (!running || !timer || pathname === '/') return null
  return (
    <Link to="/" className="focus-banner" aria-label={`${timer.kind === 'foco' ? 'Foco' : 'Descanso'} en curso, quedan ${formatClock(remainingMs(timer, now))}. Ir a Hoy`}>
      <Icon name="clock" size={16} />
      <span>{timer.kind === 'foco' ? 'Foco en curso' : 'Descanso en curso'}</span>
      <span className="focus-banner-time">{formatClock(remainingMs(timer, now))}</span>
    </Link>
  )
}
