import type { Sort } from '@katran/effector'
import { sortRows, type ColumnDef } from '@katran/ui'
import type { FacetsBody, FilterMetaDto, SearchBody, SortDto, SuggestBody } from '../../shared/api'
import { applyFilter } from './filter'

/** Один грид фейкового сервера: данные, колонки (ключи сортировки) и каталог. Наружу — только JSON контракта. */
export type FakeGrid = {
  meta: FilterMetaDto
  search: (b: SearchBody) => unknown
  facets: (b: FacetsBody) => unknown
  /** Различные значения поля по выборке, содержащие запрос (без учёта регистра), по убыванию частоты. */
  suggest: (b: SuggestBody) => unknown
  /** Документ по id; null — такого нет (404). Нет поля — у грида нет детали. */
  detail?: ((id: string) => unknown) | undefined
}

/** Опции фейкового грида. sortLabels — как у createFakeBackend демо (сверка S3): перечисленные ключи сортируются по подписи, а не по коду. */
export type FakeGridOptions<Row> = {
  sortLabels?: Record<string, Record<string, string>> | undefined
  /** Деталь из строки реестра (спека 2a §4.4): index — номер строки в наборе, для детерминированных полей. */
  detail?: ((row: Row, index: number) => unknown) | undefined
}

const fromSortDto = (dto: SortDto[]): Sort => dto.map((s) => ({ key: s.field, dir: s.direction === 'ASC' ? 'asc' : 'desc' }))

export function fakeGrid<Row extends Record<string, unknown>>(rows: Row[], columns: ColumnDef<Row>[], meta: FilterMetaDto, opts: FakeGridOptions<Row> = {}): FakeGrid {
  const get = (row: Row, key: string) => {
    const v = row[key]
    const labels = opts.sortLabels?.[key]
    return labels && typeof v === 'string' ? (labels[v] ?? v) : v
  }
  const grid: FakeGrid = {
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
    suggest: (b) => {
      const q = b.query.trim().toLowerCase()
      const counts = new Map<string, number>()
      for (const r of applyFilter(rows, b.filter.conditions)) {
        const v = r[b.field]
        if (v === null || v === undefined || v === '') continue
        const t = String(v)
        if (!t.toLowerCase().includes(q)) continue
        counts.set(t, (counts.get(t) ?? 0) + 1)
      }
      // при равной частоте — по алфавиту: ответ детерминирован
      const items = [...counts].sort((a, c) => c[1] - a[1] || a[0].localeCompare(c[0], 'ru')).slice(0, b.limit).map(([t]) => t)
      return { items }
    },
  }
  const toDetail = opts.detail
  if (toDetail) {
    grid.detail = (id) => {
      const i = rows.findIndex((r) => r.id === id)
      return i < 0 ? null : toDetail(rows[i]!, i)
    }
  }
  return grid
}
