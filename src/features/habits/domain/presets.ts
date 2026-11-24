import type { Weekday } from '../../../lib/dates'
import type { AreaId } from './areas'

/** Un punto de partida para crear un hábito: se carga en el formulario y se puede cambiar antes de guardar. */
export interface HabitPreset {
  id: string
  name: string
  area: AreaId
  kind: 'check' | 'cantidad'
  unit?: string
  target?: number
  frequency: { kind: 'dias'; days: Weekday[] } | { kind: 'semanal'; timesPerWeek: number }
}

const EVERY_DAY: Weekday[] = [1, 2, 3, 4, 5, 6, 7]
const WORKDAYS: Weekday[] = [1, 2, 3, 4, 5]

export const HABIT_PRESETS: readonly HabitPreset[] = [
  { id: 'agua', name: 'Beber agua', area: 'salud', kind: 'cantidad', unit: 'vasos', target: 8, frequency: { kind: 'dias', days: EVERY_DAY } },
  { id: 'dormir', name: 'Dormir a mi hora', area: 'salud', kind: 'check', frequency: { kind: 'dias', days: EVERY_DAY } },
  { id: 'entrenar', name: 'Entrenar', area: 'ejercicio', kind: 'check', frequency: { kind: 'semanal', timesPerWeek: 3 } },
  { id: 'caminar', name: 'Caminar', area: 'ejercicio', kind: 'cantidad', unit: 'minutos', target: 30, frequency: { kind: 'dias', days: EVERY_DAY } },
  { id: 'estudiar', name: 'Estudiar', area: 'estudio', kind: 'cantidad', unit: 'minutos', target: 45, frequency: { kind: 'dias', days: WORKDAYS } },
  { id: 'leer', name: 'Leer', area: 'desarrollo', kind: 'cantidad', unit: 'páginas', target: 10, frequency: { kind: 'dias', days: EVERY_DAY } },
  { id: 'profundo', name: 'Trabajo profundo', area: 'trabajo', kind: 'cantidad', unit: 'minutos', target: 90, frequency: { kind: 'dias', days: WORKDAYS } },
  { id: 'finanzas', name: 'Revisar mis gastos', area: 'finanzas', kind: 'check', frequency: { kind: 'semanal', timesPerWeek: 1 } },
  { id: 'meditar', name: 'Meditar u orar', area: 'espiritualidad', kind: 'check', frequency: { kind: 'dias', days: EVERY_DAY } },
]
