import { k } from '@katran/tokens'
import { styled } from '../styled'
import { Counter, StatusDot, type StatusTone } from '../value'
import type { Scalar } from './types'

export type LaneItem = { value: Scalar; label: string; tone: StatusTone; count?: number | undefined; glyph?: string | undefined }
export type StatusLaneProps = {
  /** Доступное имя группы: «Статусы». */
  label: string
  items: LaneItem[]
  /** Активный статус; null — «Все». */
  value: Scalar | null
  onChange: (value: Scalar | null) => void
  allLabel?: string | undefined
  className?: string | undefined
}

const Lane = styled.div`
  display: flex;
  align-items: center;
  overflow-x: auto;
  white-space: nowrap;
  width: 100%;

  /* Высота полосы (эталон .slane) — сумма токенов кнопки и зазора, без нового токена. */
  min-height: calc(${k.hCtlL} + ${k.sp1});
  border-bottom: 1px solid ${k.line};

  /* фон бумаги, как у эталонного .slane: на подложке страницы (ground) счётчики фона chip сливались бы */
  background: ${k.paper};
`

const Tab = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${k.sp2};
  flex: none;
  height: ${k.hCtlL};
  padding: 0 ${k.sp2};
  border: 0;
  border-radius: ${k.rS};
  background: none;
  box-shadow: inset 0 -2px 0 transparent;
  font: 500 ${k.fs2} / 1 ${k.sans};
  color: ${k.ink2};
  cursor: pointer;
  transition: color ${k.tFast}, box-shadow ${k.tFast};

  &:hover {
    color: ${k.ink};
    background: ${k.hover};
  }

  &[aria-pressed='true'] {
    color: ${k.val};
    box-shadow: inset 0 -2px 0 ${k.val};
  }

  /* Кольцо — внутрь (offset отрицательный): overflow-x: auto у Lane заодно обрезает и Y
     (при overflow-x != visible браузер трактует overflow-y как auto), внешнее кольцо срезалось бы сверху. */
  &:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: -2px;
  }
`

/**
 * Лейн статусов — полоса-фильтр на всю ширину (эталон `.slane`/`.slist`), не `Button`: своя кнопка
 * `Tab`, активная отмечена только `aria-pressed` (стиль подчёркивания — в CSS по атрибуту, без
 * отдельного класса). Первая кнопка — «Все» с суммой счётчиков, без точки; клик по активной снимает
 * выбор (спека 1e, 6.1; вид — спека 5b §4, L1). Семантика — `role="group"`, это фильтр, не `tablist`.
 */
export function StatusLane({ label, items, value, onChange, allLabel = 'Все', className }: StatusLaneProps) {
  const hasCounts = items.some((it) => it.count !== undefined)
  const total = items.reduce((n, it) => n + (it.count ?? 0), 0)
  const isOn = (it: LaneItem) => value !== null && it.value === value
  return (
    <Lane role="group" aria-label={label} className={className}>
      <Tab type="button" aria-pressed={value === null} onClick={() => onChange(null)}>
        <span>{allLabel}</span>
        {hasCounts && <Counter value={total} active={value === null} />}
      </Tab>
      {items.map((it) => (
        <Tab key={String(it.value)} type="button" aria-pressed={isOn(it)} onClick={() => onChange(isOn(it) ? null : it.value)}>
          <StatusDot tone={it.tone} size="m" letter={it.glyph} />
          <span>{it.label}</span>
          {it.count !== undefined && <Counter value={it.count} active={isOn(it)} />}
        </Tab>
      ))}
    </Lane>
  )
}
