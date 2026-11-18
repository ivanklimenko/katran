import { AmountRange, NumberRange, type AmountBound, type AmountRangeProps, type AmountRangeValue,
  type NumberRangeProps, type NumberRangeValue } from '../index'

const empty: AmountBound = null
const amounts: AmountRangeValue = { from: empty, to: 1000 }
const numbers: NumberRangeValue = { from: 0, to: null }
const amountProps: AmountRangeProps = { label: 'Сумма', value: amounts, onChange: ({ from }) => from?.toFixed(2), fraction: 2 }
const numberProps: NumberRangeProps = { label: 'Число', value: numbers, onChange: ({ to }) => to?.toFixed(0), step: 0.5 }

export const amountRange = <AmountRange {...amountProps} />
export const numberRange = <NumberRange {...numberProps} />

// @ts-expect-error Граница должна быть числом или null.
export const invalidNumberRange = <NumberRange {...numberProps} value={{ from: '', to: 20 }} />
