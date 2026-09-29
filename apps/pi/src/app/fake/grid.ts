import type { Sort } from '@katran/effector'
import { sortRows, type ColumnDef } from '@katran/ui'
import type { FacetsBody, FilterMetaDto, SearchBody, SortDto } from '../../shared/api'
import { applyFilter } from './filter'

/** Один грид фейкового сервера: данные, колонки (ключи сортировки) и каталог. Наружу — только JSON контракта. */
export type FakeGrid = { meta: FilterMetaDto; search: (b: SearchBody) => unknown; facets: (b: FacetsBody) => unknown }

/** Опции фейкового грида. sortLabels — как у createFakeBackend демо (сверка S3): перечисленные ключи сортируются по подписи, а не по коду. */
export type FakeGridOptions = { sortLabels?: Record<string, Record<string, string>> | undefined }

const fromSortDto = (dto: SortDto[]): Sort => dto.map((s) => ({ key: s.field, dir: s.direction === 'ASC' ? 'asc' : 'desc' }))

export function fakeGrid<Row extends Record<string, unknown>>(rows: Row[], columns: ColumnDef<Row>[], meta: FilterMetaDto, opts: FakeGridOptions = {}): FakeGrid {
  const get = (row: Row, key: string) => {
    const v = row[key]
    const labels = opts.sortLabels?.[key]
    return labels && typeof v === 'string' ? (labels[v] ?? v) : v
  }
  return {
    meta,
    search: (b) => {
      const sorted = sortRows(applyFilter(rows, b.filter.conditions), fromSortDto(b.sort), columns, get)
      const { number, size } = b.page
      const total = sorted.length
      return { content: sorted.slice(number * size, (number + 1) * size), page: { number, size, totalElements: total, totalPages: Math.ceil(total / size), hasNext: (number + 1) * size < total } }
    },
    facets: (b) => {
      const counts = new Map<string, number>()
      for (const r of applyFilter(rows, b.filter.conditions)) { const k = String(r[b.field]); counts.set(k, (counts.get(k) ?? 0) + 1) }
      return [...counts].map(([value, count]) => ({ value, count }))
    },
  }
}
