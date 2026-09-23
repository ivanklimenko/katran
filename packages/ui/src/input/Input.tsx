import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import s from './Input.module.css'

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> & {
  size?: 's' | 'm' | 'l' | undefined
  invalid?: boolean | undefined
  /** Иконка или текст слева от поля (например, лупа поиска). */
  prefix?: ReactNode | undefined
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'm', invalid, prefix, className, ...rest }, ref,
) {
  return (
    <span className={[s.field, s[`size${size.toUpperCase()}`], invalid ? s.invalid : '', className].filter(Boolean).join(' ')}>
      {prefix && <span aria-hidden="true" className={s.prefix}>{prefix}</span>}
      <input ref={ref} className={s.input} aria-invalid={invalid || undefined} {...rest} />
    </span>
  )
})
