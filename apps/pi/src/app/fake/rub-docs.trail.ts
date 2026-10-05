import { RUB_OPERATION, type RubDoc } from '../../entities/rub-doc'
import { RBANKS } from './rub-docs.data'
import { complianceOf, ddmmyyyy, decimal, hexOf, lt, pad, stamp, statusEvents, swiftAmount, uuidOf, WHO, type Step } from './trail.data'

/** Нелокальные вкладки рублёвого реестра — набор GET …/tabs/{tab} (RUB_TABS без main, спека 2b §3.1). */
export const RUB_TRAIL_TABS = ['statuses', 'compliance', 'linked', 'tasks', 'notif', 'ed244', 'stream', 'mpu', 'audit'] as const
export type RubTrailTab = (typeof RUB_TRAIL_TABS)[number]

/** Сценарий обработки — общий с деталью (блок «Сценарий») и статусами. */
export const rubScenario = (row: RubDoc) => (row.direction === 'IN' ? 'SC_NCB_IN_CREDIT' : row.direction === 'OUT' ? 'SC_NCB_OUT_DEBIT' : 'SC_NCB_TRANSIT')
/** Корсчёт проводок — общий с деталью и аудитом. */
export const rubCorrAcc = (i: number) => `30102810${pad((i * 7919 + 17) % 1e12, 12)}`

// SWIFT-коды участников — из словаря ED107 рублёвого эталона (index.html:903, обезличен): свой — XEANRURA
const OUR_SWBIC = 'XEANRURA'
const RECEIVERS = ['KDHCRU2F', 'REFNRUAM', 'TEMGRU4U']

const finished = (row: RubDoc) => row.status === 'DONE' || row.status === 'EXPORTED'
const corrOf = (bic: string) => RBANKS.find((x) => x[1] === bic)?.[2] ?? ''
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const clientAcc = (row: RubDoc) => (row.direction === 'IN' ? row.toAcc : row.fromAcc)

/** Цепочка рубля — своя (сценарии SC_NCB_*), по форме эталона: завершённый — 10 шагов, стоящий на маршрутизации — 4. */
function chain(row: RubDoc): Step[] {
  const sc = rubScenario(row)
  if (!finished(row)) {
    return [
      [null, 'rub-dup-check.end', null, 0],
      [sc, 'rub-ncb-checks.start', null, 380],
      [sc, 'rub-ncb-checks.end', null, 1720],
      [sc, 'rub-routing.start', row.reason ?? 'Ожидание решения сотрудника', 2210],
    ]
  }
  const inbound = row.direction === 'IN'
  const move = inbound ? 'rub-credit-client' : 'rub-debit-client'
  const ed = inbound ? 'rub-ed-confirm' : 'rub-ed-export'
  return [
    [null, 'rub-dup-check.end', null, 0],
    [sc, 'rub-ncb-checks.start', null, 380],
    [sc, 'rub-ncb-checks.end', null, 1720],
    [sc, 'rub-routing.start', null, 2210],
    [sc, 'rub-routing.end', null, 3985],
    ['SC_NCB_POSTING', `${move}.start`, null, 4410],
    ['SC_NCB_POSTING', `${move}.end`, null, 5932],
    ['SC_NCB_EXPORT', `${ed}.start`, null, 6120],
    ['SC_NCB_EXPORT', `${ed}.end`, null, 8847],
    ['SC_NCB_EXPORT', 'rub.finish', null, 8903],
  ]
}

/** Связанный — у каждого третьего документа: существующая строка того же реестра. */
function linked(i: number, rows: readonly RubDoc[]) {
  if (i % 3 !== 0) return []
  const lr = rows[(i + 4) % rows.length]!
  const amount = decimal(lr.amount)
  return [{
    docId: lr.id, date: lr.created.slice(0, 10), docType: lr.type, relation: i % 2 ? 'PARENT' : 'CHILD', purpose: lr.purpose,
    status: lr.status, processedAt: lr.changed, postingDate: finished(lr) ? lr.changed.slice(0, 10) : null, kind: lr.edCode,
    debit: { account: lr.fromAcc, amount, currency: 'RUB', register: '00010_ClientCurrent' },
    credit: { account: corrOf(lr.toBic) || null, amount, currency: 'RUB', register: '00000_CorrCBR' },
    sender: { name: lr.fromName, account: lr.fromAcc, details: `ИНН ${lr.fromInn}` },
    receiver: { name: lr.toName, account: lr.toAcc, details: `ИНН ${lr.toInn}` },
  }]
}

