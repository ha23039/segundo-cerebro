import { z } from 'zod'

const FREQ_RANGE = 'Entre 1 y 7 veces por semana'

const frequencySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('dias'),
    days: z
      .array(z.number().int().min(1).max(7))
      .min(1, 'Elige al menos un día')
      .refine((d) => new Set(d).size === d.length, 'Días repetidos'),
  }),
  z.object({
    kind: z.literal('semanal'),
    timesPerWeek: z.number({ error: FREQ_RANGE }).int(FREQ_RANGE).min(1, FREQ_RANGE).max(7, FREQ_RANGE),
  }),
])

export const habitInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Escribe un nombre').max(80, 'Máximo 80 caracteres'),
    kind: z.enum(['check', 'cantidad']),
    unit: z.string().trim().max(20, 'Máximo 20 caracteres').optional(),
    target: z.number().optional(),
    frequency: frequencySchema,
  })
  .superRefine((v, ctx) => {
    if (v.kind !== 'cantidad') return
    if (!v.unit) ctx.addIssue({ code: 'custom', path: ['unit'], message: 'Escribe la unidad' })
    if (v.target === undefined || !Number.isFinite(v.target) || v.target <= 0) {
      ctx.addIssue({ code: 'custom', path: ['target'], message: 'La meta debe ser mayor que 0' })
    } else if (v.target > 100000) {
      ctx.addIssue({ code: 'custom', path: ['target'], message: 'Máximo 100000' })
    }
  })
  .transform((v) =>
    v.kind === 'cantidad'
      ? v
      : { name: v.name, kind: v.kind, frequency: v.frequency },
  )

export type HabitInput = z.infer<typeof habitInputSchema>

export type HabitErrors = Partial<Record<'name' | 'kind' | 'unit' | 'target' | 'frequency', string>>

export function validateHabit(input: unknown): { ok: true; data: HabitInput } | { ok: false; errors: HabitErrors } {
  const r = habitInputSchema.safeParse(input)
  if (r.success) return { ok: true, data: r.data }
  const errors: HabitErrors = {}
  for (const issue of r.error.issues) {
    const key = issue.path[0] as keyof HabitErrors
    errors[key] ??= issue.message
  }
  return { ok: false, errors }
}
