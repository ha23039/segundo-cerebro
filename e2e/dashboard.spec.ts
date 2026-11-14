import { expect, test } from '@playwright/test'
import { createTestUser, expectNoA11yViolations, login, seedHabit, type TestUser } from './helpers'

let user: TestUser

test.beforeEach(async () => {
  user = await createTestUser()
})

test('el panel muestra progreso del día, KPIs reales y desglose por área', async ({ page }) => {
  await seedHabit(user, { name: 'Correr', area: 'ejercicio' }, 3)
  await seedHabit(user, { name: 'Leer', area: 'estudio' }, 3)
  await login(page, user)

  await expect(page.getByRole('heading', { name: 'Te faltan 2 por hacer' })).toBeVisible()
  await page.getByRole('button', { name: 'Correr' }).click()
  await expect(page.getByRole('heading', { name: 'Te falta 1 por hacer' })).toBeVisible()
  await expect(page.getByText('1 de 2 hechos')).toBeVisible()

  const resumen = page.getByRole('region', { name: 'Resumen' })
  await expect(resumen.getByText('Racha global')).toBeVisible()

  const areas = page.getByRole('table', { name: /por área/i })
  await expect(areas.getByRole('rowheader', { name: 'Ejercicio' })).toBeVisible()
  await expect(areas.getByRole('rowheader', { name: 'Estudio' })).toBeVisible()
  await expect(page.getByRole('img', { name: /Cumplimiento diario/ })).toBeVisible()
  await expectNoA11yViolations(page)
})

test('Pendientes oculta lo hecho', async ({ page }) => {
  await seedHabit(user, { name: 'Correr', area: 'ejercicio' })
  await seedHabit(user, { name: 'Leer', area: 'estudio' })
  await login(page, user)
  await page.getByRole('button', { name: 'Correr' }).click()
  await page.getByRole('button', { name: 'Pendientes' }).click()
  await expect(page.getByRole('button', { name: 'Correr' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Leer' })).toBeVisible()
})

test('el área se elige al crear el hábito y aparece en la lista', async ({ page }) => {
  await login(page, user)
  await page.getByRole('link', { name: 'Hábitos' }).click()
  await page.getByRole('link', { name: 'Nuevo hábito' }).click()
  await page.getByLabel('Nombre').fill('Meditar')
  await page.getByRole('radio', { name: 'Espiritualidad' }).check()
  await page.getByRole('checkbox', { name: 'lunes' }).check()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Meditar' })).toContainText('Espiritualidad')
})

test.describe('escritorio', () => {
  test.use({ viewport: { width: 1280, height: 860 }, isMobile: false, hasTouch: false })

  test('barra lateral en vez de barra inferior, sin scroll horizontal', async ({ page }) => {
    await seedHabit(user, { name: 'Leer', area: 'estudio' })
    await login(page, user)
    const navs = page.getByRole('navigation', { name: 'Principal' })
    await expect(navs).toHaveCount(1)
    await expect(page.locator('.sidebar')).toBeVisible()
    await expect(page.locator('.bottom-nav')).toBeHidden()
    await page.getByRole('button', { name: 'Modo oscuro' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280)
  })
})
