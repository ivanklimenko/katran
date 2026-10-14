import { render } from '@testing-library/react'
import { KatranProvider } from './KatranProvider'
import { CopyValue } from '../value/CopyValue'

/** Текст всех листов styled-components документа (в тестах — текстовые узлы, без CSSOM). */
const sheet = () => [...document.querySelectorAll('style[data-styled]')].map((n) => n.textContent ?? '').join('\n')

/** Сколько раз в листе встречается правило с селектором горячего пути (селектор — до «{» или «,»). */
const count = (selector: string) => sheet().split(selector).length - 1

describe('HotStyles — стили горячего пути под корнем провайдера', () => {
  it('провайдер монтирует правила горячего пути с префиксом корня', () => {
    render(<KatranProvider><CopyValue value="x" /></KatranProvider>)
    expect(sheet()).toContain(':where([data-k-root]) .k-copy')
    expect(sheet()).toContain(':where([data-k-root]) .k-record')
  })

  it('второй провайдер переживает первый: после размонтирования первого правила горячего пути остаются', () => {
    const first = render(<KatranProvider><CopyValue value="a" /></KatranProvider>)
    const second = render(<KatranProvider><CopyValue value="b" /></KatranProvider>)
    expect(count(':where([data-k-root]) .k-copy')).toBeGreaterThan(0)
    first.unmount()
    expect(count(':where([data-k-root]) .k-copy')).toBeGreaterThan(0)
    second.unmount()
  })
})
