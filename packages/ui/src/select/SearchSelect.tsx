import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { IconButton } from '../button'
import { useStableId } from '../compat/useStableId'
import type { Scalar } from '../filters/types'
import is from '../input/Input.module.css'
import { Popover } from '../overlay'
import { Chevron, Cross, Listbox, optionId } from './Listbox'
import { filterOptions, sameScalar, type Option } from './options'
import s from './Select.module.css'

export type SearchSelectProps = {
  options: Option[]
  value: Scalar | null
  onChange: (value: Scalar | null) => void
  /** «Не выбрано». */
  placeholder?: string | undefined
  /** Кнопка ✕ «Очистить»; по умолчанию true. */
  clearable?: boolean | undefined
  /** Поле поиска; по умолчанию — если вариантов больше 7. */
  searchable?: boolean | undefined
  disabled?: boolean | undefined
  size?: 's' | 'm' | undefined
  id?: string | undefined
  'aria-label'?: string | undefined
}

/** Одно значение из справочника (спека §4.2): с поиском — input role=combobox, без — кнопка role=combobox. */
export function SearchSelect({ options, value, onChange, placeholder = 'Не выбрано', clearable = true, searchable, disabled, size = 'm', id, ...aria }: SearchSelectProps) {
  const withSearch = searchable ?? options.length > 7
  const name = aria['aria-label'] ?? 'Выбор'
  const listId = useStableId()
  const anchor = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const shown = withSearch ? filterOptions(options, query) : options
  const isSelected = (o: Option) => value !== null && sameScalar(o.value, value)
  // Значения может не быть среди вариантов (справочник подгрузится позже) — тогда видно само значение.
  const display = value === null ? '' : options.find(isSelected)?.label ?? String(value)

  const focusControl = () => (inputRef.current ?? buttonRef.current)?.focus()
  const openList = () => { setOpen(true); setActive(Math.max(0, shown.findIndex(isSelected))) }
  const close = () => { setOpen(false); setQuery(''); setActive(-1) }
  const pick = (o: Option) => { onChange(o.value); close() }
  const clear = () => { onChange(null); close(); focusControl() }
  // Подпись выбранного выделена, пока поле в фокусе и список закрыт: ввод заменяет её и становится запросом.
  // Фокус выделяет в onFocus; после выбора (список закрылся, фокус остался) — здесь.
  useEffect(() => {
    const el = inputRef.current
    if (!open && el && document.activeElement === el) el.select()
  }, [open])
  // Спека §4.2: буква — к первому пункту на неё; если активный уже на эту букву — к следующему по кругу.
  const typeahead = (ch: string) => {
    const n = shown.length
    const c = ch.toLowerCase()
    const starts = (i: number) => shown[i]!.label.toLowerCase().startsWith(c)
    const from = active >= 0 && active < n && starts(active) ? active + 1 : 0
    for (let k = 0; k < n; k++) {
      const i = (from + k) % n
      if (starts(i)) { setActive(i); return }
    }
  }
  // Клик по рамке вне поля (шеврон, отступ) — фокус в поле и открыть/закрыть список; кнопка «Очистить» и само поле — свои обработчики.
  const onFrameDown = (e: MouseEvent<HTMLSpanElement>) => {
    if (disabled || e.button !== 0 || (e.target as Element).closest('button, input')) return
    e.preventDefault()
    focusControl()
    if (open) close(); else openList()
  }
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    const last = shown.length - 1
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); if (!open) openList(); else setActive(Math.min(active + 1, last)); return
      case 'ArrowUp': e.preventDefault(); if (open) setActive(Math.max(active - 1, 0)); return
      case 'Home': if (open) { e.preventDefault(); setActive(0) } return
      case 'End': if (open) { e.preventDefault(); setActive(last) } return
      case 'Enter':
        // Enter в комбобоксе форму не отправляет (спека §6.6)
        e.preventDefault()
        if (open && shown[active]) pick(shown[active]!); else if (!open && !withSearch) openList()
        return
      case ' ':
        if (withSearch) return
        e.preventDefault()
        if (open && shown[active]) pick(shown[active]!); else openList()
        return
      case 'Tab': if (open) close(); return
      case 'Delete':
      case 'Backspace':
        if (!open && clearable && value !== null && (!withSearch || e.key === 'Delete')) { e.preventDefault(); onChange(null) }
        return
      default:
        if (!withSearch && open && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) typeahead(e.key)
    }
  }

  const combo = {
    id,
    role: 'combobox' as const,
    'aria-label': name,
    'aria-expanded': open,
    'aria-controls': open ? listId : undefined,
    'aria-activedescendant': open && active >= 0 && shown[active] ? optionId(listId, active) : undefined,
    disabled,
    onKeyDown: onKey,
  }
  return (
    <>
      {/* role=presentation: рамка лишь ловит всплывший mousedown, сама не интерактивна (jsx-a11y) */}
      <span ref={anchor} role="presentation" onMouseDown={onFrameDown} className={[is.field, size === 's' ? is.sizeS : is.sizeM, s.selField].join(' ')}>
        {withSearch
          ? (
            <input
              {...combo}
              ref={inputRef}
              aria-autocomplete="list"
              autoComplete="off"
              className={is.input}
              placeholder={open && display !== '' ? display : placeholder}
              value={open ? query : display}
              onFocus={(e) => e.target.select()}
              onClick={() => { if (!open) openList() }}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0) }}
            />
          )
          : (
            <button {...combo} ref={buttonRef} type="button" aria-haspopup="listbox" className={s.selBtn} onClick={() => (open ? close() : openList())}>
              {value !== null ? display : <span className={s.ph}>{placeholder}</span>}
            </button>
          )}
        {clearable && value !== null && !disabled && <IconButton size="s" tabIndex={-1} label="Очистить" className={s.clear} onClick={clear}><Cross /></IconButton>}
        <span className={s.chev} aria-hidden="true"><Chevron /></span>
      </span>
      <Popover open={open} anchor={anchor} onClose={close} role="presentation" className={s.pop}>
        <Listbox id={listId} label={name} options={shown} active={active} isSelected={isSelected} onPick={pick} onActive={setActive} />
      </Popover>
    </>
  )
}
