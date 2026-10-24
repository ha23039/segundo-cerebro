import { useState } from 'react'
import { toMessage } from '../../lib/errors'
import { getThemePrefs, setMode, setPalette, type Mode, type Palette } from '../../lib/theme'
import { useAuth } from '../auth/useAuth'
import { useOnline } from '../layout/useOnline'
import { useProfile } from '../profile/useProfile'
import { DEFAULT_TIMEZONE } from '../profile/useToday'
import { useUpdateTimezone } from '../profile/useUpdateTimezone'

const PALETTES: { value: Palette; label: string }[] = [
  { value: 'indigo', label: 'Índigo' },
  { value: 'oceano', label: 'Océano' },
]

const MODES: { value: Mode; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'auto', label: 'Automático' },
]

function timeZones(current: string): string[] {
  const all = Intl.supportedValuesOf('timeZone')
  return all.includes(current) ? all : [current, ...all]
}

export function SettingsPage() {
  const { signOut } = useAuth()
  const online = useOnline()
  const [prefs, setPrefs] = useState(getThemePrefs)
  const profile = useProfile()
  const updateTimezone = useUpdateTimezone()
  const timezone = profile.data?.timezone ?? DEFAULT_TIMEZONE

  return (
    <>
      <h1>Ajustes</h1>

      <section className="stack" aria-labelledby="apariencia">
        <h2 id="apariencia">Apariencia</h2>
        <fieldset className="choice-group">
          <legend>Paleta</legend>
          {PALETTES.map((p) => (
            <label key={p.value} className="choice">
              <input
                type="radio"
                name="palette"
                value={p.value}
                checked={prefs.palette === p.value}
                onChange={() => {
                  setPalette(p.value)
                  setPrefs(getThemePrefs())
                }}
              />
              {p.label}
            </label>
          ))}
        </fieldset>
        <fieldset className="choice-group">
          <legend>Modo</legend>
          {MODES.map((m) => (
            <label key={m.value} className="choice">
              <input
                type="radio"
                name="mode"
                value={m.value}
                checked={prefs.mode === m.value}
                onChange={() => {
                  setMode(m.value)
                  setPrefs(getThemePrefs())
                }}
              />
              {m.label}
            </label>
          ))}
        </fieldset>
      </section>

      <section className="stack" aria-labelledby="fecha">
        <h2 id="fecha">Fecha y hora</h2>
        <div>
          <label htmlFor="timezone">Zona horaria</label>
          <select
            id="timezone"
            value={timezone}
            disabled={!online || profile.isPending || updateTimezone.isPending}
            onChange={(e) => updateTimezone.mutate(e.target.value)}
          >
            {timeZones(timezone).map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <p role="status" className="muted">
          {updateTimezone.isSuccess ? 'Zona horaria guardada' : ''}
        </p>
        {updateTimezone.isError && (
          <p role="alert" className="error">
            {toMessage(updateTimezone.error)}
          </p>
        )}
      </section>

      <section className="stack" aria-labelledby="cuenta">
        <h2 id="cuenta">Cuenta</h2>
        <button className="btn btn-danger" type="button" onClick={() => void signOut()}>
          Cerrar sesión
        </button>
      </section>
    </>
  )
}
