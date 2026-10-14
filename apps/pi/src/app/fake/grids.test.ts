import type { SearchBody } from '../../shared/api'
import { createFakeGrids } from './grids'

/** Число документов грида фейка: totalElements первой страницы поиска без фильтра. */
const totalOf = (grid: string): number => {
  const body: SearchBody = { filter: { conditions: [] }, sort: [], page: { number: 0, size: 1 }, includeTotal: true }
  return (createFakeGrids()[grid]!.search(body) as { page: { totalElements: number } }).page.totalElements
}

describe('регулятор стенда ?docs=N — размер набора фейка', () => {
  afterEach(() => { history.replaceState(null, '', '/') })

  it('без параметра — по 87 валютных и рублёвых документов', () => {
    expect(totalOf('fx-docs')).toBe(87)
    expect(totalOf('rub-docs')).toBe(87)
  })
  it('?docs=500 — по 500 документов', () => {
    history.replaceState(null, '', '/?docs=500')
    expect(totalOf('fx-docs')).toBe(500)
    expect(totalOf('rub-docs')).toBe(500)
  })
})
