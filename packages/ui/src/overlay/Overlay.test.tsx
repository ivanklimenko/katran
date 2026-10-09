import { useRef, useState } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Dialog } from './Dialog'
import { Menu, type MenuItem } from './Menu'
import { Popover } from './Popover'

function PopoverHost({ prompt = false, dialog = false }: { prompt?: boolean; dialog?: boolean }) {
  const [open, setOpen] = useState(false)
  const a = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={a} onClick={() => setOpen(true)}>Открыть</button>
      <button>Снаружи</button>
      {prompt && <div data-k-dialog=""><button>Продолжить правку</button></div>}
      {dialog && <Dialog open title="Исходное сообщение" onClose={() => undefined} footer={<button>Скопировать</button>}>Текст</Dialog>}
      <Popover open={open} anchor={a} onClose={() => setOpen(false)} label="Панель">
        <input aria-label="Поле" />
      </Popover>
    </>
  )
}

function ReturnFocusHost() {
  const [open, setOpen] = useState(false)
  const a = useRef<HTMLSpanElement>(null)
  const f = useRef<HTMLInputElement>(null)
  return (
    <>
      <span ref={a}>
        <input ref={f} aria-label="Поле-якорь" />
        <button onClick={() => setOpen(true)}>Открыть</button>
      </span>
      <Popover open={open} anchor={a} returnFocus={f} onClose={() => setOpen(false)} label="Панель">
        <input aria-label="Поле" />
      </Popover>
    </>
  )
}

function PresentationHost({ open }: { open: boolean }) {
  const a = useRef<HTMLInputElement>(null)
  return (
    <>
      <input ref={a} aria-label="Комбобокс" />
      <button>Снаружи</button>
      <Popover open={open} anchor={a} onClose={() => {}} label="Варианты" role="presentation">
        <button>Внутри</button>
      </Popover>
    </>
  )
}

function MenuHost({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const a = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={a} onClick={() => setOpen(true)}>Меню</button>
      <Menu open={open} anchor={a} onClose={() => setOpen(false)} items={items} title="Сортировать по" />
    </>
  )
}

/** Окно открывается позже поповера (с клавиатуры, из другого места страницы): фокус уходит в окно. */
function LaterDialogHost({ role }: { role?: 'dialog' | 'presentation' }) {
  const [open, setOpen] = useState(false)
  const [win, setWin] = useState(false)
  const a = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={a} onClick={() => setOpen(true)}>Открыть</button>
      <button onClick={() => setWin(true)}>Окно</button>
      {win && <Dialog open title="Исходное сообщение" onClose={() => setWin(false)} footer={<button>Закрыть окно</button>}>Текст</Dialog>}
      <Popover open={open} anchor={a} onClose={() => setOpen(false)} label="Панель" role={role}>
        <button>Внутри</button>
      </Popover>
    </>
  )
}

