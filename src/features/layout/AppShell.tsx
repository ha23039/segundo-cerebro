import { useState } from 'react'
import { Outlet, useMatch } from 'react-router'
import { FocusWatcher } from '../focus/FocusWatcher'
import { BottomNav } from './BottomNav'
import { OfflineBanner } from './OfflineBanner'
import { OutboxSync } from './OutboxSync'
import { Sidebar } from './Sidebar'
import './layout.css'

const COLLAPSE_KEY = 'sc.sidebar.collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  // Las hojas necesitan todo el ancho disponible
  const wide = useMatch('/tablas/:id') !== null

  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        /* sin almacenamiento: solo dura esta sesión */
      }
      return !c
    })
  }

  return (
    <div className={`shell${collapsed ? ' is-collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="shell-main">
        <OfflineBanner />
        <OutboxSync />
        <FocusWatcher />
        <main className={`page${wide ? ' page-wide' : ''}`}>
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
