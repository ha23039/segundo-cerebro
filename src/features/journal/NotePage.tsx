import { useId, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Icon } from '../../components/Icon'
import { toMessage } from '../../lib/errors'
import { useOnline } from '../layout/useOnline'
import { renderMarkdown } from './domain/markdown'
import type { Note } from './domain/types'
import { useNote, useNoteMutations } from './hooks'
import { NOTE_BODY_MAX, NOTE_TITLE_MAX, validateNote, type NoteErrors } from './schema'
import './journal.css'

function Preview({ source }: { source: string }) {
  const html = useMemo(() => renderMarkdown(source), [source])
  if (!html) return <p className="muted">Nada que mostrar todavía.</p>
  // Seguro: renderMarkdown pasa el HTML por DOMPurify con lista cerrada de etiquetas
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />
}

function NoteForm({ note }: { note: Note | null }) {
  const online = useOnline()
  const navigate = useNavigate()
  const m = useNoteMutations()
  const ids = useId()
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  const [tags, setTags] = useState(note?.tags.join(', ') ?? '')
  const [pinned, setPinned] = useState(note?.pinned ?? false)
  const [preview, setPreview] = useState(false)
  const [errors, setErrors] = useState<NoteErrors>({})
  const [saved, setSaved] = useState(false)
  const [confirming, setConfirming] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    const r = validateNote({ title, body, tags, pinned })
    if (!r.ok) return setErrors(r.errors)
    setErrors({})
    setSaved(false)
    if (note) m.update.mutate({ id: note.id, input: r.data }, { onSuccess: () => setSaved(true) })
    else m.create.mutate(r.data, { onSuccess: (id) => navigate(`/notas/${id}`, { replace: true }) })
  }

  const failure = m.create.error ?? m.update.error ?? m.trash.error
  const pending = m.create.isPending || m.update.isPending

  return (
    <form className="note-form" onSubmit={submit} noValidate>
      <div>
        <label htmlFor={`${ids}-title`}>Título</label>
        <input id={`${ids}-title`} value={title} maxLength={NOTE_TITLE_MAX + 20} aria-invalid={errors.title ? true : undefined} onChange={(e) => setTitle(e.target.value)} />
        {errors.title && (
          <p role="alert" className="error small">
            {errors.title}
          </p>
        )}
      </div>
      <div>
        <label htmlFor={`${ids}-tags`}>Etiquetas</label>
        <input id={`${ids}-tags`} value={tags} placeholder="trabajo, ideas" aria-invalid={errors.tags ? true : undefined} onChange={(e) => setTags(e.target.value)} />
        <p className="muted small">Separadas por comas. Hasta 10.</p>
        {errors.tags && (
          <p role="alert" className="error small">
            {errors.tags}
          </p>
        )}
      </div>

      <div>
        <div className="note-body-head">
          <label htmlFor={`${ids}-body`}>Nota</label>
          <div className="pills" role="group" aria-label="Modo del editor">
            <button type="button" className="pill" aria-pressed={!preview} onClick={() => setPreview(false)}>
              Escribir
            </button>
            <button type="button" className="pill" aria-pressed={preview} onClick={() => setPreview(true)}>
              Vista previa
            </button>
          </div>
        </div>
        {preview ? (
          <div className="card note-preview" aria-label="Vista previa">
            <Preview source={body} />
          </div>
        ) : (
          <textarea id={`${ids}-body`} rows={12} value={body} aria-invalid={errors.body ? true : undefined} onChange={(e) => setBody(e.target.value)} />
        )}
        <p className="muted small">
          Admite Markdown: **negrita**, *cursiva*, # títulos, - listas, [texto](https://…). {body.length} / {NOTE_BODY_MAX}
        </p>
        {errors.body && (
          <p role="alert" className="error small">
            {errors.body}
          </p>
        )}
      </div>

      <label className="note-pin-field">
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
        <span>Fijar arriba</span>
      </label>

      {failure && (
        <p role="alert" className="error small">
          {toMessage(failure)}
        </p>
      )}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={!online || pending}>
          {note ? 'Guardar cambios' : 'Crear nota'}
        </button>
        <Link className="btn" to="/diario?vista=notas">
          Volver
        </Link>
        {saved && (
          <span className="small muted" role="status">
            Guardado
          </span>
        )}
        {note &&
          (confirming ? (
            <span className="goal-confirm" role="group" aria-label="Confirmar eliminación">
              <span>¿Mover a la papelera?</span>
              <button type="button" className="btn btn-danger" disabled={!online} onClick={() => m.trash.mutate(note.id, { onSuccess: () => navigate('/diario?vista=notas') })}>
                Sí, eliminar
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>
                No
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn-danger" disabled={!online} onClick={() => setConfirming(true)}>
              Eliminar
            </button>
          ))}
      </div>
    </form>
  )
}

export function NotePage() {
  const { id } = useParams()
  const isNew = id === 'nueva'
  const query = useNote(isNew ? undefined : id)
  const { restore } = useNoteMutations()
  const online = useOnline()

  return (
    <div className="note-page">
      <h1>{isNew ? 'Nueva nota' : 'Nota'}</h1>
      {!isNew && query.isPending && <p className="muted">Cargando…</p>}
      {!isNew && query.isError && (
        <p role="alert" className="error">
          {toMessage(query.error)}
        </p>
      )}
      {!isNew && query.isSuccess && query.data === null && (
        <div className="card empty-state">
          <p className="empty-title">Esta nota no existe.</p>
          <Link className="btn" to="/diario?vista=notas">
            Volver a las notas
          </Link>
        </div>
      )}
      {!isNew && query.data?.deletedAt && (
        <div className="card empty-state">
          <p className="empty-title">Esta nota está en la papelera.</p>
          <button className="btn btn-primary" type="button" disabled={!online} onClick={() => restore.mutate(query.data!.id, { onSuccess: () => void query.refetch() })}>
            <Icon name="undo" />
            Restaurar
          </button>
        </div>
      )}
      {isNew && <NoteForm note={null} />}
      {!isNew && query.data && !query.data.deletedAt && <NoteForm key={query.data.id} note={query.data} />}
    </div>
  )
}
