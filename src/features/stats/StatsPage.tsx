import { useSearchParams } from 'react-router'
import { toMessage } from '../../lib/errors'
import { FocusView } from './FocusView'
import { HistoryView } from './HistoryView'
import { MonthView } from './MonthView'
import { useStatsData } from './useStatsData'
import { WeekView } from './WeekView'
import './stats.css'

const TABS = [
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
  { id: 'historico', label: 'Histórico' },
  { id: 'foco', label: 'Foco' },
] as const
type TabId = (typeof TABS)[number]['id']

const isTab = (v: string | null): v is TabId => TABS.some((t) => t.id === v)

export function StatsPage() {
  const [params, setParams] = useSearchParams()
  const view = params.get('vista')
  const tab: TabId = isTab(view) ? view : 'semana'
  const data = useStatsData()

  return (
    <div className="stats">
      <h1>Estadísticas</h1>
      <div className="stats-tabs" role="tablist" aria-label="Vista">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="stats-panel"
            tabIndex={tab === t.id ? 0 : -1}
            className="stats-tab"
            onClick={() => setParams({ vista: t.id }, { replace: true })}
            onKeyDown={(e) => {
              const i = TABS.findIndex((x) => x.id === tab)
              const next = e.key === 'ArrowRight' ? TABS[(i + 1) % TABS.length] : e.key === 'ArrowLeft' ? TABS[(i + TABS.length - 1) % TABS.length] : null
              if (next) {
                setParams({ vista: next.id }, { replace: true })
                document.getElementById(`tab-${next.id}`)?.focus()
              }
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id="stats-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0}>
        {data.error && (
          <p role="alert" className="error">
            {toMessage(data.error)}
          </p>
        )}
        {data.loading ? (
          <p className="muted">Cargando…</p>
        ) : tab === 'foco' ? (
          <FocusView data={data} />
        ) : data.habits.length === 0 ? (
          <div className="card empty-state">
            <p className="empty-title">Aún no hay datos para mostrar.</p>
            <p className="muted">Crea un hábito y márcalo unos días: aquí verás tu progreso real.</p>
          </div>
        ) : tab === 'semana' ? (
          <WeekView data={data} />
        ) : tab === 'mes' ? (
          <MonthView data={data} />
        ) : (
          <HistoryView data={data} />
        )}
      </div>
    </div>
  )
}
