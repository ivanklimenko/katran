import { createRef, useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Textarea } from '../index'
import { renderK } from '../test/renderK'

describe('Textarea', () => {
  it('рендерит нативное поле в три строки с размером m и передаёт ref и класс', () => {
    const ref = createRef<HTMLTextAreaElement>()
    renderK(<><label htmlFor="comment">Комментарий</label><Textarea id="comment" name="comment" className="extra" ref={ref} /></>)
    const field = screen.getByRole('textbox', { name: 'Комментарий' })

    expect(field.tagName).toBe('TEXTAREA')
    expect(field).toHaveAttribute('rows', '3')
    expect(field).toHaveAttribute('data-size', 'm')
    expect(field).toHaveAttribute('name', 'comment')
    expect(field).toHaveClass('extra')
    expect(ref.current).toBe(field)
    ref.current?.focus()
    expect(field).toHaveFocus()
  })

  it('передаёт переносы строк через нативный onChange', async () => {
    const changed = vi.fn()
    function Controlled({ initial }: { initial: string }) {
      const [value, setValue] = useState(initial)
      return <Textarea aria-label="Комментарий" value={value} onChange={(event) => {
        changed(event.currentTarget.value)
        setValue(event.currentTarget.value)
      }} />
    }

    renderK(<Controlled initial="" />)
    const field = screen.getByRole('textbox', { name: 'Комментарий' })
    await userEvent.type(field, 'Первая{enter}Вторая')
    expect(changed).toHaveBeenLastCalledWith('Первая\nВторая')
    expect(field).toHaveValue('Первая\nВторая')
  })

  it('отражает внешнюю смену value на том же поле', () => {
    const { rerender } = renderK(<Textarea aria-label="Комментарий" value="Начало" readOnly />)
    const field = screen.getByRole('textbox', { name: 'Комментарий' })
    rerender(<Textarea aria-label="Комментарий" value={'Внешнее\nзначение'} readOnly />)

    expect(screen.getByRole('textbox')).toBe(field)
    expect(field).toHaveValue('Внешнее\nзначение')
  })

  it('отражает заданные rows, размер и invalid на поле', () => {
    renderK(<Textarea aria-label="Комментарий" size="s" rows={2} invalid aria-invalid={false} />)
    const field = screen.getByRole('textbox')

    expect(field).toHaveAttribute('rows', '2')
    expect(field).toHaveAttribute('data-size', 's')
    expect(field).toHaveAttribute('data-invalid', 'true')
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  it('сохраняет нативные aria-invalid, disabled и readOnly', () => {
    renderK(<Textarea aria-label="Комментарий" size="l" aria-invalid="grammar" disabled readOnly />)
    const field = screen.getByRole('textbox')

    expect(field).toHaveAttribute('data-size', 'l')
    expect(field).not.toHaveAttribute('data-invalid')
    expect(field).toHaveAttribute('aria-invalid', 'grammar')
    expect(field).toBeDisabled()
    expect(field).toHaveAttribute('readonly')
  })
})
