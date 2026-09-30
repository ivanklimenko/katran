import { allSettled, createEffect, createEvent, createStore, fork } from 'effector'
import { createFiltersModel } from './createFiltersModel'
import type { Condition, FilterMeta, SuggestQuery } from './types'

describe('createFiltersModel', () => {
  it('meta значением: $meta отдаёт его; meta стором: $meta следует за стором', async () => {
    const fixed = { fields: [{ id: 'a', label: 'А', type: 'STRING' as const, ops: [] }] }
    expect(fork().getState(createFiltersModel({ meta: fixed }).$meta)).toEqual(fixed)
    expect(fork().getState(createFiltersModel().$meta)).toBeNull()
    const loaded = createEvent<FilterMeta>()
    const $src = createStore<FilterMeta | null>(null).on(loaded, (_, m) => m)
    const m = createFiltersModel({ meta: $src })
    const scope = fork()
    expect(scope.getState(m.$meta)).toBeNull()
    await allSettled(loaded, { scope, params: fixed })
    expect(scope.getState(m.$meta)).toEqual(fixed)
  })

  it('edit → черновик; apply → применённые; $dirty отражает разницу', async () => {
    const m = createFiltersModel()
    const scope = fork()
    await allSettled(m.edit, { scope, params: { field: 'status', op: 'IN', values: ['ERROR'] } })
    expect(scope.getState(m.$draft)).toEqual([{ field: 'status', op: 'IN', values: ['ERROR'] }])
    expect(scope.getState(m.$conditions)).toEqual([])
    expect(scope.getState(m.$dirty)).toBe(true)
    await allSettled(m.apply, { scope })
    expect(scope.getState(m.$conditions)).toEqual([{ field: 'status', op: 'IN', values: ['ERROR'] }])
    expect(scope.getState(m.$dirty)).toBe(false)
  })

  it('edit по тому же полю заменяет условие, discard убирает из черновика', async () => {
    const m = createFiltersModel()
    const scope = fork()
    await allSettled(m.edit, { scope, params: { field: 'amount', op: 'GT', value: 100 } })
    await allSettled(m.edit, { scope, params: { field: 'amount', op: 'BETWEEN', from: 1, to: 2 } })
    expect(scope.getState(m.$draft)).toEqual([{ field: 'amount', op: 'BETWEEN', from: 1, to: 2 }])
    await allSettled(m.discard, { scope, params: 'amount' })
    expect(scope.getState(m.$draft)).toEqual([])
  })

  it('remove снимает применённое условие и из черновика; reset чистит всё', async () => {
    const m = createFiltersModel({ initial: [{ field: 'a', op: 'EQ', value: 1 }, { field: 'b', op: 'IS_EMPTY' }] })
    const scope = fork()
    expect(scope.getState(m.$conditions)).toHaveLength(2)
    await allSettled(m.remove, { scope, params: 'a' })
    expect(scope.getState(m.$conditions)).toEqual([{ field: 'b', op: 'IS_EMPTY' }])
    expect(scope.getState(m.$draft)).toEqual([{ field: 'b', op: 'IS_EMPTY' }])
    await allSettled(m.reset, { scope })
    expect(scope.getState(m.$conditions)).toEqual([])
    expect(scope.getState(m.$draft)).toEqual([])
  })

  it('remove применённого поля не затирает неприменённую правку другого поля в черновике', async () => {
    const m = createFiltersModel({ initial: [{ field: 'a', op: 'EQ', value: 1 }, { field: 'b', op: 'EQ', value: 2 }] })
    const scope = fork()
    await allSettled(m.edit, { scope, params: { field: 'a', op: 'EQ', value: 42 } })
    await allSettled(m.remove, { scope, params: 'b' })
    expect(scope.getState(m.$conditions)).toEqual([{ field: 'a', op: 'EQ', value: 1 }])
    expect(scope.getState(m.$draft)).toEqual([{ field: 'a', op: 'EQ', value: 42 }])
    expect(scope.getState(m.$dirty)).toBe(true)
  })

  it('две модели независимы (фабрика, не синглтон)', async () => {
    const a = createFiltersModel(), b = createFiltersModel()
    const scope = fork()
    await allSettled(a.edit, { scope, params: { field: 'x', op: 'EQ', value: 1 } })
    expect(scope.getState(b.$draft)).toEqual([])
  })

  describe('лейн и revert', () => {
    it('setLane ставит EQ по laneField сразу в применённые и черновик; null снимает; $lane следует', async () => {
      const m = createFiltersModel({ laneField: 'status' })
      const scope = fork()
      await allSettled(m.setLane, { scope, params: 'ERROR' })
      expect(scope.getState(m.$conditions)).toEqual([{ field: 'status', op: 'EQ', value: 'ERROR' }])
      expect(scope.getState(m.$draft)).toEqual([{ field: 'status', op: 'EQ', value: 'ERROR' }])
      expect(scope.getState(m.$lane)).toBe('ERROR')
      expect(scope.getState(m.$dirty)).toBe(false)
      await allSettled(m.setLane, { scope, params: null })
      expect(scope.getState(m.$conditions)).toEqual([])
      expect(scope.getState(m.$lane)).toBeNull()
    })
    it('setLane не трогает неприменённую правку другого поля', async () => {
      const m = createFiltersModel({ laneField: 'status' })
      const scope = fork()
      await allSettled(m.edit, { scope, params: { field: 'amount', op: 'GT', value: 1 } })
      await allSettled(m.setLane, { scope, params: 'DONE' })
      expect(scope.getState(m.$draft)).toEqual([{ field: 'amount', op: 'GT', value: 1 }, { field: 'status', op: 'EQ', value: 'DONE' }])
      expect(scope.getState(m.$conditions)).toEqual([{ field: 'status', op: 'EQ', value: 'DONE' }])
      expect(scope.getState(m.$dirty)).toBe(true)
    })
    it('$lane: снятие чипа и reset дают null; IN по полю лейна — тоже null', async () => {
      const m = createFiltersModel({ laneField: 'status', initial: [{ field: 'status', op: 'EQ', value: 'DONE' }] })
      const scope = fork()
      expect(scope.getState(m.$lane)).toBe('DONE')
      await allSettled(m.remove, { scope, params: 'status' })
      expect(scope.getState(m.$lane)).toBeNull()
      await allSettled(m.edit, { scope, params: { field: 'status', op: 'IN', values: ['A', 'B'] } })
      await allSettled(m.apply, { scope })
      expect(scope.getState(m.$lane)).toBeNull()
      await allSettled(m.reset, { scope })
      expect(scope.getState(m.$conditions)).toEqual([])
    })
    it('без laneField setLane — no-op, $lane всегда null', async () => {
      const m = createFiltersModel()
      const scope = fork()
      await allSettled(m.setLane, { scope, params: 'X' })
      expect(scope.getState(m.$conditions)).toEqual([])
      expect(scope.getState(m.$lane)).toBeNull()
      expect(m.laneField).toBeNull()
    })
    it('revert: черновик ← применённые', async () => {
      const m = createFiltersModel({ initial: [{ field: 'a', op: 'EQ', value: 1 }] })
      const scope = fork()
      await allSettled(m.edit, { scope, params: { field: 'b', op: 'EQ', value: 2 } })
      await allSettled(m.edit, { scope, params: { field: 'a', op: 'EQ', value: 9 } })
      expect(scope.getState(m.$dirty)).toBe(true)
      await allSettled(m.revert, { scope })
      expect(scope.getState(m.$draft)).toEqual([{ field: 'a', op: 'EQ', value: 1 }])
      expect(scope.getState(m.$dirty)).toBe(false)
    })
  })
})

