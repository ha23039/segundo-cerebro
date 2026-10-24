interface Window {
  /** Definido por public/theme.js, que se carga en <head>. */
  Tema: {
    palette(p: 'indigo' | 'oceano'): void
    mode(m: 'light' | 'dark' | null): void
  }
}
