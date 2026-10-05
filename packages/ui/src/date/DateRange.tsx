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
  /** Поле «по» недоступно — у поля нет BETWEEN (спека §6.2): наружу всегда `to: ''`, календарь ставит только «с»,
   * многодневные пресеты недоступны, однодневные ставят «с». */
  toDisabled?: boolean | undefined
  size?: 's' | 'm' | undefined
  /** Имя группы — название поля; поля получают «…, с» и «…, по». */
  label: string
}

const EMPTY: DateRangeValue = { from: '', to: '' }
const withDay = (v: DateValue, tm: string): DateValue => (v ? (tm ? `${dayOf(v)}T${tm}` : dayOf(v)) : v)

/** Период «с — по» (спека §3.6): поля по маске, календарь двумя кликами, пресеты, горячие кнопки под полем. */
export function DateRange({ value, onChange: emit, time = false, format = 'DD.MM.YYYY', quick = QUICK_PRESETS, presets = DEFAULT_PRESETS, min, max, today, disabled, toDisabled, size = 'm', label }: DateRangeProps) {
  // без «по» скрытая граница не должна жить в значении: иначе она всплывёт условием GTE/LTE/EQ, которого не видно
  const onChange = (v: DateRangeValue) => emit(toDisabled ? { from: v.from, to: '' } : v)
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
  // время «с» переживает выбор дней, как у DateInput: новый день ставится под прежние часы
  const fromTime = value.from ? timeOf(value.from) : ''
  const pick = (d: IsoDay) => {
    // один клик — «с»; со временем поповер остаётся открытым, как в обычном режиме со временем: дописать часы
    if (toDisabled) { onChange({ from: withDay(d, fromTime), to: '' }); if (!time) close(); return }
    if (pending === null) { setPending(d); onChange({ from: withDay(d, fromTime), to: '' }); return }
    const [a, b] = d < pending ? [d, pending] : [pending, d]
    setPending(null)
    setHover(null)
    onChange({ from: withDay(a, fromTime), to: b })
    if (!time) setOpen(false)
  }
  // без «по» многодневный период не выразить — такие пресеты недоступны, однодневные («Сегодня») остаются
  const outside = (p: DatePreset) => {
    const r = p.range(t)
    return (min !== undefined && r.from < min) || (max !== undefined && r.to > max) || (toDisabled === true && r.from !== r.to)
  }
  // отметка — по дням: время границ пресет не задаёт
  // без «по» однодневный пресет отмечен по одному «с»
  const matches = (p: DatePreset) => {
    if (!toDisabled) return presetMatches(p, t, { from: fromDay, to: toDay })
    const r = p.range(t)
    return r.from === r.to && fromDay === r.from
  }
  const applyPreset = (p: DatePreset) => {
    const r = p.range(t)
    onChange(r)
    setMonth(r.from)
    setPending(null)
    setHover(null)
    // со временем поповер остаётся: после пресета ещё нужно вписать часы (спека §3.6)
    if (!time) setOpen(false)
  }
  // «по» не может быть раньше «с»: позже днём — сбрасывается целиком, в тот же день раньше временем — остаётся день
  const fitTo = (from: DateValue, to: DateValue): DateValue => {
    if (!from || !to) return to
    if (dayOf(from) > dayOf(to)) return ''
    return dayOf(from) === dayOf(to) && timeOf(to) !== '' && timeOf(from) !== '' && to < from ? dayOf(to) : to
  }
  const setFrom = (v: DateValue) => onChange({ from: v, to: fitTo(v, value.to) })
  const sameDay = fromDay !== '' && fromDay === toDay
  const toMin = fromDay && (min === undefined || fromDay > min) ? fromDay : min

  return (
    <span className={s.dateBox} data-time={time || undefined}>
      <span ref={anchor} role="group" aria-label={label} className={[is.field, size === 's' ? is.sizeS : is.sizeM, invFrom || invTo ? is.invalid : '', s.dateField].filter(Boolean).join(' ')}>
        <MaskedDateField ref={fromInput} aria-label={`${label}, с`} value={value.from} onChange={setFrom} format={fmt} min={min} max={max} disabled={disabled} className={[is.input, s.rangeInput].join(' ')} onInvalidChange={setInvFrom} />
        <span className={s.dash} aria-hidden="true">–</span>
        <MaskedDateField aria-label={`${label}, по`} value={value.to} onChange={(v) => onChange({ ...value, to: v })} format={fmt} min={toMin} max={max} notBefore={value.from} disabled={disabled || toDisabled} className={[is.input, s.rangeInput].join(' ')} onInvalidChange={setInvTo} />
        <IconButton size="s" label="Выбрать период" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined} disabled={disabled} className={s.calBtn} onClick={toggle}><CalIcon /></IconButton>
      </span>
      {quick.length > 0 && (
        <span role="group" aria-label={`${label}: быстрый период`} className={s.quick}>
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
                <TimeField label="Время с" disabled={!value.from} value={value.from ? timeOf(value.from) : ''} onChange={(tm) => setFrom(withDay(value.from, tm))} onEnter={close} />
                <TimeField label="Время по" disabled={!value.to} notBefore={sameDay ? timeOf(value.from) : undefined} value={value.to ? timeOf(value.to) : ''} onChange={(tm) => onChange({ ...value, to: withDay(value.to, tm) })} onEnter={close} />
                <Button size="s" variant="primary" onClick={close}>Готово</Button>
              </div>
            )}
          </div>
        </div>
      </Popover>
    </span>
  )
}
