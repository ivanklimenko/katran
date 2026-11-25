import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { KatranProvider, useToast } from '../index'
import { renderK } from '../test/renderK'

function Commands() {
  const { show, close } = useToast()
  return <>
    <button type="button" onClick={() => {
      show({ text: 'Обычное' })
      show({ text: 'Успех', tone: 'ok', duration: 0 })
      show({ text: 'Предупреждение', tone: 'warn', duration: 0 })
      show({ text: 'Ошибка', tone: 'bad', duration: 0 })
      show({ text: 'Пятое', duration: 100 })
    }}>Показать пять</button>
    <button type="button" onClick={() => {
      for (const text of ['A', 'B', 'C', 'D']) show({ text, duration: 0 })
      const queued = show({ text: 'Снять из очереди', duration: 0 })
      show({ text: 'Следующее', duration: 0 })
      close(queued)
    }}>Пропустить ожидающее</button>
  </>
}

const regions = () => [...document.querySelectorAll<HTMLElement>('[data-part="toasts"]')]
const region = () => regions()[0]!
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

describe('useToast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('монтирует четыре тона в очереди и держит кнопки вне текста статуса', () => {
    renderK(<Commands />)
    expect(region()).toHaveAttribute('aria-live', 'polite')
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    click('Показать пять')
    expect(within(region()).getAllByRole('status').map((node) => node.textContent)).toEqual(['Обычное', 'Успех'])
    expect(within(region()).getAllByRole('alert').map((node) => node.textContent)).toEqual(['Предупреждение', 'Ошибка'])
    expect(within(region()).getAllByRole('button', { name: 'Закрыть' })).toHaveLength(4)
    expect(screen.queryByText('Пятое')).not.toBeInTheDocument()
    expect(within(region()).getByText('Ошибка')).not.toContainElement(within(region()).getAllByRole('button')[3]!)
  })

  it('запускает таймер ожидающего тоста только после показа', () => {
    renderK(<Commands />)
    click('Показать пять')
    act(() => { vi.advanceTimersByTime(3999) })
    expect(screen.getByText('Обычное')).toBeInTheDocument()
    expect(screen.queryByText('Пятое')).not.toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.queryByText('Обычное')).not.toBeInTheDocument()
    expect(screen.getByText('Пятое')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(99) })
    expect(screen.getByText('Пятое')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.queryByText('Пятое')).not.toBeInTheDocument()
    expect(screen.getByText('Успех')).toBeInTheDocument()
  })

  it('удаляет ожидающий тост по ID и продвигает следующий при закрытии видимого', () => {
    renderK(<Commands />)
    click('Пропустить ожидающее')
    const notices = () => within(region()).getAllByRole('status').map((node) => node.textContent)
    expect(notices()).toEqual(['A', 'B', 'C', 'D'])
    fireEvent.click(within(region()).getAllByRole('button', { name: 'Закрыть' })[1]!)
    expect(notices()).toEqual(['A', 'C', 'D', 'Следующее'])
  })

  it('изолирует ID и очередь каждого провайдера и закрывает видимый тост по ID', () => {
    let first = ''
    let second = ''
    function Scope({ name }: { name: string }) {
      const toast = useToast()
      return <button type="button" onClick={() => {
        if (name === 'Первый') first = toast.show({ text: name, duration: 0 })
        else {
          second = toast.show({ text: name, duration: 0 })
          toast.close(first)
        }
      }}>{name}</button>
    }
    function CloseSecond() {
      const toast = useToast()
      return <button type="button" onClick={() => toast.close(second)}>Снять второй</button>
    }
    render(<><KatranProvider><Scope name="Первый" /></KatranProvider>
      <KatranProvider><Scope name="Второй" /><CloseSecond /></KatranProvider></>)
    click('Первый')
    click('Второй')
    const [left, right] = regions()
    expect(first).not.toBe(second)
    expect(within(left!).getByRole('status')).toHaveTextContent('Первый')
    expect(within(right!).getByRole('status')).toHaveTextContent('Второй')
    click('Снять второй')
    expect(within(right!).queryByRole('status')).not.toBeInTheDocument()
    expect(within(left!).getByRole('status')).toHaveTextContent('Первый')
  })

  it('отменяет таймер при закрытии и размонтировании', () => {
    const { unmount } = renderK(<Commands />)
    click('Показать пять')
    fireEvent.click(within(region()).getAllByRole('button', { name: 'Закрыть' })[0]!)
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('сообщает об отсутствии KatranProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => render(<Commands />)).toThrow('useToast: требуется KatranProvider')
    } finally {
      consoleError.mockRestore()
    }
  })
})
