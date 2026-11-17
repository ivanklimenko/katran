import { allSettled, createEffect, createStore, fork, type Store } from 'effector'
import { memoryPersist, type Facet, type FacetsQuery, type FilterMeta, type GridPage, type GridQuery, type SuggestQuery } from '@katran/effector'
import type { RecordLayout } from '@katran/ui'
import { ApiError } from '../../../shared/api'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { createRegistry } from './createRegistry'

type Row = { id: string; status: string }
const layout: RecordLayout<Row> = { rowKey: (r) => r.id, columns: [{ id: 'status', render: (r) => r.status }] }

function setup(metaFails = false, pageSize?: number, options: { $active?: Store<boolean>; lifecycle?: ReturnType<typeof createPageLifecycle> } = {}) {
  const calls = { search: 0, meta: 0 }
  const ports = {
    searchFx: createEffect<GridQuery, GridPage<Row>, ApiError>(async () => { calls.search += 1; return { rows: [{ id: 'a', status: 'DONE' }], total: 1 } }),
    facetsFx: createEffect<FacetsQuery, Facet[], ApiError>(async () => []),
    suggestFx: createEffect<SuggestQuery, string[], ApiError>(async () => []),
    filterMetaFx: createEffect<void, FilterMeta, ApiError>(async () => { calls.meta += 1; if (metaFails) throw new ApiError(500, null, 'сбой'); return { fields: [] } }),
  }
  const lifecycle = options.lifecycle ?? createPageLifecycle()
  const r = createRegistry({ id: 'docs', layout, ports, lifecycle, pageSize, $active: options.$active, persist: memoryPersist() })
  return { r, calls, lifecycle, ports, scope: fork() }
}

describe('createRegistry', () => {
  it('без опции активности повторный pageOpened обновляет search/facets, не дублируя первый запрос', async () => {
    const { calls, ports, lifecycle, scope } = setup()
    let facets = 0
    ports.facetsFx.use(async () => { facets += 1; return [] })
    await allSettled(lifecycle.pageOpened, { scope })
    expect(calls).toEqual({ search: 1, meta: 1 })
    expect(facets).toBe(1)
    await allSettled(lifecycle.pageOpened, { scope })
    expect(calls).toEqual({ search: 2, meta: 1 })
    expect(facets).toBe(2)
  })

  it('один lifecycle страницы: запросы только видимого реестра, каталог кэшируется, скрытие снимает выделение', async () => {
    const lifecycle = createPageLifecycle()
    const $a = createStore(true)
    const $b = createStore(false)
    const a = setup(false, undefined, { lifecycle, $active: $a })
    const b = setup(false, undefined, { lifecycle, $active: $b })
    const scope = fork()
    await allSettled(lifecycle.pageOpened, { scope })
    expect(a.calls).toEqual({ search: 1, meta: 1 })
    expect(b.calls).toEqual({ search: 0, meta: 0 })
    await allSettled(a.r.grid.select, { scope, params: { id: 'a', on: true } })
    await allSettled($a, { scope, params: false })
    expect(scope.getState(a.r.grid.$selection)).toEqual({ mode: 'ids', ids: [] })
    await allSettled(b.r.filters.setLane, { scope, params: 'ERROR' })
    await allSettled(b.r.refreshRequested, { scope })
    expect(b.calls).toEqual({ search: 0, meta: 0 })
    await allSettled($b, { scope, params: true })
    expect(b.calls).toEqual({ search: 1, meta: 1 })
    await allSettled(lifecycle.pageClosed, { scope })
    await allSettled(b.r.grid.refresh, { scope })
    await allSettled(b.r.grid.setPage, { scope, params: 3 })
    expect(b.calls).toEqual({ search: 1, meta: 1 })
    await allSettled(lifecycle.pageOpened, { scope })
    expect(b.calls).toEqual({ search: 2, meta: 1 })
    expect(a.calls).toEqual({ search: 1, meta: 1 })
    expect(scope.getState(b.r.grid.$page)).toBe(3)
    expect(scope.getState(b.r.$active)).toBe(true)
    expect(scope.getState(a.r.$active)).toBe(false)
  })

  it('размер страницы: 20; регулятор стенда ?size=N — начальный размер; pageSize конфигурации важнее', () => {
    expect(fork().getState(setup().r.grid.$pageSize)).toBe(20)
    history.replaceState(null, '', '/?size=200')
    try {
      expect(fork().getState(setup().r.grid.$pageSize)).toBe(200)
      expect(fork().getState(setup(false, 50).r.grid.$pageSize)).toBe(50)
    } finally { history.replaceState(null, '', '/') }
  })
  it('pageOpened: запрос реестра и один раз каталог за несколько открытий', async () => {
    const { r, calls, lifecycle, scope } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    expect(calls).toEqual({ search: 1, meta: 1 })
    expect(scope.getState(r.$metaReady)).toBe(true)
    expect(scope.getState(r.filters.$meta)).toEqual({ fields: [] })
    await allSettled(lifecycle.pageClosed, { scope })
    await allSettled(lifecycle.pageOpened, { scope })
    expect(calls).toEqual({ search: 2, meta: 1 })
  })
  it('pageClosed снимает выделение, фильтры, сортировка и страница остаются', async () => {
    const { r, lifecycle, scope } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(r.filters.setLane, { scope, params: 'ERROR' })
    // sortBy сбрасывает страницу — поэтому сортировка раньше setPage
    await allSettled(r.grid.sortBy, { scope, params: [{ key: 'status', dir: 'desc' }] })
    await allSettled(r.grid.setPage, { scope, params: 2 })
    await allSettled(r.grid.select, { scope, params: { id: 'a', on: true } })
    await allSettled(lifecycle.pageClosed, { scope })
    expect(scope.getState(r.grid.$selection)).toEqual({ mode: 'ids', ids: [] })
    expect(scope.getState(r.filters.$lane)).toBe('ERROR')
    expect(scope.getState(r.grid.$page)).toBe(2)
    expect(scope.getState(r.grid.$sort)).toEqual([{ key: 'status', dir: 'desc' }])
  })
  it('отказ каталога не трогает грид; повтор при следующем открытии', async () => {
    const { r, calls, lifecycle, scope } = setup(true)
    await allSettled(lifecycle.pageOpened, { scope })
    expect(scope.getState(r.$metaReady)).toBe(false)
    expect(scope.getState(r.grid.$state)).toBe('ready')
    await allSettled(lifecycle.pageOpened, { scope })
    expect(calls.meta).toBe(2)
  })
  it('refreshRequested перезапрашивает только открытый реестр', async () => {
    const { r, calls, lifecycle, scope } = setup()
    await allSettled(r.refreshRequested, { scope })
    expect(calls.search).toBe(0)
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(r.refreshRequested, { scope })
    expect(calls.search).toBe(2)
    await allSettled(lifecycle.pageClosed, { scope })
    await allSettled(r.refreshRequested, { scope })
    expect(calls.search).toBe(2)
  })
})
