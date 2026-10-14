import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { styled } from '../styled'
import { k } from '@katran/tokens'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | undefined
  size?: 's' | 'm' | 'l' | undefined
  /** Переключатель: aria-pressed. */
  pressed?: boolean | undefined
}

/**
 * Кнопка кита — общая для Button, IconButton и ButtonLink (ссылка рендерит тот же компонент с as="a").
 * Вариант, размер и значок — атрибутами data-variant, data-size и data-icon под :where(): специфичность прежних
 * классов-модификаторов (.sizeS, .primary, .icon — (0,1,0)) сохраняется, переопределение потребителя равной
 * специфичностью их перебивает. IconButton стоит в служебной ячейке каждой записи грида — без своей styled-обёртки.
 */
export const ButtonBase = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${k.sp1};
  padding: 0 ${k.sp3};
  border: 1px solid transparent;
  border-radius: ${k.rM};
  font: 500 ${k.fs1} / 1 ${k.sans};
  cursor: pointer;
  white-space: nowrap;
  text-decoration: none; /* <a> в ButtonLink */
  transition: background ${k.tFast}, border-color ${k.tFast}, color ${k.tFast};

  &:where([data-size='s']) {
    height: ${k.hCtlS};
    font-size: ${k.fs2};
    padding: 0 ${k.sp2};
  }

  &:where([data-size='m']) {
    height: ${k.hCtlM};
  }

  &:where([data-size='l']) {
    height: ${k.hCtlL};
  }

  &:where([data-variant='primary']) {
    background: ${k.val};
    border-color: ${k.val};
    color: ${k.paper};
  }

  &:where([data-variant='ghost']) {
    background: ${k.paper};
    border-color: ${k.line};
    color: ${k.ink2};
  }

  /* кнопка-значок (IconButton): квадратная, без отступа — после размера, при равной специфичности перебивает его отступ */
  &:where([data-icon]) {
    padding: 0;
    aspect-ratio: 1;
    justify-content: center;
  }

  /* aria-disabled — недоступна, но держит фокус (действие в полёте: кнопка не теряет клавиатуру, F5 деталки работает) */
  &:disabled,
  &[aria-disabled='true'] {
    opacity: 0.5;
    cursor: default;
  }

  &:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: 1px;
  }

  &:where([data-variant='primary']):hover:not(:disabled, [aria-disabled='true']) {
    filter: brightness(0.95);
  }

  &:where([data-variant='ghost']):hover:not(:disabled, [aria-disabled='true']) {
    border-color: ${k.val};
    color: ${k.val};
  }

  &:where([data-variant='ghost'])[aria-pressed='true'] {
    background: ${k.valSoft};
    border-color: ${k.val};
    color: ${k.val};
  }
`

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'm', pressed, type = 'button', ...rest }, ref,
) {
  return <ButtonBase ref={ref} type={type} data-variant={variant} data-size={size} aria-pressed={pressed} {...rest} />
})
