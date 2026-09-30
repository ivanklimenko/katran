import type { Condition, FilterFieldType } from '@katran/effector'
import type { FieldDto } from '../../shared/api'

/** Операторы по типу поля — таблица 4.3 контракта. */
export const OPS_BY_TYPE: Record<FilterFieldType, Condition['op'][]> = {
  STRING: ['EQ', 'NE', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'IN', 'NOT_IN', 'IS_EMPTY', 'IS_NOT_EMPTY'],
  NUMBER: ['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IN', 'NOT_IN', 'IS_EMPTY', 'IS_NOT_EMPTY'],
  DATE: ['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IS_EMPTY', 'IS_NOT_EMPTY'],
  DATETIME: ['GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IS_EMPTY', 'IS_NOT_EMPTY'],
  ENUM: ['EQ', 'NE', 'IN', 'NOT_IN', 'IS_EMPTY', 'IS_NOT_EMPTY'],
  BOOLEAN: ['EQ', 'IS_EMPTY', 'IS_NOT_EMPTY'],
}

/** Необязательные свойства поля каталога: оператор по умолчанию (контракт §6) и подсказки (предложение). */
export type FieldOpts = { defaultOperator?: Condition['op'] | undefined; suggest?: boolean | undefined }
export const field = (id: string, label: string, type: FilterFieldType, dictionary?: string, opts: FieldOpts = {}): FieldDto =>
  ({ id, label, type, operators: OPS_BY_TYPE[type], dictionary, ...opts })

/** Встроенный справочник из словаря подписей: порядок — порядок ключей. */
export const inline = (labels: Record<string, string>) =>
  ({ mode: 'INLINE' as const, items: Object.keys(labels).map((value) => ({ value, label: labels[value]! })) })
