import { useState } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AmountField, type AmountFieldProps } from '../index'
import { renderK } from '../test/renderK'

type ControlledProps = Omit<AmountFieldProps, 'value' | 'label'> & { initial?: number | null }

function Controlled({ initial = null, onChange, ...props }: ControlledProps) {
  const [value, setValue] = useState(initial)
  return <AmountField {...props} label="Сумма" value={value} onChange={(next) => {
    setValue(next)
    onChange(next)
  }} />
}

describe('AmountField', () => {
  it('передаёт точное число, форматирует на blur и возвращает сырой ввод по фокусу', async () => {
    const user = userEvent.setup()
    const changed = vi.fn()
    renderK(<Controlled onChange={changed} />)
    const field = screen.getByRole('textbox', { name: 'Сумма' })

    await user.type(field, '-1000.5070')
    expect(field).toHaveValue('-1000.5070')
    expect(changed).toHaveBeenLastCalledWith(-1000.507)

    await user.tab()
    expect(field).toHaveValue('-1\u00a0000.51')
    const changes = changed.mock.calls.length
    await user.click(field)
    expect(field).toHaveValue('-1000.507')
    expect(changed).toHaveBeenCalledTimes(changes)
  })

  it('различает ноль и пустой ввод', async () => {
    const user = userEvent.setup()
    const changed = vi.fn()
    renderK(<Controlled onChange={changed} />)
    const field = screen.getByRole('textbox', { name: 'Сумма' })

    await user.type(field, '0')
    expect(changed).toHaveBeenLastCalledWith(0)
    await user.tab()
    expect(field).toHaveValue('0.00')
    await user.clear(field)
    expect(changed).toHaveBeenLastCalledWith(null)
    expect(field).toHaveValue('')
    expect(field).not.toHaveAttribute('aria-invalid')
  })

  it('оставляет нечисловой ввод на blur и при повторном рендере с тем же null', async () => {
    const user = userEvent.setup()
    const changed = vi.fn()
    const { rerender } = renderK(<Controlled onChange={changed} />)
    const field = screen.getByRole('textbox', { name: 'Сумма' })

    await user.type(field, '1e3')
    expect(changed).toHaveBeenLastCalledWith(null)
    expect(field).toHaveAttribute('aria-invalid', 'true')
    await user.tab()
    rerender(<Controlled onChange={changed} placeholder="Введите сумму" />)
    expect(field).toHaveValue('1e3')
    expect(field).toHaveAttribute('aria-invalid', 'true')

    await user.clear(field)
    await user.type(field, '2.5')
    expect(changed).toHaveBeenLastCalledWith(2.5)
    expect(field).not.toHaveAttribute('aria-invalid')
  })

  it('отбрасывает старый черновик при внешней смене значения даже во время редактирования', async () => {
    const changed = vi.fn()
    const { rerender } = renderK(<AmountField value={null} label="Сумма" onChange={changed} />)
    const field = screen.getByRole('textbox', { name: 'Сумма' })
    await userEvent.type(field, 'ошибка')
    expect(field).toHaveValue('ошибка')
    rerender(<AmountField value={1000.5} label="Сумма" onChange={changed} />)
    expect(field).toHaveValue('1000.5')
    expect(field).not.toHaveAttribute('aria-invalid')

    rerender(<AmountField value={null} label="Сумма" onChange={changed} />)
    expect(field).toHaveValue('')
  })

  it.each([NaN, Infinity, -Infinity])('показывает неконечное значение %s пустым и невалидным', (value) => {
    renderK(<AmountField value={value} label="Сумма" onChange={vi.fn()} />)
    const field = screen.getByRole('textbox', { name: 'Сумма' })

    expect(field).toHaveValue('')
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  it.each([-1, 101, 2.5, NaN])('использует обычную точность при неверном fraction=%s', (fraction) => {
    renderK(<AmountField value={1234.5} label="Сумма" fraction={fraction} onChange={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: 'Сумма' })).toHaveValue('1\u00a0234.50')
  })

  it('показывает малое внешнее число десятичной строкой на фокусе', async () => {
    renderK(<AmountField value={1e-7} label="Сумма" fraction={8} onChange={vi.fn()} />)
    const field = screen.getByRole('textbox', { name: 'Сумма' })
    expect(field).toHaveValue('0.00000010')

    await userEvent.click(field)
    expect(field).toHaveValue('0.0000001')
  })

  it('передаёт оформление и недоступность существующему Input', async () => {
    const changed = vi.fn()
    renderK(<AmountField label="Сумма" value={1000.5} onChange={changed} fraction={0} size="l"
      className="amount" placeholder="Сумма" disabled invalid />)
    const field = screen.getByRole('textbox', { name: 'Сумма' })

    expect(field).toBeDisabled()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAttribute('placeholder', 'Сумма')
    expect(field).toHaveAttribute('inputmode', 'decimal')
    expect(field).toHaveValue('1\u00a0001')
    expect(field.parentElement).toHaveClass('amount')
    expect(field.parentElement).toHaveAttribute('data-size', 'l')
    await userEvent.type(field, '123')
    expect(changed).not.toHaveBeenCalled()
  })

  it('сохраняет произвольный нечисловой текст и наружу отдаёт null', async () => {
    const changed = vi.fn()
    renderK(<Controlled onChange={changed} />)
    const field = screen.getByRole('textbox', { name: 'Сумма' })
    await userEvent.click(field)
    fireEvent.change(field, { target: { value: '0x10' } })
    expect(field).toHaveValue('0x10')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(changed).toHaveBeenLastCalledWith(null)
  })
})
