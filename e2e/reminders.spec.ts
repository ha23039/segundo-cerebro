import { expect, test } from '@playwright/test'
import { createTestUser, expectNoA11yViolations, login } from './helpers'

test('en iPhone, fuera de la app instalada, explica cómo instalarla', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'solo el proyecto de iPhone')
  await login(page, await createTestUser())
  await page.goto('/ajustes')
  await expect(page.getByRole('heading', { name: 'Recordatorios' })).toBeVisible()
  await expect(page.getByText('Añadir a pantalla de inicio')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Activar avisos' })).toHaveCount(0)
})

test('activar los avisos guarda este dispositivo y las preferencias; desactivar los quita', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'la suscripción real solo se simula en Chromium')
  await page.addInitScript(() => {
    // Sin servicio de push real: se simulan el permiso y la suscripción (guardada en la sesión para sobrevivir a recargar)
    Object.defineProperty(Notification, 'requestPermission', { value: async () => 'granted' })
    const fake = {
      endpoint: 'https://push.example.test/e2e/dispositivo-1',
      toJSON: () => ({ endpoint: 'https://push.example.test/e2e/dispositivo-1', keys: { p256dh: 'BPublica', auth: 'secreto' } }),
      unsubscribe: async () => {
        sessionStorage.removeItem('fake-sub')
        return true
      },
    }
    PushManager.prototype.getSubscription = async () => (sessionStorage.getItem('fake-sub') ? (fake as unknown as PushSubscription) : null)
    PushManager.prototype.subscribe = async () => {
      sessionStorage.setItem('fake-sub', '1')
      return fake as unknown as PushSubscription
    }
  })
  const user = await createTestUser()
  await login(page, user)
  await page.goto('/ajustes')

  await expect(page.getByRole('heading', { name: 'Recordatorios' })).toBeVisible()
  await page.getByRole('button', { name: 'Activar avisos' }).click()
  await expect(page.getByRole('button', { name: 'Desactivar en este dispositivo' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /A la hora de cada hábito/ })).toBeChecked()

  await page.getByRole('checkbox', { name: /Revisión semanal/ }).click()
  await expect(page.getByRole('checkbox', { name: /Revisión semanal/ })).not.toBeChecked()
  await page.waitForLoadState('networkidle')
  await page.reload()
  await expect(page.getByRole('checkbox', { name: /Revisión semanal/ })).not.toBeChecked()
  await expectNoA11yViolations(page)

  await page.getByRole('button', { name: 'Desactivar en este dispositivo' }).click()
  await expect(page.getByRole('button', { name: 'Activar avisos' })).toBeVisible()
})
