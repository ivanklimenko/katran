import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from 'react'
import { k } from '@katran/tokens'
import { styled } from '../styled'

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode
  className?: string
}

const Root = styled.a`
  color: ${k.val};
  text-decoration: none;

  &:hover,
  &:focus-visible {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: 1px;
  }
`

const blankTargetRel = ['noopener', 'noreferrer']

function linkRel(target: string | undefined, rel: string | undefined): string | undefined {
  if (target?.replace(/[A-Z]/g, (letter) => letter.toLowerCase()) !== '_blank') return rel

  const tokens = rel?.toLowerCase().split(/[\t\n\f\r ]+/) ?? []
  const missing = blankTargetRel.filter((token) => !tokens.includes(token))
  return [rel, ...missing].filter(Boolean).join(' ')
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ target, rel, ...rest }, ref) {
  return <Root ref={ref} target={target} rel={linkRel(target, rel)} {...rest} />
})
