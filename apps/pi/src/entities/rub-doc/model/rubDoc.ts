import type { Status } from '../../doc-status/@x/rub-doc'

export const RUB_TYPES = ['PAYDOCRU', 'REQDOCRU', 'PAYORDRU'] as const
export type RubType = (typeof RUB_TYPES)[number]
export const ED_CODES = ['ED101', 'ED104', 'ED105'] as const
export const ED_BY_TYPE: Record<RubType, (typeof ED_CODES)[number]> = { PAYDOCRU: 'ED101', REQDOCRU: 'ED104', PAYORDRU: 'ED105' }
export const TYPE_NAME: Record<RubType, string> = { PAYDOCRU: 'Платёжное поручение', REQDOCRU: 'Инкассовое поручение', PAYORDRU: 'Платёжный ордер' }
export const RUB_DIRECTIONS = ['IN', 'OUT', 'TRANSIT', 'OTHER'] as const

/** Рублёвый документ в реестре. Имена полей — наш вариант строки content[] (docs/reference/pi-api.md). */
export type RubDoc = {
  id: string; docNumber: string; uuid: string; txId: string; docRef: string
  created: string; changed: string
  type: RubType; edCode: (typeof ED_CODES)[number]
  direction: (typeof RUB_DIRECTIONS)[number]; dirTxt: string
  amount: number; queue: number; prio: 0 | 1
  fromName: string; fromAcc: string; fromInn: string; fromKpp: string; fromBic: string; fromBank: string
  toName: string; toAcc: string; toInn: string; toKpp: string; toBic: string; toBank: string
  initiator: string; source: string; destination: string
  purpose: string; status: Status; reason: string | null
  /** Заблокирована другим пользователем (спека 5a §6, B1; В-Р2). */
  lock: { who: string; since: string } | null
  /** Неактивна — не участвует в массовом выделении (спека 5a §6, B1; В-Р2). */
  inactive: { why: string } | null
}
