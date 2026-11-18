import { createContext, useContext, type ReactNode } from 'react'
import { k } from '@katran/tokens'
import { styled } from '../styled'

export type TextVariant = 'body' | 'subhead' | 'caption' | 'meta' | 'inline'
export type TextWeight = 'regular' | 'medium' | 'bold'

export type TextProps = {
  variant?: TextVariant
  weight?: TextWeight
  tone?: 'ink' | 'ink2' | 'muted'
  as?: 'p' | 'span' | 'h2' | 'div'
  className?: string
  children: ReactNode
}

const defaultTags = {
  body: 'p',
  subhead: 'h2',
  caption: 'span',
  meta: 'span',
  inline: 'span',
} as const

const InsideParagraph = createContext(false)

const Root = styled.span`
  font: 400 ${k.fs1} / ${k.lh1} ${k.sans};
  color: ${k.ink};

  &:where([data-variant='subhead']) {
    font-size: ${k.fsH2};
  }

  &:where([data-variant='caption']) {
    font-size: ${k.fs2};
    line-height: ${k.lh2};
  }

  &:where([data-variant='meta']) {
    font-size: ${k.fs3};
    line-height: ${k.lh3};
  }

  &:where([data-weight='medium']) {
    font-weight: 500;
  }

  &:where([data-weight='bold']) {
    font-weight: 700;
  }

  &:where([data-tone='ink2']) {
    color: ${k.ink2};
  }

  &:where([data-tone='muted']) {
    color: ${k.muted};
  }
`

export function Text({
  variant = 'body', weight = variant === 'subhead' ? 'medium' : 'regular',
  tone = 'ink', as = defaultTags[variant], className, children,
}: TextProps) {
  const tag = useContext(InsideParagraph) ? 'span' : as
  const content = (
    <Root as={tag} className={className} data-variant={variant} data-weight={weight} data-tone={tone}>
      {children}
    </Root>
  )

  return tag === 'p' ? <InsideParagraph.Provider value>{content}</InsideParagraph.Provider> : content
}
