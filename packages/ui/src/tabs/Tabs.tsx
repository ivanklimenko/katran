import { Fragment, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { k } from '@katran/tokens'
import { Menu } from '../overlay'
import { css, styled } from '../styled'
import { Counter } from '../value'
import { fitTabs } from './fitTabs'

export type TabItem = {
  id: string
  label: string
  count?: number | undefined
  disabled?: boolean | undefined
  /**
   * Подсказка вкладки (тултип). У недоступной в полосе не выводится — disabled-кнопка не получает событий указателя
   * и фокуса, тултип был бы мёртвым; в меню переполнения недоступная показывает её вместо «нет данных».
   */
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
  /** Класс корня: полосы переполнения (overflow) или списка вкладок. */
  className?: string | undefined
}

/** Вид полосы (data-view у списка, ряда замеров и полосы переполнения): из orientation и variant. */
type View = 'segment' | 'vertical' | 'line'

/* Вкладка: в списке — кнопка, в ряду замеров — span с теми же правилами (as="span") */
const Tab = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${k.sp2};
  border: 1px solid transparent;
  background: none;
  font: 500 ${k.fs1} / 1 ${k.sans};
  color: ${k.ink2};
  cursor: pointer;
  white-space: nowrap;
  transition: background ${k.tFast}, color ${k.tFast};

  &:disabled {
    color: ${k.faint};
    cursor: default;
  }

  &:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: -2px;
  }
`

/*
 * Правила вида — у списка и у скрытого ряда замеров (замер ведётся теми же правилами вкладок). Вид — атрибутом data-view
 * под :where(): специфичность прежних классов-модификаторов (.horizontal, .vertical, .line — (0,1,0); с вкладкой — (0,2,0)).
 */
const views = css`
  /* горизонтальные — сегментный контрол */
  &:where([data-view='segment']) {
    gap: ${k.sp1};
    padding: ${k.sp1};
    border-radius: ${k.rM};
    background: ${k.sunk};
    width: max-content;
  }

  /* вертикальные — список с маркером слева */
  &:where([data-view='vertical']) {
    flex-direction: column;
    gap: 0;
    border-right: 1px solid ${k.line};
    min-width: ${k.side};
  }

  &:where([data-view='segment']) ${Tab} {
    height: ${k.hCtlM};
    padding: 0 ${k.sp3};
    border-radius: ${k.rS};
  }

  &:where([data-view='vertical']) ${Tab} {
    height: ${k.hCtlL};
    padding: 0 ${k.sp4};
    border-left: 3px solid transparent;
    justify-content: space-between;
    text-align: left;
  }

  /* линия с подчёркиванием — вкладки деталки (эталон .tabs index.html:127–129, 263–283): 32 = высота полосы с подчёркиванием.
     Нижнюю линию полосы рисует сам кит тенью inset, а не рамкой контейнера с margin-bottom: -1px: тень лежит под вкладками,
     подчёркивание выбранной (2px) закрывает её без выхода за полосу — его не обрезает overflow: hidden полосы
     переполнения, а голый px в отступе запрещён линтом. Потребитель свою нижнюю рамку под полосой не рисует. */
  &:where([data-view='line']) {
    gap: 0;
    box-shadow: inset 0 -1px 0 ${k.line};
  }

  &:where([data-view='line']) ${Tab} {
    height: ${k.tabLine};
    padding: 0 ${k.tabPx};
    border: 0;
    border-bottom: 2px solid transparent;
    font-weight: 400;
    color: ${k.muted};
  }
`

const List = styled.div`
  display: flex;

  ${views}

  &:where([data-view='line']) ${Tab}:hover:not(:disabled) {
    color: ${k.ink};
  }

  &:where([data-view='line']) ${Tab}[aria-selected='true'] {
    border-bottom-color: ${k.val};
    font-weight: 500;
    color: ${k.ink};
  }

  &:where([data-view='segment']) ${Tab}:hover:not(:disabled) {
    color: ${k.ink};
  }

  &:where([data-view='vertical']) ${Tab}:hover:not(:disabled) {
    background: ${k.hover};
  }

  &:where([data-view='segment']) ${Tab}[aria-selected='true'] {
    background: ${k.paper};
    border-color: ${k.line};
    color: ${k.ink};
  }

  &:where([data-view='vertical']) ${Tab}[aria-selected='true'] {
    border-left-color: ${k.val};
    background: ${k.valSoft};
    color: ${k.val};
  }
`

/* переполнение: полоса + кнопка «••• N»; вкладки, не поместившиеся до первого замера, не вылезают */
const Bar = styled.div`
  position: relative;
  display: flex;
  align-items: stretch;
  min-width: 0;

  /* линия полосы продолжается под кнопкой «••• N» */
  &:where([data-view='line']) {
    box-shadow: inset 0 -1px 0 ${k.line};
  }

  & > ${List} {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
  }
`

const More = styled.button`
  flex: none;
  margin-left: auto;
  padding: 0 ${k.tabPx};
  border: 0;
  background: none;
  font: 600 ${k.fs1} / 1 ${k.sans};
  letter-spacing: 0.1em;
  color: ${k.muted};
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    color: ${k.ink};
  }

  &:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: -2px;
  }
