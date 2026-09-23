import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { ColumnHeader } from './ColumnHeader'
import type { ColumnDef, Sort } from './types'

type R = { a: number }
const simple: ColumnDef<R> = { id: 'amt', title: '32', subtitle: 'сумма', sort: [{ id: 'amount', label: 'Сумма', type: 'number' }], render: () => null }
const composite: ColumnDef<R> = {
  id: 'id', title: 'ID', subtitle: '№ · 20 вх / исх',
  sort: [{ id: 'docNumber', label: 'Номер документа', type: 'number' }, { id: 'refIn', label: '20 вх' }, { id: 'refOut', label: '20 исх' }],
  render: () => null,
}
const plain: ColumnDef<R> = { id: 'x', title: 'Тип', render: () => null }
const Table = ({ children }: { children: React.ReactNode }) => <table role="grid"><thead><tr role="row">{children}</tr></thead></table>

describe('ColumnHeader', () => {
  it('простая колонка: первый клик — направление по типу, второй — переключение', async () => {
    const onSort = vi.fn()
    const { rerender } = renderK(<Table><ColumnHeader column={simple} sort={null} onSort={onSort} width={120} /></Table>)
    await userEvent.click(screen.getByRole('button', { name: /32/ }))
    expect(onSort).toHaveBeenLastCalledWith({ key: 'amount', dir: 'desc' })
    rerender(<Table><ColumnHeader column={simple} sort={{ key: 'amount', dir: 'desc' }} onSort={onSort} width={120} /></Table>)
    await userEvent.click(screen.getByRole('button', { name: /32/ }))
    expect(onSort).toHaveBeenLastCalledWith({ key: 'amount', dir: 'asc' })
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending')
  })

  it('составная колонка: меню ключей, выбранный подписан вместо subtitle, сброс', async () => {
    const onSort = vi.fn()
    const sort: Sort = { key: 'refIn', dir: 'asc' }
    renderK(<Table><ColumnHeader column={composite} sort={sort} onSort={onSort} width={160} /></Table>)
    expect(screen.getByRole('columnheader')).toHaveTextContent('20 вх')
    expect(screen.getByRole('columnheader')).not.toHaveTextContent('№ · 20 вх / исх')
    await userEvent.click(screen.getByRole('button', { name: /ID/ }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitemcheckbox', { name: /20 вх/ })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(within(menu).getByRole('menuitemcheckbox', { name: /Номер документа/ }))
    expect(onSort).toHaveBeenLastCalledWith({ key: 'docNumber', dir: 'desc' })
    await userEvent.click(screen.getByRole('button', { name: /ID/ }))
    await userEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Сбросить сортировку' }))
    expect(onSort).toHaveBeenLastCalledWith(null)
  })

  it('без sort — не кнопка', () => {
    renderK(<Table><ColumnHeader column={plain} sort={null} onSort={() => {}} width={80} /></Table>)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('columnheader')).toHaveTextContent('Тип')
  })

  it('ресайз: перетаскивание и клавиатура с минимумом', async () => {
    const onResize = vi.fn()
    renderK(<Table><ColumnHeader column={plain} sort={null} onSort={() => {}} width={80} onResize={onResize} /></Table>)
    const h = screen.getByRole('slider', { name: 'Ширина колонки Тип' })
    expect(h).toHaveAttribute('aria-valuenow', '80')
    expect(h).toHaveAttribute('aria-valuetext', '80 px')
    expect(h).toHaveAttribute('aria-orientation', 'horizontal')   // значение меняют ←/→
    fireEvent.pointerDown(h, { clientX: 100, pointerId: 1 })
    fireEvent.pointerMove(h, { clientX: 130, pointerId: 1 })
    expect(onResize).toHaveBeenLastCalledWith(110)
    fireEvent.pointerMove(h, { clientX: 0, pointerId: 1 })
    expect(onResize).toHaveBeenLastCalledWith(36)
    fireEvent.pointerUp(h, { pointerId: 1 })
    h.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onResize).toHaveBeenLastCalledWith(88)
    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}')
    expect(onResize).toHaveBeenLastCalledWith(48)
  })

  it('без нарушений axe', async () => {
    const { container } = renderK(<Table><ColumnHeader column={simple} sort={null} onSort={() => {}} width={120} onResize={() => {}} /><ColumnHeader column={composite} sort={null} onSort={() => {}} width={160} /></Table>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
