import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Button, IconButton } from '../button'
import { useStableId } from '../compat/useStableId'
import type { Scalar } from '../filters/types'
import { Input } from '../input'
import is from '../input/Input.module.css'
import { Popover } from '../overlay'
import { Chevron, Cross, Listbox, optionId } from './Listbox'
import { filterOptions, sameScalar, type Option } from './options'
import s from './Select.module.css'

export type MultiSelectProps = {
  options: Option[]
  value: Scalar[]
  onChange: (value: Scalar[]) => void
  placeholder?: string | undefined
  /** Сколько чипов видно в поле; дальше «+N». По умолчанию 2. */
  maxChips?: number | undefined
  /** Предел выбора; 1 — одиночный выбор в том же виде. По умолчанию без предела. */
  max?: number | undefined
  disabled?: boolean | undefined
  size?: 's' | 'm' | undefined
  id?: string | undefined
  'aria-label'?: string | undefined
}

/** Несколько значений из справочника (спека §4.3): чипы в поле, поиск и список с отметками в поповере. */
export function MultiSelect({ options, value, onChange, placeholder = 'Не выбрано', maxChips = 2, max, disabled, size = 'm', id, ...aria }: MultiSelectProps) {
  const name = aria['aria-label'] ?? 'Выбор'
  const listId = useStableId()
  const popId = useStableId()
  const anchor = useRef<HTMLSpanElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const shown = filterOptions(options, query)
  const has = (v: Scalar) => value.some((x) => sameScalar(x, v))

  // порядок значения — порядок справочника (условие IN стабильно); значения не из справочника — в конце
  const ordered = (next: Scalar[]) => [
    ...options.filter((o) => next.some((v) => sameScalar(v, o.value))).map((o) => o.value),
    ...next.filter((v) => !options.some((o) => sameScalar(o.value, v))),
  ]
  // Значения может не быть среди вариантов (справочник подгрузится позже) — тогда чип показывает само значение и снимается.
  const chips = ordered(value).map((v) => ({ value: v, label: options.find((o) => sameScalar(o.value, v))?.label ?? String(v) }))
  const remove = (v: Scalar) => onChange(value.filter((x) => !sameScalar(x, v)))
  const removeLast = () => { const last = chips[chips.length - 1]; if (last) remove(last.value) }
  const toggle = (o: Option) => {
    if (max === 1) { onChange(has(o.value) ? [] : [o.value]); return }
    if (has(o.value)) { remove(o.value); return }
    if (max !== undefined && value.length >= max) return
    onChange(ordered([...value, o.value]))
  }
  const openList = () => { setOpen(true); setActive(0) }
  const close = () => { setOpen(false); setQuery(''); setActive(0) }
  const pickActive = () => { const o = shown[active]; if (o) toggle(o) }

  // Клик по рамке вне кнопок (подпись чипа, «+N», отступ) — как клик по полю; ✕ чипа и само поле — свои обработчики.
  const onFrameDown = (e: MouseEvent<HTMLSpanElement>) => {
    if (disabled || e.button !== 0 || (e.target as Element).closest('button')) return
    e.preventDefault()
    trigger.current?.focus()
    if (open) close(); else openList()
  }
  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' && !open) { e.preventDefault(); openList() }
    else if ((e.key === 'Backspace' || e.key === 'Delete') && !open && !disabled && value.length > 0) { e.preventDefault(); removeLast() }
  }
  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const last = shown.length - 1
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(active + 1, last)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(active - 1, 0)) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(last) }
    else if (e.key === 'Enter') { e.preventDefault(); pickActive() }
    // пробел в пустом запросе не нужен тексту — переключает активный пункт (спека §4.3); внутри запроса — обычный символ
    else if (e.key === ' ' && query === '') { e.preventDefault(); pickActive() }
    else if (e.key === 'Backspace' && query === '' && value.length > 0) { e.preventDefault(); removeLast() }
  }
  // Фокус в поповере ходит по кругу: портал лежит в конце документа, и Tab с края увёл бы фокус из поля за пределы страницы.
  // Закрытие по Tab здесь не годится: возврат фокуса Popover в React 17 срабатывает уже после перехода по Tab и забрал бы его у следующего поля.
  // Выход — Escape (фокус возвращается на поле) или клик вне.
  const onPopKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const stops = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('input, button:not([disabled])'))
    const first = stops[0], last = stops[stops.length - 1]
    if (e.shiftKey && e.target === first) { e.preventDefault(); last?.focus() }
    else if (!e.shiftKey && e.target === last) { e.preventDefault(); first?.focus() }
  }

  return (
    <>
      {/* role=presentation: рамка лишь ловит всплывший mousedown, сама не интерактивна (jsx-a11y) */}
      <span ref={anchor} role="presentation" onMouseDown={onFrameDown} className={[is.field, size === 's' ? is.sizeS : is.sizeM, s.multiField].join(' ')}>
        {chips.slice(0, maxChips).map((c) => (
          <span key={`${typeof c.value}:${String(c.value)}`} className={s.chip}>
            <span className={s.chipText}>{c.label}</span>
            {!disabled && (
              <IconButton size="s" tabIndex={-1} label={`Убрать: ${c.label}`} className={s.chipX} onClick={() => { remove(c.value); trigger.current?.focus() }}>
                <Cross />
              </IconButton>
            )}
          </span>
        ))}
        {chips.length > maxChips && <span className={s.more}>+{chips.length - maxChips}</span>}
        <button
          ref={trigger}
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popId : undefined}
          aria-label={`${name}: ${value.length > 0 ? `выбрано ${value.length}` : placeholder}`}
          disabled={disabled}
          className={s.multiBtn}
          onClick={() => (open ? close() : openList())}
          onKeyDown={onTriggerKey}
        >
          {value.length === 0 && <span className={s.ph}>{placeholder}</span>}
          <span className={s.chev} aria-hidden="true"><Chevron /></span>
        </button>
      </span>
      <Popover open={open} anchor={anchor} returnFocus={trigger} onClose={close} id={popId} label={name} className={s.pop}>
        {/* role=presentation: обработчик лишь замыкает Tab в поповере (jsx-a11y) */}
        <div role="presentation" className={s.multiPop} onKeyDown={onPopKey}>
          <Input
            ref={search}
            size="s"
            role="combobox"
            aria-label={`Поиск: ${name}`}
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={shown[active] ? optionId(listId, active) : undefined}
            autoComplete="off"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0) }}
            onKeyDown={onSearchKey}
          />
          <Listbox id={listId} label={name} options={shown} active={active} isSelected={(o) => has(o.value)} multi onPick={toggle} onActive={setActive} />
          <div className={s.foot}>
            <span aria-live="polite">{`Выбрано ${value.length}${max !== undefined && max > 1 ? ` из ${max}` : ''}`}</span>
            <Button size="s" disabled={value.length === 0} onClick={() => { onChange([]); search.current?.focus() }}>Очистить</Button>
          </div>
        </div>
      </Popover>
    </>
  )
}
