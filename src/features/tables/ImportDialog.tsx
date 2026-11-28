import { useEffect, useRef } from 'react'
import { toMessage } from '../../lib/errors'
import type { ImportPlan } from './domain/csvTable'

interface Props {
  fileName: string
  plan: ImportPlan
  busy: boolean
  error: unknown
  onConfirm(): void
  onClose(): void
}

/** Resumen de lo que se va a importar, antes de tocar nada: el usuario confirma o cancela. */
export function ImportDialog({ fileName, plan, busy, error, onConfirm, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  const none = plan.rows.length === 0
  return (
    <dialog ref={ref} className="column-dialog" aria-labelledby="import-title" onClose={onClose}>
      <div className="stack">
        <h2 id="import-title">Importar «{fileName}»</h2>
        {none ? (
          <p role="alert" className="error">
            No hay filas que importar. Comprueba que la primera línea del archivo tenga los nombres de tus columnas.
          </p>
        ) : (
          <p>
            Se añadirán <strong>{plan.rows.length}</strong> {plan.rows.length === 1 ? 'fila' : 'filas'} al final de la tabla.
          </p>
        )}
        {plan.matched.length > 0 && (
          <p className="small">
            <span className="muted">Columnas reconocidas: </span>
            {plan.matched.map((m) => m.column.name).join(', ')}
          </p>
        )}
        {plan.ignored.length > 0 && (
          <p className="small">
            <span className="muted">Sin coincidencia, se ignoran: </span>
            {plan.ignored.join(', ')}
          </p>
        )}
        {plan.invalid > 0 && <p className="small muted">{plan.invalid} {plan.invalid === 1 ? 'valor no encaja' : 'valores no encajan'} con su columna y quedarán vacíos.</p>}
        {plan.overflow > 0 && <p className="small error">{plan.overflow} {plan.overflow === 1 ? 'fila no cabe' : 'filas no caben'} por el límite de la tabla y se dejarán fuera.</p>}
        {error != null && (
          <p role="alert" className="error">
            {toMessage(error)}
          </p>
        )}
        <div className="row">
          <button className="btn btn-primary" type="button" disabled={busy || none} onClick={onConfirm}>
            {busy ? 'Importando…' : 'Importar'}
          </button>
          <button className="btn" type="button" onClick={() => ref.current?.close()}>
            Cancelar
          </button>
        </div>
      </div>
    </dialog>
  )
}
