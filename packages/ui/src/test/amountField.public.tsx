import { AmountField, type AmountFieldProps } from '../index'

const props: AmountFieldProps = {
  value: null,
  onChange: (value) => value?.toFixed(2),
  label: 'Сумма платежа',
  fraction: 2,
  size: 'm',
  invalid: undefined,
}

export const amountField = <AmountField {...props} />

// @ts-expect-error Значение суммы должно быть числом или null.
export const stringAmount = <AmountField {...props} value="12.50" />
