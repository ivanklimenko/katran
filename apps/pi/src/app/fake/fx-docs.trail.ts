import type { FxDoc } from '../../entities/fx-doc'
import { by35, complianceOf, ddmmyyyy, decimal, hexOf, lt, pad, stamp, statusEvents, swiftAmount, uuidOf, WHO, yymmdd, type Step } from './trail.data'

/** Нелокальные вкладки валютного реестра — набор GET …/tabs/{tab} (FX_TABS без main и extra, спека 2b §3.1). */
export const FX_TRAIL_TABS = ['statuses', 'compliance', 'linked', 'tasks', 'notif', 'source', 'stream', 'mpu', 'audit'] as const
export type FxTrailTab = (typeof FX_TRAIL_TABS)[number]

/** Идентификатор транзакции — общий с деталью (блок проводок) и аудитом. */
export const fxTxId = (i: number) => `ba5ac4${pad(i % 100, 2)}-d0a4-40ea-b639-${pad((i * 7919) % 1e12, 12)}`

const OUR = 'VKRBRU8KXXX'
const ADDR50 = ['ULITSA PROFSOYUZNAYA 83-1-214', 'RU/MOSCOW, 117279']
const ADDR59 = ['PROSPEKT MIRA 101-2-45', 'RU/MOSCOW, 129085']

/** Дошёл до конца цепочки — вкладки как у эталона DOCS[0]; иначе стоит на маршрутизации — как у DOCS[1]. */
const finished = (row: FxDoc) => row.status === 'DONE' || row.status === 'EXPORTED'
const inboundOf = (row: FxDoc) => row.direction === 'IN' || row.direction === 'TRANSIT'
const refIn = (row: FxDoc) => row.refIn ?? `FX${yymmdd(row.created)}${pad(row.docNumber % 1e7, 7)}`
const refOut = (row: FxDoc) => row.refOut ?? `VK${yymmdd(row.created)}${pad(row.docNumber % 1e7, 7)}`
/** Тип в блоке 2: MT202COV → 202. */
const mtOf = (row: FxDoc) => row.type.slice(2, 5)

/** Цепочка статусов эталона: DOCS[0] — 12 шагов до fx.finish, DOCS[1] — 4 шага до маршрутизации; смещения — мс эталона. */
function chain(row: FxDoc): Step[] {
  const inbound = inboundOf(row)
  const d = inbound ? 'in' : 'out'
  const rt = inbound ? 'RT_FX_IN' : 'RT_FX_OUT'
  if (!finished(row)) {
    return [
      [null, 'fx-dup-check.end', null, 0],
      [rt, `fx-${d}-checks.start`, null, 426],
      [rt, `fx-${d}-checks.end`, null, 1904],
      [rt, `fx-${d}-routing.start`, row.reason ?? 'Ожидание решения сотрудника', 2338],
    ]
  }
  const post = inbound ? 'RT_FX_CREDIT' : 'RT_FX_DEBIT'
  const move = inbound ? 'fx-credit-client' : 'fx-debit-client'
  return [
    [null, 'fx-dup-check.end', null, 0],
    [rt, `fx-${d}-checks.start`, null, 401],
    [rt, `fx-${d}-checks.end`, null, 2301],
    [rt, `fx-${d}-routing.start`, 'Ожидание решения сотрудника', 2900],
    [rt, `fx-${d}-routing.end`, null, 95142],
    [post, `${move}.start`, null, 96468],
    [post, `${move}.end`, null, 97716],
    [post, 'fx-postprocess.start', null, 98172],
    [post, 'fx-postprocess.end', null, 99071],
    [post, 'fx-accounting.start', null, 195573],
    [post, 'fx-accounting.end', null, 196579],
    [post, 'fx.finish', null, 196674],
  ]
}

