import { TimeField, type TimeFieldProps } from '../index'

const props: TimeFieldProps = {
  label: 'Время',
  value: '09:30:15',
  onChange: (value) => value.toUpperCase(),
  seconds: true,
  size: 'm',
  className: 'time-field',
}

export const timeField = <TimeField {...props} />

// @ts-expect-error Полю нужно доступное имя.
export const unlabeledTimeField = <TimeField value="" onChange={() => {}} />
