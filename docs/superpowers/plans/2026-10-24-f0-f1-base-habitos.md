# F0 + F1 (Base, Hábitos y Hoy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA instalable con login, tema, Ajustes y despliegue (F0), más hábitos con horario versionado, registro diario, panel Hoy y rachas (F1).

**Architecture:** SPA estática (Vite + React) servida por Cloudflare Workers (static assets). Supabase es el único backend: Postgres con RLS en todas las tablas, RPCs `security invoker` para las operaciones que tocan varias filas, Auth con correo y contraseña. La lógica de fechas, horarios y rachas es TypeScript puro y testeado con Vitest. TanStack Query guarda la caché en IndexedDB para leer sin red. **Esta sesión se ocupa solo del código y del repositorio;** el despliegue lo ejecuta el usuario desde su ordenador siguiendo `docs/despliegue.md`.

**Tech Stack (versiones fijadas, verificadas el 2026-10-24):** vite 8.3.5 · react/react-dom 19.3.1 · typescript **6.0.3** (no 7.x: typescript-eslint 8.72.0 exige `<6.1.0`) · @vitejs/plugin-react 6.1.2 · react-router 8.5.0 · @supabase/supabase-js 2.118.0 · supabase (CLI, devDependency) 2.122.0 · @tanstack/react-query, react-query-persist-client, query-async-storage-persister 5.104.5 · idb-keyval 6.3.0 · zod 4.6.7 · vite-plugin-pwa 2.0.0 (+ workbox-window, @vite-pwa/assets-generator) · vitest 5.0.5 + jsdom 30.1.3 + @testing-library/react 16.3.3 · @playwright/test 1.64.1 · @axe-core/playwright 4.14.0 · eslint 10.13.0 + typescript-eslint 8.72.0 · wrangler 4.152.0. Sin librería de fechas: `Intl.DateTimeFormat` basta.

**Spec:** `docs/spec.md`

## Global Constraints

- Interfaz solo en español. Zona horaria por defecto `Europe/Madrid`; semana de lunes (1) a domingo (7).
- `public/theme.js` y `src/styles/tokens.css` se copian **sin modificar** desde `docs/tema.zip`; `theme.js` se carga en `<head>` antes de cualquier CSS.
- Ningún color literal (hex, `rgb()`, `hsl()`, nombres de color) fuera de `tokens.css` y `tokens-extra.css`; el script `npm run check:colors` falla si aparece uno en `src/`.
- Móvil primero: `viewport-fit=cover`, padding con `env(safe-area-inset-*)`, objetivos táctiles ≥ 44 px (`--tap: 44px`), `font-size: 16px` en inputs, sin scroll horizontal a 320 px.
- RLS activado en todas las tablas de `public`; políticas `to authenticated` con `(select auth.uid()) = user_id` en `using` y `with check`. Las tablas nuevas no se exponen solas a la Data API (cambio de Supabase de 2026-04-28): cada migración hace `grant ... to authenticated` explícito y nada a `anon`.
- RPCs siempre `security invoker`, `set search_path = ''`, `revoke execute ... from public, anon` y `grant execute ... to authenticated`. Nada de `security definer`, salvo el trigger de alta de perfil en el esquema `private`.
- Clave del frontend: solo la **publishable** (`VITE_SUPABASE_PUBLISHABLE_KEY`). La secret key solo existe en `.env.local` (tests) y en GitHub Secrets. `.env*` en `.gitignore`, excepto `.env.example`.
- El texto del usuario se renderiza solo con JSX (escapado). Prohibido `dangerouslySetInnerHTML` en F0–F1.
- Errores visibles con `color: var(--danger)` y mensajes en español; nunca se queda un error silencioso en consola.
- Commits pequeños, en español, con prefijo convencional (`feat:`, `test:`, `chore:`…) y la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Supabase local en una máquina con ~4 GB libres: en `supabase/config.toml` desactivar `storage`, `realtime`, `edge_runtime`, `analytics` e `inbucket`; dejar `db`, `auth`, `api` y `studio`.

## Review Focus

1. **App abierta pasada la medianoche, o reabierta desde segundo plano al día siguiente:** Hoy debe cambiar de fecha sola. → test con `page.clock` en Task 13.
2. **Toques rápidos repetidos sobre un hábito:** el estado final coincide con el servidor, sin errores de clave duplicada. → test en Task 13 (upsert con `onConflict` y mutaciones serializadas por hábito).
3. **Falla la red a mitad de un registro:** el cambio optimista se revierte y aparece un error con `--danger`. → test con `page.route` abortando en Task 13.
4. **Nombres con emoji, `<script>` o 80 caracteres:** se muestran literalmente y no rompen el layout a 320 px. → tests en Task 12.
5. **PWA reabierta tras días con la sesión caducada:** nunca pantalla en blanco; si el refresh falla, redirige a `/login`. → test en Task 4.

---

## Estructura de archivos

