import { render } from 'react-dom'
import { createEffect, createEvent, createStore } from 'effector'
import { useUnit } from 'effector-react'
import { memoryPersist, useGrid, type Facet, type FacetsQuery, type FilterMeta, type GridPage, type GridPersisted, type GridQuery, type SuggestQuery } from '@katran/effector'
import { DataGrid, KatranProvider, type RecordLayout } from '@katran/ui'
import type { ApiError } from '../../src/shared/api'
import { createPageLifecycle } from '../../src/shared/lib/lifecycle'
import { createRegistry } from '../../src/widgets/doc-registry'

type Row = { id: string; status: string }
const layout: RecordLayout<Row> = { rowKey: (row) => row.id, columns: [{ id: 'status', title: 'Статус', render: (row) => row.status }] }
const lifecycle = createPageLifecycle()
const choose = createEvent<'a' | 'b'>()
const $tab = createStore<'a' | 'b'>('a').on(choose, (_, value) => value)

function registry(id: 'a' | 'b') {
  const ports = {
    searchFx: createEffect<GridQuery, GridPage<Row>, ApiError>(async () => ({ rows: [{ id, status: 'DONE' }], total: 87 })),
    facetsFx: createEffect<FacetsQuery, Facet[], ApiError>(async () => [{ value: 'DONE', count: 87 }]),
    filterMetaFx: createEffect<void, FilterMeta, ApiError>(async () => ({ fields: [] })),
    suggestFx: createEffect<SuggestQuery, string[], ApiError>(async () => ['подсказка']),
  }
  const $calls = createStore({ search: 0, facets: 0, meta: 0, suggest: 0 })
    .on(ports.searchFx, (value) => ({ ...value, search: value.search + 1 }))
    .on(ports.facetsFx, (value) => ({ ...value, facets: value.facets + 1 }))
    .on(ports.filterMetaFx, (value) => ({ ...value, meta: value.meta + 1 }))
    .on(ports.suggestFx, (value) => ({ ...value, suggest: value.suggest + 1 }))
  const config = { id, layout, ports, lifecycle, $active: $tab.map((value) => value === id), persist: memoryPersist<Partial<GridPersisted>>() }
  return { model: createRegistry(config), $calls }
}
const a = registry('a')
const b = registry('b')

function Registry({ name, model }: { name: string; model: typeof a.model }) {
  const binding = useGrid(model.grid)
  return <div style={{ height: 260 }}><DataGrid {...binding} layout={layout} label={name} /></div>
}

function App() {
  const [tab, callsA, callsB, queryB] = useUnit([$tab, a.$calls, b.$calls, b.model.grid.$query])
  const [select, opened, closed, changeFilter, sort, page, size, refreshA, refreshB] = useUnit([
    choose, lifecycle.pageOpened, lifecycle.pageClosed, b.model.filters.setLane, b.model.grid.sortBy,
    b.model.grid.setPage, b.model.grid.setPageSize, a.model.refreshRequested, b.model.refreshRequested,
  ])
  return <KatranProvider defaultDensity={1} defaultTheme="light">
    <button onClick={() => select('a')}>Реестр A</button><button onClick={() => select('b')}>Реестр B</button>
    <button onClick={() => { changeFilter('ERROR'); sort([{ key: 'status', dir: 'desc' }]); size(50); page(3) }}>Поменять параметры B</button>
    <button onClick={() => { refreshA(); refreshB() }}>Обновить оба</button>
    <button onClick={() => closed()}>Закрыть страницу</button><button onClick={() => opened()}>Открыть страницу</button>
    <output data-testid="calls-a">{JSON.stringify(callsA)}</output><output data-testid="calls-b">{JSON.stringify(callsB)}</output>
    <output data-testid="query-b">{JSON.stringify(queryB)}</output>
    <section hidden={tab !== 'a'}><Registry name="Реестр A" model={a.model} /></section>
    <section hidden={tab !== 'b'}><Registry name="Реестр B" model={b.model} /></section>
  </KatranProvider>
}

render(<App />, document.getElementById('root'))
lifecycle.pageOpened()
