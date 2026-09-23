import type { ColumnDef, Sort, SortKey } from './types'

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

/**
 * Стабильная сортировка с одним активным ключом: пустые значения всегда в конце,
 * `order` задаёт фиксированный порядок значений, `then` — второй ключ в том же направлении.
 * Для серверного грида не используется — там сортирует бек.
 */
export function sortRows<Row>(rows: Row[], sort: Sort, columns: ColumnDef<Row>[], get: (row: Row, keyId: string) => unknown): Row[] {
  const out = rows.slice()
  if (!sort) return out
  const key = findSortKey(columns, sort.key)
  if (!key) return out
  const then = key.then ? (findSortKey(columns, key.then) ?? { id: key.then, label: key.then }) : undefined
  const sign = sort.dir === 'asc' ? 1 : -1
  const cmp = (a: Row, b: Row, k: SortKey): number => {
    const va = get(a, k.id), vb = get(b, k.id)
    const ea = isEmpty(va), eb = isEmpty(vb)
    if (ea || eb) return ea && eb ? 0 : ea ? 1 : -1  // пустые в конец независимо от направления
    return compareValues(va, vb, k) * sign
  }
  return out
    .map((row, i) => ({ row, i }))
    .sort((x, y) => cmp(x.row, y.row, key) || (then ? cmp(x.row, y.row, then) : 0) || x.i - y.i)
    .map((x) => x.row)
}
