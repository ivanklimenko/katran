import { createRef } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IconButton } from '../index'
import { renderK } from '../test/renderK'

describe('IconButton', () => {
  it('рисует знак из каталога без второго доступного имени', async () => {
    const onClick = vi.fn()
    renderK(<IconButton name="edit" label="Правка" onClick={onClick} />)
    const button = screen.getByRole('button', { name: 'Правка' })
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(button).not.toHaveAttribute('name')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('сохраняет собственный знак, name, ref и атрибуты формы', async () => {
    const ref = createRef<HTMLButtonElement>()
    const onClick = vi.fn()
    renderK(<IconButton ref={ref} type="submit" disabled name="submit-action" label="Сохранить" onClick={onClick}><span>Свой знак</span></IconButton>)
    const button = screen.getByRole('button', { name: 'Сохранить' })
    expect(button).toHaveAttribute('name', 'submit-action')
    expect(button).toHaveAttribute('type', 'submit')
    expect(screen.getByText('Свой знак')).toBeInTheDocument()
    expect(ref.current).toBe(button)
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it.each([null, undefined])('сохраняет нативное name при children=%s', (children) => {
    renderK(<IconButton name="edit" label="Пустой знак" children={children} />)
    const button = screen.getByRole('button', { name: 'Пустой знак' })
    expect(button).toHaveAttribute('name', 'edit')
    expect(button.querySelector('svg')).toBeNull()
  })
})
