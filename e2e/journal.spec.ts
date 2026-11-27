import { expect, test, type Page } from '@playwright/test'
import { createTestUser, expectNoA11yViolations, login, reloadSaved, type TestUser } from './helpers'

let user: TestUser

test.beforeEach(async () => {
  user = await createTestUser()
})

const openJournal = async (page: Page) => {
  await page.goto('/diario')
  await expect(page.getByRole('heading', { name: 'Diario, notas y tablas', level: 1 })).toBeVisible()
}

test('escribir, editar y eliminar la entrada de hoy', async ({ page }) => {
  await login(page, user)
  await openJournal(page)

  const area = page.getByLabel('¿Cómo fue hoy?')
  await expect(page.getByRole('button', { name: 'Guardar entrada' })).toBeDisabled()
  await area.fill('   ')
  await area.fill('Un buen día de trabajo profundo.')
  await expectNoA11yViolations(page)
  await page.getByRole('button', { name: 'Guardar entrada' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Guardado' })).toBeVisible()

  await reloadSaved(page)
  await expect(page.getByLabel('¿Cómo fue hoy?')).toHaveValue('Un buen día de trabajo profundo.')
  await expect(page.getByRole('list').getByText('Un buen día de trabajo profundo.')).toBeVisible()

  await page.getByLabel('¿Cómo fue hoy?').fill('Un buen día. Editado.')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Guardado' })).toBeVisible()
  await expect(page.getByRole('list').getByText('Un buen día. Editado.')).toBeVisible()

  await page.getByRole('button', { name: 'Eliminar' }).click()
  await page.getByRole('button', { name: 'Sí, eliminar' }).click()
  await expect(page.getByLabel('¿Cómo fue hoy?')).toHaveValue('')
  await expect(page.getByText('Aún no has escrito nada.')).toBeVisible()
})

test('más de 2000 caracteres se rechaza y se puede volver a un día anterior', async ({ page }) => {
  await login(page, user)
  await openJournal(page)
  await page.getByLabel('¿Cómo fue hoy?').fill('x'.repeat(2001))
  await page.getByRole('button', { name: 'Guardar entrada' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Máximo 2000' })).toBeVisible()

  await page.getByRole('link', { name: 'Día anterior' }).click()
  await expect(page).toHaveURL(/fecha=\d{4}-\d{2}-\d{2}/)
  await page.getByRole('textbox').fill('Ayer también escribí.')
  await page.getByRole('button', { name: 'Guardar entrada' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Guardado' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Día siguiente' })).toBeVisible()
})

test('el texto del diario se muestra escapado, nunca como HTML', async ({ page }) => {
  await login(page, user)
  await openJournal(page)
  await page.getByLabel('¿Cómo fue hoy?').fill('<img src=x onerror="window.__xss=1"> <b>negrita</b>')
  await page.getByRole('button', { name: 'Guardar entrada' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Guardado' })).toBeVisible()
  await expect(page.locator('.journal-list img, .journal-list b')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
})

test('notas: crear con Markdown y etiquetas, vista previa sanitizada, buscar, filtrar, papelera', async ({ page }) => {
  await login(page, user)
  await page.goto('/diario?vista=notas')
  await expect(page.getByText('Aún no tienes notas.')).toBeVisible()
  await expectNoA11yViolations(page)

  await page.getByRole('link', { name: 'Nueva nota' }).click()
  await page.getByLabel('Título').fill('Plan de lectura')
  await page.getByLabel('Etiquetas').fill('Estudio, #Libros, estudio')
  await page.getByLabel('Nota', { exact: true }).fill('# Objetivo\n\nLeer **veinte páginas** cada día.\n\n<script>window.__xss=1</script>\n<img src=x onerror="window.__xss=1">\n[malo](javascript:alert(1))')
  await page.getByRole('button', { name: 'Vista previa' }).click()
  const preview = page.getByLabel('Vista previa', { exact: true })
  await expect(preview.locator('h1')).toHaveText('Objetivo')
  await expect(preview.locator('strong')).toHaveText('veinte páginas')
  await expect(preview.locator('script, img')).toHaveCount(0)
  await expect(preview.locator('a[href^="javascript"]')).toHaveCount(0)
  await expectNoA11yViolations(page)
  await page.getByRole('button', { name: 'Crear nota' }).click()
  await expect(page).toHaveURL(/\/notas\/[0-9a-f-]{36}$/)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()

  await page.getByRole('link', { name: 'Volver' }).click()
  const list = page.getByRole('list', { name: 'Notas' })
  await expect(list.getByText('Plan de lectura')).toBeVisible()
  await expect(list.getByText('estudio', { exact: true })).toHaveCount(1) // sin repetidas
  await expect(list.getByText('libros', { exact: true })).toBeVisible()

  // búsqueda en español con raíz: "leyendo" no coincide, "páginas" sí
  await page.getByLabel('Buscar notas').fill('paginas')
  await expect(page.getByRole('list', { name: 'Resultados' }).getByText('Plan de lectura')).toBeVisible()
  await page.getByLabel('Buscar notas').fill('astronomía')
  await expect(page.getByText('No hay notas que coincidan.')).toBeVisible()
  await page.getByLabel('Buscar notas').fill('')

  await page.getByRole('button', { name: /^libros/ }).click()
  await expect(page.getByRole('list', { name: 'Resultados' }).getByText('Plan de lectura')).toBeVisible()
  await page.getByRole('button', { name: /^libros/ }).click()

  await page.getByRole('link', { name: /Plan de lectura/ }).click()
  await page.getByRole('button', { name: 'Eliminar' }).click()
  await page.getByRole('button', { name: 'Sí, eliminar' }).click()
  await expect(page.getByText('Aún no tienes notas.')).toBeVisible()
  await page.getByRole('button', { name: /Restaurar/ }).click()
  await expect(page.getByRole('list', { name: 'Notas' }).getByText('Plan de lectura')).toBeVisible()
})

test('Hoy enlaza al diario y a las notas', async ({ page }) => {
  await login(page, user)
  const card = page.getByRole('region', { name: 'Diario' })
  await expect(card).toBeVisible()
  await card.getByRole('link', { name: 'Escribir hoy' }).click()
  await expect(page.getByRole('heading', { name: 'Diario, notas y tablas', level: 1 })).toBeVisible()
})

test('a 320 px diario, notas y editor no desbordan', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await login(page, user)
  for (const url of ['/diario', '/diario?vista=notas', '/notas/nueva']) {
    await page.goto(url)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  }
})
