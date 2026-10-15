import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Button, IconButton } from '../button'
import { useStableId } from '../compat/useStableId'
import type { Scalar } from '../filters/types'
import { Input } from '../input'
import { FieldBox } from '../input/parts'
import { exitOnEdgeTab } from '../overlay/edgeTab'
import { useKatran } from '../provider/useKatran'
import { styled } from '../styled'
import { Chevron, Cross, Listbox, optionId } from './Listbox'
import { filterOptions, sameScalar, type Option } from './options'
import { Chev, Ph, Pop } from './parts'
import { k } from '@katran/tokens'

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
  className?: string | undefined
}

const MultiField = styled(FieldBox)`
  gap: ${k.sp1};
  padding-right: ${k.sp1};
  overflow: hidden;
`

const MultiBtn = styled.button`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  min-width: ${k.sp6};
  height: 100%;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;

  &:focus-visible {
    outline: 0;
  }
`

const Chip = styled.span`
  display: inline-flex;
  flex: 0 1 auto;
  align-items: center;
  min-width: 0;
  height: calc(${k.hCtlS} - ${k.sp1});
  padding-left: ${k.sp1};
  border-radius: ${k.rS};
  background: ${k.valSoft};
  color: ${k.ink};
  font-size: ${k.fs2};
`

const ChipText = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const ChipX = styled(IconButton)`
  flex: none;
  color: ${k.muted};
`

const More = styled.span`
  flex: none;
  font-size: ${k.fs2};
  color: ${k.ink2};
`

const MultiPop = styled.div`
  display: grid;
  gap: ${k.sp1};
`

const Foot = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${k.sp2};
  padding: ${k.sp1} ${k.sp1} 0;
  border-top: 1px solid ${k.line};
  font-size: ${k.fs2};
  color: ${k.ink2};
`

const Chips = styled.span`
  display: inline-flex;
  flex: 0 1 auto;
  gap: ${k.sp1};
  align-items: center;
  min-width: 0;
`

/* только для скринридера: «ещё N» у «+N» */
const Sr = styled.span`
  position: absolute;
  inline-size: 0;
  block-size: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`

/** Несколько значений из справочника (спека §4.3): чипы в поле, поиск и список с отметками в поповере. */
export function MultiSelect({ options, value, onChange, placeholder = 'Не выбрано', maxChips = 2, max, disabled, size = 'm', id, className, ...aria }: MultiSelectProps) {
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
      <MultiField ref={anchor} role="presentation" onMouseDown={onFrameDown} data-size={size} className={className}>
        <Chips>
          {shownChips.map((c, i) => (
            <Chip key={`${typeof c.value}:${String(c.value)}`}>
              <ChipText id={`${chipsId}-c${i}`}>{c.label}</ChipText>
              {!disabled && (
                <ChipX size="s" tabIndex={-1} label={`Убрать: ${c.label}`} onClick={() => { remove(c.value); (open ? search : trigger).current?.focus() }}>
                  <Cross />
                </ChipX>
              )}
            </Chip>
          ))}
          {chips.length > maxChips && (
            <>
              <More aria-hidden="true">{`+${chips.length - maxChips}`}</More>
              <Sr id={`${chipsId}-more`}>{`ещё ${chips.length - maxChips}`}</Sr>
            </>
          )}
        </Chips>
        <MultiBtn
          ref={trigger}
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popId : undefined}
          aria-describedby={describedBy}
          aria-label={`${name}: ${value.length > 0 ? `выбрано ${value.length}` : placeholder}`}
          disabled={disabled}
          onClick={() => (open ? close() : openList())}
          onKeyDown={onTriggerKey}
        >
          {value.length === 0 && <Ph>{placeholder}</Ph>}
          <Chev aria-hidden="true"><Chevron /></Chev>
        </MultiBtn>
      </MultiField>
      <Pop open={open} anchor={anchor} returnFocus={trigger} onClose={close} id={popId} label={name}>
        {/* role=presentation: обёртка лишь выводит Tab с краёв поповера на поле (jsx-a11y) */}
        <MultiPop role="presentation" onKeyDown={(e) => exitOnEdgeTab(e, trigger, close)}>
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
          <Foot>
            <span aria-live="polite">{`Выбрано ${value.length}${max !== undefined && max > 1 ? ` из ${max}` : ''}`}</span>
            <Button size="s" disabled={value.length === 0} onClick={() => { onChange([]); search.current?.focus() }}>Очистить</Button>
          </Foot>
        </MultiPop>
      </Pop>
    </>
  )
}
