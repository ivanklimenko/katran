import userEvent from '@testing-library/user-event'
import { renderK } from '../test/renderK'
import { CopyValue } from '../value'
import { DataGrid, type DataGridProps } from './DataGrid'
import type { RecordLayout } from './types'

type Doc = { id: string; num: string; name: string; purpose: string }
const docs: Doc[] = [{ id: 'a', num: '800', name: 'Ромашка', purpose: 'Оплата' }, { id: 'b', num: '801', name: 'Василёк', purpose: 'Возврат' }]
const layout: RecordLayout<Doc> = {
  rowKey: (d) => d.id,
  columns: [
    { id: 'num', title: 'Номер', sort: [{ id: 'num', label: 'Номер' }], render: (d) => <CopyValue value={d.num} /> },
    { id: 'name', title: 'Имя', render: (d) => d.name },
  ],
  spans: [[{ id: 'purpose', from: 'num', to: 'name', render: (d) => d.purpose }]],
}
const props = (over: Partial<DataGridProps<Doc>> = {}): DataGridProps<Doc> => ({
  label: 'Тест', layout, rows: docs, total: 2, page: 1, pageSize: 20, onPage: vi.fn(), sort: null, onSort: vi.fn(),
  widths: {}, onResize: vi.fn(), order: ['num', 'name'], hidden: [], onColumns: vi.fn(), state: 'ready', onOpen: vi.fn(), ...over,
})
const cellOf = (el: Element | null) => el?.closest('[data-cell]')?.getAttribute('data-cell')

describe('DataGrid: клавиатура', () => {
  it('один таб-стоп: Tab попадает в первую ячейку первой записи', async () => {
    renderK(<><button>до</button><DataGrid {...props()} /></>)
    await userEvent.tab()
    await userEvent.tab()
    expect(cellOf(document.activeElement)).toBe('2:0')
    expect(document.querySelectorAll('[data-cell][tabindex="0"]')).toHaveLength(1)
  })

  it('стрелки: вправо по колонкам, вниз в строку сегментов и на следующую запись, вверх в шапку; Home/End', async () => {
    renderK(<DataGrid {...props()} />)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}')
    expect(cellOf(document.activeElement)).toBe('2:1')
    await userEvent.keyboard('{ArrowRight}')
    expect(cellOf(document.activeElement)).toBe('2:2')
    await userEvent.keyboard('{ArrowDown}')
    expect(cellOf(document.activeElement)).toBe('3:1')   // сегмент начинается с колонки 1 — ближайшая слева
    await userEvent.keyboard('{ArrowDown}')
    expect(cellOf(document.activeElement)).toBe('4:1')
    await userEvent.keyboard('{End}')
    expect(cellOf(document.activeElement)).toBe('4:2')
    await userEvent.keyboard('{Home}')
    expect(cellOf(document.activeElement)).toBe('4:0')
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}')
    expect(cellOf(document.activeElement)).toBe('1:0')
    await userEvent.keyboard('{ArrowUp}')
    expect(cellOf(document.activeElement)).toBe('1:0')   // выше шапки не уходит
  })

  it('Enter на ячейке с одной кнопкой — клик (открытие); с несколькими — фокус на первый; Escape возвращает в ячейку', async () => {
    const p = props()
    renderK(<DataGrid {...p} />)
    await userEvent.tab()
    expect(cellOf(document.activeElement)).toBe('2:0')
    await userEvent.keyboard('{Enter}')
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Открыть запись 1')   // в служебной ячейке один интерактив (номер — текст) → фокус + клик
    expect(p.onOpen).toHaveBeenCalledWith(docs[0], { secondary: false })
    await userEvent.keyboard('{Escape}')
    expect(cellOf(document.activeElement)).toBe('2:0')
    expect(document.activeElement?.hasAttribute('data-cell')).toBe(true)
  })

  it('Enter на заголовке сортирует', async () => {
    const p = props()
    renderK(<DataGrid {...p} />)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowUp}{ArrowRight}{Enter}')
    expect(p.onSort).toHaveBeenCalledWith({ key: 'num', dir: 'asc' })
  })

  it('смена страницы возвращает активную ячейку в начало', async () => {
    const p = props()
    const { rerender } = renderK(<DataGrid {...p} />)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowDown}{ArrowRight}')
    expect(cellOf(document.activeElement)).toBe('3:1')
    rerender(<DataGrid {...p} page={2} />)
    expect(document.querySelector('[data-cell][tabindex="0"]')?.getAttribute('data-cell')).toBe('2:0')
  })
})