```
index.html                      viewport, metas iOS, <script src="/theme.js"> antes del CSS
public/theme.js                 copia literal
public/icon.svg                 fuente de iconos PWA
src/main.tsx, src/App.tsx       arranque y rutas
src/global.d.ts                 tipo de window.Tema
src/styles/{tokens.css, tokens-extra.css, base.css}
src/lib/dates.ts                fechas en zona horaria (puro)
src/lib/theme.ts                envoltorio de window.Tema
src/lib/supabase.ts             cliente tipado
src/lib/database.types.ts       generado con `supabase gen types`
src/lib/queryClient.tsx         QueryClient + persistencia IndexedDB
src/lib/errors.ts               error de Supabase → mensaje en español
src/features/auth/              AuthProvider, LoginPage, RequireAuth
src/features/layout/            AppShell, BottomNav, OfflineBanner
src/features/profile/           useProfile, useToday
src/features/settings/          SettingsPage, TrashSection
src/features/habits/domain/     types.ts, schedule.ts, streaks.ts (puro)
src/features/habits/            schema.ts, api.ts, hooks.ts, HabitForm.tsx, HabitsPage.tsx, HabitEditPage.tsx
src/features/today/             TodayPage.tsx, HabitRow.tsx, DayPicker.tsx
supabase/migrations/*.sql       creadas con `npx supabase migration new <nombre>`
supabase/tests/database/*.sql   pgTAP (`npx supabase test db`)
e2e/*.spec.ts, e2e/helpers.ts   Playwright + axe
scripts/check-no-literal-colors.mjs, scripts/write-headers.mjs, scripts/create-user.mjs
.github/workflows/ci.yml, wrangler.jsonc
```

---

# F0 — Base

### Task 1: Proyecto base y herramientas

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `vitest.config.ts` (o sección `test` en vite.config), `.gitignore`, `.env.example`, `.nvmrc` (`24`), `src/main.tsx`, `src/App.tsx`, `src/App.test.tsx`; Modify `README.md` (cómo levantar el entorno local).

**Interfaces:** Produces los scripts npm `dev`, `build`, `preview`, `lint`, `typecheck` (`tsc -b --noEmit`), `test` (`vitest run`), `e2e` (`playwright test`), `check:colors` y `db:types`, que se usan en todas las tareas siguientes.

- [ ] **Step 1:** Generar el proyecto con `npm create vite@latest . -- --template react-ts` en un directorio temporal y mover los archivos (la carpeta ya tiene `docs/` y `.git`). Fijar exactamente las versiones del Tech Stack: `npm i -E`, sin `^`. Commitear `package-lock.json`.
- [ ] **Step 2:** Test humo `App.test.tsx`: render de `<App/>` con `getByRole('heading', { name: 'Segundo Cerebro' })`. Ejecutar `npm test` → PASS.
- [ ] **Step 3:** Verificar `npm run lint && npm run typecheck && npm run build` → los tres terminan con código 0.
- [ ] **Step 4:** Commit `chore: proyecto base Vite + React + TS con lint y Vitest`.

### Task 2: Fechas en zona horaria

**Files:** Create `src/lib/dates.ts`, `src/lib/dates.test.ts`.

**Interfaces — Produces:**
```ts
export type IsoDate = string;               // 'YYYY-MM-DD'
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO, 1 = lunes
export function todayIn(timeZone: string, now?: Date): IsoDate;
export function addDays(date: IsoDate, n: number): IsoDate;     // aritmética de calendario sobre UTC, nunca sobre la hora local
export function isoWeekday(date: IsoDate): Weekday;
export function startOfWeek(date: IsoDate): IsoDate;            // lunes
export function daysBetween(from: IsoDate, to: IsoDate): number; // to - from en días
export function isValidTimeZone(tz: string): boolean;
```

- [ ] **Step 1: Tests que fallan.**
```ts
expect(todayIn('Europe/Madrid', new Date('2026-10-24T21:59:00Z'))).toBe('2026-10-24'); // 23:59 CEST
expect(todayIn('Europe/Madrid', new Date('2026-10-24T22:00:00Z'))).toBe('2026-10-25'); // 00:00 CEST
expect(todayIn('Europe/Madrid', new Date('2026-10-25T22:59:00Z'))).toBe('2026-10-25'); // 23:59 CET (día de 25 h)
expect(todayIn('Europe/Madrid', new Date('2026-10-25T23:00:00Z'))).toBe('2026-10-26');
expect(todayIn('Europe/Madrid', new Date('2027-03-28T21:59:00Z'))).toBe('2027-03-28'); // día de 23 h
expect(todayIn('Europe/Madrid', new Date('2027-03-28T22:00:00Z'))).toBe('2027-03-29');
expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
expect(isoWeekday('2026-10-25')).toBe(7);           // domingo
expect(startOfWeek('2026-10-25')).toBe('2026-10-19');
expect(startOfWeek('2027-01-01')).toBe('2026-12-28'); // semana que cruza el año
expect(daysBetween('2026-10-19', '2026-10-25')).toBe(6);
expect(isValidTimeZone('Europe/Madrid')).toBe(true);
expect(isValidTimeZone('Marte/Olympus')).toBe(false);
```
- [ ] **Step 2:** `npx vitest run src/lib/dates.test.ts` → FAIL (módulo no existe).
- [ ] **Step 3:** Implementar `todayIn` con `Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' })`; el resto, con `Date.UTC`.
- [ ] **Step 4:** Ejecutar de nuevo → PASS. Commit `feat: utilidades de fecha con zona horaria y tests de cambio de hora`.

### Task 3: Tema, estilos base y control de colores

**Files:** Create `public/theme.js` y `src/styles/tokens.css` (copias literales), `src/styles/tokens-extra.css`, `src/styles/base.css`, `src/lib/theme.ts`, `src/lib/theme.test.ts`, `src/global.d.ts`, `scripts/check-no-literal-colors.mjs`; Modify `index.html`, `src/main.tsx`.

