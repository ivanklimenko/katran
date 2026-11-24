import { ApiError } from '../../../shared/api'
import type { NzrPorts } from './ports'
import type { Status } from '../../../entities/doc-status'
import { aggregate, reportRows, SNAPSHOT, type Account, type NzrDocumentDetail, type Metrics, type Placement } from './report'

const currencies = [
  ['USD', '840'], ['EUR', '978'], ['CNY', '156'], ['GBP', '826'], ['CHF', '756'],
  ['AED', '784'], ['AMD', '051'], ['KZT', '398'], ['INR', '356'], ['TRY', '949'],
] as const
const firstAccounts = [
  { id: '47422840000000000101', currency: 'USD', name: 'НЗР · входящие переводы' },
  { id: '47422840000000000202', currency: 'USD', name: 'НЗР · клиентские переводы' },
  { id: '47422978000000000303', currency: 'EUR', name: 'НЗР · евро' },
  { id: '47422156000000000404', currency: 'CNY', name: 'НЗР · юани' },
]
const names = [
  ['OOO SEVERNAYA ZVEZDA', '40702840300010009911'],
  ['LAVRENTIEV DMITRY OLEGOVICH', '40817840500010042371'],
  ['AO TEKHNOPARK VOSTOK', '40702840600010004420'],
  ['SEMENOVA IRINA VLADIMIROVNA', '40817840100050017762'],
] as const
const banks = [
  ['NORDINVEST BANK MOSCOW', 'NRDIRUMMXXX'],
  ['BALTIC CLEARING BANK RIGA', 'BCLHLV22XXX'],
  ['HANSEATIC TRADE BANK HAMBURG', 'HSTBDEHHXXX'],
] as const
const reasons = ['Не установлены реквизиты получателя', 'Требуется уточнение назначения платежа', 'Счёт получателя закрыт', 'Ожидание подтверждающих документов'] as const
const generatedStatuses = ['DEFERRED', 'IN_PROGRESS', 'PROCESSING', 'ERROR'] as const

type Operation = [date: string, amount: number, status: Status]
type Seed = [operation: Operation, product: string, reason: number, children: Operation[], account: number]
const seeds: Seed[] = [
  [['2026-11-08', 1900234, 'DEFERRED'], 'RETAIL', 0, [['2026-11-09', 1900234, 'IN_PROGRESS']], 0],
  [['2026-11-07', 84300, 'DEFERRED'], 'CORPORATE', 1, [], 2],
  [['2026-11-06', 1250000, 'DONE'], 'CORPORATE', 2, [['2026-11-08', 750000, 'DONE'], ['2026-11-09', 500000, 'DONE']], 0],
  [['2026-11-06', 99000, 'PROCESSING'], 'RETAIL', 0, [['2026-11-09', 99000, 'ERROR']], 3],
  [['2026-11-04', 318450.75, 'DEFERRED'], 'CORPORATE', 3, [['2026-11-09', 100000, 'DONE']], 2],
  [['2026-11-03', 64000, 'IN_PROGRESS'], 'RETAIL', 1, [['2026-11-09', 64000, 'IN_PROGRESS']], 1],
  [['2026-11-02', 2200000, 'DONE'], 'CORPORATE', 3, [['2026-11-09', 2200000, 'DONE']], 1],
  [['2026-11-01', 410000, 'ERROR'], 'CORPORATE', 2, [], 0],
  [['2026-11-09', 148300, 'TO_EXPORT'], 'RETAIL', 0, [], 2],
  [['2026-11-08', 12500, 'PROCESSING'], 'RETAIL', 1, [], 3],
  [['2026-10-30', 72000, 'DEFERRED'], 'CORPORATE', 3, [['2026-11-08', 72000, 'ERROR']], 1],
  [['2026-11-05', 8500, 'DONE'], 'RETAIL', 2, [['2026-11-09', 8500, 'DONE']], 2],
]

function makeDocument(index: number, docNumber: number, [date, amount, status]: Operation, account: Account, parent: number | null): NzrDocumentDetail {
  const [f50name, f50acc] = names[index % names.length]!
  const [f59name, f59acc] = names[(index + 1) % names.length]!
  const [f52name, f52] = banks[index % banks.length]!
  const [f57name, f57] = banks[(index + 1) % banks.length]!
  const type = index % 3 === 2 ? 'MT202' : 'MT103'
  const purpose = parent === null
    ? `PAYMENT UNDER CONTRACT ${140 + index} DD 01.10.2026 FOR CONSULTING SERVICES`
    : `WRITE-OFF FROM NZR /REF/ NZR26${parent}`
  const id = `a${String(docNumber).padStart(7, '0')}-d1c5-4f07-aa49-8be3e9e4c8e8`
  const routeType = index % 2 ? 'LORO' : 'NOSTRO'
  const created = date + 'T10:24:18'
  return {
    id, docNumber, parent, numDate: date, valueDates: [date, date, date, date], created, vdDt: date, vdKt: date,
    refIn: `NZR26${docNumber}`, refOut: `FX26${docNumber}`, uetr: id, type, amount, currency: account.currency, status,
    direction: parent === null ? 'IN' : 'OUT',
    dirTxt: parent === null ? 'входящий от корреспондента' : `Списание · к постановке № ${parent}`,
    f50name, f50acc, f59name, f59acc, purpose, f52, f57, f52name, f57name, f50opt: 'F', f59opt: 'F',
    f58: type === 'MT202' ? f57 : null, f58name: type === 'MT202' ? f57name : null,
    sender: f52, receiver: f57, inSender: f52, inReceiver: f57, outSender: f52, outReceiver: f57,
    provS: routeType, provR: routeType, routeType, routeRecv: f57, routeAcc: '30114840000001430157',
    routeDesc: 'Маршрут валютного перевода', routeText: 'Демонстрационный маршрут',
    accDt: parent === null ? f50acc : account.id, accKt: parent === null ? account.id : f59acc,
    reason: null, lock: null, inactive: null, txId: '', txAt: '', txs: [], tabsOff: [],
    canAnnul: false, annul: null, edits: {},
    fields: {
      '20': { lines: [`NZR26${docNumber}`] },
      '50': { opt: 'F', acc: f50acc, lines: [f50name] },
      '52': { opt: 'A', lines: [f52name, f52] },
      '57': { opt: 'A', lines: [f57name, f57] },
      '58': type === 'MT202' ? { opt: 'A', lines: [f57name, f57] } : { lines: [] },
      '59': { opt: 'F', acc: f59acc, lines: [f59name] },
      '70': { lines: [purpose] },
      '72': { lines: ['/ACC/ PLEASE CLARIFY BENEFICIARY DETAILS'] },
    },
  }
}

