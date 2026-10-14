import { standParam } from './stand'

describe('регуляторы стенда в адресе (срез styled, Task 0)', () => {
  afterEach(() => { history.replaceState(null, '', '/') })

  it('?docs=500 — значение строкой', () => {
    history.replaceState(null, '', '/?docs=500')
    expect(standParam('docs')).toBe('500')
  })
  it('без параметра — null', () => {
    history.replaceState(null, '', '/?slow=0')
    expect(standParam('docs')).toBeNull()
    expect(standParam('size')).toBeNull()
    expect(standParam('noauto')).toBeNull()
  })
  it('?noauto без значения — пустая строка', () => {
    history.replaceState(null, '', '/?slow=0&noauto')
    expect(standParam('noauto')).toBe('')
  })
})
