import { useCallback, useState } from 'react'
import type { FilterRule } from './domain/analysis'

export interface SavedView {
  name: string
  rules: FilterRule[]
}

interface Stored {
  rules: FilterRule[]
  saved: SavedView[]
  groupBy: string
  /** Ids de las columnas que no se muestran en este dispositivo. */
  hidden: string[]
}

const key = (tableId: string) => `sc.tableview.${tableId}`

function read(tableId: string): Stored {
  try {
    const raw = JSON.parse(localStorage.getItem(key(tableId)) ?? 'null') as Partial<Stored> | null
    return { rules: Array.isArray(raw?.rules) ? raw.rules : [], saved: Array.isArray(raw?.saved) ? raw.saved : [], groupBy: typeof raw?.groupBy === 'string' ? raw.groupBy : '', hidden: Array.isArray(raw?.hidden) ? raw.hidden : [] }
  } catch {
    return { rules: [], saved: [], groupBy: '', hidden: [] }
  }
}

/** Filtros activos, vistas guardadas y columna de agrupación de una tabla; se recuerdan en este dispositivo. */
export function useTableView(tableId: string) {
  const [state, setState] = useState<Stored>(() => read(tableId))

  const update = useCallback(
    (patch: Partial<Stored>) =>
      setState((s) => {
        const next = { ...s, ...patch }
        try {
          localStorage.setItem(key(tableId), JSON.stringify(next))
        } catch {
          /* sin almacenamiento: solo dura mientras la página está abierta */
        }
        return next
      }),
    [tableId],
  )

  return {
    ...state,
    setRules: (rules: FilterRule[]) => update({ rules }),
    setGroupBy: (groupBy: string) => update({ groupBy }),
    toggleColumn: (id: string) => update({ hidden: state.hidden.includes(id) ? state.hidden.filter((h) => h !== id) : [...state.hidden, id] }),
    showAllColumns: () => update({ hidden: [] }),
    saveView: (name: string) => update({ saved: [...state.saved.filter((v) => v.name !== name), { name, rules: state.rules }] }),
    deleteView: (name: string) => update({ saved: state.saved.filter((v) => v.name !== name) }),
  }
}
