import { expect, test, type Page } from '@playwright/test'
import { addDays, formatLongDate, todayIn } from '../src/lib/dates'
import { createTestUser, expectNoA11yViolations, lastMadridMidnight, login, seedHabit, type TestUser } from './helpers'

let user: TestUser

test.beforeEach(async () => {
  user = await createTestUser()
})

function row(page: Page, name: string) {
  return page.getByRole('listitem').filter({ has: page.getByText(name, { exact: true }) })
}

test('marcar un hábito, persiste al recargar y suma racha', async ({ page }) => {
  await seedHabit(user, { name: 'Leer' })
  await login(page, user)
  const toggle = row(page, 'Leer').getByRole('button', { name: 'Leer' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(row(page, 'Leer')).toContainText('1 día')
  await page.reload()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(row(page, 'Leer')).toContainText('0 días')
  await expect(page.getByText('0 de 1 hechos')).toBeVisible()
})

test('hábito de cantidad con +/- y escribiendo el valor', async ({ page }) => {
  await seedHabit(user, { name: 'Agua', kind: 'cantidad', unit: 'vasos', target: 8 })
  await login(page, user)
  const plus = page.getByRole('button', { name: 'Sumar 1 a Agua' })
  for (let i = 0; i < 3; i++) await plus.click()
  await expect(row(page, 'Agua')).toContainText('3 / 8 vasos')
  await page.getByRole('button', { name: 'Restar 1 a Agua' }).click()
  await expect(row(page, 'Agua')).toContainText('2 / 8 vasos')
  const input = page.getByLabel('Cantidad de Agua')
  await input.fill('8')
  await input.press('Enter')
  await expect(row(page, 'Agua')).toContainText('8 / 8 vasos')
  await expect(page.getByText('1 de 1 hechos')).toBeVisible()
  await page.reload()
  await expect(row(page, 'Agua')).toContainText('8 / 8 vasos')
})

test('corregir ayer y no más de 7 días atrás', async ({ page }) => {
  await seedHabit(user, { name: 'Leer' }, 10)
  await login(page, user)
  const picker = page.getByRole('group', { name: 'Día' })
  await expect(picker.getByRole('button')).toHaveCount(8)
  await picker.getByRole('button', { name: 'Ayer' }).click()
  await row(page, 'Leer').getByRole('button', { name: 'Leer' }).click()
  await expect(row(page, 'Leer').getByRole('button', { name: 'Leer' })).toHaveAttribute('aria-pressed', 'true')
  await picker.getByRole('button', { name: 'Hoy' }).click()
  await expect(row(page, 'Leer').getByRole('button', { name: 'Leer' })).toHaveAttribute('aria-pressed', 'false')
  await expect(row(page, 'Leer')).toContainText('1 día') // ayer hecho, hoy pendiente
  await page.reload()
  await page.getByRole('group', { name: 'Día' }).getByRole('button', { name: 'Ayer' }).click()
  await expect(row(page, 'Leer').getByRole('button', { name: 'Leer' })).toHaveAttribute('aria-pressed', 'true')
})

test('a medianoche Hoy cambia de fecha sin recargar', async ({ page }) => {
  await seedHabit(user, { name: 'Leer' }) // empieza hoy: ayer no toca
  await login(page, user)
  const midnight = lastMadridMidnight()
  const today = todayIn('Europe/Madrid')
  await page.clock.install({ time: new Date(midnight.getTime() - 2 * 60_000) })
  await page.reload()
  await expect(page.getByText(formatLongDate(addDays(today, -1)))).toBeVisible()
  await expect(page.getByText('No tienes hábitos para este día')).toBeVisible()
  await page.clock.fastForward('03:00')
  await expect(page.getByText(formatLongDate(today))).toBeVisible()
  await expect(row(page, 'Leer')).toBeVisible()
})

test('toques rápidos: la interfaz acaba igual que la base de datos', async ({ page }) => {
  await seedHabit(user, { name: 'Leer' })
  await login(page, user)
  const toggle = row(page, 'Leer').getByRole('button', { name: 'Leer' })
  for (let i = 0; i < 5; i++) await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.reload()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
})

test('si falla la red al registrar, se revierte y avisa', async ({ page }) => {
  await seedHabit(user, { name: 'Leer' })
  await login(page, user)
  await page.route('**/rest/v1/habit_logs*', (route) =>
    route.request().method() === 'GET' ? route.continue() : route.abort(),
  )
  const toggle = row(page, 'Leer').getByRole('button', { name: 'Leer' })
  await toggle.click()
  await expect(page.getByRole('alert')).toContainText('Sin conexión')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
})

test('sin conexión se ven los hábitos en solo lectura', async ({ page, context }) => {
  await seedHabit(user, { name: 'Leer' })
  await login(page, user)
  await row(page, 'Leer').getByRole('button', { name: 'Leer' }).click()
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await page.waitForTimeout(1500) // throttle de la persistencia
  await context.setOffline(true)
  await page.reload()
  const toggle = row(page, 'Leer').getByRole('button', { name: 'Leer' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(toggle).toBeDisabled()
  await context.setOffline(false)
})

test('sin hábitos muestra el estado vacío', async ({ page }) => {
  await login(page, user)
  await expect(page.getByText('No tienes hábitos para este día')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Crear un hábito' })).toBeVisible()
})

test('Hoy sin violaciones de accesibilidad', async ({ page }) => {
  await seedHabit(user, { name: 'Leer' })
  await seedHabit(user, { name: 'Agua', kind: 'cantidad', unit: 'vasos', target: 8 })
  await login(page, user)
  await expect(row(page, 'Agua')).toBeVisible()
  await expectNoA11yViolations(page)
})
