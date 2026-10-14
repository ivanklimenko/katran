import { useRef, useState } from 'react'
import { Button } from '../button'
import { useStableId } from '../compat/useStableId'
import { Popover } from '../overlay'
import { exitOnEdgeTab } from '../overlay/edgeTab'
import { Calendar } from './Calendar'
import { CalIcon } from './DateInput'
import { dayOf, timeOf, todayLocal, withTime, type DateFormat, type DateValue, type IsoDay } from './dateStr'
import { DEFAULT_PRESETS, QUICK_PRESETS, presetMatches, type DatePreset } from './presets'
import { TimeField } from './TimeField'
import { styled } from '../styled'
import { CalBtn, DateBox, DateField, DateText, Quick, TimeRow } from './parts'
import { k } from '@katran/tokens'

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
  className?: string | undefined
}

/* поля «с» и «по» делят рамку поровну и сжимаются в узкой колонке */
const RangeInput = styled(DateText)`
  width: 100%;
  min-width: 0;
`

const Dash = styled.span`
  flex: none;
  color: ${k.muted};
`

const RangePop = styled.div`
  display: flex;
  gap: ${k.sp2};
`

const Presets = styled.ul`
  display: grid;
  align-content: start;
  gap: ${k.sp1};
  width: ${k.presetW};
  margin: 0;
  padding: ${k.sp1} ${k.sp2} ${k.sp1} 0;
  border-right: 1px solid ${k.line};
  list-style: none;
`

const Preset = styled.button`
  width: 100%;
  height: ${k.hCtlS};
  padding: 0 ${k.sp2};
  border: 0;
  border-radius: ${k.rS};
  background: none;
  font: 400 ${k.fs1} / 1 ${k.sans};
  color: ${k.ink};
  text-align: left;
  cursor: pointer;

  &:hover {
    background: ${k.hover};
  }

  &:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: -2px;
  }

  &[aria-pressed='true'] {
    background: ${k.valSoft};
    color: ${k.val};
  }

  &:disabled {
    background: none;
    color: ${k.muted};
    cursor: default;
  }
`

const EMPTY: DateRangeValue = { from: '', to: '' }
const withDay = (v: DateValue, tm: string): DateValue => (v ? (tm ? `${dayOf(v)}T${tm}` : dayOf(v)) : v)

