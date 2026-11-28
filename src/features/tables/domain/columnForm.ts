import { parseNumber } from './cells'
import { formulaRefs, parseFormula } from './formula'
import { LIMITS, type ColumnOptions, type ColumnType, type Footer, type TableColumn } from './types'

export interface ColumnFormInput {
  name: string
  type: ColumnType
  /** Una opción por línea. */
  choices: string
  formula: string
  /** Vacío = los necesarios. */
  decimals: string
  footer: Footer
  /** Valor por defecto de las filas nuevas (texto, número, opción, `hoy` o `si`). */
  defaultValue?: string
}

export type ColumnFormErrors = Partial<Record<'name' | 'choices' | 'formula' | 'decimals' | 'default', string>>

export type ColumnFormResult = { ok: true; value: { name: string; type: ColumnType; options: ColumnOptions } } | { ok: false; errors: ColumnFormErrors }

/** Valida el formulario de una columna contra las demás de la tabla (`selfId` es la que se edita, si la hay). */
export function validateColumnForm(input: ColumnFormInput, others: readonly TableColumn[], selfId?: string): ColumnFormResult {
  const errors: ColumnFormErrors = {}
  const name = input.name.trim()
  const rest = others.filter((c) => c.id !== selfId)

  if (!name) errors.name = 'Escribe un nombre'
  else if (name.length > LIMITS.columnName) errors.name = `Máximo ${LIMITS.columnName} caracteres`
  else if (/[{}]/.test(name)) errors.name = 'El nombre no puede llevar llaves'
  else if (rest.some((c) => c.name.trim().toLowerCase() === name.toLowerCase())) errors.name = 'Ya hay una columna con ese nombre'

  const options: ColumnOptions = {}

  if (input.type === 'lista') {
    const choices = input.choices.split('\n').map((s) => s.trim()).filter(Boolean)
    if (choices.length === 0) errors.choices = 'Escribe al menos una opción'
    else if (choices.length > LIMITS.choices) errors.choices = `Máximo ${LIMITS.choices} opciones`
    else if (choices.some((c) => c.length > LIMITS.choiceText)) errors.choices = `Cada opción admite hasta ${LIMITS.choiceText} caracteres`
    else if (new Set(choices.map((c) => c.toLowerCase())).size !== choices.length) errors.choices = 'Hay opciones repetidas'
    else options.choices = choices
  }

  if (input.type === 'numero' || input.type === 'formula') {
    const d = input.decimals.trim()
    if (d !== '') {
      const n = Number(d)
      if (!Number.isInteger(n) || n < 0 || n > 6) errors.decimals = 'Entre 0 y 6 decimales'
      else options.decimals = n
    }
    if (input.footer !== 'ninguno') options.footer = input.footer
    else options.footer = 'ninguno'
  }

  if (input.type === 'formula') {
    const f = input.formula.trim()
    if (f.length > LIMITS.formula) errors.formula = `Máximo ${LIMITS.formula} caracteres`
    else {
      const p = parseFormula(f)
      if (!p.ok) errors.formula = p.error
      else {
        const known = new Map(rest.map((c) => [c.name.trim().toLowerCase(), c]))
        const missing = formulaRefs(p.ast).find((r) => !known.has(r.toLowerCase()) && r.toLowerCase() !== name.toLowerCase())
        const self = formulaRefs(p.ast).find((r) => r.toLowerCase() === name.toLowerCase())
        if (self) errors.formula = 'Una fórmula no puede usarse a sí misma'
        else if (missing) errors.formula = `No existe la columna «${missing}»`
        else {
          const bad = formulaRefs(p.ast).map((r) => known.get(r.toLowerCase())!).find((c) => c.type !== 'numero' && c.type !== 'formula')
          if (bad) errors.formula = `«${bad.name}» no es numérica: solo se pueden usar columnas de número o de fórmula`
          else options.formula = f
        }
      }
    }
  }

  const dv = (input.defaultValue ?? '').trim()
  if (dv) {
    if (input.type === 'texto') {
      if (dv.length > LIMITS.text) errors.default = `Máximo ${LIMITS.text} caracteres`
      else options.default = dv
    } else if (input.type === 'numero') {
      const n = parseNumber(dv)
      if (n === null) errors.default = 'Escribe un número'
      else options.default = String(n)
    } else if (input.type === 'fecha') {
      if (dv === 'hoy') options.default = 'hoy'
    } else if (input.type === 'lista') {
      if (!options.choices?.includes(dv)) {
        if (!errors.choices) errors.default = 'Elige una de las opciones de la lista'
      } else options.default = dv
    } else if (input.type === 'casilla') {
      if (dv === 'si') options.default = 'si'
    }
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { name, type: input.type, options } }
}
