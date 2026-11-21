/** Texto plano corto para la vista de lista (sin marcas de Markdown). */
export function excerpt(body: string, max = 140): string {
  const t = body.replace(/[#*_`>~[\]]|\(https?:[^)]*\)/g, '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t
}
