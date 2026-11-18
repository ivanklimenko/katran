import { styled } from '../styled'
import { Input } from './Input'
import { finiteBound, isReversed, RangeFields, rangeLabels } from './rangeParts'

export type NumberRangeValue = { from: number | null; to: number | null }

export type NumberRangeProps = {
  value: NumberRangeValue
  onChange: (value: NumberRangeValue) => void
  label: string
  step?: number | undefined
  size?: 's' | 'm' | 'l' | undefined
  disabled?: boolean | undefined
  invalid?: boolean | undefined
  className?: string | undefined
}

const BoundInput = styled(Input)`
  & > input {
    text-align: left;
  }
`

export function NumberRange({ value, onChange, label, step = 1, size, disabled, invalid, className }: NumberRangeProps) {
  const from = finiteBound(value.from)
  const to = finiteBound(value.to)
  const fieldProps = { step, size, disabled, invalid: invalid || isReversed(from, to) }

  return (
    <RangeFields
      label={label}
      className={className}
      from={<BoundInput {...fieldProps} aria-label={rangeLabels.from} type="number" value={from ?? ''}
        onChange={(event) => onChange({ from: finiteBound(event.currentTarget.valueAsNumber), to: value.to })} />}
      to={<BoundInput {...fieldProps} aria-label={rangeLabels.to} type="number" value={to ?? ''}
        onChange={(event) => onChange({ from: value.from, to: finiteBound(event.currentTarget.valueAsNumber) })} />}
    />
  )
}
