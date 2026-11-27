import type { ColumnOptions, ColumnType } from './types'

export interface TemplateColumn {
  name: string
  type: ColumnType
  options?: ColumnOptions
}

export interface TableTemplate {
  id: string
  name: string
  description: string
  columns: TemplateColumn[]
}

/** Puntos de partida al crear una tabla. Solo definen columnas: ninguna trae filas de ejemplo. */
export const TABLE_TEMPLATES: readonly TableTemplate[] = [
  { id: 'vacia', name: 'En blanco', description: 'Empiezas sin columnas y las creas tú.', columns: [] },
  {
    id: 'trading',
    name: 'Trading',
    description: 'Operaciones con entrada, salida y resultado calculado.',
    columns: [
      { name: 'Fecha', type: 'fecha' },
      { name: 'Activo', type: 'texto' },
      { name: 'Tipo', type: 'lista', options: { choices: ['Compra', 'Venta'] } },
      { name: 'Entrada', type: 'numero' },
      { name: 'Salida', type: 'numero' },
      { name: 'Cantidad', type: 'numero' },
      { name: 'Resultado', type: 'formula', options: { formula: '({Salida} - {Entrada}) * {Cantidad}', decimals: 2, footer: 'suma' } },
      { name: 'Cerrada', type: 'casilla' },
      { name: 'Revisión', type: 'items' },
      { name: 'Motivo', type: 'texto' },
    ],
  },
  {
    id: 'gastos',
    name: 'Gastos',
    description: 'Concepto, categoría e importe con el total al pie.',
    columns: [
      { name: 'Fecha', type: 'fecha' },
      { name: 'Concepto', type: 'texto' },
      { name: 'Categoría', type: 'lista', options: { choices: ['Casa', 'Comida', 'Transporte', 'Ocio', 'Otros'] } },
      { name: 'Importe', type: 'numero', options: { decimals: 2, footer: 'suma' } },
    ],
  },
]
