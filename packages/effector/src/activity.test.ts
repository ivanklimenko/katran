import { allSettled, createEffect, createEvent, createStore, fork } from 'effector'
import { createGridModel } from './createGridModel'
import { createFiltersModel } from './createFiltersModel'
import type { Facet, FacetsQuery, Filter, GridPage, GridQuery, SuggestQuery } from './types'

type Row = { id: string }
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('активность грида', () => {
  it('показ и восстановление фильтра одним событием отправляют один актуальный search/facets', async () => {
    const selected = createEvent()
    const filter: Filter = [{ field: 'name', op: 'EQ', value: 'restored' }]
    const $active = createStore(false).on(selected, () => true)
    const $filter = createStore<Filter>([]).on(selected, () => filter)
    const searches: GridQuery[] = []
    const facets: FacetsQuery[] = []
    const model = createGridModel({
      id: 'g', columns: [], rowKey: (row: Row) => row.id, $active, $filter,
      fetchFx: createEffect<GridQuery, GridPage<Row>>(async (q) => { searches.push(q); return { rows: [], total: 0 } }),
      facets: { field: 'status', fetchFx: createEffect<FacetsQuery, Facet[]>(async (q) => { facets.push(q); return [] }) },
    })
    const scope = fork()
    await allSettled(model.setPage, { scope, params: 3 })
    await allSettled(selected, { scope })
    expect(searches).toEqual([{ filter, sort: [], page: 0, size: 20 }])
    expect(facets).toEqual([{ filter, field: 'status' }])
  })

  it('скрытый грид сохраняет параметры без запросов; активация — один search/facets с текущим состоянием', async () => {
    const searches: GridQuery[] = []
    const facets: FacetsQuery[] = []
    const $active = createStore(false)
    const $filter = createStore<Filter>([])
    const fetchFx = createEffect<GridQuery, GridPage<Row>>(async (query) => { searches.push(query); return { rows: [{ id: 'fresh' }], total: 87 } })
    const facetsFx = createEffect<FacetsQuery, Facet[]>(async (query) => { facets.push(query); return [] })
    const model = createGridModel({ id: 'g', columns: [], rowKey: (row: Row) => row.id, $active, $filter, fetchFx, facets: { field: 'status', fetchFx: facetsFx } })
    const scope = fork()
    await allSettled(model.refresh, { scope })
    await allSettled(model.retry, { scope })
    await allSettled($filter, { scope, params: [{ field: 'status', op: 'EQ', value: 'DONE' }] })
    await allSettled(model.sortBy, { scope, params: [{ key: 'id', dir: 'desc' }] })
    await allSettled(model.setPageSize, { scope, params: 50 })
    await allSettled(model.setPage, { scope, params: 3 })
    expect(searches).toEqual([])
    expect(facets).toEqual([])
    await allSettled($active, { scope, params: true })
    expect(searches).toEqual([{ filter: [{ field: 'status', op: 'EQ', value: 'DONE' }], sort: [{ key: 'id', dir: 'desc' }], page: 2, size: 50 }])
    expect(facets).toEqual([{ field: 'status', filter: [] }])
    await allSettled($active, { scope, params: false })
    await allSettled(model.refresh, { scope })
    expect(searches).toHaveLength(1)
    expect(scope.getState(model.$rows)).toEqual([{ id: 'fresh' }])
    expect(scope.getState(model.$page)).toBe(3)
  })

  it.each(['success', 'failure'] as const)('поздний %s старой активации с той же query не меняет данные, ошибку и pending нового показа', async (outcome) => {
    const calls: { ok: (page: GridPage<Row>) => void; fail: (error: Error) => void }[] = []
    const facets: ((items: Facet[]) => void)[] = []
    const $active = createStore(false)
    const fetchFx = createEffect<GridQuery, GridPage<Row>>(() => new Promise((ok, fail) => { calls.push({ ok, fail }) }))
    const facetsFx = createEffect<FacetsQuery, Facet[]>(() => new Promise((ok) => { facets.push(ok) }))
    const model = createGridModel({ id: 'g', columns: [], rowKey: (row: Row) => row.id, $active, $filter: createStore<Filter>([]), fetchFx, facets: { field: 'status', fetchFx: facetsFx } })
    const scope = fork()
    const pending = [allSettled($active, { scope, params: true })]
    await tick()
    pending.push(allSettled($active, { scope, params: false }))
    pending.push(allSettled($active, { scope, params: true }))
    await tick()
    try {
      expect(calls).toHaveLength(2)
      expect(facets).toHaveLength(2)
      calls[1]!.ok({ rows: [{ id: 'new' }], total: 2 })
      facets[1]!([{ value: 'DONE', count: 2 }])
      await tick()
      expect(scope.getState(model.$state)).toBe('ready') // старый запрос ещё висит
      if (outcome === 'success') calls[0]!.ok({ rows: [{ id: 'old' }], total: 99 })
      else calls[0]!.fail(new Error('старая ошибка'))
      facets[0]!([{ value: 'DONE', count: 99 }])
      await Promise.all(pending)
      expect(scope.getState(model.$rows)).toEqual([{ id: 'new' }])
      expect(scope.getState(model.$total)).toBe(2)
      expect(scope.getState(model.$facets)).toEqual([{ value: 'DONE', count: 2 }])
      expect(scope.getState(model.$error)).toBeNull()
      expect(scope.getState(model.$state)).toBe('ready')
    } finally { calls.forEach((call) => call.ok({ rows: [], total: 0 })); facets.forEach((ok) => ok([])); await Promise.all(pending) }
  })

  it('ответ после скрытия не заполняет строки, total и фасеты', async () => {
    let release: ((page: GridPage<Row>) => void) | undefined
    let releaseFacets: ((items: Facet[]) => void) | undefined
    const $active = createStore(false)
    const fetchFx = createEffect<GridQuery, GridPage<Row>>(() => new Promise((ok) => { release = ok }))
    const facetsFx = createEffect<FacetsQuery, Facet[]>(() => new Promise((ok) => { releaseFacets = ok }))
    const model = createGridModel({ id: 'g', columns: [], rowKey: (row: Row) => row.id, $active, $filter: createStore<Filter>([]), fetchFx, facets: { field: 'status', fetchFx: facetsFx } })
    const scope = fork()
    const opening = allSettled($active, { scope, params: true })
    await tick()
    const closing = allSettled($active, { scope, params: false })
    try {
      expect(release).toBeTypeOf('function')
      release!({ rows: [{ id: 'late' }], total: 99 })
      releaseFacets!([{ value: 'DONE', count: 99 }])
      await Promise.all([opening, closing])
      expect(scope.getState(model.$rows)).toEqual([])
      expect(scope.getState(model.$total)).toBe(0)
      expect(scope.getState(model.$facets)).toEqual([])
    } finally { release?.({ rows: [], total: 0 }); releaseFacets?.([]); await Promise.all([opening, closing]) }
  })

  it('один статический граф в двух fork: активность и ответы изолированы', async () => {
    const $active = createStore(false)
    const $filter = createStore<Filter>([])
    const fetchFx = createEffect<GridQuery, GridPage<Row>>(async (query) => ({ rows: [{ id: query.filter.length ? 'b' : 'a' }], total: 1 }))
    const model = createGridModel({ id: 'g', columns: [], rowKey: (row: Row) => row.id, $active, $filter, fetchFx })
    const a = fork()
    const b = fork({ values: [[$filter, [{ field: 'id', op: 'EQ', value: 'b' }]]] })
    await allSettled($active, { scope: a, params: true })
    expect(a.getState(model.$rows)).toEqual([{ id: 'a' }])
    expect(b.getState(model.$rows)).toEqual([])
    await allSettled($active, { scope: b, params: true })
    expect(b.getState(model.$rows)).toEqual([{ id: 'b' }])
    expect(a.getState(model.$rows)).toEqual([{ id: 'a' }])
  })
})

