import { useState, type FormEvent, type ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { FILTER_OPS, opsFor, type FilterOp, type FilterRule } from './domain/analysis'
import { findResultColumn } from './domain/analysis'
import type { TableColumn } from './domain/types'
import type { SavedView } from './useTableView'

interface Props {
  columns: readonly TableColumn[]
  rules: FilterRule[]
  saved: SavedView[]
  /** Mes actual, `AAAA-MM`, en la zona horaria del perfil. */
  month: string
  shown: number
  total: number
  /** El panel de filtros se abre y cierra desde la barra; los filtros activos se ven siempre. */
  open: boolean
  /** Controles extra al principio del panel (p. ej. ordenar). */
  children?: ReactNode
  onChange(rules: FilterRule[]): void
  onSaveView(name: string): void
  onDeleteView(name: string): void
}

const needsValue = (op: FilterOp) => !['filled', 'empty', 'month'].includes(op)

function describe(rule: FilterRule, columns: readonly TableColumn[]): string {
  const col = columns.find((c) => c.id === rule.columnId)
  if (!col) return 'columna borrada'
  const v = rule.op === 'month' ? rule.value : col.type === 'casilla' ? (rule.value === 'si' ? 'sí' : 'no') : rule.value
  return `${col.name} ${FILTER_OPS[rule.op]}${needsValue(rule.op) || rule.op === 'month' ? ` ${v ?? ''}` : ''}`.trim()
}

/** Filtros de la tabla: atajos, reglas propias y vistas guardadas. */
export function TableFilters({ columns, rules, saved, month, shown, total, open, children, onChange, onSaveView, onDeleteView }: Props) {
  const [adding, setAdding] = useState(false)
  const [columnId, setColumnId] = useState('')
  const [op, setOp] = useState<FilterOp>('eq')
  const [value, setValue] = useState('')
  const [viewName, setViewName] = useState('')

  const result = findResultColumn(columns)
  const date = columns.find((c) => c.type === 'fecha')
  const plan = columns.find((c) => /plan/i.test(c.name) && c.type === 'lista')
  const col = columns.find((c) => c.id === columnId) ?? columns[0]
  const ops = col ? opsFor(col) : []

  const has = (r: FilterRule) => rules.some((x) => x.columnId === r.columnId && x.op === r.op && x.value === r.value)
  /** «Solo pérdidas» y «Solo ganancias» no pueden estar a la vez: al activar una se quita la otra. */
  const opposite = (r: FilterRule) => (result && r.columnId === result.id && r.value === '0' ? (r.op === 'lt' ? 'gt' : r.op === 'gt' ? 'lt' : null) : null)
  const toggle = (r: FilterRule) => onChange(has(r) ? rules.filter((x) => !(x.columnId === r.columnId && x.op === r.op && x.value === r.value)) : [...rules.filter((x) => !(opposite(r) && x.columnId === r.columnId && x.op === opposite(r) && x.value === '0')), r])

  function pickColumn(id: string) {
    setColumnId(id)
    const c = columns.find((x) => x.id === id)
    const first = c ? opsFor(c)[0] : 'eq'
    setOp(first)
    setValue(first === 'month' ? month : c?.type === 'casilla' ? 'si' : c?.type === 'lista' ? (c.options.choices?.[0] ?? '') : '')
  }

  function add(e: FormEvent) {
    e.preventDefault()
    if (!col) return
    if (needsValue(op) && !value.trim()) return
    onChange([...rules, { columnId: col.id, op, value: needsValue(op) || op === 'month' ? (op === 'month' ? value || month : value.trim()) : undefined }])
    setAdding(false)
    setValue('')
  }

  if (columns.length === 0) return null

  return (
    <section className="table-filters" aria-label="Filtros">
      {open && (
      <div id="table-filters-panel" className="filter-panel">
      {children}
      <div className="filter-row">
        <span className="eyebrow">Filtrar</span>
        {result && (
          <>
            <button type="button" className="chip-toggle" aria-pressed={has({ columnId: result.id, op: 'lt', value: '0' })} onClick={() => toggle({ columnId: result.id, op: 'lt', value: '0' })}>
              Solo pérdidas
            </button>
            <button type="button" className="chip-toggle" aria-pressed={has({ columnId: result.id, op: 'gt', value: '0' })} onClick={() => toggle({ columnId: result.id, op: 'gt', value: '0' })}>
              Solo ganancias
            </button>
          </>
        )}
        {date && (
          <button type="button" className="chip-toggle" aria-pressed={has({ columnId: date.id, op: 'month', value: month })} onClick={() => toggle({ columnId: date.id, op: 'month', value: month })}>
            Este mes
          </button>
        )}
        {plan && (
          <button type="button" className="chip-toggle" aria-pressed={has({ columnId: plan.id, op: 'eq', value: 'No' })} onClick={() => toggle({ columnId: plan.id, op: 'eq', value: 'No' })}>
            No siguió el plan
          </button>
        )}
        <button
          type="button"
          className="chip-toggle"
          aria-expanded={adding}
          onClick={() => {
            setAdding((a) => !a)
            if (!columnId && columns[0]) pickColumn(columns[0].id)
          }}
        >
          <Icon name="plus" size={14} /> Filtro propio
        </button>
      </div>

      {adding && col && (
        <form className="filter-form" onSubmit={add}>
          <label className="visually-hidden" htmlFor="flt-col">Columna del filtro</label>
          <select id="flt-col" value={col.id} onChange={(e) => pickColumn(e.target.value)}>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label className="visually-hidden" htmlFor="flt-op">Condición</label>
          <select id="flt-op" value={op} onChange={(e) => setOp(e.target.value as FilterOp)}>
            {ops.map((o) => (
              <option key={o} value={o}>{FILTER_OPS[o]}</option>
            ))}
          </select>
          {op === 'month' && (
            <>
              <label className="visually-hidden" htmlFor="flt-val">Mes</label>
              <input id="flt-val" type="month" value={value || month} onChange={(e) => setValue(e.target.value)} />
            </>
          )}
          {needsValue(op) && col.type === 'lista' && (
            <>
              <label className="visually-hidden" htmlFor="flt-val">Valor</label>
              <select id="flt-val" value={value} onChange={(e) => setValue(e.target.value)}>
                {(col.options.choices ?? []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </>
          )}
          {needsValue(op) && col.type === 'casilla' && (
            <>
              <label className="visually-hidden" htmlFor="flt-val">Valor</label>
              <select id="flt-val" value={value || 'si'} onChange={(e) => setValue(e.target.value)}>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </>
          )}
          {needsValue(op) && col.type !== 'lista' && col.type !== 'casilla' && (
            <>
              <label className="visually-hidden" htmlFor="flt-val">Valor</label>
              <input id="flt-val" value={value} autoComplete="off" inputMode={col.type === 'numero' || col.type === 'formula' ? 'decimal' : undefined} onChange={(e) => setValue(e.target.value)} />
            </>
          )}
          <button className="btn btn-primary" type="submit">Aplicar filtro</button>
        </form>
      )}

      </div>
      )}

      {rules.length > 0 && (
        <div className="filter-row">
          <ul className="filter-chips" aria-label="Filtros activos">
            {rules.map((r, i) => (
              <li key={`${r.columnId}-${r.op}-${r.value}-${i}`} className="filter-chip">
                <span>{describe(r, columns)}</span>
                <button type="button" className="icon-plain" aria-label={`Quitar filtro ${describe(r, columns)}`} onClick={() => onChange(rules.filter((_, j) => j !== i))}>
                  <Icon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
          <span className="muted small" role="status">{shown} de {total} filas</span>
          <button type="button" className="btn ghost" onClick={() => onChange([])}>Quitar todos</button>
        </div>
      )}

      {open && (
      <div className="filter-row">
        {saved.length > 0 && (
          <>
            <span className="muted small">Vistas</span>
            {saved.map((v) => (
              <span key={v.name} className="saved-view">
                <button type="button" className="chip-toggle" onClick={() => onChange(v.rules)}>{v.name}</button>
                <button type="button" className="icon-plain" aria-label={`Borrar la vista ${v.name}`} onClick={() => onDeleteView(v.name)}>
                  <Icon name="close" size={14} />
                </button>
              </span>
            ))}
          </>
        )}
        {rules.length > 0 && (
          <form
            className="filter-save"
            onSubmit={(e) => {
              e.preventDefault()
              const n = viewName.trim()
              if (n) {
                onSaveView(n)
                setViewName('')
              }
            }}
          >
            <label className="visually-hidden" htmlFor="view-name">Nombre de la vista</label>
            <input id="view-name" value={viewName} maxLength={30} placeholder="Guardar como vista" autoComplete="off" onChange={(e) => setViewName(e.target.value)} />
            <button className="btn" type="submit" disabled={!viewName.trim()}>Guardar vista</button>
          </form>
        )}
      </div>
      )}
    </section>
  )
}
