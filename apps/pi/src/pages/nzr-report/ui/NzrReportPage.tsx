import { useState } from 'react'
import { useUnit } from 'effector-react'
import { Button, Checkbox, Input, Pagination, useKatran } from '@katran/ui'
import { STATUSES, STATUS_LABEL } from '../../../entities/doc-status'
import { fxDocDetailDomain, fxExtraView } from '../../../entities/fx-doc'
import { DocDetail } from '../../../widgets/doc-detail'
import { localDate, reportCsv, type Bucket, type NzrDocumentDetail } from '../model/report'
import {
  $catalog, $reportView, $workspace, accountActivated, accountsApplied, bucketChanged, catalogRetry, closedToggled,
  dateChanged, detail, expansionChanged, filtersApplied, filtersReset, pageChanged, queryChanged, reportRefreshed,
  selectionChanged, sizeChanged, sortChanged,
} from '../model/workspace'
import { AccountSetDialog, AccountSwitcher } from './AccountControls'
import { ManualDeviationsDialog } from './ManualDeviationsDialog'
import { Reconciliation } from './Reconciliation'
import { ReportFilters } from './ReportFilters'
import { DocumentStatus, ReportTable } from './ReportTable'
import { Bar, Grow, Labeled, Monospace, Muted, Screen } from './styles'

const buckets: { id: Bucket; title: string }[] = [
  { id: 'all', title: 'Все на НЗР' }, { id: '1-2', title: '1–2 дня' }, { id: '3-5', title: '3–5 дней' }, { id: '6+', title: 'Более 5 дней' },
]
const pageSizes = [10, 20, 50]
const domain = {
  ...fxDocDetailDomain,
  actions: [],
  tabs: fxDocDetailDomain.tabs.filter((tab) => tab.id === 'main' || tab.id === 'extra'),
  tabViews: { extra: fxExtraView },
  summary: (doc: NzrDocumentDetail) => ({
    ...fxDocDetailDomain.summary(doc),
    kind: doc.parent === null ? 'Постановка на НЗР' : `Списание · к постановке № ${doc.parent}`,
  }),
}
type Overlay = 'accounts' | 'switch' | 'deviations' | null

