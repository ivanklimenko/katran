import { rng } from './fx-docs.data'

/**
 * Общее для данных вкладок фейка (спека 2b §3.5). Цепочки, словари и смещения времени — со стенда pi-constructor
 * (index.html:767–920, обезличен); значения — из строки реестра и детерминированно по номеру строки i.
 */
export const pad = (n: number, w: number) => String(n).padStart(w, '0')
/** Исполнители задач — тот же словарь, что у блокировок реестров. */
export const WHO = ['Иванова М. П.', 'Кузнецов Д. А.', 'Смирнова Е. В.']

/** Время события: база (ISO без зоны, как created реестра) плюс смещение в мс → ISO без зоны с мс. */
export function stamp(base: string, offsetMs: number): string {
  return new Date(Date.parse(`${base}Z`) + offsetMs).toISOString().slice(0, 23)
}
/** «ДД.ММ.ГГГГ» и «ГГММДД» (поле 32A) из ISO. */
export const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`
export const yymmdd = (iso: string) => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10)
export const swiftAmount = (n: number) => n.toFixed(2).replace('.', ',')
/** Сумма в ответе вкладки — десятичная строка без разрядки. */
export const decimal = (n: number) => n.toFixed(2)
/** Строки по 35 знаков по границе слова — формат поля 70. */
export const by35 = (s: string) => (s.match(/.{1,35}(?=\s|$)|.{1,35}/g) ?? []).map((x) => x.trim()).filter(Boolean)
/** Адрес логического терминала: BIC8 + «X» + филиал (у 8-значного BIC — «XXX»). */
export const lt = (bic: string) => `${bic.slice(0, 8)}X${bic.slice(8) || 'XXX'}`

/** Шестнадцатеричная строка длины len — детерминированно по номеру строки и соли. */
export function hexOf(i: number, salt: number, len: number): string {
  const r = rng(i * 7919 + salt * 104729 + 1)
  return Array.from({ length: len }, () => Math.floor(r() * 16).toString(16)).join('')
}
export function uuidOf(i: number, salt: number): string {
  const h = hexOf(i, salt, 32)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20)}`
}

/** Шаг цепочки статусов: маршрут (null — «—»), код, причина, смещение от создания в мс. */
export type Step = [route: string | null, code: string, reason: string | null, offsetMs: number]
export const statusEvents = (base: string, steps: Step[]) =>
  ({ events: steps.map(([route, statusCode, reason, ms]) => ({ at: stamp(base, ms), route, statusCode, reason })) })

export type ComplianceOptions = { clientId: string; department: string; review: boolean; deny: string | null }
/** Комплаенс по эталону (DOCS[0] — ALLOW, DOCS[1] — REVIEW, окончание пусто); deny — отказ с отрицательной нотификацией. */
export function complianceOf(base: string, i: number, o: ComplianceOptions) {
  const open = o.review && !o.deny
  return {
    record: { id: uuidOf(i, 11), processingStart: stamp(base, 2885), processingEnd: open ? null : stamp(base, 7360), nzr: false },
    negativeNotification: o.deny ? { decision: 'DENY', direction: 'Комплаенс-контроль', comment: o.deny } : { decision: null, direction: null, comment: null },
    monitoring: { start: stamp(base, 2979), end: stamp(base, 4360), decision: 'ALLOW', transactionId: hexOf(i, 12, 32), requestedAt: stamp(base, 4113), clientId: o.clientId },
    complianceControl: { start: stamp(base, 4478), end: open ? null : stamp(base, 7360), decision: o.deny ? 'DENY' : o.review ? 'REVIEW' : 'ALLOW' },
    history: [{ enteredAt: stamp(base, 5759), controlSystem: '3308_CTRL', departmentCode: o.department }],
  }
}

const blank = (v: unknown) =>
  v === null || v === '' || (Array.isArray(v) ? v.length === 0 : typeof v === 'object' && Object.keys(v as object).length === 0)
/** Вкладка пуста ⇔ пусты все её поля верхнего уровня: список без строк, исходники без текста, аудит без секций. */
export const isEmptyTab = (body: unknown): boolean => Object.values(body as Record<string, unknown>).every(blank)
/** tabsOff детали — по тем же данным, что отдаёт GET …/tabs/{tab} (спека 2b §3.5); порядок — набор реестра. */
export const tabsOffOf = (ids: readonly string[], trail: Record<string, unknown>): string[] => ids.filter((t) => isEmptyTab(trail[t]))
