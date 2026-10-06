import type { EditStatus } from '@katran/ui'
import type { EditValue } from '../../../shared/api'
import type { FxDocDetail } from './detail'

/** Запись истории правки цели (план 2c §3.1): when/at — ISO без зоны до минут; by/at — кто и когда утвердил или отклонил (status 'rejected'); reason — причина отклонения, иначе null. */
export type FxHistEntry = { who: string; when: string; was: EditValue; now: EditValue; note: string | null; status: EditStatus; by: string | null; at: string | null; reason: string | null }
/** Правка цели: now — текущее значение после правок (null у 'route' — маршрут меняет бек), hist — от первой записи к последней, canConfirm — можно ли текущему пользователю утвердить последнюю запись (ставит бек). */
export type FxEdit = { now: EditValue | null; canConfirm: boolean; hist: FxHistEntry[] }

/** Цель правки поля SWIFT: '57' → 'field:57', 'B.57' → 'field:B.57'. */
export const fieldTarget = (tag: string): string => `field:${tag}`
const FIELD = 'field:'

/**
 * Текущее значение цели в детали: поле — SwiftValue ({ lines: [] } у пустого), refOut ?? '', accDt/accKt, valueDates[0].
 * 'route' — ключ edits, но не цель редактора (маршрут меняет бек, значения правки нет): для него, как и для неизвестной цели, —
 * исключение; виды читают d.edits.route напрямую. То же для originalOf и isChanged.
 */
export function currentOf(d: FxDocDetail, target: string): EditValue {
  if (target.startsWith(FIELD)) return d.fields[target.slice(FIELD.length)] ?? { lines: [] }
  switch (target) {
    case 'refOut': return d.refOut ?? ''
    case 'accDt': return d.accDt
    case 'accKt': return d.accKt
    case 'valueDate': return d.valueDates[0]
    default: throw new Error(`Неизвестная цель правки «${target}»`)
  }
}

/** Исходное значение цели — «было» первой записи истории; без истории — текущее. */
export function originalOf(d: FxDocDetail, target: string): EditValue {
  return d.edits[target]?.hist[0]?.was ?? currentOf(d, target)
}

/** Текущее отличается от исходного; после отката (в2) — false, хотя история есть. */
export function isChanged(d: FxDocDetail, target: string): boolean {
  return !sameEditValue(currentOf(d, target), originalOf(d, target))
}

/** Равенство значений правки: строки — как есть; объекты — по opt и acc (пустое = нет) и строкам, порядок ключей не важен. */
export function sameEditValue(a: EditValue, b: EditValue): boolean {
  if (typeof a === 'string' || typeof b === 'string') return a === b
  return (a.opt || '') === (b.opt || '') && (a.acc || '') === (b.acc || '')
    && a.lines.length === b.lines.length && a.lines.every((line, i) => line === b.lines[i])
}
