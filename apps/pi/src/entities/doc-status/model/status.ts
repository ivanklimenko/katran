import type { Facet } from '@katran/effector'
import type { LaneItem, StatusTone } from '@katran/ui'

/** Порядок — порядок лейна (как на эталоне). */
export const STATUSES = ['IN_PROGRESS', 'TO_EXPORT', 'PROCESSING', 'ERROR', 'DEFERRED', 'EXPORTED', 'INVALID', 'REJECTED', 'DONE'] as const
export const FX_STATUSES = [...STATUSES, 'PENDING'] as const
export type Status = (typeof FX_STATUSES)[number]

export const STATUS_LABEL: Record<Status, string> = {
  IN_PROGRESS: 'В работе', TO_EXPORT: 'К экспорту', PROCESSING: 'В обработке', ERROR: 'Ошибка', DEFERRED: 'Отложенный',
  // INVALID — термин владельца, без перевода (план 4, F6; STATE §7 «решённые вопросы»)
  EXPORTED: 'Экспортирован', INVALID: 'INVALID', REJECTED: 'Отказ', DONE: 'Обработан', PENDING: 'Ожидает обработки',
}
/** Тон статусной точки — 4 семейства (основная спека 4.2). */
export const STATUS_TONE: Record<Status, StatusTone> = {
  PENDING: 'flowl', IN_PROGRESS: 'flow', TO_EXPORT: 'flowl', PROCESSING: 'flowd', ERROR: 'bad', INVALID: 'badd', DEFERRED: 'warn',
  DONE: 'ok', EXPORTED: 'okl', REJECTED: 'grey',
}
/** Глиф статусной точки — общий словарь для записи и лейна (спека 5b §4). */
export const STATUS_GLYPH: Record<Status, string> = {
  DONE: '✓', EXPORTED: '✓',
  ERROR: '✕', INVALID: '✕',
  REJECTED: '⊘',
  DEFERRED: '!',
  PENDING: '·', IN_PROGRESS: '·', TO_EXPORT: '·', PROCESSING: '·',
}

/** Лейн из словаря и фасетов: до первого ответа (counted = false) чисел нет, потом отсутствующий статус — 0. */
export function laneItems(facets: Facet[], counted: boolean, selected: Facet['value'] | null = null): LaneItem[] {
  const pending = facets.some((x) => x.value === 'PENDING' && x.count > 0)
  const statuses = pending || selected === 'PENDING' ? FX_STATUSES : STATUSES
  return statuses.map((st) => ({
    value: st, label: STATUS_LABEL[st], tone: STATUS_TONE[st], glyph: STATUS_GLYPH[st],
    count: counted ? (facets.find((x) => String(x.value) === st)?.count ?? 0) : undefined,
  }))
}
