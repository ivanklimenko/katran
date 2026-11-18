import { useState } from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AmountRange, NumberRange, type AmountRangeValue, type NumberRangeValue } from '../index'
import { renderK } from '../test/renderK'

describe('AmountRange', () => {
  it('форматирует границы и сохраняет второе поле при вводе, очистке и ошибке первого', async () => {
    const changed = vi.fn()
    function Controlled() {
      const [value, setValue] = useState<AmountRangeValue>({ from: -1000.5, to: 2500 })
      return <AmountRange label="Сумма" value={value} onChange={(next) => {
        changed(next)
        setValue(next)
      }} />
    }
    const user = userEvent.setup()
    renderK(<Controlled />)
    const group = screen.getByRole('group', { name: 'Сумма' })
    const from = within(group).getByRole('textbox', { name: 'От' })
    const to = within(group).getByRole('textbox', { name: 'До' })

    expect(from).toHaveValue('-1\u00a0000.50')
    expect(to).toHaveValue('2\u00a0500.00')
    await user.click(from)
    expect(from).toHaveValue('-1000.5')
    await user.clear(from)
    expect(changed).toHaveBeenLastCalledWith({ from: null, to: 2500 })
    await user.type(from, 'некорректно')
    expect(changed).toHaveBeenLastCalledWith({ from: null, to: 2500 })
    await user.tab()
    expect(from).toHaveValue('некорректно')
    expect(from).toHaveAttribute('aria-invalid', 'true')
    expect(to).not.toHaveAttribute('aria-invalid')
  })

  it('передаёт обратный диапазон в исходном порядке и отмечает обе границы', async () => {
    const changed = vi.fn()
    function Controlled() {
      const [value, setValue] = useState<AmountRangeValue>({ from: null, to: 2 })
      return <AmountRange label="Сумма" value={value} onChange={(next) => {
        changed(next)
        setValue(next)
      }} />
    }
    renderK(<Controlled />)
    const from = screen.getByRole('textbox', { name: 'От' })
    const to = screen.getByRole('textbox', { name: 'До' })
    expect(to).not.toHaveAttribute('aria-invalid')

    await userEvent.type(from, '3')
    expect(changed).toHaveBeenLastCalledWith({ from: 3, to: 2 })
    expect(from).toHaveAttribute('aria-invalid', 'true')
    expect(to).toHaveAttribute('aria-invalid', 'true')
  })

  it('применяет размер, fraction, disabled и внешнюю ошибку к обеим границам', () => {
    renderK(<AmountRange label="Сумма" value={{ from: 1000.5, to: 2000 }} onChange={vi.fn()}
      className="limits" size="s" fraction={0} disabled invalid />)
    const group = screen.getByRole('group', { name: 'Сумма' })
    expect(group).toHaveClass('limits')
    const [from, to] = within(group).getAllByRole('textbox')
    expect(from).toHaveValue('1\u00a0001')
    expect(to).toHaveValue('2\u00a0000')
    for (const field of within(group).getAllByRole('textbox')) {
      expect(field).toBeDisabled()
      expect(field).toHaveAttribute('aria-invalid', 'true')
      expect(field.parentElement).toHaveAttribute('data-size', 's')
    }
  })
})

describe('NumberRange', () => {
  it('сохраняет нативные поля с шагом и передаёт число, null и нетронутую границу', () => {
    const changed = vi.fn()
    function Controlled() {
      const [value, setValue] = useState<NumberRangeValue>({ from: 1000.5, to: null })
      return <NumberRange label="Количество" value={value} step={0.5} onChange={(next) => {
        changed(next)
        setValue(next)
      }} />
    }
    renderK(<Controlled />)
    const group = screen.getByRole('group', { name: 'Количество' })
    const from = within(group).getByRole('spinbutton', { name: 'От' })
    const to = within(group).getByRole('spinbutton', { name: 'До' })
    expect(from).toHaveAttribute('type', 'number')
    expect(from).toHaveAttribute('step', '0.5')
    expect(to).toHaveAttribute('step', '0.5')
    expect(from).toHaveValue(1000.5)
    expect((from as HTMLInputElement).value).toBe('1000.5')
    expect(to).toHaveValue(null)

    fireEvent.change(to, { target: { value: '0' } })
    expect(changed).toHaveBeenLastCalledWith({ from: 1000.5, to: 0 })
    for (const field of [from, to]) expect(field).toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(from, { target: { value: '' } })
    expect(changed).toHaveBeenLastCalledWith({ from: null, to: 0 })
    for (const field of [from, to]) expect(field).not.toHaveAttribute('aria-invalid')
  })

  it('использует шаг 1 по умолчанию и отображает неконечную внешнюю границу пустой', () => {
    renderK(<NumberRange label="Количество" value={{ from: Infinity, to: 20 }} onChange={vi.fn()} />)
    const from = screen.getByRole('spinbutton', { name: 'От' })
    const to = screen.getByRole('spinbutton', { name: 'До' })
    expect(from).toHaveValue(null)
    expect(to).toHaveValue(20)
    for (const field of [from, to]) {
      expect(field).toHaveAttribute('step', '1')
      expect(field).not.toHaveAttribute('aria-invalid')
    }
  })

  it('ставит className на группу, а disabled и внешнюю ошибку на оба поля', () => {
    renderK(<NumberRange label="Количество" value={{ from: null, to: null }} onChange={vi.fn()}
      className="limits" size="l" disabled invalid />)
    const group = screen.getByRole('group', { name: 'Количество' })
    expect(group).toHaveClass('limits')
    for (const field of within(group).getAllByRole('spinbutton')) {
      expect(field).toBeDisabled()
      expect(field).toHaveAttribute('aria-invalid', 'true')
      expect(field.parentElement).toHaveAttribute('data-size', 'l')
    }
  })
})
