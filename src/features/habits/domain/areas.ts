export const AREAS = [
  { id: 'salud', label: 'Salud' },
  { id: 'ejercicio', label: 'Ejercicio' },
  { id: 'estudio', label: 'Estudio' },
  { id: 'trabajo', label: 'Trabajo' },
  { id: 'finanzas', label: 'Finanzas' },
  { id: 'desarrollo', label: 'Desarrollo personal' },
  { id: 'espiritualidad', label: 'Espiritualidad' },
] as const

export type AreaId = (typeof AREAS)[number]['id']

export const DEFAULT_AREA: AreaId = 'desarrollo'

export function areaLabel(id: AreaId): string {
  return AREAS.find((a) => a.id === id)?.label ?? id
}

export function isAreaId(v: string): v is AreaId {
  return AREAS.some((a) => a.id === v)
}
