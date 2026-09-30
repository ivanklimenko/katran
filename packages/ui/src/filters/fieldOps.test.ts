import { conditionsFrom, draftOf, fieldControl, fieldMax, isNumberText, rangeToDisabled } from './fieldOps'
import type { FieldRaw } from './fieldOps'
import type { Condition, FilterField } from './types'

/** Вид первого условия: оператор и границы без смещения зоны (тесты не зависят от пояса машины). */
const iso = (cs: Condition[]): string[] => {
  const c = cs[0]
  if (c === undefined) return []
  if (c.op === 'BETWEEN') return [c.op, String(c.from).slice(0, 19), String(c.to).slice(0, 19)]
  return 'value' in c ? [c.op, String(c.value).slice(0, 19)] : [c.op]
}
const raw = (cs: Condition[], key: 'from' | 'to'): string => { const c = cs[0]; return c !== undefined && c.op === 'BETWEEN' ? String(c[key]) : '' }
const F = (type: FilterField['type'], extra: Partial<FilterField> = {}): FilterField => ({ id: 'x', label: 'X', type, ops: [], ...extra })

describe('fieldControl', () => {
  it('контрол по типу и defaultOp', () => {
    expect(fieldControl(F('STRING'))).toBe('phrases')
    expect(fieldControl(F('STRING', { defaultOp: 'IN' }))).toBe('values')
    expect(fieldControl(F('NUMBER'))).toBe('number')
    expect(fieldControl(F('NUMBER', { defaultOp: 'IN' }))).toBe('values')
    expect(fieldControl(F('DATE'))).toBe('dateRange')
    expect(fieldControl(F('DATETIME'))).toBe('dateRange')
    expect(fieldControl(F('ENUM'))).toBe('enum')
    expect(fieldControl(F('BOOLEAN'))).toBe('boolean')
  })
  it('сужение операторов метой', () => {
    expect(fieldControl(F('STRING', { ops: ['IS_EMPTY'] }))).toBeNull()
    expect(fieldControl(F('DATETIME', { ops: ['IS_EMPTY'] }))).toBeNull()
    expect(fieldMax(F('ENUM', { ops: ['EQ'] }))).toBe(1)
    expect(fieldMax(F('ENUM'))).toBeUndefined()
    expect(rangeToDisabled(F('DATE', { ops: ['EQ', 'GTE'] }))).toBe(true)
    expect(rangeToDisabled(F('DATE'))).toBe(false)
  })
  it('поле без подходящего оператора не показывается', () => {
    expect(fieldControl(F('STRING', { defaultOp: 'IN', ops: ['CONTAINS'] }))).toBeNull()
    expect(fieldControl(F('NUMBER', { ops: ['GT'] }))).toBeNull()
    expect(fieldControl(F('DATE', { ops: ['NE'] }))).toBeNull()
    expect(fieldControl(F('DATETIME', { ops: ['EQ'] }))).toBeNull()
    expect(fieldControl(F('ENUM', { ops: ['NE'] }))).toBeNull()
    expect(fieldControl(F('BOOLEAN', { ops: ['NE'] }))).toBeNull()
  })
})

describe('isNumberText', () => {
  it('число с пробелами и запятой; заготовки и мусор — нет', () => {
    expect(isNumberText('1 000,5')).toBe(true)
    expect(isNumberText('-3')).toBe(true)
    expect(isNumberText('-')).toBe(false)
    expect(isNumberText('.')).toBe(false)
    expect(isNumberText('')).toBe(false)
    expect(isNumberText('abc')).toBe(false)
  })
})

