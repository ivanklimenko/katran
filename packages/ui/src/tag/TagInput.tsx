import { memo, useCallback, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { IconButton } from '../button'
import { useStableId } from '../compat/useStableId'
import is from '../input/Input.module.css'
import { Popover } from '../overlay'
import { useKatran } from '../provider/useKatran'
import { Cross, Listbox, optionId } from '../select/Listbox'
import { hasSeparator, mergeTags, splitTags, TAG_LIMIT, tagKey, takeTags, type TagMode } from './parseTags'
import s from './Tag.module.css'

export type TagInputProps = {
  /** Значения-чипы (в том числе невалидные: они подсвечены, в условие их не берёт владелец поля). */
  value: string[]
  onChange: (value: string[]) => void
  /** Набираемый, ещё не превращённый в чип текст — владелец поля учитывает его при применении. */
  text: string
  onTextChange: (text: string) => void
  /** values — ID, номера, коды (IN); phrases — фразы для поиска по вхождению (несколько LIKE по AND). */
  mode: TagMode
  /** Невалидное значение — красный чип, наружу не уходит. */
  validate?: ((v: string) => boolean) | undefined
  /** Предел числа чипов; по умолчанию values — 500 (IN контракта), phrases — 20. */
  max?: number | undefined
  /** Подсказки с бека; вместе с onQuery делают строку ввода комбобоксом. */
  suggestions?: string[] | undefined
  loading?: boolean | undefined
  /** Ввод текста — запрос подсказок. */
  onQuery?: ((query: string) => void) | undefined
  onSuggestClose?: (() => void) | undefined
  disabled?: boolean | undefined
  size?: 's' | 'm' | undefined
  id?: string | undefined
  'aria-label'?: string | undefined
  placeholder?: string | undefined
}

/** Сколько чипов входит в описание строки ввода; дальше — «ещё N» (при 500 значениях описание не должно быть простынёй). */
const DESCRIBED = 10

type ChipProps = { id: string; value: string; index: number; bad: boolean; selected: boolean; disabled: boolean; onRemove: (index: number) => void }

/** Чип под memo: при наборе текста 500 чипов не перерисовываются — пропы плоские, onRemove стабилен. */
const Chip = memo(function Chip({ id, value, index, bad, selected, disabled, onRemove }: ChipProps) {
  return (
    <li className={s.tag} data-selected={selected || undefined} data-invalid={bad || undefined}>
      <span id={id} className={s.tagText}>{value}{bad && <span className={s.sr}>, неверное значение</span>}</span>
      {!disabled && <IconButton size="s" tabIndex={-1} label={`Убрать: ${value}`} className={s.tagX} onClick={() => onRemove(index)}><Cross /></IconButton>}
    </li>
  )
})

/** Несколько значений или фраз свободным вводом (спека §5): чипы, разбор вставки, подсказки с бека. */
export function TagInput({ value, onChange, text, onTextChange, mode, validate, max, suggestions, loading, onQuery, onSuggestClose, disabled, size = 'm', id, placeholder, ...aria }: TagInputProps) {
  const limit = max ?? TAG_LIMIT[mode]
  const name = aria['aria-label'] ?? 'Значения'
  const listId = useStableId()
  const noteId = useStableId()
  const chipsId = useStableId()
  const { announce } = useKatran()
  const anchor = useRef<HTMLSpanElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [sel, setSel] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  // IME: пока идёт составной ввод, разделители не делят — текст разбирается по compositionend
  const composing = useRef(false)

  const withSuggest = onQuery !== undefined || suggestions !== undefined
  // Подсказки, уже стоящие чипами, и повторы в ответе не показываются; сравнение — по правилу повторов режима.
  const taken = new Set(value.map((v) => tagKey(v, mode)))
  const items: string[] = []
  for (const x of suggestions ?? []) {
    const k = tagKey(x, mode)
    if (!taken.has(k)) { taken.add(k); items.push(x) }
  }
  // Список открыт после ввода или ↓ (не фокусом), пока есть подсказки или идёт загрузка; пустой ответ и ошибка — закрыт.
  const listOpen = withSuggest && open && !disabled && (items.length > 0 || loading === true)
  const activeItem = listOpen && active >= 0 ? items[active] : undefined
  // Значение могли сменить снаружи (сброс фильтра) — выделение за концом не действует.
  const selected = sel !== null && sel < value.length ? sel : null
  // Строка о пределе — пока предел достигнут.
  const shownNote = value.length >= limit ? note : ''

  const describedBy = [
    ...value.slice(0, DESCRIBED).map((_, i) => `${chipsId}-c${i}`),
    ...(value.length > DESCRIBED ? [`${chipsId}-more`] : []),
    ...(shownNote ? [noteId] : []),
  ].join(' ') || undefined
  // Ключи чипов: значение уникально после mergeTags, но внешнее значение может прийти с повтором.
  const seen = new Map<string, number>()
  const keys = value.map((v) => {
    const n = seen.get(v) ?? 0
    seen.set(v, n + 1)
    return n === 0 ? v : `${v}\u0000${n}`
  })

  /** Добавить чипы; вернуть число не вошедших из-за предела. */
  const add = (tags: string[]): number => {
    if (tags.length === 0) return 0
    const r = mergeTags(value, tags, mode, limit)
    if (r.added > 0) onChange(r.value)
    if (r.dropped > 0) {
      const msg = r.added > 0 ? `Добавлено ${r.added} из ${r.added + r.dropped}: больше нельзя` : `Не добавлено: предел ${limit}`
      setNote(msg)
      announce(msg)
    } else {
      setNote('')
      if (r.added === 0) announce(tags.length === 1 ? `Уже есть: ${tags[0]!}` : 'Уже есть')
      else announce(r.added === 1 ? `Добавлено: ${r.value[r.value.length - 1]!}` : `Добавлено: ${r.added}`)
    }
    return r.dropped
  }
  const closeSuggest = () => {
    setOpen(false)
    setActive(-1)
    if (withSuggest) onSuggestClose?.()
  }
  // Сверх предела набранное не пропадает: остаётся текстом рядом со строкой о пределе.
  const addText = (tags: string[]) => { if (add(tags) === 0) onTextChange('') }
  const commit = () => { addText(splitTags(text, mode)); closeSuggest() }
  const pick = (x: string) => { addText([x]); setSel(null); closeSuggest() }
  const select = (i: number | null) => {
    setSel(i)
    if (i !== null) announce(`Выделено: ${value[i]!}`)
  }
  // Клавиатурой: Backspace выделяет соседа слева, Delete — справа; объявление — снятое и новое выделение.
  const removeByKey = (i: number, back: boolean) => {
    const next = value.filter((_, j) => j !== i)
    const to = next.length === 0 ? null : back ? (i > 0 ? i - 1 : null) : Math.min(i, next.length - 1)
    onChange(next)
    setNote('')
    setSel(to)
    announce(`Убрано: ${value[i]!}${to !== null ? `; выделено: ${next[to]!}` : ''}`)
  }
  const removeByClick = (i: number) => {
    onChange(value.filter((_, j) => j !== i))
    setNote('')
    setSel(null)
    announce(`Убрано: ${value[i]!}`)
    input.current?.focus()
  }
  // Стабильный обработчик ✕ для memo-чипов; актуальное замыкание — через ref, обновляемый в эффекте (не в рендере).
  const removeRef = useRef(removeByClick)
  useEffect(() => { removeRef.current = removeByClick })
  const onRemove = useCallback((i: number) => removeRef.current(i), [])

  const onInput = (raw: string, ime: boolean) => {
    setSel(null)
    if (ime) { onTextChange(raw); return }
    setActive(-1)
    setOpen(true)
    const { tags, rest } = takeTags(raw, mode)
    // Разделитель без значения (пробел или запятая в пустой строке) тоже срезается: хвост — rest.
    const next = add(tags) === 0 ? rest : raw
    onTextChange(next)
    onQuery?.(next)
  }
  // Вставка, которая делится на несколько чипов (колонка или строка из Excel, цепочка фраз в кавычках), разбирается
  // целиком вместе с набранным; одно значение (в том числе `ООО «Ромашка»`) — обычная вставка текстом.
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text')
    if (!hasSeparator(pasted, mode)) return
    e.preventDefault()
    const el = e.currentTarget
    const whole = text.slice(0, el.selectionStart ?? text.length) + pasted + text.slice(el.selectionEnd ?? text.length)
    add(splitTags(whole, mode))
    onTextChange('')
    setSel(null)
    closeSuggest()
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        if (listOpen) {
          e.preventDefault()
          setActive(e.key === 'ArrowDown' ? Math.min(active + 1, items.length - 1) : Math.max(active - 1, 0))
        } else if (e.key === 'ArrowDown' && withSuggest) {
          e.preventDefault()
          setOpen(true)
          onQuery?.(text)
        }
        return
      case 'Enter':
        if (activeItem !== undefined) { e.preventDefault(); pick(activeItem); return }
        // пустой текст — Enter уходит в форму (применить фильтр, спека §6.6)
        if (text.trim() !== '') { e.preventDefault(); commit() }
        return
      case 'Tab':
        // Tab — разделитель значений: чип, и фокус идёт дальше; фразу Tab не режет
        if (mode === 'values' && text.trim() !== '') commit()
        return
      default:
    }
    // По чипам — только из пустой строки: в тексте стрелки и Backspace работают как обычно.
    if (text !== '' || value.length === 0) return
    const last = value.length - 1
    switch (e.key) {
      case 'Backspace':
        e.preventDefault()
        if (selected === null) select(last); else removeByKey(selected, true)
        return
      case 'Delete':
        if (selected !== null) { e.preventDefault(); removeByKey(selected, false) }
        return
      case 'ArrowLeft':
        e.preventDefault()
        select(selected === null ? last : Math.max(selected - 1, 0))
        return
      case 'ArrowRight':
        if (selected !== null) { e.preventDefault(); select(selected < last ? selected + 1 : null) }
        return
      case 'Escape':
        if (selected !== null) setSel(null)
        return
      default:
    }
  }
  // Рамка: клик мимо строки ввода (подпись чипа, отступ) переводит фокус в неё; ✕ фокус не забирает — он остаётся в строке.
  const onFrameDown = (e: MouseEvent<HTMLSpanElement>) => {
    if (disabled || e.button !== 0 || (e.target as Element).closest('input')) return
    e.preventDefault()
    if (!(e.target as Element).closest('button')) input.current?.focus()
  }

  return (
    <span className={s.tagBox}>
      {/* role=presentation: рамка лишь ловит всплывший mousedown, сама не интерактивна (jsx-a11y) */}
      <span ref={anchor} role="presentation" data-size={size} onMouseDown={onFrameDown} className={[is.field, size === 's' ? is.sizeS : is.sizeM, s.tagField].join(' ')}>
        {value.length > 0 && (
          <ul className={s.tags} aria-label={name}>
            {value.map((v, i) => (
              <Chip key={keys[i]} id={`${chipsId}-c${i}`} value={v} index={i} bad={validate !== undefined && !validate(v)}
                selected={selected === i} disabled={disabled === true} onRemove={onRemove} />
            ))}
          </ul>
        )}
        <input
          ref={input}
          id={id}
          aria-label={name}
          role={withSuggest ? 'combobox' : undefined}
          aria-expanded={withSuggest ? listOpen : undefined}
          aria-controls={listOpen ? listId : undefined}
          aria-autocomplete={withSuggest ? 'list' : undefined}
          aria-activedescendant={activeItem !== undefined ? optionId(listId, active) : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          disabled={disabled}
          className={[is.input, s.tagInput].join(' ')}
          placeholder={value.length === 0 ? placeholder : undefined}
          value={text}
          onChange={(e) => onInput(e.target.value, composing.current || (e.nativeEvent as Partial<InputEvent>).isComposing === true)}
          onCompositionStart={() => { composing.current = true }}
          onCompositionEnd={(e) => { composing.current = false; onInput(e.currentTarget.value, false) }}
          onKeyDown={onKey}
          onPaste={onPaste}
          onBlur={() => { setSel(null); closeSuggest() }}
        />
      </span>
      {/* «ещё N» — только для описания строки ввода: hidden не читается в обзоре, но берётся по aria-describedby */}
      {value.length > DESCRIBED && <span id={`${chipsId}-more`} hidden>{`ещё ${value.length - DESCRIBED}`}</span>}
      {shownNote && <span id={noteId} className={s.note}>{shownNote}</span>}
      {withSuggest && (
        <Popover open={listOpen} anchor={anchor} onClose={closeSuggest} role="presentation" className={s.pop}>
          <Listbox
            id={listId}
            label={`Подсказки: ${name}`}
            options={items.map((x) => ({ value: x, label: x }))}
            active={activeItem !== undefined ? active : -1}
            isSelected={() => false}
            onPick={(o) => pick(String(o.value))}
            onActive={setActive}
            emptyText="Ищу…"
            highlight={text}
          />
        </Popover>
      )}
    </span>
  )
}
