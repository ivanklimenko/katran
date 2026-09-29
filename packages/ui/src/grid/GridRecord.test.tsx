import { screen, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { fillSegments, GridRecord } from './GridRecord'
import { GridSkeleton } from './GridSkeleton'
import type { ColumnDef, SpanDef } from './types'

type R = { id: string; st: string; num: string; purpose: string | null }
const row: R = { id: 'r1', st: 'ERROR', num: '800', purpose: 'Оплата по договору' }
const columns: ColumnDef<R>[] = [
  { id: 'st', render: (r) => r.st },
  { id: 'num', title: 'Номер', lines: 2, render: (r) => r.num },
  { id: 'f50', title: '50', render: () => 'ООО Ромашка' },
  { id: 'f59', title: '59', align: 'right', render: () => 'ЗАО Василёк' },
]
const purpose: SpanDef<R> = { id: 'purpose', from: 'f50', to: 'f59', render: (r) => r.purpose }
const reason: SpanDef<R> = { id: 'reason', from: 'st', to: 'num', render: () => null }
const spanRows = [[{ def: reason, colStart: 0, colSpan: 2 }, { def: purpose, colStart: 2, colSpan: 2 }]]

const Table = ({ children }: { children: React.ReactNode }) => <table role="grid">{children}</table>

describe('GridRecord', () => {
  it('запись = tbody из основной строки и строк сегментов; сегменты с colspan; пустой сегмент не закрашен', () => {
    renderK(<Table><GridRecord row={row} rowKey="r1" visible={columns} spanRows={spanRows} lead={<button>Открыть</button>} rowIndex={2} /></Table>)
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveAttribute('aria-rowindex', '2')
    expect(rows[1]).toHaveAttribute('aria-rowindex', '3')
    expect(within(rows[0]!).getAllByRole('gridcell')).toHaveLength(5) // служебная + 4
    const segCells = within(rows[1]!).getAllByRole('gridcell')
    expect(segCells).toHaveLength(2) // 2 сегмента, служебной ячейки в сквозной строке больше нет
    expect(segCells[0]).toHaveAttribute('colspan', '2')
    expect(segCells[0]).toHaveAttribute('data-empty', 'true')
    expect(segCells[1]).toHaveTextContent('Оплата по договору')
  })
  it('кламп по lines и выравнивание вправо', () => {
    renderK(<Table><GridRecord row={row} rowKey="r1" visible={columns} spanRows={[]} lead={null} rowIndex={1} /></Table>)
    const cells = screen.getAllByRole('gridcell')
    expect(cells[2]!.firstElementChild).toHaveStyle({ '--k-lines': '2' })
    expect(cells[4]).toHaveAttribute('data-align', 'right')
  })
  it('выделение помечает обе строки', () => {
    renderK(<Table><GridRecord row={row} rowKey="r1" visible={columns} spanRows={spanRows} lead={null} rowIndex={1} selected /></Table>)
    screen.getAllByRole('row').forEach((r) => expect(r).toHaveAttribute('aria-selected', 'true'))
  })
  it('fillSegments закрывает пропуски заглушками', () => {
    const segs = [{ def: purpose, colStart: 2, colSpan: 1 }]
    expect(fillSegments(segs, 4)).toEqual([{ filler: true, colSpan: 2 }, segs[0], { filler: true, colSpan: 1 }])
  })
  it('fillSegments: заполнители только по колонкам первой строки, не через высокие', () => {
    const seg = { def: { id: 's', from: 'a', to: 'a', render: () => null }, colStart: 0, colSpan: 1 }
    // колонки: a(0) T(1, высокая) b(2) c(3)
    expect(fillSegments([seg], [false, true, false, false])).toEqual([seg, { filler: true, colSpan: 2 }])
    expect(fillSegments([], [false, true, false])).toEqual([{ filler: true, colSpan: 1 }, { filler: true, colSpan: 1 }])
    expect(fillSegments([seg], 3)).toEqual([seg, { filler: true, colSpan: 2 }])
  })
  it('высокая колонка и служебная — rowSpan на всю запись, во сквозной строке под ними ячеек нет', () => {
    type R = { a: string; t: string }
    const visibleTall: ColumnDef<R>[] = [{ id: 'a', render: (r) => r.a }, { id: 't', fullHeight: true, render: (r) => r.t }]
    const spanRowsTall = [[{ def: { id: 's', from: 'a', to: 'a', render: () => 'сегмент' }, colStart: 0, colSpan: 1 }]]
    renderK(<Table><GridRecord row={{ a: 'A', t: 'T' }} rowKey="k" visible={visibleTall} spanRows={spanRowsTall} lead="L" rowIndex={2} /></Table>)
    const rows = screen.getAllByRole('row')
    const [lead, a, t] = within(rows[0]!).getAllByRole('gridcell')
    expect(lead).toHaveAttribute('rowspan', '2')
    expect(a).not.toHaveAttribute('rowspan')
    expect(t).toHaveAttribute('rowspan', '2')
    expect(within(rows[1]!).getAllByRole('gridcell')).toHaveLength(1)
    expect(within(rows[1]!).getByRole('gridcell')).toHaveTextContent('сегмент')
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<Table><thead><tr><th scope="col">Служебная</th>{columns.map((c) => <th key={c.id} scope="col">{c.title || c.id}</th>)}</tr></thead><GridRecord row={row} rowKey="r1" visible={columns} spanRows={spanRows} lead={<button>Открыть</button>} rowIndex={2} /></Table>)
    expect(await axe(container)).toHaveNoViolations()
  })
  it('без нарушений axe на строке сегментов с заглушками по краям', async () => {
    const fillerSpanRows = [[{ def: purpose, colStart: 2, colSpan: 1 }]]
    const { container } = renderK(<Table><thead><tr><th scope="col">Служебная</th>{columns.map((c) => <th key={c.id} scope="col">{c.title || c.id}</th>)}</tr></thead><GridRecord row={row} rowKey="r1" visible={columns} spanRows={fillerSpanRows} lead={<button>Открыть</button>} rowIndex={2} /></Table>)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('GridSkeleton', () => {
  it('столько же tbody и строк, сколько у записей; весь скелетон скрыт от скринридера, без aria-rowindex', () => {
    renderK(<Table><GridSkeleton visible={columns} spanRows={spanRows} rows={3} firstOrd={1} /></Table>)
    const groups = screen.getAllByRole('rowgroup', { hidden: true })
    expect(groups).toHaveLength(3)
    groups.forEach((g) => expect(g).toHaveAttribute('aria-hidden', 'true'))
    const rows = screen.getAllByRole('row', { hidden: true })
    expect(rows).toHaveLength(6)
    rows.forEach((r) => expect(r).not.toHaveAttribute('aria-rowindex'))
    expect(screen.queryAllByRole('row')).toHaveLength(0)
  })
  it('резервирует геометрию записи: --k-lines и классы min-height у служебной ячейки и текстовых ячеек', () => {
    renderK(<Table><GridSkeleton visible={columns} spanRows={spanRows} rows={1} firstOrd={1} /></Table>)
    const cells = screen.getAllByRole('gridcell', { hidden: true })
    const lead = cells[0]!.firstElementChild
    expect(lead?.className).toMatch(/leadSkeleton/)
    const clamped = cells.map((c) => c.firstElementChild).filter((el): el is Element => el !== null)
    const numColClamp = clamped[2]! // lead(0), st(1), ячейка колонки "num" (lines: 2)
    expect(numColClamp.className).toMatch(/clampSkeleton/)
    expect(numColClamp).toHaveStyle({ '--k-lines': '2' })
    const purposeClamp = clamped[clamped.length - 1]! // сегмент "purpose" в строке спанов
    expect(purposeClamp.className).toMatch(/clampSkeleton/)
    expect(purposeClamp).toHaveStyle({ '--k-lines': '1' })
  })
  it('служебная ячейка — номера строк страницы (firstOrd + i), как в записи (класс ord)', () => {
    renderK(<Table><GridSkeleton visible={columns} spanRows={spanRows} rows={3} firstOrd={21} /></Table>)
    const groups = screen.getAllByRole('rowgroup', { hidden: true })
    const ords = groups.map((g) => within(g).getAllByRole('gridcell', { hidden: true })[0]!.querySelector('.ord')!.textContent)
    expect(ords).toEqual(['21', '22', '23'])
  })
  it('плашка колонки align: "right" прижата вправо (data-align на обёртке)', () => {
    renderK(<Table><GridSkeleton visible={columns} spanRows={spanRows} rows={1} firstOrd={1} /></Table>)
    const cells = screen.getAllByRole('gridcell', { hidden: true })
    const clamped = cells.map((c) => c.firstElementChild).filter((el): el is Element => el !== null)
    // lead(0), st(1), num(2), f50(3), f59(4, align: right)
    expect(clamped[4]!).toHaveAttribute('data-align', 'right')
    expect(clamped[1]!).not.toHaveAttribute('data-align')
  })
})
