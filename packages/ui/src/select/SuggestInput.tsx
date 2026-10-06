import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useStableId } from '../compat/useStableId'
import { Popover } from '../overlay'
import { Listbox, optionId } from './Listbox'
import { filterOptions, type Option } from './options'
import s from './Select.module.css'

/** Строк в выдаче по умолчанию (SUGGEST_MAX эталона). */
const SUGGEST_MAX = 5

export type SuggestInputProps = {
  options: Option[]
  /** Текст поля (управляемый). */
  value: string
  onChange: (text: string) => void
  onCommit: (option: Option) => void
  onCancel: () => void
  'aria-label': string
  /** Строка списка, если совпадений нет. */
  emptyText: (query: string) => string
  /** Ошибка Enter без совпадения. */
  notInListText: string
  /** По умолчанию — вхождение без регистра в подпись, подсказку и значение (filterOptions). */
  match?: ((option: Option, query: string) => boolean) | undefined
  /** Применяется к вводу до onChange (счёт — только цифры). */
  sanitize?: ((text: string) => string) | undefined
  /** Строк в выдаче; по умолчанию 5. */
  max?: number | undefined
  /** Хвост под списком; по умолчанию (n) => `ещё ${n} — уточните номер`. */
  moreText?: ((rest: number) => string) | undefined
  /** Под полем слева; при ошибке вместо него — ошибка. */
  hint?: ReactNode | undefined
  /** Под полем справа: '↑↓ Enter · Esc'. */
  keysHint?: string | undefined
  /** Вместо списка: загрузка / ошибка с «Повторить». */
  status?: ReactNode | undefined
  placeholder?: string | undefined
  /** По умолчанию true: фокус в поле при монтировании. */
  autoFocus?: boolean | undefined
}

const same = (text: string) => text
const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
const focusables = (box: HTMLElement | null): HTMLElement[] => (box ? Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)) : [])
const moreDefault = (n: number) => `ещё ${n} — уточните номер`

/**
 * Одно значение только из списка (спека 2c §2.1, эталон accSuggest): поле role=combobox, список открыт всё время правки.
 * ↑↓ — по кругу; Enter — активный → единственный в выдаче → точное совпадение введённого → иначе ошибка notInListText.
 * Esc, pointerdown вне поля со строкой под ним и списка (onClose поповера) и Tab — onCancel. Список привязан к обёртке поля
 * со строкой подсказки (Д63): подсказка видна над списком целиком, клик по ней — внутри якоря. Esc ловит поповер в фазе захвата со stopPropagation:
 * до обработчиков деталки он не доходит, а DrawerStack пропускает Esc из поля (OWN_ESCAPE) — фокус в поле.
 * Исключение — фокусируемое в status («Повторить»): Tab из поля ведёт на него, Shift+Tab с первого — обратно в поле,
 * Tab с последнего и Esc на нём — onCancel. Esc там ловится на window в захвате — раньше DrawerStack на document.
 */
