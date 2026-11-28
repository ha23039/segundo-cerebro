import { FOREX_PAIRS } from './forex'
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
    name: 'Trading (forex)',
    description: 'Los 28 pares, riesgo, resultado, múltiplo R y si seguiste el plan.',
    columns: [
      { name: 'Fecha', type: 'fecha' },
      { name: 'Par', type: 'lista', options: { choices: [...FOREX_PAIRS] } },
      { name: 'Dirección', type: 'lista', options: { choices: ['Compra', 'Venta'] } },
      { name: 'Setup', type: 'lista', options: { choices: ['Ruptura', 'Rechazo en S/R', 'Tendencia', 'Reversión', 'Otro'] } },
      { name: 'Entrada', type: 'numero' },
      { name: 'Stop Loss', type: 'numero' },
      { name: 'Take Profit', type: 'numero' },
      { name: 'Riesgo', type: 'numero', options: { decimals: 2, footer: 'suma' } },
      { name: 'Resultado', type: 'numero', options: { decimals: 2, footer: 'suma', tone: 'signo' } },
      { name: 'R', type: 'formula', options: { formula: '{Resultado} / {Riesgo}', decimals: 2, footer: 'media', tone: 'signo' } },
      { name: 'Siguió el plan', type: 'lista', options: { choices: ['Sí', 'No'] } },
      { name: 'Error o emoción', type: 'lista', options: { choices: ['Ninguno', 'Revenge trading', 'Miedo', 'Exceso de confianza', 'Entrada tardía', 'Salida anticipada'] } },
      { name: 'Revisión', type: 'items' },
      { name: 'Notas', type: 'texto' },
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
  {
    id: 'gimnasio',
    name: 'Gimnasio',
    description: 'Ejercicio, series, repeticiones y peso de cada sesión.',
    columns: [
      { name: 'Fecha', type: 'fecha', options: { default: 'hoy' } },
      { name: 'Ejercicio', type: 'texto' },
      { name: 'Grupo', type: 'lista', options: { choices: ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core', 'Cardio'] } },
      { name: 'Series', type: 'numero', options: { decimals: 0 } },
      { name: 'Repeticiones', type: 'numero', options: { decimals: 0 } },
      { name: 'Peso (kg)', type: 'numero', options: { decimals: 1 } },
      { name: 'Volumen', type: 'formula', options: { formula: '{Series} * {Repeticiones} * {Peso (kg)}', decimals: 0, footer: 'suma' } },
      { name: 'Notas', type: 'texto' },
    ],
  },
  {
    id: 'lecturas',
    name: 'Lecturas',
    description: 'Libros y artículos con su estado y valoración.',
    columns: [
      { name: 'Título', type: 'texto' },
      { name: 'Autor', type: 'texto' },
      { name: 'Estado', type: 'lista', options: { choices: ['Pendiente', 'Leyendo', 'Terminado'], default: 'Pendiente' } },
      { name: 'Páginas', type: 'numero', options: { decimals: 0, footer: 'suma' } },
      { name: 'Valoración', type: 'lista', options: { choices: ['1', '2', '3', '4', '5'] } },
      { name: 'Terminado el', type: 'fecha' },
      { name: 'Ideas clave', type: 'items' },
    ],
  },
  {
    id: 'presupuesto',
    name: 'Presupuesto mensual',
    description: 'Ingresos y gastos con el balance al pie (los gastos van en negativo).',
    columns: [
      { name: 'Fecha', type: 'fecha', options: { default: 'hoy' } },
      { name: 'Concepto', type: 'texto' },
      { name: 'Categoría', type: 'lista', options: { choices: ['Nómina', 'Casa', 'Comida', 'Transporte', 'Ocio', 'Salud', 'Ahorro', 'Otros'] } },
      { name: 'Importe', type: 'numero', options: { decimals: 2, footer: 'suma', tone: 'signo' } },
      { name: 'Pagado', type: 'casilla' },
    ],
  },
]