describe('conditionsFrom', () => {
  it('фразы: каждая — своё CONTAINS; набираемый текст — ещё одна фраза; повторы без учёта регистра', () => {
    expect(conditionsFrom(F('STRING'), { kind: 'tags', value: ['счёт не найден', 'Инструкция'], text: 'инструкция' })).toEqual([
      { field: 'x', op: 'CONTAINS', value: 'счёт не найден' }, { field: 'x', op: 'CONTAINS', value: 'Инструкция' },
    ])
    expect(conditionsFrom(F('STRING'), { kind: 'tags', value: [], text: 'Василёк' })).toEqual([{ field: 'x', op: 'CONTAINS', value: 'Василёк' }])
    expect(conditionsFrom(F('STRING', { ops: ['STARTS_WITH', 'EQ'] }), { kind: 'tags', value: ['a'], text: '' })).toEqual([{ field: 'x', op: 'STARTS_WITH', value: 'a' }])
    expect(conditionsFrom(F('STRING', { ops: ['EQ'] }), { kind: 'tags', value: ['a'], text: '' })).toEqual([{ field: 'x', op: 'EQ', value: 'a' }])
  })
  it('списки: одно — EQ, два и больше — IN; числа, невалидные отбрасываются; без IN — одно', () => {
    const S = F('STRING', { defaultOp: 'IN' })
    expect(conditionsFrom(S, { kind: 'tags', value: ['400'], text: '' })).toEqual([{ field: 'x', op: 'EQ', value: '400' }])
    expect(conditionsFrom(S, { kind: 'tags', value: ['400', '403'], text: '406 407' })).toEqual([{ field: 'x', op: 'IN', values: ['400', '403', '406', '407'] }])
    const N = F('NUMBER', { defaultOp: 'IN' })
    expect(conditionsFrom(N, { kind: 'tags', value: ['400', 'abc', '1 000,5'], text: '' })).toEqual([{ field: 'x', op: 'IN', values: [400, 1000.5] }])
    expect(conditionsFrom(F('STRING', { defaultOp: 'IN', ops: ['EQ'] }), { kind: 'tags', value: ['1', '2'], text: '' })).toEqual([{ field: 'x', op: 'EQ', value: '1' }])
    expect(conditionsFrom(F('STRING', { defaultOp: 'IN', ops: ['IN'] }), { kind: 'tags', value: ['1'], text: '' })).toEqual([{ field: 'x', op: 'IN', values: ['1'] }])
    expect(conditionsFrom(S, { kind: 'tags', value: [], text: ' ' })).toEqual([])
    expect(conditionsFrom(N, { kind: 'tags', value: ['abc'], text: '' })).toEqual([])
  })
  it('DATE: равные — EQ, разные — BETWEEN, одна граница — GTE/LTE, без GTE — день', () => {
    const D = F('DATE')
    expect(conditionsFrom(D, { kind: 'range', value: { from: '2026-09-01', to: '2026-09-01' } })).toEqual([{ field: 'x', op: 'EQ', value: '2026-09-01' }])
    expect(conditionsFrom(D, { kind: 'range', value: { from: '2026-09-01', to: '2026-09-13' } })).toEqual([{ field: 'x', op: 'BETWEEN', from: '2026-09-01', to: '2026-09-13' }])
    expect(conditionsFrom(D, { kind: 'range', value: { from: '2026-09-01', to: '' } })).toEqual([{ field: 'x', op: 'GTE', value: '2026-09-01' }])
    expect(conditionsFrom(D, { kind: 'range', value: { from: '', to: '2026-09-13' } })).toEqual([{ field: 'x', op: 'LTE', value: '2026-09-13' }])
    expect(conditionsFrom(F('DATE', { ops: ['EQ'] }), { kind: 'range', value: { from: '2026-09-01', to: '' } })).toEqual([{ field: 'x', op: 'EQ', value: '2026-09-01' }])
    expect(conditionsFrom(F('DATE', { ops: ['EQ'] }), { kind: 'range', value: { from: '', to: '2026-09-13' } })).toEqual([{ field: 'x', op: 'EQ', value: '2026-09-13' }])
    expect(conditionsFrom(D, { kind: 'range', value: { from: '', to: '' } })).toEqual([])
  })
  it('DATETIME: границы дня или минуты со смещением', () => {
    const T = F('DATETIME')
    const cs = conditionsFrom(T, { kind: 'range', value: { from: '2026-09-01', to: '2026-09-02T18:30' } })
    expect(cs).toHaveLength(1)
    expect(iso(cs)).toEqual(['BETWEEN', '2026-09-01T00:00:00', '2026-09-02T18:30:59'])
    expect(raw(cs, 'from')).toMatch(/[+-]\d\d:\d\d$/)
    expect(iso(conditionsFrom(T, { kind: 'range', value: { from: '2026-09-01T09:30', to: '' } }))).toEqual(['GTE', '2026-09-01T09:30:00'])
  })
  it('DATETIME: смешанные границы — день и минута в любом порядке', () => {
    const T = F('DATETIME')
    expect(iso(conditionsFrom(T, { kind: 'range', value: { from: '2026-09-01T09:30', to: '2026-09-02' } }))).toEqual(['BETWEEN', '2026-09-01T09:30:00', '2026-09-02T23:59:59'])
    expect(iso(conditionsFrom(T, { kind: 'range', value: { from: '', to: '2026-09-02T18:30' } }))).toEqual(['LTE', '2026-09-02T18:30:59'])
    expect(iso(conditionsFrom(T, { kind: 'range', value: { from: '2026-09-02', to: '' } }))).toEqual(['GTE', '2026-09-02T00:00:00'])
    expect(iso(conditionsFrom(T, { kind: 'range', value: { from: '', to: '2026-09-02' } }))).toEqual(['LTE', '2026-09-02T23:59:59'])
  })
  it('DATETIME без GTE/LTE: одна граница — BETWEEN за день или минуту', () => {
    const T = F('DATETIME', { ops: ['BETWEEN'] })
    expect(iso(conditionsFrom(T, { kind: 'range', value: { from: '2026-09-01', to: '' } }))).toEqual(['BETWEEN', '2026-09-01T00:00:00', '2026-09-01T23:59:59'])
    expect(iso(conditionsFrom(T, { kind: 'range', value: { from: '', to: '2026-09-01T10:15' } }))).toEqual(['BETWEEN', '2026-09-01T10:15:00', '2026-09-01T10:15:59'])
  })
  it('ENUM, NUMBER, BOOLEAN', () => {
    expect(conditionsFrom(F('ENUM'), { kind: 'enum', value: ['ERROR'] })).toEqual([{ field: 'x', op: 'EQ', value: 'ERROR' }])
    expect(conditionsFrom(F('ENUM'), { kind: 'enum', value: ['ERROR', 'DONE'] })).toEqual([{ field: 'x', op: 'IN', values: ['ERROR', 'DONE'] }])
    expect(conditionsFrom(F('ENUM', { ops: ['IN'] }), { kind: 'enum', value: ['ERROR'] })).toEqual([{ field: 'x', op: 'IN', values: ['ERROR'] }])
    expect(conditionsFrom(F('ENUM', { ops: ['EQ'] }), { kind: 'enum', value: ['ERROR', 'DONE'] })).toEqual([{ field: 'x', op: 'EQ', value: 'ERROR' }])
    expect(conditionsFrom(F('ENUM'), { kind: 'enum', value: [] })).toEqual([])
    expect(conditionsFrom(F('NUMBER'), { kind: 'text', value: '1,5' })).toEqual([{ field: 'x', op: 'EQ', value: 1.5 }])
    expect(conditionsFrom(F('NUMBER'), { kind: 'text', value: '-' })).toEqual([])
    expect(conditionsFrom(F('BOOLEAN'), { kind: 'text', value: 'false' })).toEqual([{ field: 'x', op: 'EQ', value: false }])
    expect(conditionsFrom(F('BOOLEAN'), { kind: 'text', value: 'true' })).toEqual([{ field: 'x', op: 'EQ', value: true }])
    expect(conditionsFrom(F('BOOLEAN'), { kind: 'text', value: '' })).toEqual([])
  })
})

