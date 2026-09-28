import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { CopyValue } from '../value'
import { DataGrid, type DataGridProps } from './DataGrid'
import { useGridKeyboard } from './useGridKeyboard'
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
  label: 'Тест', layout, rows: docs, total: 2, page: 1, pageSize: 20, onPage: vi.fn(), sort: [], onSort: vi.fn(),
  widths: {}, onResize: vi.fn(), order: ['num', 'name'], hidden: [], onColumns: vi.fn(), state: 'ready', onOpen: vi.fn(), ...over,
})
const cellOf = (el: Element | null) => el?.closest('[data-cell]')?.getAttribute('data-cell')

// Отдельная раскладка для проверки rowSpan: 'a' — обычная колонка, 't' — на всю высоту записи (fullHeight),
// сквозная строка содержит один сегмент 's' от 'a' до 'a' (не заходит на 't' — он занят rowSpan).
type Tall = { id: string; a: string; t: string }
const tallDocs: Tall[] = [{ id: 'r1', a: 'A1', t: 'T1' }, { id: 'r2', a: 'A2', t: 'T2' }]
const tallLayout: RecordLayout<Tall> = {
  rowKey: (d) => d.id,
  columns: [
    { id: 'a', title: 'A', render: (d) => d.a },
    { id: 't', title: 'T', fullHeight: true, render: (d) => d.t },
  ],
  spans: [[{ id: 's', from: 'a', to: 'a', render: () => 'S' }]],
}
const tallProps = (over: Partial<DataGridProps<Tall>> = {}): DataGridProps<Tall> => ({
  label: 'Тест высоких колонок', layout: tallLayout, rows: tallDocs, total: 2, page: 1, pageSize: 20, onPage: vi.fn(), sort: [], onSort: vi.fn(),
  widths: {}, onResize: vi.fn(), order: ['a', 't'], hidden: [], onColumns: vi.fn(), state: 'ready', onOpen: vi.fn(), ...over,
})
const renderGrid = () => renderK(<DataGrid {...tallProps()} />)

// Сквозная строка без сегментов: единственный сегмент 'a'..'a', колонка 'a' скрыта, 't' — на всю высоту.
// Строка из одних заглушек (aria-hidden) не должна рендериться: в ней нет ячеек для стрелок и для AT.
type Gap = { id: string; a: string; b: string; t: string }
const gapDocs: Gap[] = [{ id: 'r1', a: 'A1', b: 'B1', t: 'T1' }, { id: 'r2', a: 'A2', b: 'B2', t: 'T2' }]
const gapLayout: RecordLayout<Gap> = {
  rowKey: (d) => d.id,
  columns: [
    { id: 'a', title: 'A', render: (d) => d.a },
    { id: 'b', title: 'B', render: (d) => d.b },
    { id: 't', title: 'T', fullHeight: true, render: (d) => d.t },
  ],
  spans: [[{ id: 's', from: 'a', to: 'a', render: () => 'S' }]],
}
const gapProps = (): DataGridProps<Gap> => ({
  label: 'Тест пустой сквозной строки', layout: gapLayout, rows: gapDocs, total: 2, page: 1, pageSize: 20, onPage: vi.fn(), sort: [], onSort: vi.fn(),
  widths: {}, onResize: vi.fn(), order: ['a', 'b', 't'], hidden: ['a'], onColumns: vi.fn(), state: 'ready', onOpen: vi.fn(),
})
const cellWithText = (recordId: string, text: string): HTMLElement => {
  const body = document.querySelector(`tbody[data-key="${recordId}"]`)!
  const found = Array.from(body.querySelectorAll<HTMLElement>('[data-cell]')).find((el) => el.textContent === text)
  if (!found) throw new Error(`ячейка не найдена: ${recordId}/${text}`)
  return found
}

