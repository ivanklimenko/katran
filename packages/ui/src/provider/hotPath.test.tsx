import { render, screen } from '@testing-library/react'
import { styled } from '../styled'
import { KatranProvider } from './KatranProvider'
import { CopyValue } from '../value/CopyValue'

/** Текст всех листов styled-components документа (в тестах — текстовые узлы, без CSSOM). */
const sheet = () => [...document.querySelectorAll('style[data-styled]')].map((n) => n.textContent ?? '').join('\n')

/** Сколько раз подстрока встречается в листе. */
const count = (s: string) => sheet().split(s).length - 1

/** Класс корня провайдера, которым адресованы его правила (в т. ч. горячий путь под :where(.<класс>)). */
function rootClass(root: Element) {
  const cls = [...root.classList].find((c) => sheet().includes(`:where(.${c}) .k-copy`))
  if (!cls) throw new Error('у корня нет класса, под которым объявлен горячий путь')
  return cls
}

// Переопределение горячего пути так, как это сделает потребитель: styled(Компонент), равная специфичность (0,1,0).
// rgb() в шаблонах запрещён ради токенов; здесь это проверочное значение, не цвет интерфейса.
const Recolored = styled(CopyValue)`
  /* stylelint-disable-next-line declaration-property-value-disallowed-list */
  color: rgb(1 2 3);
`
const RECOLORED = 'rgb(1, 2, 3)'

describe('горячий путь — правила в шаблоне корня провайдера (R16)', () => {
  it('stylis раскрывает :where(&): правила k-* под :where(.<класс корня>), по одному разу на группу корня', () => {
    const { container } = render(<KatranProvider><CopyValue value="x" /></KatranProvider>)
    const cls = rootClass(container.firstElementChild!)
    expect(count(`:where(.${cls}) .k-copy,`)).toBe(1) // первое правило .k-copy, .k-link
    expect(sheet()).toContain(`:where(.${cls}) .k-record:where([data-selected]) > tr > td`)
    expect(sheet()).not.toContain('&')
  })

  it('два провайдера — правила горячего пути в листе один раз, не на каждый провайдер', () => {
    const { container } = render(<><KatranProvider><CopyValue value="a" /></KatranProvider><KatranProvider><CopyValue value="b" /></KatranProvider></>)
    const [a, b] = [...container.children]
    const cls = rootClass(a!)
    expect(rootClass(b!)).toBe(cls)
    expect(count(`:where(.${cls}) .k-copy,`)).toBe(1)
  })

  it('второй провайдер переживает первый: после размонтирования первого правила горячего пути остаются', () => {
    const first = render(<KatranProvider><CopyValue value="a" /></KatranProvider>)
    const second = render(<KatranProvider><CopyValue value="b" /></KatranProvider>)
    first.unmount()
    expect(count(') .k-copy,')).toBeGreaterThan(0)
    expect(getComputedStyle(screen.getByRole('button', { name: 'b' })).color).toBe('var(--k-val)')
    second.unmount()
  })

  it('styled(CopyValue) потребителя перебивает горячий путь при двух провайдерах', () => {
    render(<KatranProvider><Recolored value="a" /><KatranProvider><Recolored value="b" /></KatranProvider></KatranProvider>)
    const a = screen.getByRole('button', { name: 'a' })
    expect(a).toHaveClass('k-copy')
    expect(getComputedStyle(a).color).toBe(RECOLORED)
    expect(getComputedStyle(screen.getByRole('button', { name: 'b' })).color).toBe(RECOLORED)
  })

  it('styled(CopyValue) потребителя перебивает горячий путь и после повторного монтирования провайдера', () => {
    const first = render(<KatranProvider><Recolored value="до" /></KatranProvider>)
    first.unmount()
    render(<KatranProvider><Recolored value="после" /></KatranProvider>)
    expect(getComputedStyle(screen.getByRole('button', { name: 'после' })).color).toBe(RECOLORED)
  })
})
