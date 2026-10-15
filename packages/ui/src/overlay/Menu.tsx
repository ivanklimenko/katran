import { useEffect, useRef, useState, type RefObject } from 'react'
import { k } from '@katran/tokens'
import { styled } from '../styled'
import { Popover } from './Popover'

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
  /** Класс панели меню (корень — панель поповера в портале). */
  className?: string | undefined
}

const Title = styled.div`
  padding: ${k.sp1} ${k.sp2};
  font: 500 ${k.fs3} / ${k.lh3} ${k.sans};
  color: ${k.muted};
`

/*
 * Порядок правил — по возрастанию специфичности (stylelint no-descending-specificity): focus-visible, aria-checked и
 * disabled имеют одинаковую специфичность (класс + один селектор состояния), hover:not() выше на единицу за счёт :not().
 * Итог каскада не меняется: background задают только focus-visible и hover, обводку — только focus-visible (иначе более
 * специфичный hover погасил бы её у наведённого пункта с фокусом); disabled идёт после aria-checked, поэтому цвет
 * disabled побеждает и для отмеченного-и-недоступного пункта.
 */
const Item = styled.button`
  display: flex;
  justify-content: space-between;
  gap: ${k.sp3};
  width: 100%;
  height: ${k.hCtlM};
  padding: 0 ${k.sp2};
  border: 0;
  border-radius: ${k.rS};
  background: none;
  font: 400 ${k.fs1} / 1 ${k.sans};
  color: ${k.ink};
  text-align: left;
  cursor: pointer;
  align-items: center;

  &:focus-visible {
    background: ${k.hover};
    outline: 2px solid ${k.val};
    outline-offset: -2px;
  }

  &[aria-checked='true'] {
    color: ${k.val};
    font-weight: 500;
  }

  &:disabled {
    color: ${k.faint};
    cursor: default;
  }

  &:hover:not(:disabled) {
    background: ${k.hover};
  }
`

const Hint = styled.span`
  color: ${k.faint};
  font-size: ${k.fs2};
`

const Note = styled.div`
  padding: ${k.sp1} ${k.sp2};
  font-size: ${k.fs3};
  color: ${k.muted};
`

export function Menu({ open, anchor, onClose, items, title, className }: MenuProps) {
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
    <Popover open={open} anchor={anchor} onClose={onClose} role="menu" label={title} manualFocus className={className}>
      <div>
        {title && <Title aria-hidden="true">{title}</Title>}
        {items.map((it, i) =>
          it.note ? (
            <Note key={it.id} role="presentation">{it.label}</Note>
          ) : (
            <Item
              key={it.id}
              ref={(el) => { refs.current[i] = el }}
              type="button"
              role={it.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
              aria-checked={it.checked === undefined ? undefined : it.checked}
              aria-label={it.ariaLabel}
              aria-disabled={it.disabled || undefined}
              disabled={it.disabled}
              tabIndex={i === active ? 0 : -1}
              onClick={(e) => !it.disabled && pick(it, e.shiftKey)}
              onKeyDown={onKey}
            >
              <span>{it.label}</span>
              {it.hint && <Hint>{it.hint}</Hint>}
            </Item>
          ),
        )}
      </div>
    </Popover>
  )
}
