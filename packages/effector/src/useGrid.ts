import { useUnit } from 'effector-react'
import type { ColumnsState, DataGridProps, GridViewState, Selection, Sort } from '@katran/ui'
import type { GridModel } from './createGridModel'

export type GridBinding<Row> = {
  rows: Row[]
  total: number
  page: number
  pageSize: number
  sort: Sort
  widths: Record<string, number>
  order: string[]
  hidden: string[]
  selection: Selection
  state: GridViewState
  error: string | null
  onPage: (n: number) => void
  onPageSize: (n: number) => void
  onSort: (s: Sort) => void
  onResize: (p: { id: string; width: number }) => void
  onColumns: (s: ColumnsState) => void
  onSelect: (p: { id: string; on: boolean }) => void
  onSelectPage: (p: { ids: string[]; on: boolean }) => void
  onRetry: () => void
}

/** Единственное место, где модель встречается с компонентом: <DataGrid {...useGrid(model)} label=… layout=… />. */
export function useGrid<Row>(m: GridModel<Row>): GridBinding<Row> {
  const [rows, total, page, pageSize, sort, widths, order, hidden, selection, state, error] = useUnit([
    m.$rows, m.$total, m.$page, m.$pageSize, m.$sort, m.$widths, m.$order, m.$hidden, m.$selection, m.$state, m.$error,
  ])
  const [onPage, onPageSize, onSort, onResize, onColumns, onSelect, onSelectPage, onRetry] = useUnit([
    m.setPage, m.setPageSize, m.sortBy, m.resize, m.setColumns, m.select, m.selectPage, m.retry,
  ])
  return { rows, total, page, pageSize, sort, widths, order, hidden, selection, state, error, onPage, onPageSize, onSort, onResize, onColumns, onSelect, onSelectPage, onRetry }
}

// Проверка типов на этапе компиляции: GridBinding<Row> должен подходить как пропы DataGrid (Task 10).
type _Check = GridBinding<unknown> extends Pick<DataGridProps<unknown>, keyof GridBinding<unknown> & keyof DataGridProps<unknown>> ? true : never
const _ok: _Check = true
void _ok
