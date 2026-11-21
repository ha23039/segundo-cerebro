export const MAX_TAGS = 10
export const MAX_TAG_LENGTH = 30

/** "Trabajo, ideas  #Lectura" -> ['trabajo', 'ideas', 'lectura'] (minúsculas, sin repetidas ni vacías). */
export function parseTags(input: string): string[] {
  const out: string[] = []
  for (const raw of input.split(/[,\n]/)) {
    const t = raw.trim().replace(/^#+/, '').trim().toLowerCase()
    if (t && !out.includes(t)) out.push(t)
  }
  return out
}

/** Mensaje de error si las etiquetas no cumplen los límites de la base de datos; null si valen. */
export function tagsError(tags: string[]): string | null {
  if (tags.length > MAX_TAGS) return `Máximo ${MAX_TAGS} etiquetas`
  if (tags.some((t) => t.length > MAX_TAG_LENGTH)) return `Cada etiqueta, máximo ${MAX_TAG_LENGTH} caracteres`
  return null
}

/** Etiquetas de todas las notas, de más a menos usadas. */
export function tagCounts(notes: { tags: string[] }[]): { tag: string; count: number }[] {
  const m = new Map<string, number>()
  for (const n of notes) for (const t of n.tags) m.set(t, (m.get(t) ?? 0) + 1)
  return [...m].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'es'))
}
