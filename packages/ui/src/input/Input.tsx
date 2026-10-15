import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { FieldBox, FieldInput, Prefix } from './parts'

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
    <FieldBox className={className} data-size={size} data-invalid={invalid || undefined}>
      {prefix && <Prefix aria-hidden="true">{prefix}</Prefix>}
      <FieldInput ref={ref} aria-invalid={invalid || undefined} {...rest} />
    </FieldBox>
  )
})
