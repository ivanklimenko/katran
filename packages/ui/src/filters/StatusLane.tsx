import { Counter, StatusDot, type StatusTone } from '../value'
import type { Scalar } from './types'
import s from './StatusLane.module.css'

export type LaneItem = { value: Scalar; label: string; tone: StatusTone; count?: number | undefined; glyph?: string | undefined }
export type StatusLaneProps = {
  /** Доступное имя группы: «Статусы». */
  label: string
  items: LaneItem[]
  /** Активный статус; null — «Все». */
  value: Scalar | null
  onChange: (value: Scalar | null) => void
  allLabel?: string | undefined
}

/**
 * Лейн статусов — полоса-фильтр на всю ширину (эталон `.slane`/`.slist`), не `Button`: своя кнопка
 * `.tab`, активная отмечена только `aria-pressed` (стиль подчёркивания — в CSS по атрибуту, без
 * отдельного класса). Первая кнопка — «Все» с суммой счётчиков, без точки; клик по активной снимает
 * выбор (спека 1e, 6.1; вид — спека 5b §4, L1). Семантика — `role="group"`, это фильтр, не `tablist`.
 */
export function StatusLane({ label, items, value, onChange, allLabel = 'Все' }: StatusLaneProps) {
  const hasCounts = items.some((it) => it.count !== undefined)
  const total = items.reduce((n, it) => n + (it.count ?? 0), 0)
  const isOn = (it: LaneItem) => value !== null && it.value === value
  return (
    <div role="group" aria-label={label} className={s.lane}>
      <button type="button" aria-pressed={value === null} className={s.tab} onClick={() => onChange(null)}>
        <span>{allLabel}</span>
        {hasCounts && <Counter value={total} active={value === null} />}
      </button>
      {items.map((it) => (
        <button key={String(it.value)} type="button" aria-pressed={isOn(it)} className={s.tab} onClick={() => onChange(isOn(it) ? null : it.value)}>
          <StatusDot tone={it.tone} size="m" letter={it.glyph} />
          <span>{it.label}</span>
          {it.count !== undefined && <Counter value={it.count} active={isOn(it)} />}
        </button>
      ))}
    </div>
  )
}
