import { findSortKey, flipSortLevel, removeSortLevel } from './sortRows'
import { SortBar, SortChip, SortChipBtn, SortChipWrap, SortChipX, SortLbl, SortOrd, SortSep } from './parts'
import type { ColumnDef, Sort } from './types'

export type SortChipsProps<Row> = { sort: Sort; columns: ColumnDef<Row>[]; onSort: (s: Sort) => void; className?: string | undefined }

/** Уровни сортировки над гридом (эталон, 4c9bf49): клик — сменить направление, ✕ — убрать уровень. */
export function SortChips<Row>({ sort, columns, onSort, className }: SortChipsProps<Row>) {
  if (sort.length === 0) return null
  return (
    <SortBar className={className} role="group" aria-label="Сортировка">
      <SortLbl>Сортировка:</SortLbl>
      {sort.map((l, i) => {
        const label = findSortKey(columns, l.key)?.label ?? l.key
        const dirText = l.dir === 'asc' ? 'по возрастанию' : 'по убыванию'
        return (
          <SortChipWrap key={l.key}>
            {i > 0 && <SortSep aria-hidden="true">›</SortSep>}
            <SortChip>
              <SortOrd aria-hidden="true">{i + 1}</SortOrd>
              <SortChipBtn type="button" aria-label={`Уровень ${i + 1}: ${label}, ${dirText} — сменить направление`} onClick={() => onSort(flipSortLevel(sort, l.key))}>
                {label} {l.dir === 'asc' ? '↑' : '↓'}
              </SortChipBtn>
              <SortChipX type="button" aria-label={`Убрать уровень ${label}`} onClick={() => onSort(removeSortLevel(sort, l.key))}>✕</SortChipX>
            </SortChip>
          </SortChipWrap>
        )
      })}
      {sort.length > 1 && <SortLbl>Shift+клик по заголовку — ещё уровень</SortLbl>}
    </SortBar>
  )
}
