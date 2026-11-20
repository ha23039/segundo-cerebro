import { expect, test, type Page } from '@playwright/test'
import { createTestUser, expectNoA11yViolations, login, madridDate, seedGoal, seedHabit, type TestUser, reloadSaved } from './helpers'

let user: TestUser

/** Marca un hito con un clic y espera a verlo marcado (el cambio es optimista, no instantáneo). */
async function mark(page: Page, name: string) {
  await page.getByRole('checkbox', { name }).click()
  await expect(page.getByRole('checkbox', { name })).toBeChecked()
}

test.beforeEach(async () => {
  user = await createTestUser()
})

test('crear un objetivo con hitos, marcar avances y completarlo', async ({ page }) => {
  await login(page, user)
  await page.getByRole('link', { name: 'Objetivos' }).first().click()
  await expect(page.getByText('Aún no tienes objetivos activos.')).toBeVisible()

  await page.getByRole('button', { name: 'Nuevo objetivo' }).click()
  await page.getByLabel('Título').fill('Correr un 10K')
  await page.getByLabel('Fecha límite').fill(madridDate(30))
  await page.getByRole('button', { name: 'Crear objetivo' }).click()
  await expect(page.getByRole('heading', { name: 'Correr un 10K', level: 1 })).toBeVisible()
  await expect(page.getByText('Aún no hay hitos')).toBeVisible()

  for (const hito of ['Correr 3 km', 'Correr 5 km']) {
    await page.getByLabel('Nuevo hito').fill(hito)
    await page.getByRole('button', { name: 'Añadir hito' }).click()
    await expect(page.getByRole('checkbox', { name: hito })).toBeVisible()
  }
  await expect(page.getByText('0 de 2 hitos hechos')).toBeVisible()
  // Regresión: la regla global de inputs (ancho 100 %) estiraba las casillas de los hitos
  const box = await page.getByRole('checkbox', { name: 'Correr 3 km' }).boundingBox()
  expect(box!.width).toBeLessThanOrEqual(24)
  expect(box!.height).toBeLessThanOrEqual(24)

  await mark(page, 'Correr 3 km')
  await expect(page.getByText('1 de 2 hitos hechos')).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Progreso del objetivo' })).toHaveAttribute('aria-valuenow', '50')
  await expectNoA11yViolations(page)

  // Persiste tras recargar
  await reloadSaved(page)
  await expect(page.getByRole('checkbox', { name: 'Correr 3 km' })).toBeChecked()

  await page.getByRole('button', { name: 'Completar objetivo' }).click()
  await expect(page.getByText('Completado', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reabrir' }).click()
  await expect(page.getByRole('button', { name: 'Completar objetivo' })).toBeVisible()
})

test('ritmo esperado: atrasado, en ritmo y adelantado según los hitos hechos', async ({ page }) => {
  // Día 10 de 20: se espera la mitad
  await seedGoal(user, { title: 'Preparar el examen', startOffset: -10, dueOffset: 10, milestones: ['Tema 1', 'Tema 2', 'Tema 3', 'Tema 4'] })
  await login(page, user)
  await page.getByRole('link', { name: 'Objetivos' }).first().click()

  const card = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Preparar el examen' }) })
  await expect(card).toContainText('Atrasado')
  await expect(card).toContainText('Ritmo esperado: 2 de 4 hoy')
  await expect(card).toContainText('Quedan 10 días')
  await expectNoA11yViolations(page)

  await card.getByRole('link', { name: 'Preparar el examen' }).click()
  await expect(page.getByText('(te faltan 2 para ir al ritmo)')).toBeVisible()
  await mark(page, 'Tema 1')
  await mark(page, 'Tema 2')
  await expect(page.locator('.pace-tag')).toHaveText('En ritmo')
  await mark(page, 'Tema 3')
  await mark(page, 'Tema 4')
  await expect(page.getByText('Todos los hitos están hechos')).toBeVisible()
})

test('un objetivo vencido se marca como tal', async ({ page }) => {
  await seedGoal(user, { title: 'Entregar el informe', startOffset: -20, dueOffset: -2, milestones: ['Borrador'] })
  await login(page, user)
  await page.getByRole('link', { name: 'Objetivos' }).first().click()
  const card = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Entregar el informe' }) })
  await expect(card).toContainText('Vencido')
  await expect(card).toContainText('Venció hace 2 días')
})

test('Hoy avisa de los objetivos que vencen en 7 días o menos', async ({ page }) => {
  await seedGoal(user, { title: 'Cerca', dueOffset: 3, milestones: ['A'] })
  await seedGoal(user, { title: 'Lejos', dueOffset: 40 })
  await seedHabit(user, { name: 'Correr' })
  await login(page, user)
  const card = page.getByRole('region', { name: 'Objetivos por vencer' })
  await expect(card).toContainText('Cerca')
  await expect(card).toContainText('Quedan 3 días')
  await expect(card).not.toContainText('Lejos')
  await expectNoA11yViolations(page)
})

test('vincular y desvincular un hábito', async ({ page }) => {
  await seedGoal(user, { title: 'Estar en forma', dueOffset: 60 })
  await seedHabit(user, { name: 'Correr' })
  await login(page, user)
  await page.getByRole('link', { name: 'Objetivos' }).first().click()
  await page.getByRole('link', { name: 'Estar en forma' }).click()

  await page.getByLabel('Vincular un hábito').selectOption({ label: 'Correr' })
  await page.getByRole('button', { name: 'Vincular', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Desvincular Correr' })).toBeVisible()
  await reloadSaved(page)
  await expect(page.getByRole('button', { name: 'Desvincular Correr' })).toBeVisible()

  await page.getByRole('button', { name: 'Desvincular Correr' }).click()
  await expect(page.getByText('Ningún hábito vinculado')).toBeVisible()
})

test('eliminar a la papelera y restaurar', async ({ page }) => {
  await seedGoal(user, { title: 'Temporal', dueOffset: 20 })
  await login(page, user)
  await page.getByRole('link', { name: 'Objetivos' }).first().click()
  await page.getByRole('link', { name: 'Temporal' }).click()

  await page.getByRole('button', { name: 'Eliminar' }).click()
  await page.getByRole('button', { name: 'Sí, eliminar' }).click()
  await expect(page.getByRole('heading', { name: 'Objetivos', level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Temporal' })).toHaveCount(0)

  await page.getByRole('button', { name: /Restaurar/ }).click()
  await expect(page.getByRole('link', { name: 'Temporal' })).toBeVisible()
})

test('la fecha límite no puede ser anterior al inicio', async ({ page }) => {
  await login(page, user)
  await page.getByRole('link', { name: 'Objetivos' }).first().click()
  await page.getByRole('button', { name: 'Nuevo objetivo' }).click()
  await page.getByLabel('Título').fill('Imposible')
  await page.getByLabel('Fecha límite').fill(madridDate(-1))
  await page.getByRole('button', { name: 'Crear objetivo' }).click()
  await expect(page.getByText('La fecha límite no puede ser anterior al inicio')).toBeVisible()
})
