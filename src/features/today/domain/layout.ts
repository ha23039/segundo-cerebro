/** Tarjetas de Hoy que se pueden ordenar y ocultar. El orden predeterminado es el de esta lista. */
export const BLOCKS = [
  { id: 'resumen', label: 'Puntuación de hoy', wide: true },
  { id: 'rendimiento', label: 'Semana, mes y racha', wide: true },
  { id: 'habitos', label: 'Hábitos de hoy', wide: true },
  { id: 'foco', label: 'Foco', wide: false },
  { id: 'prioridades', label: 'Prioridades', wide: false },
  { id: 'horario', label: 'Lo que queda de hoy', wide: false },
  { id: 'objetivos', label: 'Objetivos que vencen', wide: false },
  { id: 'diario', label: 'Diario', wide: false },
  { id: 'descanso', label: 'Descanso', wide: false },
  { id: 'grafica', label: 'Gráfica de la semana', wide: false },
  { id: 'areas', label: 'Por área', wide: false },
] as const

export type BlockId = (typeof BLOCKS)[number]['id']
export const DEFAULT_ORDER: BlockId[] = BLOCKS.map((b) => b.id)
const KNOWN = new Set<string>(DEFAULT_ORDER)
const isBlock = (v: unknown): v is BlockId => typeof v === 'string' && KNOWN.has(v)

export interface TodayLayout {
  order: BlockId[]
  hidden: BlockId[]
}

export const DEFAULT_LAYOUT: TodayLayout = { order: DEFAULT_ORDER, hidden: [] }

export const blockLabel = (id: BlockId): string => BLOCKS.find((b) => b.id === id)!.label
export const isWide = (id: BlockId): boolean => BLOCKS.find((b) => b.id === id)!.wide

const uniqueKnown = (v: unknown): BlockId[] => {
  if (!Array.isArray(v)) return []
  const out: BlockId[] = []
  for (const x of v) if (isBlock(x) && !out.includes(x)) out.push(x)
  return out
}

/**
 * Lo guardado en la BD (cualquier cosa) -> un orden completo y válido: se descartan ids desconocidos y repetidos y
 * las tarjetas nuevas (de versiones posteriores) se añaden al final, así que una tarjeta nunca desaparece por error.
 */
export function resolveLayout(saved: unknown): TodayLayout {
  const obj = saved && typeof saved === 'object' && !Array.isArray(saved) ? (saved as Record<string, unknown>) : {}
  const order = uniqueKnown(obj.order)
  for (const id of DEFAULT_ORDER) if (!order.includes(id)) order.push(id)
  return { order, hidden: uniqueKnown(obj.hidden) }
}

export function move(order: readonly BlockId[], from: number, to: number): BlockId[] {
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return [...order]
  const next = [...order]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}

export function toggleHidden(layout: TodayLayout, id: BlockId): TodayLayout {
  return { ...layout, hidden: layout.hidden.includes(id) ? layout.hidden.filter((h) => h !== id) : [...layout.hidden, id] }
}

export const isDefault = (l: TodayLayout): boolean => l.hidden.length === 0 && l.order.every((id, i) => id === DEFAULT_ORDER[i])

/** Sube o baja una tarjeta entre las visibles (las ocultas no cuentan como vecinas). */
export function moveVisible(layout: TodayLayout, id: BlockId, dir: -1 | 1): TodayLayout {
  const visible = layout.order.filter((b) => !layout.hidden.includes(b))
  const neighbour = visible[visible.indexOf(id) + dir]
  if (!neighbour) return layout
  return { ...layout, order: move(layout.order, layout.order.indexOf(id), layout.order.indexOf(neighbour)) }
}