`

/* разделитель групп: доступные | недоступные (эталон .tdiv) */
const Sep = styled.span`
  flex: none;
  width: 0;
  margin: ${k.sp2} ${k.sp1};
  border-left: 1px solid ${k.line};
`

/* скрытый ряд замеров: те же правила вида и вкладок, вне потока, не виден и не кликается */
const Measure = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  height: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
  white-space: nowrap;

  ${views}

  /* выбранная вкладка линией — полужирная (500) и шире обычной (400): замер ведётся по ширине выбранной,
     чтобы вкладка, ставшая выбранной, не выросла за посчитанное место и не обрезалась краем полосы (прежде .measure.line .tab) */
  &&:where([data-view='line']) ${Tab} {
    font-weight: 500;
  }
`

export const tabId = (tabs: string, item: string) => `${tabs}-tab-${item}`
export const panelId = (tabs: string, item: string) => `${tabs}-panel-${item}`

/** Ключ замера кнопки «••• N» среди замеров вкладок. */
const MORE = '__more'
/** Ключ замера разделителя групп доступные | недоступные. */
const SEP = '__sep'
type Fit = { avail: number; widths: Record<string, number>; more: number; gap: number; sep: number }

/** WAI-ARIA Tabs с ручной активацией: стрелки двигают фокус, Enter/Space выбирает. */
export function Tabs({ id, items, value, onChange, orientation = 'horizontal', label, overflow = false, variant = 'segment', className }: TabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const bar = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [fit, setFit] = useState<Fit | null>(null)

  // С переполнением порядок фиксирован, недоступные — второй группой (эталон TABS, index.html:647)
  const ordered = overflow ? [...items.filter((it) => !it.disabled), ...items.filter((it) => it.disabled)] : items
  const selected = ordered.findIndex((it) => it.id === value)
  const offAt = ordered.findIndex((it) => it.disabled)
  const shownIdx = overflow && fit
    ? fitTabs(ordered.map((it) => fit.widths[it.id] ?? 0), fit.avail, fit.more, selected, fit.gap, offAt > 0 ? { at: offAt, width: fit.sep } : undefined)
    : ordered.map((_, i) => i)
  const shown = shownIdx.map((i) => ordered[i]!)
  const hidden = ordered.filter((_, i) => !shownIdx.includes(i))
  // «•••» пропала (всё поместилось) — меню закрыто, иначе при новом сужении оно откроется само.
  // Сброс во время рендера, как в Menu: setState в теле эффекта запрещён правилом react-hooks/set-state-in-effect.
  if (menuOpen && hidden.length === 0) setMenuOpen(false)
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
      // разделитель — рамка без ширины с полями: offsetWidth полей не включает, добавляем их
      const sepEl = box.querySelector<HTMLElement>(`[data-k-measure="${SEP}"]`)
      const sepCs = sepEl ? getComputedStyle(sepEl) : null
      const sep = (widths[SEP] ?? 0) + (sepCs ? (parseFloat(sepCs.marginLeft) || 0) + (parseFloat(sepCs.marginRight) || 0) : 0)
      setFit({ avail: box.clientWidth, widths, more: widths[MORE] ?? 0, gap, sep })
    }
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    const row = box.querySelector('[data-k-measures]')
    if (row) ro.observe(row)
    return () => ro.disconnect()
  }, [overflow])

  const view: View = orientation === 'vertical' ? 'vertical' : variant === 'line' ? 'line' : 'segment'
  const firstOff = overflow ? shown.findIndex((it) => it.disabled) : -1
  const list = (
    <List role="tablist" aria-label={label} aria-orientation={orientation} data-view={view} className={overflow ? undefined : className}>
      {shown.map((it, i) => {
        const sel = it.id === value
        return (
          <Fragment key={it.id}>
            {i === firstOff && i > 0 && <Sep aria-hidden="true" />}
            <Tab
              ref={(el) => { refs.current[it.id] = el }}
              type="button"
              role="tab"
              id={tabId(id, it.id)}
              aria-selected={sel}
              aria-controls={panelId(id, it.id)}
              aria-disabled={it.disabled || undefined}
              disabled={it.disabled}
              tabIndex={it.id === stopId ? 0 : -1}
              data-k-tip={it.disabled ? undefined : it.hint}
              onClick={() => !it.disabled && onChange(it.id)}
              onKeyDown={(e) => onKey(e, it)}
            >
              <span>{it.label}</span>
              {it.count !== undefined && <Counter value={it.count} active={sel} />}
            </Tab>
          </Fragment>
        )
      })}
    </List>
  )
  if (!overflow) return list
  return (
    <Bar ref={bar} data-view={view} className={className}>
      {list}
      {hidden.length > 0 && (
        <More ref={moreRef} type="button" aria-haspopup="menu" aria-expanded={menuOpen} aria-label={`Ещё вкладки: ${hidden.length}`} onClick={() => setMenuOpen(true)}>
          ••• {hidden.length}
        </More>
      )}
      <Measure data-view={view} aria-hidden="true" data-k-measures="">
        {ordered.map((it) => (
          <Tab as="span" key={it.id} data-k-measure={it.id}>
            <span>{it.label}</span>
            {it.count !== undefined && <Counter value={it.count} />}
          </Tab>
        ))}
        <More as="span" data-k-measure={MORE}>••• 99</More>
        <Sep data-k-measure={SEP} />
      </Measure>
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
    </Bar>
  )
}
