import { forwardRef, useEffect, useImperativeHandle, useRef, type InputHTMLAttributes } from 'react'
import s from './Input.module.css'

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string | undefined
  /** Третье состояние (часть записей выбрана). Только визуальное; checked остаётся как есть. */
  indeterminate?: boolean | undefined
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, indeterminate = false, className, ...rest }, ref,
) {
  const inner = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => inner.current as HTMLInputElement)
  useEffect(() => { if (inner.current) inner.current.indeterminate = indeterminate }, [indeterminate])
  // Без подписи обёртки-label нет, и className некуда деть, кроме самого поля.
  const input = <input ref={inner} type="checkbox" className={[s.checkbox, label ? '' : className].filter(Boolean).join(' ')} {...rest} />
  if (!label) return input
  return <label className={[s.check, className].filter(Boolean).join(' ')}>{input}<span>{label}</span></label>
})