describe('Popover', () => {
  it('открывается с фокусом внутрь, закрывается по Escape с возвратом фокуса', async () => {
    renderK(<PopoverHost />)
    await userEvent.click(screen.getByText('Открыть'))
    expect(screen.getByRole('dialog', { name: 'Панель' })).toBeInTheDocument()
    expect(screen.getByLabelText('Поле')).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Открыть')).toHaveFocus()
  })
  it('закрывается кликом снаружи', async () => {
    renderK(<PopoverHost />)
    await userEvent.click(screen.getByText('Открыть'))
    await userEvent.click(screen.getByText('Снаружи'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('pointerdown и Esc внутри слоя окна ([data-k-dialog]) — не «снаружи»: окно решает само, поповер открыт', async () => {
    renderK(<PopoverHost prompt />)
    await userEvent.click(screen.getByText('Открыть'))
    const inPrompt = screen.getByRole('button', { name: 'Продолжить правку' })
    fireEvent.pointerDown(inPrompt)
    fireEvent.keyDown(inPrompt, { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: 'Панель' })).toBeInTheDocument()
    fireEvent.pointerDown(screen.getByText('Снаружи'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('открытый Dialog поверх: mousedown/pointerdown внутри окна не закрывают поповер, Esc в окне — тоже', async () => {
    renderK(<PopoverHost dialog />)
    fireEvent.click(screen.getByText('Открыть'))
    expect(screen.getByRole('dialog', { name: 'Панель' })).toBeInTheDocument()
    const inDialog = screen.getByRole('button', { name: 'Скопировать' })
    fireEvent.pointerDown(inDialog)
    fireEvent.mouseDown(inDialog)
    fireEvent.pointerDown(screen.getByRole('dialog', { name: 'Исходное сообщение' }))
    fireEvent.keyDown(inDialog, { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: 'Панель' })).toBeInTheDocument()
  })
  it('фокус ушёл в окно, открытое поверх ([data-k-dialog]), — поповер закрывается и над подложкой окна не остаётся; список комбобокса (presentation) — нет', async () => {
    const { unmount } = renderK(<LaterDialogHost />)
    fireEvent.click(screen.getByText('Открыть'))
    expect(screen.getByRole('dialog', { name: 'Панель' })).toBeInTheDocument()
    // с клавиатуры: Enter на кнопке вне поповера, окно забирает фокус
    fireEvent.click(screen.getByText('Окно'))
    const win = screen.getByRole('dialog', { name: 'Исходное сообщение' })
    expect(win.contains(document.activeElement)).toBe(true)
    expect(screen.queryByRole('dialog', { name: 'Панель' })).toBeNull()
    // фокус остался в окне — закрытие поповера его не отнимает
    expect(win.contains(document.activeElement)).toBe(true)
    unmount()

    renderK(<LaterDialogHost role="presentation" />)
    fireEvent.click(screen.getByText('Открыть'))
    fireEvent.click(screen.getByText('Окно'))
    expect(screen.getByText('Внутри')).toBeInTheDocument()
  })
  it('поповер внутри окна: фокус на другом элементе того же окна поповер не закрывает', () => {
    function InDialog() {
      const [open, setOpen] = useState(false)
      const a = useRef<HTMLButtonElement>(null)
      return (
        <Dialog open title="Окно" onClose={() => undefined} footer={<button>Другая кнопка</button>}>
          <button ref={a} onClick={() => setOpen(true)}>Открыть</button>
          <Popover open={open} anchor={a} onClose={() => setOpen(false)} label="Панель"><button>Внутри</button></Popover>
        </Dialog>
      )
    }
    renderK(<InDialog />)
    fireEvent.click(screen.getByText('Открыть'))
    screen.getByText('Открыть').focus()
    screen.getByText('Другая кнопка').focus()
    expect(screen.getByRole('dialog', { name: 'Панель' })).toBeInTheDocument()
  })
  it('returnFocus: при закрытии фокус уходит в указанный элемент, а не в якорь', async () => {
    renderK(<ReturnFocusHost />)
    await userEvent.click(screen.getByText('Открыть'))
    expect(screen.getByLabelText('Поле')).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByLabelText('Поле-якорь')).toHaveFocus()
  })
  it('закрытие не отнимает фокус, если он уже ушёл в другой элемент; с Escape фокус возвращается', async () => {
    const u = userEvent.setup()
    renderK(<PopoverHost />)
    await u.click(screen.getByText('Открыть'))
    screen.getByText('Снаружи').focus()
    await u.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Снаружи')).toHaveFocus()
    await u.click(screen.getByText('Открыть'))
    await u.keyboard('{Escape}')
    expect(screen.getByText('Открыть')).toHaveFocus()
  })
  it('role="presentation": без роли dialog и имени, фокус не переносится и не возвращается', async () => {
    const { rerender } = renderK(<PresentationHost open={false} />)
    const outside = screen.getByText('Снаружи')
    outside.focus()
    rerender(<PresentationHost open />)
    expect(screen.queryByRole('dialog')).toBeNull()
    const panel = screen.getByText('Внутри').closest('[role="presentation"]')
    expect(panel).not.toBeNull()
    expect(panel).not.toHaveAttribute('aria-label')
    expect(document.activeElement).toBe(outside)
    rerender(<PresentationHost open={false} />)
    expect(screen.queryByText('Внутри')).toBeNull()
    expect(document.activeElement).toBe(outside)
  })
})

describe('Menu', () => {
  const mk = (): MenuItem[] => [
    { id: 'a', label: 'Статус', onSelect: vi.fn() },
    { id: 'b', label: 'Причина', onSelect: vi.fn(), disabled: true },
    { id: 'c', label: 'Дата', onSelect: vi.fn(), checked: true },
  ]
  it('стрелки пропускают недоступные, Enter выбирает и закрывает', async () => {
    const items = mk()
    renderK(<MenuHost items={items} />)
    await userEvent.click(screen.getByText('Меню'))
    expect(screen.getByRole('menu', { name: 'Сортировать по' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Статус' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitemcheckbox', { name: 'Дата' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(items[2]!.onSelect).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
  })
  it('checked → aria-checked', async () => {
    renderK(<MenuHost items={mk()} />)
    await userEvent.click(screen.getByText('Меню'))
    expect(screen.getByRole('menuitemcheckbox', { name: 'Дата' })).toHaveAttribute('aria-checked', 'true')
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<MenuHost items={mk()} />)
    await userEvent.click(screen.getByText('Меню'))
    expect(await axe(container)).toHaveNoViolations()
  })
})
