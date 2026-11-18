import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimeField, type TimeFieldProps } from '../index'
import { renderK } from '../test/renderK'

type HarnessProps = Omit<TimeFieldProps, 'label' | 'value'> & { initial?: string }

function Controlled({ initial = '', onChange, ...props }: HarnessProps) {
  const [value, setValue] = useState(initial)
  return <TimeField {...props} label="Время" value={value} onChange={(next) => {
    setValue(next)
    onChange(next)
  }} />
}

describe('TimeField', () => {
  it('сохраняет размер s, минуты и вызывает onEnter', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onEnter = vi.fn()
    renderK(<Controlled onChange={onChange} onEnter={onEnter} />)
    const field = screen.getByRole('textbox', { name: 'Время' })

    expect(field).toHaveAttribute('placeholder', 'чч:мм')
    expect(field.parentElement).toHaveAttribute('data-size', 's')
    await user.type(field, '0930{Enter}')
    expect(field).toHaveValue('09:30')
    expect(onChange).toHaveBeenCalledExactlyOnceWith('09:30')
    expect(onEnter).toHaveBeenCalledTimes(1)
  })

  it('без onEnter отправляет форму по Enter', async () => {
    const submit = vi.fn()
    renderK(<form onSubmit={(event) => {
      event.preventDefault()
      submit()
    }}>
      <TimeField label="Время" value="09:30" onChange={vi.fn()} />
      <button type="submit">Сохранить</button>
    </form>)

    await userEvent.type(screen.getByRole('textbox', { name: 'Время' }), '{Enter}')
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('вводит секунды, сохраняет неполную строку и сбрасывает валидное значение только один раз', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderK(<Controlled seconds size="l" className="wide" initial="11:22:33" onChange={onChange} />)
    const field = screen.getByRole('textbox', { name: 'Время' })

    expect(field).toHaveAttribute('placeholder', 'чч:мм:сс')
    expect(field.parentElement).toHaveAttribute('data-size', 'l')
    expect(field.parentElement).toHaveClass('wide')
    await user.clear(field)
    await user.type(field, '23595')
    expect(field).toHaveValue('23:59:5')
    expect(onChange).toHaveBeenCalledExactlyOnceWith('')
    expect(field).not.toHaveAttribute('aria-invalid')

    await user.type(field, '9')
    expect(field).toHaveValue('23:59:59')
    expect(onChange.mock.calls).toEqual([[''], ['23:59:59']])
  })

  it.each([
    ['240000', '24:00:00'],
    ['006000', '00:60:00'],
    ['000060', '00:00:60'],
  ])('показывает невалидный черновик %s, сохраняя пустое значение', async (digits, draft) => {
    const onChange = vi.fn()
    renderK(<Controlled seconds onChange={onChange} />)
    const field = screen.getByRole('textbox', { name: 'Время' })

    await userEvent.type(field, digits)

    expect(field).toHaveValue(draft)
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('учитывает секунды нижней границы и пересчитывает набранное время при её сдвиге', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    const { rerender } = renderK(<Controlled seconds notBefore="10:20:30" onChange={onChange} />)
    const field = screen.getByRole('textbox', { name: 'Время' })

    await user.type(field, '102029')
    expect(field).toHaveValue('10:20:29')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(onChange).not.toHaveBeenCalled()
    await user.clear(field)
    await user.type(field, '102030')
    expect(onChange).toHaveBeenCalledExactlyOnceWith('10:20:30')
    expect(field).not.toHaveAttribute('aria-invalid')

    rerender(<Controlled seconds notBefore="10:20:31" onChange={onChange} />)
    expect(field).toHaveValue('10:20:30')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(onChange.mock.calls).toEqual([['10:20:30'], ['']])
  })

  it('заменяет черновик при внешней смене значения и не возвращает его при смене формата', async () => {
    const onChange = vi.fn()
    const fieldLabel = 'Время'
    const { rerender } = renderK(<TimeField label={fieldLabel} value="" seconds onChange={onChange} />)
    const field = screen.getByRole('textbox', { name: fieldLabel })
    await userEvent.type(field, '123')
    expect(field).toHaveValue('12:3')

    rerender(<TimeField label={fieldLabel} value="01:02:03" seconds onChange={onChange} />)
    expect(field).toHaveValue('01:02:03')
    rerender(<TimeField label={fieldLabel} value="" seconds onChange={onChange} />)
    await userEvent.type(field, '456')
    expect(field).toHaveValue('45:6')
    rerender(<TimeField label={fieldLabel} value="" onChange={onChange} />)
    expect(field).toHaveValue('')
    rerender(<TimeField label={fieldLabel} value="" seconds onChange={onChange} />)
    expect(field).toHaveValue('')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('не активирует недоступное поле', async () => {
    const onChange = vi.fn()
    const onEnter = vi.fn()
    renderK(<Controlled seconds disabled onChange={onChange} onEnter={onEnter} />)
    const field = screen.getByRole('textbox', { name: 'Время' })

    expect(field).toBeDisabled()
    await userEvent.type(field, '093000{Enter}')
    expect(onChange).not.toHaveBeenCalled()
    expect(onEnter).not.toHaveBeenCalled()
  })
})
