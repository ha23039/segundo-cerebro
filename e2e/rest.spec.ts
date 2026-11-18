import { expect, test } from '@playwright/test'
import { createTestUser, expectNoA11yViolations, login, seedHabit, type TestUser, reloadSaved } from './helpers'

let user: TestUser

test.beforeEach(async () => {
  user = await createTestUser()
})

test('descansar hoy: no puntúa, la lista pasa a opcional y se puede quitar', async ({ page }) => {
  await seedHabit(user, { name: 'Correr', area: 'ejercicio' })
  await login(page, user)
  await expect(page.getByRole('heading', { name: 'Te falta 1 por hacer' })).toBeVisible()

  const rest = page.getByRole('region', { name: 'Descanso' })
  await rest.getByLabel('Motivo del descanso (opcional)').fill('Domingo en familia')
  await rest.getByRole('button', { name: 'Descansar hoy' }).click()

  await expect(page.getByRole('heading', { name: 'Día de descanso' })).toBeVisible()
  await expect(page.locator('.hero').getByText('Domingo en familia')).toBeVisible()
  await expect(page.getByText('Opcional hoy')).toBeVisible()
  await expect(rest.getByText('Hoy descansas')).toBeVisible()
  await expectNoA11yViolations(page)

  // Persiste tras recargar
  await reloadSaved(page)
  await expect(page.getByRole('heading', { name: 'Día de descanso' })).toBeVisible()

  await page.getByRole('region', { name: 'Descanso' }).getByRole('button', { name: 'Quitar descanso' }).click()
  await expect(page.getByRole('heading', { name: 'Te falta 1 por hacer' })).toBeVisible()
})

test('omitir un hábito con motivo lo saca de la puntuación y se puede deshacer', async ({ page }) => {
  await seedHabit(user, { name: 'Correr', area: 'ejercicio' })
  await seedHabit(user, { name: 'Leer', area: 'estudio' })
  await login(page, user)
  await expect(page.getByRole('heading', { name: 'Te faltan 2 por hacer' })).toBeVisible()

  const correr = page.getByRole('listitem').filter({ hasText: 'Correr' })
  await correr.getByRole('button', { name: 'Omitir', exact: true }).click()
  await correr.getByRole('group', { name: 'Motivo para omitir Correr' }).getByRole('button', { name: 'Enfermedad' }).click()

  await expect(correr).toContainText('Omitido · Enfermedad')
  await expect(page.getByRole('heading', { name: 'Te falta 1 por hacer' })).toBeVisible()
  await expect(page.getByText('0 de 1 hábitos')).toBeVisible()

  await page.getByRole('button', { name: 'Leer' }).click()
  await expect(page.getByRole('heading', { name: 'Día completo' })).toBeVisible()
  await expect(page.locator('.hero-ring-text strong')).toHaveText('100')

  // Pendientes no muestra lo omitido
  await page.getByRole('button', { name: 'Pendientes' }).click()
  await expect(page.getByText('No te queda nada pendiente. Buen trabajo.')).toBeVisible()
  await page.getByRole('button', { name: 'Todos' }).click()

  await reloadSaved(page)
  await expect(correr).toContainText('Omitido · Enfermedad')
  await correr.getByRole('button', { name: 'Deshacer' }).click()
  await expect(page.getByRole('heading', { name: 'Te falta 1 por hacer' })).toBeVisible()
  await expectNoA11yViolations(page)
})

test('planificar un descanso futuro y cancelarlo', async ({ page }) => {
  await seedHabit(user, { name: 'Correr' })
  await login(page, user)
  const rest = page.getByRole('region', { name: 'Descanso' })
  const date = await rest.getByLabel('Fecha del descanso').getAttribute('min')
  expect(date).toBeTruthy()

  await rest.getByLabel('Fecha del descanso').fill(date!)
  await rest.getByLabel('Motivo del descanso planificado (opcional)').fill('Viaje')
  await rest.getByRole('button', { name: 'Planificar' }).click()

  const list = rest.getByRole('listitem')
  await expect(list).toHaveCount(1)
  await expect(list).toContainText('Viaje')
  await reloadSaved(page)
  await expect(rest.getByRole('listitem')).toHaveCount(1)

  await rest.getByRole('button', { name: /^Cancelar descanso del/ }).click()
  await expect(rest.getByRole('listitem')).toHaveCount(0)
})

test('ayer de descanso no rompe la racha de hoy', async ({ page }) => {
  await seedHabit(user, { name: 'Leer' }, 2)
  await login(page, user)
  const days = page.getByRole('group', { name: 'Día' })
  // Anteayer, hecho; ayer, descanso; hoy, hecho → racha 2 (sin el descanso sería 1)
  await days.getByRole('button').nth(2).click()
  await page.getByRole('button', { name: 'Leer' }).click()
  await expect(page.getByRole('heading', { name: 'Día completo' })).toBeVisible()
  await days.getByRole('button', { name: 'Ayer', exact: true }).click()
  await page.getByRole('region', { name: 'Descanso' }).getByRole('button', { name: 'Marcar descanso' }).click()
  await expect(page.getByRole('heading', { name: 'Día de descanso' })).toBeVisible()
  await days.getByRole('button', { name: 'Hoy', exact: true }).click()
  await page.getByRole('button', { name: 'Leer' }).click()
  await expect(page.getByRole('heading', { name: 'Día completo' })).toBeVisible()

  const racha = page.getByRole('region', { name: 'Rendimiento' }).locator('.stat').filter({ hasText: 'Racha' })
  await expect(racha.locator('.stat-value')).toContainText('2 días')
  await expect(page.getByRole('img', { name: /descanso/ })).toBeVisible()
})