**Interfaces — Produces:**
```ts
export type Palette = 'indigo' | 'oceano';
export type Mode = 'light' | 'dark' | 'auto';
export function getThemePrefs(): { palette: Palette; mode: Mode }; // lee localStorage 'palette'/'theme' con try/catch
export function setPalette(p: Palette): void;  // window.Tema.palette(p) y luego syncThemeColor()
export function setMode(m: Mode): void;        // window.Tema.mode(m === 'auto' ? null : m) y luego syncThemeColor()
export function syncThemeColor(): void;        // <meta name="theme-color"> = valor calculado de --bg
```

- [ ] **Step 1:** `tokens-extra.css` define `--danger` con la misma estructura de selectores que `tokens.css` (claro; oscuro del sistema con `:root:not([data-theme="light"])`; oscuro explícito con `[data-theme="dark"]`): claro `#b91c1c`, oscuro `#f87171`, iguales en las dos paletas. `base.css` define `--tap: 44px`, safe-area, `input, select, textarea { font-size: 16px }`, foco visible con `outline: 2px solid var(--primary)` y `body { background: var(--bg); color: var(--text) }`.
- [ ] **Step 2: Tests que fallan** (`theme.test.ts`, con jsdom y `theme.js` evaluado): `setPalette('oceano')` → `document.documentElement.dataset.palette === 'oceano'` y `getThemePrefs().palette === 'oceano'`; `setMode('dark')` → `dataset.theme === 'dark'`; `setMode('auto')` → `dataset.theme` es `undefined` y `getThemePrefs().mode === 'auto'`; con `localStorage` que lanza una excepción, `getThemePrefs()` devuelve `{ palette: 'indigo', mode: 'auto' }`.
- [ ] **Step 3:** Implementar `theme.ts` → PASS.
- [ ] **Step 4:** `check-no-literal-colors.mjs` recorre `src/**/*.{css,ts,tsx}`, salta `tokens.css` y `tokens-extra.css`, y falla (exit 1, imprimiendo archivo y línea) ante `/#[0-9a-f]{3,8}\b/i`, `rgb(`, `rgba(`, `hsl(`, `hsla(` o nombres de color CSS usados como valor. Comprobarlo: añadir temporalmente `color: red` a `base.css` → exit 1; quitarlo → exit 0.
- [ ] **Step 5:** Commit `feat: tema con paletas y modos, tokens de peligro y control de colores literales`.

### Task 4: Supabase local, perfil y autenticación

**Files:** Create `supabase/config.toml` (con `npx supabase init`), `supabase/migrations/<ts>_profiles.sql`, `supabase/tests/database/profiles.test.sql`, `src/lib/supabase.ts`, `src/lib/database.types.ts`, `src/lib/errors.ts`, `src/lib/queryClient.tsx`, `src/features/auth/{AuthProvider.tsx,LoginPage.tsx,RequireAuth.tsx}`, `src/features/layout/{AppShell.tsx,BottomNav.tsx,OfflineBanner.tsx}`, `src/features/profile/{useProfile.ts,useToday.ts}`, `playwright.config.ts`, `e2e/helpers.ts`, `e2e/auth.spec.ts`, `.env.example`.

**Interfaces — Produces:**
```ts
// src/lib/supabase.ts
export const supabase: SupabaseClient<Database>;
// src/lib/errors.ts
export function toMessage(e: unknown): string; // 'Correo o contraseña incorrectos', 'Sin conexión', 'Fecha fuera de la ventana de edición' (SQLSTATE 23514), genérico 'Algo salió mal, inténtalo de nuevo'
// src/features/auth/AuthProvider.tsx
export function useAuth(): { session: Session | null; loading: boolean; signIn(email: string, password: string): Promise<void>; signOut(): Promise<void> };
// src/features/profile
export function useProfile(): UseQueryResult<{ timezone: string }>;
export function useToday(): IsoDate; // todayIn(profile.timezone); se recalcula cada 60 s y en 'visibilitychange'
// src/lib/queryClient.tsx
export function AppQueryProvider(props: { children: ReactNode }): JSX.Element; // PersistQueryClientProvider + idb-keyval, maxAge 30 días
export async function clearPersistedCache(): Promise<void>;
// e2e/helpers.ts
export async function createTestUser(): Promise<{ email: string; password: string; id: string }>; // admin API con SUPABASE_SECRET_KEY, email_confirm: true, correo único por llamada
export async function login(page: Page, user: { email: string; password: string }): Promise<void>;
export async function expectNoA11yViolations(page: Page): Promise<void>; // axe, falla con impacto 'serious' o 'critical'
```
Rutas: `/login` (pública); dentro de `RequireAuth` + `AppShell`: `/` (Hoy), `/habitos`, `/ajustes`. `BottomNav` con Hoy, Hábitos y Ajustes (cada fase añadirá sus pestañas).

