import type { Status } from '../../doc-status/@x/fx-doc'

export const FX_TYPES = ['MT103', 'MT202', 'MT202COV', 'MT199'] as const
export const CURRENCIES = ['USD', 'EUR', 'CNY', 'RUB'] as const
export const DIRECTIONS = ['IN', 'OUT', 'TRANSIT', 'OTHER'] as const
export type Direction = (typeof DIRECTIONS)[number]
export const DIRECTION_LABEL: Record<Direction, string> = { IN: 'Входящий', OUT: 'Исходящий', TRANSIT: 'Транзит', OTHER: 'Прочее' }
export const ROUTE_TYPES = ['LORO', 'NOSTRO', 'INTERNAL'] as const
export type RouteType = (typeof ROUTE_TYPES)[number]

/** Валютный документ в реестре — тип Doc эталона (apps/demo/src/data/docs.ts), перенесён дословно (R4). */
export type FxDoc = {
  id: string; docNumber: number; refIn: string | null; refOut: string | null; uetr: string
  created: string; vdDt: string; vdKt: string
  type: (typeof FX_TYPES)[number]
  direction: Direction; dirTxt: string
  amount: number; currency: (typeof CURRENCIES)[number]
  f50name: string; f50acc: string; purpose: string | null
  f52: string; f57: string; f59name: string; f59acc: string
  status: Status; reason: string | null
  sender: string; receiver: string; provS: string; provR: string
  /** Заблокирована другим пользователем (спека 5a §6, B1). */
  lock: { who: string; since: string } | null
  /** Неактивна — не участвует в массовом выделении (спека 5a §6, B1). */
  inactive: { why: string } | null
  /** Буква опции полей 50/59 (эталон `base.f['50']` в `grid.tpl.html`) — спека 5b §3. */
  f50opt: string; f59opt: string
  /** Наименования банков 52/57 — к уже имеющимся BIC f52/f57 (словарь эталона, обезличен). */
  f52name: string; f57name: string
  /** Поле 58 — только у MT202/MT202COV, иначе пусто (эталон `base.f['58']`). */
  f58: string | null; f58name: string | null
  /** S / R out (эталон `base.outS`/`base.outR`). */
  outSender: string; outReceiver: string
  /** Маршрут — тип, BIC получателя, счёт (эталон `RT`/`ACC_PFX`). */
  routeType: RouteType; routeRecv: string; routeAcc: string
}
