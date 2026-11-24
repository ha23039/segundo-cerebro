import { expect, test, type Page } from '@playwright/test'
import { addDays, formatLongDate, todayIn } from '../src/lib/dates'
import { createTestUser, expectNoA11yViolations, lastMadridMidnight, login, seedHabit, type TestUser, reloadSaved } from './helpers'

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
  await reloadSaved(page)
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(row(page, 'Leer')).toContainText('0 días')
  await expect(page.getByText('0 de 1 hábitos')).toBeVisible()
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
  await expect(page.getByText('1 de 1 hábitos')).toBeVisible()
  await reloadSaved(page)
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
  await reloadSaved(page)
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

test('si falla la red al registrar, el cambio queda pendiente y se avisa', async ({ page }) => {
  await seedHabit(user, { name: 'Leer' })
  await login(page, user)
  await page.route('**/rest/v1/habit_logs*', (route) =>
    route.request().method() === 'GET' ? route.continue() : route.abort(),
  )
  const toggle = row(page, 'Leer').getByRole('button', { name: 'Leer' })
  await toggle.click()
  // No se pierde: se ve marcado y espera en la cola del dispositivo hasta poder enviarse
  await expect(page.getByRole('status').filter({ hasText: 'Guardando 1 cambio' })).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
})

test('sin conexión se puede marcar un hábito y se guarda al volver', async ({ page, context }) => {
  await seedHabit(user, { name: 'Leer' })
  await login(page, user)
  await expect(row(page, 'Leer')).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await page.waitForTimeout(1500) // throttle de la persistencia
  await context.setOffline(true)
  await page.reload()
  const toggle = row(page, 'Leer').getByRole('button', { name: 'Leer' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('status').filter({ hasText: '1 cambio pendiente' })).toBeVisible()

  // Aunque se cierre y se vuelva a abrir sin red, el cambio sigue ahí
  await page.reload()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')

  await context.setOffline(false)
  await expect(page.getByText(/pendiente|Guardando/)).toBeHidden({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')
  await page.reload()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
})

test('sin conexión no se pueden omitir hábitos (eso sí necesita red)', async ({ page, context }) => {
  await seedHabit(user, { name: 'Leer' })
  await login(page, user)
  await expect(row(page, 'Leer')).toBeVisible()
  await context.setOffline(true)
  await expect(row(page, 'Leer').getByRole('button', { name: 'Omitir' })).toBeHidden()
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

test('sin red al día siguiente y con el token caducado sigue mostrando los datos', async ({ page, context }) => {
  await seedHabit(user, { name: 'Leer' }, 3)
  await login(page, user)
  await row(page, 'Leer').getByRole('button', { name: 'Leer' }).click()
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await page.waitForTimeout(1500)
  await context.setOffline(true)
  // Mañana a las 08:00 en Madrid: el token (1 h) ha caducado y no se puede refrescar
  const tomorrow8 = new Date(lastMadridMidnight().getTime() + 32 * 3_600_000)
  await page.clock.install({ time: tomorrow8 })
  await page.reload()
  await expect(page).not.toHaveURL(/\/login$/)
  const toggle = row(page, 'Leer').getByRole('button', { name: 'Leer' })
  await expect(toggle).toBeVisible()
  await expect(page.getByText('Sin conexión: puedes marcar hábitos')).toBeVisible()
  await context.setOffline(false)
})

test('marcar no vuelve a descargar los registros', async ({ page }) => {
  await seedHabit(user, { name: 'Leer' })
  await login(page, user)
  await expect(row(page, 'Leer')).toBeVisible()
  await page.waitForLoadState('networkidle')
  let logReads = 0
  page.on('request', (r) => {
    if (r.method() === 'GET' && r.url().includes('/rest/v1/habit_logs')) logReads++
  })
  const toggle = row(page, 'Leer').getByRole('button', { name: 'Leer' })
  await toggle.click()
  await toggle.click()
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await page.waitForLoadState('networkidle')
  expect(logReads).toBe(0)
})

test('si falla la red en toques encadenados, queda el último estado y un solo cambio pendiente', async ({ page }) => {
  await seedHabit(user, { name: 'Leer' })
  await login(page, user)
  const toggle = row(page, 'Leer').getByRole('button', { name: 'Leer' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  // Las escrituras tardan y fallan por la red: no se pierden, esperan en la cola del dispositivo
  await page.route('**/rest/v1/habit_logs*', async (route) => {
    await new Promise((r) => setTimeout(r, 300))
    await route.abort()
  })
  await toggle.click() // marcar
  await toggle.click() // desmarcar
  await toggle.click() // marcar
  // Los tres toques se reducen a lo último que se pidió: un único cambio, marcado
  await expect(page.getByRole('status').filter({ hasText: 'Guardando 1 cambio' })).toBeVisible()
  await page.waitForTimeout(1500)
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('status').filter({ hasText: 'Guardando 1 cambio' })).toBeVisible()
})
