/** Модель фильтра — спека 7.1, контракт vtb-filters/docs/filter-contract.md. */
export type Scalar = string | number | boolean

export type Condition =
  | { field: string; op: 'EQ' | 'NE' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'GT' | 'GTE' | 'LT' | 'LTE'; value: Scalar }
  | { field: string; op: 'IN' | 'NOT_IN'; values: Scalar[] }
  | { field: string; op: 'BETWEEN'; from: Scalar; to: Scalar }
  | { field: string; op: 'IS_EMPTY' | 'IS_NOT_EMPTY' }

/** v1 — только AND. */
export type Filter = Condition[]

export type FilterFieldType = 'STRING' | 'NUMBER' | 'DATE' | 'DATETIME' | 'ENUM' | 'BOOLEAN'
export type FilterField = {
  id: string
  label: string
  type: FilterFieldType
  ops: Condition['op'][]
  /** Встроенный справочник для ENUM. */
  values?: { value: Scalar; label: string }[] | undefined
  group?: string | undefined
}
/** Ответ GET /grids/{gridId}/filter-meta. */
export type FilterMeta = { fields: FilterField[] }

/** Типы состояния вида объявлены в @katran/ui (grid/types.ts) — здесь только реэкспорт, чтобы у контракта был один источник. */
export type { Sort, Selection, ColumnsState, GridViewState } from '@katran/ui'
import type { Sort } from '@katran/ui'

/** То, что уходит в POST /grids/{gridId}/search. page — с нуля, как у бека. */
export type GridQuery = { filter: Filter; sort: Sort; page: number; size: number }
export type GridPage<Row> = { rows: Row[]; total: number }

export type PersistAdapter<T> = {
  load: (key: string) => T | undefined
  save: (key: string, value: T) => void
}
