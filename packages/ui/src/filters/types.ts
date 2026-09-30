/** Модель фильтра — спека 7.1, контракт vtb-filters/docs/filter-contract.md. Живёт в ui: панели нужны эти типы, а ui не импортирует effector (спека 3.2). */
export type Scalar = string | number | boolean

export type Condition =
  | { field: string; op: 'EQ' | 'NE' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'GT' | 'GTE' | 'LT' | 'LTE'; value: Scalar }
  | { field: string; op: 'IN' | 'NOT_IN'; values: Scalar[] }
  | { field: string; op: 'BETWEEN'; from: Scalar; to: Scalar }
  | { field: string; op: 'IS_EMPTY' | 'IS_NOT_EMPTY' }

/** v1 — только AND. */
export type Filter = Condition[]

export type FilterFieldType = 'STRING' | 'NUMBER' | 'DATE' | 'DATETIME' | 'ENUM' | 'BOOLEAN'
export type FilterField = {
  id: string
  label: string
  type: FilterFieldType
  /** Допустимые операторы; пустой список — все операторы типа. */
  ops: Condition['op'][]
  /** Встроенный справочник для ENUM. */
  values?: { value: Scalar; label: string }[] | undefined
  group?: string | undefined
  /** Оператор по умолчанию (defaultOperator контракта §6): у STRING и NUMBER `IN` включает ввод списка значений. */
  defaultOp?: Condition['op'] | undefined
  /** У поля есть подсказки с бека (предложение в контракт, спека 2026-09-30 §9). */
  suggest?: boolean | undefined
}
/** Ответ GET /grids/{gridId}/filter-meta. */
export type FilterMeta = { fields: FilterField[] }

/** Подсказки поля фильтра — стор модели фильтров (спека 2026-09-30 §8). */
export type SuggestState = { field: string; query: string; items: string[]; loading: boolean }
