import { parseNumber } from './cells'
import type { Cells, TableColumn } from './types'

/** Celdas con las que nace una fila nueva según el valor por defecto de cada columna (`today` es la fecha de hoy, AAAA-MM-DD). */
export function defaultCells(columns: readonly TableColumn[], today: string): Cells {
  const cells: Cells = {}
  for (const c of columns) {
    const d = c.options.default
    if (!d) continue
    if (c.type === 'texto') cells[c.id] = d
    else if (c.type === 'numero') {
      const n = parseNumber(d)
      if (n !== null) cells[c.id] = n
    } else if (c.type === 'fecha') {
      if (d === 'hoy') cells[c.id] = today
    } else if (c.type === 'lista') {
      if ((c.options.choices ?? []).includes(d)) cells[c.id] = d
    } else if (c.type === 'casilla') {
      if (d === 'si') cells[c.id] = true
    }
  }
  return cells
}

/** Copia de una fila para duplicarla: sin las fórmulas (se recalculan solas) ni valores vacíos. */
export function duplicateCells(columns: readonly TableColumn[], cells: Cells): Cells {
  const out: Cells = {}
  for (const c of columns) {
    if (c.type === 'formula') continue
    const v = cells[c.id]
    if (v !== undefined) out[c.id] = Array.isArray(v) ? v.map((i) => ({ ...i })) : v
  }
  return out
}