- [ ] **Step 1:** `npm i -D -E supabase@2.122.0`, `npx supabase init`. En `config.toml`: servicios desactivados según Global Constraints, `[auth] site_url = "http://localhost:5173"`, registros desactivados (comprobar el nombre exacto de la clave con la documentación de la versión instalada), `minimum_password_length = 12`. `npx supabase start` y comprobar que los puertos no chocan con los contenedores que ya corren en la máquina.
- [ ] **Step 2: Migración `profiles`** (`npx supabase migration new profiles`):
  - `public.profiles(user_id uuid primary key references auth.users on delete cascade, timezone text not null default 'Europe/Madrid', updated_at timestamptz not null default now())`.
  - Trigger `before insert or update` que valida la zona con `exists (select 1 from pg_timezone_names where name = new.timezone)`.
  - Esquema `private`: función `private.handle_new_user()` `security definer` `set search_path = ''`, trigger `after insert on auth.users`, que inserta el perfil.
  - `private.user_today() returns date`, `security invoker`: `(now() at time zone coalesce((select timezone from public.profiles where user_id = (select auth.uid())), 'Europe/Madrid'))::date`. `grant usage on schema private to authenticated`, `grant execute` solo sobre `user_today`.
  - RLS: select y update propios; sin insert ni delete para `authenticated`. `grant select, update (timezone) on public.profiles to authenticated`.
- [ ] **Step 3: pgTAP** `profiles.test.sql`:
  - Crear dos usuarios en `auth.users`; ambos tienen perfil `Europe/Madrid`.
  - Como usuario A (`set local role authenticated; set local request.jwt.claims = '{"sub":"<A>"}'`), `select count(*) from profiles` = 1.
  - Un update del perfil de B afecta 0 filas.
  - Un update de A con `timezone = 'Marte/Olympus'` lanza error.

  `npx supabase test db` → PASS. Ejecutar `npx supabase db advisors` sin avisos de seguridad.
- [ ] **Step 4:** `npm run db:types` (`supabase gen types typescript --local > src/lib/database.types.ts`). Crear el cliente y `.env.local` desde `npx supabase status -o env`, con la URL, la publishable key y la secret key, esta última solo para los tests.
- [ ] **Step 5: E2E que fallan** (`auth.spec.ts`, proyectos Playwright `chromium` con dispositivo Pixel 7 y `webkit` con iPhone 15; si WebKit no corre en Debian 13, documentarlo y usar Chromium con viewport de iPhone):
  - Sin sesión, `/` redirige a `/login`.
  - Contraseña mala → texto 'Correo o contraseña incorrectos' visible.
  - Login correcto → heading 'Hoy'. Tras `page.reload()` sigue en 'Hoy'.
  - 'Cerrar sesión' en Ajustes → `/login`, y la caché de IndexedDB queda vacía (`indexedDB.databases()` sin la base de la caché o la clave vacía).
  - Review Focus 5: con sesión iniciada, borrar el refresh token de `localStorage`, expirar el access token y recargar → `/login`, no pantalla en blanco.
  - `expectNoA11yViolations` en `/login`.

  Playwright arranca `npm run build && npm run preview -- --port 4173` como `webServer`.
- [ ] **Step 6:** Implementar hasta PASS en los dos proyectos. Commits separados: `feat: migración de perfiles con RLS y tests pgTAP` y `feat: login con correo y contraseña, rutas protegidas y navegación`.

### Task 5: Ajustes (tema y zona horaria)

**Files:** Create `src/features/settings/SettingsPage.tsx`, `e2e/settings.spec.ts`.

**Interfaces — Consumes:** `getThemePrefs/setPalette/setMode` (Task 3), `useProfile` y `useAuth` (Task 4).

- [ ] **Step 1: E2E que fallan:**
  - Elegir 'Océano' → `html[data-palette="oceano"]`; elegir 'Oscuro' → `html[data-theme="dark"]`. Tras recargar, los dos persisten y los controles muestran la selección.
  - 'Automático' quita `data-theme`. Con `page.emulateMedia({ colorScheme: 'dark' })`, el valor calculado de `--bg` es `#0d1017`.
  - Cambiar la zona horaria a 'America/Mexico_City' → tras recargar, sigue seleccionada (se lee de la BD).
  - axe sin violaciones en los 4 combos de paleta × modo explícito.

  Los selectores son grupos de radio accesibles con `fieldset` y `legend`; la zona horaria usa un `select` con `Intl.supportedValuesOf('timeZone')`.
- [ ] **Step 2:** Implementar → PASS. Commit `feat: ajustes de paleta, modo y zona horaria`.

### Task 6: PWA instalable y modo sin conexión

**Files:** Modify `vite.config.ts` y `index.html`; Create `public/icon.svg`, iconos generados en `public/`, `src/features/layout/OfflineBanner.tsx` (si no quedó completo en la Task 4) y `e2e/pwa.spec.ts`.

- [ ] **Step 1:** Configurar `VitePWA` con `registerType: 'autoUpdate'`, `injectRegister: 'script'` (sin scripts inline, por la CSP), `workbox.navigateFallback: '/index.html'` y sin `runtimeCaching` para Supabase.
  - Manifest: `name: 'Segundo Cerebro'`, `short_name: 'Cerebro'`, `lang: 'es'`, `display: 'standalone'`, `start_url: '/'`, `theme_color` y `background_color` con los valores de indigo claro. Es metadato, no CSS, así que el control de colores no lo cubre.
  - Iconos 192, 512 y maskable con `@vite-pwa/assets-generator`.
  - En `index.html`: `apple-touch-icon` 180, `apple-mobile-web-app-capable` y `apple-mobile-web-app-title`.
- [ ] **Step 2: E2E que fallan:**
  - `/manifest.webmanifest` responde 200 con `display === 'standalone'`.
  - Tras cargar y esperar a `navigator.serviceWorker.ready`: `context.setOffline(true)` y `page.reload()` → la app se renderiza (heading 'Hoy' con datos de la caché persistida) y se ve el aviso 'Sin conexión: solo lectura'.
  - Al volver online, el aviso desaparece.
