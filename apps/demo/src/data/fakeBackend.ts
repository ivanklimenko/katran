import { createEffect } from 'effector'
import type { Condition, Filter, GridPage, GridQuery } from '@katran/effector'
import { sortRows, type RecordLayout } from '@katran/ui'

const str = (v: unknown) => (v == null ? '' : String(v)).toLowerCase()

/** Подмножество операторов контракта, достаточное для демо (лейн статусов и простые фильтры плана 3). */
function matches(row: Record<string, unknown>, c: Condition): boolean {
  const v = row[c.field]
  switch (c.op) {
    case 'EQ': return str(v) === str(c.value)
    case 'NE': return str(v) !== str(c.value)
    case 'CONTAINS': return str(v).includes(str(c.value))
    case 'STARTS_WITH': return str(v).startsWith(str(c.value))
    case 'ENDS_WITH': return str(v).endsWith(str(c.value))
    case 'IN': return c.values.map(str).includes(str(v))
    case 'NOT_IN': return !c.values.map(str).includes(str(v))
    case 'IS_EMPTY': return v == null || v === ''
    case 'IS_NOT_EMPTY': return !(v == null || v === '')
    case 'GT': return Number(v) > Number(c.value)
    case 'GTE': return Number(v) >= Number(c.value)
    case 'LT': return Number(v) < Number(c.value)
    case 'LTE': return Number(v) <= Number(c.value)
    case 'BETWEEN': return Number(v) >= Number(c.from) && Number(v) <= Number(c.to)
  }
}
const applyFilter = <Row extends Record<string, unknown>>(rows: Row[], f: Filter) => rows.filter((r) => f.every((c) => matches(r, c)))

export type FakeBackendOptions = { delay?: number | undefined }

/** Бэкенд в памяти: та же форма запроса, что у POST /grids/{id}/search; задержка — как у прода (0.3–1 с). */
export function createFakeBackend<Row extends Record<string, unknown>>(all: Row[], layout: RecordLayout<Row>, opts: FakeBackendOptions = {}) {
  const get = (row: Row, key: string) => row[key]
  return createEffect<GridQuery, GridPage<Row>>(async (q) => {
    const slow = new URLSearchParams(location.search).get('slow')
    await new Promise((r) => setTimeout(r, opts.delay ?? (slow ? Number(slow) : 250 + Math.random() * 400)))
    const filtered = applyFilter(all, q.filter)
    const sorted = sortRows(filtered, q.sort, layout.columns, get)
    return { rows: sorted.slice(q.page * q.size, (q.page + 1) * q.size), total: sorted.length }
  })
}
