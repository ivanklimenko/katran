import { useEffect, useRef, useState } from 'react'
import { Input } from '../input'
import { useMaskCaret } from './MaskedDateField'

const minutePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const secondPattern = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/

function formatSeconds(digits: string): string {
  return digits.slice(0, 6).match(/\d{1,2}/g)?.join(':') ?? ''
}

export type TimeFieldProps = {
  /** 'чч:мм', 'чч:мм:сс' или ''. */
  value: string
  onChange: (value: string) => void
  label: string
  seconds?: boolean | undefined
  size?: 's' | 'm' | 'l' | undefined
  onEnter?: (() => void) | undefined
  disabled?: boolean | undefined
  /** Нижняя граница в формате поля. Невалидный ввод передаётся как ''. */
  notBefore?: string | undefined
  className?: string | undefined
}

export function TimeField({
  value, onChange, label, seconds = false, size = 's', onEnter, disabled, notBefore, className,
}: TimeFieldProps) {
  const { inputRef, edit } = useMaskCaret()
  const [typed, setTyped] = useState<{ text: string; snap: string; seconds: boolean } | null>(null)
  const draft = typed !== null && typed.snap === value && typed.seconds === seconds ? typed : null
  if (typed !== draft) setTyped(null)

  const text = draft?.text ?? value
  const length = seconds ? 8 : 5
  const pattern = seconds ? secondPattern : minutePattern
  const ok = (time: string) => pattern.test(time) && (!notBefore || (pattern.test(notBefore) && time >= notBefore))

  // При сдвиге границы переоцениваем полный черновик. Ref хранит свежие пропсы и проверку формата.
  const live = useRef({ draft, value, ok, onChange, length })
  useEffect(() => { live.current = { draft, value, ok, onChange, length } })
  useEffect(() => {
    const { draft: current, value: previous, ok: valid, onChange: change, length: fullLength } = live.current
    if (current === null || current.text.length !== fullLength) return
    const next = valid(current.text) ? current.text : ''
    if (next === previous) return
    setTyped({ ...current, snap: next })
    change(next)
  }, [notBefore])

  return (
    <Input
      ref={inputRef}
      size={size}
      className={className}
      aria-label={label}
      placeholder={seconds ? 'чч:мм:сс' : 'чч:мм'}
      inputMode="numeric"
      disabled={disabled}
      invalid={text.length >= length && !ok(text)}
      value={text}
      onChange={(event) => {
        const masked = edit(event, text, seconds ? formatSeconds : 'HH:mm')
        const next = ok(masked) ? masked : ''
        setTyped({ text: masked, snap: next, seconds })
        if (next !== value) onChange(next)
      }}
      onKeyDown={(event) => { if (event.key === 'Enter' && onEnter) { event.preventDefault(); onEnter() } }}
    />
  )
}