describe('setField: несколько условий на поле (контракт §4.4 — AND)', () => {
  const a1: Condition = { field: 'purpose', op: 'CONTAINS', value: 'счёт не найден' }
  const a2: Condition = { field: 'purpose', op: 'CONTAINS', value: 'инструкция инвалидна' }
  const b: Condition = { field: 'status', op: 'EQ', value: 'ERROR' }
  it('заменяет все условия поля, место поля в порядке сохраняется', async () => {
    const m = createFiltersModel({ initial: [{ field: 'purpose', op: 'CONTAINS', value: 'x' }, b] })
    const scope = fork()
    await allSettled(m.setField, { scope, params: { field: 'purpose', conditions: [a1, a2] } })
    expect(scope.getState(m.$draft)).toEqual([a1, a2, b])
    await allSettled(m.edit, { scope, params: { field: 'purpose', op: 'CONTAINS', value: 'y' } })
    expect(scope.getState(m.$draft)).toEqual([{ field: 'purpose', op: 'CONTAINS', value: 'y' }, b])
    await allSettled(m.setField, { scope, params: { field: 'purpose', conditions: [] } })
    expect(scope.getState(m.$draft)).toEqual([b])
  })
  it('новое поле — в конец; remove снимает все условия поля', async () => {
    const m = createFiltersModel({ initial: [b] })
    const scope = fork()
    await allSettled(m.setField, { scope, params: { field: 'purpose', conditions: [a1, a2] } })
    await allSettled(m.apply, { scope })
    expect(scope.getState(m.$conditions)).toEqual([b, a1, a2])
    await allSettled(m.remove, { scope, params: 'purpose' })
    expect(scope.getState(m.$conditions)).toEqual([b])
  })
  it('$lane — только при одном условии EQ по полю лейна', async () => {
    const m = createFiltersModel({ laneField: 'status' })
    const scope = fork()
    await allSettled(m.setLane, { scope, params: 'ERROR' })
    expect(scope.getState(m.$lane)).toBe('ERROR')
    await allSettled(m.setField, { scope, params: { field: 'status', conditions: [b, { field: 'status', op: 'NE', value: 'DONE' }] } })
    await allSettled(m.apply, { scope })
    expect(scope.getState(m.$lane)).toBeNull()
  })
})

