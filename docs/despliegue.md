# Despliegue (desde tu ordenador)

Guía para publicar Segundo Cerebro con **Supabase Cloud** (base de datos y login) y **Cloudflare** (la app). Todo se hace desde la carpeta del repo con `npx`; no hace falta instalar nada global.

> **Nunca subas al repo:** `.env*.local`, la *secret key* de Supabase ni la contraseña de la base de datos. El `.gitignore` ya los excluye.

## 0. Requisitos

- Node 24 (`node -v`) y git.
- Cuenta en [supabase.com](https://supabase.com) y en [cloudflare.com](https://dash.cloudflare.com) (plan gratis en ambas).
- Docker **no** hace falta para desplegar (solo para desarrollar en local).

```bash
git clone https://github.com/ha23039/segundo-cerebro.git
cd segundo-cerebro
npm ci
```

## 1. Supabase: crear el proyecto

```bash
npx supabase login                     # abre el navegador
npx supabase orgs list                 # copia el ID de tu organización
npx supabase projects create segundo-cerebro \
  --org-id <ORG_ID> \
  --region eu-west-3                   # París, la más cercana a Madrid
```

Te pedirá una **contraseña de base de datos**: genera una larga y guárdala en tu gestor de contraseñas. Anota el **Reference ID** del proyecto (también lo ves con `npx supabase projects list`).

## 2. Supabase: aplicar el esquema y la configuración

```bash
npx supabase link --project-ref <REF>  # pide la contraseña de la BD
npx supabase db push                   # aplica supabase/migrations/
npx supabase config push               # aplica supabase/config.toml (registros desactivados, contraseña mínima 12)
```

`config push` muestra un diff y pide confirmación. Comprueba que incluye `enable_signup = false` en `[auth]`.

Después, en el panel de Supabase → **Authentication → URL Configuration**, pon como *Site URL* la URL de Cloudflare del paso 4 (puedes volver a este paso al terminar).

## 3. Crear tu cuenta

Copia la URL del proyecto y la **secret key** desde el panel (**Project Settings → API Keys**) o con `npx supabase projects api-keys --project-ref <REF>`.

```bash
SUPABASE_URL=https://<REF>.supabase.co \
SUPABASE_SECRET_KEY=<secret key> \
node scripts/create-user.mjs
```

Pide tu correo y la contraseña dos veces, sin mostrarla. La contraseña no se guarda en ningún archivo. Solo existirá esta cuenta: los registros públicos están desactivados.

## 4. Cloudflare: publicar la app

Crea `.env.production.local` (está ignorado por git) con la URL y la **publishable key** (nunca la secret):

```bash
cat > .env.production.local <<'EOF'
VITE_SUPABASE_URL=https://<REF>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key, empieza por sb_publishable_>
EOF

npx wrangler login                     # abre el navegador
npm run build                          # genera dist/ y dist/_headers (CSP con tu URL de Supabase)
npx wrangler deploy                    # publica en https://segundo-cerebro.<tu-subdominio>.workers.dev
```

## 5. Verificar

```bash
node scripts/smoke-prod.mjs https://segundo-cerebro.<subdominio>.workers.dev \
  https://<REF>.supabase.co <publishable key>
```

Debe terminar en **Todo correcto**. Comprueba que la app responde, que las cabeceras de seguridad y la CSP están presentes, que el manifest y el service worker existen, que nadie puede registrarse y que sin sesión no se lee ningún dato.

Luego, en el iPhone:

1. Abre la URL en **Safari** e inicia sesión.
2. Compartir → **Añadir a pantalla de inicio**.
3. Abre la app desde el icono, recarga y comprueba que sigue la sesión.

## 6. Cada nueva fase

```bash
git pull
npm ci
npx supabase db push                   # migraciones nuevas
npx supabase config push               # solo si cambió supabase/config.toml
npm run build && npx wrangler deploy
node scripts/smoke-prod.mjs …          # mismos argumentos que en el paso 5
```

Al cerrar cada fase te indicaré si hay pasos extra.

| Fase | Pasos extra |
|---|---|
| F0 | Despliegue inicial completo (pasos 1 a 5). |
| F1 | Ninguno: `db push` activa solo las extensiones `btree_gist` y `pg_cron` y programa la purga diaria de la papelera (03:15 UTC). Puedes comprobarla en el panel → **Integrations → Cron**. |

## Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| Login responde «Email logins are disabled» | En `config.toml`, `[auth.email] enable_signup` debe ser `true` (si es `false` apaga el proveedor de correo). Repite `config push`. |
| La app carga en blanco y la consola dice *Refused to connect* | La CSP no tiene tu URL de Supabase: revisa `.env.production.local` y vuelve a hacer `npm run build`. |
| `smoke-prod` falla en «registros públicos» | Falta `npx supabase config push`. |
| Tras desplegar, el iPhone sigue mostrando la versión anterior | Cierra la app del todo y vuelve a abrirla: el service worker se actualiza solo al recargar. |
