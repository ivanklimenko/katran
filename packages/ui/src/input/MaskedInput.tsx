import { useReducer } from 'react'
import { useMaskCaret } from '../date/MaskedDateField'
import { Input } from './Input'

export type MaskedInputProps = {
  /** 9 — слот ASCII-цифры. Остальные символы — литералы. */
  mask: string
  /** Введённый префикс с литералами маски или пустая строка. */
  value: string
  onChange: (value: string) => void
  label: string
  size?: 's' | 'm' | 'l' | undefined
  disabled?: boolean | undefined
  invalid?: boolean | undefined
  className?: string | undefined
}

type Edit = { start: number; end: number; inserted: string }
type MaskedEdit = { text: string; caret: number }

/** Каретка после нативной правки отделяет изменённую часть от прежнего хвоста. */
function inputEdit(previous: string, raw: string, caret: number, data?: string | null): Edit {
  const suffix = raw.slice(caret)
  if (!previous.endsWith(suffix)) return { start: 0, end: previous.length, inserted: raw }

  const end = previous.length - suffix.length
  const prefix = raw.slice(0, caret)
  const limit = Math.min(end, data && prefix.endsWith(data) ? caret - data.length : caret)
  let start = 0
  while (start < limit && previous.charAt(start) === raw.charAt(start)) start++
  return { start, end, inserted: raw.slice(start, caret) }
}

/** Автоподстановка и история ввода могут сразу вернуть готовый префикс маски. */
function isFormattedPrefix(mask: string, text: string): boolean {
  if (text === '') return true
  if (mask.charAt(text.length - 1) !== '9') return false
  for (let position = 0; position < text.length; position++) {
    const token = mask.charAt(position)
    const char = text.charAt(position)
    if (token === '9' ? !/[0-9]/.test(char) : token !== char) return false
  }
  return true
}

function applyEdit(mask: string, value: string, { start, end, inserted }: Edit, inputType?: string): MaskedEdit {
  const additions = inserted.replace(/\D/g, '')
  if (inserted !== '' && additions === '') return { text: value, caret: start }

  const slots: number[] = []
  let before = ''
  let after = ''
  let removedDigit = false
  for (let position = 0; position < mask.length; position++) {
    if (mask.charAt(position) !== '9') continue
    slots.push(position)
    const digit = value.charAt(position)
    if (!/[0-9]/.test(digit)) continue
    if (position < start) before += digit
    else if (position >= end) after += digit
    else removedDigit = true
  }

  // Если клавиша стёрла лишь литерал, удаляем соседнюю цифру. Маска восстановит литерал по слотам.
  if (inserted === '' && end > start && !removedDigit) {
    if (inputType === 'deleteContentBackward') before = before.slice(0, -1)
    if (inputType === 'deleteContentForward') after = after.slice(1)
  }

  const digits = (before + additions + after).slice(0, slots.length)
  const last = slots[digits.length - 1]
  let index = 0
  const text = last === undefined ? '' : mask.slice(0, last + 1).replace(/9/g, () => digits.charAt(index++))
  const caretSlot = slots[Math.min(before.length + additions.length, digits.length) - 1]
  return { text, caret: caretSlot === undefined ? 0 : caretSlot + 1 }
}

export function MaskedInput({ mask, value, onChange, label, size, disabled, invalid, className }: MaskedInputProps) {
  const { inputRef, setCaret } = useMaskCaret()
  // Нужен рендер и для отброшенного символа, когда контролируемое значение не меняется.
  const [, renderEdit] = useReducer((revision: number) => revision + 1, 0)

  function commit(next: MaskedEdit, previousCaret: number) {
    setCaret((text) => {
      if (text === next.text) return next.caret
      if (text === value) return previousCaret
      return undefined
    })
    renderEdit()
    if (next.text !== value) onChange(next.text)
  }

  return (
    <Input
      ref={inputRef}
      aria-label={label}
      inputMode="numeric"
      value={value}
      size={size}
      disabled={disabled}
      invalid={invalid}
      className={className}
      onChange={(event) => {
        const input = event.currentTarget
        const { data, inputType } = event.nativeEvent as Partial<InputEvent>
        const raw = input.value
        const caret = input.selectionStart ?? raw.length
        const edit = inputEdit(value, raw, caret, data)
        const replacement = (data == null || data === raw) && !inputType?.startsWith('delete')
        const next = replacement && isFormattedPrefix(mask, raw)
          ? { text: raw, caret }
          : applyEdit(mask, value, edit, inputType)
        commit(next, edit.start)
      }}
      onPaste={(event) => {
        event.preventDefault()
        const inserted = event.clipboardData.getData('text/plain')
        if (!/[0-9]/.test(inserted)) return
        const input = event.currentTarget
        const start = input.selectionStart ?? value.length
        const edit = { start, end: input.selectionEnd ?? start, inserted }
        commit(applyEdit(mask, value, edit), start)
      }}
    />
  )
}
