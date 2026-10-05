import { OP_LABEL, describeCondition, conditionParts, describeField, fieldChip } from './opLabels'
import type { FilterMeta } from './types'

const meta: FilterMeta = { fields: [
  { id: 'status', label: 'Статус', type: 'ENUM', ops: [], values: [{ value: 'TO_EXPORT', label: 'К экспорту' }] },
  { id: 'amount', label: 'Сумма', type: 'NUMBER', ops: [] },
  { id: 'created', label: 'Дата', type: 'DATE', ops: [] },
  { id: 'f50name', label: 'Приказодатель', type: 'STRING', ops: [] },
  { id: 'urgent', label: 'Срочный', type: 'BOOLEAN', ops: [] },
  { id: 'ts', label: 'Время', type: 'DATETIME', ops: [] },
  { id: 'kind', label: 'Вид', type: 'ENUM', ops: [] },
] }

const partsMeta: FilterMeta = { fields: [
  { id: 'status', label: 'Статус', type: 'ENUM', ops: [], values: [{ value: 'TO_EXPORT', label: 'К экспорту' }] },
  { id: 'amount', label: 'Сумма', type: 'NUMBER', ops: [] },
  { id: 'created', label: 'Дата документа', type: 'DATE', ops: [] },
] }

describe('conditionParts', () => {
  it('EQ, IN, BETWEEN, IS_EMPTY — поле, оператор словами, значение', () => {
    expect(conditionParts({ field: 'status', op: 'EQ', value: 'TO_EXPORT' }, partsMeta)).toEqual({ field: 'Статус', op: '=', value: 'К экспорту' })
    expect(conditionParts({ field: 'status', op: 'IN', values: ['TO_EXPORT', 'X'] }, partsMeta)).toEqual({ field: 'Статус', op: 'в списке', value: 'К экспорту, X' })
    expect(conditionParts({ field: 'created', op: 'BETWEEN', from: '2026-09-01', to: '2026-09-13' }, partsMeta)).toEqual({ field: 'Дата документа', op: 'от … до', value: '01.09.2026 – 13.09.2026' })
    expect(conditionParts({ field: 'amount', op: 'IS_EMPTY' }, partsMeta)).toEqual({ field: 'Сумма', op: 'пусто', value: '' })
  })
  it('без меты — id поля как имя', () => {
    expect(conditionParts({ field: 'x', op: 'NE', value: 5 })).toEqual({ field: 'x', op: '≠', value: '5' })
  })
})

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
  it('ENUM без values — значение как есть', () => {
    expect(describeCondition({ field: 'kind', op: 'EQ', value: 'CASH' }, meta)).toBe('Вид = CASH')
  })
  it('поле отсутствует в непустой мете — id поля как имя', () => {
    expect(describeCondition({ field: 'unknown', op: 'EQ', value: 1 }, meta)).toBe('unknown = 1')
  })
  it('невалидная дата/время — как есть, без падения', () => {
    expect(describeCondition({ field: 'created', op: 'EQ', value: 'nope' }, meta)).toBe('Дата = nope')
    expect(describeCondition({ field: 'ts', op: 'EQ', value: 'nope' }, meta)).toBe('Время = nope')
  })
})

const FMETA: FilterMeta = { fields: [
  { id: 'purpose', label: 'Назначение', type: 'STRING', ops: [] },
  { id: 'docNumber', label: 'Номер документа', type: 'NUMBER', ops: [], defaultOp: 'IN' },
  { id: 'created', label: 'Дата документа', type: 'DATE', ops: [] },
  { id: 'ts', label: 'Создан', type: 'DATETIME', ops: [] },
  { id: 'status', label: 'Статус', type: 'ENUM', ops: [], values: [{ value: 'ERROR', label: 'Ошибка' }, { value: 'REJECTED', label: 'Отказ' }] },
] }

