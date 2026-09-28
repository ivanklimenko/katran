import { MAX_SORT_LEVELS, type ColumnDef, type Sort, type SortKey, type SortLevel } from './types'

export { MAX_SORT_LEVELS }

export const defaultDir = (key: SortKey): 'asc' | 'desc' => (key.type === 'number' || key.type === 'date' ? 'desc' : 'asc')

export function findSortKey<Row>(columns: ColumnDef<Row>[], keyId: string): SortKey | undefined {
  for (const c of columns) for (const k of c.sort ?? []) if (k.id === keyId) return k
  return undefined
}

const isEmpty = (v: unknown) => v === null || v === undefined || v === ''

function compareValues(a: unknown, b: unknown, key: SortKey): number {
  if (key.order) {
    const ia = key.order.indexOf(String(a)), ib = key.order.indexOf(String(b))
    return (ia < 0 ? key.order.length : ia) - (ib < 0 ? key.order.length : ib)
  }
  if (key.type === 'number') return Number(a) - Number(b)
  if (key.type === 'date') return new Date(String(a)).getTime() - new Date(String(b)).getTime()
  return String(a).localeCompare(String(b), 'ru')
}

const flip = (d: SortLevel['dir']): SortLevel['dir'] => (d === 'asc' ? 'desc' : 'asc')

/** Сделать ключ единственным; если он уже единственный — сменить направление. */
export function soleSort(sort: Sort, key: SortKey): Sort {
  const only = sort.length === 1 && sort[0]!.key === key.id
  return [{ key: key.id, dir: only ? flip(sort[0]!.dir) : defaultDir(key) }]
}
/** Добавить уровень в конец; если ключ уже есть — сменить направление его уровня. Сверх MAX_SORT_LEVELS — без изменений. */
export function addSortLevel(sort: Sort, key: SortKey): Sort {
  if (sort.some((l) => l.key === key.id)) return flipSortLevel(sort, key.id)
  if (sort.length >= MAX_SORT_LEVELS) return sort
  return [...sort, { key: key.id, dir: defaultDir(key) }]
}
export const flipSortLevel = (sort: Sort, keyId: string): Sort => sort.map((l) => (l.key === keyId ? { ...l, dir: flip(l.dir) } : l))
export const removeSortLevel = (sort: Sort, keyId: string): Sort => sort.filter((l) => l.key !== keyId)

/**
 * Стабильная сортировка по уровням, пока равенство: пустые значения всегда в конце,
 * `order` задаёт фиксированный порядок значений, `then` — второй ключ в том же направлении.
 * Для серверного грида не используется — там сортирует бек.
 */
export function sortRows<Row>(rows: Row[], sort: Sort, columns: ColumnDef<Row>[], get: (row: Row, keyId: string) => unknown): Row[] {
  const levels = sort.flatMap((l) => {
    const key = findSortKey(columns, l.key)
    if (!key) return []
    const then = key.then ? (findSortKey(columns, key.then) ?? { id: key.then, label: key.then }) : undefined
    return [{ key, then, sign: l.dir === 'asc' ? 1 : -1 }]
  })
  if (levels.length === 0) return rows.slice()
  const cmp = (a: Row, b: Row, k: SortKey, sign: number): number => {
    const va = get(a, k.id), vb = get(b, k.id)
    const ea = isEmpty(va), eb = isEmpty(vb)
    if (ea || eb) return ea && eb ? 0 : ea ? 1 : -1  // пустые в конец независимо от направления
    return compareValues(va, vb, k) * sign
  }
  return rows
    .map((row, i) => ({ row, i }))
    .sort((x, y) => {
      for (const l of levels) {
        const c = cmp(x.row, y.row, l.key, l.sign) || (l.then ? cmp(x.row, y.row, l.then, l.sign) : 0)
        if (c) return c
      }
      return x.i - y.i
    })
    .map((x) => x.row)
}
