/** Данные вкладок деталки — история обработки документа, общая для валюты и рубля (спека 2b §3.2). Имена бека держит api/trail.mapper.ts. */

/** Строка вкладки «Статусы»: время, маршрут (null — «—»), код шага, причина. */
export type StatusEvent = { at: string; route: string | null; code: string; reason: string | null }

/** Вкладка «Комплаенс»: запись, отрицательная нотификация, мониторинг (ИС4021), подразделение (ОПС3308), история попаданий. */
export type Compliance = {
  record: { id: string; start: string | null; end: string | null; nzr: boolean | null }
  negative: { decision: string | null; direction: string | null; comment: string | null }
  monitoring: { start: string | null; end: string | null; decision: string | null; txId: string | null; requestAt: string | null; clientId: string | null }
  department: { start: string | null; end: string | null; decision: string | null }
  history: { at: string; system: string; department: string }[]
}

export type LinkedParty = { name: string | null; account: string | null; extra: string | null }
/** Сумма — десятичная строка бека без разрядки («1249965.00»); форматирует вид. */
export type LinkedPosting = { account: string | null; amount: string | null; currency: string | null; register: string | null }
/** Связанный документ того же реестра: docId открывается в B. */
export type LinkedDoc = {
  docId: string; date: string; type: string; relation: string; purpose: string | null
  status: string; processed: string | null; posted: string | null; kind: string | null
  debit: LinkedPosting; credit: LinkedPosting; from: LinkedParty; to: LinkedParty
}

/** Задача: state — открыта / закрыта; tone — точка открытой задачи; история — включая закрытие. */
export type DocTask = { id: string; state: 'open' | 'done'; tone: 'ok' | 'info' | 'warn'; type: string; at: string; text: string; who: string | null; history: { at: string; text: string }[] }
export type DocNotification = { at: string; attempts: number; status: string; code: string }
export type StreamEvent = { at: string; system: string; destination: string; event: string; status: string; tries: number }
export type MpuMessage = { id: string; type: string; created: string; exportStatus: string; exported: string | null; receiver: string; docReference: string; docId: string; swift: string }
/** Аудит: секция → объект как есть (показывается JSON). */
export type AuditSections = Record<string, Record<string, unknown>>
/** Исходники: ключ → текст; '' — нет (аккордеон не раскрывается, в заголовке «нет»). */
export type SourceTexts = Record<string, string>
export type TrailTabId = 'statuses' | 'compliance' | 'linked' | 'tasks' | 'notif' | 'source' | 'ed244' | 'stream' | 'mpu' | 'audit'
