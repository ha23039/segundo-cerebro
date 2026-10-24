import { useAuth } from '../auth/useAuth'

export function SettingsPage() {
  const { signOut } = useAuth()
  return (
    <>
      <h1>Ajustes</h1>
      <section className="stack">
        <button className="btn btn-danger" type="button" onClick={() => void signOut()}>
          Cerrar sesión
        </button>
      </section>
    </>
  )
}