describe('подсказки', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })
  const initial: Condition[] = [{ field: 'status', op: 'EQ', value: 'ERROR' }, { field: 'f50name', op: 'CONTAINS', value: 'x' }]
  const mk = (impl: (q: SuggestQuery) => Promise<string[]> = async (q) => [`${q.query}-1`]) => {
    const calls: SuggestQuery[] = []
    const fetchFx = createEffect<SuggestQuery, string[]>((q) => { calls.push(q); return impl(q) })
    return { m: createFiltersModel({ initial, suggest: { fetchFx } }), calls }
  }

  it('без конфигурации — $suggest всегда null', async () => {
    const m = createFiltersModel()
    const scope = fork()
    await allSettled(m.suggest, { scope, params: { field: 'a', query: 'b' } })
    expect(scope.getState(m.$suggest)).toBeNull()
  })
  it('короче minChars — пусто, без запроса', async () => {
    const { m, calls } = mk()
    const scope = fork()
    await allSettled(m.suggest, { scope, params: { field: 'f50name', query: ' ' } })
    expect(scope.getState(m.$suggest)).toEqual({ field: 'f50name', query: ' ', items: [], loading: false })
    expect(calls).toEqual([])
  })
  it('задержка: один запрос с последним текстом, фильтр без условий поля, limit', async () => {
    const { m, calls } = mk()
    const scope = fork()
    const p1 = allSettled(m.suggest, { scope, params: { field: 'f50name', query: 'ва' } })
    await vi.advanceTimersByTimeAsync(100)
    const p2 = allSettled(m.suggest, { scope, params: { field: 'f50name', query: 'вас ' } })
    expect(scope.getState(m.$suggest)).toEqual({ field: 'f50name', query: 'вас ', items: [], loading: true })
    await vi.advanceTimersByTimeAsync(300)
    await Promise.all([p1, p2])
    expect(calls).toEqual([{ field: 'f50name', query: 'вас', filter: [{ field: 'status', op: 'EQ', value: 'ERROR' }], limit: 10 }])
    expect(scope.getState(m.$suggest)).toEqual({ field: 'f50name', query: 'вас ', items: ['вас-1'], loading: false })
  })
  it('устаревший ответ отбрасывается', async () => {
    const release: Record<string, (v: string[]) => void> = {}
    const { m } = mk((q) => new Promise<string[]>((r) => { release[q.query] = r }))
    const scope = fork()
    const p1 = allSettled(m.suggest, { scope, params: { field: 'f50name', query: 'ва' } })
    await vi.advanceTimersByTimeAsync(260)
    const p2 = allSettled(m.suggest, { scope, params: { field: 'f50name', query: 'вас' } })
    await vi.advanceTimersByTimeAsync(260)
    release['вас']!(['новый'])
    release['ва']!(['старый'])
    await Promise.all([p1, p2])
    expect(scope.getState(m.$suggest)?.items).toEqual(['новый'])
  })
  it('closeSuggest — null, поздний ответ отбрасывается; ошибка — пусто без загрузки', async () => {
    const release: Array<(v: string[]) => void> = []
    const { m } = mk(() => new Promise<string[]>((r) => { release.push(r) }))
    const scope = fork()
    const p = allSettled(m.suggest, { scope, params: { field: 'f50name', query: 'ва' } })
    await vi.advanceTimersByTimeAsync(260)
    // allSettled ждёт и висящий запрос, поэтому ответ отдаём до ожидания
    const closed = allSettled(m.closeSuggest, { scope })
    expect(scope.getState(m.$suggest)).toBeNull()
    release[0]!(['поздно'])
    await Promise.all([p, closed])
    expect(scope.getState(m.$suggest)).toBeNull()

    const { m: m2 } = mk(async () => { throw new Error('нет') })
    const s2 = fork()
    const p2 = allSettled(m2.suggest, { scope: s2, params: { field: 'f50name', query: 'ва' } })
    await vi.advanceTimersByTimeAsync(260)
    await p2
    expect(s2.getState(m2.$suggest)).toEqual({ field: 'f50name', query: 'ва', items: [], loading: false })
  })
})
