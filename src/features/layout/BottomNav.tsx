import { NavLink } from 'react-router'

const ITEMS = [
  { to: '/', label: 'Hoy', icon: 'M4 12l8-8 8 8M6 10v10h12V10' },
  { to: '/habitos', label: 'Hábitos', icon: 'M5 12l4 4L19 6' },
  { to: '/ajustes', label: 'Ajustes', icon: 'M12 8a4 4 0 100 8 4 4 0 000-8zM4 12h2M18 12h2M12 4v2M12 18v2' },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Principal">
      {ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === '/'} className="bottom-nav-item">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d={item.icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
