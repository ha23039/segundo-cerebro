import { describe, expect, it } from 'vitest'
import { computeFormulas } from './formula'
import { parseCsv, parseDate, planImport, tableToCsv } from './csvTable'
import type { TableColumn, TableRow } from './types'

const col = (id: string, name: string, type: TableColumn['type'], options: TableColumn['options'] = {}): TableColumn => ({ id, tableId: 't', name, type, options, position: 0 })
const row = (id: string, cells: TableRow['cells']): TableRow => ({ id, tableId: 't', cells, createdAt: '' })

const cols = [
  col('f', 'Fecha', 'fecha'),
  col('p', 'Par', 'lista', { choices: ['EUR/USD', 'GBP/JPY'] }),
  col('r', 'Resultado', 'numero'),
  col('k', 'Riesgo', 'numero'),
  col('x', 'R', 'formula', { formula: '{Resultado} / {Riesgo}' }),
  col('c', 'Cerrada', 'casilla'),
  col('n', 'Notas', 'texto'),
  col('i', 'Revisión', 'items'),
]

describe('parseCsv', () => {
  it('detecta el separador y respeta comillas, comas y saltos de línea dentro del campo', () => {
    expect(parseCsv('a;b\r\n1;"x;y"\r\n')).toEqual([['a', 'b'], ['1', 'x;y']])
    expect(parseCsv('a,b\n"uno, dos","línea 1\nlínea 2"')).toEqual([['a', 'b'], ['uno, dos', 'línea 1\nlínea 2']])
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']])
    expect(parseCsv('﻿a,b\n"di ""hola""",2')).toEqual([['a', 'b'], ['di "hola"', '2']])
  })
  it('ignora las líneas vacías', () => expect(parseCsv('a,b\n\n1,2\n\n')).toEqual([['a', 'b'], ['1', '2']]))
})

describe('parseDate', () => {
  it('ISO y día/mes/año; rechaza las que no existen', () => {
    expect(parseDate('2026-11-28')).toBe('2026-11-28')
    expect(parseDate('28/11/2026')).toBe('2026-11-28')
    expect(parseDate('5-3-2026')).toBe('2026-03-05')
    expect(parseDate('31/02/2026')).toBeNull()
    expect(parseDate('mañana')).toBeNull()
  })
})

describe('exportar e importar una tabla', () => {
  const rows = [row('1', { f: '2026-11-03', p: 'EUR/USD', r: 125, k: 50, c: true, n: '=SUMA(1)', i: [{ t: 'Revisar stop', d: true }, { t: 'Anotar', d: false }] })]
  const csv = tableToCsv(cols, rows, computeFormulas(cols, rows))

  it('exporta con cabecera, fórmula calculada y textos protegidos', () => {
    const [header, line] = csv.replace('﻿', '').trim().split('\r\n')
    expect(header).toBe('Fecha,Par,Resultado,Riesgo,R,Cerrada,Notas,Revisión')
    expect(line).toBe("2026-11-03,EUR/USD,125,50,2.5,Sí,'=SUMA(1),[x] Revisar stop | Anotar")
  })

  it('lo exportado se vuelve a importar igual (salvo la fórmula, que se recalcula)', () => {
    const plan = planImport(parseCsv(csv), cols, 0)
    expect(plan.ignored).toEqual(['R'])
    expect(plan.invalid).toBe(0)
    expect(plan.rows).toEqual([{ f: '2026-11-03', p: 'EUR/USD', r: 125, k: 50, c: true, n: '=SUMA(1)', i: [{ t: 'Revisar stop', d: true }, { t: 'Anotar', d: false }] }])
  })

  it('convierte formatos españoles, cuenta lo inválido y avisa de columnas desconocidas', () => {
    const plan = planImport(parseCsv('fecha;PAR;resultado;Broker\n28/11/2026;gbp/jpy;"1.234,50";IG\nmal;XXX/YYY;abc;IG\n'), cols, 0)
    expect(plan.matched.map((m) => m.column.name)).toEqual(['Fecha', 'Par', 'Resultado'])
    expect(plan.ignored).toEqual(['Broker'])
    expect(plan.rows).toEqual([{ f: '2026-11-28', p: 'GBP/JPY', r: 1234.5 }])
    expect(plan.invalid).toBe(3)
  })

  it('respeta el límite de filas', () => {
    const plan = planImport(parseCsv('Notas\na\nb\nc'), cols, 4999)
    expect(plan.rows).toHaveLength(1)
    expect(plan.overflow).toBe(2)
  })
})
