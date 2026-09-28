import { addSortLevel, defaultDir, findSortKey, flipSortLevel, MAX_SORT_LEVELS, removeSortLevel, soleSort, sortRows } from './sortRows'
import type { ColumnDef, SortKey } from './types'

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
    expect(sortRows(rows, [{ key: 'amount', dir: 'desc' }], columns, get).map((r) => r.id)).toEqual(['1', '4', '3', '2'])
  })
  it('число по возрастанию, null всё равно в конец', () => {
    expect(sortRows(rows, [{ key: 'amount', dir: 'asc' }], columns, get).map((r) => r.id)).toEqual(['3', '1', '4', '2'])
  })
  it('дата', () => {
    expect(sortRows(rows, [{ key: 'created', dir: 'desc' }], columns, get).map((r) => r.id)).toEqual(['2', '1', '3', '4'])
  })
  it('фиксированный порядок групп + второй ключ в том же направлении', () => {
    expect(sortRows(rows, [{ key: 'dir', dir: 'asc' }], columns, get).map((r) => r.id)).toEqual(['2', '4', '1', '3'])
    expect(sortRows(rows, [{ key: 'dir', dir: 'desc' }], columns, get).map((r) => r.id)).toEqual(['3', '1', '4', '2'])
  })
  it('sort === [] → исходный порядок, новый массив', () => {
    const out = sortRows(rows, [], columns, get)
    expect(out).toEqual(rows)
    expect(out).not.toBe(rows)
  })
})

const kType: SortKey = { id: 'type', label: 'Тип' }
const kAmount: SortKey = { id: 'amount', label: 'Сумма', type: 'number' }

describe('уровни сортировки', () => {
  it('soleSort: ключ единственным; повтор единственного — смена направления; направление по умолчанию по типу', () => {
    expect(soleSort([], kAmount)).toEqual([{ key: 'amount', dir: 'desc' }])
    expect(soleSort([{ key: 'amount', dir: 'desc' }], kAmount)).toEqual([{ key: 'amount', dir: 'asc' }])
    expect(soleSort([{ key: 'amount', dir: 'desc' }, { key: 'type', dir: 'asc' }], kAmount)).toEqual([{ key: 'amount', dir: 'desc' }])
    expect(soleSort([{ key: 'type', dir: 'asc' }], kAmount)).toEqual([{ key: 'amount', dir: 'desc' }])
  })
  it('addSortLevel: в конец; повтор — смена направления уровня; не больше MAX_SORT_LEVELS', () => {
    expect(addSortLevel([{ key: 'type', dir: 'asc' }], kAmount)).toEqual([{ key: 'type', dir: 'asc' }, { key: 'amount', dir: 'desc' }])
    expect(addSortLevel([{ key: 'type', dir: 'asc' }, { key: 'amount', dir: 'desc' }], kType)).toEqual([{ key: 'type', dir: 'desc' }, { key: 'amount', dir: 'desc' }])
    const full = Array.from({ length: MAX_SORT_LEVELS }, (_, i) => ({ key: `k${i}`, dir: 'asc' as const }))
    expect(addSortLevel(full, kAmount)).toBe(full)
  })
  it('flipSortLevel и removeSortLevel', () => {
    const s = [{ key: 'type', dir: 'asc' as const }, { key: 'amount', dir: 'desc' as const }]
    expect(flipSortLevel(s, 'amount')).toEqual([{ key: 'type', dir: 'asc' }, { key: 'amount', dir: 'asc' }])
    expect(removeSortLevel(s, 'type')).toEqual([{ key: 'amount', dir: 'desc' }])
  })
  it('sortRows по уровням: второй уровень решает при равенстве первого; пустые в конце', () => {
    type R2 = { type: string; amount: number | null }
    const cols: ColumnDef<R2>[] = [
      { id: 't', sort: [kType], render: () => null },
      { id: 'a', sort: [kAmount], render: () => null },
    ]
    const rows2: R2[] = [{ type: 'B', amount: 1 }, { type: 'A', amount: 5 }, { type: 'A', amount: 9 }, { type: 'A', amount: null }]
    const got = sortRows(rows2, [{ key: 'type', dir: 'asc' }, { key: 'amount', dir: 'desc' }], cols, (r, k) => r[k as keyof R2])
    expect(got).toEqual([{ type: 'A', amount: 9 }, { type: 'A', amount: 5 }, { type: 'A', amount: null }, { type: 'B', amount: 1 }])
    expect(sortRows(rows2, [], cols, (r, k) => r[k as keyof R2])).toEqual(rows2)
  })
})
