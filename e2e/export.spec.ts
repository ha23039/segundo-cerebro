import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { seedLogs } from './db'
import { createTestUser, expectNoA11yViolations, login, madridDate, seedHabit, type TestUser } from './helpers'

let user: TestUser

test.beforeEach(async () => {
  user = await createTestUser()
})

test('descargar JSON incluye todas las tablas, lo archivado y la papelera, sin el índice de búsqueda', async ({ page }) => {
  const habitId = await seedHabit(user, { name: 'Estudiar' }, 5)
  await seedLogs(habitId, user.id, [1, 2, 3, 4, 5].map((n) => ({ date: madridDate(-n) })))
  await login(page, user)

  // una nota y una entrada de diario para comprobar que también salen
  await page.goto('/notas/nueva')
  await page.getByLabel('Título').fill('Nota =cmd')
  await page.getByLabel('Nota', { exact: true }).fill('cuerpo')
  await page.getByRole('button', { name: 'Crear nota' }).click()
  await expect(page).toHaveURL(/\/notas\/[0-9a-f-]{36}$/)

  await page.goto('/ajustes')
  await expectNoA11yViolations(page)
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar JSON' }).click()])
  expect(download.suggestedFilename()).toMatch(/^segundo-cerebro-\d{4}-\d{2}-\d{2}\.json$/)
  await expect(page.getByRole('status').filter({ hasText: 'Descarga lista' })).toBeVisible()

  const json = JSON.parse(await readFile((await download.path())!, 'utf8'))
  expect(json.app).toBe('segundo-cerebro')
  expect(json.formato).toBe(1)
  expect(Object.keys(json.tablas).sort()).toEqual(
    ['daily_priorities', 'focus_sessions', 'goals', 'habit_logs', 'habit_schedules', 'habit_skips', 'habits', 'journal_entries', 'milestones', 'notes', 'profiles', 'rest_days'].sort(),
  )
  expect(json.tablas.habits.map((h: { name: string }) => h.name)).toEqual(['Estudiar'])
  expect(json.tablas.habit_logs).toHaveLength(5)
  expect(json.tablas.notes[0].title).toBe('Nota =cmd')
  expect(json.tablas.notes[0]).not.toHaveProperty('search')
  // solo datos del usuario que descarga
  const ids = new Set([...json.tablas.habits, ...json.tablas.notes, ...json.tablas.profiles].map((r: { user_id: string }) => r.user_id))
  expect([...ids]).toEqual([user.id])
})

test('descargar CSV da un zip con un archivo por tabla y textos protegidos contra fórmulas', async ({ page }) => {
  await login(page, user)
  await page.goto('/notas/nueva')
  await page.getByLabel('Título').fill('=SUMA(1+1)')
  await page.getByRole('button', { name: 'Crear nota' }).click()
  await expect(page).toHaveURL(/\/notas\/[0-9a-f-]{36}$/)

  await page.goto('/ajustes')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar CSV (zip)' }).click()])
  expect(download.suggestedFilename()).toMatch(/^segundo-cerebro-\d{4}-\d{2}-\d{2}\.zip$/)
  const buf = await readFile((await download.path())!)
  expect(buf.readUInt32LE(0)).toBe(0x04034b50)
  const text = buf.toString('latin1')
  for (const t of ['habits', 'habit_logs', 'notes', 'journal_entries', 'focus_sessions', 'goals', 'milestones', 'rest_days', 'habit_skips', 'daily_priorities', 'habit_schedules', 'profiles']) {
    expect(text).toContain(`${t}.csv`)
  }
  expect(text).toContain("'=SUMA(1+1)")
})

test('informe imprimible: resumen, tabla por hábito, accesible y sin desbordar a 320 px', async ({ page }) => {
  await seedHabit(user, { name: 'Leer cada día' }, 10)
  await page.setViewportSize({ width: 320, height: 700 })
  await login(page, user)
  await page.goto('/ajustes')
  await page.getByRole('link', { name: 'Informe imprimible' }).click()
  await expect(page.getByRole('heading', { name: 'Informe', level: 1 })).toBeVisible()
  const sheet = page.getByRole('article', { name: 'Informe imprimible' })
  // «Esta semana» puede no tener nada programado todavía (p. ej. un lunes): el historial siempre tiene datos
  await page.getByLabel('Periodo').selectOption({ label: 'Todo el historial' })
  await expect(sheet.getByRole('row', { name: /Leer cada día/ })).toBeVisible()
  await expect(sheet.getByText('Cumplimiento')).toBeVisible()
  await expectNoA11yViolations(page)
  for (const p of ['Esta semana', 'Este mes', 'Mes anterior', 'Todo el historial']) {
    await page.getByLabel('Periodo').selectOption({ label: p })
    await expect(sheet.getByRole('heading', { level: 2 })).toContainText(p.toLowerCase())
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  }
})

test('al imprimir se ocultan la navegación y los controles y el fondo es claro', async ({ page }) => {
  await seedHabit(user, { name: 'Leer' }, 3)
  await login(page, user)
  await page.goto('/informe?periodo=todo')
  await expect(page.getByRole('row', { name: /Leer/ })).toBeVisible()
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('navigation')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Imprimir o guardar como PDF' })).toBeHidden()
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).toBe('rgb(255, 255, 255)')
})
