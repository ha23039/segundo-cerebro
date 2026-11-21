import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { formatLongDate } from '../../lib/dates'
import { toMessage } from '../../lib/errors'
import { useOnline } from '../layout/useOnline'
import { useDeletedNotes, useNoteMutations, useNotes } from './hooks'
import { excerpt } from './domain/excerpt'
import { tagCounts } from './domain/tags'
import type { Note } from './domain/types'

function NoteItem({ note }: { note: Note }) {
  return (
    <li>
      <Link className="card note-item" to={`/notas/${note.id}`}>
        <span className="note-item-head">
          <span className="note-item-title">{note.title}</span>
          {note.pinned && <span className="note-pin">Fijada</span>}
        </span>
        {note.body && <span className="note-item-text">{excerpt(note.body)}</span>}
        <span className="note-item-foot">
          {note.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
          <span className="muted small">{formatLongDate(note.updatedAt.slice(0, 10))}</span>
        </span>
      </Link>
    </li>
  )
}

export function NotesView() {
  const online = useOnline()
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const all = useNotes('')
  const found = useNotes(query)
  const deleted = useDeletedNotes()
  const { restore } = useNoteMutations()

  useEffect(() => {
    const id = window.setTimeout(() => setQuery(input), 250)
    return () => window.clearTimeout(id)
  }, [input])

  const tags = tagCounts(all.data ?? [])
  const shown = (found.data ?? []).filter((n) => !tag || n.tags.includes(tag))
  const filtering = query.trim() !== '' || tag !== null

  return (
    <div className="notes">
      <div className="notes-bar">
        <div className="notes-search">
          <label htmlFor="notes-q" className="visually-hidden">
            Buscar notas
          </label>
          <input id="notes-q" type="search" placeholder="Buscar en las notas" value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off" />
        </div>
        <Link className="btn btn-primary" to="/notas/nueva">
          <Icon name="plus" />
          Nueva nota
        </Link>
      </div>

      {tags.length > 0 && (
        <div className="pills note-tags" role="group" aria-label="Filtrar por etiqueta">
          {tags.map(({ tag: t, count }) => (
            <button key={t} type="button" className="pill" aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
              {t} <span className="muted">{count}</span>
            </button>
          ))}
        </div>
      )}

      {found.isError && (
        <p role="alert" className="error">
          {toMessage(found.error)}
        </p>
      )}
      {found.isPending ? (
        <p className="muted">Cargando…</p>
      ) : shown.length === 0 ? (
        <div className="card empty-state">
          <p className="empty-title">{filtering ? 'No hay notas que coincidan.' : 'Aún no tienes notas.'}</p>
          <p className="muted">{filtering ? 'Prueba con otras palabras u otra etiqueta.' : 'Guarda ideas, apuntes o listas. Admiten Markdown y etiquetas.'}</p>
        </div>
      ) : (
        <ul className="note-list" aria-label={filtering ? 'Resultados' : 'Notas'}>
          {shown.map((n) => (
            <NoteItem key={n.id} note={n} />
          ))}
        </ul>
      )}

      {deleted.data && deleted.data.length > 0 && (
        <section aria-labelledby="notes-trash-title" className="note-trash">
          <h2 id="notes-trash-title">Papelera</h2>
          <p className="muted small">Se borran definitivamente a los 30 días.</p>
          <ul className="note-list">
            {deleted.data.map((n) => (
              <li key={n.id} className="card goal-trash">
                <span className="goal-trash-title">{n.title}</span>
                <button className="btn" type="button" disabled={!online} onClick={() => restore.mutate(n.id)}>
                  <Icon name="undo" />
                  Restaurar<span className="visually-hidden"> {n.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
