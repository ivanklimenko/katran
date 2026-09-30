import { useState } from 'react'
import { Input } from '../input'
import { useMaskCaret } from './MaskedDateField'

const valid = (t: string) => /^\d{2}:\d{2}$/.test(t) && Number(t.slice(0, 2)) <= 23 && Number(t.slice(3)) <= 59

export type TimeFieldProps = {
  /** 'чч:мм' или ''. */
  value: string
  onChange: (value: string) => void
  label: string
  /** Enter в поле — поповер дат закрывается (спека §3.5). */
  onEnter?: (() => void) | undefined
}

/** Время 'чч:мм' в поповере дат: неполное или невалидное — наружу ''. */
export function TimeField({ value, onChange, label, onEnter }: TimeFieldProps) {
  const { inputRef, edit } = useMaskCaret()
  const [typed, setTyped] = useState<{ text: string; snap: string } | null>(null)
  const text = typed !== null && typed.snap === value ? typed.text : value
  return (
    <Input
      ref={inputRef}
      size="s"
      aria-label={label}
      placeholder="чч:мм"
      inputMode="numeric"
      invalid={text.length === 5 && !valid(text)}
      value={text}
      onChange={(e) => {
        const masked = edit(e, text, 'HH:mm')
        const next = valid(masked) ? masked : ''
        setTyped({ text: masked, snap: next })
        if (next !== value) onChange(next)
      }}
      onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter() } }}
    />
  )
}
