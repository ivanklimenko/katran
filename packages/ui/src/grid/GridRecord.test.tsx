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
    expect(segCells).toHaveLength(3) // служебная + 2 сегмента
    expect(segCells[1]).toHaveAttribute('colspan', '2')
    expect(segCells[1]).toHaveAttribute('data-empty', 'true')
    expect(segCells[2]).toHaveTextContent('Оплата по договору')
  })
  it('кламп по lines и выравнивание вправо', () => {
    renderK(<Table><GridRecord row={row} rowKey="r1" visible={columns} spanRows={[]} lead={null} rowIndex={1} /></Table>)
    const cells = screen.getAllByRole('gridcell')
    expect(cells[2]!.firstElementChild).toHaveStyle({ '--lines': '2' })
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
  it('без нарушений axe', async () => {
    const { container } = renderK(<Table><thead><tr><th scope="col">Служебная</th>{columns.map((c) => <th key={c.id} scope="col">{c.title || c.id}</th>)}</tr></thead><GridRecord row={row} rowKey="r1" visible={columns} spanRows={spanRows} lead={<button>Открыть</button>} rowIndex={2} /></Table>)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('GridSkeleton', () => {
  it('столько же tbody и строк, сколько у записей; плашки скрыты от скринридера', () => {
    const { container } = renderK(<Table><GridSkeleton visible={columns} spanRows={spanRows} rows={3} rowIndexStart={1} /></Table>)
    expect(container.querySelectorAll('tbody')).toHaveLength(3)
    expect(screen.getAllByRole('row')).toHaveLength(6)
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
  })
})