/** Связанный документ — существующая строка того же реестра (docId открывается в B). */
function linkedDoc(lr: FxDoc, relation: 'CHILD' | 'PARENT', kind: string, purpose: string) {
  const amount = decimal(lr.amount)
  return {
    docId: lr.id, date: lr.created.slice(0, 10), docType: lr.type, relation, purpose, status: lr.status,
    processedAt: lr.created, postingDate: finished(lr) ? lr.created.slice(0, 10) : null, kind,
    debit: { account: lr.f59acc, amount, currency: lr.currency, register: '00010_ClientCurrent' },
    credit: { account: lr.routeAcc, amount, currency: lr.currency, register: `00000_Nostro${lr.currency}` },
    sender: { name: lr.f59name, account: lr.f59acc, details: null },
    receiver: { name: lr.f50name, account: lr.f50acc, details: lr.refIn ? `RETURN OF ${lr.refIn}` : null },
  }
}
function linked(row: FxDoc, i: number, rows: readonly FxDoc[]) {
  const at = (k: number) => rows[(i + k) % rows.length]!
  const title = (lr: FxDoc, tail: string) => `${lr.type} ${lr.currency} ${decimal(lr.amount)} ${ddmmyyyy(lr.created)} ${tail}`
  if (!finished(row)) return [linkedDoc(at(5), 'PARENT', 'OUR', title(at(5), 'код (1.6.2.2.1.)'))]
  return [
    linkedDoc(at(7), 'CHILD', 'SHA', title(at(7), 'возврат (1.6.2.2.1.)')),
    linkedDoc(at(13), 'CHILD', 'OUR', 'Комиссия за входящий перевод по тарифу OUR'),
  ]
}

function tasks(row: FxDoc, i: number, b: string, who: string) {
  const inbound = inboundOf(row)
  const d = inbound ? 'in' : 'out'
  const act = inbound ? 'зачисление' : 'списание'
  if (!finished(row)) {
    return [{
      id: `task-${hexOf(i, 22, 12)}`, status: 'OPEN', severity: row.status === 'ERROR' || row.status === 'REJECTED' ? 'WARN' : 'INFO',
      taskType: 'PAYMENT_INSTRUCTION', createdAt: stamp(b, 2338),
      text: `Требуется подтвердить маршрут; требуется подтверждение контролёра на ${act}`, assignee: null,
      history: [{ at: stamp(b, 2338), event: `Создана: fx-${d}-routing` }],
    }]
  }
  return [
    {
      id: `task-${hexOf(i, 21, 12)}`, status: 'DONE', severity: 'OK', taskType: 'PAYMENT_INSTRUCTION', createdAt: stamp(b, 13759),
      text: `Требуется подтвердить маршрут; требуется утвердить ${inbound ? `зачисление по клиентскому счёту ${row.f59acc}` : `списание с клиентского счёта ${row.f50acc}`}`,
      assignee: who,
      history: [
        { at: stamp(b, 13759), event: `Создана: fx-${d}-routing` },
        { at: stamp(b, 54759), event: `Взята в работу: ${who}` },
        { at: stamp(b, 94759), event: `Решение: маршрут подтверждён, ${act} утверждено` },
        { at: stamp(b, 94759), event: `Закрыта · ${who}` },
      ],
    },
    {
      id: `task-${hexOf(i, 23, 12)}`, status: 'OPEN', severity: 'INFO', taskType: 'PAYMENT_INSTRUCTION', createdAt: stamp(b, 196759),
      text: `Комиссия ${row.currency} 35,00 удержана по тарифу OUR; проверить корректность тарифного плана клиента`, assignee: null,
      history: [{ at: stamp(b, 196759), event: 'Создана: fx-accounting' }],
    },
  ]
}

