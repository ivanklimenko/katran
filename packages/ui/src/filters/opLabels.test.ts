import { OP_LABEL, describeCondition } from './opLabels'
import type { FilterMeta } from './types'

const meta: FilterMeta = { fields: [
  { id: 'status', label: 'Статус', type: 'ENUM', ops: [], values: [{ value: 'TO_EXPORT', label: 'К экспорту' }] },
  { id: 'amount', label: 'Сумма', type: 'NUMBER', ops: [] },
  { id: 'created', label: 'Дата', type: 'DATE', ops: [] },
  { id: 'f50name', label: 'Приказодатель', type: 'STRING', ops: [] },
  { id: 'urgent', label: 'Срочный', type: 'BOOLEAN', ops: [] },
  { id: 'ts', label: 'Время', type: 'DATETIME', ops: [] },
] }

describe('describeCondition', () => {
  it('словарь покрывает все 14 операторов', () => {
    expect(Object.keys(OP_LABEL)).toHaveLength(14)
  })
  it('ENUM — подпись из справочника, число как есть, дата дд.мм.гггг, строка в кавычках', () => {
    expect(describeCondition({ field: 'status', op: 'EQ', value: 'TO_EXPORT' }, meta)).toBe('Статус = К экспорту')
    expect(describeCondition({ field: 'amount', op: 'GT', value: 100000 }, meta)).toBe('Сумма > 100000')
    expect(describeCondition({ field: 'created', op: 'EQ', value: '2026-09-01' }, meta)).toBe('Дата = 01.09.2026')
    expect(describeCondition({ field: 'f50name', op: 'CONTAINS', value: 'Василёк' }, meta)).toBe('Приказодатель содержит „Василёк“')
    expect(describeCondition({ field: 'urgent', op: 'EQ', value: true }, meta)).toBe('Срочный = да')
  })
  it('списки, диапазон, пустота; DATETIME — дд.мм.гггг чч:мм', () => {
    expect(describeCondition({ field: 'status', op: 'IN', values: ['TO_EXPORT', 'X'] }, meta)).toBe('Статус в списке К экспорту, X')
    expect(describeCondition({ field: 'created', op: 'BETWEEN', from: '2026-09-01', to: '2026-09-13' }, meta)).toBe('Дата от 01.09.2026 до 13.09.2026')
    expect(describeCondition({ field: 'ts', op: 'BETWEEN', from: '2026-09-01T00:00:00+03:00', to: '2026-09-01T23:59:59+03:00' }, meta)).toBe('Время от 01.09.2026 00:00 до 01.09.2026 23:59')
    expect(describeCondition({ field: 'amount', op: 'IS_EMPTY' }, meta)).toBe('Сумма пусто')
  })
  it('без меты — id поля и значение как есть', () => {
    expect(describeCondition({ field: 'x', op: 'NE', value: 5 })).toBe('x ≠ 5')
  })
})
