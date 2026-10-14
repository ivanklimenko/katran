import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { IconButton } from '../button'
import { addDays, addMonths, monthGrid, startOfMonth, todayLocal, weekday, type IsoDay } from './dateStr'
import { MONTHS, MONTHS_GEN, WEEKDAYS_FULL, WEEKDAYS_SHORT } from './ruNames'
import { styled } from '../styled'
import { k } from '@katran/tokens'

export type CalendarProps = {
  /** Любой день показываемого месяца. */
  month: IsoDay
  onMonthChange: (month: IsoDay) => void
  value?: IsoDay | '' | undefined
  /** Подсветка диапазона: края — заливка, середина — val-soft. */
  range?: { from: IsoDay | ''; to: IsoDay | '' } | undefined
  onPick: (day: IsoDay) => void
  min?: IsoDay | undefined
  max?: IsoDay | undefined
  /** По умолчанию todayLocal(); проп — для тестов. */
  today?: IsoDay | undefined
  /** Доступное имя сетки; по умолчанию месяц и год: «Сентябрь 2026». */
  label?: string | undefined
  /** При монтировании фокус на выбранный или сегодняшний день (поповер дат). */
  autoFocus?: boolean | undefined
  /** Наведение на день — DateRange подсвечивает будущий диапазон; null — курсор ушёл с сетки. */
  onHoverDay?: ((day: IsoDay | null) => void) | undefined
  className?: string | undefined
}

const Cal = styled.div`
  display: grid;
  gap: ${k.sp2};
  padding: ${k.sp1};
`

const CalHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${k.sp2};
`

const CalTitle = styled.span`
  font: 600 ${k.fs1} / ${k.lh1} ${k.sans};
  color: ${k.ink};
`

const Grid = styled.table`
  border-collapse: separate;
  border-spacing: 0;
`

const Wd = styled.th`
  width: ${k.calCell};
  height: ${k.calCell};
  padding: 0;
  font: 500 ${k.fs3} / 1 ${k.sans};
  color: ${k.muted};
  text-align: center;
`

const Cell = styled.td`
  padding: 0;
`

const Day = styled.button`
  display: grid;
  place-items: center;
  width: ${k.calCell};
  height: ${k.calCell};
  padding: 0;
  border: 1px solid transparent;
  border-radius: ${k.rS};
  background: none;
  font: 400 ${k.fs1} / 1 ${k.sans};
  color: ${k.ink};
  cursor: pointer;

  /* порядок — по каскаду: наведение ниже отметок диапазона, чтобы выбранный день не терял заливку под курсором */
  &:hover {
    background: ${k.hover};
  }

  /* недоступный день: гасим наведение и текст, но раньше отметок диапазона — заливка краёв остаётся */
  &[aria-disabled='true'] {
    background: none;
    color: ${k.muted};
    cursor: default;
  }

  &:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: -2px;
  }

  /* дни соседних месяцев — muted (faint не для читаемого текста, contrast.rules) */
  &[data-out] {
    color: ${k.muted};
  }

  &[data-today] {
    border-color: ${k.val};
  }

  &[data-in] {
    border-radius: 0;
    background: ${k.valSoft};
  }

  &[data-edge] {
    background: ${k.val};
    color: ${k.paper};
  }

  /* кольцо на залитом краю — цветом бумаги: val на val невидим */
  &[data-edge]:focus-visible {
    outline-color: ${k.paper};
  }
