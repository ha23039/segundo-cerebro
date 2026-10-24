import { expect, test } from '@playwright/test'
import { createTestUser, expectNoA11yViolations, login, type TestUser } from './helpers'

let user: TestUser

test.beforeAll(async () => {
  user = await createTestUser()
})

test('sin sesión redirige a /login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Segundo Cerebro' })).toBeVisible()
})

test('contraseña incorrecta muestra un error', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo').fill(user.email)
  await page.getByLabel('Contraseña').fill('contraseña-mala-123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos')
})

test('login correcto y la sesión persiste al recargar', async ({ page }) => {
  await login(page, user)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Hoy', level: 1 })).toBeVisible()
})

test('cerrar sesión vuelve a /login y borra la caché local', async ({ page }) => {
  await login(page, user)
  await page.getByRole('link', { name: 'Ajustes' }).click()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)
  const cached = await page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const req = indexedDB.open('keyval-store')
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('keyval')) return resolve(undefined)
          const get = db.transaction('keyval').objectStore('keyval').get('segundo-cerebro-cache')
          get.onsuccess = () => resolve(get.result)
        }
        req.onerror = () => resolve(undefined)
      }),
  )
  expect(cached).toBeUndefined()
})

test('sesión caducada sin refresh válido lleva a /login, no a pantalla en blanco', async ({ page }) => {
  await login(page, user)
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))!
    const session = JSON.parse(localStorage.getItem(key)!)
    session.expires_at = Math.floor(Date.now() / 1000) - 3600
    session.refresh_token = 'invalido'
    localStorage.setItem(key, JSON.stringify(session))
  })
  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByLabel('Correo')).toBeVisible()
})

test('login sin violaciones de accesibilidad', async ({ page }) => {
  await page.goto('/login')
  await expectNoA11yViolations(page)
})
