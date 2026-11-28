import { NavLink } from 'react-router'
import { NavIcon } from './NavIcon'
import { NAV_ITEMS } from './navItems'
import { ThemeToggle } from './ThemeToggle'

/** Barra lateral: solo en pantallas anchas. */
export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <nav className="sidebar" aria-label="Principal">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="sidebar-text">Segundo Cerebro</span>
        <button
          type="button"
          className="sidebar-collapse"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          title={collapsed ? 'Expandir menú' : 'Contraer menú'}
          onClick={onToggle}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M9 4v16" stroke="currentColor" strokeWidth="2" />
            <path d={collapsed ? 'm14 9 3 3-3 3' : 'm17 9-3 3 3 3'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <p className="eyebrow sidebar-label sidebar-text">Menú</p>
      <div className="sidebar-links">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className="sidebar-link">
            <NavIcon d={item.icon} />
            <span className="sidebar-text">{item.label}</span>
          </NavLink>
        ))}
      </div>
      <div className="sidebar-foot">
        <ThemeToggle withLabel />
      </div>
    </nav>
  )
}
