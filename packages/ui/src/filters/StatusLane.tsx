import { Button } from '../button'
import { Counter, StatusDot, type StatusTone } from '../value'
import type { Scalar } from './types'
import s from './StatusLane.module.css'

export type LaneItem = { value: Scalar; label: string; tone: StatusTone; count?: number | undefined }
export type StatusLaneProps = {
  /** Доступное имя группы: «Статусы». */
  label: string
  items: LaneItem[]
  /** Активный статус; null — «Все». */
  value: Scalar | null
  onChange: (value: Scalar | null) => void
  allLabel?: string | undefined
}

/** Лейн статусов: кнопки-переключатели, первая — «Все» с суммой счётчиков; клик по активной снимает (спека 1e, 6.1). */
export function StatusLane({ label, items, value, onChange, allLabel = 'Все' }: StatusLaneProps) {
  const hasCounts = items.some((it) => it.count !== undefined)
  const total = items.reduce((n, it) => n + (it.count ?? 0), 0)
  const isOn = (it: LaneItem) => value !== null && it.value === value
  return (
    <div role="group" aria-label={label} className={s.lane}>
      {/* variant="ghost" — явно, хоть и совпадает с дефолтом Button: стиль активного состояния (aria-pressed) живёт в Button.module.css именно для ghost. */}
      <Button variant="ghost" size="s" pressed={value === null} className={s.item} onClick={() => onChange(null)}>
        <span>{allLabel}</span>
        {hasCounts && <Counter value={total} active={value === null} />}
      </Button>
      {items.map((it) => (
        <Button key={String(it.value)} variant="ghost" size="s" pressed={isOn(it)} className={s.item} onClick={() => onChange(isOn(it) ? null : it.value)}>
          <StatusDot tone={it.tone} size="s" />
          <span>{it.label}</span>
          {it.count !== undefined && <Counter value={it.count} active={isOn(it)} />}
        </Button>
      ))}
    </div>
  )
}
