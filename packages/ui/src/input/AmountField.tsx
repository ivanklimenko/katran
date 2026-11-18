import { useState } from 'react'
import { formatAmount } from '../format/amount'
import { styled } from '../styled'
import { Input } from './Input'

export type AmountFieldProps = {
  value: number | null
  onChange: (value: number | null) => void
  label: string
  fraction?: number | undefined
  size?: 's' | 'm' | 'l' | undefined
  disabled?: boolean | undefined
  invalid?: boolean | undefined
  placeholder?: string | undefined
  className?: string | undefined
}

const Field = styled(Input)`
  & > input {
    text-align: right;
  }
`

// На фокусе число должно оставаться десятичным даже при малых значениях.
const rawAmount = new Intl.NumberFormat('en-US', { useGrouping: false, maximumSignificantDigits: 21 })
const decimal = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/

function parseAmount(text: string): number | null {
  if (!decimal.test(text)) return null
  const amount = Number(text)
  return Number.isFinite(amount) ? amount : null
}

export function AmountField({
  value, onChange, label, fraction = 2, size, disabled, invalid, placeholder, className,
}: AmountFieldProps) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState<{ text: string; value: number | null } | null>(null)

  // Эхо последнего ввода сохраняет черновик. Новое внешнее значение заменяет его.
  const current = draft !== null && draft.value === value ? draft : null
  if (draft !== current) setDraft(null)

  const invalidDraft = current !== null && current.value === null && current.text !== ''
  const amount = value !== null && Number.isFinite(value) ? value : null
  const precision = Number.isInteger(fraction) && fraction >= 0 && fraction <= 100 ? fraction : 2

  let text = ''
  if (current !== null && (focused || invalidDraft)) text = current.text
  else if (amount !== null) text = focused ? rawAmount.format(amount) : formatAmount(amount, precision)

  return (
    <Field
      aria-label={label} inputMode="decimal" size={size} disabled={disabled} placeholder={placeholder}
      className={className} invalid={invalid || invalidDraft || (value !== null && amount === null)}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        if (!invalidDraft) setDraft(null)
      }}
      onChange={(event) => {
        const nextText = event.currentTarget.value
        const next = parseAmount(nextText)
        setDraft({ text: nextText, value: next })
        onChange(next)
      }}
    />
  )
}
