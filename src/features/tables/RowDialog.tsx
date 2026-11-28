import { useEffect, useRef, useState } from 'react'
import { displayCell, sanitizeCell } from './domain/cells'
import type { Computed } from './domain/formula'
import type { CellValue, TableColumn, TableRow } from './domain/types'

interface Props {
  row: TableRow
  /** Posición de la fila en la tabla, desde 1. */
  index: number
  columns: readonly TableColumn[]
  computed: Computed
  disabled: boolean
  onSet(columnId: string, value: CellValue): void
  onOpenItems(columnId: string): void
  onDuplicate(): void
  onDelete(): void
  onClose(): void
}

const draftOf = (col: TableColumn, v: CellValue) => (col.type === 'numero' && typeof v === 'number' ? String(v).replace('.', ',') : typeof v === 'string' ? v : '')

/** Ficha de una fila: un campo grande por columna, cómodo con el pulgar. Cada cambio se guarda al salir del campo. */
export function RowDialog({ row, index, columns, computed, disabled, onSet, onOpenItems, onDuplicate, onDelete, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  function commit(col: TableColumn, raw: unknown) {
    const res = sanitizeCell(col, raw)
    if (!res.ok) return setErrors((e) => ({ ...e, [col.id]: res.error }))
    setErrors((e) => {
      const { [col.id]: _drop, ...rest } = e
      return rest
    })
    setDrafts((d) => {
      const { [col.id]: _drop, ...rest } = d
      return rest
    })
    if (JSON.stringify(row.cells[col.id]) !== JSON.stringify(res.value)) onSet(col.id, res.value)
  }

  return (
    <dialog ref={ref} className="row-dialog" aria-labelledby="row-title" onClose={onClose}>
      <div className="stack">
        <div className="items-head">
          <h2 id="row-title">Fila {index}</h2>
          <button type="button" className="btn" onClick={() => ref.current?.close()}>
            Cerrar
          </button>
        </div>

        {columns.map((col) => {
          const value = row.cells[col.id]
          const id = `row-f-${col.id}`
          const err = errors[col.id]
          const shared = { id, 'aria-invalid': err ? true : undefined, disabled }
          let field
          if (col.type === 'formula') {
            const text = displayCell(col, value, computed.get(row.id)?.[col.id])
            field = (
              <p id={id} className="row-readonly">
                {text || 'Se calcula sola'}
              </p>
            )
          } else if (col.type === 'texto' || col.type === 'numero') {
            field = (
              <input
                {...shared}
                value={drafts[col.id] ?? draftOf(col, value)}
                inputMode={col.type === 'numero' ? 'decimal' : undefined}
                autoComplete="off"
                onChange={(e) => setDrafts((d) => ({ ...d, [col.id]: e.target.value }))}
                onBlur={(e) => commit(col, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
            )
          } else if (col.type === 'fecha') {
            field = <input {...shared} type="date" value={typeof value === 'string' ? value : ''} onChange={(e) => commit(col, e.target.value)} />
          } else if (col.type === 'lista') {
            const choices = col.options.choices ?? []
            const picked = typeof value === 'string' ? value : ''
            field = (
              <select {...shared} value={picked} onChange={(e) => commit(col, e.target.value)}>
                <option value="" />
                {[...choices, ...(picked && !choices.includes(picked) ? [picked] : [])].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            )
          } else if (col.type === 'casilla') {
            field = (
              <label className="choice">
                <input {...shared} type="checkbox" checked={value === true} onChange={(e) => commit(col, e.target.checked)} />
                <span>Sí</span>
              </label>
            )
          } else {
            const n = Array.isArray(value) ? value.length : 0
            const done = Array.isArray(value) ? value.filter((i) => i.d).length : 0
            field = (
              <button type="button" className="btn" disabled={disabled} onClick={() => onOpenItems(col.id)}>
                {n ? `Editar lista (${done}/${n})` : 'Añadir ítems'}
              </button>
            )
          }
          return (
            <div key={col.id}>
              <label htmlFor={id}>{col.name}</label>
              {field}
              {err && (
                <p role="alert" className="error field-error">
                  {err}
                </p>
              )}
            </div>
          )
        })}

        <div className="column-extra">
          <button type="button" className="btn" disabled={disabled} onClick={onDuplicate}>
            Duplicar fila
          </button>
          {confirming ? (
            <div className="row">
              <p className="error small">Se borra la fila y lo que hay escrito en ella.</p>
              <button type="button" className="btn btn-danger" onClick={onDelete}>
                Sí, borrar la fila
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>
                No
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-danger" disabled={disabled} onClick={() => setConfirming(true)}>
              Borrar fila
            </button>
          )}
        </div>
      </div>
    </dialog>
  )
}
