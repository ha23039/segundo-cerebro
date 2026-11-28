import { isError, type Computed } from './formula'
import type { TableColumn, TableRow } from './types'

/** Valor numérico de una celda (también si viene de una fórmula); `null` si está vacía o no es un número. */
export function numberOf(col: TableColumn, row: TableRow, computed: Computed): number | null {
  if (col.type === 'formula') {
    const r = computed.get(row.id)?.[col.id]
    return r && !isError(r) ? r.v : null
  }
  const v = row.cells[col.id]
  return col.type === 'numero' && typeof v === 'number' ? v : null
}

/** La columna que lleva el resultado de cada operación: la que se llama «Resultado…» y es numérica. */
export function findResultColumn(columns: readonly TableColumn[]): TableColumn | undefined {
  return columns.find((c) => (c.type === 'numero' || c.type === 'formula') && /^resultado/i.test(c.name.trim()))
}

export interface Stats {
  n: number
  wins: number
  losses: number
  /** 0 a 1; `null` sin operaciones. */
  winRate: number | null
  total: number
  average: number | null
  best: number | null
  worst: number | null
  /** Ganancias brutas entre pérdidas brutas; `null` si no hay pérdidas. */
  profitFactor: number | null
  /** Mayor caída desde un máximo de la curva (positiva o 0). */
  maxDrawdown: number
  bestStreak: number
  worstStreak: number
}

const round = (n: number) => Math.round(n * 1e8) / 1e8

/** Estadísticas de una serie de resultados, en el orden en que se hicieron las operaciones. */
export function computeStats(values: readonly number[]): Stats {
  let wins = 0
  let losses = 0
  let gross = 0
  let loss = 0
  let total = 0
  let peak = 0
  let maxDrawdown = 0
  let streak = 0
  let bestStreak = 0
  let worstStreak = 0
  for (const v of values) {
    total += v
    if (v > 0) {
      wins++
      gross += v
      streak = streak > 0 ? streak + 1 : 1
      bestStreak = Math.max(bestStreak, streak)
    } else if (v < 0) {
      losses++
      loss += -v
      streak = streak < 0 ? streak - 1 : -1
      worstStreak = Math.max(worstStreak, -streak)
    } else streak = 0
    peak = Math.max(peak, total)
    maxDrawdown = Math.max(maxDrawdown, peak - total)
  }
  const n = values.length
  return {
    n,
    wins,
    losses,
    winRate: n ? wins / n : null,
    total: round(total),
    average: n ? round(total / n) : null,
    best: n ? Math.max(...values) : null,
    worst: n ? Math.min(...values) : null,
    profitFactor: loss > 0 ? round(gross / loss) : null,
    maxDrawdown: round(maxDrawdown),
    bestStreak,
    worstStreak,
  }
}

/** Suma acumulada: el primer punto es 0 (antes de la primera operación). */
export function equityCurve(values: readonly number[]): number[] {
  const out = [0]
  for (const v of values) out.push(round(out[out.length - 1] + v))
  return out
}

export interface Group {
  key: string
  n: number
  total: number
  winRate: number | null
}

/** Agrupa por el valor de una columna (lista, texto o casilla) y resume el resultado de cada grupo, de mejor a peor. */
export function groupResults(groupCol: TableColumn, valueCol: TableColumn, rows: readonly TableRow[], computed: Computed): Group[] {
  const by = new Map<string, number[]>()
  for (const r of rows) {
    const v = numberOf(valueCol, r, computed)
    if (v === null) continue
    const raw = r.cells[groupCol.id]
    const key = groupCol.type === 'casilla' ? (raw === true ? 'Sí' : 'No') : typeof raw === 'string' && raw ? raw : 'Sin valor'
    by.set(key, [...(by.get(key) ?? []), v])
  }
  return [...by.entries()]
    .map(([key, vals]) => {
      const s = computeStats(vals)
      return { key, n: s.n, total: s.total, winRate: s.winRate }
    })
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key, 'es'))
}

// ---- Filtros ----

export type FilterOp = 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'filled' | 'empty' | 'month'

export interface FilterRule {
  columnId: string
  op: FilterOp
  /** Para `month`, el mes `AAAA-MM`; para `gt` y `lt`, un número. */
  value?: string
}

export const FILTER_OPS: Record<FilterOp, string> = {
  eq: 'es',
  neq: 'no es',
  contains: 'contiene',
  gt: 'mayor que',
  lt: 'menor que',
  filled: 'tiene valor',
  empty: 'está vacío',
  month: 'es del mes',
}

/** Operadores que tienen sentido para el tipo de columna. */
export function opsFor(col: TableColumn): FilterOp[] {
  switch (col.type) {
    case 'numero':
    case 'formula':
      return ['gt', 'lt', 'eq', 'filled', 'empty']
    case 'fecha':
      return ['month', 'filled', 'empty']
    case 'lista':
      return ['eq', 'neq', 'filled', 'empty']
    case 'casilla':
      return ['eq', 'filled', 'empty']
    case 'items':
      return ['filled', 'empty']
    default:
      return ['contains', 'eq', 'filled', 'empty']
  }
}

const isEmpty = (v: unknown) => v === undefined || v === '' || (Array.isArray(v) && v.length === 0)

export function matchesRule(rule: FilterRule, col: TableColumn, row: TableRow, computed: Computed): boolean {
  if (col.type === 'numero' || col.type === 'formula') {
    const n = numberOf(col, row, computed)
    const x = Number((rule.value ?? '').replace(',', '.'))
    switch (rule.op) {
      case 'gt': return n !== null && Number.isFinite(x) && n > x
      case 'lt': return n !== null && Number.isFinite(x) && n < x
      case 'eq': return n !== null && Number.isFinite(x) && n === x
      case 'filled': return n !== null
      case 'empty': return n === null
      default: return true
    }
  }
  const v = row.cells[col.id]
  switch (rule.op) {
    case 'filled': return !isEmpty(v)
    case 'empty': return isEmpty(v)
    case 'eq': return col.type === 'casilla' ? (rule.value === 'si') === (v === true) : v === rule.value
    case 'neq': return v !== rule.value
    case 'contains': return typeof v === 'string' && v.toLowerCase().includes((rule.value ?? '').toLowerCase())
    case 'month': return typeof v === 'string' && v.startsWith(rule.value ?? '\u0000')
    default: return true
  }
}

/** Filas que cumplen todas las reglas; una regla de una columna que ya no existe se ignora. */
export function applyFilters(rules: readonly FilterRule[], columns: readonly TableColumn[], rows: readonly TableRow[], computed: Computed): TableRow[] {
  const active = rules.flatMap((r) => {
    const col = columns.find((c) => c.id === r.columnId)
    return col ? [{ r, col }] : []
  })
  if (active.length === 0) return [...rows]
  return rows.filter((row) => active.every(({ r, col }) => matchesRule(r, col, row, computed)))
}