- [ ] **Step 3:** Implementar → PASS. Commit `feat: PWA instalable con service worker y lectura sin conexión`.

### Task 7: CI y configuración de despliegue (sin desplegar)

**Files:** Create `.github/workflows/ci.yml`, `wrangler.jsonc`, `scripts/write-headers.mjs`.

- [ ] **Step 1:** `wrangler.jsonc`: `name: "segundo-cerebro"`, `compatibility_date` de hoy, `assets: { directory: "./dist", not_found_handling: "single-page-application" }`.
- [ ] **Step 2:** `write-headers.mjs` (se ejecuta después de `vite build`) escribe `dist/_headers` con estas cabeceras:
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' <VITE_SUPABASE_URL>; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`

  Comprobarlo: `npm run build && grep connect-src dist/_headers` muestra la URL.
- [ ] **Step 3:** El job `test` de `ci.yml` corre en `push` y `pull_request`, con Node 24, `npm ci`, `lint`, `typecheck`, `check:colors`, `test` y `build`. Después, `supabase/setup-cli` con la versión fijada, `supabase start`, `supabase test db`, `npx playwright install --with-deps` y `npm run e2e`. Si Playwright falla, el reporte se sube como artifact.
- [ ] **Step 4:** Rama `feat/f0`, push y PR. Verificar `gh run watch` → verde. Commit `ci: lint, tipos, tests unitarios, pgTAP y E2E en GitHub Actions`.

### Task 8: Paquete de despliegue (lo ejecuta el usuario desde su ordenador)

**Alcance de esta sesión:** código y repositorio. El despliegue lo hace el usuario en su máquina; aquí no se crean proyectos en la nube ni se usan tokens de Supabase o Cloudflare.

**Files:** Create `docs/despliegue.md`, `scripts/create-user.mjs`, `scripts/smoke-prod.mjs`; Modify `README.md` (enlace a la guía).

- [ ] **Step 1:** `scripts/create-user.mjs` lee `SUPABASE_URL` y `SUPABASE_SECRET_KEY` del entorno, pide el correo y luego la contraseña por consola sin eco (mínimo 12 caracteres, la pide dos veces) y crea el usuario con `auth.admin.createUser({ email_confirm: true })`. Probarlo contra Supabase local: crea el usuario y el login funciona en la app.
- [ ] **Step 2:** `scripts/smoke-prod.mjs <url-app> <url-supabase> <publishable-key>` comprueba, sin credenciales, que la app responde 200, que `dist/_headers` se aplicó (cabecera CSP presente), que `/manifest.webmanifest` es válido y que `POST /auth/v1/signup` es rechazado. Probarlo contra `npm run preview` y Supabase local, donde `signup` también debe estar rechazado.
- [ ] **Step 3:** `docs/despliegue.md`, guía paso a paso con comandos copiables:
  1. Requisitos: Node 24 y `npm ci`; para desplegar no hace falta Docker.
  2. Supabase: `npx supabase login`, `npx supabase projects create segundo-cerebro --region eu-west-3`, `npx supabase link`, `npx supabase db push`, `npx supabase config push` (aplica los registros desactivados) y cómo obtener la URL y la publishable key.
  3. Crear la cuenta: `node scripts/create-user.mjs`.
  4. Cloudflare: `npx wrangler login`, crear `.env.production.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`, `npm run build` y `npx wrangler deploy`.
  5. Ajustar `site_url` del proyecto de Supabase a la URL de Cloudflare.
  6. Verificar: `node scripts/smoke-prod.mjs …`, login desde el iPhone y "Añadir a pantalla de inicio".
  7. Cada nueva fase: `git pull`, `npx supabase db push`, `npm run build`, `npx wrangler deploy`.
  8. Qué no subir nunca al repo: `.env*.local`, la secret key y la contraseña de la BD.
- [ ] **Step 4:** Merge del PR de F0. **Reporte de fase F0** al usuario: implementado / probado / errores corregidos / pendiente, y qué tiene que ejecutar en casa.

---

# F1 — Hábitos, Hoy y rachas

### Task 9: Esquema de hábitos

**Files:** Create `supabase/migrations/<ts>_habits.sql`, `supabase/tests/database/habits.test.sql`; regenerar `src/lib/database.types.ts`.

**Interfaces — Produces** las tablas (todas con `user_id uuid not null default auth.uid() references auth.users on delete cascade`):
- `habits(id uuid pk default gen_random_uuid(), user_id, name text check (char_length(btrim(name)) between 1 and 80), kind text check in ('check','cantidad'), unit text, frequency text check in ('dias','semanal'), days smallint[], times_per_week smallint, target numeric, position int not null default 0, archived_at timestamptz, deleted_at timestamptz, created_at timestamptz default now(), unique (id, user_id))`.
  - `frequency`, `days`, `times_per_week` y `target` son la **plantilla actual**. Sirven para abrir el periodo al desarchivar.
  - Checks:
    - `kind='cantidad'` ⇔ `unit` entre 1 y 20 caracteres y `target > 0 and target <= 100000`.
    - `frequency='dias'` ⇒ `days` no vacío, sin repetidos y con valores de 1 a 7.
    - `frequency='semanal'` ⇒ `times_per_week between 1 and 7`.
