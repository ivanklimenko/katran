import { useRef, useState } from 'react'
import { Button, IconButton } from '../button'
import { Popover } from '../overlay'
import is from '../input/Input.module.css'
import { Calendar } from './Calendar'
import { dayOf, timeOf, todayLocal, withTime, type DateFormat, type DateValue, type IsoDay } from './dateStr'
import { MaskedDateField } from './MaskedDateField'
import type { DatePreset } from './presets'
import { TimeField } from './TimeField'
import s from './Date.module.css'

export type DateInputProps = {
  value: DateValue
  onChange: (value: DateValue) => void
  /** Разрешить время; по умолчанию false. */
  time?: boolean | undefined
  /** Шаблон: 'DD.MM.YYYY' (по умолчанию), 'YYYY-MM-DD', 'DD/MM/YYYY'…; при time дописывается ' HH:mm'. */
  format?: DateFormat | undefined
  /** Горячие кнопки под полем; кнопка ставит `from` пресета. По умолчанию нет. */
  quick?: DatePreset[] | undefined
  min?: IsoDay | undefined
  max?: IsoDay | undefined
  today?: IsoDay | undefined
  disabled?: boolean | undefined
  size?: 's' | 'm' | undefined
  id?: string | undefined
  'aria-label'?: string | undefined
  placeholder?: string | undefined
}

export const CalIcon = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></svg>

/** Одна дата или дата со временем: маска по шаблону, календарь в поповере, горячие кнопки (спека §3.5). */
export function DateInput({ value, onChange, time = false, format = 'DD.MM.YYYY', quick, min, max, today, disabled, size = 'm', id, placeholder, ...aria }: DateInputProps) {
  const fmt = withTime(format, time)
  const t = today ?? todayLocal()
  const anchor = useRef<HTMLSpanElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState<IsoDay>(value ? dayOf(value) : t)
  const [invalid, setInvalid] = useState(false)

  const toggle = () => { if (open) { setOpen(false); return } setMonth(value ? dayOf(value) : t); setOpen(true) }
  const pickDay = (d: IsoDay) => {
    if (!time) { onChange(d); setOpen(false); return }
    const tm = value ? timeOf(value) : ''
    onChange(tm ? `${d}T${tm}` : d)
  }
  const setTime = (tm: string) => {
    if (!value) return
    onChange(tm ? `${dayOf(value)}T${tm}` : dayOf(value))
  }

  return (
    <span className={s.dateBox}>
      <span ref={anchor} className={[is.field, size === 's' ? is.sizeS : is.sizeM, invalid ? is.invalid : '', s.dateField].filter(Boolean).join(' ')}>
        <MaskedDateField
          ref={input} id={id} aria-label={aria['aria-label']} value={value} onChange={onChange} format={fmt}
          min={min} max={max} placeholder={placeholder} disabled={disabled} className={is.input} onInvalidChange={setInvalid}
        />
        <IconButton size="s" label="Выбрать дату" aria-haspopup="dialog" aria-expanded={open} disabled={disabled} className={s.calBtn} onClick={toggle}><CalIcon /></IconButton>
      </span>
      {quick && quick.length > 0 && (
        <span role="group" aria-label="Быстрый выбор" className={s.quick}>
          {quick.map((p) => {
            const d = p.range(t).from
            const on = value === d
            return <Button key={p.id} size="s" pressed={on} disabled={disabled} onClick={() => onChange(on ? '' : d)}>{p.label}</Button>
          })}
        </span>
      )}
      <Popover open={open} anchor={anchor} returnFocus={input} onClose={() => setOpen(false)} label="Выбор даты" manualFocus>
        <Calendar month={month} onMonthChange={setMonth} value={value ? dayOf(value) : ''} onPick={pickDay} min={min} max={max} today={t} autoFocus />
        {time && (
          <div className={s.timeRow}>
            <TimeField label="Время" value={value ? timeOf(value) : ''} onChange={setTime} onEnter={() => setOpen(false)} />
            <Button size="s" variant="primary" onClick={() => setOpen(false)}>Готово</Button>
          </div>
        )}
      </Popover>
    </span>
  )
}
