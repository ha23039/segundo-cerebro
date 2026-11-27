import { expect, test, type Page } from '@playwright/test'
import { createTestUser, expectNoA11yViolations, login } from './helpers'

async function newTable(page: Page, name: string, template: RegExp | null = null) {
  await page.goto('/diario?vista=tablas')
  await page.getByRole('button', { name: 'Nueva tabla' }).click()
  await page.getByLabel('Nombre de la tabla').fill(name)
  if (template) await page.getByRole('radio', { name: template }).check()
  await page.getByRole('button', { name: 'Crear tabla' }).click()
  await expect(page).toHaveURL(/\/tablas\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
}

const cell = (page: Page, col: string, row = 1) => page.getByRole('button', { name: new RegExp(`^${col}, fila ${row}( \\(se calcula sola\\))?:`) })
const editor = (page: Page, col: string, row = 1) => page.getByRole('textbox', { name: `${col}, fila ${row}`, exact: true })

async function write(page: Page, col: string, text: string, row = 1) {
  await cell(page, col, row).click()
  await editor(page, col, row).fill(text)
  await editor(page, col, row).press('Enter')
}

test.beforeEach(async ({ page }) => {
  await login(page, await createTestUser())
})

test('journal de trading: escribir celdas, listas, casillas, ítems y fórmula con total; persiste', async ({ page }) => {
  await newTable(page, 'Mi trading', /Trading/)
  await page.getByRole('button', { name: 'Añadir fila' }).click()
  await expect(cell(page, 'Activo')).toBeVisible()

  await write(page, 'Activo', 'EURUSD')
  await write(page, 'Entrada', '100')
  await write(page, 'Salida', '130,5')
  await write(page, 'Cantidad', '2')
  await expect(cell(page, 'Resultado')).toContainText('61,00')
  await expect(page.locator('tfoot')).toContainText('61,00')

  await page.getByRole('combobox', { name: 'Tipo, fila 1' }).selectOption('Venta')
  await page.locator('[data-cell="0-0"]').fill('2026-11-26')
  await page.getByRole('checkbox', { name: 'Cerrada, fila 1' }).click()
  await expect(page.getByRole('checkbox', { name: 'Cerrada, fila 1' })).toHaveAttribute('aria-checked', 'true')

  // lista de ítems dentro de la celda
  await cell(page, 'Revisión').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nuevo ítem').fill('Revisar el stop')
  await dialog.getByRole('button', { name: 'Añadir' }).click()
  await dialog.getByLabel('Nuevo ítem').fill('Anotar la emoción')
  await dialog.getByRole('button', { name: 'Añadir' }).click()
  await dialog.getByRole('checkbox', { name: 'Revisar el stop' }).click()
  await expect(dialog.getByRole('checkbox', { name: 'Revisar el stop' })).toBeChecked()
  await dialog.getByRole('button', { name: 'Cerrar' }).click()
  await expect(cell(page, 'Revisión')).toContainText('1/2')

  await page.waitForLoadState('networkidle')
  await page.reload()
  await expect(cell(page, 'Activo')).toContainText('EURUSD')
  await expect(cell(page, 'Salida')).toContainText('130,5')
  await expect(cell(page, 'Resultado')).toContainText('61,00')
  await expect(page.getByRole('combobox', { name: 'Tipo, fila 1' })).toHaveValue('Venta')
  await expect(page.locator('[data-cell="0-0"]')).toHaveValue('2026-11-26')
  await expect(page.getByRole('checkbox', { name: 'Cerrada, fila 1' })).toHaveAttribute('aria-checked', 'true')
  await expect(cell(page, 'Revisión')).toContainText('1/2')
})

test('con teclado: flechas, escribir para reemplazar, Escape cancela y Supr vacía', async ({ page }) => {
  await newTable(page, 'Teclado', /Gastos/)
  await page.getByRole('button', { name: 'Añadir fila' }).click()
  await page.getByRole('button', { name: 'Añadir fila' }).click()
  await write(page, 'Concepto', 'Café', 1)
  await write(page, 'Importe', '2,5', 1)

  await cell(page, 'Concepto', 1).focus()
  await page.keyboard.press('ArrowDown')
  await expect(cell(page, 'Concepto', 2)).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(cell(page, 'Concepto', 1)).toBeFocused()
  await page.keyboard.type('Té')
  await expect(editor(page, 'Concepto', 1)).toHaveValue('Té')
  await page.keyboard.press('Escape')
  await expect(cell(page, 'Concepto', 1)).toContainText('Café')

  await page.keyboard.press('Enter')
  await page.keyboard.type(' con leche')
  await page.keyboard.press('Tab')
  await expect(cell(page, 'Concepto', 1)).toContainText('Café con leche')
  await expect(cell(page, 'Categoría', 1).or(page.getByRole('combobox', { name: 'Categoría, fila 1' }))).toBeFocused()

  await cell(page, 'Importe', 1).focus()
  await page.keyboard.press('Delete')
  await expect(cell(page, 'Importe', 1)).toHaveText('')
})

test('un número no válido avisa y no se guarda', async ({ page }) => {
  await newTable(page, 'Validación', /Gastos/)
  await page.getByRole('button', { name: 'Añadir fila' }).click()
  await cell(page, 'Importe').click()
  await editor(page, 'Importe').fill('abc')
  await editor(page, 'Importe').press('Enter')
  await expect(page.getByRole('alert')).toContainText('Escribe un número')
})

test('columnas: crear una de fórmula, validar, renombrar sin romper fórmulas y borrar', async ({ page }) => {
  await newTable(page, 'Columnas')
  await page.getByRole('button', { name: 'Nueva columna' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nombre').fill('Entrada')
  await dialog.getByLabel('Tipo').selectOption('numero')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('button', { name: /Editar columna Entrada/ })).toBeVisible()

  await page.getByRole('button', { name: 'Nueva columna' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nombre').fill('Doble')
  await dialog.getByLabel('Tipo').selectOption('formula')
  await dialog.getByLabel('Fórmula').fill('{Entrada} *')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog.getByRole('alert')).toContainText('incompleta')
  await dialog.getByLabel('Fórmula').fill('{Entrada} * 2')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('button', { name: /Editar columna Doble/ })).toBeVisible()

  await page.getByRole('button', { name: 'Añadir fila' }).click()
  await write(page, 'Entrada', '21')
  await expect(cell(page, 'Doble')).toContainText('42')

  // renombrar la columna citada: la fórmula se actualiza y sigue funcionando
  await page.getByRole('button', { name: /Editar columna Entrada/ }).click()
  await page.getByRole('dialog').getByLabel('Nombre').fill('Precio')
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('button', { name: /Editar columna Precio/ })).toBeVisible()
  await expect(cell(page, 'Doble')).toContainText('42')

  // un nombre repetido se rechaza
  await page.getByRole('button', { name: 'Nueva columna' }).click()
  await page.getByRole('dialog').getByLabel('Nombre').fill('precio')
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Ya hay una columna')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()

  // mover y borrar
  await page.getByRole('button', { name: /Editar columna Doble/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Mover a la izquierda' }).click()
  await expect(page.getByRole('columnheader').nth(1)).toContainText('Doble')
  await page.getByRole('dialog').getByRole('button', { name: 'Borrar columna' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, borrar columna' }).click()
  await expect(page.getByRole('button', { name: /Editar columna Doble/ })).toHaveCount(0)
})

test('ordenar por una columna y borrar una fila', async ({ page }) => {
  await newTable(page, 'Orden', /Gastos/)
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Añadir fila' }).click()
  await write(page, 'Importe', '5', 1)
  await write(page, 'Importe', '20', 2)
  await write(page, 'Importe', '1', 3)

  await page.getByLabel('Ordenar por').selectOption({ label: 'Importe' })
  await expect(cell(page, 'Importe', 1)).toContainText('1')
  await expect(cell(page, 'Importe', 3)).toContainText('20')
  await page.getByRole('button', { name: 'De menor a mayor' }).click()
  await expect(cell(page, 'Importe', 1)).toContainText('20')

  await page.getByRole('button', { name: 'Borrar fila 1' }).click()
  await page.getByRole('button', { name: 'Borrar fila 1' }).click()
  await expect(page.getByRole('row')).toHaveCount(1 + 2 + 1) // cabecera, dos filas y el pie con la suma
})

test('borrar una tabla la manda a la papelera y se puede restaurar', async ({ page }) => {
  await newTable(page, 'Temporal')
  await page.getByRole('button', { name: 'Borrar tabla' }).click()
  await page.getByRole('button', { name: 'Sí, borrar la tabla' }).click()
  await expect(page).toHaveURL(/vista=tablas/)
  await expect(page.getByRole('heading', { name: 'Tablas borradas' })).toBeVisible()
  await page.getByRole('button', { name: /Restaurar/ }).click()
  await expect(page.getByRole('link', { name: 'Temporal' })).toBeVisible()
})

test('accesibilidad y 320 px', async ({ page }) => {
  await newTable(page, 'Accesible', /Trading/)
  await page.getByRole('button', { name: 'Añadir fila' }).click()
  await write(page, 'Activo', 'EURUSD')
  await expectNoA11yViolations(page)

  await cell(page, 'Revisión').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expectNoA11yViolations(page)
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click()

  await page.setViewportSize({ width: 320, height: 700 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})
