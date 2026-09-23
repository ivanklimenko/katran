import type { CSSProperties } from 'react'
import s from './State.module.css'

type LineProps = { width?: string | number; lines?: 1 | 2 | 3; height?: 's' | 'm' }
const w = (v: string | number | undefined): string | undefined =>
  v === undefined ? undefined : typeof v === 'number' ? `calc(${v}px * var(--k-density))` : v

function Line({ width = '70%', lines = 1, height = 'm' }: LineProps) {
  return (
    <span aria-hidden="true" className={s.lines}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={[s.line, s[`h${height.toUpperCase()}`]].join(' ')} style={{ width: w(i === lines - 1 ? width : '100%') } as CSSProperties} />
      ))}
    </span>
  )
}
function Block({ height }: { height: number }) {
  return <span aria-hidden="true" className={s.block} style={{ height: w(height) } as CSSProperties} />
}
export const Skeleton = { Line, Block }
/** Класс для приглушения уже показанных данных на время обновления. */
export const dimClass = s.dim
