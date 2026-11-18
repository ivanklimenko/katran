import { AmountField } from './AmountField'
import { finiteBound, isReversed, RangeFields, rangeLabels } from './rangeParts'

export type AmountBound = number | null
export type AmountRangeValue = { from: AmountBound; to: AmountBound }

export type AmountRangeProps = {
  value: AmountRangeValue
  onChange: (value: AmountRangeValue) => void
  label: string
  fraction?: number | undefined
  size?: 's' | 'm' | 'l' | undefined
  disabled?: boolean | undefined
  invalid?: boolean | undefined
  className?: string | undefined
}

export function AmountRange({ value, onChange, label, fraction, size, disabled, invalid, className }: AmountRangeProps) {
  const fieldProps = { fraction, size, disabled, invalid: invalid || isReversed(finiteBound(value.from), finiteBound(value.to)) }

  return (
    <RangeFields
      label={label}
      className={className}
      from={<AmountField {...fieldProps} label={rangeLabels.from} value={value.from} onChange={(from) => onChange({ from, to: value.to })} />}
      to={<AmountField {...fieldProps} label={rangeLabels.to} value={value.to} onChange={(to) => onChange({ from: value.from, to })} />}
    />
  )
}
