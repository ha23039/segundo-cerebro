import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { toMessage } from '../../lib/errors'
import { useOnline } from '../layout/useOnline'
import { TABLE_TEMPLATES } from './domain/templates'
import { LIMITS } from './domain/types'
import { useDeletedTables, useTables, useTablesMutations } from './hooks'

function NewTable({ onDone }: { onDone(): void }) {
  const navigate = useNavigate()
  const { create } = useTablesMutations()
  const [name, setName] = useState('')
  const [template, setTemplate] = useState('vacia')
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Escribe un nombre')
    if (trimmed.length > LIMITS.tableName) return setError(`Máximo ${LIMITS.tableName} caracteres`)
    setError(null)
    const t = TABLE_TEMPLATES.find((x) => x.id === template)!
    const id = crypto.randomUUID()
    create.mutate(
      { id, name: trimmed, columns: t.columns.map((c, i) => ({ id: crypto.randomUUID(), name: c.name, type: c.type, options: c.options ?? {}, position: i + 1 })) },
      { onSuccess: () => navigate(`/tablas/${id}`) },
    )
  }

  return (
    <form className="card tables-new" onSubmit={submit} noValidate>
      <div>
        <label htmlFor="table-name">Nombre de la tabla</label>
        <input id="table-name" value={name} maxLength={LIMITS.tableName} autoComplete="off" aria-invalid={error ? true : undefined} onChange={(e) => setName(e.target.value)} />
      </div>
      <fieldset className="choice-group">
        <legend>Empezar desde</legend>
        {TABLE_TEMPLATES.map((t) => (
          <label key={t.id} className="choice tables-template">
            <input type="radio" name="template" checked={template === t.id} onChange={() => setTemplate(t.id)} />
            <span>
              {t.name}
              <span className="muted small tables-template-desc">{t.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {(error || create.isError) && (
        <p role="alert" className="error">
          {error ?? toMessage(create.error)}
        </p>
      )}
      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creando…' : 'Crear tabla'}
        </button>
        <button className="btn" type="button" onClick={onDone}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

/** Pestaña «Tablas» del diario: hojas con columnas personalizadas (trading, gastos…). */
export function TablesView() {
  const online = useOnline()
  const tables = useTables()
  const deleted = useDeletedTables()
  const { restore } = useTablesMutations()
  const [creating, setCreating] = useState(false)

  return (
    <div className="tables-view">
      <div className="row">
        <button className="btn btn-primary" type="button" disabled={!online || creating} onClick={() => setCreating(true)}>
          Nueva tabla
        </button>
      </div>
      {creating && <NewTable onDone={() => setCreating(false)} />}

      {tables.isError && (
        <p role="alert" className="error">
          {toMessage(tables.error)}
        </p>
      )}
      {tables.isPending && <p className="muted">Cargando…</p>}
      {tables.isSuccess && tables.data.length === 0 && !creating && (
        <p className="empty">Aún no tienes tablas. Crea la primera para llevar, por ejemplo, tu journal de trading con tus propias columnas.</p>
      )}
      {tables.data && tables.data.length > 0 && (
        <ul className="note-list" aria-label="Tus tablas">
          {tables.data.map((t) => (
            <li key={t.id}>
              <Link className="card note-item" to={`/tablas/${t.id}`}>
                <span className="note-item-title">{t.name}</span>
                {t.rowCount !== undefined && <span className="muted small"><span className="visually-hidden">, </span>{t.rowCount === 1 ? '1 fila' : `${t.rowCount} filas`}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {deleted.data && deleted.data.length > 0 && (
        <section className="note-trash" aria-labelledby="tables-trash">
          <h2 id="tables-trash">Tablas borradas</h2>
          <p className="muted small">Se pueden restaurar durante 30 días.</p>
          <ul className="note-list">
            {deleted.data.map((t) => (
              <li key={t.id} className="card trash-item">
                <span className="trash-name">{t.name}</span>
                <button className="btn" type="button" disabled={!online || restore.isPending} onClick={() => restore.mutate(t.id)}>
                  Restaurar<span className="visually-hidden"> {t.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