function makeDemo() {
  const accounts: Account[] = Array.from({ length: 120 }, (_, i) => {
    const [currency, code] = currencies[i % currencies.length]!
    return {
      ...(firstAccounts[i] ?? {
        id: '47422' + code + String(1000 + i).padStart(12, '0'), currency,
        name: 'НЗР · расчётный центр ' + String(i + 1).padStart(3, '0'),
      }),
      balance: 0,
    }
  })
  const placements = new Map(accounts.map((a) => [a.id, [] as Placement[]]))
  const documents = new Map<string, NzrDocumentDetail>()
  function add(account: Account, index: number, number: number, op: Operation, product: string, reason: number, children: [number, Operation][]) {
    const document = makeDocument(index, number, op, account, null)
    const writeOffs = children.map(([id, child]) => makeDocument(index, id, child, account, number))
    placements.get(account.id)!.push({
      ...document, account: account.id, product, placementReason: reasons[reason]!, children: writeOffs,
    })
    documents.set(document.id, document)
    writeOffs.forEach((child) => documents.set(child.id, child))
  }
  seeds.forEach(([op, product, reason, children, account], i) => {
    add(accounts[account]!, i, 400 + i * 3, op, product, reason, children.map((child, j) => [1400 + i * 3 + j, child]))
  })

  const master = new Map<string, Metrics>()
  accounts.forEach((account, i) => {
    let seed = Math.imul(i + 1, 2654435761) >>> 0
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    const count = [16, 18, 20, 14][i] ?? (12 + Math.floor(random() * 9))
    const zero = i >= 4 && (i - 4) % 6 === 0
    const existing = placements.get(account.id)!
    const seededCount = existing.length
    for (let j = 0; j < count; j++) {
      const amount = Math.round((1000 + random() * 2199000) * 100) / 100
      const age = 1 + Math.floor(random() * 10)
      if (j < seededCount) continue
      const date = new Date(Date.parse(SNAPSHOT) - age * 86_400_000).toISOString().slice(0, 10)
      const number = 5000 + i * 100 + j
      const childNumber = 50000 + i * 100 + j * 2
      const paid = zero ? amount : j % 5 === 0 ? Math.floor(amount * 100 * 0.4) / 100 : 0
      const children: [number, Operation][] = []
      if (paid) children.push([childNumber, [SNAPSHOT, paid, 'DONE']])
      if (!zero && j % 3 !== 2) children.push([childNumber + 1, [SNAPSHOT, Math.round((amount - paid) * 100) / 100, j % 3 === 0 ? 'ERROR' : 'PROCESSING']])
      add(account, i + j, number, [date, amount, zero ? 'DONE' : generatedStatuses[(i + j) % 4]!], (i + j) % 2 ? 'RETAIL' : 'CORPORATE', (i + j) % 4, children)
    }
    const metric = aggregate(reportRows(existing, SNAPSHOT), SNAPSHOT)
    account.balance = metric.balance
    master.set(account.id, i === 1
      ? { balance: metric.balance + 1000, documents: metric.documents + 1, turnover: metric.turnover + 1000, operations: metric.operations + 1 }
      : metric)
  })
  return { accounts, placements, documents, master }
}

let demo: ReturnType<typeof makeDemo> | undefined
const getDemo = () => demo ??= makeDemo()

export const nzrDemoPorts: NzrPorts = {
  accounts: () => ({
    accounts: getDemo().accounts,
    reportDate: SNAPSHOT,
    firstReportDate: '2026-10-01',
    snapshot: { takenAt: '2026-11-09T12:00:00', intervalMinutes: 10 },
  }),
  report: ({ account }) => getDemo().placements.get(account) ?? [],
  document: (id) => {
    const document = getDemo().documents.get(id)
    if (!document) throw new ApiError(404, null, 'Документ НЗР не найден')
    return document
  },
  master: async ({ account, asOf }) => {
    await new Promise<void>((resolve) => setTimeout(resolve, 650))
    if (asOf !== SNAPSHOT) throw new Error('В макете данные ПП ЛН доступны на 09.11.2026. Выберите эту дату для сверки.')
    const metrics = getDemo().master.get(account)
    if (!metrics) throw new Error('ПП ЛН не вернул данные по выбранному счёту.')
    return metrics
  },
}