/** Период «с — по» (спека §3.6): поля по маске, календарь двумя кликами, пресеты, горячие кнопки под полем. */
export function DateRange({ value, onChange: emit, time = false, format = 'DD.MM.YYYY', quick = QUICK_PRESETS, presets = DEFAULT_PRESETS, min, max, today, disabled, toDisabled, size = 'm', label, className }: DateRangeProps) {
  // без «по» скрытая граница не должна жить в значении: иначе она всплывёт условием GTE/LTE/EQ, которого не видно
  const onChange = (v: DateRangeValue) => emit(toDisabled ? { from: v.from, to: '' } : v)
  const fmt = withTime(format, time)
  const t = today ?? todayLocal()
  const anchor = useRef<HTMLSpanElement>(null)
  const fromInput = useRef<HTMLInputElement>(null)
  const calBtn = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState<IsoDay>(value.from ? dayOf(value.from) : t)
  // первый клик календаря уже сделан, второго ещё нет
  const [pending, setPending] = useState<IsoDay | null>(null)
  const [hover, setHover] = useState<IsoDay | null>(null)
  // время «по» до первого клика: первый клик очищает «по», второй ставит новый день под прежние часы
  const [toTimeKept, setToTimeKept] = useState('')
  const [invFrom, setInvFrom] = useState(false)
  const [invTo, setInvTo] = useState(false)
  const panelId = useStableId()

  const fromDay = value.from ? dayOf(value.from) : ''
  const toDay = value.to ? dayOf(value.to) : ''
  // между кликами календарь рисует будущий диапазон: от первого дня до наведённого
  const shown = pending === null
    ? { from: fromDay, to: toDay }
    : hover === null ? { from: pending, to: '' } : hover < pending ? { from: hover, to: pending } : { from: pending, to: hover }

  // «по» не может быть раньше «с»: позже днём — сбрасывается целиком, в тот же день раньше временем — остаётся день
  const fitTo = (from: DateValue, to: DateValue): DateValue => {
    if (!from || !to) return to
    if (dayOf(from) > dayOf(to)) return ''
    return dayOf(from) === dayOf(to) && timeOf(to) !== '' && timeOf(from) !== '' && to < from ? dayOf(to) : to
  }
  const close = () => { setOpen(false); setPending(null); setHover(null) }
  const toggle = () => { if (open) { close(); return } setMonth(fromDay || t); setOpen(true) }
  // время «с» и «по» переживает выбор дней, как у DateInput: новый день ставится под прежние часы
  const fromTime = value.from ? timeOf(value.from) : ''
  const pick = (d: IsoDay) => {
    // один клик — «с»; со временем поповер остаётся открытым, как в обычном режиме со временем: дописать часы
    if (toDisabled) { onChange({ from: withDay(d, fromTime), to: '' }); if (!time) close(); return }
    if (pending === null) { setPending(d); setToTimeKept(value.to ? timeOf(value.to) : ''); onChange({ from: withDay(d, fromTime), to: '' }); return }
    const [a, b] = d < pending ? [d, pending] : [pending, d]
    setPending(null)
    setHover(null)
    const from = withDay(a, fromTime)
    onChange({ from, to: fitTo(from, withDay(b, toTimeKept)) })
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
  const setFrom = (v: DateValue) => onChange({ from: v, to: fitTo(v, value.to) })
  const sameDay = fromDay !== '' && fromDay === toDay
  const toMin = fromDay && (min === undefined || fromDay > min) ? fromDay : min

  return (
    <DateBox className={className} data-time={time || undefined}>
      <DateField ref={anchor} role="group" aria-label={label} data-size={size} data-invalid={invFrom || invTo || undefined}>
        <RangeInput ref={fromInput} aria-label={`${label}, с`} value={value.from} onChange={setFrom} format={fmt} min={min} max={max} disabled={disabled} onInvalidChange={setInvFrom} />
        <Dash aria-hidden="true">–</Dash>
        <RangeInput aria-label={`${label}, по`} value={value.to} onChange={(v) => onChange({ ...value, to: v })} format={fmt} min={toMin} max={max} notBefore={value.from} disabled={disabled || toDisabled} onInvalidChange={setInvTo} />
        <CalBtn ref={calBtn} size="s" label="Выбрать период" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined} disabled={disabled} onClick={toggle}><CalIcon /></CalBtn>
      </DateField>
      {quick.length > 0 && (
        <Quick role="group" aria-label={`${label}: быстрый период`}>
          {quick.map((p) => {
            const on = matches(p)
            return <Button key={p.id} size="s" pressed={on} disabled={disabled || outside(p)} onClick={() => onChange(on ? EMPTY : p.range(t))}>{p.label}</Button>
          })}
        </Quick>
      )}
      <Popover id={panelId} open={open} anchor={anchor} returnFocus={fromInput} onClose={close} label={`${label}: выбор периода`} manualFocus>
        {/* role=presentation: обёртка лишь выводит Tab с краёв поповера на кнопку периода (jsx-a11y) */}
        <RangePop role="presentation" onKeyDown={(e) => exitOnEdgeTab(e, calBtn, close)}>
          {presets.length > 0 && (
            <Presets aria-label="Пресеты периода">
              {presets.map((p) => (
                <li key={p.id}><Preset type="button" aria-pressed={matches(p)} disabled={outside(p)} onClick={() => applyPreset(p)}>{p.label}</Preset></li>
              ))}
            </Presets>
          )}
          <div>
            <Calendar month={month} onMonthChange={setMonth} range={shown} onPick={pick} onHoverDay={(d) => { if (pending !== null) setHover(d) }} min={min} max={max} today={t} autoFocus />
            {time && (
              <TimeRow>
                <TimeField label="Время с" disabled={!value.from} value={value.from ? timeOf(value.from) : ''} onChange={(tm) => setFrom(withDay(value.from, tm))} onEnter={close} />
                <TimeField label="Время по" disabled={!value.to} notBefore={sameDay ? timeOf(value.from) : undefined} value={value.to ? timeOf(value.to) : ''} onChange={(tm) => onChange({ ...value, to: withDay(value.to, tm) })} onEnter={close} />
                <Button size="s" variant="primary" onClick={close}>Готово</Button>
              </TimeRow>
            )}
          </div>
        </RangePop>
      </Popover>
    </DateBox>
  )
}
