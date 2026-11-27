import { useRef, useState, type KeyboardEvent } from 'react'
import { displayCell, formatResult, sanitizeCell } from './domain/cells'
import { footerValue, type Computed } from './domain/formula'
import type { CellValue, TableColumn, TableRow } from './domain/types'

interface Props {
  name: string
  columns: readonly TableColumn[]
  rows: readonly TableRow[]
  computed: Computed
  disabled: boolean
  onSet(rowId: string, columnId: string, value: CellValue): void
  onOpenItems(rowId: string, columnId: string): void
  onEditColumn(columnId: string): void
  onDeleteRow(rowId: string): void
}

const sameValue = (a: CellValue, b: CellValue) => JSON.stringify(a) === JSON.stringify(b)

/** Texto editable de una celda: los números con coma decimal, como se escriben en español. */
function draftOf(col: TableColumn, v: CellValue): string {
  if (col.type === 'numero' && typeof v === 'number') return String(v).replace('.', ',')
  return typeof v === 'string' ? v : ''
}

const typeHint = (col: TableColumn) => ({ texto: 'texto', numero: 'número', fecha: 'fecha', lista: 'lista', casilla: 'casilla', items: 'ítems', formula: 'fórmula' })[col.type]

/**
 * Hoja de cálculo: toca una celda para escribir; con teclado, flechas para moverte, Enter o F2 para editar, escribir
 * para reemplazar, Supr para vaciar, Tab y Enter para pasar a la siguiente. Listas de opciones, fechas y casillas se
 * cambian directamente; las listas de ítems se abren en un diálogo.
 */
