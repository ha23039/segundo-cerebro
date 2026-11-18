import { z } from 'zod'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const goalInputSchema = z.object({
  title: z.string().trim().min(1, 'Escribe un título').max(80, 'Máximo 80 caracteres'),
  description: z.string().trim().max(500, 'Máximo 500 caracteres').optional(),
  dueDate: z.string().regex(ISO_DATE, 'Elige una fecha límite'),
})

export type GoalInput = { title: string; description: string | null; dueDate: string }
export type GoalErrors = Partial<Record<'title' | 'description' | 'dueDate', string>>

/** `minDate`: la fecha límite no puede ser anterior (inicio del objetivo; al crear, hoy). */
export function validateGoal(input: unknown, minDate: string): { ok: true; data: GoalInput } | { ok: false; errors: GoalErrors } {
  const r = goalInputSchema.safeParse(input)
  const errors: GoalErrors = {}
  if (!r.success) {
    for (const issue of r.error.issues) errors[issue.path[0] as keyof GoalErrors] ??= issue.message
  } else if (r.data.dueDate < minDate) {
    errors.dueDate = 'La fecha límite no puede ser anterior al inicio'
  }
  if (r.success && Object.keys(errors).length === 0) {
    return { ok: true, data: { title: r.data.title, description: r.data.description || null, dueDate: r.data.dueDate } }
  }
  return { ok: false, errors }
}

export const milestoneTitleSchema = z.string().trim().min(1, 'Escribe el hito').max(120, 'Máximo 120 caracteres')
