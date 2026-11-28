import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toMessage } from '../../lib/errors'
import { validateColumnForm, type ColumnFormErrors, type ColumnFormInput } from './domain/columnForm'
import { COLUMN_TYPES, LIMITS, type ColumnOptions, type ColumnType, type Footer, type TableColumn } from './domain/types'

interface Props {
  /** La columna que se edita; sin ella se crea una nueva. */
  column?: TableColumn
  columns: readonly TableColumn[]
  busy: boolean
  error: unknown
  canMoveLeft: boolean
  canMoveRight: boolean
  /** Valores distintos ya escritos en una columna de texto: se ofrecen como opciones al convertirla en lista. */
  suggestions?: string[]
  onSave(v: { name: string; type: ColumnType; options: ColumnOptions }): void
  onDelete?(): void
  onMove?(dir: -1 | 1): void
  onClose(): void
}

function initial(c: TableColumn | undefined): ColumnFormInput {
  return {
    name: c?.name ?? '',
    type: c?.type ?? 'texto',
    choices: (c?.options.choices ?? []).join('\n'),
    formula: c?.options.formula ?? '',
    decimals: c?.options.decimals === undefined ? '' : String(c.options.decimals),
    footer: c?.options.footer ?? 'ninguno',
    defaultValue: c?.options.default ?? '',
  }
}

