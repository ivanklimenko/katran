import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { DataGrid, type DataGridProps } from './DataGrid'
import type { RecordLayout } from './types'

type Doc = { id: string; status: string; num: string; amount: number; purpose: string | null }
const docs: Doc[] = [
  { id: 'd1', status: 'ERROR', num: '800', amount: 12.5, purpose: 'Оплата' },
  { id: 'd2', status: 'DONE', num: '801', amount: 1000, purpose: null },
]
const layout: RecordLayout<Doc> = {
  rowKey: (d) => d.id,
  columns: [
    { id: 'status', menuTitle: 'Статус', width: 60, sort: [{ id: 'status', label: 'Статус' }, { id: 'reason', label: 'Причина' }], render: (d) => d.status },
    { id: 'num', title: 'Номер', width: 90, sort: [{ id: 'num', label: 'Номер', type: 'number' }], render: (d) => d.num },
    { id: 'amount', title: '32', subtitle: 'сумма', align: 'right', width: 100, render: (d) => String(d.amount) },
  ],
  spans: [[{ id: 'purpose', from: 'num', to: 'amount', render: (d) => d.purpose }]],
}
const base = (over: Partial<DataGridProps<Doc>> = {}): DataGridProps<Doc> => ({
  label: 'Документы', layout, rows: docs, total: 87, page: 1, pageSize: 20, onPage: vi.fn(),
  sort: null, onSort: vi.fn(), widths: {}, onResize: vi.fn(), order: ['status', 'num', 'amount'], hidden: [], onColumns: vi.fn(),
  state: 'ready', ...over,
})

describe('DataGrid', () => {
  it('сетка с именем, шапка в порядке колонок, записи с номерами, счётчики строк/колонок', () => {
    renderK(<DataGrid {...base()} />)
    const grid = screen.getByRole('grid', { name: 'Документы' })
    expect(grid).toHaveAttribute('aria-colcount', '4')
    expect(grid).toHaveAttribute('aria-rowcount', String(1 + 87 * 2))
    const heads = screen.getAllByRole('columnheader')
    expect(heads.map((h) => h.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Номер'), expect.stringContaining('32')]))
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(1 + 2 * 2)
    expect(rows[1]).toHaveTextContent('1')
    expect(rows[3]).toHaveTextContent('2')
    expect(within(rows[2]!).getAllByRole('gridcell')[1]).toHaveTextContent('Оплата')
    expect(screen.getByRole('navigation', { name: 'Страницы' })).toHaveTextContent('1–20 из 87')
  })

  it('скрытая колонка не рендерится, сегмент сжимается; ширины из widths', () => {
    renderK(<DataGrid {...base({ hidden: ['amount'], widths: { num: 150 } })} />)
    expect(screen.queryByRole('columnheader', { name: /32/ })).toBeNull()
    const seg = within(screen.getAllByRole('row')[2]!).getAllByRole('gridcell')[1]
    expect(seg).toHaveAttribute('colspan', '1')
    expect(screen.getByRole('columnheader', { name: /Номер/ })).toHaveStyle({ width: 'calc(150px * var(--k-density))' })
  })

  it('сортировка и ресайз пробрасываются наружу', async () => {
    const p = base()
    renderK(<DataGrid {...p} />)
    await userEvent.click(screen.getByRole('button', { name: /Номер/ }))
    expect(p.onSort).toHaveBeenCalledWith({ key: 'num', dir: 'desc' })
    const h = screen.getByRole('slider', { name: 'Ширина колонки Номер' })
    h.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(p.onResize).toHaveBeenCalledWith({ id: 'num', width: 98 })
  })

  it('состав колонок через меню в шапке', async () => {
    const p = base()
    renderK(<DataGrid {...p} />)
    await userEvent.click(screen.getByRole('button', { name: 'Состав колонок' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('checkbox', { name: '32' }))
    expect(p.onColumns).toHaveBeenCalledWith({ order: ['status', 'num', 'amount'], hidden: ['amount'] })
  })

  it('выделение: чекбокс записи, трёхпозиционный чекбокс страницы, подсветка', async () => {
    const p = base({ selection: { mode: 'ids', ids: ['d1'] }, onSelect: vi.fn(), onSelectPage: vi.fn() })
    renderK(<DataGrid {...p} />)
    const head = screen.getByRole('checkbox', { name: 'Выбрать все на странице' }) as HTMLInputElement
    expect(head.indeterminate).toBe(true)
    expect(screen.getAllByRole('row')[1]).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Выбрать запись 2' }))
    expect(p.onSelect).toHaveBeenCalledWith({ id: 'd2', on: true })
    await userEvent.click(head)
    expect(p.onSelectPage).toHaveBeenCalledWith({ ids: ['d1', 'd2'], on: true })
  })

  it('открытие: кнопка, запись не кликабельна; второй клик — secondary', async () => {
    const p = base({ onOpen: vi.fn() })
    renderK(<DataGrid {...p} />)
    await userEvent.click(screen.getAllByRole('row')[1]!)
    expect(p.onOpen).not.toHaveBeenCalled()
    const btn = screen.getByRole('button', { name: 'Открыть запись 1' })
    fireEvent.click(btn, { detail: 1 })
    expect(p.onOpen).toHaveBeenLastCalledWith(docs[0], { secondary: false })
    fireEvent.click(btn, { detail: 2 })
    expect(p.onOpen).toHaveBeenLastCalledWith(docs[0], { secondary: true })
  })

  it('состояния: loading → скелетон после порога; refreshing → прогресс и приглушение; empty; error', async () => {
    vi.useFakeTimers()
    const { rerender } = renderK(<DataGrid {...base({ rows: [], state: 'loading' })} />)
    expect(document.querySelectorAll('tbody')).toHaveLength(0)   // до порога 200 мс — только шапка
    act(() => { vi.advanceTimersByTime(250) })
    expect(document.querySelectorAll('tbody').length).toBe(8)
    vi.useRealTimers()
    rerender(<DataGrid {...base({ state: 'refreshing' })} />)
    expect(screen.getByRole('progressbar', { name: 'Обновление данных' })).toBeInTheDocument()
    expect(screen.getByRole('grid')).toHaveAttribute('data-dim', 'true')
    rerender(<DataGrid {...base({ rows: [], total: 0, emptyAction: { label: 'Сбросить фильтр', onClick: () => {} } })} />)
    expect(screen.getByText('По заданным условиям записей нет')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Сбросить фильтр' })).toBeInTheDocument()
    const onRetry = vi.fn()
    rerender(<DataGrid {...base({ state: 'error', error: 'сервис не ответил', onRetry })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('сервис не ответил')
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('без нарушений axe', async () => {
    const { container } = renderK(<DataGrid {...base({ selection: { mode: 'ids', ids: [] }, onSelect: () => {}, onSelectPage: () => {}, onOpen: () => {} })} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
