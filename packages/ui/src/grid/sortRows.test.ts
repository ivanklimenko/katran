import { defaultDir, findSortKey, sortRows } from './sortRows'
import type { ColumnDef } from './types'

type R = { id: string; amount: number | null; created: string; dir: string; name: string }
const rows: R[] = [
  { id: '1', amount: 300, created: '2026-09-22T10:00:00', dir: 'OUT', name: 'Б' },
  { id: '2', amount: null, created: '2026-09-23T10:00:00', dir: 'IN', name: 'А' },
  { id: '3', amount: 100, created: '2026-09-21T10:00:00', dir: 'TRANSIT', name: 'В' },
  { id: '4', amount: 300, created: '2026-09-20T10:00:00', dir: 'IN', name: 'Г' },
]
const columns: ColumnDef<R>[] = [
  { id: 'amt', sort: [{ id: 'amount', label: 'Сумма', type: 'number' }], render: () => null },
  { id: 'dt', sort: [{ id: 'created', label: 'Дата', type: 'date' }], render: () => null },
  { id: 'dir', sort: [{ id: 'dir', label: 'Направление', order: ['IN', 'OUT', 'TRANSIT', 'OTHER'], then: 'name' }, { id: 'name', label: 'Название' }], render: () => null },
]
const get = (r: R, k: string) => (r as unknown as Record<string, unknown>)[k]

describe('sortRows', () => {
  it('направление по умолчанию: число и дата — по убыванию, текст — по возрастанию', () => {
    expect(defaultDir({ id: 'a', label: 'a', type: 'number' })).toBe('desc')
    expect(defaultDir({ id: 'a', label: 'a', type: 'date' })).toBe('desc')
    expect(defaultDir({ id: 'a', label: 'a' })).toBe('asc')
  })
  it('findSortKey находит ключ в составной колонке', () => {
    expect(findSortKey(columns, 'name')?.label).toBe('Название')
    expect(findSortKey(columns, 'nope')).toBeUndefined()
  })
  it('число по убыванию, null — в конец; ничьи стабильны', () => {
    expect(sortRows(rows, { key: 'amount', dir: 'desc' }, columns, get).map((r) => r.id)).toEqual(['1', '4', '3', '2'])
  })
  it('число по возрастанию, null всё равно в конец', () => {
    expect(sortRows(rows, { key: 'amount', dir: 'asc' }, columns, get).map((r) => r.id)).toEqual(['3', '1', '4', '2'])
  })
  it('дата', () => {
    expect(sortRows(rows, { key: 'created', dir: 'desc' }, columns, get).map((r) => r.id)).toEqual(['2', '1', '3', '4'])
  })
  it('фиксированный порядок групп + второй ключ в том же направлении', () => {
    expect(sortRows(rows, { key: 'dir', dir: 'asc' }, columns, get).map((r) => r.id)).toEqual(['2', '4', '1', '3'])
    expect(sortRows(rows, { key: 'dir', dir: 'desc' }, columns, get).map((r) => r.id)).toEqual(['3', '1', '4', '2'])
  })
  it('sort === null → исходный порядок, новый массив', () => {
    const out = sortRows(rows, null, columns, get)
    expect(out).toEqual(rows)
    expect(out).not.toBe(rows)
  })
})
