import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Button, IconButton } from '../button'
import { useStableId } from '../compat/useStableId'
import type { Scalar } from '../filters/types'
import { Input } from '../input'
import is from '../input/Input.module.css'
import { Popover } from '../overlay'
import { exitOnEdgeTab } from '../overlay/edgeTab'
import { useKatran } from '../provider/useKatran'
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
  const chipsId = useStableId()
  const { announce } = useKatran()
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
  const shownChips = chips.slice(0, maxChips)
  // Закрытое поле читается не только числом: описание — подписи видимых чипов и «ещё N» (кнопки ✕ в описание не входят).
  const describedBy = [...shownChips.map((_, i) => `${chipsId}-c${i}`), ...(chips.length > maxChips ? [`${chipsId}-more`] : [])].join(' ') || undefined
  const labelOf = (v: Scalar) => chips.find((c) => sameScalar(c.value, v))?.label ?? String(v)
  const remove = (v: Scalar) => { announce(`Убрано: ${labelOf(v)}`); onChange(value.filter((x) => !sameScalar(x, v))) }
  const removeLast = () => { const last = chips[chips.length - 1]; if (last) remove(last.value) }
  // Предел достигнут: невыбранные пункты недоступны. При max = 1 выбор заменяет выбранный, предела «достигнуто» нет.
  const full = max !== undefined && max > 1 && value.length >= max
  const openList = () => { setOpen(true); setActive(0) }
  const close = () => { setOpen(false); setQuery(''); setActive(0) }
  const toggle = (o: Option) => {
    if (max === 1) {
      // одиночный выбор: сделан — поповер закрывается, фокус возвращается на поле
      if (has(o.value)) announce(`Убрано: ${o.label}`)
      onChange(has(o.value) ? [] : [o.value])
      close()
      return
    }
    if (has(o.value)) { remove(o.value); return }
    if (full) return
    onChange(ordered([...value, o.value]))
  }
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
    else if (e.key === 'Backspace' && !open && !disabled && value.length > 0) { e.preventDefault(); removeLast() }
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

  return (
    <>
      {/* role=presentation: рамка лишь ловит всплывший mousedown, сама не интерактивна (jsx-a11y) */}
      <span ref={anchor} role="presentation" onMouseDown={onFrameDown} className={[is.field, size === 's' ? is.sizeS : is.sizeM, s.multiField].join(' ')}>
        <span className={s.chips}>
          {shownChips.map((c, i) => (
            <span key={`${typeof c.value}:${String(c.value)}`} className={s.chip}>
              <span id={`${chipsId}-c${i}`} className={s.chipText}>{c.label}</span>
              {!disabled && (
                <IconButton size="s" tabIndex={-1} label={`Убрать: ${c.label}`} className={s.chipX} onClick={() => { remove(c.value); (open ? search : trigger).current?.focus() }}>
                  <Cross />
                </IconButton>
              )}
            </span>
          ))}
          {chips.length > maxChips && (
            <>
              <span aria-hidden="true" className={s.more}>{`+${chips.length - maxChips}`}</span>
              <span id={`${chipsId}-more`} className={s.sr}>{`ещё ${chips.length - maxChips}`}</span>
            </>
          )}
        </span>
        <button
          ref={trigger}
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popId : undefined}
          aria-describedby={describedBy}
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
        {/* role=presentation: обёртка лишь выводит Tab с краёв поповера на поле (jsx-a11y) */}
        <div role="presentation" className={s.multiPop} onKeyDown={(e) => exitOnEdgeTab(e, trigger, close)}>
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
          <Listbox id={listId} label={`Варианты: ${name}`} options={shown} active={active} isSelected={(o) => has(o.value)} isDisabled={(o) => full && !has(o.value)} multi onPick={toggle} onActive={setActive} />
          <div className={s.foot}>
            <span aria-live="polite">{`Выбрано ${value.length}${max !== undefined && max > 1 ? ` из ${max}` : ''}`}</span>
            <Button size="s" disabled={value.length === 0} onClick={() => { onChange([]); search.current?.focus() }}>Очистить</Button>
          </div>
        </div>
      </Popover>
    </>
  )
}
