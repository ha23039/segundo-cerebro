import { readFile, writeFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { createTestUser, expectNoA11yViolations, login } from './helpers'

async function newTable(page: Page, name: string, template: RegExp | null = null) {
  await page.goto('/tablas')
  await page.getByRole('button', { name: 'Nueva tabla' }).click()
  await page.getByLabel('Nombre de la tabla').fill(name)
  if (template) await page.getByRole('radio', { name: template }).check()
  await page.getByRole('button', { name: 'Crear tabla' }).click()
  await expect(page).toHaveURL(/\/tablas\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
}

async function menu(page: Page, item: string) {
  await page.getByRole('button', { name: 'Más opciones' }).click()
  await page.getByRole('menuitem', { name: item }).click()
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
  await expect(cell(page, 'Entrada')).toBeVisible()

  await write(page, 'Entrada', '1,0850')
  await write(page, 'Riesgo', '50')
  await write(page, 'Resultado', '125')
  await expect(cell(page, 'R')).toContainText('2,50')
  await expect(page.locator('tfoot')).toContainText('125,00')

  await page.getByRole('combobox', { name: 'Dirección, fila 1' }).selectOption('Venta')
  await page.locator('[data-cell="0-0"]').fill('2026-11-26')
  // los 28 pares se eligen con un buscador
  await cell(page, 'Par').click()
  const picker = page.getByRole('dialog')
  await expect(picker.getByRole('button', { name: /\//u })).toHaveCount(28)
  await picker.getByRole('searchbox', { name: 'Buscar opción' }).fill('gbpjpy')
  await expect(picker.getByRole('button', { name: /\// })).toHaveCount(1)
  await picker.getByRole('button', { name: 'GBP/JPY' }).click()
  await expect(cell(page, 'Par')).toContainText('GBP/JPY')

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
  await expect(cell(page, 'Entrada')).toContainText('1,085')
  await expect(cell(page, 'R')).toContainText('2,50')
  await expect(page.getByRole('combobox', { name: 'Dirección, fila 1' })).toHaveValue('Venta')
  await expect(cell(page, 'Par')).toContainText('GBP/JPY')
  await expect(page.locator('[data-cell="0-0"]')).toHaveValue('2026-11-26')
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
  // el foco vuelve a la celda en el cuadro siguiente: sin esperarlo, Enter caería en el vacío
  await expect(cell(page, 'Concepto', 1)).toBeFocused()

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
  await menu(page, 'Nueva columna')
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nombre').fill('Entrada')
  await dialog.getByLabel('Tipo').selectOption('numero')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('button', { name: /Editar columna Entrada/ })).toBeVisible()

  await menu(page, 'Nueva columna')
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
  await menu(page, 'Nueva columna')
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

  await page.getByRole('button', { name: /^Filtros/ }).click()
  await page.getByLabel('Ordenar por').selectOption({ label: 'Importe' })
  await expect(cell(page, 'Importe', 1)).toContainText('1')
  await expect(cell(page, 'Importe', 3)).toContainText('20')
  await page.getByRole('button', { name: 'De menor a mayor' }).click()
  await expect(cell(page, 'Importe', 1)).toContainText('20')

  await page.getByRole('button', { name: 'Abrir fila 1' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Borrar fila' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, borrar la fila' }).click()
  await expect(page.getByRole('row')).toHaveCount(1 + 2 + 1) // cabecera, dos filas y el pie con la suma
})

test('borrar una tabla la manda a la papelera y se puede restaurar', async ({ page }) => {
  await newTable(page, 'Temporal')
  await menu(page, 'Borrar tabla')
  await page.getByRole('button', { name: 'Sí, borrar la tabla' }).click()
  await expect(page).toHaveURL(/\/tablas$/)
  await expect(page.getByRole('heading', { name: 'Tablas borradas' })).toBeVisible()
  await page.getByRole('button', { name: /Restaurar/ }).click()
  await expect(page.getByRole('link', { name: 'Temporal' })).toBeVisible()
})

test('accesibilidad y 320 px', async ({ page }) => {
  await newTable(page, 'Accesible', /Trading/)
  await page.getByRole('button', { name: 'Añadir fila' }).click()
  await write(page, 'Notas', 'Entrada limpia')
  await expectNoA11yViolations(page)

  await page.getByRole('button', { name: 'Más opciones' }).click()
  await expect(page.getByRole('menuitem', { name: 'Nueva columna' })).toBeFocused()
  await expectNoA11yViolations(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Más opciones' })).toBeFocused()

  await cell(page, 'Revisión').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expectNoA11yViolations(page)
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click()

  await page.setViewportSize({ width: 320, height: 700 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})

test('una columna de texto se convierte en lista y conserva lo escrito', async ({ page }) => {
  await newTable(page, 'Convertir')
  await menu(page, 'Nueva columna')
  await page.getByLabel('Nombre', { exact: true }).fill('Par')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('button', { name: /Editar columna Par/ })).toBeVisible()
  await page.getByRole('button', { name: 'Añadir fila' }).click()
  await write(page, 'Par', 'EUR/USD')
  await page.getByRole('button', { name: 'Añadir fila' }).click()
  await write(page, 'Par', 'GBP/JPY', 2)

  await page.getByRole('button', { name: /Editar columna Par/ }).click()
  await page.getByLabel('Tipo').selectOption('lista')
  // las opciones se proponen a partir de lo ya escrito
  await expect(page.getByLabel(/Opciones/)).toHaveValue('EUR/USD\nGBP/JPY')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('combobox', { name: 'Par, fila 1' })).toHaveValue('EUR/USD')
  await expect(page.getByRole('combobox', { name: 'Par, fila 2' })).toHaveValue('GBP/JPY')
})

test('las tablas tienen su acceso directo en el menú y se crean desde ahí', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Tablas' }).click()
  await expect(page).toHaveURL(/\/tablas$/)
  await expect(page.getByRole('heading', { name: 'Tablas', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Nueva tabla' }).click()
  await page.getByLabel('Nombre de la tabla').fill('Gastos de casa')
  await page.getByRole('radio', { name: /Gastos/ }).check()
  await page.getByRole('button', { name: 'Crear tabla' }).click()
  await expect(page).toHaveURL(/\/tablas\/[0-9a-f-]{36}$/)
  await page.getByRole('link', { name: 'Volver a las tablas' }).click()
  await expect(page).toHaveURL(/\/tablas$/)
  await expect(page.getByRole('link', { name: 'Gastos de casa' })).toBeVisible()
})

test('filtros, vistas guardadas y análisis de resultados', async ({ page }) => {
  await newTable(page, 'Análisis', /Trading/)
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Añadir fila' }).click()
  await expect(cell(page, 'Resultado', 3)).toBeVisible()
  await write(page, 'Resultado', '100', 1)
  await write(page, 'Resultado', '-40', 2)
  await write(page, 'Resultado', '20', 3)

  await page.getByText(/^Análisis de/).click()
  const stats = page.locator('.an-stats')
  await expect(stats).toContainText('Operaciones3')
  await expect(stats).toContainText('Acierto67 %')
  await expect(stats).toContainText('Total80,00')
  await expect(stats).toContainText('Drawdown máx.40,00')
  await expect(page.getByRole('img', { name: /Curva de equity/ })).toBeVisible()

  // filtro rápido: solo pérdidas
  await page.getByRole('button', { name: /^Filtros/ }).click()
  await page.getByRole('button', { name: 'Solo pérdidas' }).click()
  await expect(page.getByRole('status')).toContainText('1 de 3 filas')
  await expect(stats).toContainText('Operaciones1')
  await expect(stats).toContainText('Total-40,00')
  // pérdidas y ganancias se excluyen entre sí
  await page.getByRole('button', { name: 'Solo ganancias' }).click()
  await expect(page.getByRole('status')).toContainText('2 de 3 filas')
  await page.getByRole('button', { name: 'Solo pérdidas' }).click()
  await expect(page.getByRole('status')).toContainText('1 de 3 filas')

  // se guarda como vista y se recupera
  await page.getByLabel('Nombre de la vista').fill('Pérdidas')
  await page.getByRole('button', { name: 'Guardar vista' }).click()
  await page.getByRole('button', { name: 'Quitar todos' }).click()
  await expect(stats).toContainText('Operaciones3')
  await page.getByRole('button', { name: 'Pérdidas', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('1 de 3 filas')

  // la vista y los filtros se recuerdan al recargar
  await page.reload()
  await expect(page.getByRole('status')).toContainText('1 de 3 filas')

  // agrupar por una columna
  await page.getByRole('button', { name: 'Quitar todos' }).click()
  await page.getByText(/^Análisis de/).click()
  await page.getByLabel('Agrupar por').selectOption({ label: 'Dirección' })
  await expect(page.getByRole('table', { name: /Resultado por Dirección/ })).toContainText('Sin valor')

  await page.getByRole('button', { name: /^Filtros/ }).click()
  await page.getByRole('button', { name: 'Filtro propio' }).click()
  await expectNoA11yViolations(page)
  await page.setViewportSize({ width: 320, height: 700 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
})

test('ficha de una fila: editar campos, duplicar y borrar', async ({ page }) => {
  await newTable(page, 'Ficha', /Gastos/)
  await page.getByRole('button', { name: 'Añadir fila' }).click()
  await page.getByRole('button', { name: 'Abrir fila 1' }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Concepto').fill('Supermercado')
  await d.getByLabel('Importe').fill('42,5')
  await d.getByLabel('Importe').press('Enter')
  await d.getByLabel('Categoría').selectOption('Comida')
  await d.getByLabel('Importe').fill('abc')
  await d.getByLabel('Importe').press('Enter')
  await expect(d.getByRole('alert')).toContainText('Escribe un número')
  await d.getByLabel('Importe').fill('42,5')
  await d.getByLabel('Importe').press('Enter')
  await expectNoA11yViolations(page)

  await d.getByRole('button', { name: 'Duplicar fila' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(cell(page, 'Concepto', 2)).toContainText('Supermercado')
  await expect(cell(page, 'Importe', 2)).toContainText('42,5')
  await expect(page.getByRole('combobox', { name: 'Categoría, fila 2' })).toHaveValue('Comida')
  await expect(page.locator('tfoot')).toContainText('85,00')

  await page.waitForLoadState('networkidle')
  await page.reload()
  await expect(cell(page, 'Concepto', 2)).toContainText('Supermercado')
})

test('valores por defecto en las filas nuevas', async ({ page }) => {
  await newTable(page, 'Defaults')
  await menu(page, 'Nueva columna')
  let d = page.getByRole('dialog')
  await d.getByLabel('Nombre', { exact: true }).fill('Fecha')
  await d.getByLabel('Tipo').selectOption('fecha')
  await d.getByLabel('Poner la fecha de hoy en las filas nuevas').check()
  await d.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('button', { name: /Editar columna Fecha/ })).toBeVisible()

  await menu(page, 'Nueva columna')
  d = page.getByRole('dialog')
  await d.getByLabel('Nombre', { exact: true }).fill('Moneda')
  await d.getByLabel('Valor por defecto').fill('EUR')
  await d.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('button', { name: /Editar columna Moneda/ })).toBeVisible()

  await page.getByRole('button', { name: 'Añadir fila' }).click()
  await expect(cell(page, 'Moneda')).toContainText('EUR')
  await expect(page.locator('[data-cell="0-0"]')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/)
})

test('exportar una tabla a CSV e importarla de nuevo en otra', async ({ page }, testInfo) => {
  await newTable(page, 'Origen', /Gastos/)
  await page.getByRole('button', { name: 'Añadir fila' }).click()
  await write(page, 'Concepto', 'Café, con "leche"')
  await write(page, 'Importe', '2,5')
  await page.getByRole('combobox', { name: 'Categoría, fila 1' }).selectOption('Comida')
  await expect(page.getByRole('combobox', { name: 'Categoría, fila 1' })).toHaveValue('Comida')

  await page.getByRole('button', { name: 'Más opciones' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Exportar CSV' }).click()])
  expect(download.suggestedFilename()).toBe('origen.csv')
  const csv = await readFile((await download.path())!, 'utf8')
  expect(csv).toContain('Fecha,Concepto,Categoría,Importe')
  expect(csv).toContain('"Café, con ""leche""",Comida,2.5')

  // un archivo propio, con formato español, para otra tabla
  const file = testInfo.outputPath('gastos.csv')
  await writeFile(file, 'Concepto;Importe;Categoría;Banco\n"Cena; fuera";"1.234,50";ocio;ING\nTaxi;12;Inventada;ING\n')
  await newTable(page, 'Destino', /Gastos/)
  await menu(page, 'Importar CSV')
  await page.getByLabel('Archivo CSV para importar').setInputFiles(file)
  const d = page.getByRole('dialog')
  await expect(d).toContainText('Se añadirán 2 filas')
  await expect(d).toContainText('Sin coincidencia, se ignoran: Banco')
  await expect(d).toContainText('1 valor no encaja')
  await expectNoA11yViolations(page)
  await d.getByRole('button', { name: 'Importar' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(cell(page, 'Concepto', 1)).toContainText('Cena; fuera')
  await expect(cell(page, 'Importe', 1)).toContainText('1234,5')
  await expect(page.getByRole('combobox', { name: 'Categoría, fila 1' })).toHaveValue('Ocio')
  await expect(cell(page, 'Concepto', 2)).toContainText('Taxi')
  await expect(page.getByRole('combobox', { name: 'Categoría, fila 2' })).toHaveValue('')
})
