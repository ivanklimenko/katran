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
})
