import { useRef } from 'react'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Popover } from '../overlay'
import { renderK } from '../test/renderK'
import { Tooltip } from './Tooltip'

/** Поповер держится открытым: проверяем именно слушателя тултипа, а не закрытие панели. */
function TipInPopover() {
  const a = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={a}>Якорь</button>
      <Popover open anchor={a} onClose={() => {}} label="Панель">
        <Tooltip content="Подсказка"><button>Внутри</button></Tooltip>
      </Popover>
    </>
  )
}

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

  it('Escape при открытом Popover прячет тултип', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderK(<TipInPopover />)
    const b = screen.getByRole('button', { name: 'Внутри' })
    await user.hover(b)
    act(() => { vi.advanceTimersByTime(250) })
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('цель удалена из DOM → тултип исчезает', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { rerender } = renderK(<Tooltip content="Подсказка"><button>Цель</button></Tooltip>)
    await user.hover(screen.getByRole('button', { name: 'Цель' }))
    act(() => { vi.advanceTimersByTime(250) })
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    rerender(<span>без цели</span>)
    await act(async () => {})
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
