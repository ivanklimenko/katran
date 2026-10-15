import { forwardRef, type SelectHTMLAttributes } from 'react'
import { FieldBox, FieldSelect } from './parts'

export type SelectOption = { value: string; label: string; disabled?: boolean | undefined }
export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  options: SelectOption[]
  size?: 's' | 'm' | 'l' | undefined
  placeholder?: string | undefined
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, size = 'm', placeholder, className, ...rest }, ref,
) {
  return (
    <FieldBox className={className} data-size={size}>
      <FieldSelect ref={ref} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      </FieldSelect>
    </FieldBox>
  )
})
