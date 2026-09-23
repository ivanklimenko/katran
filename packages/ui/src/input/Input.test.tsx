import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Checkbox } from './Checkbox'
import { Input } from './Input'
import { Select } from './Select'

describe('Input', () => {
  it('ввод и aria-invalid', async () => {
    const onChange = vi.fn()
    renderK(<Input aria-label="Номер" invalid onChange={onChange} />)
    const i = screen.getByRole('textbox', { name: 'Номер' })
    expect(i).toHaveAttribute('aria-invalid', 'true')
    await userEvent.type(i, 'ab')
    expect(onChange).toHaveBeenCalledTimes(2)
  })
})

describe('Checkbox', () => {
  it('подпись даёт имя; indeterminate выставляется на элемент', () => {
    renderK(<Checkbox label="Выбрать все" indeterminate />)
    const c = screen.getByRole('checkbox', { name: 'Выбрать все' }) as HTMLInputElement
    expect(c.indeterminate).toBe(true)
  })
  it('без подписи className достаётся самому полю', () => {
    const { container } = renderK(<Checkbox className="own" aria-label="Одна запись" />)
    const c = container.querySelector('input')!
    expect(c).toHaveClass('own')
    expect(c).toHaveClass('checkbox')
  })
  it('переключается', async () => {
    const onChange = vi.fn()
    renderK(<Checkbox label="Один" onChange={onChange} />)
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

describe('Select', () => {
  it('опции и выбор', async () => {
    const onChange = vi.fn()
    renderK(<Select aria-label="Тип" options={[{ value: 'MT103', label: 'MT103' }, { value: 'MT202', label: 'MT202' }]} onChange={onChange} />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Тип' }), 'MT202')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('option', { name: 'MT202' })).toBeInTheDocument()
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<>
      <Input aria-label="a" /><Checkbox label="b" /><Select aria-label="c" options={[{ value: '1', label: '1' }]} />
    </>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
