import { allSettled, createEffect, createStore, fork } from 'effector'
import { createGridModel } from './createGridModel'
import { memoryPersist } from './persist'
import type { Filter, GridPage, GridQuery } from './types'

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
