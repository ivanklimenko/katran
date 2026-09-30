import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { IconButton } from '../button'
import { addDays, addMonths, monthGrid, startOfMonth, todayLocal, weekday, type IsoDay } from './dateStr'
import { MONTHS, MONTHS_GEN, WEEKDAYS_FULL, WEEKDAYS_SHORT } from './ruNames'
import s from './Date.module.css'

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
}

const Prev = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
const Next = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 3.5 10.5 8 6 12.5" /></svg>

const monthOf = (d: IsoDay) => d.slice(0, 7)
const dayLabel = (d: IsoDay) => `${Number(d.slice(8, 10))} ${MONTHS_GEN[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}, ${WEEKDAYS_FULL[weekday(d) - 1]}`

/** Сетка месяца по паттерну APG Date Picker: один таб-стоп, стрелки, Home/End, PgUp/PgDn (Shift — год), Enter/Space. */
export function Calendar({ month, onMonthChange, value, range, onPick, min, max, today, label, autoFocus, onHoverDay }: CalendarProps) {
  const t = today ?? todayLocal()
  const first = startOfMonth(month)
  const days = monthGrid(first)
  const title = `${MONTHS[Number(first.slice(5, 7)) - 1]} ${first.slice(0, 4)}`
  const inMonth = (d: IsoDay) => monthOf(d) === monthOf(first)
  const off = (d: IsoDay) => (min !== undefined && d < min) || (max !== undefined && d > max)
  const anchor = value || range?.from || t
  const [focused, setFocused] = useState<IsoDay>(anchor)
  // активный день всегда в показанном месяце: после листания кнопками — выбранный, иначе 1-е число
  const active = inMonth(focused) ? focused : inMonth(anchor) ? anchor : first
  const grid = useRef<HTMLTableElement>(null)
  const wantFocus = useRef(autoFocus === true)

  useEffect(() => {
    if (!wantFocus.current) return
    wantFocus.current = false
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${active}"]`)?.focus()
  }, [active])

  const moveTo = (d: IsoDay) => {
    wantFocus.current = true
    setFocused(d)
    if (!inMonth(d)) onMonthChange(startOfMonth(d))
  }
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
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
    <div className={s.cal}>
      <div className={s.calHead}>
        <IconButton size="s" label="Предыдущий месяц" onClick={() => onMonthChange(addMonths(first, -1))}><Prev /></IconButton>
        <span className={s.calTitle} aria-live="polite">{title}</span>
        <IconButton size="s" label="Следующий месяц" onClick={() => onMonthChange(addMonths(first, 1))}><Next /></IconButton>
      </div>
      <table ref={grid} role="grid" aria-label={label ?? title} className={s.grid} onMouseLeave={() => onHoverDay?.(null)}>
        <thead>
          <tr>{WEEKDAYS_SHORT.map((w, i) => <th key={w} scope="col" abbr={WEEKDAYS_FULL[i]} className={s.wd}>{w}</th>)}</tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4, 5].map((r) => (
            <tr key={r}>
              {days.slice(r * 7, r * 7 + 7).map((d) => {
                const edge = d === value || d === from || d === to
                const inside = from !== '' && to !== '' && d > from && d < to
                return (
                  <td key={d} role="gridcell" aria-selected={edge} className={s.cell}>
                    <button
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
                      className={s.day}
                      onClick={() => { if (off(d)) return; setFocused(d); onPick(d) }}
                      onKeyDown={onKey}
                      onMouseEnter={() => onHoverDay?.(d)}
                    >
                      {Number(d.slice(8, 10))}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