- `habit_schedules(id, user_id, habit_id, valid_from date not null, valid_to date check (valid_to is null or valid_to >= valid_from), frequency, days, times_per_week, target)`, con los mismos checks de frecuencia.
  - `foreign key (habit_id, user_id) references habits(id, user_id) on delete cascade`.
  - `exclude using gist (habit_id with =, daterange(valid_from, valid_to, '[]') with &&)`, que necesita `btree_gist`.
- `habit_logs(habit_id, user_id, date date, value numeric not null check (value > 0 and value <= 100000), updated_at timestamptz default now(), primary key (habit_id, date), foreign key (habit_id, user_id) references habits(id, user_id) on delete cascade)`.
  - Índice `(user_id, date)`.
- Trigger `before insert or update or delete` en `habit_logs`: si la fecha (`new.date`, o `old.date` en delete) no está entre `private.user_today() - 7` y `private.user_today()`, `raise exception 'Fecha fuera de la ventana de edición' using errcode = '23514'`.
- `pg_cron`: el job diario `purge-habits-trash` (`15 3 * * *`) borra los `habits` con `deleted_at < now() - interval '30 days'`.
- RLS de cuatro políticas por tabla según Global Constraints, con `grant select, insert, update, delete` a `authenticated`.

- [ ] **Step 1: pgTAP que falla** (`habits.test.sql`):
  - B no ve los hábitos, horarios ni registros de A.
  - B no puede insertar un `habit_log` con el `habit_id` de A, ni con su propio `user_id` (lo impide la FK compuesta).
  - Dos periodos solapados del mismo hábito → error.
  - Un registro con fecha de hoy pasa; hoy − 7 pasa; hoy − 8 falla con SQLSTATE 23514; mañana falla.
  - Borrar un registro de hoy − 8 falla.
  - `value = 0` falla.
  - Un hábito `cantidad` sin `target` falla.
- [ ] **Step 2:** `npx supabase test db` → FAIL. Escribir la migración → PASS. `supabase db advisors` limpio. `npm run db:types`.
- [ ] **Step 3:** Commit `feat: esquema de hábitos con horarios versionados, registros y RLS`.

### Task 10: RPCs de hábitos

**Files:** Create `supabase/migrations/<ts>_habit_rpcs.sql`, `supabase/tests/database/habit_rpcs.test.sql`.

**Interfaces — Produces** (todas `security invoker`, usan `private.user_today()` como "hoy", nunca una fecha enviada por el cliente):
- `create_habit(p_name text, p_kind text, p_unit text, p_frequency text, p_days smallint[], p_times_per_week smallint, p_target numeric) returns uuid`. Inserta el hábito con `position = max + 1` y un periodo desde hoy.
- `update_habit(p_habit_id uuid, p_name text, p_unit text, p_frequency text, p_days smallint[], p_times_per_week smallint, p_target numeric) returns void`.
  - Actualiza nombre, unidad y plantilla.
  - Si la frecuencia o la meta cambian y el hábito no está archivado: si el periodo abierto empezó hoy, lo actualiza en su sitio; si no, lo cierra con `valid_to = hoy - 1` e inserta uno nuevo desde hoy.
  - `kind` no se puede cambiar.
- `archive_habit(p_habit_id uuid) returns void`. Pone `archived_at = now()`. Si el periodo abierto empezó hoy, lo borra; si no, `valid_to = hoy - 1`.
- `unarchive_habit(p_habit_id uuid) returns void`. Pone `archived_at = null` e inserta un periodo desde hoy con la plantilla.
- `move_habit(p_habit_id uuid, p_direction text) returns void`. Con `'up'` o `'down'`, intercambia la posición con el vecino no borrado ni archivado.

- [ ] **Step 1: pgTAP que falla:**
  - `create_habit` deja un periodo `[hoy, null]`.
  - `update_habit` con días distintos el mismo día deja un solo periodo con los días nuevos.
  - Con un periodo creado hace 10 días (insertado a mano en el test), `update_habit` deja dos periodos: `[hoy-10, hoy-1]` y `[hoy, null]`.
  - `archive_habit` + `unarchive_habit` el mismo día que la creación → un periodo `[hoy, null]` con la plantilla.
  - Usuario B llamando a `update_habit` sobre el hábito de A → 0 filas afectadas o error, y el hábito de A no cambia.
  - `anon` no tiene `execute`.
- [ ] **Step 2:** Implementar → PASS, advisors limpio, `db:types`. Commit `feat: RPCs para crear, editar, archivar y ordenar hábitos`.

### Task 11: Dominio de hábitos (horario y rachas)

**Files:** Create `src/features/habits/domain/{types.ts,schedule.ts,streaks.ts}` y sus `*.test.ts`.

