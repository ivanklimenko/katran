import { allSettled, createEffect, fork } from 'effector'
import { memoryPersist, type Facet, type FacetsQuery, type FilterMeta, type GridPage, type GridQuery } from '@katran/effector'
import type { RecordLayout } from '@katran/ui'
import { ApiError } from '../../../shared/api'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { createRegistry } from './createRegistry'

type Row = { id: string; status: string }
const layout: RecordLayout<Row> = { rowKey: (r) => r.id, columns: [{ id: 'status', render: (r) => r.status }] }

function setup(metaFails = false) {
  const calls = { search: 0, meta: 0 }
  const ports = {
    searchFx: createEffect<GridQuery, GridPage<Row>, ApiError>(async () => { calls.search += 1; return { rows: [{ id: 'a', status: 'DONE' }], total: 1 } }),
    facetsFx: createEffect<FacetsQuery, Facet[], ApiError>(async () => []),
    filterMetaFx: createEffect<void, FilterMeta, ApiError>(async () => { calls.meta += 1; if (metaFails) throw new ApiError(500, null, 'сбой'); return { fields: [] } }),
  }
  const lifecycle = createPageLifecycle()
  const r = createRegistry({ id: 'docs', layout, ports, lifecycle, persist: memoryPersist() })
  return { r, calls, lifecycle, scope: fork() }
}

describe('createRegistry', () => {
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
  it('pageClosed снимает выделение, фильтры и страница остаются', async () => {
    const { r, lifecycle, scope } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(r.filters.setLane, { scope, params: 'ERROR' })
    await allSettled(r.grid.setPage, { scope, params: 2 })
    await allSettled(r.grid.select, { scope, params: { id: 'a', on: true } })
    await allSettled(lifecycle.pageClosed, { scope })
    expect(scope.getState(r.grid.$selection)).toEqual({ mode: 'ids', ids: [] })
    expect(scope.getState(r.filters.$lane)).toBe('ERROR')
    expect(scope.getState(r.grid.$page)).toBe(2)
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
