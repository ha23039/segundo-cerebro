import { expect, test } from '@playwright/test'
import { createTestUser, expectNoA11yViolations, login, seedHabit, type TestUser, reloadSaved } from './helpers'

let user: TestUser

test.beforeEach(async () => {
  user = await createTestUser()
})

test('lo que queda de hoy: ordena por hora y quita lo que ya se hizo', async ({ page }) => {
  await seedHabit(user, { name: 'Lectura', startTime: '20:00', endTime: '20:30' })
  await seedHabit(user, { name: 'Agua', startTime: '07:30' })
  await seedHabit(user, { name: 'Sin hora' })
  await login(page, user)

  const card = page.getByRole('region', { name: 'Lo que queda de hoy' })
  const items = card.getByRole('listitem')
  await expect(items).toHaveCount(2)
  await expect(items.nth(0)).toContainText('07:30')
  await expect(items.nth(0)).toContainText('Agua')
  await expect(items.nth(1)).toContainText('20:00 – 20:30')
  await expect(items.nth(1)).toContainText('Lectura')
  await expectNoA11yViolations(page)

  await page.getByRole('button', { name: 'Agua' }).click()
  await expect(items).toHaveCount(1)
  await expect(items.first()).toContainText('Lectura')
})

test('sin horas, la tarjeta invita a ponerlas', async ({ page }) => {
  await seedHabit(user, { name: 'Correr' })
  await login(page, user)
  const card = page.getByRole('region', { name: 'Lo que queda de hoy' })
  await expect(card).toContainText('Ponle hora a un hábito')
})

test('poner hora desde la edición del hábito, con validación', async ({ page }) => {
  await seedHabit(user, { name: 'Meditar' })
  await login(page, user)
  await page.getByRole('link', { name: 'Hábitos' }).click()
  await page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Meditar', exact: true }) })
    .getByRole('link', { name: 'Editar' })
    .click()

  await page.getByLabel('Empieza').fill('10:00')
  await page.getByLabel('Termina').fill('09:00')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Debe terminar después de empezar')).toBeVisible()

  await page.getByLabel('Termina').fill('10:45')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('heading', { name: 'Hábitos', level: 1 })).toBeVisible()
  await page.getByRole('link', { name: 'Hoy' }).first().click()
  const card = page.getByRole('region', { name: 'Lo que queda de hoy' })
  await expect(card.getByRole('listitem')).toContainText('10:00 – 10:45')
  await expect(card.getByRole('listitem')).toContainText('Meditar')

  // Persiste tras recargar
  await reloadSaved(page)
  await expect(card.getByRole('listitem')).toContainText('10:00 – 10:45')
})
