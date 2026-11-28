import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './api'
import { renameInFormula } from './domain/formula'
import type { CellValue, Cells, ColumnOptions, ColumnType, TableColumn, TableRow } from './domain/types'

export function useTables() {
  return useQuery({ queryKey: ['tables', 'list'], queryFn: api.fetchTables })
}

export function useDeletedTables() {
  return useQuery({ queryKey: ['tables', 'deleted'], queryFn: api.fetchDeletedTables })
}

export function useTable(id: string | undefined) {
  return useQuery({ queryKey: ['tables', 'one', id], queryFn: () => api.fetchTable(id!), enabled: !!id })
}

export function useTablesMutations() {
  const queryClient = useQueryClient()
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: ['tables'] })
  return {
    create: useMutation({ mutationFn: ({ id, name, columns }: { id: string; name: string; columns: api.NewColumn[] }) => api.createTable(id, name, columns), onSuccess }),
    trash: useMutation({ mutationFn: (id: string) => api.setTableTrashed(id, true), onSuccess }),
    restore: useMutation({ mutationFn: (id: string) => api.setTableTrashed(id, false), onSuccess }),
  }
}

/** Cambios dentro de una tabla. Las celdas y las filas se ven al instante (optimista); las columnas, al confirmarse. */
export function useTableMutations(tableId: string) {
  const queryClient = useQueryClient()
  const key = ['tables', 'one', tableId]
  const refetch = () => queryClient.invalidateQueries({ queryKey: key })

  function patch(update: (d: api.TableData) => api.TableData) {
    queryClient.setQueryData<api.TableData | null>(key, (old) => (old ? update(old) : old))
  }

  return {
    setCell: useMutation({
      mutationFn: ({ rowId, columnId, value }: { rowId: string; columnId: string; value: CellValue }) => api.setCell(rowId, columnId, value),
      scope: { id: `table-cells-${tableId}` },
      onMutate: ({ rowId, columnId, value }) => {
        // Síncrono: la celda debe mostrar el cambio en ese mismo instante
        patch((d) => ({
          ...d,
          rows: d.rows.map((r) => {
            if (r.id !== rowId) return r
            const cells = { ...r.cells }
            if (value === undefined) delete cells[columnId]
            else cells[columnId] = value
            return { ...r, cells }
          }),
        }))
      },
      onError: refetch,
    }),
    addRow: useMutation({
      // La fila nace vacía y, si trae valores (duplicar, valores por defecto), se rellenan celda a celda con la misma validación del servidor
      mutationFn: async (row: TableRow) => {
        await api.createRow(row.id, tableId)
        for (const [columnId, value] of Object.entries(row.cells)) await api.setCell(row.id, columnId, value)
      },
      scope: { id: `table-cells-${tableId}` },
      onMutate: (row) => patch((d) => ({ ...d, rows: [...d.rows, row] })),
      onError: refetch,
    }),
    importRows: useMutation({
      mutationFn: (rows: { id: string; cells: Cells }[]) => api.insertRows(tableId, rows),
      onSuccess: refetch,
    }),
    deleteRow: useMutation({
      mutationFn: (id: string) => api.deleteRow(id),
      scope: { id: `table-cells-${tableId}` },
      onMutate: (id) => patch((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== id) })),
      onError: refetch,
    }),
    addColumn: useMutation({ mutationFn: (c: api.NewColumn) => api.createColumn(tableId, c), onSuccess: refetch }),
    updateColumn: useMutation({
      mutationFn: async ({ column, name, type, options, all }: { column: TableColumn; name: string; type?: ColumnType; options: ColumnOptions; all: readonly TableColumn[] }) => {
        await api.updateColumn(column.id, { name, type, options })
        // Si cambió el nombre, las fórmulas que lo citan se actualizan para no romperse
        if (name.trim().toLowerCase() !== column.name.trim().toLowerCase()) {
          for (const c of all) {
            if (c.id === column.id || c.type !== 'formula' || !c.options.formula) continue
            const next = renameInFormula(c.options.formula, column.name, name)
            if (next !== c.options.formula) await api.updateColumn(c.id, { options: { ...c.options, formula: next } })
          }
        }
      },
      onSuccess: refetch,
      onError: refetch,
    }),
    moveColumn: useMutation({
      mutationFn: async ({ a, b }: { a: TableColumn; b: TableColumn }) => {
        // Intercambia las posiciones (si coinciden, se separan)
        const pa = a.position === b.position ? b.position + 1 : b.position
        await api.updateColumn(a.id, { position: pa })
        await api.updateColumn(b.id, { position: a.position })
      },
      onSuccess: refetch,
      onError: refetch,
    }),
    deleteColumn: useMutation({ mutationFn: (id: string) => api.deleteColumn(id), onSuccess: refetch }),
    rename: useMutation({
      mutationFn: (name: string) => api.renameTable(tableId, name),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tables'] }),
    }),
  }
}
