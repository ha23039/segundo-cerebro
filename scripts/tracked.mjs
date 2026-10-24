// Rutas que nunca deben estar en el repo (público): secretos, estado local de herramientas, artefactos.
const FORBIDDEN = [
  /^\.env(\..+)?$/, // .env, .env.local, .env.production.local… (excepto .env.example, abajo)
  /(^|\/)\.wrangler\//,
  /(^|\/)\.claude\//,
  /(^|\/)\.superpowers\//,
  /^supabase\/\.(temp|branches)\//,
  /^(playwright-report|test-results|coverage|dist|node_modules)\//,
  /(^|\/)signing_keys\.json$/,
  /(^|\/)\.DS_Store$/,
  /\.(sqlite|sqlite-shm|sqlite-wal|pem|key)$/,
]
const ALLOWED = [/^\.env\.example$/]

export function forbiddenPaths(paths) {
  return paths.filter((p) => !ALLOWED.some((r) => r.test(p)) && FORBIDDEN.some((r) => r.test(p)))
}
