import { createEffect, type Effect } from 'effector'
import { obj, oneOf, str } from './guards'
import type { ApiError } from './problem'
import { requestFx } from './request'

/** Исходное сообщение нотификации (pi-api.md §1.14): тип содержимого — закрытый набор, тело — текст. */
export type NotifMessage = { contentType: 'application/json' | 'application/xml' | 'text/plain'; body: string }

/** Ответ GET …/notifications/{nid}/message; нарушение формы — contractError с путём. */
export function parseNotifMessage(v: unknown): NotifMessage {
  const o = obj(v, 'ответ')
  return {
    contentType: oneOf(o, 'contentType', ['application/json', 'application/xml', 'text/plain'] as const, 'ответ'),
    body: str(o, 'body', 'ответ'),
  }
}

/** nid — необязательный: без него переотправляются все нотификации документа. */
export type ResendQuery = { id: string; nid?: string | undefined }
export type NotifPorts = {
  /** POST …/notifications/resend (все) или …/notifications/{nid}/resend, тело {} → сырое тело вкладки notif (разбирает потребитель). */
  resendFx: Effect<ResendQuery, unknown, ApiError>
  /** GET …/notifications/{nid}/message — исходное сообщение. */
  messageFx: Effect<{ id: string; nid: string }, NotifMessage, ApiError>
}

export function createNotifPorts(gridId: string): NotifPorts {
  const notifs = (id: string) => `/grids/${gridId}/documents/${encodeURIComponent(id)}/notifications`
  const resendFx = createEffect<ResendQuery, unknown, ApiError>(({ id, nid }) =>
    requestFx({ method: 'POST', url: nid === undefined ? `${notifs(id)}/resend` : `${notifs(id)}/${encodeURIComponent(nid)}/resend`, body: {} }))
  const messageFx = createEffect<{ id: string; nid: string }, NotifMessage, ApiError>(async ({ id, nid }) =>
    parseNotifMessage(await requestFx({ method: 'GET', url: `${notifs(id)}/${encodeURIComponent(nid)}/message` })))
  return { resendFx, messageFx }
}
