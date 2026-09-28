import { useEffect, useRef, useState, type RefObject } from 'react'
import { Popover } from './Popover'
import s from './Overlay.module.css'

export type MenuItem = {
  id: string
  /** Видимый текст пункта. */
  label: string
  /** Доступное имя, когда видимый текст — знак («+», «↕»): рендерится как aria-label. */
  ariaLabel?: string | undefined
  /** shiftKey — из клика/нажатия клавиши, которым выбран пункт. */
  onSelect?: ((e?: { shiftKey: boolean }) => void) | undefined
  checked?: boolean | undefined
  disabled?: boolean | undefined
  /** Подсказка справа (например, стрелка направления сортировки). */
  hint?: string | undefined
  /** Неинтерактивная строка-подсказка в конце меню: role="presentation", вне клавиатурной навигации. */
  note?: boolean | undefined
}
export type MenuProps = {
  open: boolean
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  items: MenuItem[]
  title?: string | undefined
}

export function Menu({ open, anchor, onClose, items, title }: MenuProps) {
  const enabled = items.map((it, i) => (it.disabled || it.note ? -1 : i)).filter((i) => i >= 0)
  const [active, setActive] = useState(enabled[0] ?? -1)
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  // Сброс активного пункта при открытии — во время рендера (тот же паттерн,
  // что в KatranProvider), а не в useEffect: setState в теле эффекта
  // запрещён правилом react-hooks/set-state-in-effect.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setActive(enabled[0] ?? -1)
  }
  useEffect(() => { if (open && active >= 0) refs.current[active]?.focus() }, [open, active])

  const move = (d: 1 | -1) => {
    const pos = enabled.indexOf(active)
    const next = enabled[(pos + d + enabled.length) % enabled.length]
    if (next !== undefined) setActive(next)
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(enabled[0] ?? -1) }
    else if (e.key === 'End') { e.preventDefault(); setActive(enabled[enabled.length - 1] ?? -1) }
  }
  const pick = (it: MenuItem, shiftKey: boolean) => { it.onSelect?.({ shiftKey }); onClose() }

  return (
    <Popover open={open} anchor={anchor} onClose={onClose} role="menu" label={title} manualFocus>
      <div>
        {title && <div className={s.menuTitle} aria-hidden="true">{title}</div>}
        {items.map((it, i) =>
          it.note ? (
            <div key={it.id} role="presentation" className={s.menuNote}>{it.label}</div>
          ) : (
            <button
              key={it.id}
              ref={(el) => { refs.current[i] = el }}
              type="button"
              role={it.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
              aria-checked={it.checked === undefined ? undefined : it.checked}
              aria-label={it.ariaLabel}
              aria-disabled={it.disabled || undefined}
              disabled={it.disabled}
              tabIndex={i === active ? 0 : -1}
              className={s.item}
              onClick={(e) => !it.disabled && pick(it, e.shiftKey)}
              onKeyDown={onKey}
            >
              <span>{it.label}</span>
              {it.hint && <span className={s.hint}>{it.hint}</span>}
            </button>
          ),
        )}
      </div>
    </Popover>
  )
}
