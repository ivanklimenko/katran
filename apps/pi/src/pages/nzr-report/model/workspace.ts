import { attach, combine, createEvent, createStore, sample } from 'effector'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { createDetail } from '../../../widgets/doc-detail'
import { accountsFx, documentFx, masterFx, reportFx, type ReportQuery } from './ports'
import {
  DEFAULT_SORT, EMPTY_FILTERS, aggregate, filterRows, inBucket, reportRows, sortRows, toggleIds,
  type AccountCatalog, type Bucket, type Filters, type Metrics, type Placement, type Sort,
} from './report'

export const lifecycle = createPageLifecycle()
export const detail = createDetail({ detailFx: documentFx, localTabs: ['main', 'extra'], lifecycle })
export const docLinkOpened = createEvent<string>()

export const accountsApplied = createEvent<string[]>()
export const accountActivated = createEvent<string>()
export const dateChanged = createEvent<string>()
export const reconciliationRefreshed = createEvent()
export const reportRefreshed = createEvent()
export const queryChanged = createEvent<string>()
export const filtersApplied = createEvent<Filters>()
export const filtersReset = createEvent()
export const bucketChanged = createEvent<Bucket>()
export const closedToggled = createEvent<boolean>()
export const sortChanged = createEvent<Sort['field']>()
export const pageChanged = createEvent<number>()
export const sizeChanged = createEvent<number>()
export const selectionChanged = createEvent<{ ids: string[]; checked: boolean }>()
export const expansionChanged = createEvent<{ ids: string[]; checked: boolean }>()
export const reconciliationToggled = createEvent()

type Workspace = {
  account: string | null; accounts: string[]; asOf: string; query: string; filters: Filters; bucket: Bucket
  closed: boolean; sort: Sort; page: number; size: number; selected: Set<string>; expanded: Set<string>; collapsed: boolean
}
const clearScope = { query: '', filters: EMPTY_FILTERS, bucket: 'all' as const, page: 1 }
const clearRows = () => ({ selected: new Set<string>(), expanded: new Set<string>() })
const initial: Workspace = {
  account: null, accounts: [], asOf: '', ...clearScope, ...clearRows(), closed: false, sort: DEFAULT_SORT, size: 10, collapsed: false,
}

type Load<T> = { phase: 'idle' | 'loading' } | { phase: 'ready'; data: T } | { phase: 'error'; message: string }
type Request = ReportQuery & { revision: number }
export const catalogRetry = createEvent()

const $catalogRevision = createStore(0)
  .on([lifecycle.pageOpened, lifecycle.pageClosed, catalogRetry], (n) => n + 1)
const ignoreRevision: (revision: number) => void = () => undefined
const loadAccountsFx = attach({ effect: accountsFx, mapParams: ignoreRevision })
const accountsLoaded = sample({
  clock: loadAccountsFx.done, source: $catalogRevision, filter: (n, result) => n === result.params, fn: (_, result) => result.result,
})
const accountsFailed = sample({
  clock: loadAccountsFx.fail, source: $catalogRevision, filter: (n, result) => n === result.params, fn: (_, result) => result.error.message,
})
sample({ clock: [lifecycle.pageOpened, catalogRetry], source: $catalogRevision, target: loadAccountsFx })

export const $catalog = createStore<Load<AccountCatalog>>({ phase: 'idle' })
  .on(loadAccountsFx, () => ({ phase: 'loading' }))
  .on(accountsLoaded, (_, data) => ({ phase: 'ready', data }))
  .on(accountsFailed, (_, message) => ({ phase: 'error', message }))
  .reset(lifecycle.pageClosed)

export const $workspace = createStore(initial)
  .on(accountsLoaded, (s, { accounts, reportDate }) => ({
    ...s, asOf: reportDate, accounts: accounts.slice(0, 4).map((a) => a.id), account: accounts[0]?.id ?? null,
  }))
  .on(accountsApplied, (s, accounts) => ({
    ...s, ...clearScope, ...clearRows(), accounts,
    account: s.account && accounts.includes(s.account) ? s.account : accounts[0] ?? null,
  }))
  .on(accountActivated, (s, account) => s.accounts.includes(account) && account !== s.account
    ? { ...s, ...clearScope, ...clearRows(), account } : s)
  .on(dateChanged, (s, asOf) => ({ ...s, asOf, page: 1, selected: new Set() }))
  .on(queryChanged, (s, query) => ({ ...s, query, page: 1 }))
  .on(filtersApplied, (s, filters) => ({ ...s, filters, page: 1 }))
  .on(filtersReset, (s) => ({ ...s, ...clearScope }))
  .on(bucketChanged, (s, bucket) => ({ ...s, bucket, page: 1 }))
  .on(closedToggled, (s, closed) => ({ ...s, closed, page: 1, selected: new Set() }))
  .on(sortChanged, (s, field) => ({ ...s, sort: { field, ascending: s.sort.field === field && !s.sort.ascending } }))
  .on(pageChanged, (s, page) => ({ ...s, page }))
  .on(sizeChanged, (s, size) => ({ ...s, size, page: 1 }))
  .on(selectionChanged, (s, { ids, checked }) => ({ ...s, selected: toggleIds(s.selected, ids, checked) }))
  .on(expansionChanged, (s, { ids, checked }) => ({ ...s, expanded: toggleIds(s.expanded, ids, checked) }))
  .on(reconciliationToggled, (s) => ({ ...s, collapsed: !s.collapsed }))
  .reset(lifecycle.pageClosed)

