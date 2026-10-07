import { createEffect, type Effect } from 'effector'
import { arr, obj, str, strOrNull, type Obj } from './guards'
import { contractError, type ApiError } from './problem'
import { requestFx } from './request'

/** Курсы документа (pi-api.md §1.12): числа — строками, уже отформатированными беком. deal — при конверсии, иначе null. */
export type Rates = {
  cb: { rate: string; date: string; rub: string }
  deal: { rate: string; from: string; to: string; amount: string } | null
}
/** Остаток по счёту проводок: сумма или ошибка по отдельному счёту (ответ в целом при этом 200). */
export type BalanceItem = { acc: string; ccy: string; balance: string; available: string | null } | { acc: string; ccy: string; error: string }
export type Balances = { asOf: string; items: BalanceItem[] }

function parseCb(v: unknown, path: string): Rates['cb'] {
  const o = obj(v, path)
  return { rate: str(o, 'rate', path), date: str(o, 'date', path), rub: str(o, 'rub', path) }
}
function parseDeal(v: unknown, path: string): Rates['deal'] {
  if (v === null || v === undefined) return null
  const o = obj(v, path)
  return { rate: str(o, 'rate', path), from: str(o, 'from', path), to: str(o, 'to', path), amount: str(o, 'amount', path) }
}

/** Ответ GET /grids/fx-docs/documents/{id}/rates; нарушение формы — contractError с путём. */
export function parseRates(v: unknown): Rates {
  const o = obj(v, 'ответ')
  return { cb: parseCb(o.cb, 'ответ.cb'), deal: parseDeal(o.deal, 'ответ.deal') }
}

function parseBalanceItem(v: unknown, path: string): BalanceItem {
  const o: Obj = obj(v, path)
  const acc = str(o, 'acc', path)
  const ccy = str(o, 'ccy', path)
  if (o.error !== undefined && o.error !== null) return { acc, ccy, error: str(o, 'error', path) }
  if (o.balance === undefined || o.balance === null) throw contractError(`${path}: нужен balance или error`)
  return { acc, ccy, balance: str(o, 'balance', path), available: strOrNull(o, 'available', path) }
}

/** Ответ GET /grids/{gridId}/documents/{id}/balances; нарушение формы — contractError с путём. */
export function parseBalances(v: unknown): Balances {
  const o = obj(v, 'ответ')
  return { asOf: str(o, 'asOf', 'ответ'), items: arr(o.items, 'ответ.items').map((x, i) => parseBalanceItem(x, `ответ.items[${i}]`)) }
}

/** GET /grids/fx-docs/documents/{id}/rates — курсы валютного документа. */
export const ratesFx = createEffect<string, Rates, ApiError>(async (id) =>
  parseRates(await requestFx({ method: 'GET', url: `/grids/fx-docs/documents/${encodeURIComponent(id)}/rates` })))

/** GET /grids/{gridId}/documents/{id}/balances — остатки по счетам проводок. */
export function createBalancesFx(gridId: string): Effect<string, Balances, ApiError> {
  return createEffect<string, Balances, ApiError>(async (id) =>
    parseBalances(await requestFx({ method: 'GET', url: `/grids/${gridId}/documents/${encodeURIComponent(id)}/balances` })))
}
