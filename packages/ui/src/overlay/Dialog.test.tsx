import { useState } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { Button } from '../button'
import { renderK } from '../test/renderK'
import { Dialog } from './Dialog'

const Footer = ({ onClose }: { onClose: () => void }) => (
  <>
    <Button>Скопировать</Button>
    <Button onClick={onClose}>Закрыть</Button>
  </>
)

describe('Dialog (спека 2e §2.1)', () => {
  it('open=false — ничего', () => {
    renderK(<Dialog open={false} title="Окно" onClose={vi.fn()}>Текст</Dialog>)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('role="dialog", aria-modal="true", имя — из title; тело и footer внутри окна', () => {
    renderK(<Dialog open title="Исходное сообщение" onClose={vi.fn()} footer={<Footer onClose={vi.fn()} />}>Текст окна</Dialog>)
    const d = screen.getByRole('dialog', { name: 'Исходное сообщение' })
    expect(d).toHaveAttribute('aria-modal', 'true')
    expect(d).toHaveTextContent('Текст окна')
    expect(d).toContainElement(screen.getByRole('button', { name: 'Закрыть' }))
  })

  it('role="alertdialog" передаётся', () => {
    renderK(<Dialog open role="alertdialog" title="Подтвердите" onClose={vi.fn()}>Текст</Dialog>)
    expect(screen.getByRole('alertdialog', { name: 'Подтвердите' })).toHaveAttribute('aria-modal', 'true')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('при открытии фокус — на первом фокусируемом; initialFocus — на заданном', () => {
    const { rerender } = renderK(<Dialog open title="Окно" onClose={vi.fn()} footer={<Footer onClose={vi.fn()} />}>Текст</Dialog>)
    expect(screen.getByRole('button', { name: 'Скопировать' })).toHaveFocus()
    rerender(<Dialog open={false} title="Окно" onClose={vi.fn()}>Текст</Dialog>)
    rerender(
      <Dialog open title="Окно" onClose={vi.fn()} footer={<Footer onClose={vi.fn()} />}
        initialFocus={() => screen.getByRole('button', { name: 'Закрыть' })}>Текст</Dialog>,
    )
    expect(screen.getByRole('button', { name: 'Закрыть' })).toHaveFocus()
  })

  it('Tab с последнего фокусируемого — на первый, Shift+Tab с первого — на последний', async () => {
    renderK(
      <>
        <button>До</button>
        <Dialog open title="Окно" onClose={vi.fn()} footer={<Footer onClose={vi.fn()} />}>
          <input aria-label="Поиск" />
        </Dialog>
        <button>После</button>
      </>,
    )
    const field = screen.getByRole('textbox', { name: 'Поиск' })
    const close = screen.getByRole('button', { name: 'Закрыть' })
    expect(field).toHaveFocus()
    close.focus()
    await userEvent.tab()
    expect(field).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(close).toHaveFocus()
  })

  it('ссылка в теле окна — в ловушке Tab', async () => {
    renderK(
      <Dialog open title="Окно" onClose={vi.fn()} footer={<Footer onClose={vi.fn()} />}>
        <a href="#doc">Документ</a>
      </Dialog>,
    )
    const link = screen.getByRole('link', { name: 'Документ' })
    expect(link).toHaveFocus()
    screen.getByRole('button', { name: 'Закрыть' }).focus()
    await userEvent.tab()
    expect(link).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Скопировать' })).toHaveFocus()
  })

  it('ссылка с tabindex="-1" — не в ловушке: ни первый фокус, ни остановка Tab', async () => {
    renderK(
      <Dialog open title="Окно" onClose={vi.fn()} footer={<Footer onClose={vi.fn()} />}>
        <a href="#doc" tabIndex={-1}>Документ</a>
      </Dialog>,
    )
    const copy = screen.getByRole('button', { name: 'Скопировать' })
    expect(copy).toHaveFocus()
    screen.getByRole('button', { name: 'Закрыть' }).focus()
    await userEvent.tab()
    expect(copy).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Закрыть' })).toHaveFocus()
  })

  it('Esc → onClose один раз, обработчик keydown на родителе не вызван', async () => {
    const onClose = vi.fn()
    const parent = vi.fn()
    renderK(<div role="presentation" onKeyDown={parent}><Dialog open title="Окно" onClose={onClose} footer={<Footer onClose={onClose} />}>Текст</Dialog></div>)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(parent).not.toHaveBeenCalled()
  })

  it('mousedown по подложке → onClose; по окну — нет', () => {
    const onClose = vi.fn()
    const { container } = renderK(<Dialog open title="Окно" onClose={onClose}>Текст</Dialog>)
    fireEvent.mouseDown(screen.getByRole('dialog'))
    fireEvent.mouseDown(screen.getByText('Текст'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseDown(container.querySelector('[data-k-dialog]') as Element)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('busy — aria-busy="true"; Esc и подложка не вызывают onClose, Esc не всплывает', async () => {
    const onClose = vi.fn()
    const parent = vi.fn()
    const { container } = renderK(
      <div role="presentation" onKeyDown={parent}>
        <Dialog open busy title="Окно" onClose={onClose} footer={<Footer onClose={onClose} />}>Текст</Dialog>
      </div>,
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true')
    await userEvent.keyboard('{Escape}')
    fireEvent.mouseDown(container.querySelector('[data-k-dialog]') as Element)
    expect(onClose).not.toHaveBeenCalled()
    expect(parent).not.toHaveBeenCalled()
  })

  it('без busy — aria-busy нет', () => {
    renderK(<Dialog open title="Окно" onClose={vi.fn()}>Текст</Dialog>)
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-busy')
  })

  it('закрытие возвращает фокус на кнопку, открывшую окно', async () => {
    function Host() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Исходное сообщение</button>
          <Dialog open={open} title="Окно" onClose={() => setOpen(false)} footer={<Footer onClose={() => setOpen(false)} />}>Текст</Dialog>
        </>
      )
    }
    renderK(<Host />)
    await userEvent.click(screen.getByRole('button', { name: 'Исходное сообщение' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Исходное сообщение' })).toHaveFocus()
  })

  it('открывшей кнопки нет в DOM — фокус на fallbackFocus()', async () => {
    function Host() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button id="lane">Лейн</button>
          {!open && <button onClick={() => setOpen(true)}>Аннулировать</button>}
          <Dialog open={open} title="Окно" onClose={() => setOpen(false)} fallbackFocus={() => document.getElementById('lane')}
            footer={<Footer onClose={() => setOpen(false)} />}>Текст</Dialog>
        </>
      )
    }
    renderK(<Host />)
    await userEvent.click(screen.getByRole('button', { name: 'Аннулировать' }))
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Лейн' })).toHaveFocus()
  })

  it('tone и size — data-атрибуты окна; по умолчанию neutral и m', () => {
    const { rerender } = renderK(<Dialog open title="Окно" onClose={vi.fn()}>Текст</Dialog>)
    expect(screen.getByRole('dialog')).toHaveAttribute('data-tone', 'neutral')
    expect(screen.getByRole('dialog')).toHaveAttribute('data-size', 'm')
    rerender(<Dialog open tone="danger" size="l" title="Окно" onClose={vi.fn()}>Текст</Dialog>)
    expect(screen.getByRole('dialog')).toHaveAttribute('data-tone', 'danger')
    expect(screen.getByRole('dialog')).toHaveAttribute('data-size', 'l')
  })

  it('axe без нарушений', async () => {
    const { container } = renderK(<Dialog open title="Окно" onClose={vi.fn()} footer={<Footer onClose={vi.fn()} />}>Текст</Dialog>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