export function Grid({ name, columns, rows, computed, disabled, onSet, onOpenItems, onEditColumn, onDeleteRow }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [cursor, setActive] = useState({ r: 0, c: 0 })
  const [editing, setEditing] = useState<{ r: number; c: number; draft: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const cancelled = useRef(false)
  // Lo escrito antes de que el campo de edición esté en pantalla (teclear rápido tras Enter) no se pierde
  const editRef = useRef<{ r: number; c: number; draft: string } | null>(null)

  const maxR = rows.length - 1
  const maxC = columns.length - 1
  // Si se borran filas o columnas, la celda activa no se sale de la tabla
  const active = { r: Math.min(cursor.r, Math.max(maxR, 0)), c: Math.min(cursor.c, Math.max(maxC, 0)) }

  const findCell = (r: number, c: number) => wrapRef.current?.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`)

  /** Enfoca ya (la celda existe) y, por si el navegador lo pierde, lo reintenta en el siguiente cuadro. */
  const focusCell = (r: number, c: number, now = false) => {
    if (now) findCell(r, c)?.focus()
    requestAnimationFrame(() => {
      const el = findCell(r, c)
      const a = document.activeElement
      if (el && a !== el && (!a || a === document.body || wrapRef.current?.contains(a))) el.focus()
    })
  }

  function moveTo(r: number, c: number, now = false) {
    const next = { r: Math.min(Math.max(r, 0), maxR), c: Math.min(Math.max(c, 0), maxC) }
    setActive(next)
    focusCell(next.r, next.c, now)
  }

  function commit(r: number, c: number, raw: unknown, then?: 'down' | 'right'): boolean {
    const col = columns[c]
    const row = rows[r]
    const res = sanitizeCell(col, raw)
    if (!res.ok) {
      setError(`Fila ${r + 1}, ${col.name}: ${res.error}`)
      return false
    }
    setError(null)
    if (!sameValue(row.cells[col.id], res.value)) onSet(row.id, col.id, res.value)
    editRef.current = null
    setEditing(null)
    if (then === 'down') moveTo(r + 1, c)
    else if (then === 'right') moveTo(r, c + 1)
    else focusCell(r, c)
    return true
  }

  function startEdit(r: number, c: number, draft?: string) {
    if (disabled) return
    const col = columns[c]
    if (col.type !== 'texto' && col.type !== 'numero') return
    setActive({ r, c })
    setError(null)
    const start = { r, c, draft: draft ?? draftOf(col, rows[r].cells[col.id]) }
    editRef.current = start
    setEditing(start)
  }

  function onCellKey(e: KeyboardEvent<HTMLElement>, r: number, c: number) {
    const col = columns[c]
    const row = rows[r]
    const pending = editRef.current
    if (pending && pending.r === r && pending.c === c) {
      // La edición ya empezó pero el campo aún no está: se recogen las teclas en el borrador
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) pending.draft += e.key
      else if (e.key === 'Backspace') pending.draft = pending.draft.slice(0, -1)
      else return
      e.preventDefault()
      setEditing({ ...pending })
      return
    }
    const nav: Record<string, [number, number]> = { ArrowUp: [r - 1, c], ArrowDown: [r + 1, c], ArrowLeft: [r, c - 1], ArrowRight: [r, c + 1] }
    if (nav[e.key]) {
      e.preventDefault()
      moveTo(nav[e.key][0], nav[e.key][1], true)
    } else if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault()
      if (col.type === 'items') onOpenItems(row.id, col.id)
      else if (col.type === 'casilla') toggle(r, c)
      else startEdit(r, c)
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && !disabled && col.type !== 'formula') {
      e.preventDefault()
      if (row.cells[col.id] !== undefined) onSet(row.id, col.id, undefined)
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && (col.type === 'texto' || col.type === 'numero')) {
      e.preventDefault()
      startEdit(r, c, e.key)
    }
  }

  function toggle(r: number, c: number) {
    if (disabled) return
    const col = columns[c]
    const row = rows[r]
    onSet(row.id, col.id, row.cells[col.id] === true ? undefined : true)
  }

  if (columns.length === 0) {
    return <p className="empty">Esta tabla aún no tiene columnas. Añade la primera con «Nueva columna».</p>
  }

  return (
    <>
      <div ref={wrapRef} className="grid-wrap" role="region" aria-label={`Tabla ${name}`} tabIndex={0}>
        <table className="grid">
          <thead>
            <tr>
              <th scope="col" className="grid-corner">
                <span className="visually-hidden">Fila</span>
              </th>
              {columns.map((col) => (
                <th key={col.id} scope="col">
                  <button type="button" className="grid-head" onClick={() => onEditColumn(col.id)}>
                    <span className="visually-hidden">Editar columna </span>
                    <span className="grid-head-name">{col.name}</span>
                    <span className="muted small">{typeHint(col)}</span>
                  </button>
                </th>
              ))}
              <th scope="col" className="grid-actions-head">
                <span className="visually-hidden">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={row.id}>
                <th scope="row" className="grid-rownum">
                  {r + 1}
                </th>
                {columns.map((col, c) => {
                  const value = row.cells[col.id]
                  const result = computed.get(row.id)?.[col.id]
                  const here = active.r === r && active.c === c
                  const tab = here ? 0 : -1
                  const text = displayCell(col, value, result)
                  const label = `${col.name}, fila ${r + 1}${col.type === 'formula' ? ' (se calcula sola)' : ''}: ${text || 'vacía'}`
                  const isEditing = editing?.r === r && editing.c === c

                  let body
                  if (isEditing) {
                    body = (
                      <input
                        className="cell-input"
                        data-cell={`${r}-${c}`}
                        aria-label={`${col.name}, fila ${r + 1}`}
                        inputMode={col.type === 'numero' ? 'decimal' : undefined}
                        defaultValue={editing.draft}
                        autoFocus
                        ref={(el) => {
                          if (el && document.activeElement === el && !el.dataset.placed) {
                            el.dataset.placed = '1'
                            el.setSelectionRange(el.value.length, el.value.length)
                          }
                        }}
                        onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            commit(r, c, e.currentTarget.value, 'down')
                          } else if (e.key === 'Tab') {
                            e.preventDefault()
                            commit(r, c, e.currentTarget.value, 'right')
                          } else if (e.key === 'Escape') {
                            cancelled.current = true
                            editRef.current = null
                            setEditing(null)
                            setError(null)
                            focusCell(r, c)
                          }
                        }}
                        onBlur={(e) => {
                          if (cancelled.current) cancelled.current = false
                          else commit(r, c, e.currentTarget.value)
                        }}
                      />
                    )
                  } else if (col.type === 'lista') {
                    body = (
                      <select
                        className="cell-select"
                        data-cell={`${r}-${c}`}
                        tabIndex={tab}
                        aria-label={`${col.name}, fila ${r + 1}`}
                        value={typeof value === 'string' ? value : ''}
                        disabled={disabled}
                        onFocus={() => setActive({ r, c })}
                        onChange={(e) => commit(r, c, e.target.value)}
                      >
                        <option value="" />
                        {[...(col.options.choices ?? []), ...(typeof value === 'string' && value && !(col.options.choices ?? []).includes(value) ? [value] : [])].map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    )
                  } else if (col.type === 'fecha') {
                    body = (
                      <input
                        type="date"
                        className="cell-input cell-date"
                        data-cell={`${r}-${c}`}
                        tabIndex={tab}
                        aria-label={`${col.name}, fila ${r + 1}`}
                        value={typeof value === 'string' ? value : ''}
                        disabled={disabled}
                        onFocus={() => setActive({ r, c })}
                        onChange={(e) => commit(r, c, e.target.value)}
                      />
                    )
                  } else if (col.type === 'casilla') {
                    body = (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={value === true}
                        className={`cell-btn cell-check${value === true ? ' is-on' : ''}`}
                        data-cell={`${r}-${c}`}
                        tabIndex={tab}
                        aria-label={`${col.name}, fila ${r + 1}`}
                        onFocus={() => setActive({ r, c })}
                        onKeyDown={(e) => onCellKey(e, r, c)}
                        onClick={() => toggle(r, c)}
                      >
                        {value === true ? 'Sí' : ''}
                      </button>
                    )
                  } else {
                    const readonly = col.type === 'formula'
                    const failed = result && 'e' in result
                    body = (
                      <button
                        type="button"
                        className={`cell-btn${col.type === 'numero' || col.type === 'formula' ? ' is-num' : ''}${failed ? ' is-error' : ''}`}
                        data-cell={`${r}-${c}`}
                        tabIndex={tab}
                        aria-label={label}
                        onFocus={() => setActive({ r, c })}
                        onKeyDown={(e) => onCellKey(e, r, c)}
                        onClick={() => (col.type === 'items' ? onOpenItems(row.id, col.id) : readonly ? undefined : startEdit(r, c))}
                      >
                        {text}
                      </button>
                    )
                  }
                  return (
                    <td key={col.id} className={col.type === 'formula' ? 'is-formula' : undefined}>
                      {body}
                    </td>
                  )
                })}
                <td className="grid-actions">
                  {confirming === row.id ? (
                    <span className="grid-confirm">
                      <button type="button" className="btn btn-danger" onClick={() => (setConfirming(null), onDeleteRow(row.id))}>
                        Borrar fila {r + 1}
                      </button>
                      <button type="button" className="btn" onClick={() => setConfirming(null)}>
                        No
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="btn ghost" disabled={disabled} aria-label={`Borrar fila ${r + 1}`} onClick={() => setConfirming(row.id)}>
                      Borrar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {columns.some((c) => (c.type === 'numero' || c.type === 'formula') && (c.options.footer ?? 'ninguno') !== 'ninguno') && rows.length > 0 && (
            <tfoot>
              <tr>
                <th scope="row" className="grid-rownum">
                  <span className="visually-hidden">Resumen</span>
                </th>
                {columns.map((col) => {
                  const kind = (col.type === 'numero' || col.type === 'formula') && col.options.footer !== 'ninguno' ? col.options.footer : undefined
                  if (!kind) return <td key={col.id} />
                  const v = formatResult(footerValue(kind, col, rows, computed), col.options.decimals)
                  return (
                    <td key={col.id} className="grid-foot is-num">
                      <span className="muted small">{kind === 'suma' ? 'Suma' : 'Media'}</span> {v}
                    </td>
                  )
                })}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  )
}
