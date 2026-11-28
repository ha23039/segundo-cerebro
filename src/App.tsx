import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AuthProvider } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { useAuth } from './features/auth/useAuth'
import { GoalPage } from './features/goals/GoalPage'
import { GoalsPage } from './features/goals/GoalsPage'
import { JournalPage } from './features/journal/JournalPage'
import { NotePage } from './features/journal/NotePage'
import { HabitEditPage } from './features/habits/HabitEditPage'
import { HabitsPage } from './features/habits/HabitsPage'
import { AppShell } from './features/layout/AppShell'
import { ReportPage } from './features/report/ReportPage'
import { ReviewPage } from './features/review/ReviewPage'
import { RouteErrorView } from './features/layout/RouteError'
import { StatsPage } from './features/stats/StatsPage'
import { TablesPage } from './features/tables/TablesPage'
import { TablePage } from './features/tables/TablePage'
import { SettingsPage } from './features/settings/SettingsPage'
import { TodayPage } from './features/today/TodayPage'
import { AppQueryProvider } from './lib/AppQueryProvider'

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <RouteErrorView /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    errorElement: <RouteErrorView />,
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'habitos', element: <HabitsPage /> },
      { path: 'habitos/nuevo', element: <HabitEditPage /> },
      { path: 'habitos/:id/editar', element: <HabitEditPage /> },
      { path: 'objetivos', element: <GoalsPage /> },
      { path: 'objetivos/:id', element: <GoalPage /> },
      { path: 'estadisticas', element: <StatsPage /> },
      { path: 'diario', element: <JournalPage /> },
      { path: 'notas/:id', element: <NotePage /> },
      { path: 'tablas', element: <TablesPage /> },
      { path: 'tablas/:id', element: <TablePage /> },
      { path: 'informe', element: <ReportPage /> },
      { path: 'revision', element: <ReviewPage /> },
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
