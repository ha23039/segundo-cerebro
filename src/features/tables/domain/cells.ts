import { isError, type FormulaResult } from './formula'
import { LIMITS, type CellValue, type Item, type TableColumn } from './types'

export type Sanitized = { ok: true; value: CellValue } | { ok: false; error: string }

const ok = (value: CellValue): Sanitized => ({ ok: true, value })
const bad = (error: string): Sanitized => ({ ok: false, error })

/** Acepta `12,5`, `12.5` y `1.234,56` (si hay coma, los puntos son separadores de miles). */
export function parseNumber(text: string): number | null {
  let s = text.trim().replace(/\s/g, '')
  if (!s) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/** Limpia y valida lo que se escribe en una celda según el tipo de su columna. Vacío es `undefined` (no se guarda). */
export function sanitizeCell(col: TableColumn, raw: unknown): Sanitized {
  switch (col.type) {
    case 'texto': {
      const s = typeof raw === 'string' ? raw.trim() : ''
      if (s.length > LIMITS.text) return bad(`Máximo ${LIMITS.text} caracteres`)
      return ok(s || undefined)
    }
    case 'numero': {
      if (raw === undefined || raw === null || raw === '') return ok(undefined)
      const n = typeof raw === 'number' ? raw : parseNumber(String(raw))
      if (n === null || !Number.isFinite(n)) return bad('Escribe un número')
      if (Math.abs(n) > LIMITS.numberMax) return bad('Número demasiado grande')
      return ok(n)
    }
    case 'fecha': {
      const s = typeof raw === 'string' ? raw.trim() : ''
      if (!s) return ok(undefined)
      return validDate(s) ? ok(s) : bad('Fecha no válida')
    }
    case 'lista': {
      const s = typeof raw === 'string' ? raw : ''
      if (!s) return ok(undefined)
      return (col.options.choices ?? []).includes(s) ? ok(s) : bad('Esa opción no existe en la lista')
    }
    case 'casilla':
      return ok(raw === true ? true : undefined)
    case 'items': {
      if (!Array.isArray(raw)) return ok(undefined)
      const items: Item[] = []
      for (const it of raw as { t?: unknown; d?: unknown }[]) {
        const t = typeof it?.t === 'string' ? it.t.trim() : ''
        if (!t) continue
        if (t.length > LIMITS.itemText) return bad(`Cada ítem admite hasta ${LIMITS.itemText} caracteres`)
        items.push({ t, d: it.d === true })
      }
      if (items.length > LIMITS.items) return bad(`Máximo ${LIMITS.items} ítems`)
      return ok(items.length ? items : undefined)
    }
    case 'formula':
      return bad('Las fórmulas se calculan solas')
  }
}

export function formatNumber(n: number, decimals?: number): string {
  const d = decimals === undefined ? undefined : Math.min(10, Math.max(0, decimals))
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: d ?? 6, minimumFractionDigits: d ?? 0 }).format(n)
}

export function formatResult(r: FormulaResult, decimals?: number): string {
  if (isError(r)) return r.e
  return r.v === null ? '' : formatNumber(r.v, decimals)
}

const DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** Texto de una celda para mostrarla (las de fórmula pasan su resultado ya calculado). */
export function displayCell(col: TableColumn, value: CellValue, result?: FormulaResult): string {
  switch (col.type) {
    case 'formula':
      return result ? formatResult(result, col.options.decimals) : ''
    case 'numero':
      return typeof value === 'number' ? formatNumber(value, col.options.decimals) : ''
    case 'fecha':
      return typeof value === 'string' && validDate(value) ? DATE.format(new Date(`${value}T00:00:00Z`)) : ''
    case 'casilla':
      return value === true ? 'Sí' : ''
    case 'items': {
      const items = Array.isArray(value) ? value : []
      if (items.length === 0) return ''
      const done = items.filter((i) => i.d).length
      return `${done}/${items.length}`
    }
    default:
      return typeof value === 'string' ? value : ''
  }
}

/** Orden de filas por una columna: vacías siempre al final. */
export function compareCells(col: TableColumn, a: CellValue, b: CellValue, resultA?: FormulaResult, resultB?: FormulaResult): number {
  const key = (v: CellValue, r?: FormulaResult): number | string | null => {
    if (col.type === 'formula') return r && !isError(r) ? r.v : null
    if (col.type === 'numero') return typeof v === 'number' ? v : null
    if (col.type === 'casilla') return v === true ? 1 : null
    if (col.type === 'items') return Array.isArray(v) && v.length ? v.filter((i) => i.d).length / v.length : null
    return typeof v === 'string' && v ? v.toLowerCase() : null
  }
  const x = key(a, resultA)
  const y = key(b, resultB)
  if (x === null && y === null) return 0
  if (x === null) return 1
  if (y === null) return -1
  if (typeof x === 'number' && typeof y === 'number') return x - y
  return String(x).localeCompare(String(y), 'es')
}
