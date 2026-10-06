import { ApiError } from './problem'
import { bool, strArr } from './guards'

describe('strArr', () => {
  it('массив строк — как есть', () => { expect(strArr(['a', 'b'], 'x')).toEqual(['a', 'b']) })
  it('не массив или не строка внутри — contractError с путём', () => {
    expect(() => strArr('a', 'd.lines')).toThrow('d.lines: ожидался массив')
    expect(() => strArr(['a', 1], 'd.lines')).toThrow('d.lines[1]: ожидалась строка')
    expect(() => strArr([1], 'x')).toThrow(ApiError)
  })
})

describe('bool', () => {
  it('boolean — как есть; нет ключа — fallback; не boolean — contractError с путём', () => {
    expect(bool({ a: true }, 'a', 'x')).toBe(true)
    expect(bool({}, 'a', 'x')).toBe(false)
    expect(bool({}, 'a', 'x', true)).toBe(true)
    expect(() => bool({ a: 'yes' }, 'a', 'x')).toThrow('x.a: ожидалось true или false')
  })
})
