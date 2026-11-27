import type { TableColumn, TableRow } from './types'

/**
 * Fórmulas de columna. Lenguaje pequeño y seguro (nada de `eval`):
 *   expresión  := término (('+' | '-') término)*
 *   término    := factor (('*' | '/') factor)*
 *   factor     := número | {Columna} | FUNCIÓN(...) | (expresión) | -factor
 * Funciones por fila: ABS(x), ROUND(x[, decimales]).
 * Funciones de columna (sobre todas las filas, ignorando vacías): SUM, AVG, MIN, MAX, COUNT de {Columna}.
 */
export type Node =
  | { k: 'num'; v: number }
  | { k: 'ref'; name: string }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: '+' | '-' | '*' | '/'; a: Node; b: Node }
  | { k: 'agg'; fn: 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT'; name: string }
  | { k: 'fn'; fn: 'ABS' | 'ROUND'; args: Node[] }

export type ParseResult = { ok: true; ast: Node } | { ok: false; error: string }

const AGG = ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT'] as const
const FN = ['ABS', 'ROUND'] as const

type Token = { t: 'num'; v: number } | { t: 'ref'; v: string } | { t: 'id'; v: string } | { t: 'op'; v: string }

function tokenize(src: string): Token[] | string {
  const out: Token[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) i++
    else if (/[0-9.]/.test(c)) {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j])) j++
      const text = src.slice(i, j)
      if (!/^\d*\.?\d+$|^\d+\.?$/.test(text)) return `Número no válido: ${text}`
      out.push({ t: 'num', v: Number(text) })
      i = j
    } else if (c === '{') {
      const end = src.indexOf('}', i)
      if (end === -1) return 'Falta cerrar la llave de una columna'
      const name = src.slice(i + 1, end).trim()
      if (!name) return 'Hay una columna sin nombre entre llaves'
      out.push({ t: 'ref', v: name })
      i = end + 1
    } else if (/[A-Za-z]/.test(c)) {
      let j = i
      while (j < src.length && /[A-Za-z]/.test(src[j])) j++
      out.push({ t: 'id', v: src.slice(i, j).toUpperCase() })
      i = j
    } else if ('+-*/(),'.includes(c)) {
      out.push({ t: 'op', v: c })
      i++
    } else return `Carácter no permitido: ${c}`
  }
  return out
}

export function parseFormula(src: string): ParseResult {
  if (!src.trim()) return { ok: false, error: 'Escribe la fórmula' }
  const lexed = tokenize(src)
  if (typeof lexed === 'string') return { ok: false, error: lexed }
  const tokens: Token[] = lexed
  let pos = 0
  const peek = () => tokens[pos]
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v
  class Fail extends Error {}
  const fail = (m: string): never => {
    throw new Fail(m)
  }

  function expr(): Node {
    let a = term()
    while (isOp('+') || isOp('-')) {
      const op = (tokens[pos++] as { v: '+' | '-' }).v
      a = { k: 'bin', op, a, b: term() }
    }
    return a
  }
  function term(): Node {
    let a = factor()
    while (isOp('*') || isOp('/')) {
      const op = (tokens[pos++] as { v: '*' | '/' }).v
      a = { k: 'bin', op, a, b: factor() }
    }
    return a
  }
  function factor(): Node {
    const t = tokens[pos]
    if (!t) return fail('La fórmula está incompleta')
    if (t.t === 'num') {
      pos++
      return { k: 'num', v: t.v }
    }
    if (t.t === 'ref') {
      pos++
      return { k: 'ref', name: t.v }
    }
    if (t.t === 'op' && t.v === '-') {
      pos++
      return { k: 'neg', a: factor() }
    }
    if (t.t === 'op' && t.v === '(') {
      pos++
      const e = expr()
      if (!isOp(')')) return fail('Falta cerrar el paréntesis')
      pos++
      return e
    }
    if (t.t === 'id') {
      pos++
      if (!isOp('(')) return fail(`«${t.v}» no es una función; las columnas van entre llaves`)
      pos++
      if ((AGG as readonly string[]).includes(t.v)) {
        const r = tokens[pos]
        if (r?.t !== 'ref') return fail(`${t.v} necesita una columna, p. ej. ${t.v}({Resultado})`)
        pos++
        if (!isOp(')')) return fail('Falta cerrar el paréntesis')
        pos++
        return { k: 'agg', fn: t.v as (typeof AGG)[number], name: r.v }
      }
      if ((FN as readonly string[]).includes(t.v)) {
        const args: Node[] = [expr()]
        while (isOp(',')) {
          pos++
          args.push(expr())
        }
        if (!isOp(')')) return fail('Falta cerrar el paréntesis')
        pos++
        if (t.v === 'ABS' && args.length !== 1) return fail('ABS lleva un solo valor')
        if (t.v === 'ROUND' && args.length > 2) return fail('ROUND lleva el valor y, si quieres, los decimales')
        return { k: 'fn', fn: t.v as (typeof FN)[number], args }
      }
      return fail(`Función desconocida: ${t.v}`)
    }
    return fail(`Símbolo inesperado: ${t.v}`)
  }

  try {
    const ast = expr()
    if (pos < tokens.length) return { ok: false, error: `Sobra «${tokens[pos].v}» al final` }
    return { ok: true, ast }
  } catch (e) {
    if (e instanceof Fail) return { ok: false, error: e.message }
    throw e
  }
}