describe('fieldChip', () => {
  it('фразы: «содержит „a“ и „b“»', () => {
    const c = fieldChip('purpose', [{ field: 'purpose', op: 'CONTAINS', value: 'счёт не найден' }, { field: 'purpose', op: 'CONTAINS', value: 'инструкция инвалидна' }], FMETA)
    expect(c.full).toBe('Назначение содержит „счёт не найден“ и „инструкция инвалидна“')
    expect(c).toMatchObject({ field: 'Назначение', op: 'содержит', value: '„счёт не найден“ и „инструкция инвалидна“' })
  })
  it('фразы с одним оператором не CONTAINS не теряются', () => {
    const c = fieldChip('purpose', [{ field: 'purpose', op: 'STARTS_WITH', value: 'a' }, { field: 'purpose', op: 'STARTS_WITH', value: 'b' }], FMETA)
    expect(c.full).toBe('Назначение начинается с „a“ и „b“')
  })
  it('список: после трёх значений «и ещё N», полный — в full', () => {
    const c = fieldChip('docNumber', [{ field: 'docNumber', op: 'IN', values: [400, 403, 406, 409, 412] }], FMETA)
    expect(c).toMatchObject({ field: 'Номер документа', op: 'в списке', value: '400, 403, 406 и ещё 2' })
    expect(c.full).toBe('Номер документа в списке 400, 403, 406, 409, 412')
  })
  it('список из трёх — без «и ещё»; подпись справочника с запятой не ломает разбиение', () => {
    expect(fieldChip('docNumber', [{ field: 'docNumber', op: 'IN', values: [1, 2, 3] }], FMETA).value).toBe('1, 2, 3')
    const meta: FilterMeta = { fields: [{ id: 's', label: 'С', type: 'ENUM', ops: [], values: [{ value: 'a', label: 'А, Б' }, { value: 'b', label: 'В' }, { value: 'c', label: 'Г' }, { value: 'd', label: 'Д' }] }] }
    const c = fieldChip('s', [{ field: 's', op: 'IN', values: ['a', 'b', 'c', 'd'] }], meta)
    expect(c.value).toBe('А, Б, В, Г и ещё 1')
    expect(c.full).toBe('С в списке А, Б, В, Г, Д')
  })
  it('даты: с, по, с … по; формат панели', () => {
    expect(fieldChip('created', [{ field: 'created', op: 'GTE', value: '2026-09-01' }], FMETA).full).toBe('Дата документа с 01.09.2026')
    expect(fieldChip('created', [{ field: 'created', op: 'LTE', value: '2026-09-13' }], FMETA).full).toBe('Дата документа по 13.09.2026')
    expect(fieldChip('created', [{ field: 'created', op: 'BETWEEN', from: '2026-09-01', to: '2026-09-13' }], FMETA, 'YYYY-MM-DD').full).toBe('Дата документа с 2026-09-01 по 2026-09-13')
    expect(fieldChip('created', [{ field: 'created', op: 'EQ', value: '2026-09-01' }], FMETA).full).toBe('Дата документа = 01.09.2026')
  })
  it('DATETIME: время только у границ не на начале или конце дня', () => {
    expect(fieldChip('ts', [{ field: 'ts', op: 'BETWEEN', from: '2026-09-01T09:00:00+03:00', to: '2026-09-13T23:59:59+03:00' }], FMETA).full)
      .toBe('Создан с 01.09.2026 09:00 по 13.09.2026')
    expect(fieldChip('ts', [{ field: 'ts', op: 'GTE', value: '2026-09-01T00:00:00+03:00' }], FMETA).full).toBe('Создан с 01.09.2026')
    expect(fieldChip('ts', [{ field: 'ts', op: 'LTE', value: '2026-09-13T18:30:59+03:00' }], FMETA, 'YYYY-MM-DD').full).toBe('Создан по 2026-09-13 18:30')
  })
  it('одно условие не-дата — как describeCondition; ENUM IN — подписи', () => {
    expect(fieldChip('status', [{ field: 'status', op: 'IN', values: ['ERROR', 'REJECTED'] }], FMETA).full).toBe('Статус в списке Ошибка, Отказ')
    expect(fieldChip('status', [{ field: 'status', op: 'EQ', value: 'ERROR' }], FMETA).full).toBe('Статус = Ошибка')
    const c = { field: 'purpose', op: 'CONTAINS', value: 'x' } as const
    expect(fieldChip('purpose', [c], FMETA).full).toBe(describeCondition(c, FMETA))
  })
  it('фразы: подписи справочника, числа и логические без кавычек', () => {
    const meta: FilterMeta = { fields: [
      { id: 'st', label: 'Статус', type: 'ENUM', ops: [], values: [{ value: 'A', label: 'Ошибка' }, { value: 'B', label: 'Отказ' }] },
      { id: 'n', label: 'Сумма', type: 'NUMBER', ops: [] },
    ] }
    expect(fieldChip('st', [{ field: 'st', op: 'NE', value: 'A' }, { field: 'st', op: 'NE', value: 'B' }], meta).full).toBe('Статус ≠ Ошибка и Отказ')
    expect(fieldChip('n', [{ field: 'n', op: 'EQ', value: 1 }, { field: 'n', op: 'EQ', value: 2 }], meta).value).toBe('1 и 2')
  })
  it('разнородные условия поля — через «и», и в value, и в full', () => {
    const c = fieldChip('status', [{ field: 'status', op: 'NE', value: 'ERROR' }, { field: 'status', op: 'EQ', value: 'REJECTED' }], FMETA)
    expect(c).toMatchObject({ field: 'Статус', op: '≠', value: 'Ошибка и = Отказ', full: 'Статус ≠ Ошибка и = Отказ' })
    const d = fieldChip('created', [{ field: 'created', op: 'GTE', value: '2026-09-01' }, { field: 'created', op: 'NE', value: '2026-09-05' }], FMETA)
    expect(d.full).toBe('Дата документа с 01.09.2026 и ≠ 05.09.2026')
    const l = fieldChip('docNumber', [{ field: 'docNumber', op: 'IN', values: [1, 2, 3, 4, 5] }, { field: 'docNumber', op: 'NE', value: 9 }], FMETA)
    expect(l.value).toBe('1, 2, 3 и ещё 2 и ≠ 9')
    expect(l.full).toBe('Номер документа в списке 1, 2, 3, 4, 5 и ≠ 9')
    expect(fieldChip('docNumber', [{ field: 'docNumber', op: 'BETWEEN', from: 1, to: 5 }, { field: 'docNumber', op: 'NE', value: 3 }], FMETA).full).toBe('Номер документа от 1 до 5 и ≠ 3')
  })
  it('условие без значения (IS_EMPTY) не открывает value союзом «и»: части со значением — первыми', () => {
    const c = fieldChip('status', [{ field: 'status', op: 'IS_EMPTY' }, { field: 'status', op: 'NE', value: 'ERROR' }], FMETA)
    expect(c).toMatchObject({ field: 'Статус', op: '≠', value: 'Ошибка и пусто', full: 'Статус ≠ Ошибка и пусто' })
    const e = fieldChip('status', [{ field: 'status', op: 'IS_EMPTY' }, { field: 'status', op: 'IS_NOT_EMPTY' }], FMETA)
    expect(e.value).not.toMatch(/^и /)
    expect(e).toMatchObject({ op: '', value: 'пусто и не пусто', full: 'Статус пусто и не пусто' })
    expect(fieldChip('status', [{ field: 'status', op: 'IS_EMPTY' }], FMETA)).toMatchObject({ op: 'пусто', value: '', full: 'Статус пусто' })
  })
  it('describeField — полный текст чипа', () => {
    expect(describeField('created', [{ field: 'created', op: 'GTE', value: '2026-09-01' }], FMETA, 'YYYY-MM-DD')).toBe('Дата документа с 2026-09-01')
  })
})