describe('draftOf', () => {
  it('восстанавливает сырое значение из условий поля', () => {
    expect(draftOf([{ field: 'x', op: 'CONTAINS', value: 'a' }, { field: 'x', op: 'CONTAINS', value: 'b' }], F('STRING'))).toEqual({ kind: 'tags', value: ['a', 'b'], text: '' })
    expect(draftOf([{ field: 'x', op: 'IN', values: [400, 403] }], F('NUMBER', { defaultOp: 'IN' }))).toEqual({ kind: 'tags', value: ['400', '403'], text: '' })
    expect(draftOf([{ field: 'x', op: 'GTE', value: '2026-09-01' }], F('DATE'))).toEqual({ kind: 'range', value: { from: '2026-09-01', to: '' } })
    expect(draftOf([{ field: 'x', op: 'BETWEEN', from: '2026-09-01T00:00:00+03:00', to: '2026-09-02T18:30:59+03:00' }], F('DATETIME')))
      .toEqual({ kind: 'range', value: { from: '2026-09-01', to: '2026-09-02T18:30' } })
    expect(draftOf([{ field: 'x', op: 'EQ', value: 'ERROR' }], F('ENUM'))).toEqual({ kind: 'enum', value: ['ERROR'] })
    expect(draftOf([], F('BOOLEAN'))).toEqual({ kind: 'text', value: '' })
  })
  it('берёт только условия своего поля', () => {
    expect(draftOf([{ field: 'y', op: 'EQ', value: 'a' }, { field: 'x', op: 'EQ', value: 'b' }], F('ENUM'))).toEqual({ kind: 'enum', value: ['b'] })
    expect(draftOf([{ field: 'y', op: 'EQ', value: 1 }], F('NUMBER'))).toEqual({ kind: 'text', value: '' })
    expect(draftOf([{ field: 'x', op: 'EQ', value: true }], F('BOOLEAN'))).toEqual({ kind: 'text', value: 'true' })
  })
  it('EQ по DATE — обе границы; EQ по DATETIME со временем — минута', () => {
    expect(draftOf([{ field: 'x', op: 'EQ', value: '2026-09-01' }], F('DATE'))).toEqual({ kind: 'range', value: { from: '2026-09-01', to: '2026-09-01' } })
    expect(draftOf([{ field: 'x', op: 'LTE', value: '2026-09-13T10:05:59+03:00' }], F('DATETIME'))).toEqual({ kind: 'range', value: { from: '', to: '2026-09-13T10:05' } })
  })
})