/** Таблица с «пустой» строкой посередине (одни aria-hidden заглушки) — проверка обхода таких строк стрелками. */
function HoleTable() {
  const kb = useGridKeyboard({ resetToken: 'x', fallback: '1:0' })
  return (
    <table role="grid" aria-label="Дыра">
      <tbody>
        <tr role="row"><td role="gridcell" {...kb.cellProps(1, 0, 0)}>первая</td></tr>
        <tr role="row"><td aria-hidden="true" /></tr>
        <tr role="row"><td role="gridcell" {...kb.cellProps(3, 0, 0)}>третья</td></tr>
      </tbody>
    </table>
  )
}
const cellOfTall = (recordId: string, col: 'a' | 't'): HTMLElement => {
  const idx = tallLayout.columns.findIndex((c) => c.id === col) + 1   // +1 — служебная колонка 0
  const body = document.querySelector(`tbody[data-key="${recordId}"]`)!
  const found = Array.from(body.querySelectorAll<HTMLElement>('[data-cell]')).find((el) => Number(el.dataset.cell!.split(':')[1]) === idx)
  if (!found) throw new Error(`ячейка не найдена: ${recordId}/${col}`)
  return found
}
const spanCellOf = (recordId: string): HTMLElement => {
  const body = document.querySelector(`tbody[data-key="${recordId}"]`)!
  const spanRow = Array.from(body.querySelectorAll('tr'))[1]!
  return spanRow.querySelector<HTMLElement>('[data-cell]')!
}

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

  it('стрелки по служебной колонке остаются в ней между записями (высокая ячейка — rowSpan)', async () => {
    renderK(<DataGrid {...props()} />)
    await userEvent.tab()
    expect(cellOf(document.activeElement)).toBe('2:0')
    await userEvent.keyboard('{ArrowDown}')
    expect(cellOf(document.activeElement)).toBe('4:0')
    await userEvent.keyboard('{ArrowUp}')
    expect(cellOf(document.activeElement)).toBe('2:0')
  })

  it('↓ из высокой ячейки — в ту же колонку следующей записи; ↑ из следующей записи на высокую колонку — в высокую ячейку', async () => {
    renderGrid()
    const t1 = cellOfTall('r1', 't')
    t1.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(cellOfTall('r2', 't'))
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(t1)
  })

  it('↑ из сквозной строки на колонку высокой ячейки — в высокую ячейку своей записи', async () => {
    renderGrid()
    const seg1 = spanCellOf('r1')
    seg1.focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(cellOfTall('r1', 'a'))
  })

  it('Enter на ячейке с одной кнопкой — клик (открытие); с несколькими — фокус на первый; Escape возвращает в ячейку', async () => {
    const p = props()
    renderK(<DataGrid {...p} />)
    await userEvent.tab()
    expect(cellOf(document.activeElement)).toBe('2:0')
    await userEvent.keyboard('{Enter}')
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Открыть запись 1')   // в служебной ячейке один интерактив (номер — текст) → фокус + клик
    expect(p.onOpen).toHaveBeenCalledWith(docs[0], { secondary: false, state: null })
    await userEvent.keyboard('{Escape}')
    expect(cellOf(document.activeElement)).toBe('2:0')
    expect(document.activeElement?.hasAttribute('data-cell')).toBe(true)
  })

  it('Enter на заголовке сортирует', async () => {
    const p = props()
    renderK(<DataGrid {...p} />)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowUp}{ArrowRight}{Enter}')
    expect(p.onSort).toHaveBeenCalledWith([{ key: 'num', dir: 'asc' }])
  })

  it('Shift+Enter на заголовке колонки с одним ключом добавляет уровень к существующей сортировке', async () => {
    const p = props({ sort: [{ key: 'other', dir: 'asc' }] })
    renderK(<DataGrid {...p} />)
    // sort непустой → над таблицей рендерятся чипы SortChips: их две кнопки (сменить/убрать) идут в таб-порядке перед ячейкой грида
    await userEvent.tab()
    await userEvent.tab()
    await userEvent.tab()
    await userEvent.keyboard('{ArrowUp}{ArrowRight}')
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
    expect(p.onSort).toHaveBeenCalledWith([{ key: 'other', dir: 'asc' }, { key: 'num', dir: 'asc' }])
  })

  it('Tab внутри ячейки заголовка доходит до ползунка ресайза; стрелка меняет ширину; Escape — в ячейку', async () => {
    const p = props()
    renderK(<DataGrid {...p} />)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowUp}{ArrowRight}{Enter}')      // фокус на кнопке сортировки «Номер», сортировка вызвана
    await userEvent.tab()
    expect(document.activeElement).toHaveAttribute('role', 'slider')
    await userEvent.keyboard('{ArrowRight}')
    expect(p.onResize).toHaveBeenCalledWith({ id: 'num', width: 128 })   // 120 по умолчанию + 8
    await userEvent.keyboard('{Escape}')
    expect(cellOf(document.activeElement)).toBe('1:1')
    expect(document.activeElement?.hasAttribute('data-cell')).toBe(true)
  })

  it('Tab внутри поповера «Состав колонок» не уводит фокус в ячейку шапки: событие из портала не наше', async () => {
    renderK(<DataGrid {...props({ selection: { mode: 'ids', ids: [] }, onSelect: vi.fn(), onSelectPage: vi.fn() })} />)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowUp}')
    expect(cellOf(document.activeElement)).toBe('1:0')
    await userEvent.keyboard('{Enter}')                              // два интерактива → фокус на первый (чекбокс страницы)
    expect(document.activeElement).toHaveAccessibleName('Выбрать все на странице')
    await userEvent.tab()
    expect(document.activeElement).toHaveAccessibleName('Состав колонок')
    await userEvent.keyboard('{Enter}')
    const dialog = screen.getByRole('dialog', { name: 'Состав колонок' })
    expect(dialog).toContainElement(document.activeElement as HTMLElement)   // фокус на поиске
    await userEvent.tab()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    expect(document.activeElement).toBe(within(dialog).getByRole('checkbox', { name: 'Номер' }))
  })

  it('смена страницы возвращает активную ячейку в начало', async () => {
    const p = props()
    const { rerender } = renderK(<DataGrid {...p} />)
    await userEvent.tab()
    // служебная колонка — на всю высоту записи (rowSpan): вниз из неё сразу на следующую запись, минуя свою сквозную строку
    await userEvent.keyboard('{ArrowDown}{ArrowRight}')
    expect(cellOf(document.activeElement)).toBe('4:1')
    rerender(<DataGrid {...p} page={2} />)
    expect(document.querySelector('[data-cell][tabindex="0"]')?.getAttribute('data-cell')).toBe('2:0')
  })

  it('сквозная строка без сегментов (колонка скрыта, остальные высокие) не рендерится: ↓/↑ ходят между записями', async () => {
    renderK(<DataGrid {...gapProps()} />)
    expect(document.querySelector('tbody[data-key="r1"]')!.querySelectorAll('tr')).toHaveLength(1)
    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '3')
    const b1 = cellWithText('r1', 'B1')
    b1.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(cellWithText('r2', 'B2'))
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(b1)
  })

  it('сквозная строка без сегментов: без нарушений axe', async () => {
    const { container } = renderK(<DataGrid {...gapProps()} />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('↓/↑ пропускают строки без ячеек (одни заглушки)', async () => {
    renderK(<HoleTable />)
    const first = screen.getByText('первая')
    first.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(screen.getByText('третья'))
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(first)
  })
})
