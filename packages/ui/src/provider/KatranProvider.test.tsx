import { act, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { KatranProvider } from './KatranProvider'
import { useKatran } from './useKatran'

function Probe() {
  const k = useKatran()
  return (
    <div>
      <span data-testid="t">{k.theme}</span>
      <span data-testid="d">{k.density}</span>
      <button onClick={() => k.setTheme('dark')}>тёмная</button>
      <button onClick={() => k.setDensity(1.25)}>крупнее</button>
      <button onClick={() => k.announce('Скопировано')}>объявить</button>
    </div>
  )
}

describe('KatranProvider', () => {
  beforeEach(() => localStorage.clear())

  it('по умолчанию system и плотность 1; корень несёт переменную плотности', () => {
    const { container } = render(<KatranProvider><Probe /></KatranProvider>)
    expect(screen.getByTestId('t')).toHaveTextContent('system')
    expect(screen.getByTestId('d')).toHaveTextContent('1')
    const root = container.firstElementChild as HTMLElement
    expect(root.style.getPropertyValue('--k-density')).toBe('1')
    expect(root).not.toHaveAttribute('data-theme')
    expect(root).toHaveAttribute('data-k-root')
  })

  it('setTheme / setDensity меняют атрибуты и сохраняются по storageKey', () => {
    const { container } = render(<KatranProvider storageKey="t"><Probe /></KatranProvider>)
    act(() => screen.getByText('тёмная').click())
    act(() => screen.getByText('крупнее').click())
    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveAttribute('data-theme', 'dark')
    expect(root.style.getPropertyValue('--k-density')).toBe('1.25')
    expect(localStorage.getItem('t:theme')).toBe('dark')
    expect(localStorage.getItem('t:density')).toBe('1.25')
  })

  it('читает сохранённое при монтировании', () => {
    localStorage.setItem('t:density', '1.1')
    render(<KatranProvider storageKey="t"><Probe /></KatranProvider>)
    expect(screen.getByTestId('d')).toHaveTextContent('1.1')
  })

  it('управляемый режим: props важнее внутреннего состояния', () => {
    const { container } = render(<KatranProvider theme="light" density={1.1}><Probe /></KatranProvider>)
    act(() => screen.getByText('тёмная').click())
    expect(container.firstElementChild).toHaveAttribute('data-theme', 'light')
  })

  it('announce пишет в живую область', async () => {
    render(<KatranProvider><Probe /></KatranProvider>)
    await act(async () => {
      screen.getByText('объявить').click()
      await new Promise((r) => requestAnimationFrame(r))
    })
    expect(screen.getByRole('status')).toHaveTextContent('Скопировано')
  })

  it('без нарушений axe', async () => {
    const { container } = render(<KatranProvider><Probe /></KatranProvider>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
