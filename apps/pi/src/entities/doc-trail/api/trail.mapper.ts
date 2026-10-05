import { arr, contractError, num, obj, oneOf, str, strOrNull, type Obj, type TabParser } from '../../../shared/api'
import type {
  AuditSections, Compliance, DocNotification, DocTask, LinkedDoc, LinkedParty, LinkedPosting, MpuMessage, SourceTexts, StatusEvent, StreamEvent, TrailTabId,
} from '../model/types'

/** Ответы GET …/documents/{id}/tabs/{tab} → данные вкладок. Если бек называет поля иначе — правится только этот файл. */

/** Необязательный текст: null, отсутствие ключа и '' — «нет значения». */
const text = (o: Obj, k: string, path: string): string | null => strOrNull(o, k, path) || null

function boolOrNull(o: Obj, k: string, path: string): boolean | null {
  const v = o[k]
  if (v === null || v === undefined) return null
  if (typeof v !== 'boolean') throw contractError(`${path}.${k}: ожидалось true, false или null`)
  return v
}
/** Вложенный объект под ключом k и его путь. */
function sub(o: Obj, k: string, path: string): [Obj, string] {
  const p = `${path}.${k}`
  return [obj(o[k], p), p]
}
/** Список объектов под ключом k: путь элемента — с индексом. */
function list<T>(o: Obj, k: string, path: string, item: (x: Obj, p: string) => T): T[] {
  return arr(o[k], `${path}.${k}`).map((x, i) => {
    const p = `${path}.${k}[${i}]`
    return item(obj(x, p), p)
  })
}

export const parseStatuses = (raw: unknown, path: string): StatusEvent[] =>
  list(obj(raw, path), 'events', path, (e, p): StatusEvent => ({ at: str(e, 'at', p), route: text(e, 'route', p), code: str(e, 'statusCode', p), reason: text(e, 'reason', p) }))

export function parseCompliance(raw: unknown, path: string): Compliance {
  const o = obj(raw, path)
  const [rec, pr] = sub(o, 'record', path)
  const [neg, pn] = sub(o, 'negativeNotification', path)
  const [mon, pm] = sub(o, 'monitoring', path)
  const [dep, pd] = sub(o, 'complianceControl', path)
  return {
    record: { id: str(rec, 'id', pr), start: text(rec, 'processingStart', pr), end: text(rec, 'processingEnd', pr), nzr: boolOrNull(rec, 'nzr', pr) },
    negative: { decision: text(neg, 'decision', pn), direction: text(neg, 'direction', pn), comment: text(neg, 'comment', pn) },
    monitoring: {
      start: text(mon, 'start', pm), end: text(mon, 'end', pm), decision: text(mon, 'decision', pm),
      txId: text(mon, 'transactionId', pm), requestAt: text(mon, 'requestedAt', pm), clientId: text(mon, 'clientId', pm),
    },
    department: { start: text(dep, 'start', pd), end: text(dep, 'end', pd), decision: text(dep, 'decision', pd) },
    history: list(o, 'history', path, (h, p) => ({ at: str(h, 'enteredAt', p), system: str(h, 'controlSystem', p), department: str(h, 'departmentCode', p) })),
  }
}

function posting(o: Obj, k: string, path: string): LinkedPosting {
  const [x, p] = sub(o, k, path)
  return { account: text(x, 'account', p), amount: text(x, 'amount', p), currency: text(x, 'currency', p), register: text(x, 'register', p) }
}
function party(o: Obj, k: string, path: string): LinkedParty {
  const [x, p] = sub(o, k, path)
  return { name: text(x, 'name', p), account: text(x, 'account', p), extra: text(x, 'details', p) }
}
export const parseLinked = (raw: unknown, path: string): LinkedDoc[] =>
  list(obj(raw, path), 'documents', path, (d, p): LinkedDoc => ({
    docId: str(d, 'docId', p), date: str(d, 'date', p), type: str(d, 'docType', p), relation: str(d, 'relation', p), purpose: text(d, 'purpose', p),
    status: str(d, 'status', p), processed: text(d, 'processedAt', p), posted: text(d, 'postingDate', p), kind: text(d, 'kind', p),
    debit: posting(d, 'debit', p), credit: posting(d, 'credit', p), from: party(d, 'sender', p), to: party(d, 'receiver', p),
  }))

