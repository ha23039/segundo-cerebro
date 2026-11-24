import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toMessage } from '../../lib/errors'
import { useAuth } from '../auth/useAuth'
import { useOnline } from '../layout/useOnline'
import { useProfile } from '../profile/useProfile'
import { removeSubscription, savePrefs, saveSubscription } from './api'
import { resolvePrefs, TIME_PATTERN, type ReminderPrefs } from './domain/prefs'
import { currentSubscription, pushSupport, subscribeThisDevice, toRow, unsubscribeThisDevice } from './push'

const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

/** Ajustes, sección Recordatorios: activar los avisos en este dispositivo y elegir cuáles. */
export function RemindersCard() {
  const { session } = useAuth()
  const online = useOnline()
  const queryClient = useQueryClient()
  const profile = useProfile()
  const prefs = resolvePrefs(profile.data?.reminders)
  const support = pushSupport()
  const [error, setError] = useState<string | null>(null)

  const device = useQuery({
    queryKey: ['push-device'],
    queryFn: async () => ((await currentSubscription()) ? true : false),
    enabled: support === 'ok',
    networkMode: 'always',
  })

  const savePrefsMutation = useMutation({
    mutationFn: (next: ReminderPrefs) => savePrefs(session!.user.id, next),
    scope: { id: 'reminder-prefs' },
    // El interruptor cambia al instante; si falla, vuelve a lo guardado
    onMutate: (next) => {
      // Síncrono: el interruptor debe reflejar el toque en ese mismo instante
      const previous = queryClient.getQueryData<Record<string, unknown>>(['profile'])
      if (previous) queryClient.setQueryData(['profile'], { ...previous, reminders: { ...next } })
      void queryClient.cancelQueries({ queryKey: ['profile'] })
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['profile'], ctx.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  })

  const activate = useMutation({
    mutationFn: async () => {
      const sub = await subscribeThisDevice(VAPID_KEY!)
      await saveSubscription(toRow(sub))
      await savePrefs(session!.user.id, { ...prefs, enabled: true })
    },
    onSuccess: () => {
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      void queryClient.invalidateQueries({ queryKey: ['push-device'] })
    },
    onError: (e) => setError(e instanceof Error && e.message === 'permiso-denegado' ? 'denegado' : toMessage(e)),
  })

  const deactivate = useMutation({
    mutationFn: async () => {
      const endpoint = await unsubscribeThisDevice()
      if (endpoint) await removeSubscription(endpoint)
      await savePrefs(session!.user.id, { ...prefs, enabled: false })
    },
    onSuccess: () => {
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      void queryClient.invalidateQueries({ queryKey: ['push-device'] })
    },
    onError: (e) => setError(toMessage(e)),
  })

  const on = prefs.enabled && device.data === true
  const busy = activate.isPending || deactivate.isPending || savePrefsMutation.isPending
  const change = (patch: Partial<ReminderPrefs>) => savePrefsMutation.mutate({ ...prefs, ...patch })

  return (
    <section className="stack" aria-labelledby="recordatorios">
      <h2 id="recordatorios">Recordatorios</h2>

      {!VAPID_KEY && <p className="muted">Los avisos no están configurados en esta instalación (falta la clave pública de notificaciones).</p>}

      {VAPID_KEY && support === 'instalar' && (
        <p className="muted">En iPhone los avisos solo funcionan con la app instalada: abre el menú Compartir de Safari, elige «Añadir a pantalla de inicio» y abre Segundo Cerebro desde ahí.</p>
      )}
      {VAPID_KEY && support === 'sin-soporte' && <p className="muted">Este navegador no admite notificaciones push.</p>}

      {VAPID_KEY && support === 'ok' && (
        <>
          <p className="muted">Te avisamos a la hora de tus hábitos, con un repaso por la tarde y un recordatorio de la revisión semanal.</p>

          <div className="row">
            {on ? (
              <button className="btn" type="button" disabled={busy || !online} onClick={() => deactivate.mutate()}>
                Desactivar en este dispositivo
              </button>
            ) : (
              <button className="btn btn-primary" type="button" disabled={busy || !online || device.isPending} onClick={() => activate.mutate()}>
                Activar avisos
              </button>
            )}
          </div>

          {error === 'denegado' && (
            <p role="alert" className="error">
              Las notificaciones están bloqueadas. Actívalas para Segundo Cerebro en los ajustes del teléfono y vuelve a intentarlo.
            </p>
          )}
          {error && error !== 'denegado' && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {savePrefsMutation.isError && (
            <p role="alert" className="error">
              {toMessage(savePrefsMutation.error)}
            </p>
          )}

          {on && (
            <fieldset className="choice-group" disabled={busy || !online}>
              <legend>Qué avisos quieres</legend>
              <label className="choice">
                <input type="checkbox" checked={prefs.habitTimes} onChange={(e) => change({ habitTimes: e.target.checked })} />
                A la hora de cada hábito (los que tienen horario)
              </label>
              <label className="choice">
                <input type="checkbox" checked={prefs.evening} onChange={(e) => change({ evening: e.target.checked })} />
                Repaso de la tarde con lo que te queda
              </label>
              {prefs.evening && (
                <div>
                  <label htmlFor="evening-time">Hora del repaso</label>
                  <input
                    id="evening-time"
                    type="time"
                    value={prefs.eveningTime}
                    onChange={(e) => TIME_PATTERN.test(e.target.value) && change({ eveningTime: e.target.value })}
                  />
                </div>
              )}
              <label className="choice">
                <input type="checkbox" checked={prefs.review} onChange={(e) => change({ review: e.target.checked })} />
                Revisión semanal (domingo a las 19:00)
              </label>
            </fieldset>
          )}
        </>
      )}
    </section>
  )
}
