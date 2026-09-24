import type { Condition, Filter, FilterField, FilterFieldType } from './types'

type ScalarOp = Extract<Condition, { value: unknown }>['op']
const SCALAR_OPS: ReadonlySet<Condition['op']> = new Set<Condition['op']>(['EQ', 'NE', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'GT', 'GTE', 'LT', 'LTE'])
const BY_TYPE: Record<FilterFieldType, Condition['op']> = { STRING: 'CONTAINS', NUMBER: 'EQ', DATE: 'EQ', DATETIME: 'BETWEEN', ENUM: 'EQ', BOOLEAN: 'EQ' }

/** Оператор поля в simple-режиме: по типу; если ops сужают — первый допустимый той же формы; null — поле в simple не показывается. */
export function fieldOp(f: FilterField): Condition['op'] | null {
  const want = BY_TYPE[f.type]
  if (f.ops.length === 0 || f.ops.includes(want)) return want
  if (f.type === 'DATETIME') return null
  return f.ops.find((op) => SCALAR_OPS.has(op)) ?? null
}

const p2 = (n: number) => String(n).padStart(2, '0')
/** Смещение локальной зоны для даты YYYY-MM-DD в виде ±hh:mm. */
function offsetOf(day: string): string {
  const m = -new Date(`${day}T00:00:00`).getTimezoneOffset()
  const sign = m < 0 ? '-' : '+'
  const a = Math.abs(m)
  return `${sign}${p2(Math.floor(a / 60))}:${p2(a % 60)}`
}
export const isoDayStart = (day: string) => `${day}T00:00:00${offsetOf(day)}`
export const isoDayEnd = (day: string) => `${day}T23:59:59${offsetOf(day)}`

export type RawValue = string | { from: string; to: string }

/** Значение контрола из черновика: строка, для DATETIME — пара дней. */
export function draftOf(draft: Filter, f: FilterField): RawValue {
  const c = draft.find((x) => x.field === f.id)
  if (f.type === 'DATETIME') return c && c.op === 'BETWEEN' ? { from: String(c.from).slice(0, 10), to: String(c.to).slice(0, 10) } : { from: '', to: '' }
  if (!c || !('value' in c)) return ''
  return String(c.value)
}

/** Условие из сырого значения контрола; null — поле пусто, условие снимается. */
export function conditionFrom(f: FilterField, raw: RawValue): Condition | null {
  const op = fieldOp(f)
  if (op === null) return null
  if (typeof raw !== 'string') {
    const from = raw.from || raw.to
    const to = raw.to || raw.from
    return from ? { field: f.id, op: 'BETWEEN', from: isoDayStart(from), to: isoDayEnd(to) } : null
  }
  const text = raw.trim()
  if (text === '') return null
  const scalarOp = op as ScalarOp
  switch (f.type) {
    case 'NUMBER': { const n = Number(text.replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? null : { field: f.id, op: scalarOp, value: n } }
    case 'ENUM': { const v = f.values?.find((x) => String(x.value) === text); return { field: f.id, op: scalarOp, value: v ? v.value : text } }
    case 'BOOLEAN': return { field: f.id, op: scalarOp, value: text === 'true' }
    default: return { field: f.id, op: scalarOp, value: text }
  }
}
