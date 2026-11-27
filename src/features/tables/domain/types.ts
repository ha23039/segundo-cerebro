export const COLUMN_TYPES = [
  { id: 'texto', label: 'Texto' },
  { id: 'numero', label: 'Número' },
  { id: 'fecha', label: 'Fecha' },
  { id: 'lista', label: 'Lista de opciones' },
  { id: 'casilla', label: 'Casilla (sí / no)' },
  { id: 'items', label: 'Lista de ítems' },
  { id: 'formula', label: 'Fórmula' },
] as const

export type ColumnType = (typeof COLUMN_TYPES)[number]['id']

export const isColumnType = (v: string): v is ColumnType => COLUMN_TYPES.some((t) => t.id === v)

export type Footer = 'suma' | 'media' | 'ninguno'

export interface ColumnOptions {
  /** Opciones de una columna `lista`. */
  choices?: string[]
  /** Decimales que se muestran en `numero` y `formula` (por defecto, los necesarios hasta 6). */
  decimals?: number
  /** Resumen al pie de la tabla para `numero` y `formula`. */
  footer?: Footer
  /** Texto de la fórmula, p. ej. `{Salida} - {Entrada}`. */
  formula?: string
}

export interface TableColumn {
  id: string
  tableId: string
  name: string
  type: ColumnType
  options: ColumnOptions
  position: number
}

export interface Item {
  t: string
  d: boolean
}

/** Valor guardado de una celda; `undefined` es vacía. */
export type CellValue = string | number | boolean | Item[] | undefined

export type Cells = Record<string, CellValue>

export interface TableRow {
  id: string
  tableId: string
  cells: Cells
  createdAt: string
}

export interface JournalTable {
  id: string
  name: string
  position: number
  deletedAt: string | null
}

export const LIMITS = {
  tableName: 60,
  columnName: 40,
  text: 500,
  items: 50,
  itemText: 100,
  choices: 30,
  choiceText: 30,
  formula: 200,
  columns: 30,
  rows: 5000,
  numberMax: 1e12,
} as const
