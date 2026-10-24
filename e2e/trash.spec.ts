import { expect, test } from '@playwright/test'
import { createTestUser, expectNoA11yViolations, login, seedHabit } from './helpers'

test('restaurar un hábito borrado conserva sus registros', async ({ page }) => {
  const user = await createTestUser()
  await seedHabit(user, { name: 'Leer' })
  await login(page, user)

  // Marcar hoy y borrar el hábito
  await page.getByRole('button', { name: 'Leer' }).click()
  await expect(page.getByRole('button', { name: 'Leer' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('link', { name: 'Hábitos' }).click()
  await page.getByRole('listitem').filter({ hasText: 'Leer' }).getByRole('button', { name: 'Borrar' }).click()
  await expect(page.getByRole('status')).toContainText('se movió a la papelera')

  // Aparece en la papelera con la fecha de eliminación definitiva
  await page.getByRole('link', { name: 'Ajustes' }).click()
  const trash = page.getByRole('region', { name: 'Papelera' })
  const purge = new Date(Date.now() + 30 * 86_400_000)
  const expected = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }).format(purge)
  await expect(trash.getByRole('listitem').filter({ hasText: 'Leer' })).toContainText(`se elimina definitivamente el ${expected}`)
  await expectNoA11yViolations(page)

  await trash.getByRole('button', { name: 'Restaurar Leer' }).click()
  await expect(trash.getByText('La papelera está vacía')).toBeVisible()

  // Vuelve con su registro de hoy intacto
  await page.getByRole('link', { name: 'Hoy' }).click()
  await expect(page.getByRole('button', { name: 'Leer' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('listitem').filter({ hasText: 'Leer' })).toContainText('1 día')
})
