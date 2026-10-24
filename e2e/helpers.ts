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

/** Crea un hábito como el usuario (RPC con su sesión) y, si se pide, adelanta su inicio `backdateDays` días. */
export async function seedHabit(
  user: TestUser,
  habit: { name: string; kind?: 'check' | 'cantidad'; unit?: string; target?: number; days?: number[]; perWeek?: number },
  backdateDays = 0,
): Promise<string> {
  const client = createClient(process.env.SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: authError } = await client.auth.signInWithPassword({ email: user.email, password: user.password })
  if (authError) throw authError
  const kind = habit.kind ?? 'check'
  const { data: id, error } = await client.rpc('create_habit', {
    p_name: habit.name,
    p_kind: kind,
    p_unit: kind === 'cantidad' ? (habit.unit ?? 'unidades') : null,
    p_frequency: habit.perWeek ? 'semanal' : 'dias',
    p_days: habit.perWeek ? null : (habit.days ?? [1, 2, 3, 4, 5, 6, 7]),
    p_times_per_week: habit.perWeek ?? null,
    p_target: kind === 'cantidad' ? (habit.target ?? 1) : null,
  })
  if (error) throw error
  if (backdateDays > 0) {
    const db = admin()
    const { data: rows, error: e1 } = await db.from('habit_schedules').select('id, valid_from').eq('habit_id', id)
    if (e1) throw e1
    for (const r of rows) {
      const from = new Date(`${r.valid_from}T00:00:00Z`)
      from.setUTCDate(from.getUTCDate() - backdateDays)
      const { error: e2 } = await db.from('habit_schedules').update({ valid_from: from.toISOString().slice(0, 10) }).eq('id', r.id)
      if (e2) throw e2
    }
  }
  return id as string
}

/** Instante UTC de la última medianoche de Madrid anterior a `now`. */
export function lastMadridMidnight(now = new Date()): Date {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })
  const today = fmt.format(now)
  // La medianoche local es 22:00 o 23:00 UTC del día anterior según el horario de verano
  for (const offsetHours of [1, 2]) {
    const t = new Date(Date.parse(`${today}T00:00:00Z`) - offsetHours * 3_600_000)
    if (fmt.format(t) === today && fmt.format(new Date(t.getTime() - 1)) !== today) return t
  }
  throw new Error('No se pudo calcular la medianoche de Madrid')
}
