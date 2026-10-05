import { useEffect, useRef, useState } from 'react'
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
  disabled?: boolean | undefined
  /** Раньше этого времени нельзя («по» в тот же день, что «с»): такой ввод — invalid, наружу ''. */
  notBefore?: string | undefined
}

/** Время 'чч:мм' в поповере дат: неполное или невалидное — наружу ''. */
export function TimeField({ value, onChange, label, onEnter, disabled, notBefore }: TimeFieldProps) {
  const { inputRef, edit } = useMaskCaret()
  const [typed, setTyped] = useState<{ text: string; snap: string } | null>(null)
  // как у MaskedDateField: значение ушло от снимка — снимок сбрасывается и не воскресает
  if (typed !== null && typed.snap !== value) setTyped(null)
  const text = typed !== null && typed.snap === value ? typed.text : value
  const ok = (tm: string) => valid(tm) && (notBefore === undefined || notBefore === '' || tm >= notBefore)
  // граница сдвинулась под набранное время — значение догоняет поле (как у MaskedDateField); свежее читает из ref
  const live = useRef({ typed, value, ok, onChange })
  useEffect(() => { live.current = { typed, value, ok, onChange } })
  useEffect(() => {
    const { typed: t, value: v, ok: good, onChange: change } = live.current
    if (t === null || t.snap !== v || t.text.length !== 5) return
    const target = good(t.text) ? t.text : ''
    if (target === v) return
    setTyped({ text: t.text, snap: target })
    change(target)
  }, [notBefore])
  return (
    <Input
      ref={inputRef}
      size="s"
      aria-label={label}
      placeholder="чч:мм"
      inputMode="numeric"
      disabled={disabled}
      invalid={text.length === 5 && !ok(text)}
      value={text}
      onChange={(e) => {
        const masked = edit(e, text, 'HH:mm')
        const next = ok(masked) ? masked : ''
        setTyped({ text: masked, snap: next })
        if (next !== value) onChange(next)
      }}
      onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter() } }}
    />
  )
}
