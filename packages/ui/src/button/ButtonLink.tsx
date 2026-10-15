import { forwardRef, type AnchorHTMLAttributes } from 'react'
import { ButtonBase } from './Button'

export type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: 'primary' | 'ghost' | undefined
  size?: 's' | 'm' | 'l' | undefined
}

/** Ссылка, выглядящая как Button (<a> того же styled-компонента с теми же атрибутами варианта и размера): переход, а не действие. */
export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  { variant = 'ghost', size = 'm', children, ...rest }, ref,
) {
  return <ButtonBase as="a" ref={ref} data-variant={variant} data-size={size} {...rest}>{children}</ButtonBase>
})
