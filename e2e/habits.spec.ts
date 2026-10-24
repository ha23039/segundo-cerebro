import { expect, test, type Page } from '@playwright/test'
import { createTestUser, expectNoA11yViolations, login } from './helpers'

// Cada test usa su propio usuario: los datos no se mezclan entre tests paralelos.
test.beforeEach(async ({ page }) => {
  await login(page, await createTestUser())
  await page.getByRole('link', { name: 'Hábitos' }).click()
  await expect(page.getByRole('heading', { name: 'Hábitos', level: 1 })).toBeVisible()
})

async function createHabit(
  page: Page,
  opts: { name: string; days?: string[]; perWeek?: number; target?: number; unit?: string },
) {
  await page.getByRole('link', { name: 'Nuevo hábito' }).click()
  await page.getByLabel('Nombre').fill(opts.name)
  if (opts.target !== undefined) {
    await page.getByRole('radio', { name: 'Cantidad' }).check()
    await page.getByLabel('Meta').fill(String(opts.target))
    await page.getByLabel('Unidad').fill(opts.unit ?? '')
  }
  if (opts.perWeek !== undefined) {
    await page.getByRole('radio', { name: 'Veces por semana' }).check()
    await page.getByLabel('Cuántas veces por semana').fill(String(opts.perWeek))
  } else {
    for (const d of opts.days ?? []) await page.getByRole('checkbox', { name: d }).check()
  }
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('heading', { name: 'Hábitos', level: 1 })).toBeVisible()
}

function card(page: Page, name: string) {
  return page.getByRole('listitem').filter({ has: page.getByRole('heading', { name, exact: true }) })
}

test('crear hábitos de check y de cantidad; persisten al recargar', async ({ page }) => {
  await createHabit(page, { name: 'Leer', days: ['lunes', 'miércoles', 'viernes'] })
  await createHabit(page, { name: 'Agua', perWeek: 5, target: 8, unit: 'vasos' })
  await expect(card(page, 'Leer')).toContainText('L-X-V')
  await expect(card(page, 'Agua')).toContainText('5 veces por semana')
  await expect(card(page, 'Agua')).toContainText('8 vasos')
  await page.reload()
  await expect(card(page, 'Leer')).toBeVisible()
  await expect(card(page, 'Agua')).toBeVisible()
})

test('editar la frecuencia', async ({ page }) => {
  await createHabit(page, { name: 'Leer', days: ['lunes', 'miércoles', 'viernes'] })
  await card(page, 'Leer').getByRole('link', { name: 'Editar' }).click()
  await expect(page.getByRole('radio', { name: 'Cantidad' })).toBeDisabled()
  for (const d of ['martes', 'jueves']) await page.getByRole('checkbox', { name: d }).check()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(card(page, 'Leer')).toContainText('L-V')
})

test('archivar y desarchivar', async ({ page }) => {
  await createHabit(page, { name: 'Leer', days: ['lunes'] })
  await card(page, 'Leer').getByRole('button', { name: 'Archivar' }).click()
  const archived = page.getByRole('region', { name: 'Archivados' })
  await expect(archived.getByRole('heading', { name: 'Leer' })).toBeVisible()
  await archived.getByRole('button', { name: 'Desarchivar' }).click()
  await expect(page.getByRole('region', { name: 'Activos' }).getByRole('heading', { name: 'Leer' })).toBeVisible()
})

test('cambiar el orden y que persista', async ({ page }) => {
  await createHabit(page, { name: 'Primero', days: ['lunes'] })
  await createHabit(page, { name: 'Segundo', days: ['lunes'] })
  await card(page, 'Segundo').getByRole('button', { name: 'Subir' }).click()
  const names = page.getByRole('region', { name: 'Activos' }).getByRole('heading', { level: 3 })
  await expect(names).toHaveText(['Segundo', 'Primero'])
  await page.reload()
  await expect(names).toHaveText(['Segundo', 'Primero'])
})

test('borrar lo manda a la papelera', async ({ page }) => {
  await createHabit(page, { name: 'Temporal', days: ['lunes'] })
  await card(page, 'Temporal').getByRole('button', { name: 'Borrar' }).click()
  await expect(page.getByRole('status')).toContainText('«Temporal» se movió a la papelera')
  await expect(card(page, 'Temporal')).toHaveCount(0)
  await page.reload()
  await expect(card(page, 'Temporal')).toHaveCount(0)
})

test('el formulario vacío muestra errores', async ({ page }) => {
  await page.getByRole('link', { name: 'Nuevo hábito' }).click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Escribe un nombre')).toBeVisible()
  await expect(page.getByText('Elige al menos un día')).toBeVisible()
  await page.getByRole('radio', { name: 'Cantidad' }).check()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Escribe la unidad')).toBeVisible()
  await expect(page.getByText('La meta debe ser mayor que 0')).toBeVisible()
})

test('el texto del usuario se muestra literal y no rompe el diseño a 320 px', async ({ page }) => {
  let dialog = false
  page.on('dialog', async (d) => {
    dialog = true
    await d.dismiss()
  })
  const evil = '<script>alert(1)</script> 🧠'
  await createHabit(page, { name: evil, days: ['lunes'] })
  await expect(page.getByRole('heading', { name: evil })).toBeVisible()
  const long = 'Palabra'.repeat(11) + 'xxx' // 80 caracteres sin espacios
  await createHabit(page, { name: long, days: ['lunes'] })
  await page.setViewportSize({ width: 320, height: 700 })
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(width).toBeLessThanOrEqual(320)
  expect(dialog).toBe(false)
})

test('lista y formulario sin violaciones de accesibilidad', async ({ page }) => {
  await createHabit(page, { name: 'Leer', days: ['lunes'] })
  await expectNoA11yViolations(page)
  await page.getByRole('link', { name: 'Nuevo hábito' }).click()
  await expectNoA11yViolations(page)
})
