import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TripleState, type TripleStateProps, type TripleStateValue } from '../index'
import { renderK } from '../test/renderK'

const hints = { unset: 'Не задано', on: 'Включено', off: 'Выключено' }

function Controlled({ onChange, ...props }: Pick<TripleStateProps, 'onChange' | 'disabled' | 'className'>) {
  const [value, setValue] = useState<TripleStateValue>('unset')
  return <TripleState {...props} label="Фильтр" icon="filter" hints={hints} value={value} onChange={(next) => {
    setValue(next)
    onChange(next)
  }} />
}

describe('TripleState', () => {
  it('переключает три состояния с одним значком и актуальным доступным описанием', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderK(<Controlled onChange={onChange} className="extra" />)
    const button = screen.getByRole('button', { name: 'Фильтр' })
    const icon = button.querySelector('svg')
    expect(button).toHaveClass('extra')
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveAttribute('data-size', 'm')
    expect(button).toHaveAttribute('data-state', 'unset')
    expect(button).toHaveAccessibleDescription('Не задано')
    expect(button).not.toHaveAttribute('aria-pressed')
    expect(icon).toHaveAttribute('aria-hidden', 'true')

    for (const next of ['on', 'off', 'unset'] as const) {
      await user.click(button)
      expect(button).toHaveAttribute('data-state', next)
      expect(button).toHaveAccessibleDescription(hints[next])
      expect(button.querySelector('svg')).toBe(icon)
    }
    expect(onChange.mock.calls).toEqual([['on'], ['off'], ['unset']])
  })

  it('активируется один раз на Space и Enter', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderK(<Controlled onChange={onChange} />)
    const button = screen.getByRole('button', { name: 'Фильтр' })
    await user.tab()
    expect(button).toHaveFocus()
    await user.keyboard(' {Enter}')
    expect(onChange.mock.calls).toEqual([['on'], ['off']])
    expect(button).toHaveAccessibleDescription('Выключено')
  })

  it('отключённая кнопка не переключается и пропускается при Tab', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderK(<><Controlled onChange={onChange} disabled /><button>Следующая</button></>)
    const button = screen.getByRole('button', { name: 'Фильтр' })
    expect(button).toBeDisabled()
    await user.click(button)
    await user.tab()
    expect(screen.getByRole('button', { name: 'Следующая' })).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
  })
})
