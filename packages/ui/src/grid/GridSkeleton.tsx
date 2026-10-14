import type { CSSProperties } from 'react'
import { Skeleton } from '../state'
import { fillSegments, type SpanCell } from './GridRecord'
import type { ColumnDef } from './types'

export type GridSkeletonProps<Row> = {
  visible: ColumnDef<Row>[]
  spanRows: SpanCell<Row>[][]
  rows: number
  /** Номер первой строки скелетона на странице: служебная ячейка каждой строки — firstOrd + i, как в записи. По умолчанию 1. */
  firstOrd?: number | undefined
}

/**
 * Скелетон повторяет геометрию записи по построению: те же строки, те же lines.
 * Для AT он скрыт (aria-hidden, без aria-rowindex): пустые gridcell ничего не сообщают,
 * о загрузке говорит aria-busy на таблице.
 */
export function GridSkeleton<Row>({ visible, spanRows, rows, firstOrd = 1 }: GridSkeletonProps<Row>) {
  const perRecord = 1 + spanRows.length
  const span = perRecord > 1 ? perRecord : undefined
  const tall = visible.map((c) => c.fullHeight === true)
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tbody key={i} className="k-record" aria-hidden="true">
          <tr role="row">
            <td role="gridcell" className="k-cell" rowSpan={span}><div className="k-lead k-lead-skeleton"><span className="k-ord">{firstOrd + i}</span></div></td>
            {visible.map((c) => (
              <td key={c.id} role="gridcell" className="k-cell" rowSpan={c.fullHeight ? span : undefined}>
                <div className="k-clamp k-clamp-skeleton" data-align={c.align} style={{ '--k-lines': String(c.lines ?? 1) } as CSSProperties}>
                  <Skeleton.Line lines={c.lines ?? 1} width="70%" align={c.align === 'right' ? 'right' : undefined} />
                </div>
              </td>
            ))}
          </tr>
          {spanRows.map((segs, si) => (
            <tr key={si} role="row">
              {fillSegments(segs, tall).map((seg, k) =>
                'filler' in seg
                  ? <td key={`f${k}`} className="k-filler" colSpan={seg.colSpan} aria-hidden="true" />
                  : <td key={seg.def.id} role="gridcell" className="k-cell" colSpan={seg.colSpan}><div className="k-clamp k-clamp-skeleton" style={{ '--k-lines': String(seg.def.lines ?? 1) } as CSSProperties}><Skeleton.Line lines={(seg.def.lines ?? 1) as 1 | 2} width="58%" /></div></td>,
              )}
            </tr>
          ))}
        </tbody>
      ))}
    </>
  )
}
