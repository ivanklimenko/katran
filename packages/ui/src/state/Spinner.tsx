import { k } from '@katran/tokens'
import { css, keyframes, styled } from '../styled'

export type SpinnerProps = {
  /** Доступное имя индикатора. */
  label?: string | undefined
  size?: 's' | 'm' | 'l' | undefined
  /** Заполнить родителя и центрировать круг. */
  block?: boolean | undefined
  className?: string | undefined
}

const frames = css`
  to {
    transform: rotate(1turn);
  }
`
const spin = keyframes`${frames}`

const Ring = styled.span`
  box-sizing: border-box;
  width: ${k.iconM};
  height: ${k.iconM};
  flex-shrink: 0;
  border: 2px solid ${k.line};
  border-top-color: ${k.val};
  border-radius: 50%;
  animation: ${spin} ${k.tSpin} linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Root = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;

  &:where([data-block]) {
    display: flex;
    width: 100%;
    height: 100%;
  }

  &:where([data-size='s']) > ${Ring} {
    width: ${k.iconS};
    height: ${k.iconS};
  }

  &:where([data-size='l']) > ${Ring} {
    width: ${k.sp8};
    height: ${k.sp8};
  }
`

export function Spinner({ label = 'Загрузка', size = 'm', block, className }: SpinnerProps) {
  return (
    <Root role="status" aria-label={label} data-size={size} data-block={block ? '' : undefined} className={className}>
      <Ring aria-hidden="true" />
    </Root>
  )
}
