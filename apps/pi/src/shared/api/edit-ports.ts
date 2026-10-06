import { createEffect, type Effect } from 'effector'
import { arr, obj, str } from './guards'
import type { DetailParser } from './ports'
import type { ApiError } from './problem'
import { requestFx } from './request'

/** Значение правки (план 2c §3.1): у полей SWIFT — объект { opt?, acc?, lines }, у остальных целей (20 исх, счета, дата) — строка. Одно имя для черновика, тела запроса и истории. */
export type EditValue = { opt?: string | undefined; acc?: string | undefined; lines: string[] } | string
/** Правка одной цели документа: was — значение, от которого начата правка (бек сверяет с текущим, иначе 409), now — новое. */
export type EditQuery = { id: string; target: string; was: EditValue; now: EditValue }
export type AccountSide = 'dt' | 'kt'
export type AccountsQuery = { id: string; side: AccountSide }
/** Счёт из справочника: Кт — карточка клиента, Дт — счета банка; оба — по валюте документа. */
export type AccountItem = { account: string; ccy: string; kind: string }
/** Порты правки: POST …/edits возвращает документ целиком (бек применил правку), GET …/accounts — справочник счетов стороны. */
export type EditPorts<D> = {
  saveEditFx: Effect<EditQuery, D, ApiError>
  accountsFx: Effect<AccountsQuery, AccountItem[], ApiError>
}

/** Ответ GET /grids/{gridId}/documents/{id}/accounts: { items: [{ account, ccy, kind }] }; иначе contractError с путём. */
export function fromAccountsResponse(raw: unknown): AccountItem[] {
  const o = obj(raw, 'ответ')
  return arr(o.items, 'ответ.items').map((x, i) => {
    const path = `ответ.items[${i}]`
    const it = obj(x, path)
    return { account: str(it, 'account', path), ccy: str(it, 'ccy', path), kind: str(it, 'kind', path) }
  })
}

/** Порты правки документа — предложение в контракт vtb-filters (docs/reference/pi-api.md), как деталь и вкладки. */
export function createEditPorts<D>({ gridId, parseDetail }: { gridId: string; parseDetail: DetailParser<D> }): EditPorts<D> {
  // id — в пути: кодируется, как у detailFx; вызов requestFx внутри обработчика сохраняет scope (effector 23)
  const doc = (id: string) => `/grids/${gridId}/documents/${encodeURIComponent(id)}`
  const saveEditFx = createEffect<EditQuery, D, ApiError>(async ({ id, target, was, now }) =>
    parseDetail(obj(await requestFx({ method: 'POST', url: `${doc(id)}/edits`, body: { target, was, now } }), 'ответ'), 'ответ'))
  const accountsFx = createEffect<AccountsQuery, AccountItem[], ApiError>(async ({ id, side }) =>
    fromAccountsResponse(await requestFx({ method: 'GET', url: `${doc(id)}/accounts`, query: { side } })))
  return { saveEditFx, accountsFx }
}
