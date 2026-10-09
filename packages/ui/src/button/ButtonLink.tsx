import { forwardRef, type AnchorHTMLAttributes } from 'react'
import { buttonClass } from './buttonClass'

export type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: 'primary' | 'ghost' | undefined
  size?: 's' | 'm' | 'l' | undefined
}

/** Ссылка, выглядящая как Button (<a> с теми же классами варианта и размера): переход, а не действие. */
export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  { variant = 'ghost', size = 'm', className, children, ...rest }, ref,
) {
  return <a ref={ref} className={buttonClass(variant, size, className)} {...rest}>{children}</a>
})
