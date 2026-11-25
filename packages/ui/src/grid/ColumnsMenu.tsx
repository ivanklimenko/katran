import { Fragment, useRef, useState, type DragEvent, type RefObject } from 'react'
import { IconButton } from '../button'
import { Checkbox, Input } from '../input'
import { ColsGrip, ColsItem, ColsList, ColsMenu, ColsName, ColsSplit } from './parts'
import type { ColumnDef, ColumnsState } from './types'

export type ColumnsMenuProps<Row> = {
  open: boolean
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  columns: ColumnDef<Row>[]
  order: string[]
  hidden: string[]
  onChange: (state: ColumnsState) => void
  /** id хостов в режиме «раздельно» (спека 5a §4). */
  split?: string[] | undefined
  onSplit?: ((p: { id: string; on: boolean }) => void) | undefined
  className?: string | undefined
}

const Up = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 10l4-4 4 4" /></svg>
const Down = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6l4 4 4-4" /></svg>

const nameOf = <Row,>(c: ColumnDef<Row>) => c.menuTitle ?? c.title ?? c.id

/** Состав и порядок колонок: галочки, перетаскивание и перенос кнопками — работает с клавиатуры из коробки (спека 6.3). */
export function ColumnsMenu<Row>({ open, anchor, onClose, columns, order, hidden, onChange, split = [], onSplit, className }: ColumnsMenuProps<Row>) {
  const [q, setQ] = useState('')
  const dragging = useRef<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; edge: 'before' | 'after' } | null>(null)
  const byId = new Map(columns.map((c) => [c.id, c]))
  const full = [...order.filter((id) => byId.has(id)), ...columns.map((c) => c.id).filter((id) => !order.includes(id))]
  const visible = full.filter((id) => !hidden.includes(id))
  const countColumns = (ids: string[]) => ids.reduce((count, id) =>
    count + 1 + (split.includes(id) ? byId.get(id)!.split?.parts.length ?? 0 : 0), 0)
  const shown = full.filter((id) => nameOf(byId.get(id)!).toLowerCase().includes(q.trim().toLowerCase()))

  const toggle = (id: string) => onChange({ order: full, hidden: hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id] })
  const moveTo = (id: string, index: number) => {
    if (index < 0 || index >= full.length || full[index] === id) return
    const next = full.filter((item) => item !== id)
    next.splice(index, 0, id)
    onChange({ order: next, hidden })
  }
  const endDrag = () => {
    dragging.current = null
    setDropTarget(null)
  }
  const dropEdge = (e: DragEvent<HTMLLIElement>) => {
    const row = e.currentTarget.getBoundingClientRect()
    return e.clientY < row.top + row.height / 2 ? 'before' : 'after'
  }


  return (
    <ColsMenu open={open} anchor={anchor} onClose={onClose} label="Состав колонок" className={className}>
      <Input size="s" aria-label="Поиск колонки" placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} />
      <span role="status">Видимых колонок: {countColumns(visible)} из {countColumns(full)}</span>
      <ColsList>
        {shown.map((id) => {
          const c = byId.get(id)!
          const name = nameOf(c)
          const isHidden = hidden.includes(id)
          const i = full.indexOf(id)
          return (
            <Fragment key={id}>
              <ColsItem
                data-drop={dropTarget?.id === id ? dropTarget.edge : undefined}
                onDragOver={(e) => {
                  if (!dragging.current || dragging.current === id) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  const edge = dropEdge(e)
                  setDropTarget((previous) => previous?.id === id && previous.edge === edge ? previous : { id, edge })
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null)
                }}
                onDrop={(e) => {
                  const source = dragging.current
                  if (!source || source === id) return
                  e.preventDefault()
                  const index = i + (dropEdge(e) === 'after' ? 1 : 0) - (full.indexOf(source) < i ? 1 : 0)
                  moveTo(source, index)
                  endDrag()
                }}
              >
                <ColsGrip draggable aria-hidden="true" title={`Перетащить «${name}»`}
                  onDragStart={(e) => {
                    dragging.current = id
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', id)
                  }}
                  onDragEnd={endDrag}>⠿</ColsGrip>
                <Checkbox aria-label={name} checked={!isHidden} disabled={!isHidden && visible.length === 1} onChange={() => toggle(id)} />
                <ColsName>{name}</ColsName>
                <IconButton size="s" label={`${name} — выше`} disabled={i === 0} onClick={() => moveTo(id, i - 1)}><Up /></IconButton>
                <IconButton size="s" label={`${name} — ниже`} disabled={i === full.length - 1} onClick={() => moveTo(id, i + 1)}><Down /></IconButton>
              </ColsItem>
              {c.split && onSplit && (
                <ColsSplit>
                  <Checkbox label={c.split.label} checked={split.includes(id)} onChange={(e) => onSplit({ id, on: e.target.checked })} />
                </ColsSplit>
              )}
            </Fragment>
          )
        })}
      </ColsList>
    </ColsMenu>
  )
}
