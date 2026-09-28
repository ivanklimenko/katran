import { findSortKey, flipSortLevel, removeSortLevel } from './sortRows'
import s from './Grid.module.css'
import type { ColumnDef, Sort } from './types'

export type SortChipsProps<Row> = { sort: Sort; columns: ColumnDef<Row>[]; onSort: (s: Sort) => void }

/** Уровни сортировки над гридом (эталон, 4c9bf49): клик — сменить направление, ✕ — убрать уровень. */
export function SortChips<Row>({ sort, columns, onSort }: SortChipsProps<Row>) {
  if (sort.length === 0) return null
  return (
    <div className={s.sortChips} role="group" aria-label="Сортировка">
      <span className={s.sortLbl}>Сортировка:</span>
      {sort.map((l, i) => {
        const label = findSortKey(columns, l.key)?.label ?? l.key
        const dirText = l.dir === 'asc' ? 'по возрастанию' : 'по убыванию'
        return (
          <span key={l.key} className={s.sortChipWrap}>
            {i > 0 && <span className={s.sortSep} aria-hidden="true">›</span>}
            <span className={s.sortChip}>
              <span className={s.sortOrd} aria-hidden="true">{i + 1}</span>
              <button type="button" className={s.sortChipBtn} aria-label={`${label}, ${dirText} — сменить направление`} onClick={() => onSort(flipSortLevel(sort, l.key))}>
                {label} {l.dir === 'asc' ? '↑' : '↓'}
              </button>
              <button type="button" className={s.sortChipX} aria-label={`Убрать уровень ${label}`} onClick={() => onSort(removeSortLevel(sort, l.key))}>✕</button>
            </span>
          </span>
        )
      })}
      {sort.length > 1 && <span className={s.sortLbl}>Shift+клик по заголовку — ещё уровень</span>}
    </div>
  )
}
