import { Outlet } from 'react-router'
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
        <main className="page">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
