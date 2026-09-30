import { Fragment, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Menu } from '../overlay'
import { Counter } from '../value'
import { fitTabs } from './fitTabs'
import s from './Tabs.module.css'

export type TabItem = {
  id: string
  label: string
  count?: number | undefined
  disabled?: boolean | undefined
  /** Подсказка вкладки; недоступная в меню переполнения показывает её вместо «нет данных». */
  hint?: string | undefined
}
export type TabsProps = {
  /** Префикс идентификаторов: таб `${id}-tab-${item}`, панель `${id}-panel-${item}`. */
  id: string
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  orientation?: 'horizontal' | 'vertical' | undefined
  /** Доступное имя списка табов. */
  label: string
  /**
   * Переполнение (спека 2a §3.1): порядок фиксированный, недоступные — второй группой тем же порядком,
   * не поместившиеся по ширине — в меню «••• N»; выбранная всегда в полосе.
   */
  overflow?: boolean | undefined
  /** Вид горизонтальной полосы: сегментный контрол (по умолчанию) или линия с подчёркиванием (вкладки деталки). */
  variant?: 'segment' | 'line' | undefined
}

export const tabId = (tabs: string, item: string) => `${tabs}-tab-${item}`
export const panelId = (tabs: string, item: string) => `${tabs}-panel-${item}`

/** Ключ замера кнопки «••• N» среди замеров вкладок. */
const MORE = '__more'
type Fit = { avail: number; widths: Record<string, number>; more: number; gap: number }

/** WAI-ARIA Tabs с ручной активацией: стрелки двигают фокус, Enter/Space выбирает. */
export function Tabs({ id, items, value, onChange, orientation = 'horizontal', label, overflow = false, variant = 'segment' }: TabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const bar = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [fit, setFit] = useState<Fit | null>(null)

  // С переполнением порядок фиксирован, недоступные — второй группой (эталон TABS, index.html:647)
  const ordered = overflow ? [...items.filter((it) => !it.disabled), ...items.filter((it) => it.disabled)] : items
  const selected = ordered.findIndex((it) => it.id === value)
  const shownIdx = overflow && fit
    ? fitTabs(ordered.map((it) => fit.widths[it.id] ?? 0), fit.avail, fit.more, selected, fit.gap)
    : ordered.map((_, i) => i)
  const shown = shownIdx.map((i) => ordered[i]!)
  const hidden = ordered.filter((_, i) => !shownIdx.includes(i))
  const enabled = shown.filter((it) => !it.disabled)
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

  // Замер — в колбэке ResizeObserver (первый вызов — сразу после observe): ширина полосы и скрытого ряда замеров.
  // Ряд замеров меняет ширину при смене подписей — наблюдатель срабатывает и на это. Без ResizeObserver (jsdom) — всё видно.
  useLayoutEffect(() => {
    const box = bar.current
    if (!overflow || !box || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const widths: Record<string, number> = {}
      box.querySelectorAll<HTMLElement>('[data-k-measure]').forEach((el) => { widths[el.getAttribute('data-k-measure') ?? ''] = el.offsetWidth })
      const list = box.querySelector<HTMLElement>('[role="tablist"]')
      const gap = list ? parseFloat(getComputedStyle(list).columnGap) || 0 : 0
      setFit({ avail: box.clientWidth, widths, more: widths[MORE] ?? 0, gap })
    }
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    const row = box.querySelector('[data-k-measures]')
    if (row) ro.observe(row)
    return () => ro.disconnect()
  }, [overflow])

  const mod = orientation === 'vertical' ? s.vertical : variant === 'line' ? s.line : s.horizontal
  const firstOff = overflow ? shown.findIndex((it) => it.disabled) : -1
  const list = (
    <div role="tablist" aria-label={label} aria-orientation={orientation} className={[s.list, mod].join(' ')}>
      {shown.map((it, i) => {
        const sel = it.id === value
        return (
          <Fragment key={it.id}>
            {i === firstOff && i > 0 && <span className={s.sep} aria-hidden="true" />}
            <button
              ref={(el) => { refs.current[it.id] = el }}
              type="button"
              role="tab"
              id={tabId(id, it.id)}
              aria-selected={sel}
              aria-controls={panelId(id, it.id)}
              aria-disabled={it.disabled || undefined}
              disabled={it.disabled}
              tabIndex={it.id === stopId ? 0 : -1}
              className={s.tab}
              data-k-tip={it.hint}
              onClick={() => !it.disabled && onChange(it.id)}
              onKeyDown={(e) => onKey(e, it)}
            >
              <span>{it.label}</span>
              {it.count !== undefined && <Counter value={it.count} active={sel} />}
            </button>
          </Fragment>
        )
      })}
    </div>
  )
  if (!overflow) return list
  return (
    <div ref={bar} className={[s.bar, mod === s.line ? s.lineBar : ''].filter(Boolean).join(' ')}>
      {list}
      {hidden.length > 0 && (
        <button ref={moreRef} type="button" className={s.more} aria-haspopup="menu" aria-expanded={menuOpen} aria-label={`Ещё вкладки: ${hidden.length}`} onClick={() => setMenuOpen(true)}>
          ••• {hidden.length}
        </button>
      )}
      <div className={[s.measure, mod].join(' ')} aria-hidden="true" data-k-measures="">
        {ordered.map((it) => (
          <span key={it.id} data-k-measure={it.id} className={s.tab}>
            <span>{it.label}</span>
            {it.count !== undefined && <Counter value={it.count} />}
          </span>
        ))}
        <span data-k-measure={MORE} className={s.more}>••• 99</span>
      </div>
      <Menu
        open={menuOpen && hidden.length > 0}
        anchor={moreRef}
        onClose={() => setMenuOpen(false)}
        title="Вкладки"
        items={hidden.map((it) => ({
          id: it.id,
          label: it.label,
          disabled: it.disabled,
          hint: it.disabled ? (it.hint ?? 'нет данных') : undefined,
          onSelect: () => onChange(it.id),
        }))}
      />
    </div>
  )
}
