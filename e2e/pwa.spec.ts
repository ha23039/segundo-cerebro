import { expect, test } from '@playwright/test'
import { createTestUser, login, type TestUser } from './helpers'

let user: TestUser

test.beforeAll(async () => {
  user = await createTestUser()
})

test('el manifest es instalable', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest')
  expect(res.status()).toBe(200)
  const manifest = await res.json()
  expect(manifest.display).toBe('standalone')
  expect(manifest.lang).toBe('es')
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
})

test('sin conexión la app abre en solo lectura y avisa', async ({ page, context }) => {
  await login(page, user)
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  // Asegura que la caché de consultas ya se escribió en IndexedDB (throttle de 1 s)
  await page.waitForTimeout(1500)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Hoy', level: 1 })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Sin conexión: solo lectura' })).toBeVisible()

  await context.setOffline(false)
  await expect(page.getByText('Sin conexión: solo lectura')).toBeHidden()
})
