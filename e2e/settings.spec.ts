import { expect, test } from '@playwright/test'
import { createTestUser, expectNoA11yViolations, login, type TestUser } from './helpers'

let user: TestUser

test.beforeAll(async () => {
  user = await createTestUser()
})

test.beforeEach(async ({ page }) => {
  await login(page, user)
  await page.getByRole('link', { name: 'Ajustes' }).click()
  await expect(page.getByRole('heading', { name: 'Ajustes', level: 1 })).toBeVisible()
})

test('paleta y modo se aplican y persisten al recargar', async ({ page }) => {
  await page.getByRole('radio', { name: 'Océano' }).check()
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'oceano')
  await page.getByRole('radio', { name: 'Oscuro' }).check()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'oceano')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('radio', { name: 'Océano' })).toBeChecked()
  await expect(page.getByRole('radio', { name: 'Oscuro' })).toBeChecked()
})

test('automático sigue al sistema', async ({ page }) => {
  await page.getByRole('radio', { name: 'Oscuro' }).check()
  await page.getByRole('radio', { name: 'Automático' }).check()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/)
  await page.emulateMedia({ colorScheme: 'dark' })
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())
  expect(bg).toBe('#0d1017')
})

test('la zona horaria se guarda en la base de datos', async ({ page }) => {
  const select = page.getByLabel('Zona horaria')
  await expect(select).toHaveValue('Europe/Madrid')
  await select.selectOption('America/Mexico_City')
  await expect(page.getByRole('status').filter({ hasText: 'Zona horaria guardada' })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Zona horaria')).toHaveValue('America/Mexico_City')
  await page.getByLabel('Zona horaria').selectOption('Europe/Madrid')
  await expect(page.getByRole('status').filter({ hasText: 'Zona horaria guardada' })).toBeVisible()
})

for (const palette of ['Índigo', 'Océano']) {
  for (const mode of ['Claro', 'Oscuro']) {
    test(`sin violaciones de accesibilidad: ${palette} ${mode}`, async ({ page }) => {
      await page.getByRole('radio', { name: palette }).check()
      await page.getByRole('radio', { name: mode }).check()
      await expectNoA11yViolations(page)
    })
  }
}
