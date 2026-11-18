import { forwardRef, type ReactNode } from 'react'
import { k } from '@katran/tokens'
import { Icon, type IconName } from '../icon'
import { styled } from '../styled'
import { Button, type ButtonProps } from './Button'

export type IconButtonProps = Omit<ButtonProps, 'children' | 'variant' | 'name'> & {
  /** Доступное имя — обязательно: у иконки текста нет. */
  label: string
} & (
  | { children: ReactNode; name?: ButtonProps['name'] }
  | { children?: never; name: IconName }
)

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
  props, ref,
) {
  const { label, children, name, ...rest } = props
  // Даже явно переданный пустой children сохраняет старую семантику name кнопки.
  const glyph = 'children' in props ? children : <Icon name={props.name} size="s" />
  return (
    <Button ref={ref} variant="ghost" aria-label={label} data-icon="" name={'children' in props ? name : undefined} {...rest}>
      <Glyph aria-hidden="true">{glyph}</Glyph>
    </Button>
  )
})
