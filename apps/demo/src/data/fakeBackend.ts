import { createEffect } from 'effector'
import type { Condition, Facet, FacetsQuery, Filter, GridPage, GridQuery } from '@katran/effector'
import { sortRows, type RecordLayout } from '@katran/ui'

const str = (v: unknown) => (v == null ? '' : String(v)).toLowerCase()
const isDay = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
/** Дата в условии — день YYYY-MM-DD: сравниваем с первыми 10 знаками ISO-значения записи. */
const dayOf = (v: unknown) => str(v).slice(0, 10)
const num = (v: unknown) => Number(String(v).replace(/\s/g, '').replace(',', '.'))
const cmp = (v: unknown, c: unknown) => (typeof c === 'number' ? num(v) - c : str(v) < str(c) ? -1 : str(v) > str(c) ? 1 : 0)

/** Подмножество семантики контракта, достаточное для демо: строки регистронезависимо, числа как числа, даты по дню/ISO-строкой. */
function matches(row: Record<string, unknown>, c: Condition): boolean {
  const v = row[c.field]
  switch (c.op) {
    case 'EQ': return isDay(c.value) ? dayOf(v) === c.value : typeof c.value === 'number' ? num(v) === c.value : str(v) === str(c.value)
    case 'NE': return !matches(row, { ...c, op: 'EQ' })
    case 'CONTAINS': return str(v).includes(str(c.value))
    case 'STARTS_WITH': return str(v).startsWith(str(c.value))
    case 'ENDS_WITH': return str(v).endsWith(str(c.value))
    case 'IN': return c.values.map(str).includes(str(v))
    case 'NOT_IN': return !c.values.map(str).includes(str(v))
    case 'IS_EMPTY': return v == null || v === ''
    case 'IS_NOT_EMPTY': return !(v == null || v === '')
    case 'GT': return cmp(v, c.value) > 0
    case 'GTE': return cmp(v, c.value) >= 0
    case 'LT': return cmp(v, c.value) < 0
    case 'LTE': return cmp(v, c.value) <= 0
    case 'BETWEEN': return cmp(v, c.from) >= 0 && cmp(v, c.to) <= 0
  }
}
const applyFilter = <Row extends Record<string, unknown>>(rows: Row[], f: Filter) => rows.filter((r) => f.every((c) => matches(r, c)))

export type FakeBackendOptions = { delay?: number | undefined }
const wait = (delay: number | undefined) => {
  const slow = new URLSearchParams(location.search).get('slow')
  return new Promise((r) => setTimeout(r, delay ?? (slow ? Number(slow) : 250 + Math.random() * 400)))
}

/** Бэкенд в памяти: search — та же форма, что у POST /grids/{id}/search; facets — предложение POST /grids/{id}/facets. Задержка 0,25–0,65 с (?slow=N — ровно N мс). */
export function createFakeBackend<Row extends Record<string, unknown>>(all: Row[], layout: RecordLayout<Row>, opts: FakeBackendOptions = {}) {
  const get = (row: Row, key: string) => row[key]
  const searchFx = createEffect<GridQuery, GridPage<Row>>(async (q) => {
    await wait(opts.delay)
    const sorted = sortRows(applyFilter(all, q.filter), q.sort, layout.columns, get)
    return { rows: sorted.slice(q.page * q.size, (q.page + 1) * q.size), total: sorted.length }
  })
  const facetsFx = createEffect<FacetsQuery, Facet[]>(async ({ filter, field }) => {
    await wait(opts.delay)
    const counts = new Map<string, number>()
    for (const r of applyFilter(all, filter)) { const k = String(r[field]); counts.set(k, (counts.get(k) ?? 0) + 1) }
    return [...counts].map(([value, count]) => ({ value, count }))
  })
  return { searchFx, facetsFx }
}
