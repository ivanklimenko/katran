import type { CSSProperties } from 'react'
import { k } from '@katran/tokens'
import { css, keyframes, styled } from '../styled'

type LineProps = {
  width?: string | number | undefined
  lines?: 1 | 2 | 3 | undefined
  height?: 's' | 'm' | undefined
  /** Прижимает плашку к правому краю обёртки — под колонку с align: 'right'. */
  align?: 'right' | undefined
  className?: string | undefined
}
const w = (v: string | number | undefined): string | undefined =>
  v === undefined ? undefined : typeof v === 'number' ? `calc(${v}px * var(--k-density))` : v

const pulseFrames = css`
  50% {
    opacity: 0.55;
  }
`
const pulse = keyframes`${pulseFrames}`

/** Плашка скелетона — общие правила строки и блока (прежде `.line, .block`). */
const bar = css`
  display: block;
  border-radius: ${k.rS};
  background: ${k.chip};
  animation: ${pulse} 1.2s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Lines = styled.span`
  display: inline-flex;
  flex-direction: column;
  gap: ${k.sp1};
  width: 100%;
  vertical-align: middle;

  /* плашка колонки align: 'right' (сумма) — прижата к правому краю обёртки, как значение записи */
  &[data-align='right'] {
    align-items: flex-end;
  }
`

/** Высота строки — атрибутом data-h (прежде классы .hS/.hM) под :where(): специфичность прежних классов (0,1,0). */
const LineBar = styled.span`
  ${bar}

  &:where([data-h='s']) {
    height: ${k.fs3};
  }

  &:where([data-h='m']) {
    height: ${k.fs1};
  }
`

const BlockBar = styled.span`
  ${bar}

  width: 100%;
`

function Line({ width = '70%', lines = 1, height = 'm', align, className }: LineProps) {
  return (
    <Lines aria-hidden="true" className={className} data-align={align}>
      {Array.from({ length: lines }, (_, i) => (
        <LineBar key={i} data-h={height} style={{ width: w(i === lines - 1 ? width : '100%') } as CSSProperties} />
      ))}
    </Lines>
  )
}

function Block({ height, className }: { height: number; className?: string | undefined }) {
  return <BlockBar aria-hidden="true" className={className} style={{ height: w(height) } as CSSProperties} />
}

export const Skeleton = { Line, Block }

export { dimClass } from './dim'
