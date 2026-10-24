// Revisión rápida de un despliegue, sin credenciales.
// Uso: node scripts/smoke-prod.mjs <url-app> <url-supabase> <publishable-key>
const [appUrl, supabaseUrl, publishableKey] = process.argv.slice(2)
if (!appUrl || !supabaseUrl || !publishableKey) {
  console.error('Uso: node scripts/smoke-prod.mjs <url-app> <url-supabase> <publishable-key>')
  process.exit(1)
}

let failures = 0
async function check(name, fn) {
  try {
    await fn()
    console.log(`✓ ${name}`)
  } catch (e) {
    failures++
    console.log(`✗ ${name}: ${e.message}`)
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

await check('la app responde con HTML', async () => {
  const res = await fetch(appUrl)
  assert(res.ok, `HTTP ${res.status}`)
  assert((res.headers.get('content-type') ?? '').includes('text/html'), 'no es HTML')
})

await check('cabeceras de seguridad (CSP con Supabase)', async () => {
  const res = await fetch(appUrl)
  const csp = res.headers.get('content-security-policy') ?? ''
  assert(csp.includes("default-src 'self'"), 'falta Content-Security-Policy (¿se generó dist/_headers?)')
  assert(csp.includes(new URL(supabaseUrl).origin), 'la CSP no incluye la URL de Supabase')
  assert(res.headers.get('x-content-type-options') === 'nosniff', 'falta X-Content-Type-Options')
})

await check('rutas de la SPA (fallback a index.html)', async () => {
  const res = await fetch(new URL('/habitos', appUrl), { headers: { 'Sec-Fetch-Mode': 'navigate' } })
  assert(res.ok, `HTTP ${res.status}`)
})

await check('manifest de la PWA', async () => {
  const res = await fetch(new URL('/manifest.webmanifest', appUrl))
  assert(res.ok, `HTTP ${res.status}`)
  const m = await res.json()
  assert(m.display === 'standalone', 'display no es standalone')
  assert(m.icons?.some((i) => i.sizes === '512x512'), 'falta icono 512x512')
})

await check('service worker publicado', async () => {
  const res = await fetch(new URL('/sw.js', appUrl))
  assert(res.ok, `HTTP ${res.status}`)
})

await check('los registros públicos están desactivados', async () => {
  const res = await fetch(new URL('/auth/v1/signup', supabaseUrl), {
    method: 'POST',
    headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `intruso-${Date.now()}@example.com`, password: 'una-clave-cualquiera-123' }),
  })
  const body = await res.json().catch(() => ({}))
  assert(!res.ok, `el registro respondió ${res.status}: ¡cualquiera puede crear cuentas!`)
  assert(body.error_code === 'signup_disabled', `respuesta inesperada: ${body.error_code ?? res.status}`)
})

await check('la clave publicada no lee datos sin sesión', async () => {
  const res = await fetch(new URL('/rest/v1/profiles?select=*', supabaseUrl), {
    headers: { apikey: publishableKey },
  })
  const rows = res.ok ? await res.json() : []
  assert(Array.isArray(rows) && rows.length === 0, 'se pudieron leer perfiles sin sesión')
})

console.log(failures ? `\n${failures} comprobación(es) fallida(s)` : '\nTodo correcto')
process.exit(failures ? 1 : 0)
