import type { TrailTabId } from '../model/types'

const SWIFT_IN = "{1:F01VKRBRU8KXXXX0427047245}{2:O1030731260922NRDIRUMMXXXX04270806512609220731N}{3:{108:1IBSR00048090722}{111:001}{121:eb6305c9-1f8c-41e3-a3b2-6d7e9f2a4c10}}{4:\n:20:FX2609220000417\n:23B:CRED\n:32A:260922USD1250000,00\n:33B:EUR1148300,00\n:36:1,0886\n:50F:/40817840500010042371\n1/LAVRENTIEV DMITRY OLEGOVICH\n2/ULITSA PROFSOYUZNAYA 83-1-214\n3/RU/MOSCOW, 117279\n:52A:NRDIRUMMXXX\n:53A:BCLHLV22XXX\n:54A:HSTBDEHHXXX\n:56A:MRDNGB2LXXX\n:57A:VKRBRU8KXXX\n:59F:/40817840100050017762\n1/SEMENOVA IRINA VLADIMIROVNA\n2/PROSPEKT MIRA 101-2-45\n3/RU/MOSCOW, 129085\n:70:/INV/ 2026-0417 DD 15.09.2026\nPAYMENT FOR CONSULTING SERVICES\nUNDER CONTRACT 12-45 DD 01.03.2026\nVAT NOT APPLICABLE\n:71A:OUR\n:71F:USD35,00\n:72:/INS/NRDIRUMMXXX\n/ACC/PLEASE CREDIT WITHOUT DELAY\n/REC/REF FX2609220000417\n:77B:/ORDERRES/RU//CONTRACT 12-45 DD 01.03.2026\n-}{5:{MAC:00000000}{CHK:00009443BE30}}{S:{MDG:A35B7A2E46531D1AAD9937DB5DB4CA4F2E3EAEBEF323B6E8EED6769B454F0E91}}"
const SWIFT_OUT = "{1:F01VKRBRU8KXXXX0000000000}{2:I103BCLHLV22XXXXN}{3:{121:eb6305c9-1f8c-41e3-a3b2-6d7e9f2a4c10}}{4:\n:20:VK2609220000417\n:23B:CRED\n:32A:260922USD1250000,00\n:50F:/40817840500010042371\n1/LAVRENTIEV DMITRY OLEGOVICH\n2/ULITSA PROFSOYUZNAYA 83-1-214\n3/RU/MOSCOW, 117279\n:52A:NRDIRUMMXXX\n:57A:VKRBRU8KXXX\n:59F:/40817840100050017762\n1/SEMENOVA IRINA VLADIMIROVNA\n:70:/INV/ 2026-0417 DD 15.09.2026\n:71A:OUR\n-}"
const SWIFT_MPU = "{1:F01VKRBRU8KXXXX0000000000}{2:I199NRDIRUMMXXXXN}{3:{121:eb6305c9-1f8c-41e3-a3b2-6d7e9f2a4c10}}{4:\n:20:VK2609220000417\n:21:FX2609220000417\n:79:YOUR MT103 FX2609220000417 DD 22.09.2026\nUSD 1250000,00 HAS BEEN CREDITED TO\nBENEFICIARY ACCOUNT VALUE 22.09.2026.\nOUR CHARGES USD 35,00 DEDUCTED (71A OUR).\nBEST REGARDS. SETTLEMENTS CENTRE\n-}"
const ED244 = '<?xml version="1.0" encoding="UTF-8"?>\n<ed:ED244 xmlns:ed="urn:cbr-ru:ed:v2.0" EDNo="9818" EDDate="2026-09-24" EDAuthor="2072537694" EDReceiver="4971095821" Sum="7639481" PaymentPrecedence="5">\n  <ed:AccDoc AccDocNo="3741" AccDocDate="2026-09-24"/>\n  <ed:Payer PersonalAcc="40702810064578557830" INN="4340195751" KPP="473897776">\n    <ed:Name>ООО «ХУРЫГУПЯ»</ed:Name>\n    <ed:Bank BIC="049597373" CorrespAcc="30101810508469019375"/>\n  </ed:Payer>\n  <ed:Payee PersonalAcc="40802810820980451081" INN="394831189084">\n    <ed:Name>ИП ТЫСЫЛИОВ ГИБАС ЗУДЫОВИЧ</ed:Name>\n    <ed:Bank BIC="042993195" CorrespAcc="30101810664602335376"/>\n  </ed:Payee>\n  <ed:Purpose>Оплата по счёту № 6945-2101 от 18.07.2026 за оборудование по договору 65-89 от 27.02.2026. В том числе НДС 20% — 18 658.24 руб.</ed:Purpose>\n</ed:ED244>'

