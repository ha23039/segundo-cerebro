import { csvCell } from '../../export/domain/csv'
import { parseNumber } from './cells'
import { isError, type Computed } from './formula'
import { LIMITS, type Cells, type Item, type TableColumn, type TableRow } from './types'

/** CSV de una tabla: una columna por columna, valores sin formato (números con punto, fechas ISO). Con BOM para Excel. */
export function tableToCsv(columns: readonly TableColumn[], rows: readonly TableRow[], computed: Computed): string {
  const value = (col: TableColumn, row: TableRow): string | number | boolean | undefined => {
    if (col.type === 'formula') {
      const r = computed.get(row.id)?.[col.id]
      return r && !isError(r) ? (r.v ?? undefined) : undefined
    }
    const v = row.cells[col.id]
    if (col.type === 'casilla') return v === true ? 'Sí' : ''
    if (col.type === 'items') return Array.isArray(v) ? (v as Item[]).map((i) => `${i.d ? '[x] ' : ''}${i.t}`).join(' | ') : undefined
    return v as string | number | undefined
  }
  const lines = [columns.map((c) => csvCell(c.name)).join(',')]
  for (const r of rows) lines.push(columns.map((c) => csvCell(value(c, r))).join(','))
  return `﻿${lines.join('\r\n')}\r\n`
}

/** Lee un CSV (comillas, saltos de línea dentro de campos, BOM) detectando si separa con coma, punto y coma o tabulador. */
export function parseCsv(input: string, forcedSep?: string): string[][] {
  const text = input.replace(/^﻿/, '')
  const firstLine = text.split(/\r\n|\n|\r/, 1)[0] ?? ''
  const count = (ch: string) => firstLine.split(ch).length - 1
  const sep = forcedSep ?? [';', '\t', ','].reduce((best, ch) => (count(ch) > count(best) ? ch : best), ',')
  const out: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === sep) {
      row.push(field)
      field = ''
    }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      out.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    out.push(row)
  }
  return out.filter((r) => r.some((f) => f.trim() !== ''))
}

const isoDate = (y: number, m: number, d: number): string | null => {
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null
}

/** Acepta `2026-11-28`, `28/11/2026`, `28-11-2026` y `28.11.2026` (día primero, como en España). */
export function parseDate(s: string): string | null {
  const t = s.trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)
  if (m) return isoDate(+m[1], +m[2], +m[3])
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t)
  return m ? isoDate(+m[3], +m[2], +m[1]) : null
}

const YES = new Set(['sí', 'si', 'x', 'true', 'verdadero', '1', 'yes', 'y'])

/** Convierte un texto (de un CSV o del portapapeles) al valor de una celda; `undefined` si no encaja con el tipo. */
export function convertCell(col: TableColumn, raw: string): Cells[string] {
  // el apóstrofo que añade la exportación para proteger de fórmulas no forma parte del dato
  const text = /^'[=+\-@]/.test(raw) ? raw.slice(1) : raw
  switch (col.type) {
    case 'texto':
      return text.length > LIMITS.text ? undefined : text
    case 'numero': {
      const n = parseNumber(text)
      return n !== null && Math.abs(n) <= LIMITS.numberMax ? n : undefined
    }
    case 'fecha':
      return parseDate(text) ?? undefined
    case 'lista':
      return (col.options.choices ?? []).find((c) => c.toLowerCase() === text.toLowerCase())
    case 'casilla':
      return YES.has(text.toLowerCase()) ? true : undefined
    case 'items': {
      const items = text
        .split(/\s*\|\s*/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, LIMITS.items)
        .map((t): Item => ({ t: t.replace(/^\[x\]\s*/i, '').slice(0, LIMITS.itemText), d: /^\[x\]/i.test(t) }))
      return items.length ? items : undefined
    }
    default:
      return undefined
  }
}

export interface ImportPlan {
  /** Columnas de la tabla que reciben datos, en el orden del archivo. */
  matched: { header: string; column: TableColumn }[]
  /** Encabezados del archivo que no coinciden con ninguna columna (no se importan). */
  ignored: string[]
  rows: Cells[]
  /** Valores que no encajan con su columna (número mal escrito, opción que no existe…): quedan vacíos. */
  invalid: number
  /** Filas que no caben por el límite de la tabla. */
  overflow: number
}

/** Prepara la importación: casa encabezados con columnas por nombre y convierte cada valor según el tipo. */
export function planImport(records: string[][], columns: readonly TableColumn[], existingRows: number): ImportPlan {
  const [header = [], ...body] = records
  const byName = new Map(columns.filter((c) => c.type !== 'formula').map((c) => [c.name.trim().toLowerCase(), c]))
  const matched: ImportPlan['matched'] = []
  const ignored: string[] = []
  const used = new Set<string>()
  const index: (TableColumn | null)[] = header.map((h) => {
    const col = byName.get(h.trim().toLowerCase())
    if (!col || used.has(col.id)) {
      if (h.trim()) ignored.push(h.trim())
      return null
    }
    used.add(col.id)
    matched.push({ header: h.trim(), column: col })
    return col
  })

  let invalid = 0
  const rows: Cells[] = []
  for (const rec of body) {
    const cells: Cells = {}
    index.forEach((col, i) => {
      const raw = (rec[i] ?? '').trim()
      if (!col || raw === '') return
      const v = convertCell(col, raw)
      if (v === undefined) {
        // una casilla con otro valor ('no', '0') es simplemente vacía, no un error
        if (col.type !== 'casilla') invalid++
      } else cells[col.id] = v
    })
    if (Object.keys(cells).length > 0) rows.push(cells)
  }
  const room = Math.max(0, LIMITS.rows - existingRows)
  return { matched, ignored, rows: rows.slice(0, room), invalid, overflow: Math.max(0, rows.length - room) }
}
