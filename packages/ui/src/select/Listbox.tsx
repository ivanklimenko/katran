import { useEffect, useRef, type ReactNode } from 'react'
import { styled } from '../styled'
import { Tag } from '../value'
import type { Option } from './options'
import { k } from '@katran/tokens'

export const Cross = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>
export const Chevron = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6l4 4 4-4" /></svg>

const List = styled.ul`
  max-height: ${k.menuMaxH};
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
`

/** Пункт списка; SuggestInput перестраивает его в своём поповере (& ${Opt}). */
export const Opt = styled.li`
  display: flex;
  align-items: center;
  gap: ${k.sp2};
  min-height: ${k.hCtlM};
  padding: 0 ${k.sp2};
  border-radius: ${k.rS};
  font: 400 ${k.fs1} / ${k.lh1} ${k.sans};
  color: ${k.ink};
  cursor: pointer;

  &[data-active] {
    background: ${k.hover};
  }

  &[aria-selected='true'] {
    color: ${k.val};
    font-weight: 500;
  }

  &[aria-disabled='true'] {
    color: ${k.faint};
    cursor: default;
  }
`

export const OptLabel = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const Hint = styled.span`
  flex: none;
  font: 400 ${k.fs3} / 1 ${k.mono};
  color: ${k.muted};
`

export const Empty = styled.li`
  padding: ${k.sp2};
  color: ${k.muted};
  cursor: default;
`

/* чекбокс мультиселекта — рисованный: пункт не содержит интерактива, состояние несёт aria-selected */
const Box = styled.span`
  flex: none;
  width: ${k.iconS};
  height: ${k.iconS};
  border: 1px solid ${k.line};
  border-radius: ${k.rS};
  background: ${k.paper};

  &[data-on] {
    border-color: ${k.val};
    background: ${k.val};
    box-shadow: inset 0 0 0 2px ${k.paper};
  }
`

export const optionId = (listId: string, i: number) => `${listId}-o${i}`

export type ListboxProps = {
  id: string
  label: string
  options: Option[]
  /** Активный пункт (aria-activedescendant у поля); -1 — нет. */
  active: number
  isSelected: (o: Option) => boolean
  /** Пункт недоступен (aria-disabled): не выбирается кликом; выбор с клавиатуры — у поля, оно проверяет само. */
  isDisabled?: ((o: Option) => boolean) | undefined
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
export function Listbox({ id, label, options, active, isSelected, isDisabled, multi, onPick, onActive, emptyText = 'Ничего не найдено', highlight }: ListboxProps) {
  // Прокрутка к активному — только когда его сменила клавиатура: наведение мышью список не дёргает.
  const byMouse = useRef(false)
  // Выбор — по click, делегированным нативным слушателем на ul: click приходит и без событий мыши
  // (режим обзора экранного диктора, голосовое управление, el.click()). JSX onClick у li потребовал бы пустого
  // обработчика клавиш (jsx-a11y/click-events-have-key-events), а клавиатура у списка — у поля.
  // Нажали на одном пункте, отпустили на другом — click приходит на ul, пункта нет, выбора нет.
  const ul = useRef<HTMLUListElement>(null)
  const latest = useRef({ options, onPick })
  useEffect(() => { latest.current = { options, onPick } })
  useEffect(() => {
    const el = ul.current
    if (!el) return
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return
      const li = e.target.closest('[role="option"]')
      if (!li || !el.contains(li) || li.getAttribute('aria-disabled') === 'true') return
      const { options: opts, onPick: pick } = latest.current
      const i = opts.findIndex((_, k) => optionId(id, k) === li.id)
      if (i >= 0) pick(opts[i]!, i)
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [id])
  useEffect(() => {
    if (byMouse.current) { byMouse.current = false; return }
    const el = document.getElementById(optionId(id, active))
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
  }, [id, active])
  return (
    <List ref={ul} id={id} role="listbox" aria-label={label} aria-multiselectable={multi || undefined}>
      {options.length === 0 && <Empty role="option" aria-disabled="true" aria-selected={false}>{emptyText}</Empty>}
      {options.map((o, i) => {
        const sel = isSelected(o)
        const off = isDisabled?.(o) === true
        return (
          <Opt
            key={`${typeof o.value}:${String(o.value)}`}
            id={optionId(id, i)}
            role="option"
            aria-selected={sel}
            aria-disabled={off || undefined}
            tabIndex={-1}
            data-active={i === active || undefined}
            onMouseDown={(e) => e.preventDefault()}
            onMouseMove={() => { if (i !== active) { byMouse.current = true; onActive(i) } }}
          >
            {multi && <Box data-on={sel || undefined} aria-hidden="true" />}
            <OptLabel>{highlight !== undefined ? mark(o.label, highlight) : o.label}</OptLabel>
            {o.tag !== undefined && <Tag tone="mt">{o.tag}</Tag>}
            {o.hint && <Hint>{o.hint}</Hint>}
          </Opt>
        )
      })}
    </List>
  )
}
