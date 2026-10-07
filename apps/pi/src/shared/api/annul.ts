import type { AnnulState } from '../lib/detail'
import { bool, obj, oneOf, reqBool, str, strOrNull } from './guards'

/**
 * Разбор аннулирования для мапперов деталей обеих сущностей (pi-api.md §7.2, §7.3, спека 2e §3.1 п. 2).
 * null и отсутствие ключа — аннулирования не было; все ключи объекта бек отдаёт всегда, canConfirm обязателен.
 */
export function parseAnnul(v: unknown, path: string): AnnulState | null {
  if (v === null || v === undefined) return null
  const o = obj(v, path)
  return {
    status: oneOf(o, 'status', ['pending', 'done', 'rejected'] as const, path),
    who: str(o, 'who', path),
    when: str(o, 'when', path),
    reason: str(o, 'reason', path),
    by: strOrNull(o, 'by', path),
    at: strOrNull(o, 'at', path),
    rejectReason: strOrNull(o, 'rejectReason', path),
    canConfirm: reqBool(o, 'canConfirm', path),
  }
}

/** canAnnul детали: нет ключа — false (старые ответы 2d); не boolean — ошибка с путём. */
export function parseCanAnnul(o: Record<string, unknown>, path: string): boolean {
  return bool(o, 'canAnnul', path)
}
