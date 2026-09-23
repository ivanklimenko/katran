import { useRef, type KeyboardEvent } from 'react'
import { Counter } from '../value'
import s from './Tabs.module.css'

export type TabItem = { id: string; label: string; count?: number | undefined; disabled?: boolean | undefined }
export type TabsProps = {
  /** Префикс идентификаторов: таб `${id}-tab-${item}`, панель `${id}-panel-${item}`. */
  id: string
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  orientation?: 'horizontal' | 'vertical' | undefined
  /** Доступное имя списка табов. */
  label: string
}

export const tabId = (tabs: string, item: string) => `${tabs}-tab-${item}`
export const panelId = (tabs: string, item: string) => `${tabs}-panel-${item}`

/** WAI-ARIA Tabs с ручной активацией: стрелки двигают фокус, Enter/Space выбирает. */
export function Tabs({ id, items, value, onChange, orientation = 'horizontal', label }: TabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const enabled = items.filter((it) => !it.disabled)
  const stopId = enabled.some((it) => it.id === value) ? value : enabled[0]?.id
  const focusAt = (i: number) => { const it = enabled[(i + enabled.length) % enabled.length]; if (it) refs.current[it.id]?.focus() }

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, it: TabItem) => {
    const pos = enabled.findIndex((x) => x.id === it.id)
    const next = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'
    const prev = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
    if (e.key === next) { e.preventDefault(); focusAt(pos + 1) }
    else if (e.key === prev) { e.preventDefault(); focusAt(pos - 1) }
    else if (e.key === 'Home') { e.preventDefault(); focusAt(0) }
    else if (e.key === 'End') { e.preventDefault(); focusAt(enabled.length - 1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(it.id) }
  }

  return (
    <div role="tablist" aria-label={label} aria-orientation={orientation} className={[s.list, s[orientation]].join(' ')}>
      {items.map((it) => {
        const selected = it.id === value
        return (
          <button
            key={it.id}
            ref={(el) => { refs.current[it.id] = el }}
            type="button"
            role="tab"
            id={tabId(id, it.id)}
            aria-selected={selected}
            aria-controls={panelId(id, it.id)}
            aria-disabled={it.disabled || undefined}
            disabled={it.disabled}
            tabIndex={it.id === stopId ? 0 : -1}
            className={s.tab}
            onClick={() => !it.disabled && onChange(it.id)}
            onKeyDown={(e) => onKey(e, it)}
          >
            <span>{it.label}</span>
            {it.count !== undefined && <Counter value={it.count} active={selected} />}
          </button>
        )
      })}
    </div>
  )
}
