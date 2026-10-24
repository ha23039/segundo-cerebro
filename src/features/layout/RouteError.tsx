/** Pantalla de error del router (sustituye a la de React Router, que está en inglés). */
export function RouteErrorView() {
  return (
    <main className="page">
      <h1>Algo salió mal</h1>
      <p className="muted">Recarga la app. Si el problema sigue, cierra sesión y vuelve a entrar.</p>
      <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
        Recargar
      </button>
    </main>
  )
}