**Interfaces — Produces:**
```ts
export type Frequency = { kind: 'dias'; days: Weekday[] } | { kind: 'semanal'; timesPerWeek: number };
export interface SchedulePeriod { validFrom: IsoDate; validTo: IsoDate | null; frequency: Frequency; target: number | null }
export interface Habit { id: string; name: string; kind: 'check' | 'cantidad'; unit: string | null; position: number;
  template: { frequency: Frequency; target: number | null }; schedules: SchedulePeriod[]; archivedAt: string | null }
export type LogsByDate = Map<IsoDate, number>;
export interface Streak { value: number; unit: 'dias' | 'semanas' }
// schedule.ts
export function periodAt(h: Habit, date: IsoDate): SchedulePeriod | null;
export function isScheduledDay(h: Habit, date: IsoDate): boolean;   // solo 'dias'
export function isDone(h: Habit, p: SchedulePeriod, value: number | undefined): boolean; // check: value>0; cantidad: value >= p.target
export function weekDoneCount(h: Habit, logs: LogsByDate, weekStart: IsoDate): number; // días hechos dentro de periodos 'semanal'
export function isDueOn(h: Habit, logs: LogsByDate, date: IsoDate): boolean;
// streaks.ts
export function currentStreak(h: Habit, logs: LogsByDate, today: IsoDate): Streak | null; // null si está archivado
```
Reglas que fijan los tests:
- `isDueOn` en `dias`: `isScheduledDay`. En `semanal`: hay periodo en `date` y (`weekDoneCount < N` o el día `date` está hecho). Así un hábito ya cumplido sigue visible el día en que se marcó, para poder desmarcarlo.
- La racha toma la unidad del periodo actual. Al recorrer hacia atrás, se detiene al llegar a un periodo de otra frecuencia o a una fecha anterior al primer `validFrom`.
- `dias`: los días no programados se saltan. Hoy sin hacer se salta. Cualquier otro día programado sin hacer detiene la racha.
- `semanal`: la semana actual suma 1 si ya tiene ≥ N y, si no, se salta. Una semana anterior es **parcial** si un periodo empieza después de su lunes o termina antes de su domingo: suma 1 si llegó a N y, si no, se salta. Una semana completa suma 1 con ≥ N y, si no, detiene la racha. N es el del periodo vigente el último día activo de esa semana.

- [ ] **Step 1: Tests que fallan.** Los casos llevan fechas fijas, con hoy = '2026-10-28' (miércoles):
  - `dias` L-M-V creado el 2026-10-05, hecho todos los lunes, miércoles y viernes del 5 al 26, y hoy sin hacer → racha 10 días (hoy no rompe).
  - El mismo caso con el viernes 2026-10-23 sin hacer → racha 1 (solo el lunes 26).
  - Un fin de semana sin registros no rompe una racha diaria L-V.
  - Cambio de L-M-V a L-V el 2026-10-26 (dos periodos): el martes 2026-10-20 no cuenta como fallo.
  - `semanal` N=3 creado el lunes 2026-10-05: las tres semanas anteriores con 3 o más y la actual con 1 → 3 semanas. Con la semana del 2026-10-12 en 2 → 1 semana.
  - `semanal` creado el jueves 2026-10-15 con 1 hecho esa semana → la semana parcial no rompe. Si en esa semana llegó a 3, suma.
  - `cantidad` con meta 8: valor 5 → no hecho; valor 8 → hecho.
  - Archivado → `currentStreak` es `null` e `isDueOn` es `false`.
  - Semana que cruza el año (2026-12-28 a 2027-01-03) calculada correctamente.
  - `isDueOn` `semanal` N=2 con 2 hechos (lunes y hoy) → `true` hoy y `false` el jueves.
- [ ] **Step 2:** Ejecutar → FAIL. Implementar → PASS. Commit `feat: dominio de hábitos con horarios versionados y rachas`.

### Task 12: Lista y formulario de hábitos

**Files:** Create `src/features/habits/{schema.ts,schema.test.ts,api.ts,hooks.ts,HabitForm.tsx,HabitsPage.tsx,HabitEditPage.tsx}`, `e2e/habits.spec.ts`.

**Interfaces — Produces:**
```ts
// schema.ts (zod; mensajes en español)
export const habitInputSchema; export type HabitInput = z.infer<typeof habitInputSchema>;
// { name: string(trim 1..80); kind: 'check'|'cantidad'; unit?: string(1..20); frequency: Frequency; target?: number(>0, <=100000) }
// api.ts — mapea filas de BD ↔ dominio; lanza errores que entiende toMessage()
export function fetchHabits(): Promise<Habit[]>;           // deleted_at is null, ordenado por position, con schedules
export function fetchDeletedHabits(): Promise<Habit[]>;
export function fetchLogs(from: IsoDate, to: IsoDate): Promise<Map<string, LogsByDate>>; // pagina con .range() de 1000 en 1000
export function createHabit(i: HabitInput): Promise<string>;
export function updateHabit(id: string, i: HabitInput): Promise<void>;
export function archiveHabit(id: string): Promise<void>; export function unarchiveHabit(id: string): Promise<void>;
export function deleteHabit(id: string): Promise<void>;  export function restoreHabit(id: string): Promise<void>;
export function moveHabit(id: string, dir: 'up' | 'down'): Promise<void>;
export function setLog(habitId: string, date: IsoDate, value: number | null): Promise<void>; // null/0 → delete; si no, upsert onConflict 'habit_id,date'
// hooks.ts — claves de query: ['habits'], ['habits','deleted'], ['logs', from, to]
export function useHabits(); export function useDeletedHabits(); export function useLogs(from: IsoDate, to: IsoDate);
export function useHabitMutations(); // create/update/archive/unarchive/delete/restore/move; invalidan ['habits']
```

- [ ] **Step 1: Tests de `schema.test.ts`:**
  - Nombre '   ' → error 'Escribe un nombre'.
  - 81 caracteres → error.
  - `dias` sin días → 'Elige al menos un día'.
  - `semanal` con 8 → error.
  - `cantidad` sin unidad o sin meta → error.
  - Un input válido pasa.