/** Crear o editar una columna: nombre, tipo, opciones, fórmula y resumen al pie. */
export function ColumnDialog({ column, columns, busy, error, canMoveLeft, canMoveRight, suggestions, onSave, onDelete, onMove, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [form, setForm] = useState<ColumnFormInput>(() => initial(column))
  const [errors, setErrors] = useState<ColumnFormErrors>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  const set = (patch: Partial<ColumnFormInput>) => setForm((f) => ({ ...f, ...patch }))
  const convertible = column?.type === 'texto'
  const numeric = form.type === 'numero' || form.type === 'formula'
  const refsPool = columns.filter((c) => c.id !== column?.id && (c.type === 'numero' || c.type === 'formula'))

  function submit(e: FormEvent) {
    e.preventDefault()
    const r = validateColumnForm(form, columns, column?.id)
    if (!r.ok) return setErrors(r.errors)
    setErrors({})
    onSave(r.value)
  }

  return (
    <dialog ref={ref} className="column-dialog" aria-labelledby="column-title" onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <h2 id="column-title">{column ? `Columna «${column.name}»` : 'Nueva columna'}</h2>

        <div>
          <label htmlFor="col-name">Nombre</label>
          <input id="col-name" value={form.name} maxLength={LIMITS.columnName} autoComplete="off" aria-invalid={errors.name ? true : undefined} onChange={(e) => set({ name: e.target.value })} />
          {errors.name && (
            <p role="alert" className="error field-error">
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="col-type">Tipo</label>
          <select
            id="col-type"
            value={form.type}
            disabled={!!column && !convertible}
            onChange={(e) => {
              const type = e.target.value as ColumnType
              set({ type, defaultValue: '', ...(type === 'lista' && !form.choices.trim() && suggestions?.length ? { choices: suggestions.join('\n') } : {}) })
            }}
          >
            {COLUMN_TYPES.filter((t) => !convertible || t.id === 'texto' || t.id === 'lista').map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          {column && !convertible && <p className="muted small hint">El tipo no se puede cambiar después de crear la columna.</p>}
          {convertible && <p className="muted small hint">Una columna de texto se puede convertir en lista; lo ya escrito se conserva.</p>}
        </div>

        {form.type === 'lista' && (
          <div>
            <label htmlFor="col-choices">Opciones (una por línea)</label>
            <textarea id="col-choices" rows={4} value={form.choices} aria-invalid={errors.choices ? true : undefined} onChange={(e) => set({ choices: e.target.value })} />
            {errors.choices && (
              <p role="alert" className="error field-error">
                {errors.choices}
              </p>
            )}
          </div>
        )}

        {form.type === 'formula' && (
          <div>
            <label htmlFor="col-formula">Fórmula</label>
            <textarea
              id="col-formula"
              rows={2}
              value={form.formula}
              maxLength={LIMITS.formula + 50}
              spellCheck={false}
              aria-invalid={errors.formula ? true : undefined}
              aria-describedby="col-formula-help"
              onChange={(e) => set({ formula: e.target.value })}
            />
            <p id="col-formula-help" className="muted small hint">
              Usa las columnas entre llaves, por ejemplo {'{Salida} - {Entrada}'}. Admite + - * / y paréntesis, ABS, ROUND y, sobre toda la columna, SUM, AVG, MIN, MAX y COUNT.
            </p>
            {refsPool.length > 0 && (
              <div className="formula-chips" role="group" aria-label="Insertar columna">
                {refsPool.map((c) => (
                  <button key={c.id} type="button" className="btn chip" onClick={() => set({ formula: `${form.formula}{${c.name}}` })}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {errors.formula && (
              <p role="alert" className="error field-error">
                {errors.formula}
              </p>
            )}
          </div>
        )}

        {form.type !== 'formula' && form.type !== 'items' && (
          <div>
            {form.type === 'fecha' || form.type === 'casilla' ? (
              <label className="choice">
                <input type="checkbox" checked={form.defaultValue === (form.type === 'fecha' ? 'hoy' : 'si')} onChange={(e) => set({ defaultValue: e.target.checked ? (form.type === 'fecha' ? 'hoy' : 'si') : '' })} />
                <span>{form.type === 'fecha' ? 'Poner la fecha de hoy en las filas nuevas' : 'Marcada en las filas nuevas'}</span>
              </label>
            ) : form.type === 'lista' ? (
              <>
                <label htmlFor="col-default">Valor por defecto</label>
                <select id="col-default" value={form.defaultValue ?? ''} aria-invalid={errors.default ? true : undefined} onChange={(e) => set({ defaultValue: e.target.value })}>
                  <option value="">Ninguno</option>
                  {form.choices
                    .split('\n')
                    .map((c) => c.trim())
                    .filter(Boolean)
                    .map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                </select>
              </>
            ) : (
              <>
                <label htmlFor="col-default">Valor por defecto</label>
                <input id="col-default" value={form.defaultValue ?? ''} autoComplete="off" inputMode={form.type === 'numero' ? 'decimal' : undefined} placeholder="Ninguno" aria-invalid={errors.default ? true : undefined} onChange={(e) => set({ defaultValue: e.target.value })} />
              </>
            )}
            {errors.default && (
              <p role="alert" className="error field-error">
                {errors.default}
              </p>
            )}
          </div>
        )}

        {numeric && (
          <div className="row two-cols">
            <div>
              <label htmlFor="col-decimals">Decimales</label>
              <input id="col-decimals" inputMode="numeric" value={form.decimals} placeholder="Automático" aria-invalid={errors.decimals ? true : undefined} onChange={(e) => set({ decimals: e.target.value })} />
              {errors.decimals && (
                <p role="alert" className="error field-error">
                  {errors.decimals}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="col-footer">Resumen al pie</label>
              <select id="col-footer" value={form.footer} onChange={(e) => set({ footer: e.target.value as Footer })}>
                <option value="ninguno">Ninguno</option>
                <option value="suma">Suma</option>
                <option value="media">Media</option>
              </select>
            </div>
          </div>
        )}

        {error != null && (
          <p role="alert" className="error">
            {toMessage(error)}
          </p>
        )}

        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
          <button className="btn" type="button" onClick={() => ref.current?.close()}>
            Cancelar
          </button>
        </div>

        {column && onMove && onDelete && (
          <div className="column-extra">
            <div className="row">
              <button className="btn" type="button" disabled={!canMoveLeft || busy} onClick={() => onMove(-1)}>
                Mover a la izquierda
              </button>
              <button className="btn" type="button" disabled={!canMoveRight || busy} onClick={() => onMove(1)}>
                Mover a la derecha
              </button>
            </div>
            {confirmDelete ? (
              <div className="row">
                <p className="error small">Se borra la columna y lo que hay escrito en ella.</p>
                <button className="btn btn-danger" type="button" disabled={busy} onClick={onDelete}>
                  Sí, borrar columna
                </button>
                <button className="btn" type="button" onClick={() => setConfirmDelete(false)}>
                  No
                </button>
              </div>
            ) : (
              <button className="btn btn-danger" type="button" onClick={() => setConfirmDelete(true)}>
                Borrar columna
              </button>
            )}
          </div>
        )}
      </form>
    </dialog>
  )
}