export function SuggestInput({
  options, value, onChange, onCommit, onCancel, emptyText, notInListText, match, sanitize = same, max = SUGGEST_MAX,
  moreText = moreDefault, hint, keysHint, status, placeholder, autoFocus = true, ...aria
}: SuggestInputProps) {
  const name = aria['aria-label']
  const listId = useStableId()
  const noteId = useStableId()
  const keysId = useStableId()
  const moreId = useStableId()
  const statusId = useStableId()
  const input = useRef<HTMLInputElement>(null)
  const anchor = useRef<HTMLDivElement>(null)
  const statusBox = useRef<HTMLDivElement>(null)
  const onCancelRef = useRef(onCancel)
  useEffect(() => { onCancelRef.current = onCancel })
  const [active, setActive] = useState(-1)
  const [invalid, setInvalid] = useState(false)
  const [width, setWidth] = useState(0)

  const query = sanitize(value)
  const shown = match ? options.filter((o) => match(o, query)) : filterOptions(options, query)
  const visible = shown.slice(0, max)
  const rest = shown.length - visible.length
  const listed = status === undefined
  const current = listed && active >= 0 && active < visible.length ? active : -1

  useEffect(() => { if (autoFocus) input.current?.focus() }, [autoFocus])

  // Ширина списка — не меньше поля (min-width: max(100%, sug-w) эталона); поповер в портале, 100% от поля CSS не достать.
  useLayoutEffect(() => {
    const el = input.current
    if (!el) return
    const measure = () => setWidth(el.getBoundingClientRect().width)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Клавиши на фокусируемом внутри status: поповер в портале, поэтому порядок Tab и Esc задаются здесь.
  useEffect(() => {
    if (listed) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      const box = statusBox.current
      const t = e.target
      if (!box || !(t instanceof Node) || !box.contains(t)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCancelRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const all = focusables(box)
      if (e.shiftKey && t === all[0]) { e.preventDefault(); input.current?.focus() } else if (!e.shiftKey && t === all[all.length - 1]) onCancelRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [listed])

  const commit = (o: Option) => { setInvalid(false); onCommit(o) }
  const enter = () => {
    if (current >= 0) return commit(visible[current]!)
    if (shown.length === 1) return commit(shown[0]!)
    const exact = options.find((o) => String(o.value) === query)
    if (exact) return commit(exact)
    setInvalid(true)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = listed ? visible.length : 0
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (n > 0) setActive(current < 0 ? 0 : (current + 1) % n)
        return
      case 'ArrowUp':
        e.preventDefault()
        if (n > 0) setActive(current < 0 ? n - 1 : (current - 1 + n) % n)
        return
      case 'Enter':
        // Enter в комбобоксе форму не отправляет (спека §6.6)
        e.preventDefault()
        if (listed) enter()
        return
      case 'Tab': {
        const first = e.shiftKey ? undefined : focusables(statusBox.current)[0]
        if (first) { e.preventDefault(); first.focus() } else onCancel()
        return
      }
      default:
    }
  }

  const described = [
    hint !== undefined || invalid ? noteId : null,
    keysHint !== undefined ? keysId : null,
    listed && rest > 0 ? moreId : null,
    listed ? null : statusId,
  ].filter(Boolean).join(' ')
  return (
    <div ref={anchor} className={s.sugBox}>
      <input
        ref={input}
        role="combobox"
        aria-label={name}
        aria-autocomplete="list"
        aria-expanded={listed}
        aria-controls={listed ? listId : undefined}
        aria-activedescendant={current >= 0 ? optionId(listId, current) : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={described || undefined}
        autoComplete="off"
        spellCheck={false}
        className={s.sugInput}
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(sanitize(e.target.value)); setActive(-1); setInvalid(false) }}
        onKeyDown={onKey}
      />
      {/* строка под полем есть всегда: живая область ошибки должна существовать до её появления */}
      <div className={s.sugNote}>
        <span id={noteId} className={invalid ? s.sugBad : undefined} aria-live="polite">{invalid ? notInListText : hint}</span>
        {keysHint !== undefined && <span id={keysId}>{keysHint}</span>}
      </div>
      <Popover open anchor={anchor} onClose={onCancel} role="presentation" className={s.sug}>
        <div style={{ minWidth: width }}>
          {listed
            ? (
              <>
                <Listbox
                  id={listId}
                  label={name}
                  options={visible}
                  active={current}
                  isSelected={(o) => o === visible[current]}
                  onPick={commit}
                  onActive={setActive}
                  emptyText={emptyText(query)}
                  highlight={query}
                />
                {rest > 0 && <div id={moreId} className={s.sugMore}>{moreText(rest)}</div>}
              </>
            )
            : <div ref={statusBox} id={statusId} className={s.sugStatus}>{status}</div>}
        </div>
      </Popover>
    </div>
  )
}
