import { dayOf, isoDayEnd, isoDayStart, isoMinuteEnd, isoMinuteStart, type DateValue } from '../date/dateStr'
import type { DateRangeValue } from '../date/DateRange'
import { mergeTags, splitTags, TAG_LIMIT } from '../tag/parseTags'
import type { Condition, Filter, FilterField, Scalar } from './types'

/** Контрол поля панели simple (спека 2026-09-30 §6.2). */
export type FieldControl = 'values' | 'phrases' | 'number' | 'dateRange' | 'enum' | 'boolean'
export type FieldRaw =
  | { kind: 'text'; value: string }
  | { kind: 'tags'; value: string[]; text: string }
  | { kind: 'range'; value: DateRangeValue }
  | { kind: 'enum'; value: Scalar[] }

const allows = (f: FilterField, op: Condition['op']) => f.ops.length === 0 || f.ops.includes(op)

/** Контрол по типу поля и defaultOp; null — в simple-режиме поле не показывается. */
export function fieldControl(f: FilterField): FieldControl | null {
  switch (f.type) {
    case 'STRING':
      if (f.defaultOp === 'IN') return allows(f, 'IN') || allows(f, 'EQ') ? 'values' : null
      return allows(f, 'CONTAINS') || allows(f, 'STARTS_WITH') || allows(f, 'EQ') ? 'phrases' : null
    case 'NUMBER':
      if (f.defaultOp === 'IN') return allows(f, 'IN') || allows(f, 'EQ') ? 'values' : null
      return allows(f, 'EQ') ? 'number' : null
    case 'DATE': return (['EQ', 'BETWEEN', 'GTE', 'LTE'] as const).some((op) => allows(f, op)) ? 'dateRange' : null
    case 'DATETIME': return (['BETWEEN', 'GTE', 'LTE'] as const).some((op) => allows(f, op)) ? 'dateRange' : null
    case 'ENUM': return allows(f, 'EQ') || allows(f, 'IN') ? 'enum' : null
    case 'BOOLEAN': return allows(f, 'EQ') ? 'boolean' : null
  }
}
/** Предел числа значений контрола: списки и справочники без IN — одно; фразы — без своего предела (упрётся в TagInput),
 * кроме случая, когда допустим только EQ (несколько разных EQ по одному полю взаимоисключающи). */
export function fieldMax(f: FilterField): number | undefined {
  switch (fieldControl(f)) {
    case 'phrases': return allows(f, 'CONTAINS') || allows(f, 'STARTS_WITH') ? undefined : 1
    case 'values':
    case 'enum': return allows(f, 'IN') ? undefined : 1
    default: return undefined
  }
}
/** Поле «по» периода недоступно: различные границы без BETWEEN не выразить (спека §6.2). */
export const rangeToDisabled = (f: FilterField): boolean => !allows(f, 'BETWEEN')

