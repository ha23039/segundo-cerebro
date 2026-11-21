export type Cell = string | number | boolean | null | undefined | readonly unknown[] | Record<string, unknown>

/**
 * Una celda CSV. Los textos que empiezan por = + - @ (o tabulador / retorno) se prefijan con ' para que
 * una hoja de cálculo no los ejecute como fórmula; los números se escriben tal cual.
 */
export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return ''
  let s: string
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) s = v.map(String).join('; ')
  else if (typeof v === 'object') s = JSON.stringify(v)
  else s = v as string
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

/** Filas -> CSV con cabecera (columnas en orden de aparición), CRLF y BOM para que Excel lea UTF-8. */
export function toCsv(rows: readonly Record<string, Cell>[], columns?: readonly string[]): string {
  const cols = columns ?? [...new Set(rows.flatMap((r) => Object.keys(r)))]
  const lines = [cols.map(csvCell).join(',')]
  for (const r of rows) lines.push(cols.map((c) => csvCell(r[c])).join(','))
  return `﻿${lines.join('\r\n')}\r\n`
}
