import { useRef, useState, type CSSProperties, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { Menu, type MenuItem } from '../overlay'
import { addSortLevel, findSortKey, flipSortLevel, removeSortLevel, soleSort } from './sortRows'
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
  const level = sort.find((l) => keys.some((k) => k.id === l.key))
  const active = level ? keys.find((k) => k.id === level.key) : undefined
  const [menuOpen, setMenuOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const drag = useRef<{ x: number; w: number } | null>(null)
  const min = column.minWidth ?? MIN_DEFAULT
  const title = column.title ?? ''
  const name = column.menuTitle ?? title

  const pick = (keyId: string, shiftKey?: boolean) => {
    const key = findSortKey([column], keyId)
    if (key) onSort(shiftKey ? addSortLevel(sort, key) : soleSort(sort, key))
  }
  const onHeadClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (keys.length === 1) pick(keys[0]!.id, e.shiftKey)
    else if (keys.length > 1) setMenuOpen(true)
  }

  const items: MenuItem[] = keys.length > 1
    ? [
        ...keys.flatMap((k): MenuItem[] => {
          const isActive = active?.id === k.id
          const n = isActive && level ? sort.indexOf(level) + 1 : 0
          const sole: MenuItem = {
            id: k.id,
            label: k.label,
            checked: isActive,
            hint: isActive ? `${level!.dir === 'asc' ? '↑' : '↓'}${sort.length > 1 && n > 0 ? n : ''}` : undefined,
            onSelect: (e) => pick(k.id, e?.shiftKey),
          }
          const inSort = sort.some((l) => l.key === k.id)
          const extra: MenuItem = inSort
            ? { id: `${k.id}__dir`, label: `${k.label} — сменить направление уровня`, onSelect: () => onSort(flipSortLevel(sort, k.id)) }
            : { id: `${k.id}__add`, label: `${k.label} — добавить уровнем`, onSelect: () => onSort(addSortLevel(sort, k)) }
          return [sole, extra]
        }),
        ...(active
          ? [
              {
                id: '__reset',
                label: 'Сбросить сортировку',
                onSelect: () => {
                  const colIds = keys.map((k) => k.id)
                  const onlyThis = sort.every((l) => colIds.includes(l.key))
                  onSort(onlyThis ? [] : colIds.reduce((acc, id) => removeSortLevel(acc, id), sort))
                },
              } satisfies MenuItem,
            ]
          : []),
        { id: '__hint', label: 'клик — единственный ключ · «+» или Shift+клик — добавить уровнем', note: true },
      ]
    : []

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

  const arrow = active ? (level!.dir === 'asc' ? '↑' : '↓') : '↕'
  const n = level ? sort.indexOf(level) + 1 : 0
  const ariaSort = level && level === sort[0] ? (level.dir === 'asc' ? 'ascending' : 'descending') : keys.length ? 'none' : undefined
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
        <button ref={btn} type="button" tabIndex={-1} className={s.thBtn} onClick={onHeadClick} aria-haspopup={keys.length > 1 ? 'menu' : undefined} aria-expanded={keys.length > 1 ? menuOpen : undefined} aria-label={title ? undefined : name}>
          {title}<span className={s.arrow} aria-hidden="true">{arrow}{sort.length > 1 && n > 0 && <sup>{n}</sup>}</span>
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
          role="slider"
          // значение меняется стрелками влево/вправо — ориентация горизонтальная, хоть ручка и вертикальная черта
          aria-orientation="horizontal"
          aria-label={`Ширина колонки ${name}`}
          aria-valuenow={width}
          aria-valuetext={`${width} px`}
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
