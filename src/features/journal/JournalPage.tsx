import { useSearchParams } from 'react-router'
import { JournalView } from './JournalView'
import { NotesView } from './NotesView'
import { TablesView } from '../tables/TablesView'
import '../stats/stats.css'
import './journal.css'

const TABS = [
  { id: 'diario', label: 'Diario' },
  { id: 'notas', label: 'Notas' },
  { id: 'tablas', label: 'Tablas' },
] as const
type TabId = (typeof TABS)[number]['id']

const isTab = (v: string | null): v is TabId => TABS.some((t) => t.id === v)

export function JournalPage() {
  const [params, setParams] = useSearchParams()
  const view = params.get('vista')
  const tab: TabId = isTab(view) ? view : 'diario'

  return (
    <div className="journal-page">
      <h1>Diario, notas y tablas</h1>
      <div className="stats-tabs" role="tablist" aria-label="Sección">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="journal-panel"
            tabIndex={tab === t.id ? 0 : -1}
            className="stats-tab"
            onClick={() => setParams(t.id === 'diario' ? {} : { vista: t.id }, { replace: true })}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                const i = TABS.findIndex((x) => x.id === tab)
                const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
                setParams(next.id === 'diario' ? {} : { vista: next.id }, { replace: true })
                document.getElementById(`tab-${next.id}`)?.focus()
              }
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id="journal-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'diario' ? <JournalView /> : tab === 'notas' ? <NotesView /> : <TablesView />}
      </div>
    </div>
  )
}
