import { forwardRef, type ReactNode } from 'react'
import { k } from '@katran/tokens'
import { styled } from '../styled'
import { Button, type ButtonProps } from './Button'

export type IconButtonProps = Omit<ButtonProps, 'children' | 'variant'> & {
  /** Доступное имя — обязательно: у иконки текста нет. */
  label: string
  children: ReactNode
}

const Glyph = styled.span`
  display: inline-grid;
  place-items: center;

  & > svg {
    width: ${k.iconS};
    height: ${k.iconS};
  }
`

/** Кнопка-значок: ghost-кнопка с data-icon (квадратная, без отступа — правило в шаблоне кнопки). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, ...rest }, ref,
) {
  return (
    <Button ref={ref} variant="ghost" aria-label={label} data-icon="" {...rest}>
      <Glyph aria-hidden="true">{children}</Glyph>
    </Button>
  )
})
