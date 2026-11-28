import { useEffect, useState } from 'react'
import { getThemePrefs, setMode } from '../../lib/theme'

function isDarkNow(): boolean {
  const { mode } = getThemePrefs()
  if (mode !== 'auto') return mode === 'dark'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

/** Sol / luna: cambia entre claro y oscuro (Ajustes permite volver a Automático). */
export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const [dark, setDark] = useState(isDarkNow)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const sync = () => setDark(isDarkNow())
    mq?.addEventListener('change', sync)
    return () => mq?.removeEventListener('change', sync)
  }, [])

  const label = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
  return (
    <button
      type="button"
      className={withLabel ? 'btn theme-toggle with-label' : 'btn icon-btn theme-toggle'}
      aria-label={withLabel ? undefined : label}
      title={label}
      onClick={() => {
        setMode(dark ? 'light' : 'dark')
        setDark(!dark)
      }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        {dark ? (
          <path
            d="M12 4V2M12 22v-2M4.9 4.9 3.5 3.5M20.5 20.5l-1.4-1.4M4 12H2M22 12h-2M4.9 19.1l-1.4 1.4M20.5 3.5l-1.4 1.4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          />
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        )}
      </svg>
      {withLabel && <span className="sidebar-text">{dark ? 'Modo claro' : 'Modo oscuro'}</span>}
    </button>
  )
}
