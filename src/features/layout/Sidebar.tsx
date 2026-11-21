import { NavLink } from 'react-router'
import { NavIcon } from './NavIcon'
import { NAV_ITEMS } from './navItems'
import { ThemeToggle } from './ThemeToggle'

/** Barra lateral: solo en pantallas anchas. */
export function Sidebar() {
  return (
    <nav className="sidebar" aria-label="Principal">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span>Segundo Cerebro</span>
      </div>
      <p className="eyebrow sidebar-label">Menú</p>
      <div className="sidebar-links">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className="sidebar-link">
            <NavIcon d={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
      <div className="sidebar-foot">
        <ThemeToggle withLabel />
      </div>
    </nav>
  )
}
