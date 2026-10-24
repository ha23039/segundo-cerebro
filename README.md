# Segundo Cerebro

App personal de hábitos y disciplina diaria (PWA para iPhone). Spec: [`docs/spec.md`](docs/spec.md).

## Desarrollo local

Requisitos: Node 24 y Docker.

```bash
npm ci
npx supabase start          # Supabase local (Docker)
cp .env.example .env.local  # y rellena con `npx supabase status -o env`
npm run dev
```

## Comprobaciones

```bash
npm run lint && npm run typecheck && npm run check:colors && npm test
npx supabase test db        # tests de base de datos (pgTAP, RLS)
npm run e2e                 # Playwright + axe
```

## Despliegue

Supabase Cloud + Cloudflare, paso a paso: [`docs/despliegue.md`](docs/despliegue.md).
