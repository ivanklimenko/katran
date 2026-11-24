import { Highlight } from '../index'
import { renderK } from '../test/renderK'

describe('Highlight', () => {
  it.each(['', 'a', '💳', 'нет'])('оставляет текст без обёрток для запроса %j', (query) => {
    const text = '💳 aAaAa'
    const { getByTestId } = renderK(<div data-testid="text"><Highlight text={text} query={query} /></div>)
    const target = getByTestId('text')
    expect(target.textContent).toBe(text)
    expect(target.children).toHaveLength(0)
  })

  it('сохраняет исходный Unicode и регистр во всех совпадениях', () => {
    const text = 'İ💳 СВИФТ, свифт и СвИфТ'
    const { getByTestId } = renderK(<div data-testid="text"><Highlight text={text} query="свифт" className="match" /></div>)
    const target = getByTestId('text')
    const marks = [...target.querySelectorAll('mark')]
    expect(target.textContent).toBe(text)
    expect(marks.map((mark) => mark.textContent)).toEqual(['СВИФТ', 'свифт', 'СвИфТ'])
    for (const mark of marks) {
      expect(mark).toHaveClass('k-hl', 'match')
      expect(mark).not.toHaveAttribute('role')
    }
  })

  it.each([
    ['A.B AxB a.b', 'a.b', ['A.B', 'a.b']],
    ['[a]+\\ [A]+\\ (a)', '[a]+\\', ['[a]+\\', '[A]+\\']],
    ['aaaaa', 'aa', ['aa', 'aa']],
  ] as const)('отмечает буквальные непересекающиеся совпадения в %j', (text, query, matches) => {
    const { getByTestId } = renderK(<div data-testid="text"><Highlight text={text} query={query} /></div>)
    const target = getByTestId('text')
    expect(target.textContent).toBe(text)
    expect([...target.querySelectorAll('mark')].map((mark) => mark.textContent)).toEqual(matches)
  })
})