describe('подсказки скрытого реестра', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('скрытый ввод и debounce после скрытия не вызывают транспорт', async () => {
    const calls: SuggestQuery[] = []
    const $active = createStore(false)
    const fetchFx = createEffect<SuggestQuery, string[]>(async (query) => { calls.push(query); return ['answer'] })
    const model = createFiltersModel({ $active, suggest: { fetchFx } })
    const scope = fork()
    const hidden = allSettled(model.suggest, { scope, params: { field: 'name', query: 'abc' } })
    await vi.advanceTimersByTimeAsync(300)
    await hidden
    expect(calls).toEqual([])
    expect(scope.getState(model.$suggest)).toBeNull()
    await allSettled($active, { scope, params: true })
    const typing = allSettled(model.suggest, { scope, params: { field: 'name', query: 'abc' } })
    const hiding = allSettled($active, { scope, params: false })
    await vi.advanceTimersByTimeAsync(300)
    await Promise.all([typing, hiding])
    expect(calls).toEqual([])
    expect(scope.getState(model.$suggest)).toBeNull()
  })

  it('поздняя подсказка прежнего показа с тем же текстом не заменяет новую', async () => {
    const release: ((items: string[]) => void)[] = []
    const $active = createStore(true)
    const fetchFx = createEffect<SuggestQuery, string[]>(() => new Promise((ok) => { release.push(ok) }))
    const model = createFiltersModel({ $active, suggest: { fetchFx } })
    const scope = fork()
    const pending = [allSettled(model.suggest, { scope, params: { field: 'name', query: 'abc' } })]
    await vi.advanceTimersByTimeAsync(300)
    pending.push(allSettled($active, { scope, params: false }))
    pending.push(allSettled($active, { scope, params: true }))
    pending.push(allSettled(model.suggest, { scope, params: { field: 'name', query: 'abc' } }))
    await vi.advanceTimersByTimeAsync(300)
    try {
      expect(release).toHaveLength(2)
      release[1]!(['new'])
      await vi.advanceTimersByTimeAsync(0)
      release[0]!(['old'])
      await Promise.all(pending)
      expect(scope.getState(model.$suggest)?.items).toEqual(['new'])
    } finally { release.forEach((ok) => ok([])); await Promise.all(pending) }
  })
})
