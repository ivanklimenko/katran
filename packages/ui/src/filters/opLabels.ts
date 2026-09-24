import { formatDate } from '../format'
import type { Condition, FilterField, FilterMeta, Scalar } from './types'

/** Подписи операторов для чипов панели (спека 1e, 6.2). */
export const OP_LABEL: Record<Condition['op'], string> = {
  EQ: '=', NE: '≠', CONTAINS: 'содержит', STARTS_WITH: 'начинается с', ENDS_WITH: 'заканчивается на',
  GT: '>', GTE: '≥', LT: '<', LTE: '≤', BETWEEN: 'от … до', IN: 'в списке', NOT_IN: 'не в списке',
  IS_EMPTY: 'пусто', IS_NOT_EMPTY: 'не пусто',
}

const p2 = (n: number) => String(n).padStart(2, '0')
const dateTime = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? iso : `${formatDate(iso)} ${p2(d.getHours())}:${p2(d.getMinutes())}` }

/** Значение для чипа: ENUM — подпись справочника, DATE/DATETIME — по-русски, BOOLEAN — да/нет, STRING — в кавычках. */
function showValue(v: Scalar, field: FilterField | undefined): string {
  switch (field?.type) {
    case 'ENUM': return field.values?.find((x) => String(x.value) === String(v))?.label ?? String(v)
    case 'DATE': return formatDate(String(v)) || String(v)
    case 'DATETIME': return dateTime(String(v))
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
