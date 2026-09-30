import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react'
import { dayOf, formatDateText, isComplete, maskDateText, parseDateText, type DateFormat, type DateValue, type IsoDay } from './dateStr'

/** Подсказка формата: 'DD.MM.YYYY HH:mm' → 'дд.мм.гггг чч:мм'. */
export const placeholderOf = (format: DateFormat): string =>
  format.replace(/YYYY|DD|MM|HH|mm/g, (t) => ({ YYYY: 'гггг', DD: 'дд', MM: 'мм', HH: 'чч', mm: 'мм' })[t]!)

/** Правка текста с маской. Курсор встаёт после той же по счёту цифры, что и до маски; стёртый Backspace/Delete
 * одиночный разделитель тянет за собой соседнюю цифру — иначе маска вернула бы разделитель и клавиша «не работала бы». */
export function maskEdit(prev: string, raw: string, caret: number, inputType: string, format: DateFormat): { text: string; caret: number } {
  let digits = raw.replace(/\D/g, '')
  let before = raw.slice(0, caret).replace(/\D/g, '').length
  if (raw.length < prev.length && digits === prev.replace(/\D/g, '')) {
    if (inputType === 'deleteContentForward') digits = digits.slice(0, before) + digits.slice(before + 1)
    else if (before > 0) { digits = digits.slice(0, before - 1) + digits.slice(before); before -= 1 }
  }
  const text = maskDateText(digits, format)
  let pos = 0
  for (let n = 0; n < before && pos < text.length; pos++) if (/\d/.test(text.charAt(pos))) n++
  return { text, caret: pos }
}

/** Поле с маской: `edit` из onChange даёт новый текст и запоминает курсор, эффект ставит его после перерисовки
 * (React пишет value заново, и браузер уводит курсор в конец). `inputRef` — на само `<input>`. */
export function useMaskCaret() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const caret = useRef<number | null>(null)
  useLayoutEffect(() => {
    const el = inputRef.current
    if (caret.current !== null && el !== null && el === document.activeElement) el.setSelectionRange(caret.current, caret.current)
    caret.current = null
  })
  const edit = useCallback((e: ChangeEvent<HTMLInputElement>, prev: string, format: DateFormat): string => {
    const el = e.target
    const r = maskEdit(prev, el.value, el.selectionStart ?? el.value.length, (e.nativeEvent as Partial<InputEvent>).inputType ?? '', format)
    caret.current = r.caret
    return r.text
  }, [])
  return { inputRef, edit }
}

export type MaskedDateFieldProps = {
  value: DateValue
  onChange: (value: DateValue) => void
  format: DateFormat
  min?: IsoDay | undefined
  max?: IsoDay | undefined
  /** Полное, но невалидное или вне min/max — родитель подсвечивает рамку (без :has — Chromium 88). */
  onInvalidChange?: ((invalid: boolean) => void) | undefined
  id?: string | undefined
  'aria-label'?: string | undefined
  placeholder?: string | undefined
  disabled?: boolean | undefined
  className?: string | undefined
}

/** Текстовое поле даты по шаблону. Показывает набираемое, пока значение снаружи совпадает с тем, что поле само отдало;
 * внешняя смена значения перерисовывает текст из значения (как у числового поля панели, спека 1e §6.2). */
export const MaskedDateField = forwardRef<HTMLInputElement, MaskedDateFieldProps>(function MaskedDateField(
  { value, onChange, format, min, max, onInvalidChange, id, placeholder, disabled, className, ...aria }, ref,
) {
  const [typed, setTyped] = useState<{ text: string; snap: DateValue } | null>(null)
  const text = typed !== null && typed.snap === value ? typed.text : value ? formatDateText(value, format) : ''
  const inRange = (v: string) => (min === undefined || dayOf(v) >= min) && (max === undefined || dayOf(v) <= max)
  const parsed = parseDateText(text, format)
  const invalid = text !== '' && isComplete(text, format) && (parsed === null || !inRange(parsed))

  const { inputRef, edit } = useMaskCaret()
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  const report = useRef(onInvalidChange)
  useEffect(() => { report.current = onInvalidChange })
  useEffect(() => { report.current?.(invalid) }, [invalid])

  return (
    <input
      ref={inputRef}
      id={id}
      aria-label={aria['aria-label']}
      aria-invalid={invalid || undefined}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder ?? placeholderOf(format)}
      disabled={disabled}
      className={className}
      value={text}
      onChange={(e) => {
        const masked = edit(e, text, format)
        const p = parseDateText(masked, format)
        const next: DateValue = p !== null && inRange(p) ? p : ''
        setTyped({ text: masked, snap: next })
        if (next !== value) onChange(next)
      }}
    />
  )
})
