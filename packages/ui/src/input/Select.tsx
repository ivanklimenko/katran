import { forwardRef, type SelectHTMLAttributes } from 'react'
import s from './Input.module.css'

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
    <span className={[s.field, s[`size${size.toUpperCase()}`], className].filter(Boolean).join(' ')}>
      <select ref={ref} className={s.select} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      </select>
    </span>
  )
})
