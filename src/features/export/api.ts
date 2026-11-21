import { supabase } from '../../lib/supabase'
import { EXPORT_TABLES, PRIMARY_KEY, stripDerived, type ExportData, type ExportTable, type Row } from './domain/bundle'

const PAGE = 1000

async function fetchTable(table: ExportTable): Promise<Row[]> {
  const out: Row[] = []
  for (let offset = 0; ; offset += PAGE) {
    // Orden por clave primaria para que las páginas no se solapen ni se salten filas
    let q = supabase.from(table).select('*')
    for (const col of PRIMARY_KEY[table]) q = q.order(col as never, { ascending: true })
    const { data, error } = await q.range(offset, offset + PAGE - 1)
    if (error) throw error
    out.push(...(data as Row[]))
    if (data.length < PAGE) return out
  }
}

/** Todos los datos del usuario, incluidos lo archivado y la papelera. Solo lectura. */
export async function fetchAllData(): Promise<ExportData> {
  const entries = await Promise.all(EXPORT_TABLES.map(async (t) => [t, stripDerived(t, await fetchTable(t))] as const))
  return Object.fromEntries(entries) as ExportData
}
