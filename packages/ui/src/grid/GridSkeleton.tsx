import type { CSSProperties } from 'react'
import { Skeleton } from '../state'
import { fillSegments, type SpanCell } from './GridRecord'
import s from './Grid.module.css'
import type { ColumnDef } from './types'

export type GridSkeletonProps<Row> = {
  visible: ColumnDef<Row>[]
  spanRows: SpanCell<Row>[][]
  rows: number
}

/**
 * Скелетон повторяет геометрию записи по построению: те же строки, те же lines.
 * Для AT он скрыт (aria-hidden, без aria-rowindex): пустые gridcell ничего не сообщают,
 * о загрузке говорит aria-busy на таблице.
 */
export function GridSkeleton<Row>({ visible, spanRows, rows }: GridSkeletonProps<Row>) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tbody key={i} className={s.record} aria-hidden="true">
          <tr role="row">
            <td role="gridcell" className={s.cell}><div className={[s.lead, s.leadSkeleton].join(' ')}><Skeleton.Line width={48} /></div></td>
            {visible.map((c) => (
              <td key={c.id} role="gridcell" className={s.cell}>
                <div className={[s.clamp, s.clampSkeleton].join(' ')} style={{ '--k-lines': String(c.lines ?? 1) } as CSSProperties}><Skeleton.Line lines={c.lines ?? 1} width="70%" /></div>
              </td>
            ))}
          </tr>
          {spanRows.map((segs, si) => (
            <tr key={si} role="row">
              <td role="gridcell" className={s.cell} />
              {fillSegments(segs, visible.length).map((seg, k) =>
                'filler' in seg
                  ? <td key={`f${k}`} className={s.filler} colSpan={seg.colSpan} aria-hidden="true" />
                  : <td key={seg.def.id} role="gridcell" className={s.cell} colSpan={seg.colSpan}><div className={[s.clamp, s.clampSkeleton].join(' ')} style={{ '--k-lines': String(seg.def.lines ?? 1) } as CSSProperties}><Skeleton.Line lines={(seg.def.lines ?? 1) as 1 | 2} width="58%" /></div></td>,
              )}
            </tr>
          ))}
        </tbody>
      ))}
    </>
  )
}
