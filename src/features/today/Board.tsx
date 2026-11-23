import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { blockLabel, DEFAULT_LAYOUT, isDefault, isWide, move, moveVisible, toggleHidden, type BlockId, type TodayLayout } from './domain/layout'

interface Props {
  layout: TodayLayout
  render(id: BlockId): ReactNode
  customizing: boolean
  onChange(next: TodayLayout): void
  onDone(): void
}

function EditItem({ id, node, first, last, onUp, onDown, onHide }: { id: BlockId; node: ReactNode; first: boolean; last: boolean; onUp(): void; onDown(): void; onHide(): void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const label = blockLabel(id)
  return (
    <li
      ref={setNodeRef}
      className={`board-item board-edit-item${isWide(id) ? ' is-wide' : ''}${isDragging ? ' is-dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="board-toolbar">
        <button type="button" ref={setActivatorNodeRef} className="board-handle" aria-label={`Mover ${label}`} {...attributes} {...listeners}>
          <Icon name="grip" />
        </button>
        <span className="board-tile-label">{label}</span>
        <span className="board-tile-actions">
          <button type="button" className="btn icon-btn ghost" aria-label={`Subir ${label}`} disabled={first} onClick={onUp}>
            <Icon name="up" />
          </button>
          <button type="button" className="btn icon-btn ghost" aria-label={`Bajar ${label}`} disabled={last} onClick={onDown}>
            <Icon name="down" />
          </button>
          <button type="button" className="btn icon-btn ghost" aria-label={`Ocultar ${label}`} onClick={onHide}>
            <Icon name="eyeOff" />
          </button>
        </span>
      </div>
      {/* La tarjeta real se ve tal cual, pero no se puede usar mientras se reordena */}
      <div className="board-edit-body" inert>
        {node ?? <p className="muted small board-empty">Aparecerá aquí cuando tenga datos.</p>}
      </div>
    </li>
  )
}

const announcements = (order: () => BlockId[]): Announcements => ({
  onDragStart: ({ active }) => `Has cogido ${blockLabel(active.id as BlockId)}.`,
  onDragOver: ({ active, over }) => (over ? `${blockLabel(active.id as BlockId)} está sobre ${blockLabel(over.id as BlockId)}.` : undefined),
  onDragEnd: ({ active, over }) =>
    over ? `${blockLabel(active.id as BlockId)} soltada en la posición ${order().indexOf(over.id as BlockId) + 1}.` : `${blockLabel(active.id as BlockId)} soltada sin cambios.`,
  onDragCancel: ({ active }) => `Movimiento cancelado: ${blockLabel(active.id as BlockId)} vuelve a su sitio.`,
})

/** Las tarjetas de Hoy en el orden elegido. En modo personalizar se muestran como fichas que se arrastran, suben, bajan u ocultan. */
export function Board({ layout, render, customizing, onChange, onDone }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const visible = layout.order.filter((id) => !layout.hidden.includes(id))
  const hidden = layout.order.filter((id) => layout.hidden.includes(id))

  if (!customizing) {
    return (
      <div className="board">
        {visible.map((id) => {
          const node = render(id)
          return node ? (
            <div key={id} className={`board-item${isWide(id) ? ' is-wide' : ''}`}>
              {node}
            </div>
          ) : null
        })}
      </div>
    )
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    onChange({ ...layout, order: move(layout.order, layout.order.indexOf(active.id as BlockId), layout.order.indexOf(over.id as BlockId)) })
  }

  return (
    <div className="board-editing">
      <section className="board-edit card" aria-labelledby="board-edit-title">
        <div className="card-head">
          <h2 id="board-edit-title">Personalizar Hoy</h2>
          <div className="row">
            <button type="button" className="btn" disabled={isDefault(layout)} onClick={() => onChange(DEFAULT_LAYOUT)}>
              Restablecer
            </button>
            <button type="button" className="btn btn-primary" onClick={onDone}>
              Listo
            </button>
          </div>
        </div>
        <p className="muted small">Arrastra cada tarjeta por su asa para colocarla donde quieras, o usa las flechas. Lo que ocultes no se muestra en Hoy.</p>

        {hidden.length > 0 && (
          <>
            <h3 className="board-hidden-title">Tarjetas ocultas</h3>
            <ul className="board-tiles" aria-label="Tarjetas ocultas">
              {hidden.map((id) => (
                <li key={id} className="board-tile is-hidden">
                  <span className="board-tile-label">{blockLabel(id)}</span>
                  <button type="button" className="btn" onClick={() => onChange(toggleHidden(layout, id))}>
                    <Icon name="eye" />
                    Mostrar<span className="visually-hidden"> {blockLabel(id)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements: announcements(() => layout.order),
          screenReaderInstructions: { draggable: 'Para mover la tarjeta pulsa espacio, usa las flechas y vuelve a pulsar espacio para soltarla. Escape cancela.' },
        }}
      >
        <SortableContext items={visible} strategy={rectSortingStrategy}>
          <ul className="board board-sorting" aria-label="Tarjetas visibles">
            {visible.map((id, i) => (
              <EditItem
                key={id}
                id={id}
                node={render(id)}
                first={i === 0}
                last={i === visible.length - 1}
                onUp={() => onChange(moveVisible(layout, id, -1))}
                onDown={() => onChange(moveVisible(layout, id, 1))}
                onHide={() => onChange(toggleHidden(layout, id))}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}
