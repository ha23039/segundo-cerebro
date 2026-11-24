import { Outlet } from 'react-router'
import { FocusWatcher } from '../focus/FocusWatcher'
import { BottomNav } from './BottomNav'
import { OfflineBanner } from './OfflineBanner'
import { OutboxSync } from './OutboxSync'
import { Sidebar } from './Sidebar'
import './layout.css'

export function AppShell() {
  return (
    <div className="shell">
      <Sidebar />
      <div className="shell-main">
        <OfflineBanner />
        <OutboxSync />
        <FocusWatcher />
        <main className="page">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
