import type { ReactNode } from 'react'
import { k } from '@katran/tokens'
import { styled } from '../styled'

const Group = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${k.fieldGap};
`

const Bound = styled.label`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${k.sp1};
`

const Caption = styled.span`
  color: ${k.muted};
  font: 400 ${k.fs2} / ${k.lh2} ${k.sans};
`

export const rangeLabels = { from: 'От', to: 'До' } as const

type RangeFieldsProps = {
  label: string
  className?: string | undefined
  from: ReactNode
  to: ReactNode
}

export function RangeFields({ label, className, from, to }: RangeFieldsProps) {
  return (
    <Group role="group" aria-label={label} className={className}>
      <Bound><Caption>{rangeLabels.from}</Caption>{from}</Bound>
      <Bound><Caption>{rangeLabels.to}</Caption>{to}</Bound>
    </Group>
  )
}

export function finiteBound(value: number | null): number | null {
  return Number.isFinite(value) ? value : null
}

export function isReversed(from: number | null, to: number | null): boolean {
  return from !== null && to !== null && from > to
}