/** Nombres de columna que usa la fórmula. */
export function formulaRefs(ast: Node): string[] {
  switch (ast.k) {
    case 'num':
      return []
    case 'ref':
    case 'agg':
      return [ast.name]
    case 'neg':
      return formulaRefs(ast.a)
    case 'bin':
      return [...formulaRefs(ast.a), ...formulaRefs(ast.b)]
    case 'fn':
      return ast.args.flatMap(formulaRefs)
  }
}

/** Cambia `{Viejo}` por `{Nuevo}` en el texto de una fórmula (al renombrar una columna). */
export function renameInFormula(src: string, from: string, to: string): string {
  const f = from.trim().toLowerCase()
  return src.replace(/\{([^}]*)\}/g, (m, name: string) => (name.trim().toLowerCase() === f ? `{${to}}` : m))
}

// ---------- Evaluación ----------

/** Resultado de una celda de fórmula: un número, vacía (null) o un error corto. */
export type FormulaResult = { v: number | null } | { e: string }

export const isError = (r: FormulaResult): r is { e: string } => 'e' in r

const clean = (n: number): number => Math.round(n * 1e10) / 1e10

export type Computed = Map<string, Record<string, FormulaResult>>

/**
 * Calcula todas las columnas de fórmula para todas las filas. Una celda vacía en una referencia deja el resultado
 * vacío (no 0); dividir entre 0 da `#DIV/0`; una referencia a una columna que no existe, `#REF`; dos columnas que se
 * necesitan entre sí, `#CICLO`.
 */
