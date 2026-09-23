import { useRef, useState, type CSSProperties, type HTMLAttributes, type KeyboardEvent, type PointerEvent } from 'react'
import { Menu, type MenuItem } from '../overlay'
import { defaultDir, findSortKey } from './sortRows'
import s from './Grid.module.css'
import type { ColumnDef, Sort } from './types'

export type ColumnHeaderProps<Row> = {
  column: ColumnDef<Row>
  sort: Sort
  onSort: (sort: Sort) => void
  /** Ширина в px при плотности 1. */
  width: number
  onResize?: ((width: number) => void) | undefined
  cellProps?: HTMLAttributes<HTMLTableCellElement> | undefined
}

const MIN_DEFAULT = 36
const STEP = 8
const STEP_SHIFT = 32

export function ColumnHeader<Row>({ column, sort, onSort, width, onResize, cellProps }: ColumnHeaderProps<Row>) {
  const keys = column.sort ?? []
  const active = sort && keys.find((k) => k.id === sort.key)
  const [menuOpen, setMenuOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const drag = useRef<{ x: number; w: number } | null>(null)
  const min = column.minWidth ?? MIN_DEFAULT
  const title = column.title ?? ''
  const name = column.menuTitle ?? title

  const pick = (keyId: string) => {
    const key = findSortKey([column], keyId)
    if (!key) return
    onSort(sort && sort.key === keyId ? { key: keyId, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key: keyId, dir: defaultDir(key) })
  }
  const onHeadClick = () => {
    if (keys.length === 1) pick(keys[0]!.id)
    else if (keys.length > 1) setMenuOpen(true)
  }

  const items: MenuItem[] = [
    ...keys.map((k) => ({ id: k.id, label: k.label, checked: active?.id === k.id, hint: active?.id === k.id ? (sort!.dir === 'asc' ? '↑' : '↓') : undefined, onSelect: () => pick(k.id) })),
    ...(active ? [{ id: '__reset', label: 'Сбросить сортировку', onSelect: () => onSort(null) }] : []),
  ]

  const clamp = (w: number) => Math.max(min, Math.round(w))
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    drag.current = { x: e.clientX, w: width }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    e.currentTarget.dataset.active = 'true'
  }
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current || !onResize) return
    onResize(clamp(drag.current.w + e.clientX - drag.current.x))
  }
  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    drag.current = null
    delete e.currentTarget.dataset.active
  }
  const onHandleKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!onResize) return
    const step = e.shiftKey ? STEP_SHIFT : STEP
    if (e.key === 'ArrowRight') { e.preventDefault(); onResize(clamp(width + step)) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); onResize(clamp(width - step)) }
  }

  const arrow = active ? (sort!.dir === 'asc' ? '↑' : '↓') : '↕'
  const ariaSort = active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : keys.length ? 'none' : undefined
  const sub = active && keys.length > 1 ? active.label : column.subtitle

  return (
    <th
      role="columnheader"
      scope="col"
      aria-sort={ariaSort}
      className={[s.th, active ? s.sorted : ''].filter(Boolean).join(' ')}
      style={{ width: `calc(${width}px * var(--k-density))` } as CSSProperties}
      {...cellProps}
    >
      {keys.length > 0 ? (
        <button ref={btn} type="button" tabIndex={-1} className={s.thBtn} onClick={onHeadClick} aria-haspopup={keys.length > 1 ? 'menu' : undefined} aria-expanded={keys.length > 1 ? menuOpen : undefined}>
          {title}<span className={s.arrow} aria-hidden="true">{arrow}</span>
          <span className={s.thSub}>{sub}</span>
        </button>
      ) : (
        <>
          {title}
          <span className={s.thSub}>{column.subtitle}</span>
        </>
      )}
      {keys.length > 1 && <Menu open={menuOpen} anchor={btn} onClose={() => setMenuOpen(false)} items={items} title={`Сортировать «${name}» по`} />}
      {(column.resizable ?? true) && onResize && (
        <button
          type="button"
          tabIndex={-1}
          // eslint-disable-next-line jsx-a11y/no-interactive-element-to-noninteractive-role -- перетаскиваемый разделитель шире по семантике, чем button: role="separator" + aria-valuenow — паттерн WAI-ARIA для focusable separator (ручка ресайза колонки)
          role="separator"
          aria-orientation="vertical"
          aria-label={`Ширина колонки ${name}`}
          aria-valuenow={width}
          aria-valuemin={min}
          aria-valuemax={9999}
          className={s.rz}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onHandleKey}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </th>
  )
}
