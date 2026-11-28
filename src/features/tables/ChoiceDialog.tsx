import { useEffect, useMemo, useRef, useState } from 'react'

interface Props {
  title: string
  choices: readonly string[]
  value: string
  onPick(value: string): void
  onClose(): void
}

/** «eur/usd», «EURUSD» y «eur usd» son lo mismo al buscar. */
const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

/** Elegir una opción de una lista larga escribiendo para filtrar (p. ej. uno de los 28 pares de forex). */
export function ChoiceDialog({ title, choices, value, onPick, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  const shown = useMemo(() => {
    const q = normalize(query)
    return q ? choices.filter((c) => normalize(c).includes(q)) : choices
  }, [choices, query])

  return (
    <dialog ref={ref} className="choice-dialog" aria-labelledby="choice-title" onClose={onClose}>
      <h2 id="choice-title">{title}</h2>
      <label htmlFor="choice-search" className="visually-hidden">
        Buscar opción
      </label>
      <input
        id="choice-search"
        type="search"
        autoComplete="off"
        placeholder="Buscar, p. ej. gbp"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && shown.length === 1) {
            e.preventDefault()
            onPick(shown[0])
          }
        }}
      />
      <ul className="choice-list" aria-label="Opciones">
        {shown.map((c) => (
          <li key={c}>
            <button type="button" className={`choice-option${c === value ? ' is-picked' : ''}`} aria-pressed={c === value} onClick={() => onPick(c)}>
              {c}
            </button>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="muted small">Nada coincide con «{query}».</p>}
      <div className="row">
        <button type="button" className="btn" disabled={!value} onClick={() => onPick('')}>
          Vaciar
        </button>
        <button type="button" className="btn" onClick={() => ref.current?.close()}>
          Cerrar
        </button>
      </div>
    </dialog>
  )
}
