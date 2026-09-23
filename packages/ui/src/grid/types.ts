import type { ReactNode } from 'react'

export type SortKey = {
  id: string
  /** Подписывается в шапке, когда ключ выбран. */
  label: string
  type?: 'text' | 'number' | 'date' | undefined
  /** Второй ключ, в том же направлении. */
  then?: string | undefined
  /** Фиксированный порядок значений: ['IN','OUT','TRANSIT','OTHER']. */
  order?: string[] | undefined
}

export type ColumnDef<Row> = {
  id: string
  /** Пустой допустим — у колонки статуса заголовка нет. */
  title?: string | undefined
  /** Имя в меню сортировки и состава, если title пуст. */
  menuTitle?: string | undefined
  subtitle?: string | undefined
  /** Начальная ширина в px при плотности 1. */
  width?: number | undefined
  /** По умолчанию 36. */
  minWidth?: number | undefined
  /** По умолчанию true. */
  resizable?: boolean | undefined
  /** Строк контента; по умолчанию 1. Задаёт скелетон и кламп. */
  lines?: 1 | 2 | 3 | undefined
  align?: 'left' | 'right' | undefined
  /** Пусто → колонка не сортируется. */
  sort?: SortKey[] | undefined
  /** Интерактивные элементы внутри ячейки — с `tabIndex={-1}`; до них доходят через Enter на ячейке. */
  render: (row: Row) => ReactNode
}

export type SpanDef<Row> = {
  id: string
  /** id колонки начала. */
  from: string
  /** id колонки конца, включительно. */
  to: string
  lines?: 1 | 2 | undefined
  /** null → бледная подложка, не закрашивается. */
  render: (row: Row) => ReactNode | null
}

export type RecordLayout<Row> = {
  columns: ColumnDef<Row>[]
  /** Дополнительные строки записи; в каждой — сегменты слева направо. */
  spans?: SpanDef<Row>[][] | undefined
  rowKey: (row: Row) => string
}

export type Sort = { key: string; dir: 'asc' | 'desc' } | null
export type Selection = { mode: 'ids'; ids: string[] } | { mode: 'all'; except: string[] }
export type ColumnsState = { order: string[]; hidden: string[] }
export type GridViewState = 'ready' | 'loading' | 'refreshing' | 'error'

export type ResolvedSpan = { id: string; colStart: number; colSpan: number }
