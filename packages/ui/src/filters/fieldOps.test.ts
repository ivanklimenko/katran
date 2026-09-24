import { conditionFrom, draftOf, fieldOp, isoDayEnd, isoDayStart } from './fieldOps'
import type { FilterField } from './types'

const f = (type: FilterField['type'], ops: FilterField['ops'] = []): FilterField => ({ id: 'x', label: 'X', type, ops, values: [{ value: 5, label: 'пять' }] })

describe('fieldOp', () => {
  it('оператор по типу; ops сужают; поле без скалярного оператора не показывается', () => {
    expect(fieldOp(f('STRING'))).toBe('CONTAINS')
    expect(fieldOp(f('NUMBER'))).toBe('EQ')
    expect(fieldOp(f('DATETIME'))).toBe('BETWEEN')
    expect(fieldOp(f('STRING', ['EQ', 'NE']))).toBe('EQ')
    expect(fieldOp(f('STRING', ['IN', 'IS_EMPTY']))).toBeNull()
    expect(fieldOp(f('DATETIME', ['GT']))).toBeNull()
  })
})
describe('conditionFrom / draftOf', () => {
  it('STRING обрезает пробелы; пусто — null', () => {
    expect(conditionFrom(f('STRING'), '  Вас ')).toEqual({ field: 'x', op: 'CONTAINS', value: 'Вас' })
    expect(conditionFrom(f('STRING'), '   ')).toBeNull()
  })
  it('NUMBER: запятая как точка, не число — null', () => {
    expect(conditionFrom(f('NUMBER'), '1,5')).toEqual({ field: 'x', op: 'EQ', value: 1.5 })
    expect(conditionFrom(f('NUMBER'), 'abc')).toBeNull()
  })
  it('ENUM возвращает исходный скаляр справочника, BOOLEAN — boolean, DATE — строку', () => {
    expect(conditionFrom(f('ENUM'), '5')).toEqual({ field: 'x', op: 'EQ', value: 5 })
    expect(conditionFrom(f('BOOLEAN'), 'true')).toEqual({ field: 'x', op: 'EQ', value: true })
    expect(conditionFrom(f('DATE'), '2026-09-01')).toEqual({ field: 'x', op: 'EQ', value: '2026-09-01' })
  })
  it('DATETIME: два дня → BETWEEN за сутки; одна граница пустая — берётся другая; обе пустые — null', () => {
    const c = conditionFrom(f('DATETIME'), { from: '2026-09-01', to: '2026-09-02' })
    expect(c).toEqual({ field: 'x', op: 'BETWEEN', from: isoDayStart('2026-09-01'), to: isoDayEnd('2026-09-02') })
    expect(isoDayStart('2026-09-01')).toMatch(/^2026-09-01T00:00:00[+-]\d\d:\d\d$/)
    expect(isoDayEnd('2026-09-01')).toMatch(/^2026-09-01T23:59:59[+-]\d\d:\d\d$/)
    expect(conditionFrom(f('DATETIME'), { from: '2026-09-01', to: '' })).toEqual({ field: 'x', op: 'BETWEEN', from: isoDayStart('2026-09-01'), to: isoDayEnd('2026-09-01') })
    expect(conditionFrom(f('DATETIME'), { from: '', to: '' })).toBeNull()
  })
  it('draftOf читает значение поля из черновика в форму контрола', () => {
    expect(draftOf([{ field: 'x', op: 'EQ', value: 5 }], f('ENUM'))).toBe('5')
    expect(draftOf([], f('STRING'))).toBe('')
    expect(draftOf([{ field: 'x', op: 'BETWEEN', from: '2026-09-01T00:00:00+03:00', to: '2026-09-02T23:59:59+03:00' }], f('DATETIME'))).toEqual({ from: '2026-09-01', to: '2026-09-02' })
  })
})
