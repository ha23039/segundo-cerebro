import type { Database } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import { isColumnType, type CellValue, type Cells, type ColumnOptions, type ColumnType, type JournalTable, type TableColumn, type TableRow } from './domain/types'

type TableDbRow = Database['public']['Tables']['journal_tables']['Row']
type ColumnDbRow = Database['public']['Tables']['journal_columns']['Row']
type RowDbRow = Database['public']['Tables']['journal_rows']['Row']
const PAGE = 1000

// La columna `options` es jsonb; el tipo generado no distingue formas, así que se convierte en un solo sitio
const asJson = (v: unknown) => v as NonNullable<Database['public']['Tables']['journal_columns']['Insert']['options']>

const toTable = (r: TableDbRow & { journal_rows?: { count: number }[] }): JournalTable => ({ id: r.id, name: r.name, position: r.position, deletedAt: r.deleted_at, rowCount: r.journal_rows?.[0]?.count })
const toColumn = (r: ColumnDbRow): TableColumn => ({
  id: r.id,
  tableId: r.table_id,
  name: r.name,
  type: isColumnType(r.type) ? r.type : 'texto',
  options: (r.options ?? {}) as ColumnOptions,
  position: r.position,
})
const toRow = (r: RowDbRow): TableRow => ({ id: r.id, tableId: r.table_id, cells: (r.cells ?? {}) as TableRow['cells'], createdAt: r.created_at })

export async function fetchTables(): Promise<JournalTable[]> {
  const { data, error } = await supabase.from('journal_tables').select('*, journal_rows(count)').is('deleted_at', null).order('position').order('created_at')
  if (error) throw error
  return data.map(toTable)
}

export async function fetchDeletedTables(): Promise<JournalTable[]> {
  const { data, error } = await supabase.from('journal_tables').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
  if (error) throw error
  return data.map(toTable)
}

export interface TableData {
  table: JournalTable
  columns: TableColumn[]
  rows: TableRow[]
}

export async function fetchTable(id: string): Promise<TableData | null> {
  const { data: t, error } = await supabase.from('journal_tables').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!t) return null
  const { data: cols, error: ce } = await supabase.from('journal_columns').select('*').eq('table_id', id).order('position').order('created_at')
  if (ce) throw ce
  const rows: TableRow[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error: re } = await supabase
      .from('journal_rows')
      .select('*')
      .eq('table_id', id)
      .order('created_at')
      .order('id')
      .range(offset, offset + PAGE - 1)
    if (re) throw re
    rows.push(...data.map(toRow))
    if (data.length < PAGE) break
  }
  return { table: toTable(t), columns: cols.map(toColumn), rows }
}

export interface NewColumn {
  id: string
  name: string
  type: ColumnType
  options: ColumnOptions
  position: number
}

/** Crea una tabla con sus columnas (la plantilla o ninguna) y devuelve su id. */
export async function createTable(id: string, name: string, columns: NewColumn[]): Promise<void> {
  const { error } = await supabase.from('journal_tables').insert({ id, name })
  if (error) throw error
  if (columns.length === 0) return
  const { error: ce } = await supabase.from('journal_columns').insert(columns.map((c) => ({ id: c.id, table_id: id, name: c.name, type: c.type, options: asJson(c.options), position: c.position })))
  if (ce) throw ce
}

export async function renameTable(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('journal_tables').update({ name }).eq('id', id)
  if (error) throw error
}

export async function setTableTrashed(id: string, trashed: boolean): Promise<void> {
  const { error } = await supabase.from('journal_tables').update({ deleted_at: trashed ? new Date().toISOString() : null }).eq('id', id)
  if (error) throw error
}

export async function createColumn(tableId: string, c: NewColumn): Promise<void> {
  const { error } = await supabase.from('journal_columns').insert({ id: c.id, table_id: tableId, name: c.name, type: c.type, options: asJson(c.options), position: c.position })
  if (error) throw error
}

export async function updateColumn(id: string, patch: { name?: string; type?: ColumnType; options?: ColumnOptions; position?: number }): Promise<void> {
  const { error } = await supabase.from('journal_columns').update({ ...patch, options: patch.options === undefined ? undefined : asJson(patch.options) }).eq('id', id)
  if (error) throw error
}

export async function deleteColumn(id: string): Promise<void> {
  const { error } = await supabase.from('journal_columns').delete().eq('id', id)
  if (error) throw error
}

export async function createRow(id: string, tableId: string, cells: Cells = {}): Promise<void> {
  const { error } = await supabase.from('journal_rows').insert({ id, table_id: tableId, cells: asJson(cells) })
  if (error) throw error
}

/** Inserta muchas filas con sus celdas de una vez (importación), en tandas para no pasarse del tamaño de la petición. */
export async function insertRows(tableId: string, rows: { id: string; cells: Cells }[]): Promise<void> {
  const CHUNK = 200
  // Todas las filas de una tanda comparten `now()`; se separan 1 ms para que conserven el orden del archivo
  const base = Date.now()
  for (let i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK).map((r, j) => ({ id: r.id, table_id: tableId, cells: asJson(r.cells), created_at: new Date(base + i + j).toISOString() }))
    const { error } = await supabase.from('journal_rows').insert(part)
    if (error) throw error
  }
}

export async function deleteRow(id: string): Promise<void> {
  const { error } = await supabase.from('journal_rows').delete().eq('id', id)
  if (error) throw error
}

/** `undefined` vacía la celda. */
export async function setCell(rowId: string, columnId: string, value: CellValue): Promise<void> {
  const { error } = await supabase.rpc('set_cell', { p_row: rowId, p_column: columnId, p_value: asJson(value === undefined ? null : value) })
  if (error) throw error
}