`

const Prev = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
const Next = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 3.5 10.5 8 6 12.5" /></svg>

const monthOf = (d: IsoDay) => d.slice(0, 7)
const dayLabel = (d: IsoDay) => `${Number(d.slice(8, 10))} ${MONTHS_GEN[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}, ${WEEKDAYS_FULL[weekday(d) - 1]}`

/** Сетка месяца по паттерну APG Date Picker: один таб-стоп, стрелки, Home/End, PgUp/PgDn (Shift — год), Enter/Space. */
export function Calendar({ month, onMonthChange, value, range, onPick, min, max, today, label, autoFocus, onHoverDay, className }: CalendarProps) {
  const t = today ?? todayLocal()
  const first = startOfMonth(month)
  const days = monthGrid(first)
  const title = `${MONTHS[Number(first.slice(5, 7)) - 1]} ${first.slice(0, 4)}`
  const inMonth = (d: IsoDay) => monthOf(d) === monthOf(first)
  const off = (d: IsoDay) => (min !== undefined && d < min) || (max !== undefined && d > max)
  const anchor = value || range?.from || t
  const [focused, setFocused] = useState<IsoDay>(anchor)
  // значение сменили снаружи (ввод в поле даты) — таб-стоп переезжает на него; фокус при этом не трогаем
  const [seenAnchor, setSeenAnchor] = useState<IsoDay>(anchor)
  if (seenAnchor !== anchor) {
    setSeenAnchor(anchor)
    setFocused(anchor)
  }
  // активный день всегда в показанном месяце: после листания кнопками — выбранный, иначе 1-е число
  const active = inMonth(focused) ? focused : inMonth(anchor) ? anchor : first
  const grid = useRef<HTMLTableElement>(null)
  const wantFocus = useRef(autoFocus === true)

  // без списка зависимостей: флаг живёт до ближайшего коммита и гасится там, даже если родитель отклонил смену месяца
  useEffect(() => {
    if (!wantFocus.current) return
    wantFocus.current = false
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${active}"]`)?.focus()
  })

  const moveTo = (d: IsoDay) => {
    if (d === active) return
    wantFocus.current = true
    setFocused(d)
    if (!inMonth(d)) onMonthChange(startOfMonth(d))
  }
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    const w = weekday(active)
    const step: Record<string, IsoDay | undefined> = {
      ArrowLeft: addDays(active, -1), ArrowRight: addDays(active, 1), ArrowUp: addDays(active, -7), ArrowDown: addDays(active, 7),
      Home: addDays(active, 1 - w), End: addDays(active, 7 - w),
      PageUp: addMonths(active, e.shiftKey ? -12 : -1), PageDown: addMonths(active, e.shiftKey ? 12 : 1),
    }
    const next = step[e.key]
    if (next !== undefined) { e.preventDefault(); moveTo(next); return }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!off(active)) onPick(active) }
  }

  const from = range?.from ?? ''
  const to = range?.to ?? ''
  return (
    <Cal className={className}>
      <CalHead>
        <IconButton size="s" label="Предыдущий месяц" onClick={() => onMonthChange(addMonths(first, -1))}><Prev /></IconButton>
        <CalTitle aria-live="polite">{title}</CalTitle>
        <IconButton size="s" label="Следующий месяц" onClick={() => onMonthChange(addMonths(first, 1))}><Next /></IconButton>
      </CalHead>
      <Grid ref={grid} role="grid" aria-label={label ?? title} onMouseLeave={() => onHoverDay?.(null)}>
        <thead>
          <tr>{WEEKDAYS_SHORT.map((w, i) => <Wd key={w} scope="col" abbr={WEEKDAYS_FULL[i]}>{w}</Wd>)}</tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4, 5].map((r) => (
            <tr key={r}>
              {days.slice(r * 7, r * 7 + 7).map((d) => {
                const edge = d === value || d === from || d === to
                const inside = from !== '' && to !== '' && d > from && d < to
                return (
                  <Cell key={d} role="gridcell" aria-selected={edge}>
                    <Day
                      type="button"
                      data-day={d}
                      tabIndex={d === active ? 0 : -1}
                      aria-label={dayLabel(d)}
                      aria-current={d === t ? 'date' : undefined}
                      aria-disabled={off(d) || undefined}
                      data-out={!inMonth(d) || undefined}
                      data-today={d === t || undefined}
                      data-edge={edge || undefined}
                      data-in={inside || undefined}
                      onClick={() => { if (off(d)) return; setFocused(d); onPick(d) }}
                      onKeyDown={onKey}
                      onMouseEnter={() => onHoverDay?.(d)}
                    >
                      {Number(d.slice(8, 10))}
                    </Day>
                  </Cell>
                )
              })}
            </tr>
          ))}
        </tbody>
      </Grid>
    </Cal>
  )
}
