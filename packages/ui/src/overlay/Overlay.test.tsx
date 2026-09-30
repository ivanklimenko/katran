import { useRef, useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Menu, type MenuItem } from './Menu'
import { Popover } from './Popover'

function PopoverHost() {
  const [open, setOpen] = useState(false)
  const a = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={a} onClick={() => setOpen(true)}>Открыть</button>
      <button>Снаружи</button>
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
  it('returnFocus: при закрытии фокус уходит в указанный элемент, а не в якорь', async () => {
    renderK(<ReturnFocusHost />)
    await userEvent.click(screen.getByText('Открыть'))
    expect(screen.getByLabelText('Поле')).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByLabelText('Поле-якорь')).toHaveFocus()
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