function tasks(row: RubDoc, i: number, b: string, who: string) {
  const sc = rubScenario(row)
  if (!finished(row)) {
    return [{
      id: `task-${hexOf(i, 62, 12)}`, status: 'OPEN', severity: row.status === 'ERROR' || row.status === 'REJECTED' ? 'WARN' : 'INFO',
      taskType: 'PAYMENT_DOCUMENT', createdAt: stamp(b, 2210),
      text: `Требуется подтвердить сценарий ${sc}; ${row.reason ?? 'требуется решение сотрудника'}`, assignee: null,
      history: [{ at: stamp(b, 2210), event: 'Создана: rub-routing' }],
    }]
  }
  const act = row.direction === 'IN' ? `зачисление на счёт ${clientAcc(row)}` : `списание со счёта ${clientAcc(row)}`
  return [{
    id: `task-${hexOf(i, 61, 12)}`, status: 'DONE', severity: 'OK', taskType: 'PAYMENT_DOCUMENT', createdAt: stamp(b, 2210),
    text: `Требуется подтвердить сценарий ${sc}; требуется утвердить ${act}`, assignee: who,
    history: [
      { at: stamp(b, 2210), event: 'Создана: rub-routing' },
      { at: stamp(b, 2950), event: `Взята в работу: ${who}` },
      { at: stamp(b, 3985), event: 'Решение: сценарий подтверждён' },
      { at: stamp(b, 3985), event: `Закрыта · ${who}` },
    ],
  }]
}

