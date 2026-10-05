import { filterOptions, sameScalar } from './options'

const opts = [
  { value: 'ERROR', label: 'Ошибка' },
  { value: 'DONE', label: 'Обработан', hint: 'DONE' },
  { value: 3, label: 'Третья очередь' },
]

describe('options', () => {
  it('поиск без учёта регистра по подписи, подсказке и значению', () => {
    expect(filterOptions(opts, 'ош').map((o) => o.value)).toEqual(['ERROR'])
    expect(filterOptions(opts, 'done').map((o) => o.value)).toEqual(['DONE'])
    expect(filterOptions(opts, '3').map((o) => o.value)).toEqual([3])
    expect(filterOptions(opts, '  ')).toHaveLength(3)
  })
  it('значения сравниваются строго: 3 и "3" — разные', () => {
    expect(sameScalar(3, 3)).toBe(true)
    expect(sameScalar(3, '3')).toBe(false)
  })
  it('подсказка сама по себе находит вариант; запрос обрезается по краям', () => {
    const banks = [{ value: 'B1', label: 'Банк Север', hint: '044525225' }, { value: 'B2', label: 'Банк Юг', hint: '046015602' }]
    expect(filterOptions(banks, '0445').map((o) => o.value)).toEqual(['B1'])
    expect(filterOptions(opts, ' ош ').map((o) => o.value)).toEqual(['ERROR'])
  })
  it('числа и логические значения: поиск по строке значения, сравнение без приведения', () => {
    const mixed = [{ value: 1, label: 'Первая' }, { value: true, label: 'да' }, { value: false, label: 'нет' }]
    expect(filterOptions(mixed, '1').map((o) => o.value)).toEqual([1])
    expect(filterOptions(mixed, 'true').map((o) => o.value)).toEqual([true])
    expect(sameScalar(1, '1')).toBe(false)
    expect(sameScalar(true, true)).toBe(true)
    expect(sameScalar(true, 'true')).toBe(false)
  })
})
