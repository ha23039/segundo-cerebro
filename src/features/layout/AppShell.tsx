import { Outlet } from 'react-router'
import { FocusWatcher } from '../focus/FocusWatcher'
import { BottomNav } from './BottomNav'
import { OfflineBanner } from './OfflineBanner'
import { Sidebar } from './Sidebar'
import './layout.css'

export function AppShell() {
  return (
    <div className="shell">
      <Sidebar />
      <div className="shell-main">
        <OfflineBanner />
        <FocusWatcher />
        <main className="page">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
