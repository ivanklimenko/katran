import type { Condition, Filter } from '@katran/effector'

const raw = (v: unknown) => (v == null ? '' : String(v))
const str = (v: unknown) => raw(v).toLowerCase()
const isDay = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
/** Дата в условии — день YYYY-MM-DD: сравниваем с первыми 10 знаками ISO-значения записи. */
const dayOf = (v: unknown) => str(v).slice(0, 10)
const num = (v: unknown) => Number(String(v).replace(/\s/g, '').replace(',', '.'))
const cmp = (v: unknown, c: unknown) => (typeof c === 'number' ? num(v) - c : str(v) < str(c) ? -1 : str(v) > str(c) ? 1 : 0)

/** Подмножество семантики контракта (§4.2), достаточное для стенда: EQ/NE для строк — точно, с учётом регистра;
 * CONTAINS/STARTS_WITH/ENDS_WITH — без учёта регистра; числа как числа, даты по дню/ISO-строкой. */
function matches(row: Record<string, unknown>, c: Condition): boolean {
  const v = row[c.field]
  switch (c.op) {
    case 'EQ': return isDay(c.value) ? dayOf(v) === c.value : typeof c.value === 'number' ? num(v) === c.value : raw(v) === raw(c.value)
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

export const applyFilter = <Row extends Record<string, unknown>>(rows: Row[], f: Filter): Row[] => rows.filter((r) => f.every((c) => matches(r, c)))
