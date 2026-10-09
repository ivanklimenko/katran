import { toApiError } from '../../shared/api'

/**
 * Нотификации в фейке (спека 2e §3.7, pi-api.md §1.14): исходное сообщение строки и переотправка.
 *
 * - Тело сообщения — по профилю грида: JSON у валюты, XML у рубля; одна строка сида (`plain`) — `text/plain`
 *   (проверка подсветки по языку «текст»).
 * - `resend` без `nid` дописывает по новой попытке `OK` к каждой нотификации, чья последняя попытка не `OK` (все в `OK` — к последней
 *   нотификации); с `nid` — одну попытку к нотификации этой строки. Новая попытка — новая строка вкладки с новым уникальным
 *   `id` (`n<следующий номер>`, у сида `n1`…`n3` не меняются), кодом ответа исходной нотификации и временем фейка.
 * - Повторная переотправка того же документа в пределах окна `RESEND_WINDOW_MS` (по часам сервера `clock`) — 409: «переотправка уже
 *   идёт». Окно фиксированное, чтобы тесты не зависели от реального времени (часы подменяются опцией сервера).
 */

type Row = { id: string; sentAt: string; attempts: number; status: string; responseCode: string }
type Tab = { notifications: Row[] }

/** Окно, в течение которого повторная переотправка документа отвечает 409. */
export const RESEND_WINDOW_MS = 2000

export type FakeNotifStoreConfig = {
  /** Профиль грида: JSON у валюты, XML у рубля. */
  format: 'json' | 'xml'
  /** Строка сида с телом `text/plain`; без поля — все по профилю. */
  plain?: { docId: string; nid: string } | null | undefined
}
export type FakeNotifStore = {
  /** Вкладка notif с дописанными попытками. */
  overlay: (id: string, tab: unknown) => unknown
  /** Исходное сообщение строки; 404 — нет строки. */
  message: (id: string, tab: unknown, nid: string) => { contentType: string; body: string }
  /** Переотправка (nid null — все); возвращает вкладку целиком; бросает 404 (нет строки), 409 (окно). */
  resend: (id: string, tab: unknown, nid: string | null, when: string, nowMs: number) => unknown
}

const notFound = (nid: string): never => {
  throw toApiError(404, { type: 'urn:katran:fake', title: 'Нотификация не найдена', status: 404, detail: nid })
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function createNotifStore(cfg: FakeNotifStoreConfig): FakeNotifStore {
  /** id документа → дописанные попытки с исходной нотификацией (id строки сида). */
  const extra = new Map<string, { of: string; row: Row }[]>()
  const lastResend = new Map<string, number>()
  const baseOf = (tab: unknown): Row[] => ((tab ?? { notifications: [] }) as Tab).notifications
  const rowsOf = (id: string, tab: unknown): Row[] => [...baseOf(tab), ...(extra.get(id) ?? []).map((e) => e.row)]

  const overlay = (id: string, tab: unknown): unknown => (extra.has(id) ? { ...(tab as object), notifications: rowsOf(id, tab) } : tab)

  const message: FakeNotifStore['message'] = (id, tab, nid) => {
    const row = rowsOf(id, tab).find((r) => r.id === nid)
    if (!row) return notFound(nid)
    if (cfg.plain && cfg.plain.docId === id && cfg.plain.nid === nid) {
      return { contentType: 'text/plain', body: `Нотификация ${row.id} по документу ${id}\nСтатус: ${row.status}\nКод ответа: ${row.responseCode}\nПопыток: ${row.attempts}\nОтправлена: ${row.sentAt}` }
    }
    if (cfg.format === 'xml') {
      return { contentType: 'application/xml', body: `<?xml version="1.0" encoding="UTF-8"?>\n<Notification id="${esc(row.id)}" docId="${esc(id)}">\n  <Event>${esc(row.responseCode)}</Event>\n  <Status>${esc(row.status)}</Status>\n  <Attempts>${row.attempts}</Attempts>\n  <SentAt>${esc(row.sentAt)}</SentAt>\n</Notification>\n` }
    }
    return { contentType: 'application/json', body: JSON.stringify({ event: row.responseCode, docId: id, nid: row.id, status: row.status, attempt: row.attempts, sentAt: row.sentAt }, null, 2) }
  }

  const resend: FakeNotifStore['resend'] = (id, tab, nid, when, nowMs) => {
    const base = baseOf(tab)
    const list = extra.get(id) ?? []
    /** Исходная нотификация (строка сида) для строки с любым id: у дописанной попытки — та, к которой она дописана. */
    const originOf = (rowId: string): Row | undefined => base.find((b) => b.id === rowId) ?? base.find((b) => b.id === list.find((e) => e.row.id === rowId)?.of)
    const lastOf = (b: Row): Row => [...list].reverse().find((e) => e.of === b.id)?.row ?? b
    let targets: Row[]
    if (nid === null) {
      const notOk = base.filter((b) => lastOf(b).status !== 'OK')
      targets = notOk.length > 0 ? notOk : base.slice(-1)
    } else {
      const origin = originOf(nid)
      if (!origin) return notFound(nid)
      targets = [origin]
    }
    const prev = lastResend.get(id)
    if (prev !== undefined && nowMs - prev < RESEND_WINDOW_MS) {
      throw toApiError(409, { type: 'urn:katran:resend-conflict', title: 'Переотправка уже идёт', status: 409 })
    }
    lastResend.set(id, nowMs)
    const added = [...list]
    for (const t of targets) {
      added.push({ of: t.id, row: { id: `n${base.length + added.length + 1}`, sentAt: `${when}.000`, attempts: 1, status: 'OK', responseCode: t.responseCode } })
    }
    extra.set(id, added)
    return overlay(id, tab)
  }
  return { overlay, message, resend }
}