/** Входящее сообщение (эталон source.swiftMessage): блоки 1–5, тело — поля документа. */
function incoming(row: FxDoc, i: number): string {
  const day = yymmdd(row.created)
  const hhmm = row.created.slice(11, 13) + row.created.slice(14, 16)
  const purpose = row.purpose ? `:70:${by35(row.purpose).join('\n')}\n` : ''
  return `{1:F01${lt(OUR)}${pad((i * 7919) % 1e10, 10)}}{2:O${mtOf(row)}${hhmm}${day}${lt(row.sender)}${pad((i * 104729) % 1e10, 10)}${day}${hhmm}N}` +
    `{3:{108:MUR${pad(i, 13)}}{111:001}{121:${row.uetr}}}{4:\n` +
    `:20:${refIn(row)}\n:23B:CRED\n:32A:${day}${row.currency}${swiftAmount(row.amount)}\n` +
    `:50F:/${row.f50acc}\n1/${row.f50name}\n2/${ADDR50[0]}\n3/${ADDR50[1]}\n:52A:${row.f52}\n:57A:${row.f57}\n` +
    `:59F:/${row.f59acc}\n1/${row.f59name}\n2/${ADDR59[0]}\n3/${ADDR59[1]}\n${purpose}:71A:OUR\n-}{5:{MAC:00000000}{CHK:${hexOf(i, 3, 12).toUpperCase()}}}`
}
/** Исходящее сообщение (эталон source.outgoingSwiftMessage). */
function outgoing(row: FxDoc): string {
  const purpose = row.purpose ? `:70:${by35(row.purpose)[0] ?? ''}\n` : ''
  return `{1:F01${lt(OUR)}0000000000}{2:I${mtOf(row)}${lt(row.outReceiver)}N}{3:{121:${row.uetr}}}{4:\n` +
    `:20:${refOut(row)}\n:21:${refIn(row)}\n:23B:CRED\n:32A:${yymmdd(row.created)}${row.currency}${swiftAmount(row.amount)}\n` +
    `:50F:/${row.f50acc}\n1/${row.f50name}\n:52A:${row.f52}\n:57A:${row.f57}\n:59F:/${row.f59acc}\n1/${row.f59name}\n${purpose}:71A:OUR\n-}`
}
/** MPU (эталон DOCS[0].mpu): MT199 банку-отправителю — у каждого третьего завершённого документа. */
function mpu(row: FxDoc, i: number, b: string) {
  if (!finished(row) || i % 3 !== 0) return []
  const date = ddmmyyyy(row.created)
  const done = inboundOf(row) ? 'HAS BEEN CREDITED TO\nBENEFICIARY ACCOUNT' : 'HAS BEEN DEBITED FROM\nORDERING CUSTOMER ACCOUNT'
  return [{
    id: uuidOf(i, 31), messageType: 'MT199', createdAt: stamp(b, 196880), exportStatus: 'SENT', exportedAt: stamp(b, 242067),
    receiver: row.f52, docReference: refOut(row), docId: row.id,
    swiftText: `{1:F01${lt(OUR)}0000000000}{2:I199${lt(row.f52)}N}{3:{121:${row.uetr}}}{4:\n:20:${refOut(row)}\n:21:${refIn(row)}\n` +
      `:79:YOUR ${row.type} ${refIn(row)} DD ${date}\n${row.currency} ${swiftAmount(row.amount)} ${done} VALUE ${date}.\n` +
      `OUR CHARGES ${row.currency} 35,00 DEDUCTED (71A OUR).\nBEST REGARDS. SETTLEMENTS CENTRE\n-}`,
  }]
}

