import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

export interface TestUser {
  id: string
  email: string
  password: string
}

function admin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Faltan SUPABASE_URL / SUPABASE_SECRET_KEY en .env.local')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Crea un usuario confirmado con correo único. Los registros públicos están desactivados. */
export async function createTestUser(): Promise<TestUser> {
  const email = `e2e-${randomUUID()}@test.local`
  const password = `Pw-${randomUUID()}`
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw error ?? new Error('No se creó el usuario')
  return { id: data.user.id, email, password }
}

export async function login(page: Page, user: Pick<TestUser, 'email' | 'password'>): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Correo').fill(user.email)
  await page.getByLabel('Contraseña').fill(user.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Hoy', level: 1 })).toBeVisible()
}

/** Falla si axe encuentra violaciones serias o críticas. */
export async function expectNoA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
}
