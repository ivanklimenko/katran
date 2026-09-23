import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Button } from './Button'
import { IconButton } from './IconButton'

describe('Button', () => {
  it('кнопка с именем, type=button по умолчанию, клик', async () => {
    const onClick = vi.fn()
    renderK(<Button onClick={onClick}>Применить</Button>)
    const b = screen.getByRole('button', { name: 'Применить' })
    expect(b).toHaveAttribute('type', 'button')
    await userEvent.click(b)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
  it('pressed → aria-pressed', () => {
    renderK(<Button pressed>Скелетоны</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })
  it('disabled не кликается', async () => {
    const onClick = vi.fn()
    renderK(<Button disabled onClick={onClick}>Нет</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('IconButton', () => {
  it('имя из label, иконка скрыта от скринридера', () => {
    renderK(<IconButton label="Открыть деталку"><svg data-testid="i" /></IconButton>)
    expect(screen.getByRole('button', { name: 'Открыть деталку' })).toBeInTheDocument()
    expect(screen.getByTestId('i').parentElement).toHaveAttribute('aria-hidden', 'true')
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<><Button>Ок</Button><IconButton label="Меню"><svg /></IconButton></>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
