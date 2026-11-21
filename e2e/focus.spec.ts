import { expect, test, type Page } from '@playwright/test'
import { createTestUser, expectNoA11yViolations, login, madridDate, reloadSaved, seedFocusSessions, seedHabit, type TestUser } from './helpers'

let user: TestUser

test.beforeEach(async () => {
  user = await createTestUser()
})

/** Deja un temporizador ya empezado hace `minutesAgo` minutos, como si la app llevara tiempo abierta o cerrada. */
async function seedTimer(page: Page, minutesAgo: number, planned: number, kind: 'foco' | 'descanso' = 'foco') {
  const timer = { id: crypto.randomUUID(), kind, startedAt: Date.now() - minutesAgo * 60_000, plannedMinutes: planned, habitId: null, goalId: null }
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [`sc:focus:timer:${user.id}`, JSON.stringify(timer)])
  await reloadSaved(page)
}

const card = (page: Page) => page.getByRole('region', { name: 'Foco' })

test('un foco en curso sobrevive a la recarga y al detenerlo se guardan los minutos reales', async ({ page }) => {
  await seedHabit(user, { name: 'Estudiar' })
  await login(page, user)
  await seedTimer(page, 10, 25)

  await expect(card(page).getByRole('timer')).toHaveText(/^1[45]:\d\d$/)
  await expectNoA11yViolations(page)
  await card(page).getByRole('button', { name: 'Detener' }).click()

  await expect(card(page)).toContainText('Sesión guardada: 10 min.')
  await expect(card(page)).toContainText('Hoy: 10 min · 1 sesión')
  await reloadSaved(page)
  await expect(card(page)).toContainText('Hoy: 10 min · 1 sesión')
  await expect(card(page).getByRole('timer')).toHaveCount(0)
})

test('si terminó mientras la app estaba cerrada, se guarda una vez con el tiempo planificado', async ({ page }) => {
  await login(page, user)
  await seedTimer(page, 30, 25)

  await expect(card(page)).toContainText('Hoy: 25 min · 1 sesión')
  await reloadSaved(page)
  await reloadSaved(page)
  await expect(card(page)).toContainText('Hoy: 25 min · 1 sesión') // sin duplicados
})

test('empezar desde la tarjeta; menos de 1 minuto no se guarda', async ({ page }) => {
  await seedHabit(user, { name: 'Estudiar' })
  await login(page, user)

  await card(page).getByRole('button', { name: '45 min' }).click()
  await card(page).getByLabel('Asociar a (opcional)').selectOption({ label: 'Estudiar' })
  await card(page).getByRole('button', { name: 'Empezar foco' }).click()
  await expect(card(page).getByRole('timer')).toHaveText(/^(44|45):\d\d$/)
  await expect(card(page)).toContainText('Foco · Estudiar')

  await card(page).getByRole('button', { name: 'Detener' }).click()
  await expect(card(page)).toContainText('Duró menos de 1 minuto: no se guardó.')
  await expect(card(page)).toContainText('Hoy: sin sesiones')
  await card(page).getByRole('button', { name: 'Cerrar' }).click()

  // La duración elegida se recuerda
  await reloadSaved(page)
  await expect(card(page).getByRole('button', { name: '45 min' })).toHaveAttribute('aria-pressed', 'true')
})

test('aviso fuera de Hoy y descanso después del foco', async ({ page }) => {
  await login(page, user)
  await seedTimer(page, 10, 25)

  await page.getByRole('link', { name: 'Hábitos' }).click()
  const banner = page.getByRole('link', { name: /Foco en curso, quedan/ })
  await expect(banner).toBeVisible()
  await banner.click()
  await expect(page.getByRole('heading', { name: 'Hoy', level: 1 })).toBeVisible()

  await card(page).getByRole('button', { name: 'Detener' }).click()
  await card(page).getByRole('button', { name: 'Descansar 5 min' }).click()
  await expect(card(page)).toContainText('Descanso')
  await expect(card(page).getByRole('timer')).toHaveText(/^0[45]:\d\d$/)
})

test('estadísticas de foco: minutos por día y semana, y borrar una sesión', async ({ page }) => {
  // Semana anterior: lunes 30 min, miércoles 25 + 60 min y un descanso que no cuenta
  const prevMonday = (() => {
    const d = new Date(`${madridDate()}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 7)
    return d.toISOString().slice(0, 10)
  })()
  const offset = (days: number) => Math.round((new Date(`${prevMonday}T00:00:00Z`).getTime() - new Date(`${madridDate()}T00:00:00Z`).getTime()) / 86_400_000) + days
  await seedFocusSessions(user, [
    { dayOffset: offset(0), minutes: 30 },
    { dayOffset: offset(2), minutes: 25 },
    { dayOffset: offset(2), minutes: 60 },
    { dayOffset: offset(2), minutes: 5, kind: 'descanso' },
  ])
  await login(page, user)
  await page.getByRole('link', { name: 'Progreso' }).first().click()
  await page.getByRole('tab', { name: 'Foco' }).click()
  await page.getByRole('button', { name: 'Semana anterior' }).click()

  const total = page.getByRole('region', { name: 'Minutos de foco de la semana' })
  await expect(total).toContainText('1 h 55 min')
  await expect(total).toContainText('3 sesiones')
  await expect(page.getByRole('region', { name: 'Media por día con foco' })).toContainText('58 min')
  await expect(page.getByLabel(/^miércoles \d+: 1 h 25 min$/)).toBeVisible()
  await expect(page.getByLabel(/^martes \d+: sin foco$/)).toBeVisible()
  await expectNoA11yViolations(page)

  // Borrar una sesión pide confirmación y actualiza el total
  await page.getByRole('listitem').filter({ hasText: 'Foco · 1 h' }).getByRole('button', { name: /^Borrar la sesión de/ }).click()
  await page.getByRole('button', { name: 'Borrar', exact: true }).click()
  await expect(total).toContainText('55 min')
  await expect(total).toContainText('2 sesiones')
})

test('sin sesiones, estado vacío; a 320 px no desborda', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await login(page, user)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await page.getByRole('link', { name: 'Progreso' }).first().click()
  await page.getByRole('tab', { name: 'Foco' }).click()
  await expect(page.getByText('Aún no hay sesiones de foco.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})

test('el botón Foco de un hábito empieza el temporizador asociado y se oculta mientras corre', async ({ page }) => {
  await seedHabit(user, { name: 'Estudiar' })
  await login(page, user)

  await page.getByRole('button', { name: 'Foco', exact: true }).click()
  await expect(card(page).getByRole('timer')).toHaveText(/^2[45]:\d\d$/)
  await expect(card(page)).toContainText('Foco · Estudiar')
  await expect(page.getByRole('button', { name: 'Foco', exact: true })).toHaveCount(0)
  await expectNoA11yViolations(page)
})
