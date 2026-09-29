import type { CSSProperties } from 'react'
import { Skeleton } from '../state'
import { fillSegments, type SpanCell } from './GridRecord'
import s from './Grid.module.css'
import type { ColumnDef } from './types'

export type GridSkeletonProps<Row> = {
  visible: ColumnDef<Row>[]
  spanRows: SpanCell<Row>[][]
  rows: number
  /** Номер первой строки скелетона на странице: служебная ячейка каждой строки — firstOrd + i, как в записи. */
  firstOrd: number
}

/**
 * Скелетон повторяет геометрию записи по построению: те же строки, те же lines.
 * Для AT он скрыт (aria-hidden, без aria-rowindex): пустые gridcell ничего не сообщают,
 * о загрузке говорит aria-busy на таблице.
 */
export function GridSkeleton<Row>({ visible, spanRows, rows, firstOrd }: GridSkeletonProps<Row>) {
  const perRecord = 1 + spanRows.length
  const span = perRecord > 1 ? perRecord : undefined
  const tall = visible.map((c) => c.fullHeight === true)
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tbody key={i} className={s.record} aria-hidden="true">
          <tr role="row">
            <td role="gridcell" className={s.cell} rowSpan={span}><div className={[s.lead, s.leadSkeleton].join(' ')}><span className={s.ord}>{firstOrd + i}</span></div></td>
            {visible.map((c) => (
              <td key={c.id} role="gridcell" className={s.cell} rowSpan={c.fullHeight ? span : undefined}>
                <div className={[s.clamp, s.clampSkeleton].join(' ')} data-align={c.align} style={{ '--k-lines': String(c.lines ?? 1) } as CSSProperties}>
                  <Skeleton.Line lines={c.lines ?? 1} width="70%" align={c.align === 'right' ? 'right' : undefined} />
                </div>
              </td>
            ))}
          </tr>
          {spanRows.map((segs, si) => (
            <tr key={si} role="row">
              {fillSegments(segs, tall).map((seg, k) =>
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
