import { NavLink } from 'react-router'
import { NavIcon } from './NavIcon'
import { NAV_ITEMS } from './navItems'

/** Navegación inferior: solo en pantallas estrechas (en anchas manda la barra lateral). */
export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Principal">
      {NAV_ITEMS.filter((i) => !i.sidebarOnly).map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === '/'} className="bottom-nav-item">
          <NavIcon d={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
