import { forwardRef, type ReactNode } from 'react'
import { Button, type ButtonProps } from './Button'
import s from './Button.module.css'

export type IconButtonProps = Omit<ButtonProps, 'children' | 'variant'> & {
  /** Доступное имя — обязательно: у иконки текста нет. */
  label: string
  children: ReactNode
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, className, ...rest }, ref,
) {
  return (
    <Button ref={ref} variant="ghost" aria-label={label} className={[s.icon, className].filter(Boolean).join(' ')} {...rest}>
      <span aria-hidden="true" className={s.glyph}>{children}</span>
    </Button>
  )
})
