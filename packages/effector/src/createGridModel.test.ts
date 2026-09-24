import { allSettled, createEffect, createStore, fork } from 'effector'
import { createGridModel } from './createGridModel'
import { memoryPersist } from './persist'
import type { Facet, FacetsQuery, Filter, GridPage, GridQuery } from './types'

type Row = { id: string; n: number }
const mk = (over: Partial<Parameters<typeof createGridModel<Row>>[0]> = {}) => {
  const calls: GridQuery[] = []
  const fetchFx = createEffect<GridQuery, GridPage<Row>>(async (q) => {
    calls.push(q)
    return { rows: [{ id: 'a', n: 1 }, { id: 'b', n: 2 }], total: 87 }
  })
  const $filter = createStore<Filter>([])
  const model = createGridModel<Row>({
    id: 'g', columns: [{ id: 'c1', width: 100 }, { id: 'c2' }, { id: 'c3' }], $filter, fetchFx, rowKey: (r) => r.id, ...over,
  })
  return { model, calls, fetchFx, $filter }
}

/** Дать эффектам и их done/fail пройти через очередь микрозадач. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0))

describe('createGridModel', () => {
  it('стартовое состояние: страница 1, размер 20, порядок из колонок, запроса ещё нет', () => {
    const { model } = mk()
    const scope = fork()
    expect(scope.getState(model.$page)).toBe(1)
    expect(scope.getState(model.$pageSize)).toBe(20)
    expect(scope.getState(model.$order)).toEqual(['c1', 'c2', 'c3'])
    expect(scope.getState(model.$hidden)).toEqual([])
    expect(scope.getState(model.$widths)).toEqual({ c1: 100 })
    expect(scope.getState(model.$state)).toBe('loading')
    expect(scope.getState(model.$selection)).toEqual({ mode: 'ids', ids: [] })
  })

  it('refresh → запрос с page 0; данные и total; state ready', async () => {
    const { model, calls } = mk()
    const scope = fork()
    await allSettled(model.refresh, { scope })
    expect(calls).toEqual([{ filter: [], sort: null, page: 0, size: 20 }])
    expect(scope.getState(model.$rows)).toHaveLength(2)
    expect(scope.getState(model.$total)).toBe(87)
    expect(scope.getState(model.$state)).toBe('ready')
  })

  it('смена фильтра → страница 1, выделение сброшено, запрос с фильтром', async () => {
    const { model, calls, $filter } = mk()
    const scope = fork()
    await allSettled(model.refresh, { scope })
    await allSettled(model.setPage, { scope, params: 3 })
    await allSettled(model.select, { scope, params: { id: 'a', on: true } })
    expect(scope.getState(model.$page)).toBe(3)
    const f: Filter = [{ field: 'status', op: 'EQ', value: 'ERROR' }]
    await allSettled($filter, { scope, params: f })
    expect(scope.getState(model.$page)).toBe(1)
    expect(scope.getState(model.$selection)).toEqual({ mode: 'ids', ids: [] })
    expect(calls.at(-1)).toEqual({ filter: f, sort: null, page: 0, size: 20 })
  })

  it('sortBy → страница 1 и запрос с sort; setPage → запрос с page-1', async () => {
    const { model, calls } = mk()
    const scope = fork()
    await allSettled(model.setPage, { scope, params: 4 })
    expect(calls.at(-1)?.page).toBe(3)
    await allSettled(model.sortBy, { scope, params: { key: 'amount', dir: 'desc' } })
    expect(scope.getState(model.$page)).toBe(1)
    expect(calls.at(-1)).toMatchObject({ sort: { key: 'amount', dir: 'desc' }, page: 0 })
  })

  it('resize/toggleColumn/moveColumn — без запроса, но с persist', async () => {
    const persist = memoryPersist<Partial<{ widths: Record<string, number>; order: string[]; hidden: string[]; pageSize: number }>>()
    const { model, calls } = mk({ persist })
    const scope = fork()
    await allSettled(model.resize, { scope, params: { id: 'c2', width: 150 } })
    await allSettled(model.toggleColumn, { scope, params: 'c3' })
    await allSettled(model.moveColumn, { scope, params: { id: 'c2', dir: -1 } })
    expect(calls).toEqual([])
    expect(scope.getState(model.$widths)).toEqual({ c1: 100, c2: 150 })
    expect(scope.getState(model.$hidden)).toEqual(['c3'])
    expect(scope.getState(model.$order)).toEqual(['c2', 'c1', 'c3'])
    expect(persist.load('g')).toEqual({ widths: { c1: 100, c2: 150 }, order: ['c2', 'c1', 'c3'], hidden: ['c3'], pageSize: 20 })
  })

  it('persist.load восстанавливает вид при создании', () => {
    const persist = memoryPersist<Partial<{ widths: Record<string, number>; order: string[]; hidden: string[]; pageSize: number }>>()
    persist.save('g', { order: ['c3', 'c1', 'c2'], hidden: ['c1'], pageSize: 50, widths: { c3: 77 } })
    const { model } = mk({ persist })
    const scope = fork()
    expect(scope.getState(model.$order)).toEqual(['c3', 'c1', 'c2'])
    expect(scope.getState(model.$hidden)).toEqual(['c1'])
    expect(scope.getState(model.$pageSize)).toBe(50)
    expect(scope.getState(model.$widths)).toEqual({ c1: 100, c3: 77 })
  })

  it('persist: неизвестные id колонок отбрасываются, новые — дописываются в конец', () => {
    const persist = memoryPersist<Partial<{ order: string[]; hidden: string[] }>>()
    persist.save('g', { order: ['zzz', 'c2'], hidden: ['zzz'] })
    const { model } = mk({ persist })
    const scope = fork()
    expect(scope.getState(model.$order)).toEqual(['c2', 'c1', 'c3'])
    expect(scope.getState(model.$hidden)).toEqual([])
  })

  it('выделение: select/selectPage/selectAll/clearSelection; сортировка и страница не сбрасывают', async () => {
    const { model } = mk()
    const scope = fork()
    await allSettled(model.select, { scope, params: { id: 'a', on: true } })
    await allSettled(model.selectPage, { scope, params: { ids: ['b', 'c'], on: true } })
    expect(scope.getState(model.$selection)).toEqual({ mode: 'ids', ids: ['a', 'b', 'c'] })
    await allSettled(model.select, { scope, params: { id: 'b', on: false } })
    expect(scope.getState(model.$selection)).toEqual({ mode: 'ids', ids: ['a', 'c'] })
    await allSettled(model.setPage, { scope, params: 2 })
    await allSettled(model.sortBy, { scope, params: { key: 'n', dir: 'asc' } })
    expect(scope.getState(model.$selection)).toEqual({ mode: 'ids', ids: ['a', 'c'] })
    await allSettled(model.selectAll, { scope })
    expect(scope.getState(model.$selection)).toEqual({ mode: 'all', except: [] })
    await allSettled(model.select, { scope, params: { id: 'a', on: false } })
    expect(scope.getState(model.$selection)).toEqual({ mode: 'all', except: ['a'] })
    await allSettled(model.clearSelection, { scope })
    expect(scope.getState(model.$selection)).toEqual({ mode: 'ids', ids: [] })
  })

  it('состояния: loading → ready → refreshing → error → retry', async () => {
    let fail = false
    const fetchFx = createEffect<GridQuery, GridPage<Row>>(async () => {
      if (fail) throw new Error('сервис не ответил')
      return { rows: [{ id: 'a', n: 1 }], total: 1 }
    })
    const { model } = mk({ fetchFx })
    const scope = fork()
    expect(scope.getState(model.$state)).toBe('loading')
    await allSettled(model.refresh, { scope })
    expect(scope.getState(model.$state)).toBe('ready')
    fail = true
    await allSettled(model.refresh, { scope })
    expect(scope.getState(model.$state)).toBe('error')
    expect(scope.getState(model.$error)).toBe('сервис не ответил')
    expect(scope.getState(model.$rows)).toHaveLength(1)
    fail = false
    await allSettled(model.retry, { scope })
    expect(scope.getState(model.$state)).toBe('ready')
    expect(scope.getState(model.$error)).toBeNull()
  })

  it('устаревший ответ игнорируется: быстрые «стр. 2 → стр. 3», старый ответ приходит последним; отказ старого тоже', async () => {
    type Call = { q: GridQuery; ok: (p: GridPage<Row>) => void; fail: (e: Error) => void }
    const calls: Call[] = []
    const fetchFx = createEffect<GridQuery, GridPage<Row>>((q) => new Promise((ok, fail) => { calls.push({ q, ok, fail }) }))
    const { model } = mk({ fetchFx })
    const scope = fork()
    // allSettled ждёт все эффекты scope, поэтому промисы собираются и ожидаются только после ручных release
    const run = Promise.all([allSettled(model.setPage, { scope, params: 2 }), allSettled(model.setPage, { scope, params: 3 })])
    await flush()
    expect(calls.map((c) => c.q.page)).toEqual([1, 2])
    calls[1]!.ok({ rows: [{ id: 'p3', n: 3 }], total: 60 })             // актуальный (стр. 3) — первым
    await flush()
    expect(scope.getState(model.$rows)).toEqual([{ id: 'p3', n: 3 }])
    calls[0]!.ok({ rows: [{ id: 'p2', n: 2 }], total: 40 })             // старый (стр. 2) — позже
    await run
    expect(scope.getState(model.$rows)).toEqual([{ id: 'p3', n: 3 }])
    expect(scope.getState(model.$total)).toBe(60)
    expect(scope.getState(model.$state)).toBe('ready')

    const run2 = Promise.all([allSettled(model.setPage, { scope, params: 4 }), allSettled(model.setPage, { scope, params: 5 })])
    await flush()
    calls[2]!.fail(new Error('стр. 4 упала'))                           // старый запрос падает — это не ошибка текущего вида
    await flush()
    expect(scope.getState(model.$error)).toBeNull()
    expect(scope.getState(model.$state)).toBe('refreshing')
    calls[3]!.ok({ rows: [{ id: 'p5', n: 5 }], total: 100 })
    await run2
    expect(scope.getState(model.$error)).toBeNull()
    expect(scope.getState(model.$rows)).toEqual([{ id: 'p5', n: 5 }])
    expect(scope.getState(model.$state)).toBe('ready')
  })

  it('поздний ответ на старый фильтр не перезаписывает ответ на новый', async () => {
    const calls: Array<{ q: GridQuery; ok: (p: GridPage<Row>) => void }> = []
    const fetchFx = createEffect<GridQuery, GridPage<Row>>((q) => new Promise((ok) => { calls.push({ q, ok }) }))
    const { model, $filter } = mk({ fetchFx })
    const scope = fork()
    const f: Filter = [{ field: 'status', op: 'EQ', value: 'ERROR' }]
    const run = Promise.all([allSettled(model.refresh, { scope }), allSettled($filter, { scope, params: f })])
    await flush()
    expect(calls.map((c) => c.q.filter)).toEqual([[], f])
    calls[1]!.ok({ rows: [{ id: 'new', n: 1 }], total: 1 })
    await flush()
    calls[0]!.ok({ rows: [{ id: 'old', n: 0 }], total: 999 })
    await run
    expect(scope.getState(model.$rows)).toEqual([{ id: 'new', n: 1 }])
    expect(scope.getState(model.$total)).toBe(1)
  })

  it('две модели на одном fetchFx не получают ответы и pending друг друга', async () => {
    const releases: Array<() => void> = []
    const fetchFx = createEffect<GridQuery, GridPage<Row>>((q) => new Promise((ok) => {
      releases.push(() => ok({ rows: [{ id: q.filter.length ? 'B' : 'A', n: 0 }], total: q.filter.length ? 2 : 1 }))
    }))
    const a = mk({ fetchFx })
    const b = mk({ fetchFx, $filter: createStore<Filter>([{ field: 'x', op: 'EQ', value: 1 }]) })
    const scope = fork()
    const la = allSettled(a.model.refresh, { scope }); await flush(); releases.shift()!(); await la
    const lb = allSettled(b.model.refresh, { scope }); await flush(); releases.shift()!(); await lb
    expect(scope.getState(a.model.$rows)).toEqual([{ id: 'A', n: 0 }])
    expect(scope.getState(b.model.$rows)).toEqual([{ id: 'B', n: 0 }])
    const ra = allSettled(a.model.refresh, { scope })
    await flush()
    expect(scope.getState(a.model.$state)).toBe('refreshing')
    expect(scope.getState(b.model.$state)).toBe('ready')              // pending не общий
    releases.shift()!(); await ra
    expect(scope.getState(b.model.$rows)).toEqual([{ id: 'B', n: 0 }]) // ответ модели A не попал в B
    expect(scope.getState(b.model.$total)).toBe(2)
    expect(scope.getState(a.model.$total)).toBe(1)
  })

  it('refreshing: пока идёт повторный запрос при наличии данных', async () => {
    let release: () => void = () => {}
    const fetchFx = createEffect<GridQuery, GridPage<Row>>(() => new Promise((r) => { release = () => r({ rows: [{ id: 'a', n: 1 }], total: 1 }) }))
    const { model } = mk({ fetchFx })
    const scope = fork()
    const first = allSettled(model.refresh, { scope })
    expect(scope.getState(model.$state)).toBe('loading')
    release(); await first
    const second = allSettled(model.refresh, { scope })
    expect(scope.getState(model.$state)).toBe('refreshing')
    release(); await second
    expect(scope.getState(model.$state)).toBe('ready')
  })
})

describe('фасеты', () => {
  const mkFacets = (results: Array<{ value: string; count: number }[]> = [[{ value: 'A', count: 2 }]]) => {
    const calls: FacetsQuery[] = []
    let release: Array<() => void> = []
    const facetsFetchFx = createEffect<FacetsQuery, Facet[]>((q) => {
      calls.push(q)
      const r = results[Math.min(calls.length - 1, results.length - 1)]!
      return new Promise<Facet[]>((res) => { release.push(() => res(r)) })
    })
    /** Отпустить все висящие запросы; newestFirst — в обратном порядке, чтобы устаревший ответ пришёл последним. */
    const releaseAll = async (newestFirst = false) => {
      const r = newestFirst ? release.reverse() : release
      release = []
      r.forEach((f) => f())
      await flush()
    }
    return { facetsFetchFx, calls, releaseAll }
  }

  it('без конфигурации фасетов: $facets пуст, запросов нет', async () => {
    const { model } = mk()
    const scope = fork()
    await allSettled(model.refresh, { scope })
    expect(scope.getState(model.$facets)).toEqual([])
  })
  it('смена фильтра и refresh → запрос фасетов по фильтру без условия поля лейна; страница — нет', async () => {
    const f = mkFacets()
    const { model, $filter } = mk({ facets: { field: 'status', fetchFx: f.facetsFetchFx } })
    const scope = fork()
    const p = allSettled($filter, { scope, params: [{ field: 'status', op: 'EQ', value: 'A' }, { field: 'amount', op: 'GT', value: 1 }] })
    await f.releaseAll(); await p
    expect(f.calls).toEqual([{ filter: [{ field: 'amount', op: 'GT', value: 1 }], field: 'status' }])
    expect(scope.getState(model.$facets)).toEqual([{ value: 'A', count: 2 }])
    const p2 = allSettled(model.setPage, { scope, params: 2 })
    await f.releaseAll(); await p2
    expect(f.calls).toHaveLength(1)
    const p3 = allSettled(model.refresh, { scope })
    await f.releaseAll(); await p3
    expect(f.calls).toHaveLength(2)
  })
  it('устаревший ответ фасетов отбрасывается; отказ не трогает $facets и $state', async () => {
    const f = mkFacets([[{ value: 'A', count: 1 }], [{ value: 'A', count: 5 }]])
    const { model, $filter } = mk({ facets: { field: 'status', fetchFx: f.facetsFetchFx } })
    const scope = fork()
    const p1 = allSettled($filter, { scope, params: [{ field: 'amount', op: 'GT', value: 1 }] })
    const p2 = allSettled($filter, { scope, params: [{ field: 'amount', op: 'GT', value: 2 }] })
    // второй запрос отпускаем первым, потом первый (устаревший)
    await f.releaseAll(true); await Promise.all([p1, p2])
    expect(scope.getState(model.$facets)).toEqual([{ value: 'A', count: 5 }])
    const failing = createEffect<FacetsQuery, Facet[]>(async () => { throw new Error('нет') })
    const { model: m2, $filter: $f2 } = mk({ facets: { field: 'status', fetchFx: failing } })
    const scope2 = fork()
    await allSettled($f2, { scope: scope2, params: [{ field: 'amount', op: 'GT', value: 1 }] })
    expect(scope2.getState(m2.$facets)).toEqual([])
    expect(scope2.getState(m2.$state)).toBe('ready')
  })
})