export function computeFormulas(columns: readonly TableColumn[], rows: readonly TableRow[]): Computed {
  const byName = new Map(columns.map((c) => [c.name.trim().toLowerCase(), c]))
  const asts = new Map<string, Node | { err: string }>()
  for (const c of columns) {
    if (c.type !== 'formula') continue
    const p = parseFormula(c.options.formula ?? '')
    asts.set(c.id, p.ok ? p.ast : { err: '#FÓRMULA' })
  }

  const memo = new Map<string, FormulaResult>() // `${colId}|${rowId}`
  const visiting = new Set<string>()
  const colMemo = new Map<string, FormulaResult[]>() // valores de una columna en todas las filas

  function cellOf(col: TableColumn, row: TableRow): FormulaResult {
    if (col.type === 'formula') return formulaCell(col, row)
    if (col.type !== 'numero') return { e: '#TIPO' }
    const v = row.cells[col.id]
    return { v: typeof v === 'number' && Number.isFinite(v) ? v : null }
  }

  function columnValues(col: TableColumn): FormulaResult[] {
    const hit = colMemo.get(col.id)
    if (hit) return hit
    const out = rows.map((r) => cellOf(col, r))
    colMemo.set(col.id, out)
    return out
  }

  function formulaCell(col: TableColumn, row: TableRow): FormulaResult {
    const key = `${col.id}|${row.id}`
    const cached = memo.get(key)
    if (cached) return cached
    if (visiting.has(col.id)) return { e: '#CICLO' }
    const ast = asts.get(col.id)
    if (!ast) return { e: '#FÓRMULA' }
    if ('err' in ast) return { e: ast.err }
    visiting.add(col.id)
    const r = evalNode(ast, row)
    visiting.delete(col.id)
    memo.set(key, r)
    return r
  }

  function evalNode(n: Node, row: TableRow): FormulaResult {
    switch (n.k) {
      case 'num':
        return { v: n.v }
      case 'ref': {
        const c = byName.get(n.name.toLowerCase())
        return c ? cellOf(c, row) : { e: '#REF' }
      }
      case 'neg': {
        const a = evalNode(n.a, row)
        return isError(a) ? a : { v: a.v === null ? null : -a.v }
      }
      case 'bin': {
        const a = evalNode(n.a, row)
        if (isError(a)) return a
        const b = evalNode(n.b, row)
        if (isError(b)) return b
        if (a.v === null || b.v === null) return { v: null }
        if (n.op === '/' && b.v === 0) return { e: '#DIV/0' }
        const r = n.op === '+' ? a.v + b.v : n.op === '-' ? a.v - b.v : n.op === '*' ? a.v * b.v : a.v / b.v
        return Number.isFinite(r) ? { v: clean(r) } : { e: '#NUM' }
      }
      case 'fn': {
        const a = evalNode(n.args[0], row)
        if (isError(a)) return a
        if (a.v === null) return { v: null }
        if (n.fn === 'ABS') return { v: Math.abs(a.v) }
        let d = 0
        if (n.args[1]) {
          const dd = evalNode(n.args[1], row)
          if (isError(dd)) return dd
          d = Math.min(10, Math.max(0, Math.trunc(dd.v ?? 0)))
        }
        const f = 10 ** d
        return { v: Math.round(a.v * f) / f }
      }
      case 'agg': {
        const c = byName.get(n.name.toLowerCase())
        if (!c) return { e: '#REF' }
        if (c.type === 'formula' && visiting.has(c.id)) return { e: '#CICLO' }
        return aggregate(n.fn, c)
      }
    }
  }

  function aggregate(fn: 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT', col: TableColumn): FormulaResult {
    if (col.type !== 'numero' && col.type !== 'formula') return { e: '#TIPO' }
    const nums: number[] = []
    for (const r of columnValues(col)) {
      if (isError(r)) return r
      if (r.v !== null) nums.push(r.v)
    }
    if (fn === 'COUNT') return { v: nums.length }
    if (nums.length === 0) return { v: null }
    const sum = nums.reduce((s, x) => s + x, 0)
    if (fn === 'SUM') return { v: clean(sum) }
    if (fn === 'AVG') return { v: clean(sum / nums.length) }
    return { v: fn === 'MIN' ? Math.min(...nums) : Math.max(...nums) }
  }

  const out: Computed = new Map()
  for (const row of rows) {
    const rec: Record<string, FormulaResult> = {}
    for (const c of columns) if (c.type === 'formula') rec[c.id] = formulaCell(c, row)
    out.set(row.id, rec)
  }
  return out
}

/** Resumen al pie de una columna numérica o de fórmula. */
export function footerValue(kind: 'suma' | 'media', col: TableColumn, rows: readonly TableRow[], computed: Computed): FormulaResult {
  const nums: number[] = []
  for (const r of rows) {
    if (col.type === 'formula') {
      const x = computed.get(r.id)?.[col.id]
      if (!x) continue
      if (isError(x)) return x
      if (x.v !== null) nums.push(x.v)
    } else {
      const v = r.cells[col.id]
      if (typeof v === 'number' && Number.isFinite(v)) nums.push(v)
    }
  }
  if (nums.length === 0) return { v: null }
  const sum = nums.reduce((s, x) => s + x, 0)
  return { v: clean(kind === 'suma' ? sum : sum / nums.length) }
}
