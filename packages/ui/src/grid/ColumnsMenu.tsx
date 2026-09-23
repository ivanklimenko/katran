import { useState, type RefObject } from 'react'
import { IconButton } from '../button'
import { Checkbox, Input } from '../input'
import { Popover } from '../overlay'
import s from './Grid.module.css'
import type { ColumnDef, ColumnsState } from './types'

export type ColumnsMenuProps<Row> = {
  open: boolean
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  columns: ColumnDef<Row>[]
  order: string[]
  hidden: string[]
  onChange: (state: ColumnsState) => void
}

const Up = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 10l4-4 4 4" /></svg>
const Down = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6l4 4 4-4" /></svg>

const nameOf = <Row,>(c: ColumnDef<Row>) => c.menuTitle ?? c.title ?? c.id

/** Состав и порядок колонок: галочки + перенос кнопками — работает с клавиатуры из коробки (спека 6.3). */
export function ColumnsMenu<Row>({ open, anchor, onClose, columns, order, hidden, onChange }: ColumnsMenuProps<Row>) {
  const [q, setQ] = useState('')
  const byId = new Map(columns.map((c) => [c.id, c]))
  const full = [...order.filter((id) => byId.has(id)), ...columns.map((c) => c.id).filter((id) => !order.includes(id))]
  const visibleCount = full.filter((id) => !hidden.includes(id)).length
  const shown = full.filter((id) => nameOf(byId.get(id)!).toLowerCase().includes(q.trim().toLowerCase()))

  const toggle = (id: string) => onChange({ order: full, hidden: hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id] })
  const move = (id: string, dir: -1 | 1) => {
    const i = full.indexOf(id), j = i + dir
    if (j < 0 || j >= full.length) return
    const next = full.slice(); next.splice(i, 1); next.splice(j, 0, id)
    onChange({ order: next, hidden })
  }

  return (
    <Popover open={open} anchor={anchor} onClose={onClose} label="Состав колонок" className={s.colsMenu}>
      <Input size="s" aria-label="Поиск колонки" placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className={s.colsList}>
        {shown.map((id) => {
          const c = byId.get(id)!
          const name = nameOf(c)
          const isHidden = hidden.includes(id)
          const i = full.indexOf(id)
          return (
            <li key={id} className={s.colsItem}>
              <Checkbox aria-label={name} checked={!isHidden} disabled={!isHidden && visibleCount === 1} onChange={() => toggle(id)} />
              <span className={s.colsName}>{name}</span>
              <IconButton size="s" label={`${name} — выше`} disabled={i === 0} onClick={() => move(id, -1)}><Up /></IconButton>
              <IconButton size="s" label={`${name} — ниже`} disabled={i === full.length - 1} onClick={() => move(id, 1)}><Down /></IconButton>
            </li>
          )
        })}
      </ul>
    </Popover>
  )
}
