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
const typeCol: ColumnDef<R> = { id: 'type', title: 'Тип', sort: [{ id: 'type', label: 'Тип' }], render: () => null }
const Table = ({ children }: { children: React.ReactNode }) => <table role="grid"><thead><tr role="row">{children}</tr></thead></table>

describe('ColumnHeader', () => {
  it('простая колонка: первый клик — направление по типу, второй — переключение', async () => {
    const onSort = vi.fn()
    const { rerender } = renderK(<Table><ColumnHeader column={simple} sort={[]} onSort={onSort} width={120} /></Table>)
    await userEvent.click(screen.getByRole('button', { name: /32/ }))
    expect(onSort).toHaveBeenLastCalledWith([{ key: 'amount', dir: 'desc' }])
    rerender(<Table><ColumnHeader column={simple} sort={[{ key: 'amount', dir: 'desc' }]} onSort={onSort} width={120} /></Table>)
    await userEvent.click(screen.getByRole('button', { name: /32/ }))
    expect(onSort).toHaveBeenLastCalledWith([{ key: 'amount', dir: 'asc' }])
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending')
  })

  it('составная колонка: меню ключей, выбранный подписан вместо subtitle, сброс', async () => {
    const onSort = vi.fn()
    const sort: Sort = [{ key: 'refIn', dir: 'asc' }]
    renderK(<Table><ColumnHeader column={composite} sort={sort} onSort={onSort} width={160} /></Table>)
    expect(screen.getByRole('columnheader')).toHaveTextContent('20 вх')
    expect(screen.getByRole('columnheader')).not.toHaveTextContent('№ · 20 вх / исх')
    await userEvent.click(screen.getByRole('button', { name: /ID/ }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitemcheckbox', { name: /20 вх/ })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(within(menu).getByRole('menuitemcheckbox', { name: /Номер документа/ }))
    expect(onSort).toHaveBeenLastCalledWith([{ key: 'docNumber', dir: 'desc' }])
    await userEvent.click(screen.getByRole('button', { name: /ID/ }))
    await userEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Сбросить сортировку' }))
    expect(onSort).toHaveBeenLastCalledWith([])
  })

  it('несколько уровней: клик по колонке с одним ключом делает его единственным', async () => {
    const onSort = vi.fn()
    const sort: Sort = [{ key: 'amount', dir: 'desc' }, { key: 'type', dir: 'asc' }]
    renderK(<Table><ColumnHeader column={typeCol} sort={sort} onSort={onSort} width={80} /></Table>)
    await userEvent.click(screen.getByRole('button', { name: /Тип/ }))
    expect(onSort).toHaveBeenLastCalledWith([{ key: 'type', dir: 'asc' }])
  })

  it('без sort — не кнопка', () => {
    renderK(<Table><ColumnHeader column={plain} sort={[]} onSort={() => {}} width={80} /></Table>)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('columnheader')).toHaveTextContent('Тип')
  })

  it('ресайз: перетаскивание и клавиатура с минимумом', async () => {
    const onResize = vi.fn()
    renderK(<Table><ColumnHeader column={plain} sort={[]} onSort={() => {}} width={80} onResize={onResize} /></Table>)
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

  it('сброс ширин: двойной клик по ручке — все; Home на ползунке — эта колонка; Shift+Home — все', async () => {
    const onResetWidths = vi.fn()
    const onResetWidth = vi.fn()
    renderK(<Table><ColumnHeader column={plain} sort={[]} onSort={() => {}} width={80} onResize={() => {}} onResetWidths={onResetWidths} onResetWidth={onResetWidth} /></Table>)
    const h = screen.getByRole('slider', { name: 'Ширина колонки Тип' })
    expect(h).toHaveAttribute('aria-keyshortcuts', 'Home Shift+Home')
    await userEvent.dblClick(h)
    expect(onResetWidths).toHaveBeenCalledTimes(1)
    h.focus()
    await userEvent.keyboard('{Home}')
    expect(onResetWidth).toHaveBeenCalledTimes(1)
    expect(onResetWidths).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Shift>}{Home}{/Shift}')
    expect(onResetWidths).toHaveBeenCalledTimes(2)
    expect(onResetWidth).toHaveBeenCalledTimes(1)
  })

  it('без нарушений axe', async () => {
    const { container } = renderK(<Table><ColumnHeader column={simple} sort={[]} onSort={() => {}} width={120} onResize={() => {}} /><ColumnHeader column={composite} sort={[]} onSort={() => {}} width={160} /></Table>)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('Shift+клик по колонке с одним ключом добавляет уровень; номер уровня у стрелки при двух уровнях', async () => {
    const onSort = vi.fn()
    const col: ColumnDef<unknown> = { id: 'a', title: 'Сумма', sort: [{ id: 'amount', label: 'Сумма', type: 'number' }], render: () => null }
    renderK(<table><thead><tr><ColumnHeader column={col} sort={[{ key: 'type', dir: 'asc' }]} onSort={onSort} width={100} /></tr></thead></table>)
    // holding Shift across calls требует общей сессии — статичный userEvent.X() создаёт новую на каждый вызов
    const user = userEvent.setup()
    await user.keyboard('{Shift>}')
    await user.click(screen.getByRole('button', { name: /Сумма/ }))
    await user.keyboard('{/Shift}')
    expect(onSort).toHaveBeenLastCalledWith([{ key: 'type', dir: 'asc' }, { key: 'amount', dir: 'desc' }])
  })
  it('номер уровня верхним индексом и aria-sort только у первого уровня', () => {
    const col = (id: string, key: string): ColumnDef<unknown> => ({ id, title: id, sort: [{ id: key, label: key }], render: () => null })
    const sort = [{ key: 'k1', dir: 'asc' as const }, { key: 'k2', dir: 'desc' as const }]
    renderK(<table><thead><tr><ColumnHeader column={col('c1', 'k1')} sort={sort} onSort={() => {}} width={100} /><ColumnHeader column={col('c2', 'k2')} sort={sort} onSort={() => {}} width={100} /></tr></thead></table>)
    const [h1, h2] = screen.getAllByRole('columnheader')
    expect(h1).toHaveAttribute('aria-sort', 'ascending')
    expect(h2).toHaveAttribute('aria-sort', 'none')
    expect(h1).toHaveTextContent('↑1')
    expect(h2).toHaveTextContent('↓2')
  })
  it('меню составной колонки: «+» добавляет уровень, у выбранного — «↕» меняет направление; подсказка', async () => {
    const onSort = vi.fn()
    const col: ColumnDef<unknown> = { id: 'c', title: '32', sort: [{ id: 'amount', label: 'Сумма', type: 'number' }, { id: 'currency', label: 'Валюта' }], render: () => null }
    renderK(<table><thead><tr><ColumnHeader column={col} sort={[{ key: 'type', dir: 'asc' }, { key: 'amount', dir: 'desc' }]} onSort={onSort} width={100} /></tr></thead></table>)
    await userEvent.click(screen.getByRole('button', { name: /32/ }))
    expect(screen.getByText('клик — единственный ключ · «+» или Shift+клик — добавить уровнем')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Валюта — добавить уровнем' }))
    expect(onSort).toHaveBeenLastCalledWith([{ key: 'type', dir: 'asc' }, { key: 'amount', dir: 'desc' }, { key: 'currency', dir: 'asc' }])
  })
  it('«Сбросить сортировку» при нескольких колонках в sort убирает только уровни этой колонки', async () => {
    const onSort = vi.fn()
    const sort: Sort = [{ key: 'refIn', dir: 'asc' }, { key: 'other', dir: 'asc' }]
    renderK(<Table><ColumnHeader column={composite} sort={sort} onSort={onSort} width={160} /></Table>)
    await userEvent.click(screen.getByRole('button', { name: /ID/ }))
    await userEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Сбросить сортировку' }))
    expect(onSort).toHaveBeenLastCalledWith([{ key: 'other', dir: 'asc' }])
  })
  it('Shift+клик по пункту «сделать единственным» в меню добавляет уровень, а не делает единственным', async () => {
    const onSort = vi.fn()
    const sort: Sort = [{ key: 'type', dir: 'asc' }]
    renderK(<Table><ColumnHeader column={composite} sort={sort} onSort={onSort} width={160} /></Table>)
    await userEvent.click(screen.getByRole('button', { name: /ID/ }))
    const user = userEvent.setup()
    await user.keyboard('{Shift>}')
    await user.click(within(screen.getByRole('menu')).getByRole('menuitemcheckbox', { name: '20 вх' }))
    await user.keyboard('{/Shift}')
    expect(onSort).toHaveBeenLastCalledWith([{ key: 'type', dir: 'asc' }, { key: 'refIn', dir: 'asc' }])
  })
})
