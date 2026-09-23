import { forwardRef, type ButtonHTMLAttributes } from 'react'
import s from './Button.module.css'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | undefined
  size?: 's' | 'm' | 'l' | undefined
  /** Переключатель: aria-pressed. */
  pressed?: boolean | undefined
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'm', pressed, className, type = 'button', ...rest }, ref,
) {
  const cls = [s.button, s[variant], s[`size${size.toUpperCase()}`], className].filter(Boolean).join(' ')
  return <button ref={ref} type={type} className={cls} aria-pressed={pressed} {...rest} />
})
