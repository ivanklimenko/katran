import type { Status } from '../../../entities/doc-status'
import type { FxDoc, FxDocDetail, SwiftValue } from '../../../entities/fx-doc'

export type Account = { id: string; currency: string; name: string; balance: number }
export type AccountCatalog = {
  accounts: Account[]
  reportDate: string
  firstReportDate?: string
  snapshot?: { takenAt: string; intervalMinutes: number }
}
export type NzrDocumentDetail = FxDocDetail & { parent: number | null }
export type NzrDocumentRow = Pick<FxDoc,
  'id' | 'docNumber' | 'status' | 'currency' | 'amount' | 'type' | 'direction' | 'dirTxt' | 'routeAcc' | 'routeType' | 'routeRecv'
> & { numDate: string; parent: number | null; fields: Record<string, SwiftValue> }
export type Placement = NzrDocumentRow & { account: string; product: string; placementReason: string; children: NzrDocumentRow[] }
export type ReportRow = Placement & { remaining: number; written: number; lastWrite: string; age: number; visibleChildren: NzrDocumentRow[] }
export type Metrics = { balance: number; documents: number; turnover: number; operations: number }
export type Filters = { from: string; to: string; product: string; status: Status | '' }
export type Bucket = 'all' | '1-2' | '3-5' | '6+'
export type Sort = { field: 'age' | 'date' | 'amount'; ascending: boolean }

export const SNAPSHOT = '2026-11-09'
export const EMPTY_FILTERS: Filters = { from: '', to: '', product: '', status: '' }
export const DEFAULT_SORT: Sort = { field: 'age', ascending: false }
export const SWIFT = ['50', '52', '57', '58', '59'] as const

const cents = (amount: number) => Math.round(amount * 100)
const ageDays = (date: string, asOf: string) => (Date.parse(asOf) - Date.parse(date)) / 86_400_000
export const localDate = (date: string) => date.split('-').reverse().join('.')

export function reportRows(placements: Placement[], asOf: string): ReportRow[] {
  return placements.filter((row) => row.numDate <= asOf).map((row) => {
    const visibleChildren = row.children.filter((child) => child.numDate <= asOf)
    const successful = visibleChildren.filter((child) => child.status === 'DONE')
    const writtenCents = successful.reduce((sum, child) => sum + cents(child.amount), 0)
    const remaining = Math.max(0, cents(row.amount) - writtenCents) / 100
    const lastWrite = successful.reduce((latest, child) => child.numDate > latest ? child.numDate : latest, '')
    return { ...row, visibleChildren, remaining, written: (cents(row.amount) - cents(remaining)) / 100, lastWrite, age: ageDays(row.numDate, asOf) }
  })
}

export function aggregate(rows: ReportRow[], date: string): Metrics {
  let balance = 0
  let documents = 0
  let turnover = 0
  let operations = 0
  for (const row of rows) {
    balance += cents(row.remaining)
    if (row.remaining > 0) documents++
    if (row.numDate === date) {
      turnover += cents(row.amount)
      operations++
    }
    for (const child of row.visibleChildren) {
      if (child.numDate === date && child.status === 'DONE') {
        turnover += cents(child.amount)
        operations++
      }
    }
  }
  return { balance: balance / 100, documents, turnover: turnover / 100, operations }
}

export function metricDifference(key: keyof Metrics, report: Metrics, master: Metrics): number {
  if (key === 'balance' || key === 'turnover') return (cents(report[key]) - cents(master[key])) / 100
  return report[key] - master[key]
}

export function filterAccounts(accounts: Account[], query: string, currency: string, nonzero: boolean, ascending: boolean) {
  const q = query.trim().toLowerCase()
  return accounts.filter((a) => (!currency || a.currency === currency) && (!nonzero || a.balance !== 0)
    && `${a.id} ${a.name}`.toLowerCase().includes(q))
    .sort((a, b) => (a.balance - b.balance) * (ascending ? 1 : -1) || a.id.localeCompare(b.id))
}

export function filterRows(rows: ReportRow[], filters: Filters, query: string, includeClosed: boolean) {
  const q = query.trim().toLowerCase()
  return rows.filter((row) => {
    if ((!includeClosed && row.remaining === 0) || (filters.from && row.numDate < filters.from)
      || (filters.to && row.numDate > filters.to) || (filters.product && row.product !== filters.product)
      || (filters.status && row.status !== filters.status)) return false
    if (!q) return true
    const fields = SWIFT.flatMap((tag) => [row.fields[tag]?.acc, ...(row.fields[tag]?.lines ?? [])])
    return [row.docNumber, row.id, row.account, row.placementReason, row.product, row.currency, row.type, row.routeAcc, ...fields]
      .join(' ').toLowerCase().includes(q)
  })
}

export function inBucket(row: ReportRow, bucket: Bucket): boolean {
  if (bucket === 'all') return true
  if (row.remaining === 0 || row.age === 0) return false
  if (row.age <= 2) return bucket === '1-2'
  if (row.age <= 5) return bucket === '3-5'
  return bucket === '6+'
}

export function sortRows(rows: ReportRow[], { field, ascending }: Sort): ReportRow[] {
  return [...rows].sort((a, b) => {
    const order = field === 'age' ? a.age - b.age : field === 'amount' ? a.amount - b.amount : a.numDate.localeCompare(b.numDate)
    return ascending ? order : -order
  })
}

export function toggleIds(ids: Set<string>, items: string[], checked: boolean) {
  const next = new Set(ids)
  for (const id of items) {
    if (checked) next.add(id)
    else next.delete(id)
  }
  return next
}

export function reportCsv(rows: ReportRow[]): string {
  const quote = (value: string | number) => {
    const text = String(value)
    const safe = /^[=+@\-\t\r]/.test(text) ? "'" + text : text
    return '"' + safe.replace(/"/g, '""') + '"'
  }
  const header = ['Документ', 'UUID', 'Постановка', 'Последнее успешное списание', 'Сумма', 'Валюта',
    'Причина постановки', 'Продукт', 'Тип', 'Направление', 'Дочерних документов', 'Счёт НЗР', 'Остаток на НЗР', 'Дней на НЗР']
  return '\uFEFF' + [header, ...rows.map((row) => [
    row.docNumber, row.id, localDate(row.numDate), localDate(row.lastWrite), row.amount, row.currency,
    row.placementReason, row.product, row.type, row.direction, row.visibleChildren.length, row.account, row.remaining, row.remaining > 0 ? row.age : '',
  ])].map((row) => row.map(quote).join(';')).join('\r\n')
}
