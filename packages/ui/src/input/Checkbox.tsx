import { forwardRef, useEffect, useImperativeHandle, useRef, type InputHTMLAttributes } from 'react'
import { styled } from '../styled'
import { k } from '@katran/tokens'

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string | undefined
  /** Третье состояние (часть записей выбрана). Только визуальное; checked остаётся как есть. */
  indeterminate?: boolean | undefined
}

// Чекбокс стоит в служебной ячейке каждой записи грида: шаблоны статические, без атрибутов-модификаторов.
const Check = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${k.sp2};
  cursor: pointer;
  font-size: ${k.fs1};
  color: ${k.ink};
`

const Box = styled.input`
  width: ${k.iconM};
  height: ${k.iconM};
  margin: 0;
  accent-color: ${k.val};
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: 1px;
  }
`

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, indeterminate = false, className, ...rest }, ref,
) {
  const inner = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => inner.current as HTMLInputElement)
  useEffect(() => { if (inner.current) inner.current.indeterminate = indeterminate }, [indeterminate])
  // Без подписи обёртки-label нет, и className некуда деть, кроме самого поля.
  const input = <Box ref={inner} type="checkbox" className={label ? undefined : className} {...rest} />
  if (!label) return input
  return <Check className={className}>{input}<span>{label}</span></Check>
})