/** ED244 по реквизитам строки (форма эталона, index.html:906); у исходящего, ещё не выгруженного в ЦБ, — нет (''). */
function ed244(row: RubDoc, i: number): string {
  if (!finished(row) && row.direction !== 'IN') return ''
  const date = row.created.slice(0, 10)
  const kpp = (k: string) => (k && k !== '0' ? ` KPP="${k}"` : '')
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<ed:ED244 xmlns:ed="urn:cbr-ru:ed:v2.0" EDNo="${1000 + ((i * 37) % 9000)}" EDDate="${date}" EDAuthor="${pad((i * 7919 + 2072537694) % 1e10, 10)}" EDReceiver="${pad((i * 104729 + 4971095821) % 1e10, 10)}" Sum="${Math.round(row.amount * 100)}" PaymentPrecedence="${row.queue}">\n` +
    `  <ed:AccDoc AccDocNo="${xml(row.docNumber)}" AccDocDate="${date}"/>\n` +
    `  <ed:Payer PersonalAcc="${row.fromAcc}" INN="${row.fromInn}"${kpp(row.fromKpp)}>\n    <ed:Name>${xml(row.fromName)}</ed:Name>\n` +
    `    <ed:Bank BIC="${row.fromBic}" CorrespAcc="${corrOf(row.fromBic)}"/>\n  </ed:Payer>\n` +
    `  <ed:Payee PersonalAcc="${row.toAcc}" INN="${row.toInn}"${kpp(row.toKpp)}>\n    <ed:Name>${xml(row.toName)}</ed:Name>\n` +
    `    <ed:Bank BIC="${row.toBic}" CorrespAcc="${corrOf(row.toBic)}"/>\n  </ed:Payee>\n` +
    `  <ed:Purpose>${xml(row.purpose)}</ed:Purpose>\n</ed:ED244>`
}

/** MPU — MT199 в рублях у каждого четвёртого завершённого; часть ещё в очереди экспорта. */
function mpu(row: RubDoc, i: number, b: string) {
  if (!finished(row) || i % 4 !== 0) return []
  const ref = row.docRef || row.docNumber
  const receiver = RECEIVERS[i % RECEIVERS.length]!
  const sent = i % 8 === 0
  const date = ddmmyyyy(row.created)
  return [{
    id: uuidOf(i, 71), messageType: 'MT199', createdAt: stamp(b, 9120), exportStatus: sent ? 'SENT' : 'QUEUED', exportedAt: sent ? stamp(b, 41250) : null,
    receiver, docReference: ref, docId: row.uuid,
    swiftText: `{1:F01${lt(OUR_SWBIC)}0000000000}{2:I199${lt(receiver)}N}{4:\n:20:${ref}\n:21:${row.docNumber}\n` +
      `:79:RE PAYMENT DOCUMENT NO ${row.docNumber} DD ${date}\nRUB ${swiftAmount(row.amount)} ${row.direction === 'IN' ? 'CREDITED TO' : 'DEBITED FROM'} ACCOUNT ${clientAcc(row)}\n` +
      `VALUE ${date}.\nBEST REGARDS. SETTLEMENTS CENTRE\n-}`,
  }]
}

/** Аудит рубля: 8 секций у завершённого, 5 — у стоящего на маршрутизации; без секций валюты (исходное SWIFT, маршрут ностро). */
function audit(row: RubDoc, i: number, steps: Step[], who: string) {
  const b = row.created
  const inbound = row.direction === 'IN'
  const last = steps[steps.length - 1]!
  const commonSection = { creationDate: stamp(b, 0), paymentServiceProvider: 'NCB', paymentFlow: null, paymentInitiatorSystem: row.initiator, sourceSystem: row.source, resending: false }
  const documentSection = {
    docNumber: row.docNumber, docDate: row.created.slice(0, 10), amount: row.amount, currency: 'RUB', scenario: rubScenario(row),
    operation: RUB_OPERATION[row.type] || null, queue: row.queue, docReference: row.docRef || null,
  }
  const statusSections = { count: steps.length, last: last[1], lastAt: stamp(b, last[3]) }
  const controls = (compliance: string) => ({ complianceCheck: compliance, sanctionsCheck: 'PASSED', duplicateCheck: 'PASSED', manualReview: !finished(row) })
  if (!finished(row)) return { commonSection, documentSection, statusSections, taskSections: { open: 1, closed: 0 }, controlAttributesSection: controls('PENDING') }
  const corr = rubCorrAcc(i)
  return {
    commonSection, documentSection, statusSections,
    accountingSection: { debitAccount: inbound ? corr : clientAcc(row), creditAccount: inbound ? clientAcc(row) : corr, postings: 2, executed: 2, canceled: 0, pending: 0 },
    paymentTransactionSections: { transactionId: row.txId, registers: ['00000_CorrCBR', '00010_ClientCurrent'] },
    taskSections: { open: 0, closed: 1, lastAssignee: who },
    edSection: { edType: row.edCode, direction: inbound ? 'FROM_CBR' : 'TO_CBR', packageId: `PKG${pad(i * 131, 8)}` },
    controlAttributesSection: controls('PASSED'),
  }
}

/**
 * Ответы всех вкладок рублёвого документа — свои данные рубля (спека 2b §3.5): RUB, рублёвые счета, сценарии SC_NCB_*,
 * события rub_evt_*, ED244; «Связанные» и MPU у части документов непусты. Вкладки без данных уходят в tabsOff детали.
 */
export function rubDocTrail(row: RubDoc, i: number, rows: readonly RubDoc[]): Record<RubTrailTab, unknown> {
  const b = row.created
  const done = finished(row)
  const who = WHO[i % WHO.length]!
  const steps = chain(row)
  const pair = done && i % 2 === 0
  return {
    statuses: statusEvents(b, steps),
    compliance: complianceOf(b, i, {
      clientId: `CLT${pad((i * 104729 + 7) % 1e13, 13)}`, department: `DEP ${pad(300 + (i % 40), 4)}`,
      review: !done, deny: row.status === 'REJECTED' ? (row.reason ?? 'Отказ комплаенса') : null,
    }),
    linked: { documents: linked(i, rows) },
    tasks: { tasks: tasks(row, i, b, who) },
    notif: {
      notifications: pair ? [
        { sentAt: stamp(b, 520), attempts: 1, status: 'OK', responseCode: 'accepted' },
        { sentAt: stamp(b, 8950), attempts: i % 4 === 0 ? 3 : 1, status: i % 4 === 0 ? 'TIMEOUT' : 'OK', responseCode: 'confirmCrd' },
      ] : [],
    },
    ed244: { ED244: ed244(row, i) },
    stream: {
      events: pair ? [
        { at: stamp(b, 5980), systemCode: 'MSB', systemName: 'Шина сообщений', event: 'rub_evt_posting_end', status: 'SENT', attempts: 1 },
        { at: stamp(b, 8931), systemCode: 'DWH', systemName: 'Хранилище', event: 'rub_evt_finish', status: i % 6 === 0 ? 'RETRY' : 'SENT', attempts: i % 6 === 0 ? 2 : 1 },
      ] : [],
    },
    mpu: { messages: mpu(row, i, b) },
    audit: audit(row, i, steps, who),
  }
}
