export type Palette = 'indigo' | 'oceano'
export type Mode = 'light' | 'dark' | 'auto'

// Mismas claves que usa public/theme.js
function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function getThemePrefs(): { palette: Palette; mode: Mode } {
  const palette = read('palette') === 'oceano' ? 'oceano' : 'indigo'
  const theme = read('theme')
  const mode = theme === 'light' || theme === 'dark' ? theme : 'auto'
  return { palette, mode }
}

export function setPalette(p: Palette): void {
  window.Tema.palette(p)
  syncThemeColor()
}

export function setMode(m: Mode): void {
  window.Tema.mode(m === 'auto' ? null : m)
  syncThemeColor()
}

/** Ajusta la barra de estado del navegador o del iPhone al fondo actual. */
export function syncThemeColor(): void {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  if (!bg) return
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.append(meta)
  }
  meta.content = bg
}
