import { datePartOf, formatDateText, withTime, type DateFormat } from '../date/dateStr'
import type { Condition, FilterField, FilterMeta, Scalar } from './types'

/** Подписи операторов для чипов панели (спека 1e, 6.2). */
export const OP_LABEL: Record<Condition['op'], string> = {
  EQ: '=', NE: '≠', CONTAINS: 'содержит', STARTS_WITH: 'начинается с', ENDS_WITH: 'заканчивается на',
  GT: '>', GTE: '≥', LT: '<', LTE: '≤', BETWEEN: 'от … до', IN: 'в списке', NOT_IN: 'не в списке',
  IS_EMPTY: 'пусто', IS_NOT_EMPTY: 'не пусто',
}

// Чип показывает «настенное» время документа, как прислал бек — парсим саму строку,
// без new Date(), иначе результат зависит от часового пояса машины (спека 1e, ruling 3).
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/

const dateFromStr = (s: string): string => { const m = DATE_RE.exec(s); return m ? `${m[3]}.${m[2]}.${m[1]}` : s }
const dateTimeFromStr = (s: string): string => { const m = DATETIME_RE.exec(s); return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}` : s }

/** Значение для чипа: ENUM — подпись справочника, DATE/DATETIME — по-русски, BOOLEAN — да/нет, STRING — в кавычках. */
function showValue(v: Scalar, field: FilterField | undefined): string {
  switch (field?.type) {
    case 'ENUM': return field.values?.find((x) => String(x.value) === String(v))?.label ?? String(v)
    case 'DATE': return dateFromStr(String(v))
    case 'DATETIME': return dateTimeFromStr(String(v))
    case 'BOOLEAN': return v === true || v === 'true' ? 'да' : 'нет'
    case 'STRING': return `„${String(v)}“`
    default: return String(v)
  }
}

/** Текст чипа: «Статус = К экспорту», «Сумма > 100000», «Дата от 01.09.2026 до 13.09.2026». */
export function describeCondition(c: Condition, meta?: FilterMeta | null): string {
  const field = meta?.fields.find((f) => f.id === c.field)
  const name = field?.label ?? c.field
  switch (c.op) {
    case 'IN': case 'NOT_IN': return `${name} ${OP_LABEL[c.op]} ${c.values.map((v) => showValue(v, field)).join(', ')}`
    case 'BETWEEN': return `${name} от ${showValue(c.from, field)} до ${showValue(c.to, field)}`
    case 'IS_EMPTY': case 'IS_NOT_EMPTY': return `${name} ${OP_LABEL[c.op]}`
    default: return `${name} ${OP_LABEL[c.op]} ${showValue(c.value, field)}`
  }
}

/** Части чипа для вида эталона (спека 5b §4, P3): поле · оператор словами · значение —
 * стили кладёт FilterPanel, здесь только данные. Оператор — из OP_LABEL, тот же словарь,
 * что и в describeCondition (которая остаётся для доступного имени ✕ и тултипа). */
export function conditionParts(c: Condition, meta?: FilterMeta | null): { field: string; op: string; value: string } {
  const field = meta?.fields.find((f) => f.id === c.field)
  const name = field?.label ?? c.field
  const op = OP_LABEL[c.op]
  switch (c.op) {
    case 'IN': case 'NOT_IN': return { field: name, op, value: c.values.map((v) => showValue(v, field)).join(', ') }
    case 'BETWEEN': return { field: name, op, value: `${showValue(c.from, field)} – ${showValue(c.to, field)}` }
    case 'IS_EMPTY': case 'IS_NOT_EMPTY': return { field: name, op, value: '' }
    default: return { field: name, op, value: showValue(c.value, field) }
  }
}

/** Части и полный текст чипа поля (спека 2026-09-30 §6.4): чип — один на поле, по всем его условиям. */
export type FieldChip = { field: string; op: string; value: string; full: string }

const WALL_RE = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/
/** Дата границы для чипа в формате панели: DATE — день; DATETIME — день, если граница — начало (from/eq) или конец (to) дня, иначе день и время. */
function chipDate(v: Scalar, type: string, edge: 'from' | 'to' | 'eq', fmt: DateFormat): string {
  const m = WALL_RE.exec(String(v))
  if (!m) return String(v)
  const [, day = '', hh, mm, ss = '00'] = m
  if (type !== 'DATETIME' || hh === undefined) return formatDateText(day, datePartOf(fmt))
  const whole = (edge !== 'to' && hh === '00' && mm === '00' && ss === '00') || (edge === 'to' && hh === '23' && mm === '59' && ss === '59')
  return whole ? formatDateText(day, datePartOf(fmt)) : formatDateText(`${day}T${hh}:${mm}`, withTime(fmt, true))
}

/** После стольких значений списка в чипе — «и ещё N». */
const LIST_SHOWN = 3

/** Чип поля по всем его условиям; один чип на поле. Для одного условия не-даты `full` совпадает с describeCondition. */
export function fieldChip(fieldId: string, conditions: Condition[], meta?: FilterMeta | null, format: DateFormat = 'DD.MM.YYYY'): FieldChip {
  const field = meta?.fields.find((f) => f.id === fieldId)
  const name = field?.label ?? fieldId
  const chip = (op: string, value: string, fullValue = value): FieldChip => ({ field: name, op, value, full: [name, op, fullValue].filter(Boolean).join(' ') })
  if (field && (field.type === 'DATE' || field.type === 'DATETIME')) {
    let from = ''
    let to = ''
    let eq = ''
    for (const c of conditions) {
      if (c.op === 'BETWEEN') { from = chipDate(c.from, field.type, 'from', format); to = chipDate(c.to, field.type, 'to', format) }
      else if (c.op === 'EQ') eq = chipDate(c.value, field.type, 'eq', format)
      else if (c.op === 'GTE' || c.op === 'GT') from = chipDate(c.value, field.type, 'from', format)
      else if (c.op === 'LTE' || c.op === 'LT') to = chipDate(c.value, field.type, 'to', format)
    }
    if (eq) return chip(OP_LABEL.EQ, eq)
    if (from && to) return chip('с', `${from} по ${to}`)
    if (from) return chip('с', from)
    if (to) return chip('по', to)
  }
  const c = conditions[0]
  if (c === undefined) return chip('', '')
  // фразы: несколько условий с одним оператором (CONTAINS, а при сужении метой — STARTS_WITH или EQ) — одна строка через «и»
  if (conditions.length > 1 && conditions.every((x) => x.op === c.op && 'value' in x)) {
    const v = conditions.map((x) => `„${'value' in x ? String(x.value) : ''}“`).join(' и ')
    return chip(OP_LABEL[c.op], v)
  }
  if ((c.op === 'IN' || c.op === 'NOT_IN') && c.values.length > LIST_SHOWN) {
    const all = c.values.map((v) => showValue(v, field))
    return chip(OP_LABEL[c.op], `${all.slice(0, LIST_SHOWN).join(', ')} и ещё ${all.length - LIST_SHOWN}`, all.join(', '))
  }
  return { ...conditionParts(c, meta), full: describeCondition(c, meta) }
}

/** Полный текст чипа поля — для тултипа и доступного имени ✕. */
export const describeField = (fieldId: string, conditions: Condition[], meta?: FilterMeta | null, format?: DateFormat): string =>
  fieldChip(fieldId, conditions, meta, format).full
