import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { todayIn } from '../../lib/dates'
import { toMessage } from '../../lib/errors'
import { useProfile } from '../profile/useProfile'
import { AnalysisPanel } from './AnalysisPanel'
import { downloadFile } from '../export/download'
import { ImportDialog } from './ImportDialog'
import { parseCsv, planImport, tableToCsv, type ImportPlan } from './domain/csvTable'
import { MoreMenu } from './MoreMenu'
import { TableFilters } from './TableFilters'
import { useTableView } from './useTableView'
import { applyFilters } from './domain/analysis'
import { useOnline } from '../layout/useOnline'
import { ColumnDialog } from './ColumnDialog'
import { compareCells } from './domain/cells'
import { computeFormulas } from './domain/formula'
import { defaultCells, duplicateCells } from './domain/defaults'
import { RowDialog } from './RowDialog'
import { LIMITS, type Cells, type TableRow } from './domain/types'
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
  const profile = useProfile()
  const view = useTableView(id)
  const [sortBy, setSortBy] = useState('')
  const [desc, setDesc] = useState(false)
  const [editingColumn, setEditingColumn] = useState<string | 'new' | null>(null)
  const [items, setItems] = useState<{ rowId: string; columnId: string } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [confirmTrash, setConfirmTrash] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [openRow, setOpenRow] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState<{ name: string; plan: ImportPlan } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const data = query.data
  const columns = useMemo(() => data?.columns ?? [], [data])
  const rows = useMemo(() => data?.rows ?? [], [data])
  const visibleColumns = useMemo(() => {
    const shown = columns.filter((c) => !view.hidden.includes(c.id))
    return shown.length ? shown : columns
  }, [columns, view.hidden])
  const computed = useMemo(() => computeFormulas(columns, rows), [columns, rows])

  const filtered = useMemo(() => applyFilters(view.rules, columns, rows, computed), [view.rules, columns, rows, computed])

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.id === sortBy)
    if (!col) return filtered
    const out = [...filtered].sort((a, b) => compareCells(col, a.cells[col.id], b.cells[col.id], computed.get(a.id)?.[col.id], computed.get(b.id)?.[col.id]))
    return desc ? out.reverse() : out
  }, [filtered, columns, computed, sortBy, desc])

  if (query.isPending) return <p className="muted">Cargando…</p>
  if (query.isError) return <p role="alert" className="error">{toMessage(query.error)}</p>
  if (!data) return <p role="alert" className="error">No se encontró la tabla.</p>

  const editCol = editingColumn && editingColumn !== 'new' ? columns.find((c) => c.id === editingColumn) : undefined
  const editIndex = editCol ? columns.findIndex((c) => c.id === editCol.id) : -1
  const suggestions =
    editCol?.type === 'texto'
      ? [...new Set(rows.map((r) => r.cells[editCol.id]).filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= LIMITS.choiceText))].slice(0, LIMITS.choices)
      : undefined
  const openRowData = openRow ? rows.find((r) => r.id === openRow) : undefined
  const itemsCol = items ? columns.find((c) => c.id === items.columnId) : undefined
  const itemsRow = items ? rows.find((r) => r.id === items.rowId) : undefined
  const itemsValue = itemsRow && itemsCol ? itemsRow.cells[itemsCol.id] : undefined
  const mutationError = m.setCell.error ?? m.addRow.error ?? m.deleteRow.error

  function exportCsv() {
    const slug = data!.table.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tabla'
    downloadFile(`${slug}.csv`, tableToCsv(columns, sorted, computed), 'text/csv;charset=utf-8')
  }

  const today = todayIn(profile.data?.timezone ?? 'Europe/Madrid')

  function addRow(cells: Cells = defaultCells(columns, today)) {
    const row: TableRow = { id: crypto.randomUUID(), tableId: id, cells, createdAt: new Date().toISOString() }
    m.addRow.mutate(row)
  }

  return (
    <div className="table-page">
      <p>
        <Link to="/tablas">Volver a las tablas</Link>
      </p>

      <div className="page-header">
        {renaming === null ? (
          <h1>{data.table.name}</h1>
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
        <button className="btn btn-primary" type="button" disabled={!online || columns.length === 0} onClick={() => addRow()}>
          Añadir fila
        </button>
        {columns.length > 0 && (
          <button className="btn" type="button" aria-expanded={showFilters} aria-controls="table-filters-panel" onClick={() => setShowFilters((v) => !v)}>
            Filtros{view.rules.length > 0 ? ` (${view.rules.length})` : ''}
          </button>
        )}
        <MoreMenu
          actions={[
            { label: 'Nueva columna', disabled: !online, onSelect: () => setEditingColumn('new') },
            { label: 'Importar CSV', disabled: !online || columns.length === 0, onSelect: () => fileInput.current?.click() },
            { label: 'Exportar CSV', disabled: columns.length === 0, onSelect: () => exportCsv() },
            { label: 'Renombrar tabla', disabled: !online, onSelect: () => setRenaming(data.table.name) },
            { label: 'Borrar tabla', disabled: !online, danger: true, onSelect: () => setConfirmTrash(true) },
          ]}
        />
      </div>

      <input
        ref={fileInput}
        type="file"
        className="visually-hidden"
        accept=".csv,text/csv,text/plain"
        tabIndex={-1}
        aria-label="Archivo CSV para importar"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setImportError(null)
          if (file.size > 5_000_000) return setImportError('El archivo es demasiado grande (máximo 5 MB).')
          setImporting({ name: file.name, plan: planImport(parseCsv(await file.text()), columns, rows.length) })
        }}
      />
      {importError && (
        <p role="alert" className="error">
          {importError}
        </p>
      )}
      {importing && (
        <ImportDialog
          fileName={importing.name}
          plan={importing.plan}
          busy={m.importRows.isPending}
          error={m.importRows.error}
          onClose={() => setImporting(null)}
          onConfirm={() => m.importRows.mutate(importing.plan.rows.map((cells) => ({ id: crypto.randomUUID(), cells })), { onSuccess: () => setImporting(null) })}
        />
      )}

      {confirmTrash && (
        <div className="row table-danger" role="group" aria-label="Borrar tabla">
          <p className="error small">La tabla va a la papelera 30 días y se puede restaurar.</p>
          <button className="btn btn-danger" type="button" disabled={trash.isPending} onClick={() => trash.mutate(id, { onSuccess: () => navigate('/tablas') })}>
            Sí, borrar la tabla
          </button>
          <button className="btn" type="button" onClick={() => setConfirmTrash(false)}>
            No
          </button>
        </div>
      )}

      <TableFilters
        columns={columns}
        rules={view.rules}
        saved={view.saved}
        month={todayIn(profile.data?.timezone ?? 'Europe/Madrid').slice(0, 7)}
        shown={filtered.length}
        total={rows.length}
        open={showFilters}
        hidden={view.hidden}
        onToggleColumn={view.toggleColumn}
        onChange={view.setRules}
        onSaveView={view.saveView}
        onDeleteView={view.deleteView}
      >
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
      </TableFilters>

      <AnalysisPanel columns={columns} rows={filtered} computed={computed} groupBy={view.groupBy} onGroupBy={view.setGroupBy} />

      {!online && <p className="muted small">Sin conexión: las tablas se pueden ver, pero no editar.</p>}
      {mutationError != null && (
        <p role="alert" className="error">
          {toMessage(mutationError)}
        </p>
      )}

      <Grid
        name={data.table.name}
        columns={visibleColumns}
        rows={sorted}
        computed={computed}
        disabled={!online}
        onSet={(rowId, columnId, value) => m.setCell.mutate({ rowId, columnId, value })}
        onOpenItems={(rowId, columnId) => setItems({ rowId, columnId })}
        onEditColumn={setEditingColumn}
        onOpenRow={setOpenRow}
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

      {openRowData && (
        <RowDialog
          key={openRowData.id}
          row={openRowData}
          index={sorted.findIndex((r) => r.id === openRowData.id) + 1}
          columns={columns}
          computed={computed}
          disabled={!online}
          onSet={(columnId, value) => m.setCell.mutate({ rowId: openRowData.id, columnId, value })}
          onOpenItems={(columnId) => setItems({ rowId: openRowData.id, columnId })}
          onDuplicate={() => {
            addRow(duplicateCells(columns, openRowData.cells))
            setOpenRow(null)
          }}
          onDelete={() => {
            m.deleteRow.mutate(openRowData.id)
            setOpenRow(null)
          }}
          onClose={() => setOpenRow(null)}
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

    </div>
  )
}

export function TablePage() {
  const { id } = useParams()
  return id ? <TableView key={id} id={id} /> : <p role="alert" className="error">No se encontró la tabla.</p>
}
