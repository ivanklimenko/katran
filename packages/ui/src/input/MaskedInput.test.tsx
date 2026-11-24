import { useState } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MaskedInput, type MaskedInputProps } from '../index'
import { renderK } from '../test/renderK'

function Controlled({ initial = '', mask = '99-99' }: { initial?: string; mask?: string }) {
  const [value, setValue] = useState(initial)
  return <>
    <MaskedInput label="Код" mask={mask} value={value} onChange={setValue} />
    <output aria-label="Значение">{value}</output>
  </>
}

const field = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Код' })
const value = () => screen.getByLabelText('Значение').textContent

describe('MaskedInput', () => {
  it('передаёт префикс с литералами и ограничивает длину маской', async () => {
    renderK(<Controlled mask="+99-99!" />)
    await userEvent.type(field(), '12')
    expect(value()).toBe('+12')
    await userEvent.type(field(), 'a345')
    expect(value()).toBe('+12-34')
    expect(field()).toHaveValue('+12-34')
    expect(field()).not.toHaveAttribute('aria-invalid')
  })

  it('раскладывает вставленные ASCII-цифры по слотам маски', async () => {
    const user = userEvent.setup()
    renderK(<Controlled mask="99-99-99" />)
    await user.click(field())
    await user.paste('1 2 / 34–５ 56')
    expect(value()).toBe('12-34-56')
  })

  it('Backspace у литерала удаляет предыдущий слот и восстанавливает каретку', async () => {
    const user = userEvent.setup()
    renderK(<Controlled initial="12-34" />)
    await user.click(field())
    field().setSelectionRange(3, 3)
    await user.keyboard('{Backspace}')
    expect(value()).toBe('13-4')
    expect(field().selectionStart).toBe(1)
  })

  it('Delete у литерала удаляет следующий слот', async () => {
    const user = userEvent.setup()
    renderK(<Controlled initial="12-34" />)
    await user.click(field())
    field().setSelectionRange(2, 2)
    await user.keyboard('{Delete}')
    expect(value()).toBe('12-4')
    expect(field().selectionStart).toBe(2)
  })

  it('при замене выделения сохраняет литерал-цифру и ставит каретку по слоту', async () => {
    const user = userEvent.setup()
    renderK(<Controlled mask="99~7~999" initial="12~7~345" />)
    await user.click(field())
    field().setSelectionRange(1, 6)
    await user.keyboard('8')
    expect(value()).toBe('18~7~45')
    expect(field().selectionStart).toBe(2)
  })

  it('вставляет цифры в выделение, сохраняя хвост и позицию каретки', async () => {
    const user = userEvent.setup()
    renderK(<Controlled initial="12-34" />)
    await user.click(field())
    field().setSelectionRange(1, 3)
    await user.paste('[8]')
    expect(value()).toBe('18-34')
    expect(field().selectionStart).toBe(2)
  })

  it('сохраняет выделенный текст при вставке без цифр', async () => {
    const user = userEvent.setup()
    renderK(<Controlled initial="12-34" />)
    await user.click(field())
    field().setSelectionRange(1, 3)
    await user.paste('')
    expect(value()).toBe('12-34')
    expect(field().selectionStart).toBe(1)
    expect(field().selectionEnd).toBe(3)
  })

  it('сохраняет значение и позицию при вводе символа, которого нет в маске', async () => {
    const user = userEvent.setup()
    renderK(<Controlled initial="12-34" />)
    await user.click(field())
    field().setSelectionRange(1, 1)
    await user.keyboard('a')
    expect(value()).toBe('12-34')
    expect(field().selectionStart).toBe(1)
  })

  it('сохраняет каретку в месте правки при отклонении правки родителем', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderK(<MaskedInput mask="99-99" label="Код" value="12-34" onChange={onChange} />)
    await user.click(field())
    field().setSelectionRange(1, 1)
    await user.keyboard('8')
    expect(onChange).toHaveBeenCalledWith('18-23')
    expect(field()).toHaveValue('12-34')
    expect(field().selectionStart).toBe(1)
  })

  it('сохраняет литерал-цифру при нативной подстановке уже отформатированного текста', () => {
    renderK(<Controlled mask="99-7-999" initial="12-7-345" />)
    fireEvent.input(field(), { target: { value: '82-7-345' }, inputType: 'insertReplacementText', data: null })
    expect(value()).toBe('82-7-345')
  })

  it('принимает внешнюю замену и передаёт параметры в Input', () => {
    const props: MaskedInputProps = { label: 'Код', mask: '99-99', value: '12', onChange: vi.fn() }
    const { rerender } = renderK(<MaskedInput {...props} />)
    rerender(<MaskedInput {...props} value="43-21" size="l" className="account" disabled invalid />)
    expect(field()).toHaveValue('43-21')
    expect(field()).toBeDisabled()
    expect(field()).toHaveAttribute('aria-invalid', 'true')
    expect(field().parentElement).toHaveClass('account')
    expect(field().parentElement).toHaveAttribute('data-size', 'l')
    expect(props.onChange).not.toHaveBeenCalled()
  })
})
