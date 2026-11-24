import { createEffect } from 'effector'
import type { ApiError } from '../../../shared/api'
import type { AccountCatalog, Metrics, NzrDocumentDetail, Placement } from './report'

export type ReportQuery = { account: string; asOf: string }
export type NzrPorts = {
  accounts: () => AccountCatalog | Promise<AccountCatalog>
  report: (query: ReportQuery) => Placement[] | Promise<Placement[]>
  document: (id: string) => NzrDocumentDetail | Promise<NzrDocumentDetail>
  master: (query: ReportQuery) => Metrics | Promise<Metrics>
}

export const accountsFx = createEffect<void, AccountCatalog>()
export const reportFx = createEffect<ReportQuery, Placement[]>()
export const documentFx = createEffect<string, NzrDocumentDetail, ApiError>()
export const masterFx = createEffect<ReportQuery, Metrics>()

export function configureNzrPorts(ports: NzrPorts) {
  accountsFx.use(ports.accounts)
  reportFx.use(ports.report)
  documentFx.use(ports.document)
  masterFx.use(ports.master)
}
