import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { BulkBar } from '../filters/BulkBar'
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
    expect(document.querySelectorAll('tbody[aria-hidden="true"]').length).toBe(8)
    rerender(<DataGrid {...base({ state: 'refreshing' })} />)
    act(() => { vi.advanceTimersByTime(400) })                    // минимум показа скелетона истёк
    vi.useRealTimers()
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

  it('скелетон держится минимум 400 мс: ответ через 250 мс не даёт мелькания', () => {
    vi.useFakeTimers()
    const { rerender } = renderK(<DataGrid {...base({ rows: [], total: 0, state: 'loading' })} />)
    act(() => { vi.advanceTimersByTime(250) })                    // порог 200 мс пройден — скелетон показан
    expect(document.querySelectorAll('tbody[aria-hidden="true"]')).toHaveLength(8)
    rerender(<DataGrid {...base({ state: 'ready' })} />)
    expect(document.querySelectorAll('tbody[aria-hidden="true"]')).toHaveLength(8)   // данные пришли, скелетон ещё на месте
    expect(screen.queryByRole('button', { name: 'Выбрать запись 1' })).toBeNull()
    expect(screen.getAllByRole('row')).toHaveLength(1)                               // для AT — только шапка
    act(() => { vi.advanceTimersByTime(300) })
    expect(document.querySelectorAll('tbody[aria-hidden="true"]')).toHaveLength(8)   // 50 + 300 < 400 от показа
    act(() => { vi.advanceTimersByTime(100) })
    expect(document.querySelectorAll('tbody[aria-hidden="true"]')).toHaveLength(0)
    expect(screen.getAllByRole('row')).toHaveLength(1 + 2 * 2)
    expect(document.querySelector('[data-cell][tabindex="0"]')?.getAttribute('data-cell')).toBe('2:0')   // таб-стоп вернулся на запись
    vi.useRealTimers()
  })

  it('ARIA: aria-rowindex абсолютный по выборке, ключи клавиатуры — внутри страницы; multiselectable при выделении', () => {
    renderK(<DataGrid {...base({ page: 2, pageSize: 20, selection: { mode: 'ids', ids: [] }, onSelect: vi.fn() })} />)
    const grid = screen.getByRole('grid')
    expect(grid).toHaveAttribute('aria-rowcount', String(1 + 87 * 2))
    expect(grid).toHaveAttribute('aria-multiselectable', 'true')
    expect(grid).not.toHaveAttribute('aria-busy')
    const rows = screen.getAllByRole('row')
    // первая запись страницы 2 — 21-я по выборке: 2 + 20 × 2 = 42
    expect(rows.map((r) => r.getAttribute('aria-rowindex'))).toEqual(['1', '42', '43', '44', '45'])
    expect(within(rows[1]!).getAllByRole('gridcell')[0]).toHaveAttribute('data-cell', '2:0')
    expect(screen.getByRole('checkbox', { name: 'Выбрать запись 21' })).toBeInTheDocument()
  })

  it('ARIA: без выделения aria-multiselectable нет', () => {
    renderK(<DataGrid {...base()} />)
    expect(screen.getByRole('grid')).not.toHaveAttribute('aria-multiselectable')
  })

  it('ARIA: первая загрузка (total=0) — aria-busy, скелетон скрыт, индексов больше aria-rowcount нет', () => {
    vi.useFakeTimers()
    renderK(<DataGrid {...base({ rows: [], total: 0, state: 'loading' })} />)
    act(() => { vi.advanceTimersByTime(250) })
    vi.useRealTimers()
    const grid = screen.getByRole('grid')
    expect(grid).toHaveAttribute('aria-busy', 'true')
    const count = Number(grid.getAttribute('aria-rowcount'))
    expect(count).toBe(1)
    const indexed = Array.from(grid.querySelectorAll('[aria-rowindex]')).map((r) => Number(r.getAttribute('aria-rowindex')))
    expect(indexed).toEqual([1])
    indexed.forEach((i) => expect(i).toBeLessThanOrEqual(count))
    const skeleton = screen.getAllByRole('rowgroup', { hidden: true }).filter((g) => g.getAttribute('aria-hidden') === 'true')
    expect(skeleton).toHaveLength(8)
  })

  it('ARIA: refreshing — aria-busy; empty и error — строка состояния с aria-rowindex=2 в пределах aria-rowcount', () => {
    const { rerender } = renderK(<DataGrid {...base({ state: 'refreshing' })} />)
    expect(screen.getByRole('grid')).toHaveAttribute('aria-busy', 'true')
    rerender(<DataGrid {...base({ rows: [], total: 0 })} />)
    let rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveAttribute('aria-rowindex', '2')
    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '2')
    expect(screen.getByRole('grid')).not.toHaveAttribute('aria-busy')
    rerender(<DataGrid {...base({ state: 'error', error: 'сбой' })} />)
    rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveAttribute('aria-rowindex', '2')
  })

  it('без нарушений axe: loading (скелетон), empty, error', async () => {
    vi.useFakeTimers()
    const { container, rerender } = renderK(<DataGrid {...base({ rows: [], total: 0, state: 'loading' })} />)
    act(() => { vi.advanceTimersByTime(250) })
    vi.useRealTimers()
    expect(document.querySelectorAll('tbody[aria-hidden="true"]')).toHaveLength(8)
    expect(await axe(container)).toHaveNoViolations()
    vi.useFakeTimers()
    rerender(<DataGrid {...base({ rows: [], total: 0, emptyAction: { label: 'Сбросить фильтр', onClick: () => {} } })} />)
    act(() => { vi.advanceTimersByTime(1000) })                   // с запасом: часы переустановлены, минимум показа (400 мс) точно истёк
    vi.useRealTimers()
    expect(screen.getByText('По заданным условиям записей нет')).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
    rerender(<DataGrid {...base({ state: 'error', error: 'сервис не ответил', onRetry: () => {} })} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('без нарушений axe', async () => {
    const { container } = renderK(<DataGrid {...base({ selection: { mode: 'ids', ids: [] }, onSelect: () => {}, onSelectPage: () => {}, onOpen: () => {} })} />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('слот toolbar рендерится в футере над пагинацией', () => {
    renderK(<DataGrid {...base({ toolbar: <div data-testid="tb">полоса</div> })} />)
    const tb = screen.getByTestId('tb')
    const nav = screen.getByRole('navigation', { name: /Страницы/ })
    expect(tb.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('пустой toolbar (BulkBar без выделения вернул null) не занимает места', () => {
    const { container } = renderK(
      <DataGrid {...base({ toolbar: <BulkBar selection={{ mode: 'ids', ids: [] }} total={87} onClear={() => {}} /> })} />,
    )
    const wrapper = container.querySelector('[class*="toolbar"]')
    expect(wrapper).not.toBeNull()
    expect(wrapper).toBeEmptyDOMElement()
    expect(screen.queryByRole('region', { name: 'Массовые действия' })).toBeNull()
  })
})
