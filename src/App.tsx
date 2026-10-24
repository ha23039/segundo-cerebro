import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AuthProvider } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { useAuth } from './features/auth/useAuth'
import { HabitsPage } from './features/habits/HabitsPage'
import { AppShell } from './features/layout/AppShell'
import { SettingsPage } from './features/settings/SettingsPage'
import { TodayPage } from './features/today/TodayPage'
import { AppQueryProvider } from './lib/AppQueryProvider'

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'habitos', element: <HabitsPage /> },
      { path: 'ajustes', element: <SettingsPage /> },
    ],
  },
])

function WithQueries() {
  const { session } = useAuth()
  return (
    <AppQueryProvider userId={session?.user.id ?? null}>
      <RouterProvider router={router} />
    </AppQueryProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <WithQueries />
    </AuthProvider>
  )
}
