import { expect, test } from '@playwright/test'
import { seedLogs } from './db'
import { createTestUser, expectNoA11yViolations, login, madridDate, seedHabit, type TestUser } from './helpers'

let user: TestUser

test.beforeEach(async () => {
  user = await createTestUser()
})

const isoWeekday = (d: string) => ((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7) + 1
const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`)
  x.setUTCDate(x.getUTCDate() + n)
  return x.toISOString().slice(0, 10)
}
const mondayOf = (d: string) => addDays(d, 1 - isoWeekday(d))
const longDay = (d: string) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`))

async function openStats(page: import('@playwright/test').Page, view?: 'Mes' | 'Histórico') {
  await page.getByRole('link', { name: 'Progreso' }).first().click()
  await expect(page.getByRole('heading', { name: 'Progreso', level: 1 })).toBeVisible()
  if (view) await page.getByRole('tab', { name: view }).click()
}

test('semana anterior: cumplimiento por hábito y total, y semanas sin datos', async ({ page }) => {
  const leer = await seedHabit(user, { name: 'Leer', days: [1, 2, 3, 4, 5] }, 21)
  const gym = await seedHabit(user, { name: 'Gimnasio', perWeek: 3 }, 21)
  const prev = addDays(mondayOf(madridDate()), -7)
  // Leer: laborables de la semana anterior menos el miércoles. Gimnasio: dos días.
  await seedLogs(leer, user.id, [0, 1, 3, 4].map((i) => ({ date: addDays(prev, i) })))
  await seedLogs(gym, user.id, [0, 2].map((i) => ({ date: addDays(prev, i) })))

  await login(page, user)
  await openStats(page)
  await page.getByRole('button', { name: 'Semana anterior' }).click()

  const row = (name: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name, exact: true }) })
  await expect(row('Leer')).toContainText('4 de 5 · 80 %')
  await expect(row('Gimnasio')).toContainText('2 de 3')
  const total = page.getByRole('region', { name: 'Cumplimiento de la semana' })
  await expect(total).toContainText('75 %')
  await expect(total).toContainText('6 de 8')
  await expect(page.getByRole('img', { name: `miércoles ${Number(addDays(prev, 2).slice(8))}: no hecho` })).toBeVisible()
  await expectNoA11yViolations(page)

  // Retroceder antes de crear los hábitos: sin datos y sin errores
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Semana anterior' }).click()
  await expect(total).toContainText('—')
  await expect(page.getByText('Ningún hábito estaba activo esta semana.')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)

  // La semana siguiente no pasa de la actual
  for (let i = 0; i < 10; i++) {
    const next = page.getByRole('button', { name: 'Semana siguiente' })
    if (await next.isDisabled()) break
    await next.click()
  }
  await expect(page.getByRole('button', { name: 'Semana siguiente' })).toBeDisabled()
})

test('mes anterior: calendario por hábito y cumplimiento', async ({ page }) => {
  const leer = await seedHabit(user, { name: 'Leer', days: [1, 2, 3, 4, 5] }, 70)
  const today = madridDate()
  const first = `${addDays(`${today.slice(0, 8)}01`, -1).slice(0, 8)}01`
  const last = addDays(`${today.slice(0, 8)}01`, -1)
  const days: string[] = []
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d)
  const weekdays = days.filter((d) => isoWeekday(d) <= 5)
  const firstTuesday = days.find((d) => isoWeekday(d) === 2)!
  const firstMonday = days.find((d) => isoWeekday(d) === 1)!
  const firstSaturday = days.find((d) => isoWeekday(d) === 6)!
  await seedLogs(leer, user.id, weekdays.filter((d) => d !== firstTuesday).map((date) => ({ date })))

  await login(page, user)
  await openStats(page, 'Mes')
  await page.getByRole('button', { name: 'Mes anterior' }).click()

  await expect(page.getByRole('img', { name: `${longDay(firstTuesday)}: no hecho` , exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: `${longDay(firstMonday)}: hecho` , exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: `${longDay(firstSaturday)}: no programado` , exact: true })).toBeVisible()
  const mine = page.getByRole('region', { name: 'Cumplimiento del hábito en el mes' })
  await expect(mine).toContainText(`${weekdays.length - 1} de ${weekdays.length}`)
  await expect(mine).toContainText(`${Math.round(((weekdays.length - 1) / weekdays.length) * 100)} %`)
  await expectNoA11yViolations(page)
})

test('histórico: rachas, archivados y cumplimiento por mes; funciona sin red', async ({ page }) => {
  const leer = await seedHabit(user, { name: 'Leer' }, 30)
  await seedHabit(user, { name: 'Archivable' })
  const today = madridDate()
  const dates: string[] = []
  for (let i = 30; i >= 1; i--) if (i !== 10) dates.push(addDays(today, -i)) // hecho de -30 a -11 y de -9 a -1
  await seedLogs(leer, user.id, dates.map((date) => ({ date })))

  await login(page, user)
  await page.getByRole('link', { name: 'Hábitos' }).click()
  await page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Archivable', exact: true }) }).getByRole('button', { name: 'Archivar' }).click()
  await expect(page.getByRole('region', { name: 'Archivados' })).toBeVisible()

  await openStats(page, 'Histórico')
  const row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Leer', exact: true }) })
  await expect(row).toContainText('9 días')
  await expect(row).toContainText('20 días')
  await expect(page.getByRole('region', { name: 'Racha global actual' })).toContainText('9 días')
  await expect(page.getByRole('region', { name: 'Mejor racha global' })).toContainText('20 días')
  await expect(page.getByRole('listitem').filter({ hasText: 'Archivable' })).toContainText('Archivado')
  expect(await page.getByRole('table').getByRole('row').count()).toBeGreaterThanOrEqual(2) // cabecera + al menos un mes
  await expectNoA11yViolations(page)

  // Sin red, tras cargar, el histórico se sigue viendo (caché compartida)
  await page.context().setOffline(true)
  await page.getByRole('tab', { name: 'Semana' }).click()
  await page.getByRole('tab', { name: 'Histórico' }).click()
  await expect(row).toContainText('20 días')
  await page.context().setOffline(false)
})

test('sin hábitos: estado vacío, nunca datos de ejemplo', async ({ page }) => {
  await login(page, user)
  await openStats(page)
  await expect(page.getByText('Aún no hay datos para mostrar.')).toBeVisible()
})

test('a 320 px las cinco pestañas y las tres vistas no desbordan', async ({ page }) => {
  await seedHabit(user, { name: 'Un hábito con un nombre bastante largo para estrechar la fila' }, 20)
  await page.setViewportSize({ width: 320, height: 700 })
  await login(page, user)
  await openStats(page)
  for (const view of ['Semana', 'Mes', 'Histórico']) {
    await page.getByRole('tab', { name: view }).click()
    await expect(page.getByRole('tab', { name: view })).toHaveAttribute('aria-selected', 'true')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  }
})

test('seedLogs se niega a tocar una base de datos que no es local', async () => {
  const previous = process.env.SUPABASE_DB_URL
  process.env.SUPABASE_DB_URL = 'postgresql://postgres:x@db.ejemplo.supabase.co:5432/postgres'
  try {
    await expect(seedLogs('00000000-0000-0000-0000-000000000000', user.id, [{ date: '2026-01-01' }])).rejects.toThrow('solo se puede usar contra una base local')
  } finally {
    process.env.SUPABASE_DB_URL = previous
  }
})
