import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toMessage } from '../../lib/errors'
import { useOnline } from '../layout/useOnline'
import { ColumnDialog } from './ColumnDialog'
import { compareCells } from './domain/cells'
import { computeFormulas } from './domain/formula'
import { LIMITS, type TableRow } from './domain/types'
import { Grid } from './Grid'
import { useTable, useTableMutations, useTablesMutations } from './hooks'
import { ItemsDialog } from './ItemsDialog'
import './tables.css'

function TableView({ id }: { id: string }) {
  const navigate = useNavigate()
  const online = useOnline()
  const query = useTable(id)
  const m = useTableMutations(id)
  const { trash } = useTablesMutations()
  const [sortBy, setSortBy] = useState('')
  const [desc, setDesc] = useState(false)
  const [editingColumn, setEditingColumn] = useState<string | 'new' | null>(null)
  const [items, setItems] = useState<{ rowId: string; columnId: string } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [confirmTrash, setConfirmTrash] = useState(false)

  const data = query.data
  const columns = useMemo(() => data?.columns ?? [], [data])
  const rows = useMemo(() => data?.rows ?? [], [data])
  const computed = useMemo(() => computeFormulas(columns, rows), [columns, rows])

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.id === sortBy)
    if (!col) return rows
    const out = [...rows].sort((a, b) => compareCells(col, a.cells[col.id], b.cells[col.id], computed.get(a.id)?.[col.id], computed.get(b.id)?.[col.id]))
    return desc ? out.reverse() : out
  }, [rows, columns, computed, sortBy, desc])

  if (query.isPending) return <p className="muted">Cargando…</p>
  if (query.isError) return <p role="alert" className="error">{toMessage(query.error)}</p>
  if (!data) return <p role="alert" className="error">No se encontró la tabla.</p>

  const editCol = editingColumn && editingColumn !== 'new' ? columns.find((c) => c.id === editingColumn) : undefined
  const editIndex = editCol ? columns.findIndex((c) => c.id === editCol.id) : -1
  const suggestions =
    editCol?.type === 'texto'
      ? [...new Set(rows.map((r) => r.cells[editCol.id]).filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= LIMITS.choiceText))].slice(0, LIMITS.choices)
      : undefined
  const itemsCol = items ? columns.find((c) => c.id === items.columnId) : undefined
  const itemsRow = items ? rows.find((r) => r.id === items.rowId) : undefined
  const itemsValue = itemsRow && itemsCol ? itemsRow.cells[itemsCol.id] : undefined
  const mutationError = m.setCell.error ?? m.addRow.error ?? m.deleteRow.error

  function addRow() {
    const row: TableRow = { id: crypto.randomUUID(), tableId: id, cells: {}, createdAt: new Date().toISOString() }
    m.addRow.mutate(row)
  }

  return (
    <div className="table-page">
      <p>
        <Link to="/diario?vista=tablas">Volver a las tablas</Link>
      </p>

      <div className="page-header">
        {renaming === null ? (
          <>
            <h1>{data.table.name}</h1>
            <button className="btn ghost" type="button" disabled={!online} onClick={() => setRenaming(data.table.name)}>
              Renombrar
            </button>
          </>
        ) : (
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              if (renaming.trim()) m.rename.mutate(renaming.trim(), { onSuccess: () => setRenaming(null) })
            }}
          >
            <label htmlFor="table-rename" className="visually-hidden">
              Nombre de la tabla
            </label>
            <input id="table-rename" value={renaming} maxLength={60} autoFocus onChange={(e) => setRenaming(e.target.value)} />
            <button className="btn btn-primary" type="submit" disabled={m.rename.isPending}>
              Guardar nombre
            </button>
            <button className="btn" type="button" onClick={() => setRenaming(null)}>
              Cancelar
            </button>
          </form>
        )}
      </div>

      <div className="table-toolbar">
        {columns.length > 0 && (
          <span className="table-sort">
            <label htmlFor="sort-col">Ordenar por</label>
            <select id="sort-col" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="">Orden de entrada</option>
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {sortBy && (
              <button className="btn" type="button" aria-pressed={desc} onClick={() => setDesc((d) => !d)}>
                {desc ? 'De mayor a menor' : 'De menor a mayor'}
              </button>
            )}
          </span>
        )}
        <span className="table-actions">
          <button className="btn" type="button" disabled={!online} onClick={() => setEditingColumn('new')}>
            Nueva columna
          </button>
          <button className="btn btn-primary" type="button" disabled={!online || columns.length === 0} onClick={addRow}>
            Añadir fila
          </button>
        </span>
      </div>

      {!online && <p className="muted small">Sin conexión: las tablas se pueden ver, pero no editar.</p>}
      {mutationError != null && (
        <p role="alert" className="error">
          {toMessage(mutationError)}
        </p>
      )}

      <Grid
        name={data.table.name}
        columns={columns}
        rows={sorted}
        computed={computed}
        disabled={!online}
        onSet={(rowId, columnId, value) => m.setCell.mutate({ rowId, columnId, value })}
        onOpenItems={(rowId, columnId) => setItems({ rowId, columnId })}
        onEditColumn={setEditingColumn}
        onDeleteRow={(rowId) => m.deleteRow.mutate(rowId)}
      />
      {columns.length > 0 && rows.length === 0 && <p className="empty">Sin filas todavía. Pulsa «Añadir fila».</p>}

      {editingColumn && (editingColumn === 'new' || editCol) && (
        <ColumnDialog
          key={editingColumn}
          column={editCol}
          columns={columns}
          busy={m.addColumn.isPending || m.updateColumn.isPending || m.deleteColumn.isPending || m.moveColumn.isPending}
          error={m.addColumn.error ?? m.updateColumn.error ?? m.deleteColumn.error ?? m.moveColumn.error}
          suggestions={suggestions}
          canMoveLeft={editIndex > 0}
          canMoveRight={editIndex >= 0 && editIndex < columns.length - 1}
          onClose={() => setEditingColumn(null)}
          onSave={(v) =>
            editCol
              ? m.updateColumn.mutate({ column: editCol, name: v.name, type: v.type !== editCol.type ? v.type : undefined, options: v.options, all: columns }, { onSuccess: () => setEditingColumn(null) })
              : m.addColumn.mutate(
                  { id: crypto.randomUUID(), name: v.name, type: v.type, options: v.options, position: Math.max(0, ...columns.map((c) => c.position)) + 1 },
                  { onSuccess: () => setEditingColumn(null) },
                )
          }
          onDelete={editCol ? () => m.deleteColumn.mutate(editCol.id, { onSuccess: () => setEditingColumn(null) }) : undefined}
          onMove={
            editCol
              ? (dir) => {
                  const other = columns[editIndex + dir]
                  if (other) m.moveColumn.mutate({ a: editCol, b: other })
                }
              : undefined
          }
        />
      )}

      {items && itemsCol && itemsRow && (
        <ItemsDialog
          title={`${itemsCol.name}, fila ${sorted.findIndex((r) => r.id === itemsRow.id) + 1}`}
          items={Array.isArray(itemsValue) ? itemsValue : []}
          disabled={!online}
          onChange={(next) => m.setCell.mutate({ rowId: itemsRow.id, columnId: itemsCol.id, value: next.length ? next : undefined })}
          onClose={() => setItems(null)}
        />
      )}

      <section className="table-danger" aria-label="Borrar tabla">
        {confirmTrash ? (
          <div className="row">
            <p className="error small">La tabla va a la papelera 30 días y se puede restaurar.</p>
            <button className="btn btn-danger" type="button" disabled={trash.isPending} onClick={() => trash.mutate(id, { onSuccess: () => navigate('/diario?vista=tablas') })}>
              Sí, borrar la tabla
            </button>
            <button className="btn" type="button" onClick={() => setConfirmTrash(false)}>
              No
            </button>
          </div>
        ) : (
          <button className="btn btn-danger" type="button" disabled={!online} onClick={() => setConfirmTrash(true)}>
            Borrar tabla
          </button>
        )}
      </section>
    </div>
  )
}

export function TablePage() {
  const { id } = useParams()
  return id ? <TableView key={id} id={id} /> : <p role="alert" className="error">No se encontró la tabla.</p>
}
