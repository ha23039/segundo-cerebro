import { useSearchParams } from 'react-router'
import { JournalView } from './JournalView'
import { NotesView } from './NotesView'
import '../stats/stats.css'
import './journal.css'

const TABS = [
  { id: 'diario', label: 'Diario' },
  { id: 'notas', label: 'Notas' },
] as const
type TabId = (typeof TABS)[number]['id']

const isTab = (v: string | null): v is TabId => TABS.some((t) => t.id === v)

export function JournalPage() {
  const [params, setParams] = useSearchParams()
  const view = params.get('vista')
  const tab: TabId = isTab(view) ? view : 'diario'

  return (
    <div className="journal-page">
      <h1>Diario y notas</h1>
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
                const next = TABS.find((x) => x.id !== tab)!
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
        {tab === 'diario' ? <JournalView /> : <NotesView />}
      </div>
    </div>
  )
}
