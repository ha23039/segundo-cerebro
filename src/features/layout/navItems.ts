/** `sidebarOnly`: en el móvil no cabe en la barra inferior (se llega desde Hoy). */
export const NAV_ITEMS: readonly { to: string; label: string; icon: string; sidebarOnly?: boolean }[] = [
  { to: '/', label: 'Hoy', icon: 'M3 12l9-8 9 8M5 10v10h14V10M10 20v-6h4v6' },
  { to: '/habitos', label: 'Hábitos', icon: 'M8 6h13M8 12h13M8 18h13M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2' },
  { to: '/objetivos', label: 'Objetivos', icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01' },
  { to: '/diario', label: 'Diario', icon: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM8 20a3 3 0 0 1-3-3M9 9h6M9 13h6', sidebarOnly: true },
  { to: '/tablas', label: 'Tablas', icon: 'M4 5h16v14H4zM4 11h16M4 15h16M10 5v14' },
  { to: '/estadisticas', label: 'Progreso', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { to: '/ajustes', label: 'Ajustes', icon: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4' },
]
