import { Outlet } from 'react-router'
import { BottomNav } from './BottomNav'
import { OfflineBanner } from './OfflineBanner'
import './layout.css'

export function AppShell() {
  return (
    <div className="shell">
      <OfflineBanner />
      <main className="page">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