const TASK_STATUS = ['OPEN', 'DONE'] as const
const TASK_SEVERITY = ['OK', 'INFO', 'WARN'] as const
const TASK_TONE: Record<(typeof TASK_SEVERITY)[number], DocTask['tone']> = { OK: 'ok', INFO: 'info', WARN: 'warn' }
export const parseTasks = (raw: unknown, path: string): DocTask[] =>
  list(obj(raw, path), 'tasks', path, (t, p): DocTask => ({
    id: str(t, 'id', p),
    state: oneOf(t, 'status', TASK_STATUS, p) === 'DONE' ? 'done' : 'open',
    tone: TASK_TONE[oneOf(t, 'severity', TASK_SEVERITY, p)],
    type: str(t, 'taskType', p), at: str(t, 'createdAt', p), text: str(t, 'text', p), who: text(t, 'assignee', p),
    history: list(t, 'history', p, (h, hp) => ({ at: str(h, 'at', hp), text: str(h, 'event', hp) })),
  }))

export const parseNotifications = (raw: unknown, path: string): DocNotification[] =>
  list(obj(raw, path), 'notifications', path, (n, p): DocNotification => ({ at: str(n, 'sentAt', p), attempts: num(n, 'attempts', p), status: str(n, 'status', p), code: str(n, 'responseCode', p) }))

export const parseStream = (raw: unknown, path: string): StreamEvent[] =>
  list(obj(raw, path), 'events', path, (e, p): StreamEvent => ({
    at: str(e, 'at', p), system: str(e, 'systemCode', p), destination: str(e, 'systemName', p),
    event: str(e, 'event', p), status: str(e, 'status', p), tries: num(e, 'attempts', p),
  }))

export const parseMpu = (raw: unknown, path: string): MpuMessage[] =>
  list(obj(raw, path), 'messages', path, (m, p): MpuMessage => ({
    id: str(m, 'id', p), type: str(m, 'messageType', p), created: str(m, 'createdAt', p), exportStatus: str(m, 'exportStatus', p),
    exported: text(m, 'exportedAt', p), receiver: str(m, 'receiver', p), docReference: str(m, 'docReference', p), docId: str(m, 'docId', p),
    swift: str(m, 'swiftText', p),
  }))

/** Аудит: каждая секция — объект, содержимое не проверяется (показывается JSON как есть). */
export function parseAudit(raw: unknown, path: string): AuditSections {
  const o = obj(raw, path)
  const out: AuditSections = {}
  for (const k of Object.keys(o)) out[k] = { ...obj(o[k], `${path}.${k}`) }
  return out
}

/** Исходники: ключ → текст; null — «нет» (пустая строка). Один парсер на source (SWIFT) и ed244 (XML). */
export function parseSourceTexts(raw: unknown, path: string): SourceTexts {
  const o = obj(raw, path)
  const out: SourceTexts = {}
  for (const k of Object.keys(o)) out[k] = strOrNull(o, k, path) ?? ''
  return out
}

/** Таблица parseTab для портов обоих реестров: ключи — ровно TrailTabId (контрактный тест в app/fake). */
export const TRAIL_PARSERS: Record<TrailTabId, TabParser> = {
  statuses: parseStatuses, compliance: parseCompliance, linked: parseLinked, tasks: parseTasks, notif: parseNotifications,
  source: parseSourceTexts, ed244: parseSourceTexts, stream: parseStream, mpu: parseMpu, audit: parseAudit,
}
