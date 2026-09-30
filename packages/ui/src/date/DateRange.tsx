import { useRef, useState } from 'react'
import { Button, IconButton } from '../button'
import { useStableId } from '../compat/useStableId'
import { Popover } from '../overlay'
import is from '../input/Input.module.css'
import { Calendar } from './Calendar'
import { CalIcon } from './DateInput'
import { dayOf, timeOf, todayLocal, withTime, type DateFormat, type DateValue, type IsoDay } from './dateStr'
import { MaskedDateField } from './MaskedDateField'
import { DEFAULT_PRESETS, QUICK_PRESETS, presetMatches, type DatePreset } from './presets'
import { TimeField } from './TimeField'
import s from './Date.module.css'

export type DateRangeValue = { from: DateValue; to: DateValue }
export type DateRangeProps = {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  time?: boolean | undefined
  format?: DateFormat | undefined
  /** Горячие кнопки под полем; по умолчанию QUICK_PRESETS; [] — без кнопок. */
  quick?: DatePreset[] | undefined
  /** Список в поповере; по умолчанию DEFAULT_PRESETS; [] — без списка. */
  presets?: DatePreset[] | undefined
  min?: IsoDay | undefined
  max?: IsoDay | undefined
  today?: IsoDay | undefined
  disabled?: boolean | undefined
  size?: 's' | 'm' | undefined
  /** Имя группы — название поля; поля получают «…, с» и «…, по». */
  label: string
}

const EMPTY: DateRangeValue = { from: '', to: '' }
const withDay = (v: DateValue, tm: string): DateValue => (v ? (tm ? `${dayOf(v)}T${tm}` : dayOf(v)) : v)

/** Период «с — по» (спека §3.6): поля по маске, календарь двумя кликами, пресеты, горячие кнопки под полем. */
export function DateRange({ value, onChange, time = false, format = 'DD.MM.YYYY', quick = QUICK_PRESETS, presets = DEFAULT_PRESETS, min, max, today, disabled, size = 'm', label }: DateRangeProps) {
  const fmt = withTime(format, time)
  const t = today ?? todayLocal()
  const anchor = useRef<HTMLSpanElement>(null)
  const fromInput = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState<IsoDay>(value.from ? dayOf(value.from) : t)
  // первый клик календаря уже сделан, второго ещё нет
  const [pending, setPending] = useState<IsoDay | null>(null)
  const [hover, setHover] = useState<IsoDay | null>(null)
  const [invFrom, setInvFrom] = useState(false)
  const [invTo, setInvTo] = useState(false)
  const panelId = useStableId()

  const fromDay = value.from ? dayOf(value.from) : ''
  const toDay = value.to ? dayOf(value.to) : ''
  // между кликами календарь рисует будущий диапазон: от первого дня до наведённого
  const shown = pending === null
    ? { from: fromDay, to: toDay }
    : hover === null ? { from: pending, to: '' } : hover < pending ? { from: hover, to: pending } : { from: pending, to: hover }

  const close = () => { setOpen(false); setPending(null); setHover(null) }
  const toggle = () => { if (open) { close(); return } setMonth(fromDay || t); setOpen(true) }
  const pick = (d: IsoDay) => {
    if (pending === null) { setPending(d); onChange({ from: d, to: '' }); return }
    const [a, b] = d < pending ? [d, pending] : [pending, d]
    setPending(null)
    setHover(null)
    onChange({ from: a, to: b })
    if (!time) setOpen(false)
  }
  const outside = (p: DatePreset) => { const r = p.range(t); return (min !== undefined && r.from < min) || (max !== undefined && r.to > max) }
  // отметка — по дням: время границ пресет не задаёт
  const matches = (p: DatePreset) => presetMatches(p, t, { from: fromDay, to: toDay })
  const applyPreset = (p: DatePreset) => {
    onChange(p.range(t))
    setPending(null)
    setHover(null)
    // со временем поповер остаётся: после пресета ещё нужно вписать часы (спека §3.6)
    if (!time) setOpen(false)
  }
  // «с» позже уже стоящего «по» — «по» сбрасывается, иначе наружу ушёл бы период наоборот
  const setFrom = (v: DateValue) => onChange({ from: v, to: v && toDay && dayOf(v) > toDay ? '' : value.to })
  const toMin = fromDay && (min === undefined || fromDay > min) ? fromDay : min

  return (
    <span className={s.dateBox}>
      <span ref={anchor} role="group" aria-label={label} className={[is.field, size === 's' ? is.sizeS : is.sizeM, invFrom || invTo ? is.invalid : '', s.dateField].filter(Boolean).join(' ')}>
        <MaskedDateField ref={fromInput} aria-label={`${label}, с`} value={value.from} onChange={setFrom} format={fmt} min={min} max={max} disabled={disabled} className={[is.input, s.rangeInput].join(' ')} onInvalidChange={setInvFrom} />
        <span className={s.dash} aria-hidden="true">–</span>
        <MaskedDateField aria-label={`${label}, по`} value={value.to} onChange={(v) => onChange({ ...value, to: v })} format={fmt} min={toMin} max={max} disabled={disabled} className={[is.input, s.rangeInput].join(' ')} onInvalidChange={setInvTo} />
        <IconButton size="s" label="Выбрать период" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined} disabled={disabled} className={s.calBtn} onClick={toggle}><CalIcon /></IconButton>
      </span>
      {quick.length > 0 && (
        <span role="group" aria-label="Быстрый период" className={s.quick}>
          {quick.map((p) => {
            const on = matches(p)
            return <Button key={p.id} size="s" pressed={on} disabled={disabled || outside(p)} onClick={() => onChange(on ? EMPTY : p.range(t))}>{p.label}</Button>
          })}
        </span>
      )}
      <Popover id={panelId} open={open} anchor={anchor} returnFocus={fromInput} onClose={close} label={`${label}: выбор периода`} manualFocus>
        <div className={s.rangePop}>
          {presets.length > 0 && (
            <ul className={s.presets} aria-label="Пресеты периода">
              {presets.map((p) => (
                <li key={p.id}><button type="button" className={s.preset} aria-pressed={matches(p)} disabled={outside(p)} onClick={() => applyPreset(p)}>{p.label}</button></li>
              ))}
            </ul>
          )}
          <div>
            <Calendar month={month} onMonthChange={setMonth} range={shown} onPick={pick} onHoverDay={(d) => { if (pending !== null) setHover(d) }} min={min} max={max} today={t} autoFocus />
            {time && (
              <div className={s.timeRow}>
                <TimeField label="Время с" disabled={!value.from} value={value.from ? timeOf(value.from) : ''} onChange={(tm) => onChange({ ...value, from: withDay(value.from, tm) })} onEnter={close} />
                <TimeField label="Время по" disabled={!value.to} value={value.to ? timeOf(value.to) : ''} onChange={(tm) => onChange({ ...value, to: withDay(value.to, tm) })} onEnter={close} />
                <Button size="s" variant="primary" onClick={close}>Готово</Button>
              </div>
            )}
          </div>
        </div>
      </Popover>
    </span>
  )
}
