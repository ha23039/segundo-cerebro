import { expect, test } from 'vitest'
import { forbiddenPaths } from './tracked.mjs'

test('detecta archivos locales y secretos rastreados', () => {
  expect(
    forbiddenPaths([
      'src/App.tsx',
      '.env.local',
      '.env.production.local',
      '.wrangler/state/v3/kv/metadata.sqlite',
      '.claude/settings.local.json',
      'supabase/.temp/project-ref',
      'playwright-report/index.html',
      'test-results/x/trace.zip',
      '.superpowers/sdd/x/progress.md',
      'node_modules/a/index.js',
      'dist/index.html',
      'signing_keys.json',
      '.DS_Store',
    ]),
  ).toEqual([
    '.env.local',
    '.env.production.local',
    '.wrangler/state/v3/kv/metadata.sqlite',
    '.claude/settings.local.json',
    'supabase/.temp/project-ref',
    'playwright-report/index.html',
    'test-results/x/trace.zip',
    '.superpowers/sdd/x/progress.md',
    'node_modules/a/index.js',
    'dist/index.html',
    'signing_keys.json',
    '.DS_Store',
  ])
})

test('permite .env.example y el resto del código', () => {
  expect(forbiddenPaths(['.env.example', 'supabase/config.toml', 'docs/despliegue.md'])).toEqual([])
})
