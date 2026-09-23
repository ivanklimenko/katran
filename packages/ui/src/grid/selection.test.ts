import { EMPTY_SELECTION, isSelected, pageState, selectedCount } from './selection'

describe('selection helpers', () => {
  it('ids: выбран, если в списке', () => {
    const s = { mode: 'ids' as const, ids: ['a', 'b'] }
    expect(isSelected(s, 'a')).toBe(true)
    expect(isSelected(s, 'z')).toBe(false)
    expect(selectedCount(s, 87)).toBe(2)
  })
  it('all: выбран, если не в исключениях; счётчик = total − except', () => {
    const s = { mode: 'all' as const, except: ['b'] }
    expect(isSelected(s, 'a')).toBe(true)
    expect(isSelected(s, 'b')).toBe(false)
    expect(selectedCount(s, 87)).toBe(86)
  })
  it('состояние чекбокса шапки по странице', () => {
    expect(pageState(EMPTY_SELECTION, ['a', 'b'])).toBe('none')
    expect(pageState({ mode: 'ids', ids: ['a'] }, ['a', 'b'])).toBe('some')
    expect(pageState({ mode: 'ids', ids: ['a', 'b', 'c'] }, ['a', 'b'])).toBe('all')
    expect(pageState({ mode: 'all', except: [] }, ['a', 'b'])).toBe('all')
    expect(pageState({ mode: 'all', except: ['a'] }, ['a', 'b'])).toBe('some')
    expect(pageState({ mode: 'all', except: ['a', 'b'] }, ['a', 'b'])).toBe('none')
    expect(pageState(EMPTY_SELECTION, [])).toBe('none')
  })
})
