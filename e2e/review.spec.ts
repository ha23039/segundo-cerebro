import { expect, test } from '@playwright/test'
import { createTestUser, expectNoA11yViolations, login, seedHabit } from './helpers'

test('la revisión semanal enseña la semana, guarda las notas y las recuerda', async ({ page }) => {
  const user = await createTestUser()
  await seedHabit(user, { name: 'Leer' }, 10)
  await login(page, user)
  await page.getByRole('link', { name: 'Ajustes' }).first().click()
  await page.getByRole('link', { name: 'Hacer la revisión' }).click()

  await expect(page.getByRole('heading', { name: 'Revisión semanal', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cómo fue la semana' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tu revisión' })).toBeVisible()

  await page.getByLabel('Qué fue bien').fill('Leí cada día')
  await page.getByLabel('Qué mejorar').fill('Dormir antes')
  await page.getByLabel('Foco de la próxima semana').fill('Entrenar tres veces')
  await page.getByRole('button', { name: 'Guardar revisión' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Guardado' })).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Qué fue bien')).toHaveValue('Leí cada día')
  await expect(page.getByLabel('Foco de la próxima semana')).toHaveValue('Entrenar tres veces')
  await expect(page.getByRole('button', { name: 'Actualizar revisión' })).toBeVisible()

  // Otra semana: formulario vacío
  await page.getByRole('button', { name: 'Esta semana' }).click()
  await expect(page.getByLabel('Qué fue bien')).toHaveValue('')
})

test('una revisión vacía no se guarda y avisa', async ({ page }) => {
  await login(page, await createTestUser())
  await page.goto('/revision')
  await page.getByRole('button', { name: 'Guardar revisión' }).click()
  await expect(page.getByRole('alert')).toContainText('al menos una')
})

test('la revisión semanal no tiene violaciones de accesibilidad', async ({ page }) => {
  const user = await createTestUser()
  await seedHabit(user, { name: 'Leer' }, 10)
  await login(page, user)
  await page.goto('/revision')
  await expect(page.getByRole('heading', { name: 'Tu revisión' })).toBeVisible()
  await expectNoA11yViolations(page)
})