- [ ] **Step 2: E2E que fallan** (`habits.spec.ts`):
  - Crear 'Leer' (check, L-M-V) → aparece en la lista. Tras recargar, sigue.
  - Crear 'Agua' (cantidad, meta 8, unidad 'vasos', semanal 5).
  - Editar 'Leer' a L-V → sigue en la lista con 'L-V'.
  - Archivar 'Leer' → pasa a la sección 'Archivados'. Desarchivar → vuelve.
  - 'Bajar' y 'Subir' cambian el orden, y el orden persiste tras recargar.
  - Borrar → desaparece y se puede restaurar desde Ajustes (Task 14).
  - Review Focus 4: el nombre `<script>alert(1)</script> 🧠` se muestra literal (`getByText`), sin diálogo. Un nombre de 80 caracteres a 320 px de ancho no causa scroll horizontal (`document.documentElement.scrollWidth <= 320`).
  - Enviar el formulario vacío muestra los errores con `role="alert"`.
  - axe sin violaciones en la lista y en el formulario.
- [ ] **Step 3:** Implementar → PASS. Commits: `feat: validación y API de hábitos` y `feat: pantalla de hábitos con alta, edición, archivo y orden`.

### Task 13: Panel Hoy

**Files:** Create `src/features/today/{TodayPage.tsx,HabitRow.tsx,DayPicker.tsx}`, `e2e/today.spec.ts`.

**Interfaces — Consumes:** `useToday` (Task 4); `useHabits`, `useLogs` y `setLog` (Task 12); `isDueOn`, `isDone`, `periodAt` y `currentStreak` (Task 11).

Comportamiento:
- `DayPicker` ofrece hoy y los 7 días anteriores. La fecha elegida no se guarda: al reabrir vuelve a hoy.
- La lista muestra los hábitos con `isDueOn` en la fecha elegida.
  - `check`: botón con `aria-pressed`.
  - `cantidad`: botones − y + de 1 en 1, más un input numérico que guarda al perder el foco o al pulsar Enter, mostrando `valor / meta unidad`.
- Cada fila muestra la racha ('🔥 9 días', '3 semanas'). Es texto; el emoji se acompaña de un `aria-label`.
- Mutación optimista sobre `['logs', …]`, con rollback y mensaje de `toMessage()` en un `role="alert"`. Las mutaciones de un mismo hábito se serializan con `scope: { id: habitId }`.
- Sin red, los controles quedan deshabilitados.
- Las rachas necesitan los registros desde el primer `validFrom` de cada hábito, que se piden con `fetchLogs`.
- Estado vacío: 'No tienes hábitos para este día', con un enlace a crear.
- Los demás bloques de Hoy que pide la spec (minutos de foco, objetivos que vencen en ≤ 7 días, acceso al diario) se añaden en F3, F4 y F5, cuando existan sus datos. En F1 no hay marcadores de posición.

- [ ] **Step 1: E2E que fallan:**
  - Marcar 'Leer' → `aria-pressed="true"`. Tras recargar sigue marcado y la racha muestra '1 día'.
  - Desmarcar → la racha vuelve a 0.
  - 'Agua': pulsar + 3 veces → '3 / 8 vasos'. Escribir 8 y Enter → hecho. Tras recargar, '8 / 8'.
  - Elegir ayer en `DayPicker` y marcar → al volver a hoy, el registro de ayer persiste. El selector no ofrece hoy − 8.
  - Review Focus 1: `page.clock.install({ time: <próxima medianoche de Madrid − 2 min> })`, calculada desde la hora real para que los periodos creados por el servidor sigan vigentes; avanzar 3 min → el encabezado pasa al día siguiente y la lista cambia, sin recargar.
  - Review Focus 2: 5 clics rápidos sobre 'Leer' → tras estabilizarse, el estado de la UI coincide con el de la BD, comprobado recargando, y no hay alertas de error.
  - Review Focus 3: `page.route('**/rest/v1/habit_logs*', r => r.abort())`, marcar → el botón vuelve a `aria-pressed="false"` y aparece el mensaje de error.
  - Sin hábitos → estado vacío.
  - axe sin violaciones.
- [ ] **Step 2:** Implementar → PASS. Commit `feat: panel Hoy con registro rápido, rachas y corrección de 7 días`.

### Task 14: Papelera en Ajustes

**Files:** Create `src/features/settings/TrashSection.tsx`, `e2e/trash.spec.ts`; Modify `SettingsPage.tsx`.

- [ ] **Step 1: E2E que fallan:**
  - Un hábito borrado aparece en 'Papelera' con el texto 'se elimina definitivamente el <fecha>' (borrado + 30 días).
  - 'Restaurar' → vuelve a Hábitos con sus registros intactos (su racha en Hoy no cambia).
  - axe sin violaciones.
- [ ] **Step 2:** Implementar → PASS. Commit `feat: papelera de hábitos con restauración`.

### Task 15: Cierre de F1

- [ ] **Step 1:** Ejecutar la suite completa en local (`lint`, `typecheck`, `check:colors`, `test`, `supabase test db`, `e2e`) y en CI, y adjuntar los resultados.
- [ ] **Step 2:** Merge a `main`. Actualizar `docs/despliegue.md` si la fase añadió algún paso (por ejemplo, la extensión `pg_cron`). La verificación en producción la hace el usuario con `scripts/smoke-prod.mjs` y su iPhone.
- [ ] **Step 3:** **Reporte de fase F1:** implementado / probado / errores corregidos / pendiente.
