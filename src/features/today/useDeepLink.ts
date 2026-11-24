import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

/** Acciones que se piden por enlace (`/?accion=foco`): atajos de la app instalada y de la app Atajos de iOS. */
export const DEEP_LINKS = {
  foco: { id: 'foco', focus: 'button' },
  habitos: { id: 'habits-title', focus: null },
} as const

type Action = keyof typeof DEEP_LINKS

const isAction = (v: string | null): v is Action => v !== null && v in DEEP_LINKS

/**
 * Lleva a la tarjeta pedida por `?accion=` cuando ya está en pantalla y limpia el parámetro.
 * Si la tarjeta está oculta (Personalizar) se rinde en silencio tras unos segundos.
 */
export function useDeepLink(): void {
  const [params, setParams] = useSearchParams()
  const raw = params.get('accion')

  useEffect(() => {
    if (!isAction(raw)) return
    const target = DEEP_LINKS[raw]
    let tries = 0
    const timer = window.setInterval(() => {
      const el = document.getElementById(target.id)
      if (el || ++tries > 40) {
        window.clearInterval(timer)
        if (el) {
          const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
          if (target.focus) (el.querySelector(target.focus) as HTMLElement | null)?.focus({ preventScroll: true })
        }
        setParams((p) => {
          const next = new URLSearchParams(p)
          next.delete('accion')
          return next
        }, { replace: true })
      }
    }, 100)
    return () => window.clearInterval(timer)
  }, [raw, setParams])
}
