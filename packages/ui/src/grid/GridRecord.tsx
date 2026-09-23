import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import s from './Grid.module.css'
import type { ColumnDef, SpanDef } from './types'

export type SpanCell<Row> = { def: SpanDef<Row>; colStart: number; colSpan: number }
export type Filler = { filler: true; colSpan: number }
/** Атрибуты ячейки от клавиатурного слоя: r — строка внутри записи (0 — основная), c — колонка (0 — служебная). */
export type CellProps = (r: number, c: number) => HTMLAttributes<HTMLTableCellElement>

export type GridRecordProps<Row> = {
  row: Row
  rowKey: string
  /** Видимые колонки в пользовательском порядке. */
  visible: ColumnDef<Row>[]
  /** Строки сегментов, уже разрешённые по видимому составу. */
  spanRows: SpanCell<Row>[][]
  /** Содержимое служебной ячейки: чекбокс, кнопка открытия, номер. */
  lead: ReactNode
  selected?: boolean | undefined
  /** aria-rowindex первой строки записи. */
  rowIndex: number
  cellProps?: CellProps | undefined
}

/** Между сегментами и по краям — заглушки, чтобы строка занимала всю ширину таблицы. */
export function fillSegments<Row>(segs: SpanCell<Row>[], colCount: number): Array<SpanCell<Row> | Filler> {
  const out: Array<SpanCell<Row> | Filler> = []
  let cursor = 0
  for (const seg of segs) {
    if (seg.colStart > cursor) out.push({ filler: true, colSpan: seg.colStart - cursor })
    out.push(seg)
    cursor = seg.colStart + seg.colSpan
  }
  if (cursor < colCount) out.push({ filler: true, colSpan: colCount - cursor })
  return out
}

export function GridRecord<Row>({ row, rowKey, visible, spanRows, lead, selected, rowIndex, cellProps }: GridRecordProps<Row>) {
  const cp = cellProps ?? (() => ({}))
  return (
    <tbody className={[s.record, selected ? s.selected : ''].filter(Boolean).join(' ')} data-key={rowKey}>
      <tr role="row" aria-rowindex={rowIndex} aria-selected={selected}>
        <td role="gridcell" className={s.cell} {...cp(0, 0)}><div className={s.lead}>{lead}</div></td>
        {visible.map((c, i) => (
          <td key={c.id} role="gridcell" className={s.cell} data-align={c.align} {...cp(0, i + 1)}>
            <div className={s.clamp} style={{ '--lines': String(c.lines ?? 1) } as CSSProperties}>{c.render(row)}</div>
          </td>
        ))}
      </tr>
      {spanRows.map((segs, si) => (
        <tr key={si} role="row" aria-rowindex={rowIndex + 1 + si} aria-selected={selected}>
          <td role="gridcell" className={s.cell} {...cp(si + 1, 0)} />
          {fillSegments(segs, visible.length).map((seg, k) => {
            if ('filler' in seg) return <td key={`f${k}`} className={s.filler} colSpan={seg.colSpan} aria-hidden="true" />
            const content = seg.def.render(row)
            return (
              <td key={seg.def.id} role="gridcell" className={s.cell} colSpan={seg.colSpan} data-empty={content == null ? 'true' : undefined} {...cp(si + 1, seg.colStart + 1)}>
                <div className={content == null ? s.spanEmpty : s.clamp} style={{ '--lines': String(seg.def.lines ?? 1) } as CSSProperties}>{content}</div>
              </td>
            )
          })}
        </tr>
      ))}
    </tbody>
  )
}
