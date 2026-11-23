import { expect, test, type Locator, type Page } from '@playwright/test'
import { createTestUser, expectNoA11yViolations, login, reloadSaved, seedHabit, type TestUser } from './helpers'

let user: TestUser

test.beforeEach(async ({ page }) => {
  user = await createTestUser()
  await seedHabit(user, { name: 'Estudiar' })
  await login(page, user)
})

const foco = (page: Page) => page.getByRole('region', { name: 'Foco' })
const habitos = (page: Page) => page.getByRole('region', { name: 'Hábitos de hoy' })

/** ¿`a` aparece antes que `b` en el documento? */
async function before(a: Locator, b: Locator): Promise<boolean> {
  const [x, y] = await Promise.all([a.boundingBox(), b.boundingBox()])
  return x!.y < y!.y
}

const labels = (page: Page) => page.getByRole('list', { name: 'Tarjetas visibles' }).locator('.board-tile-label').allTextContents()

async function customize(page: Page) {
  await page.getByRole('button', { name: 'Personalizar' }).click()
  await expect(page.getByRole('heading', { name: 'Personalizar Hoy' })).toBeVisible()
}

test('por defecto Hábitos va antes que Foco; con las flechas se sube Foco y el orden se guarda', async ({ page }) => {
  expect(await before(habitos(page), foco(page))).toBe(true)

  await customize(page)
  await expectNoA11yViolations(page)
  await page.getByRole('button', { name: 'Subir Foco' }).click()
  await expect(page.getByRole('list', { name: 'Tarjetas visibles' }).locator('.board-tile-label').nth(2)).toHaveText('Foco')
  await page.getByRole('button', { name: 'Listo' }).click()
  await expect(page.getByRole('heading', { name: 'Personalizar Hoy' })).toHaveCount(0)
  expect(await before(foco(page), habitos(page))).toBe(true)

  await reloadSaved(page)
  expect(await before(foco(page), habitos(page))).toBe(true)

  await customize(page)
  await page.getByRole('button', { name: 'Restablecer' }).click()
  await page.getByRole('button', { name: 'Listo' }).click()
  expect(await before(habitos(page), foco(page))).toBe(true)
  await reloadSaved(page)
  expect(await before(habitos(page), foco(page))).toBe(true)
})

test('arrastrar la tarjeta real con el ratón cambia el orden', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 2600 }) // todo a la vista: sin depender del desplazamiento
  await customize(page)
  const handle = page.getByRole('button', { name: 'Mover Prioridades' })
  const target = page.getByRole('button', { name: 'Mover Foco' })
  const h = (await handle.boundingBox())!
  const t = (await target.boundingBox())!
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
  await page.mouse.down()
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 - 12, { steps: 3 })
  await page.mouse.move(t.x + t.width / 2, t.y + 2, { steps: 20 })
  await page.mouse.up()
  const rows = page.getByRole('list', { name: 'Tarjetas visibles' }).locator('.board-tile-label')
  await expect(rows.nth(3)).toHaveText('Prioridades')
  await expect(rows.nth(4)).toHaveText('Foco')
  await page.getByRole('button', { name: 'Listo' }).click()
  await reloadSaved(page)
  expect(await before(page.getByRole('region', { name: 'Prioridades' }), foco(page))).toBe(true)
})

test('en el modo personalizar se ven las tarjetas reales, sin poder usarse', async ({ page }) => {
  await customize(page)
  const items = page.getByRole('list', { name: 'Tarjetas visibles' })
  await expect(items.getByText('Hábitos de hoy').first()).toBeVisible()
  await expect(items.getByText('Estudiar').first()).toBeVisible()
  // lo de dentro es inerte: ni se enfoca ni se puede pulsar
  expect(await items.locator('[inert] button').count()).toBeGreaterThan(0)
  await expectNoA11yViolations(page)
})

test('con el teclado: espacio, flecha y espacio', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 2600 })
  await customize(page)
  const before = await labels(page)
  await page.getByRole('button', { name: 'Mover Hábitos de hoy' }).focus()
  await page.keyboard.press('Space')
  await page.waitForTimeout(200)
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(200)
  await page.keyboard.press('Space')
  await page.waitForTimeout(200)
  await expect(page.getByRole('list', { name: 'Tarjetas visibles' }).locator('.board-tile-label').nth(before.indexOf('Hábitos de hoy') - 1)).toHaveText('Hábitos de hoy')
})

test('ocultar y volver a mostrar una tarjeta', async ({ page }) => {
  await expect(page.getByRole('region', { name: 'Prioridades' })).toBeVisible()
  await customize(page)
  await page.getByRole('button', { name: 'Ocultar Prioridades' }).click()
  await expect(page.getByRole('list', { name: 'Tarjetas ocultas' }).locator('.board-tile-label', { hasText: 'Prioridades' })).toBeVisible()
  await page.getByRole('button', { name: 'Listo' }).click()
  await expect(page.getByRole('region', { name: 'Prioridades' })).toHaveCount(0)

  await reloadSaved(page)
  await expect(page.getByRole('region', { name: 'Prioridades' })).toHaveCount(0)

  await customize(page)
  await page.getByRole('button', { name: 'Mostrar Prioridades' }).click()
  await page.getByRole('button', { name: 'Listo' }).click()
  await expect(page.getByRole('region', { name: 'Prioridades' })).toBeVisible()
})

test('a 320 px y en escritorio, personalizar no desborda y es accesible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.reload()
  await customize(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await page.getByRole('button', { name: 'Listo' }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)

  await page.setViewportSize({ width: 1280, height: 900 })
  await expectNoA11yViolations(page)
  await customize(page)
  await expectNoA11yViolations(page)
})
