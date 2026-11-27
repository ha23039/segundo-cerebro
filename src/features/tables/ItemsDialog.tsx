import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { LIMITS, type Item } from './domain/types'

interface Props {
  title: string
  items: Item[]
  disabled: boolean
  onChange(items: Item[]): void
  onClose(): void
}

/** Lista de ítems de una celda (tachables y con texto), en un diálogo modal. Cada cambio se guarda al momento. */
export function ItemsDialog({ title, items, disabled, onChange, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  function add(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    if (t.length > LIMITS.itemText) return setError(`Máximo ${LIMITS.itemText} caracteres`)
    if (items.length >= LIMITS.items) return setError(`Máximo ${LIMITS.items} ítems`)
    setError(null)
    setText('')
    onChange([...items, { t, d: false }])
  }

  return (
    <dialog ref={ref} className="items-dialog" aria-labelledby="items-title" onClose={onClose}>
      <div className="items-head">
        <h2 id="items-title">{title}</h2>
        <button type="button" className="btn icon-btn" aria-label="Cerrar" onClick={() => ref.current?.close()}>
          <Icon name="close" />
        </button>
      </div>
      {items.length === 0 && <p className="muted">Aún no hay ítems.</p>}
      <ul className="items-list">
        {items.map((it, i) => (
          <li key={i} className="items-row">
            <label className="items-check">
              <input type="checkbox" checked={it.d} disabled={disabled} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, d: e.target.checked } : x)))} />
              <span className={it.d ? 'is-done' : undefined}>{it.t}</span>
            </label>
            <button type="button" className="btn icon-btn ghost" disabled={disabled} aria-label={`Quitar ${it.t}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <Icon name="close" />
            </button>
          </li>
        ))}
      </ul>
      <form className="items-add" onSubmit={add}>
        <label htmlFor="items-new" className="visually-hidden">
          Nuevo ítem
        </label>
        <input id="items-new" value={text} placeholder="Añadir ítem" maxLength={LIMITS.itemText + 20} disabled={disabled} autoComplete="off" onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-primary" type="submit" disabled={disabled}>
          Añadir
        </button>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </dialog>
  )
}
