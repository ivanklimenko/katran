import { localStoragePersist, memoryPersist } from './persist'

describe('persist', () => {
  beforeEach(() => localStorage.clear())

  it('localStorage: сохраняет и читает JSON под префиксом', () => {
    const p = localStoragePersist<{ a: number }>('katran')
    p.save('grid', { a: 1 })
    expect(localStorage.getItem('katran:grid')).toBe('{"a":1}')
    expect(p.load('grid')).toEqual({ a: 1 })
  })
  it('localStorage: испорченный JSON и отсутствие ключа → undefined', () => {
    const p = localStoragePersist('katran')
    localStorage.setItem('katran:bad', '{oops')
    expect(p.load('bad')).toBeUndefined()
    expect(p.load('none')).toBeUndefined()
  })
  it('memory: изолированное хранилище', () => {
    const a = memoryPersist<number>(), b = memoryPersist<number>()
    a.save('k', 1)
    expect(a.load('k')).toBe(1)
    expect(b.load('k')).toBeUndefined()
  })
})
