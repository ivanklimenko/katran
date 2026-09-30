import { useEffect, useRef, type ReactNode } from 'react'
import type { Option } from './options'
import s from './Select.module.css'

export const Cross = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>
export const Chevron = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6l4 4 4-4" /></svg>

export const optionId = (listId: string, i: number) => `${listId}-o${i}`

export type ListboxProps = {
  id: string
  label: string
  options: Option[]
  /** Активный пункт (aria-activedescendant у поля); -1 — нет. */
  active: number
  isSelected: (o: Option) => boolean
  multi?: boolean | undefined
  onPick: (o: Option, index: number) => void
  onActive: (index: number) => void
  emptyText?: string | undefined
  /** Выделить совпадение с набранным текстом полужирным (подсказки). */
  highlight?: string | undefined
}

function mark(text: string, q: string): ReactNode {
  const i = q.trim() === '' ? -1 : text.toLowerCase().indexOf(q.trim().toLowerCase())
  if (i < 0) return text
  const n = q.trim().length
  return <>{text.slice(0, i)}<b>{text.slice(i, i + n)}</b>{text.slice(i + n)}</>
}

/** Список вариантов role=listbox: фокус остаётся в поле (aria-activedescendant), мышь не уводит его (mousedown отменён); клавиатура — у поля. */
export function Listbox({ id, label, options, active, isSelected, multi, onPick, onActive, emptyText = 'Ничего не найдено', highlight }: ListboxProps) {
  // Прокрутка к активному — только когда его сменила клавиатура: наведение мышью список не дёргает.
  const byMouse = useRef(false)
  // Выбор мышью — mouseup на том же пункте, где был mousedown (семантика клика). onClick у li потребовал бы
  // пустого обработчика клавиш (jsx-a11y/click-events-have-key-events), а клавиатура у списка — у поля.
  const pressed = useRef(-1)
  useEffect(() => {
    if (byMouse.current) { byMouse.current = false; return }
    const el = document.getElementById(optionId(id, active))
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
  }, [id, active])
  return (
    <ul id={id} role="listbox" aria-label={label} aria-multiselectable={multi || undefined} className={s.list}>
      {options.length === 0 && <li role="option" aria-disabled="true" aria-selected={false} className={s.empty}>{emptyText}</li>}
      {options.map((o, i) => {
        const sel = isSelected(o)
        return (
          <li
            key={`${typeof o.value}:${String(o.value)}`}
            id={optionId(id, i)}
            role="option"
            aria-selected={sel}
            tabIndex={-1}
            data-active={i === active || undefined}
            className={s.opt}
            onMouseDown={(e) => { e.preventDefault(); pressed.current = e.button === 0 ? i : -1 }}
            onMouseUp={() => { const hit = pressed.current === i; pressed.current = -1; if (hit) onPick(o, i) }}
            onMouseMove={() => { if (i !== active) { byMouse.current = true; onActive(i) } }}
          >
            {multi && <span className={s.box} data-on={sel || undefined} aria-hidden="true" />}
            <span className={s.optLabel}>{highlight !== undefined ? mark(o.label, highlight) : o.label}</span>
            {o.hint && <span className={s.hint}>{o.hint}</span>}
          </li>
        )
      })}
    </ul>
  )
}
