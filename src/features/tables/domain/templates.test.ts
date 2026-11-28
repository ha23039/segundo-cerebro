import { describe, expect, it } from 'vitest'
import { validateColumnForm } from './columnForm'
import { TABLE_TEMPLATES } from './templates'
import { LIMITS, type TableColumn } from './types'

describe('plantillas de tabla', () => {
  it.each(TABLE_TEMPLATES.map((t) => [t.name, t] as const))('«%s» tiene columnas válidas y dentro de los límites', (_n, t) => {
    expect(t.columns.length).toBeLessThanOrEqual(LIMITS.columns)
    const built: TableColumn[] = []
    t.columns.forEach((c, i) => {
      const r = validateColumnForm(
        { name: c.name, type: c.type, choices: (c.options?.choices ?? []).join('\n'), formula: c.options?.formula ?? '', decimals: c.options?.decimals === undefined ? '' : String(c.options.decimals), footer: c.options?.footer ?? 'ninguno' },
        built,
      )
      expect(r.ok, `${c.name}: ${JSON.stringify(r)}`).toBe(true)
      built.push({ id: String(i), tableId: 't', name: c.name, type: c.type, options: c.options ?? {}, position: i })
    })
  })
  it('la plantilla de trading trae los 28 pares', () => {
    const par = TABLE_TEMPLATES.find((t) => t.id === 'trading')!.columns.find((c) => c.name === 'Par')!
    expect(par.options?.choices).toHaveLength(28)
  })
})
