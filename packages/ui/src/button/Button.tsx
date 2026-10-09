import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { buttonClass } from './buttonClass'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | undefined
  size?: 's' | 'm' | 'l' | undefined
  /** Переключатель: aria-pressed. */
  pressed?: boolean | undefined
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'm', pressed, className, type = 'button', ...rest }, ref,
) {
  return <button ref={ref} type={type} className={buttonClass(variant, size, className)} aria-pressed={pressed} {...rest} />
})
