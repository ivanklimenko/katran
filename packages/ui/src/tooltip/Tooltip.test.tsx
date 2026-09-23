import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderK } from '../test/renderK'
import { Tooltip } from './Tooltip'

const setWidths = (el: HTMLElement, scroll: number, client: number) => {
  Object.defineProperty(el, 'scrollWidth', { value: scroll, configurable: true })
  Object.defineProperty(el, 'clientWidth', { value: client, configurable: true })
}

describe('Tooltip', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('показывается по наведению с задержкой, связан через aria-describedby, скрывается по уходу', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderK(<Tooltip content="Полное значение"><button>Кнопка</button></Tooltip>)
    const b = screen.getByRole('button')
    await user.hover(b)
    expect(screen.queryByRole('tooltip')).toBeNull()
    act(() => { vi.advanceTimersByTime(250) })
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveTextContent('Полное значение')
    expect(b).toHaveAttribute('aria-describedby', tip.id)
    await user.unhover(b)
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(b).not.toHaveAttribute('aria-describedby')
  })

  it('показывается по фокусу, прячется по Escape', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderK(<Tooltip content="Подсказка"><button>Кнопка</button></Tooltip>)
    await user.tab()
    act(() => { vi.advanceTimersByTime(250) })
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('when=truncated: только если текст обрезан', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- тестовый фокусируемый span, эмулирует реальный компонент значения (задача 10)
    renderK(<Tooltip content="Длинное" when="truncated"><span data-testid="v" tabIndex={0}>Длинное</span></Tooltip>)
    const v = screen.getByTestId('v')
    setWidths(v, 100, 100)
    await user.hover(v)
    act(() => { vi.advanceTimersByTime(250) })
    expect(screen.queryByRole('tooltip')).toBeNull()
    await user.unhover(v)
    setWidths(v, 200, 100)
    await user.hover(v)
    act(() => { vi.advanceTimersByTime(250) })
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })
})