/** Примеры ответов GET /grids/{gridId}/documents/{id}/tabs/{tab} — источник примеров в pi-api.md и контрактных тестов. */
export const TRAIL_EXAMPLES: Record<TrailTabId, unknown> = {
  statuses: {
    events: [
      { at: '2026-09-22T07:31:45.241', route: null, statusCode: 'fx-dup-check.end', reason: null },
      { at: '2026-09-22T07:31:45.642', route: 'RT_FX_IN', statusCode: 'fx-in-checks.start', reason: null },
      { at: '2026-09-22T07:31:47.542', route: 'RT_FX_IN', statusCode: 'fx-in-checks.end', reason: null },
      { at: '2026-09-22T07:31:48.141', route: 'RT_FX_IN', statusCode: 'fx-in-routing.start', reason: 'Ожидание решения сотрудника' },
      { at: '2026-09-22T07:33:20.383', route: 'RT_FX_IN', statusCode: 'fx-in-routing.end', reason: null },
      { at: '2026-09-22T07:33:21.709', route: 'RT_FX_CREDIT', statusCode: 'fx-credit-client.start', reason: null },
      { at: '2026-09-22T07:33:22.957', route: 'RT_FX_CREDIT', statusCode: 'fx-credit-client.end', reason: null },
      { at: '2026-09-22T07:33:23.413', route: 'RT_FX_CREDIT', statusCode: 'fx-postprocess.start', reason: null },
      { at: '2026-09-22T07:33:24.312', route: 'RT_FX_CREDIT', statusCode: 'fx-postprocess.end', reason: null },
      { at: '2026-09-22T07:35:00.814', route: 'RT_FX_CREDIT', statusCode: 'fx-accounting.start', reason: null },
      { at: '2026-09-22T07:35:01.820', route: 'RT_FX_CREDIT', statusCode: 'fx-accounting.end', reason: null },
      { at: '2026-09-22T07:35:01.915', route: 'RT_FX_CREDIT', statusCode: 'fx.finish', reason: null },
    ],
  },
  compliance: {
    record: { id: '3e854037-b84c-40ee-90e0-440734c1d5e3', processingStart: '2026-09-22T07:31:48.126', processingEnd: '2026-09-22T07:31:52.601', nzr: false },
    negativeNotification: { decision: null, direction: null, comment: null },
    monitoring: { start: '2026-09-22T07:31:48.220', end: '2026-09-22T07:31:49.601', decision: 'ALLOW', transactionId: '97cae8c7162531f4093e1db5d7171bde', requestedAt: '2026-09-22T07:31:49.354', clientId: 'CLT0000123456789' },
    complianceControl: { start: '2026-09-22T07:31:49.719', end: '2026-09-22T07:31:52.601', decision: 'ALLOW' },
    history: [{ enteredAt: '2026-09-22T07:31:51', controlSystem: '3308_CTRL', departmentCode: 'DEP 0417' }],
  },
  linked: {
    documents: [
      {
        docId: 'a18d3c05-b393-4252-a3c1-c93791937ccc', date: '2026-09-23', docType: 'InternalFXDOC', relation: 'CHILD',
        purpose: 'MT103 USD 1249965.00 23.09.2026 возврат (1.6.2.2.1.)', status: 'NEW', processedAt: '2026-09-23T09:02:11', postingDate: '2026-09-23', kind: 'SHA',
        debit: { account: '40817840100050017762', amount: '1249965.00', currency: 'USD', register: '00010_ClientCurrent' },
        credit: { account: '30110840700000001842', amount: '1249965.00', currency: 'USD', register: '00000_NostroUSD' },
        sender: { name: 'SEMENOVA IRINA VLADIMIROVNA', account: '40817840100050017762', details: null },
        receiver: { name: 'LAVRENTIEV DMITRY OLEGOVICH', account: '40817840500010042371', details: 'RETURN OF FX2609220000417' },
      },
      {
        docId: '5e9b7255-c859-4786-b92a-5315c1b73227', date: '2026-09-22', docType: 'InternalFXFEE', relation: 'CHILD',
        purpose: 'Комиссия за входящий перевод по тарифу OUR', status: 'DONE', processedAt: '2026-09-22T07:35:01', postingDate: '2026-09-22', kind: 'OUR',
        debit: { account: '40817840100050017762', amount: '35.00', currency: 'USD', register: '00010_ClientCurrent' },
        credit: { account: '70601840100000000519', amount: '35.00', currency: 'USD', register: '00020_CommissionIncome' },
        sender: { name: 'SEMENOVA IRINA VLADIMIROVNA', account: '40817840100050017762', details: null },
        receiver: { name: 'VOSTOCHNY KREDIT BANK', account: '70601840100000000519', details: 'Тариф 4.2.1' },
      },
    ],
  },
  tasks: {
    tasks: [
      {
        id: 'task-5d1c0e7a9b20', status: 'DONE', severity: 'OK', taskType: 'PAYMENT_INSTRUCTION', createdAt: '2026-09-22T07:31:59',
        text: 'Требуется подтвердить маршрут; требуется утвердить зачисление по клиентскому счёту 40817840100050017762', assignee: 'Иванова М. П.',
        history: [
          { at: '2026-09-22T07:31:59', event: 'Создана: fx-in-routing' },
          { at: '2026-09-22T07:32:40', event: 'Взята в работу: Иванова М. П.' },
          { at: '2026-09-22T07:33:20', event: 'Решение: маршрут подтверждён, зачисление утверждено' },
          { at: '2026-09-22T07:33:20', event: 'Закрыта · Иванова М. П.' },
        ],
      },
      {
        id: 'task-8f3a61c2d4e7', status: 'OPEN', severity: 'INFO', taskType: 'PAYMENT_INSTRUCTION', createdAt: '2026-09-22T07:35:02',
        text: 'Комиссия USD 35,00 удержана по тарифу OUR; проверить корректность тарифного плана клиента', assignee: null,
        history: [{ at: '2026-09-22T07:35:02', event: 'Создана: fx-accounting' }],
      },
    ],
  },
  notif: {
    notifications: [
      { sentAt: '2026-09-22T07:31:46.000', attempts: 3, status: 'TIMEOUT', responseCode: 'accepted' },
      { sentAt: '2026-09-22T07:33:25.000', attempts: 1, status: 'OK', responseCode: 'confirmAck' },
      { sentAt: '2026-09-22T07:35:02.000', attempts: 3, status: 'TIMEOUT', responseCode: 'confirmCrd' },
    ],
  },
  source: { swiftMessage: SWIFT_IN, outgoingSwiftMessage: SWIFT_OUT },
  ed244: { ED244: ED244 },
  stream: {
    events: [
      { at: '2026-09-22T07:33:24.795', systemCode: 'MSB', systemName: 'Шина сообщений', event: 'fx_evt_credit_end', status: 'SENT', attempts: 1 },
      { at: '2026-09-22T07:35:01.866', systemCode: 'MSB', systemName: 'Шина сообщений', event: 'fx_evt_account_end', status: 'SENT', attempts: 1 },
      { at: '2026-09-22T07:35:01.902', systemCode: 'DWH', systemName: 'Хранилище', event: 'fx_evt_finish', status: 'SENT', attempts: 2 },
    ],
  },
  mpu: {
    messages: [
      {
        id: 'ee8bf4eb-5545-4f07-9617-8a5e7106302f', messageType: 'MT199', createdAt: '2026-09-22T07:35:02.121', exportStatus: 'SENT', exportedAt: '2026-09-22T07:35:47.308',
        receiver: 'NRDIRUMMXXX', docReference: 'VK2609220000417', docId: '03e8b84b-d1c5-4f07-aa49-8be3e9e4c8e8', swiftText: SWIFT_MPU,
      },
    ],
  },
  audit: {
    commonSection: { creationDate: '2026-09-22T04:31:45.051765Z', paymentServiceProvider: 'SUBOUL', paymentFlow: null, paymentInitiatorSystem: 'ERS.ERS_1', sourceSystem: 'SRC1', resending: false },
    documentSection: { docReferenceIn: 'FX2609220000417', docReferenceOut: 'VK2609220000417', messageType: 'MT103', amount: 1250000.0, currency: 'USD', valueDate: '2026-09-22', uetr: 'eb6305c9-1f8c-41e3-a3b2-6d7e9f2a4c10' },
    originalDocumentSection: { receivedAt: '2026-09-22T04:31:44Z', sender: 'NRDIRUMMXXX', receiver: 'VKRBRU8KXXX', rawLength: 612, hash: 'sha256:9f3c…a1e0' },
    statusSections: { count: 12, last: 'fx.finish', lastAt: '2026-09-22T04:35:01.915Z' },
    accountingSection: { debitAccount: '30110840700000001842', creditAccount: '40817840100050017762', postings: 6, executed: 4, canceled: 1, pending: 1 },
    paymentTransactionSections: { transactionId: 'ba5ac473-d0a4-40ea-b639-47326d3b8e45', registers: ['00000_NostroUSD', '00010_ClientCurrent', '00020_CommissionIncome', '00030_FxConversion'] },
    taskSections: { open: 1, closed: 1, lastAssignee: 'Иванова М. П.' },
    outgoingRoutingSections: { routeType: 'NOSTRO', nostroAccount: '30114840900000000517', receiver: 'BCLHLV22XXX', rule: 'USD_EU_COUNTERPARTIES_V3' },
    controlAttributesSection: { complianceCheck: 'PASSED', sanctionsCheck: 'PASSED', duplicateCheck: 'PASSED', manualReview: true },
    manualOperationRecordsSection: { records: 1, last: { at: '2026-09-22T07:42:00Z', user: 'Иванова М. П.', field: '57', action: 'EDIT' } },
  },
}