const scopeChanged = sample({ clock: [accountsLoaded, accountsApplied, accountActivated, dateChanged], source: $workspace })
const reportRequested = sample({ clock: [scopeChanged, reportRefreshed], source: $workspace })
const masterRequested = sample({ clock: [scopeChanged, reconciliationRefreshed], source: $workspace })
const $reportRevision = createStore(0).on([reportRequested, lifecycle.pageClosed], (n) => n + 1)
const $masterRevision = createStore(0).on([masterRequested, lifecycle.pageClosed], (n) => n + 1)
const toQuery = ({ account, asOf }: Request): ReportQuery => ({ account, asOf })
const loadReportFx = attach({ effect: reportFx, mapParams: toQuery })
const loadMasterFx = attach({ effect: masterFx, mapParams: toQuery })
const requestOf = (revision: number, { account, asOf }: Workspace): Request => ({ revision, account: account!, asOf })
sample({ clock: reportRequested, source: $reportRevision, filter: (_, s) => s.account !== null, fn: requestOf, target: loadReportFx })
sample({ clock: masterRequested, source: $masterRevision, filter: (_, s) => s.account !== null, fn: requestOf, target: loadMasterFx })

export const $report = createStore<Load<Placement[]>>({ phase: 'idle' })
  .on(reportRequested, (_, s) => ({ phase: s.account ? 'loading' : 'idle' }))
  .reset(lifecycle.pageClosed)
export const $master = createStore<Load<Metrics>>({ phase: 'idle' })
  .on(masterRequested, (_, s) => ({ phase: s.account ? 'loading' : 'idle' }))
  .reset(lifecycle.pageClosed)
$report
  .on(sample({ clock: loadReportFx.done, source: $reportRevision, filter: (n, r) => n === r.params.revision, fn: (_, r) => r.result }),
    (_, data) => ({ phase: 'ready', data }))
  .on(sample({ clock: loadReportFx.fail, source: $reportRevision, filter: (n, r) => n === r.params.revision, fn: (_, r) => r.error.message }),
    (_, message) => ({ phase: 'error', message }))
$master
  .on(sample({ clock: loadMasterFx.done, source: $masterRevision, filter: (n, r) => n === r.params.revision, fn: (_, r) => r.result }),
    (_, data) => ({ phase: 'ready', data }))
  .on(sample({ clock: loadMasterFx.fail, source: $masterRevision, filter: (n, r) => n === r.params.revision, fn: (_, r) => r.error.message }),
    (_, message) => ({ phase: 'error', message }))

export const $reportView = combine($report, $workspace, (result, state) => {
  const rows = result.phase === 'ready' ? reportRows(result.data, state.asOf) : []
  const base = filterRows(rows, state.filters, state.query, state.closed)
  const visible = sortRows(base.filter((row) => inBucket(row, state.bucket)), state.sort)
  const page = Math.min(state.page, Math.max(1, Math.ceil(visible.length / state.size)))
  const offset = (page - 1) * state.size
  return {
    counts: { all: base.length, '1-2': base.filter((row) => inBucket(row, '1-2')).length,
      '3-5': base.filter((row) => inBucket(row, '3-5')).length, '6+': base.filter((row) => inBucket(row, '6+')).length },
    phase: result.phase, error: result.phase === 'error' ? result.message : null,
    metrics: result.phase === 'ready' ? aggregate(rows, state.asOf) : null,
    visible, page, pageRows: visible.slice(offset, offset + state.size), selectedRows: rows.filter((row) => state.selected.has(row.id)),
  }
})
sample({ clock: [accountsApplied, accountActivated, dateChanged], target: detail.closeTop })
sample({ clock: docLinkOpened, source: lifecycle.$opened, filter: (opened) => opened, fn: (_, id) => ({ id, secondary: false }), target: detail.open })