describe('draftOf(conditionsFrom(x)) == x', () => {
  const round = (f: FilterField, raw: FieldRaw) => draftOf(conditionsFrom(f, raw), f)
  it('фразы и списки', () => {
    const p: FieldRaw = { kind: 'tags', value: ['счёт не найден', 'Инструкция'], text: '' }
    expect(round(F('STRING'), p)).toEqual(p)
    const v: FieldRaw = { kind: 'tags', value: ['400', '403', '406'], text: '' }
    expect(round(F('STRING', { defaultOp: 'IN' }), v)).toEqual(v)
    expect(round(F('NUMBER', { defaultOp: 'IN' }), v)).toEqual(v)
    const one: FieldRaw = { kind: 'tags', value: ['400'], text: '' }
    expect(round(F('STRING', { defaultOp: 'IN' }), one)).toEqual(one)
  })
  it('периоды', () => {
    const ranges: { from: string; to: string }[] = [
      { from: '2026-09-01', to: '2026-09-13' }, { from: '2026-09-01', to: '' }, { from: '', to: '2026-09-13' }, { from: '2026-09-01', to: '2026-09-01' },
    ]
    for (const value of ranges) expect(round(F('DATE'), { kind: 'range', value })).toEqual({ kind: 'range', value })
    const dts: { from: string; to: string }[] = [
      { from: '2026-09-01', to: '2026-09-02T18:30' }, { from: '2026-09-01T09:30', to: '2026-09-02' }, { from: '2026-09-01T09:30', to: '2026-09-02T18:30' },
      { from: '2026-09-01T09:30', to: '' }, { from: '', to: '2026-09-02T18:30' }, { from: '2026-09-01', to: '2026-09-02' },
    ]
    for (const value of dts) expect(round(F('DATETIME'), { kind: 'range', value })).toEqual({ kind: 'range', value })
  })
  it('справочник, число, логическое', () => {
    for (const value of [['ERROR'], ['ERROR', 'DONE']]) expect(round(F('ENUM'), { kind: 'enum', value })).toEqual({ kind: 'enum', value })
    expect(round(F('NUMBER'), { kind: 'text', value: '1.5' })).toEqual({ kind: 'text', value: '1.5' })
    expect(round(F('BOOLEAN'), { kind: 'text', value: 'false' })).toEqual({ kind: 'text', value: 'false' })
  })
})
