import { act, fireEvent, screen } from '@testing-library/react'
import { renderK } from '../test/renderK'
import { DataGrid, type DataGridProps } from './DataGrid'
import type { RecordLayout } from './types'

type Doc = { id: string; num: string }
const docs: Doc[] = [{ id: 'd1', num: '800' }, { id: 'd2', num: '801' }]
const layout: RecordLayout<Doc> = { rowKey: (d) => d.id, columns: [{ id: 'num', title: 'Номер', render: (d) => d.num }] }
const props = (over: Partial<DataGridProps<Doc>> = {}): DataGridProps<Doc> => ({
  label: 'Документы', layout, rows: docs, total: 2, page: 1, pageSize: 20, onPage: vi.fn(), sort: [], onSort: vi.fn(),
  widths: {}, onResize: vi.fn(), order: ['num'], hidden: [], onColumns: vi.fn(), state: 'ready', onOpen: vi.fn(), ...over,
})
const btn = (n: number) => screen.getByRole('button', { name: new RegExp(`^Открыть запись ${n}(\\D|$)`) })
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

describe('DataGrid: жесты открытия (спека 2a §3.1, эталон grid.html:2165–2172)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('клик — открытие в A через 220 мс, не раньше', () => {
    const p = props()
    renderK(<DataGrid {...p} />)
    fireEvent.click(btn(1), { detail: 1 })
    wait(219)
    expect(p.onOpen).not.toHaveBeenCalled()
    wait(1)
    expect(p.onOpen).toHaveBeenCalledTimes(1)
    expect(p.onOpen).toHaveBeenCalledWith(docs[0], { secondary: false, state: null })
  })

  it('двойной клик — одно открытие рядом; первое отменено', () => {
    const p = props()
    renderK(<DataGrid {...p} />)
    fireEvent.click(btn(1), { detail: 1 })
    wait(100)
    fireEvent.click(btn(1), { detail: 2 })
    fireEvent.doubleClick(btn(1))
    wait(500)
    expect(p.onOpen).toHaveBeenCalledTimes(1)
    expect(p.onOpen).toHaveBeenCalledWith(docs[0], { secondary: true, state: null })
  })

  it('тройной клик не даёт второго открытия', () => {
    const p = props()
    renderK(<DataGrid {...p} />)
    fireEvent.click(btn(1), { detail: 1 })
    fireEvent.click(btn(1), { detail: 2 })
    fireEvent.click(btn(1), { detail: 3 })
    wait(500)
    expect(p.onOpen).toHaveBeenCalledTimes(1)
  })

  it('Shift+клик — рядом сразу', () => {
    const p = props()
    renderK(<DataGrid {...p} />)
    fireEvent.click(btn(2), { detail: 1, shiftKey: true })
    expect(p.onOpen).toHaveBeenCalledWith(docs[1], { secondary: true, state: null })
    wait(500)
    expect(p.onOpen).toHaveBeenCalledTimes(1)
  })

  it('клавиатура (Enter/Space — клик с detail 0) — сразу, без задержки', () => {
    const p = props()
    renderK(<DataGrid {...p} />)
    fireEvent.click(btn(1))
    expect(p.onOpen).toHaveBeenCalledWith(docs[0], { secondary: false, state: null })
  })

  it('клик по другой записи в пределах 220 мс отменяет первую — открывается последняя', () => {
    const p = props()
    renderK(<DataGrid {...p} />)
    fireEvent.click(btn(1), { detail: 1 })
    wait(100)
    fireEvent.click(btn(2), { detail: 1 })
    wait(220)
    expect(p.onOpen).toHaveBeenCalledTimes(1)
    expect(p.onOpen).toHaveBeenCalledWith(docs[1], { secondary: false, state: null })
  })

  it('размонтирование снимает отложенное открытие', () => {
    const p = props()
    const { unmount } = renderK(<DataGrid {...p} />)
    fireEvent.click(btn(1), { detail: 1 })
    unmount()
    wait(500)
    expect(p.onOpen).not.toHaveBeenCalled()
  })

  it('marked: запись A и B помечена data-mark, в имени кнопки — где открыта', () => {
    renderK(<DataGrid {...props({ marked: (d) => (d.id === 'd1' ? 'a' : d.id === 'd2' ? 'b' : null) })} />)
    expect(document.querySelector('tbody[data-key="d1"]')).toHaveAttribute('data-mark', 'a')
    expect(document.querySelector('tbody[data-key="d2"]')).toHaveAttribute('data-mark', 'b')
    expect(btn(1)).toHaveAccessibleName('Открыть запись 1 · открыта в деталке')
    expect(btn(2)).toHaveAccessibleName('Открыть запись 2 · открыта для сравнения')
  })

  it('без marked — атрибута нет; у кнопки открытия — data-k-open с ключом записи', () => {
    renderK(<DataGrid {...props()} />)
    expect(document.querySelector('tbody[data-key="d1"]')).not.toHaveAttribute('data-mark')
    expect(btn(1)).toHaveAttribute('data-k-open', 'd1')
  })
})
