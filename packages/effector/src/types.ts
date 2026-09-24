/** Типы состояния вида объявлены в @katran/ui (grid/types.ts) — здесь только реэкспорт, чтобы у контракта был один источник. */
export type { Sort, Selection, ColumnsState, GridViewState } from '@katran/ui'
export type { Scalar, Condition, Filter, FilterFieldType, FilterField, FilterMeta } from '@katran/ui'
import type { Sort, Filter, Scalar } from '@katran/ui'

/** Счётчик значений поля по фильтру — для лейна статусов (спека 1e, §4). */
export type Facet = { value: Scalar; count: number }
/** Тело POST /grids/{gridId}/facets: фильтр без условий по field. */
export type FacetsQuery = { filter: Filter; field: string }

/** То, что уходит в POST /grids/{gridId}/search. page — с нуля, как у бека. */
export type GridQuery = { filter: Filter; sort: Sort; page: number; size: number }
export type GridPage<Row> = { rows: Row[]; total: number }

export type PersistAdapter<T> = {
  load: (key: string) => T | undefined
  save: (key: string, value: T) => void
}