// Только десятичная запись: «1 000,5», «-3», «1,» (набор на середине) — но не «0x10», не «1e3» и не «Infinity».
const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)$/
const toNum = (t: string): number | null => {
  const s = t.replace(/\s/g, '').replace(',', '.')
  if (!NUMBER_RE.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
export const isNumberText = (t: string): boolean => toNum(t) !== null

const WALL = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
/** Граница DATETIME (ISO со смещением) → настенное значение поля: начало или конец дня — день, иначе минута.
 * Секунды отбрасываются; граница «с» `T00:00` и «по» `T23:59` читается как день (то же условие для бека — осознанное сужение). */
function wall(v: Scalar, edge: 'from' | 'to'): DateValue {
  const s = String(v)
  const m = WALL.exec(s)
  if (!m) return s.slice(0, 10)
  const [, day = '', hh = '', mm = '', ss = '00'] = m
  if (edge === 'from' && hh === '00' && mm === '00' && ss === '00') return day
  if (edge === 'to' && hh === '23' && mm === '59' && ss === '59') return day
  return `${day}T${hh}:${mm}`
}
/** Период поля из условий. Строгие GT/LT читаются как GTE/LTE: контрол периода строгих границ не различает. */
function rangeOf(cs: Condition[], dt: boolean): DateRangeValue {
  const at = (v: Scalar, edge: 'from' | 'to'): DateValue => (dt ? wall(v, edge) : String(v).slice(0, 10))
  let from: DateValue = ''
  let to: DateValue = ''
  for (const c of cs) {
    if (c.op === 'BETWEEN') { from = at(c.from, 'from'); to = at(c.to, 'to') }
    else if (c.op === 'EQ') { from = at(c.value, 'from'); to = from }
    else if (c.op === 'GTE' || c.op === 'GT') from = at(c.value, 'from')
    else if (c.op === 'LTE' || c.op === 'LT') to = at(c.value, 'to')
  }
  return { from, to }
}

/** Операторы, которые контрол поля выражает; остальные условия поля панель не читает и не меняет (foreignOf). */
function represented(f: FilterField): ReadonlySet<Condition['op']> {
  switch (fieldControl(f)) {
    case 'values':
    case 'enum': return new Set<Condition['op']>(['EQ', 'IN'])
    case 'phrases': return new Set<Condition['op']>(['CONTAINS', 'STARTS_WITH', 'EQ'])
    case 'dateRange': return new Set<Condition['op']>(['EQ', 'BETWEEN', 'GTE', 'LTE', 'GT', 'LT'])
    case 'number':
    case 'boolean': return new Set<Condition['op']>(['EQ'])
    default: return new Set()
  }
}
const ofField = (draft: Filter, f: FilterField): Condition[] => draft.filter((c) => c.field === f.id)

/** Условия поля, которых контрол не выражает (NE, NOT_IN, GT по числу, IS_EMPTY…): панель сохраняет их как есть. */
export function foreignOf(f: FilterField, conditions: Filter): Condition[] {
  const own = represented(f)
  return ofField(conditions, f).filter((c) => !own.has(c.op))
}

/** Сырое значение контрола из условий поля в черновике; читает только операторы, которые контрол выражает. */
export function draftOf(draft: Filter, f: FilterField): FieldRaw {
  const own = represented(f)
  const cs = ofField(draft, f).filter((c) => own.has(c.op))
  const scalars = (): Scalar[] => cs.flatMap((c) => (c.op === 'IN' ? c.values : 'value' in c ? [c.value] : []))
  switch (fieldControl(f)) {
    case 'values':
    case 'phrases': return { kind: 'tags', value: scalars().map(String), text: '' }
    case 'dateRange': return { kind: 'range', value: rangeOf(cs, f.type === 'DATETIME') }
    case 'enum': return { kind: 'enum', value: scalars() }
    default: { const c = cs[0]; return { kind: 'text', value: c !== undefined && 'value' in c ? String(c.value) : '' } }
  }
}

function rangeConditions(f: FilterField, { from, to }: DateRangeValue): Condition[] {
  const id = f.id
  const dt = f.type === 'DATETIME'
  const lo = (v: DateValue): string => (dt ? (v.length > 10 ? isoMinuteStart(v) : isoDayStart(v)) : dayOf(v))
  const hi = (v: DateValue): string => (dt ? (v.length > 10 ? isoMinuteEnd(v) : isoDayEnd(v)) : dayOf(v))
  if (from && to) {
    if (!dt && dayOf(from) === dayOf(to) && allows(f, 'EQ')) return [{ field: id, op: 'EQ', value: dayOf(from) }]
    if (allows(f, 'BETWEEN')) return [{ field: id, op: 'BETWEEN', from: lo(from), to: hi(to) }]
  }
  if (from && allows(f, 'GTE')) return [{ field: id, op: 'GTE', value: lo(from) }]
  if (!from && to && allows(f, 'LTE')) return [{ field: id, op: 'LTE', value: hi(to) }]
  // без GTE/LTE одна граница сводится к дню (DATE — EQ) или к дню/минуте (DATETIME — BETWEEN)
  const one = from || to
  if (!one) return []
  if (!dt && allows(f, 'EQ')) return [{ field: id, op: 'EQ', value: dayOf(one) }]
  if (allows(f, 'BETWEEN')) return [{ field: id, op: 'BETWEEN', from: lo(one), to: hi(one) }]
  return []
}

/** Условия поля из сырого значения контрола; [] — снять поле. */
export function conditionsFrom(f: FilterField, raw: FieldRaw): Condition[] {
  const id = f.id
  switch (raw.kind) {
    case 'tags': {
      const phrases = fieldControl(f) === 'phrases'
      const mode = phrases ? 'phrases' : 'values'
      // предел: у списка — max поля или контракт IN (500), у фраз — 20; лишнее отсекается (TagInput лишнего и не даёт)
      const cap = fieldMax(f) ?? TAG_LIMIT[mode]
      const all = mergeTags([], [...raw.value, ...splitTags(raw.text, mode)], mode, Number.POSITIVE_INFINITY).value
      if (phrases) {
        const op = allows(f, 'CONTAINS') ? 'CONTAINS' : allows(f, 'STARTS_WITH') ? 'STARTS_WITH' : 'EQ'
        return all.slice(0, cap).map((v) => ({ field: id, op, value: v }))
      }
      const vals: Scalar[] = (f.type === 'NUMBER' ? all.map(toNum).filter((n): n is number => n !== null) : all).slice(0, cap)
      if (vals.length === 0) return []
      if (vals.length === 1) return [allows(f, 'EQ') ? { field: id, op: 'EQ', value: vals[0]! } : { field: id, op: 'IN', values: vals }]
      return [allows(f, 'IN') ? { field: id, op: 'IN', values: vals } : { field: id, op: 'EQ', value: vals[0]! }]
    }
    case 'range': return rangeConditions(f, raw.value)
    case 'enum': {
      const v = raw.value.slice(0, fieldMax(f) ?? TAG_LIMIT.values)
      if (v.length === 0) return []
      if (v.length === 1) return [allows(f, 'EQ') ? { field: id, op: 'EQ', value: v[0]! } : { field: id, op: 'IN', values: v }]
      return [allows(f, 'IN') ? { field: id, op: 'IN', values: v } : { field: id, op: 'EQ', value: v[0]! }]
    }
    case 'text': {
      const t = raw.value.trim()
      if (t === '') return []
      if (f.type === 'NUMBER') { const n = toNum(t); return n === null ? [] : [{ field: id, op: 'EQ', value: n }] }
      if (f.type === 'BOOLEAN') return [{ field: id, op: 'EQ', value: t === 'true' }]
      return [{ field: id, op: 'EQ', value: t }]
    }
  }
}
