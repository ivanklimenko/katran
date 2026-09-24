import { formatAmount } from './amount'

describe('formatAmount', () => {
  it('группы неразрывным пробелом, десятичная точка — как на стенде', () => {
    expect(formatAmount(1234567.5)).toBe('1 234 567.50')
  })
  it('ноль и отрицательные', () => {
    expect(formatAmount(0)).toBe('0.00')
    expect(formatAmount(-42.1)).toBe('-42.10')
  })
  it('без дробной части', () => expect(formatAmount(1500, 0)).toBe('1 500'))
  it('разделитель разрядов виден: обычный неразрывный пробел, не узкий U+202F', () => {
    expect(formatAmount(1000)).not.toContain(' ')
    expect(formatAmount(1000)).toContain(' ')
  })
})