export function NzrReportPage({ note, onManualDeviations }: {
  note?: string
  onManualDeviations?: (ids: string[]) => void
}) {
  const { announce } = useKatran()
  const { catalog, state, view, ...events } = useUnit({
    catalog: $catalog, state: $workspace, view: $reportView, applyAccounts: accountsApplied, activate: accountActivated,
    setDate: dateChanged, setQuery: queryChanged, applyFilters: filtersApplied, resetFilters: filtersReset,
    setBucket: bucketChanged, toggleClosed: closedToggled, setSort: sortChanged, setPage: pageChanged, setSize: sizeChanged,
    select: selectionChanged, expand: expansionChanged, open: detail.open, retryCatalog: catalogRetry, retryReport: reportRefreshed,
  })
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filterEditing, setFilterEditing] = useState(0)
  const catalogData = catalog.phase === 'ready' ? catalog.data : null
  const accounts = catalogData?.accounts ?? []
  const chosen = accounts.filter((a) => state.accounts.includes(a.id))
  const activeIndex = chosen.findIndex((a) => a.id === state.account)
  const active = chosen[activeIndex]
  const expandedOnPage = view.pageRows.filter((row) => row.visibleChildren.length).map((row) => row.id)
  const allExpanded = expandedOnPage.length > 0 && expandedOnPage.every((id) => state.expanded.has(id))
  const filterCount = Object.values(state.filters).filter(Boolean).length
  const selectedIds = view.selectedRows.map((row) => row.id)
  const exportRows = view.selectedRows.length ? view.selectedRows : view.visible

  function exportReport() {
    const url = URL.createObjectURL(new Blob([reportCsv(exportRows)], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'nzr-report.csv'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    announce(`Экспортировано постановок: ${exportRows.length}`)
  }

  const closeOverlay = () => setOverlay(null)
  const context = active && (
    <Reconciliation account={active} asOf={state.asOf} report={view.metrics} collapsed={state.collapsed} />
  )

  return (
    <Screen aria-label="Отчёт НЗР">
      <header><h1>Отчёт НЗР</h1>{view.metrics && <Muted>{view.metrics.documents} на НЗР</Muted>}</header>
      <Bar>
        {active ? <><Muted>Активный счёт НЗР</Muted><strong><Monospace>{active.id}</Monospace></strong><span>{active.currency}</span></> : <strong>Счёт не выбран</strong>}
        <Button size="s" aria-label="Предыдущий счёт" disabled={activeIndex <= 0}
          onClick={() => events.activate(chosen[activeIndex - 1]!.id)}>‹</Button>
        <span>{activeIndex + 1} из {chosen.length}</span>
        <Button size="s" aria-label="Следующий счёт" disabled={activeIndex < 0 || activeIndex >= chosen.length - 1}
          onClick={() => events.activate(chosen[activeIndex + 1]!.id)}>›</Button>
        <Button size="s" disabled={!active} onClick={() => setOverlay('switch')}>Перейти к счёту</Button>
        <Button size="s" disabled={catalog.phase !== 'ready'} onClick={() => setOverlay('accounts')}>Набор счетов · {chosen.length}</Button>
        <Labeled>На дату <Input type="date" aria-label="Дата отчёта и оборота" size="s" value={state.asOf}
          min={catalogData?.firstReportDate} max={catalogData?.reportDate} disabled={!catalogData} onChange={(e) => {
            if (e.target.value && e.target.validity.valid) events.setDate(e.target.value)
          }} /></Labeled>
      </Bar>
      {context}
      <Bar role="group" aria-label="Срок ожидания">
        {buckets.map(({ id, title }) => (
          <Button key={id} size="s" pressed={state.bucket === id} onClick={() => events.setBucket(id)}>
            {id === 'all' && state.closed ? 'Все документы' : title} · {view.counts[id]}
          </Button>
        ))}
        <Muted>{state.sort.field === 'age' ? 'Сначала самые давние' : state.sort.field === 'date' ? 'По дате постановки' : 'По сумме'}</Muted>
      </Bar>
      <Bar>
        <Input type="search" aria-label="Поиск по постановкам" placeholder="Номер, UUID, счёт или имя" size="s" value={state.query}
          onChange={(e) => events.setQuery(e.target.value)} />
        <Button size="s" aria-expanded={showFilters} aria-controls={showFilters ? 'nzr-filters' : undefined}
          onClick={() => setShowFilters(!showFilters)}>Фильтры{filterCount > 0 ? ` · ${filterCount}` : ''}</Button>
        <Muted>
          {state.filters.from || state.filters.to ? `${localDate(state.filters.from) || '…'} — ${localDate(state.filters.to) || '…'}` : 'За всё время'}
          {state.filters.product && ` · ${state.filters.product}`}{state.filters.status && ` · ${STATUS_LABEL[state.filters.status]}`}
        </Muted>
        <Grow />
        {view.selectedRows.length > 0 && <>
          <span>Выбрано: {view.selectedRows.length}</span>
          <Button size="s" variant="primary" onClick={() => {
            if (onManualDeviations) onManualDeviations(selectedIds)
            else setOverlay('deviations')
          }}>Переход к ручным отклонениям</Button>
        </>}
        <Button size="s" disabled={!expandedOnPage.length} onClick={() => events.expand({ ids: expandedOnPage, checked: !allExpanded })}>
          {allExpanded ? 'Свернуть все связи' : 'Раскрыть все связи'}
        </Button>
        <Button size="s" disabled={!exportRows.length} onClick={exportReport}>Экспорт</Button>
      </Bar>
      {showFilters && <ReportFilters key={`${state.account}:${filterEditing}`} initial={state.filters} onApply={events.applyFilters} onReset={events.resetFilters} />}
      <Bar>
        <Muted>Срок ожидания идёт от даты постановки до успешного списания.</Muted>
        <details><summary>Статусы документов</summary>
          <ul>{STATUSES.map((status) => <li key={status}><DocumentStatus status={status} /> {STATUS_LABEL[status]} · {status}</li>)}</ul>
        </details>
        <Grow />
        <Checkbox label="Включить списанные" checked={state.closed} onChange={(e) => events.toggleClosed(e.target.checked)} />
      </Bar>
      {catalog.phase === 'idle' || catalog.phase === 'loading' || view.phase === 'loading' ? <p role="status">Загрузка отчёта…</p>
        : catalog.phase === 'error' ? <Bar><span role="alert">{catalog.message}</span><Button onClick={events.retryCatalog}>Повторить загрузку счетов</Button></Bar>
          : view.error ? <Bar><span role="alert">{view.error}</span><Button onClick={events.retryReport}>Повторить загрузку отчёта</Button></Bar>
            : <ReportTable rows={view.pageRows} selected={state.selected} expanded={state.expanded} sort={state.sort} page={view.page}
              onSelect={(ids, checked) => events.select({ ids, checked })} onExpand={(ids, checked) => events.expand({ ids, checked })}
              onOpen={(id) => events.open({ id, secondary: false })} onSort={events.setSort}
              empty={active
                ? { title: 'Постановки не найдены', action: 'Сбросить поиск и фильтры', onAction: () => {
                  events.resetFilters()
                  setFilterEditing(filterEditing + 1)
                } }
                : { title: 'Выберите счета НЗР', action: 'Выбрать счета', onAction: () => setOverlay('accounts') }} />}
      <Pagination page={view.page} pageSize={state.size} total={view.visible.length} onPage={events.setPage} pageSizes={pageSizes} onPageSize={events.setSize} />
      {note && <Muted>{note}</Muted>}
      {overlay === 'accounts' && <AccountSetDialog accounts={accounts} snapshot={catalogData?.snapshot} chosen={state.accounts} onClose={closeOverlay}
        onApply={(ids) => { events.applyAccounts(ids); setFilterEditing(filterEditing + 1); closeOverlay() }} />}
      {overlay === 'switch' && active && <AccountSwitcher accounts={chosen} active={active.id} onClose={closeOverlay}
        onActivate={(id) => { events.activate(id); closeOverlay() }} />}
      {overlay === 'deviations' && <ManualDeviationsDialog ids={selectedIds} onClose={closeOverlay} />}
      <DocDetail detail={detail} domain={domain} returnFocus={(id) => document.getElementById(`nzr-open-${id}`)} />
    </Screen>
  )
}
