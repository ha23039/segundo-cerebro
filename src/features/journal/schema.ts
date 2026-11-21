import { z } from 'zod'
import { parseTags, tagsError } from './domain/tags'

export const JOURNAL_MAX = 2000
export const NOTE_TITLE_MAX = 120
export const NOTE_BODY_MAX = 20000

const journalBody = z.string().trim().min(1, 'Escribe algo antes de guardar').max(JOURNAL_MAX, `Máximo ${JOURNAL_MAX} caracteres`)

export function validateJournal(body: string): { ok: true; body: string } | { ok: false; error: string } {
  const r = journalBody.safeParse(body)
  return r.success ? { ok: true, body: r.data } : { ok: false, error: r.error.issues[0]!.message }
}

const noteSchema = z.object({
  title: z.string().trim().min(1, 'Escribe un título').max(NOTE_TITLE_MAX, `Máximo ${NOTE_TITLE_MAX} caracteres`),
  body: z.string().max(NOTE_BODY_MAX, `Máximo ${NOTE_BODY_MAX} caracteres`),
})

export interface NoteInput {
  title: string
  body: string
  tags: string[]
  pinned: boolean
}
export type NoteErrors = Partial<Record<'title' | 'body' | 'tags', string>>

export function validateNote(input: { title: string; body: string; tags: string; pinned: boolean }): { ok: true; data: NoteInput } | { ok: false; errors: NoteErrors } {
  const r = noteSchema.safeParse({ title: input.title, body: input.body })
  const errors: NoteErrors = {}
  if (!r.success) for (const issue of r.error.issues) errors[issue.path[0] as 'title' | 'body'] ??= issue.message
  const tags = parseTags(input.tags)
  const te = tagsError(tags)
  if (te) errors.tags = te
  if (!r.success || te) return { ok: false, errors }
  return { ok: true, data: { title: r.data.title, body: r.data.body, tags, pinned: input.pinned } }
}
