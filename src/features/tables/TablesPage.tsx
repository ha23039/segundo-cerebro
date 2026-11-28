import { TablesView } from './TablesView'
import './tables.css'

/** Acceso directo a todas tus tablas (registros de gastos, journal de trading…), fuera del diario. */
export function TablesPage() {
  return (
    <div className="tables-page">
      <h1>Tablas</h1>
      <p className="muted">Hojas con tus propias columnas: gastos, trading, lecturas, lo que quieras llevar.</p>
      <TablesView />
    </div>
  )
}
