import { obj, oneOf, str } from './guards'

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