/** Аудит: 10 секций у завершённого (эталон DOCS[0]), 5 — у стоящего на маршрутизации (DOCS[1]). */
function audit(row: FxDoc, i: number, steps: Step[], swift: string, who: string, parentId: string | null) {
  const b = row.created
  const inbound = inboundOf(row)
  const last = steps[steps.length - 1]!
  const statusSections = { count: steps.length, last: last[1], lastAt: stamp(b, last[3]) }
  const controls = (compliance: string) => ({ complianceCheck: compliance, sanctionsCheck: 'PASSED', duplicateCheck: 'PASSED', manualReview: true })
  if (!finished(row)) {
    return {
      commonSection: { creationDate: stamp(b, 0), paymentServiceProvider: row.provS, paymentFlow: null, paymentInitiatorSystem: 'PMTS.MANUAL', sourceSystem: 'SRC1', resending: false, originalDocumentId: parentId },
      documentSection: { docReferenceIn: refIn(row), relatedReference: refOut(row), messageType: row.type, amount: row.amount, currency: row.currency, valueDate: row.vdDt },
      statusSections,
      taskSections: { open: 1, closed: 0 },
      controlAttributesSection: controls('PENDING'),
    }
  }
  const postings = 2 + (i % 3 === 0 ? 2 : 0)
  return {
    commonSection: { creationDate: stamp(b, 0), paymentServiceProvider: row.provS, paymentFlow: null, paymentInitiatorSystem: 'ERS.ERS_1', sourceSystem: 'SRC1', resending: false },
    documentSection: { docReferenceIn: refIn(row), docReferenceOut: refOut(row), messageType: row.type, amount: row.amount, currency: row.currency, valueDate: row.vdDt, uetr: row.uetr },
    originalDocumentSection: { receivedAt: stamp(b, -1000), sender: row.sender, receiver: row.receiver, rawLength: swift.length, hash: `sha256:${hexOf(i, 41, 4)}…${hexOf(i, 42, 4)}` },
    statusSections,
    accountingSection: { debitAccount: inbound ? row.routeAcc : row.f50acc, creditAccount: inbound ? row.f59acc : row.routeAcc, postings, executed: postings, canceled: 0, pending: 0 },
    paymentTransactionSections: { transactionId: fxTxId(i), registers: [`00000_Nostro${row.currency}`, '00010_ClientCurrent', '00020_CommissionIncome', '00030_FxConversion'] },
    taskSections: { open: 1, closed: 1, lastAssignee: who },
    outgoingRoutingSections: { routeType: row.routeType, nostroAccount: row.routeAcc, receiver: row.routeRecv, rule: `${row.currency}_EU_COUNTERPARTIES_V3` },
    controlAttributesSection: controls('PASSED'),
    manualOperationRecordsSection: { records: 1, last: { at: stamp(b, 614000), user: who, field: '57', action: 'EDIT' } },
  }
}

/**
 * Ответы всех вкладок валютного документа — форма GET …/tabs/{tab} (pi-api.md). Завершённый документ — как эталон DOCS[0]
 * (статусов 12, комплаенс ALLOW, связанных 2, задач 2, нотификаций 3, стриминга 3, MPU у каждого третьего, аудит 10 секций);
 * остальные — как DOCS[1] (статусов 4, REVIEW, связанный 1, задача 1, нотификаций, стриминга и MPU нет, аудит 5 секций,
 * входящего сообщения нет). Отказ — комплаенс DENY с отрицательной нотификацией.
 */
export function fxDocTrail(row: FxDoc, i: number, rows: readonly FxDoc[]): Record<FxTrailTab, unknown> {
  const b = row.created
  const done = finished(row)
  const inbound = inboundOf(row)
  const who = WHO[i % WHO.length]!
  const steps = chain(row)
  const documents = linked(row, i, rows)
  const swiftMessage = done ? incoming(row, i) : ''
  return {
    statuses: statusEvents(b, steps),
    compliance: complianceOf(b, i, {
      clientId: `CLT${pad((i * 104729) % 1e13, 13)}`, department: `DEP ${pad(400 + (i % 30), 4)}`,
      review: !done, deny: row.status === 'REJECTED' ? (row.reason ?? 'Отказ комплаенса') : null,
    }),
    linked: { documents },
    tasks: { tasks: tasks(row, i, b, who) },
    notif: {
      notifications: done ? [
        { sentAt: stamp(b, 759), attempts: 3, status: 'TIMEOUT', responseCode: 'accepted' },
        { sentAt: stamp(b, 99759), attempts: 1, status: 'OK', responseCode: 'confirmAck' },
        { sentAt: stamp(b, 196759), attempts: 3, status: 'TIMEOUT', responseCode: 'confirmCrd' },
      ] : [],
    },
    source: { swiftMessage, outgoingSwiftMessage: outgoing(row) },
    stream: {
      events: done ? [
        { at: stamp(b, 99554), systemCode: 'MSB', systemName: 'Шина сообщений', event: `fx_evt_${inbound ? 'credit' : 'debit'}_end`, status: 'SENT', attempts: 1 },
        { at: stamp(b, 196625), systemCode: 'MSB', systemName: 'Шина сообщений', event: 'fx_evt_account_end', status: 'SENT', attempts: 1 },
        { at: stamp(b, 196661), systemCode: 'DWH', systemName: 'Хранилище', event: 'fx_evt_finish', status: 'SENT', attempts: 2 },
      ] : [],
    },
    mpu: { messages: mpu(row, i, b) },
    audit: audit(row, i, steps, swiftMessage, who, documents[0]?.docId ?? null),
  }
}
