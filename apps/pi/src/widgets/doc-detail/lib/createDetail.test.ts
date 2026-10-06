import { allSettled, createEffect, createStore, fork } from 'effector'
import { ApiError, type TabQuery } from '../../../shared/api'
import type { LeaveIntent } from '../../../shared/lib/detail'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { createDetail } from './createDetail'

type Doc = { id: string; n: number }

function setup(opts: { fail?: (id: string, call: number) => boolean; hold?: boolean } = {}) {
  const calls: string[] = []
  let release: (() => void) | null = null
  const detailFx = createEffect<string, Doc, ApiError>(async (id) => {
    calls.push(id)
    if (opts.hold) await new Promise<void>((r) => { release = r })
    if (opts.fail?.(id, calls.length)) throw new ApiError(500, null, 'Сбой сервера')
    return { id, n: calls.length }
  })
  const lifecycle = createPageLifecycle()
  const d = createDetail({ detailFx, lifecycle })
  const scope = fork()
  const open = (id: string, secondary = false) => allSettled(d.open, { scope, params: { id, secondary } })
  return { d, lifecycle, scope, calls, open, release: () => release?.() }
}

describe('createDetail (спека 2a §4.3)', () => {
  it('загрузка по слоту: loading → ready', async () => {
    const { d, scope, lifecycle, calls, release } = setup({ hold: true })
    await allSettled(lifecycle.pageOpened, { scope })
    const p = allSettled(d.open, { scope, params: { id: 'd1', secondary: false } })
    expect(scope.getState(d.$slots).a).toMatchObject({ slot: 'a', id: 'd1', tab: 'main', state: 'loading', data: null, error: null })
    expect(scope.getState(d.$slots).b).toBeNull()
    release()
    await p
    expect(scope.getState(d.$slots).a).toMatchObject({ state: 'ready', data: { id: 'd1', n: 1 } })
    expect(calls).toEqual(['d1'])
  })

  it('кэш по id: сдвиг B в A и повторное открытие не перезапрашивают', async () => {
    const { d, scope, lifecycle, calls, open } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    await open('d2', true)
    await allSettled(d.close, { scope, params: 'a' })
    expect(scope.getState(d.$slots).a).toMatchObject({ id: 'd2', state: 'ready' })
    await open('d1')
    expect(scope.getState(d.$slots).a).toMatchObject({ id: 'd1', state: 'ready', data: { n: 1 } })
    expect(calls).toEqual(['d1', 'd2'])
  })

  it('ошибка — состояние слота с текстом; retry — загрузка заново', async () => {
    const { d, scope, lifecycle, calls, open } = setup({ fail: (_id, call) => call === 1 })
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    expect(scope.getState(d.$slots).a).toMatchObject({ state: 'error', error: 'Сбой сервера', data: null })
    await allSettled(d.retry, { scope, params: 'a' })
    expect(scope.getState(d.$slots).a).toMatchObject({ state: 'ready', error: null })
    expect(calls).toEqual(['d1', 'd1'])
  })

  it('retry пустого слота ничего не делает', async () => {
    const { d, scope, lifecycle, calls } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(d.retry, { scope, params: 'b' })
    expect(calls).toEqual([])
  })

  it('уже открытый документ: запроса нет, счётчик фокуса по id растёт', async () => {
    const { d, scope, lifecycle, calls, open } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    await open('d1', true)
    await open('d1')
    expect(scope.getState(d.$focus)).toEqual({ d1: 2 })
    expect(calls).toEqual(['d1'])
  })

  it('$marks: какая запись открыта в A и в B', async () => {
    const { d, scope, lifecycle, open } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    await open('d2', true)
    expect(scope.getState(d.$marks)).toEqual({ d1: 'a', d2: 'b' })
  })

  it('pageClosed закрывает оба и чистит кэш: при возврате — новый запрос', async () => {
    const { d, scope, lifecycle, calls, open } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    await open('d2', true)
    await allSettled(lifecycle.pageClosed, { scope })
    expect(scope.getState(d.$slots)).toEqual({ a: null, b: null })
    expect(scope.getState(d.$focus)).toEqual({})
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    expect(calls).toEqual(['d1', 'd2', 'd1'])
  })

  it('ответ после ухода с экрана в кэш не попадает', async () => {
    const { d, scope, lifecycle, calls, release } = setup({ hold: true })
    await allSettled(lifecycle.pageOpened, { scope })
    const opening = allSettled(d.open, { scope, params: { id: 'd1', secondary: false } })
    const closing = allSettled(lifecycle.pageClosed, { scope })
    release()
    await Promise.all([opening, closing])
    await allSettled(lifecycle.pageOpened, { scope })
    const again = allSettled(d.open, { scope, params: { id: 'd1', secondary: false } })
    expect(scope.getState(d.$slots).a?.state).toBe('loading')
    release()
    await again
    expect(calls).toEqual(['d1', 'd1'])
  })

  it('quiet-открытие помечается в $quiet; снимается закрытием слота и уходом с экрана', async () => {
    const { d, scope, lifecycle } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(d.open, { scope, params: { id: 'd1', secondary: false, quiet: true } })
    expect(scope.getState(d.$quiet)).toEqual({ d1: true })
    await allSettled(d.open, { scope, params: { id: 'd2', secondary: true } })
    expect(scope.getState(d.$quiet)).toEqual({ d1: true })
    await allSettled(d.close, { scope, params: 'a' })
    expect(scope.getState(d.$quiet)).toEqual({})
    await allSettled(d.open, { scope, params: { id: 'd3', secondary: false, quiet: true } })
    await allSettled(lifecycle.pageClosed, { scope })
    expect(scope.getState(d.$quiet)).toEqual({})
  })

  it('quiet-открытие уже открытого не запрашивает фокус; открытие пользователем — запрашивает', async () => {
    const { d, scope, lifecycle, open } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    await allSettled(d.open, { scope, params: { id: 'd1', secondary: false, quiet: true } })
    expect(scope.getState(d.$focus)).toEqual({})
    await open('d1')
    expect(scope.getState(d.$focus)).toEqual({ d1: 1 })
  })

  it('R11: закрытие A при открытом B — фокус в заголовок оставшегося (B сдвинут в A)', async () => {
    const { d, scope, lifecycle, open } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    await open('d2', true)
    await allSettled(d.close, { scope, params: 'a' })
    expect(scope.getState(d.$slots).a?.id).toBe('d2')
    expect(scope.getState(d.$focus)).toEqual({ d2: 1 })
    // закрытие B и закрытие единственного A фокус оставшемуся не запрашивают
    await open('d3', true)
    await allSettled(d.close, { scope, params: 'b' })
    await allSettled(d.close, { scope, params: 'a' })
    expect(scope.getState(d.$focus)).toEqual({ d2: 1 })
  })
})

/** Порт с ручным ответом на каждый вызов: гонки — в явном порядке. */
function setupManual() {
  const calls: { id: string; ok: () => void; fail: () => void }[] = []
  let n = 0
  const detailFx = createEffect<string, Doc, ApiError>((id) => new Promise<Doc>((res, rej) => {
    const call = ++n
    calls.push({ id, ok: () => res({ id, n: call }), fail: () => rej(new ApiError(500, null, 'Сбой сервера')) })
  }))
  const lifecycle = createPageLifecycle()
  const d = createDetail({ detailFx, lifecycle })
  const scope = fork()
  const open = (id: string, secondary = false) => allSettled(d.open, { scope, params: { id, secondary } })
  const tick = () => new Promise<void>((r) => setTimeout(r, 0))
  return { d, lifecycle, scope, calls, open, tick }
}

describe('createDetail: гонки запросов (I3)', () => {
  it('A переоткрыт другим id, пока первый запрос висит: слот — новый документ, старый ответ его не трогает', async () => {
    const { d, scope, lifecycle, calls, open, tick } = setupManual()
    await allSettled(lifecycle.pageOpened, { scope })
    void open('d1')
    void open('d2')
    expect(calls.map((c) => c.id)).toEqual(['d1', 'd2'])
    expect(scope.getState(d.$slots).a).toMatchObject({ id: 'd2', state: 'loading' })
    calls[0]!.ok()
    await tick()
    expect(scope.getState(d.$slots).a).toMatchObject({ id: 'd2', state: 'loading', data: null })
    calls[1]!.ok()
    await tick()
    expect(scope.getState(d.$slots).a).toMatchObject({ id: 'd2', state: 'ready', data: { id: 'd2', n: 2 } })
    // ответ d1 лёг в кэш своего id: повторное открытие без запроса
    await open('d1')
    expect(scope.getState(d.$slots).a).toMatchObject({ id: 'd1', state: 'ready', data: { n: 1 } })
    expect(calls).toHaveLength(2)
  })

  it('уход и возврат при висящем запросе: старый отказ не ставит ошибку, старый finally не снимает новую загрузку', async () => {
    const { d, scope, lifecycle, calls, open, tick } = setupManual()
    await allSettled(lifecycle.pageOpened, { scope })
    void open('d1')
    // allSettled ждёт все эффекты скоупа — с висящим запросом не дожидаемся, события применяются синхронно
    void allSettled(lifecycle.pageClosed, { scope })
    void allSettled(lifecycle.pageOpened, { scope })
    void open('d1')
    expect(calls.map((c) => c.id)).toEqual(['d1', 'd1'])
    calls[0]!.fail()
    await tick()
    expect(scope.getState(d.$slots).a).toMatchObject({ id: 'd1', state: 'loading', error: null })
    // загрузка нового визита не снята: retry не шлёт второй запрос поверх висящего
    void allSettled(d.retry, { scope, params: 'a' })
    await tick()
    expect(calls).toHaveLength(2)
    calls[1]!.ok()
    await tick()
    expect(scope.getState(d.$slots).a).toMatchObject({ id: 'd1', state: 'ready', data: { n: 2 } })
  })

  it('уход и возврат при висящем запросе: старый успешный ответ не кладётся в кэш нового визита', async () => {
    const { d, scope, lifecycle, calls, open, tick } = setupManual()
    await allSettled(lifecycle.pageOpened, { scope })
    void open('d1')
    // allSettled ждёт все эффекты скоупа — с висящим запросом не дожидаемся, события применяются синхронно
    void allSettled(lifecycle.pageClosed, { scope })
    void allSettled(lifecycle.pageOpened, { scope })
    void open('d1')
    calls[0]!.ok()
    await tick()
    expect(scope.getState(d.$slots).a).toMatchObject({ id: 'd1', state: 'loading', data: null })
    calls[1]!.ok()
    await tick()
    expect(scope.getState(d.$slots).a).toMatchObject({ state: 'ready', data: { n: 2 } })
  })
})

/** Деталь отвечает сразу (или висит), вкладки — ручным ответом на каждый вызов: гонки вкладок в явном порядке (спека 2b §3.3). */
function setupTabs(opts: { localTabs?: string[]; holdDetail?: boolean } = {}) {
  const tabCalls: { id: string; tab: string; ok: (data?: unknown) => void; fail: (message?: string) => void }[] = []
  const detailFx = createEffect<string, Doc, ApiError>((id) => (opts.holdDetail ? new Promise<Doc>(() => {}) : Promise.resolve({ id, n: 0 })))
  const tabFx = createEffect<TabQuery, unknown, ApiError>((q) => new Promise<unknown>((res, rej) => {
    tabCalls.push({
      id: q.id,
      tab: q.tab,
      ok: (data: unknown = { rows: [] }) => res(data),
      fail: (message = 'Сбой сервера: вкладка') => rej(new ApiError(500, null, message)),
    })
  }))
  const lifecycle = createPageLifecycle()
  const d = createDetail({ detailFx, tabFx, lifecycle, ...(opts.localTabs ? { localTabs: opts.localTabs } : {}) })
  const scope = fork()
  // allSettled ждёт все эффекты скоупа — с висящими запросами не дожидаемся: события применяются синхронно
  const open = (id: string, secondary = false) => { void allSettled(d.open, { scope, params: { id, secondary } }) }
  const tab = (slot: 'a' | 'b', t: string) => { void allSettled(d.setTab, { scope, params: { slot, tab: t } }) }
  const a = () => scope.getState(d.$slots).a
  const calls = () => tabCalls.map((c) => `${c.id}:${c.tab}`)
  const tick = () => new Promise<void>((r) => setTimeout(r, 0))
  return { d, lifecycle, scope, tabCalls, calls, open, tab, a, tick }
}

describe('createDetail: ленивые вкладки (спека 2b §3.3)', () => {
  it('локальная вкладка не запрашивается; нелокальная — при активации: loading → ready', async () => {
    const { scope, lifecycle, tabCalls, calls, open, tab, a, tick } = setupTabs()
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    await tick()
    expect(a()).toMatchObject({ tab: 'main', state: 'ready', tabView: null })
    expect(calls()).toEqual([])
    tab('a', 'statuses')
    expect(calls()).toEqual(['d1:statuses'])
    expect(a()).toMatchObject({ tab: 'statuses', state: 'ready', tabView: { state: 'loading', data: null, error: null } })
    tabCalls[0]!.ok({ rows: ['s1'] })
    await tick()
    expect(a()?.tabView).toEqual({ state: 'ready', data: { rows: ['s1'] }, error: null })
  })

  it('localTabs: перечисленные вкладки — из детали, без запроса; по умолчанию локальна только main', async () => {
    const own = setupTabs({ localTabs: ['main', 'extra'] })
    await allSettled(own.lifecycle.pageOpened, { scope: own.scope })
    own.open('d1')
    own.tab('a', 'extra')
    expect(own.calls()).toEqual([])
    expect(own.a()).toMatchObject({ tab: 'extra', tabView: null })
    const def = setupTabs()
    await allSettled(def.lifecycle.pageOpened, { scope: def.scope })
    def.open('d1')
    def.tab('a', 'extra')
    expect(def.calls()).toEqual(['d1:extra'])
  })

  it('без tabFx вкладки не грузятся: tabView — null', async () => {
    const { d, scope, lifecycle, open } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    await allSettled(d.setTab, { scope, params: { slot: 'a', tab: 'statuses' } })
    expect(scope.getState(d.$slots).a).toMatchObject({ tab: 'statuses', state: 'ready', tabView: null })
  })

  it('кэш id:tab — возврат на вкладку, B, сдвиг B в A и повторное открытие не перезапрашивают', async () => {
    const { d, scope, lifecycle, tabCalls, calls, open, tab, a, tick } = setupTabs()
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    tabCalls[0]!.ok()
    tab('a', 'audit')
    tabCalls[1]!.ok()
    await tick()
    tab('a', 'statuses')
    expect(a()?.tabView?.state).toBe('ready')
    open('d2', true)
    tab('b', 'statuses')
    tabCalls[2]!.ok()
    await tick()
    expect(calls()).toEqual(['d1:statuses', 'd1:audit', 'd2:statuses'])
    // закрытие A сдвигает B (d2 на «Статусах») в A — из кэша
    void allSettled(d.close, { scope, params: 'a' })
    expect(a()).toMatchObject({ id: 'd2', tab: 'statuses', tabView: { state: 'ready' } })
    // d1 снова открыт — на «Общих»; его «Аудит» — из кэша
    open('d1')
    tab('a', 'audit')
    expect(a()).toMatchObject({ id: 'd1', tab: 'audit', tabView: { state: 'ready' } })
    expect(calls()).toHaveLength(3)
  })

  it('гонка: быстрое переключение — слот показывает активную вкладку; ответ другой вкладки ложится в её кэш', async () => {
    const { scope, lifecycle, tabCalls, calls, open, tab, a, tick } = setupTabs()
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    tab('a', 'audit')
    tab('a', 'statuses')
    // «Статусы» уже грузятся — второй запрос поверх висящего не уходит
    expect(calls()).toEqual(['d1:statuses', 'd1:audit'])
    tabCalls[1]!.ok({ rows: ['audit'] })
    await tick()
    expect(a()).toMatchObject({ tab: 'statuses', tabView: { state: 'loading', data: null } })
    tabCalls[0]!.ok({ rows: ['statuses'] })
    await tick()
    expect(a()).toMatchObject({ tab: 'statuses', tabView: { state: 'ready', data: { rows: ['statuses'] } } })
    tab('a', 'audit')
    expect(a()).toMatchObject({ tab: 'audit', tabView: { state: 'ready', data: { rows: ['audit'] } } })
    expect(calls()).toHaveLength(2)
  })

  it('счётчик визитов: отказ, висевший при уходе с экрана, новый визит не трогает; его finally не снимает новую загрузку', async () => {
    const { d, scope, lifecycle, tabCalls, calls, open, tab, a, tick } = setupTabs()
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    void allSettled(lifecycle.pageClosed, { scope })
    void allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    expect(calls()).toEqual(['d1:statuses', 'd1:statuses'])
    tabCalls[0]!.fail()
    await tick()
    expect(a()?.tabView).toEqual({ state: 'loading', data: null, error: null })
    void allSettled(d.retryTab, { scope, params: 'a' })
    expect(calls()).toHaveLength(2)
    tabCalls[1]!.ok({ rows: ['new'] })
    await tick()
    expect(a()?.tabView).toEqual({ state: 'ready', data: { rows: ['new'] }, error: null })
  })

  it('счётчик визитов: успешный ответ прошлого визита в кэш нового не кладётся', async () => {
    const { scope, lifecycle, tabCalls, open, tab, a, tick } = setupTabs()
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    void allSettled(lifecycle.pageClosed, { scope })
    void allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    tabCalls[0]!.ok({ rows: ['old'] })
    await tick()
    expect(a()?.tabView).toEqual({ state: 'loading', data: null, error: null })
    tabCalls[1]!.ok({ rows: ['new'] })
    await tick()
    expect(a()?.tabView).toEqual({ state: 'ready', data: { rows: ['new'] }, error: null })
  })

  it('ошибка вкладки — своё состояние с текстом, деталь не тронута; retryTab — новый запрос', async () => {
    const { d, scope, lifecycle, tabCalls, calls, open, tab, a, tick } = setupTabs()
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    await tick()
    tab('a', 'audit')
    tabCalls[0]!.fail('Сбой сервера: Регулятор ?fail=tab:audit')
    await tick()
    expect(a()).toMatchObject({
      state: 'ready', data: { id: 'd1' }, error: null,
      tabView: { state: 'error', data: null, error: 'Сбой сервера: Регулятор ?fail=tab:audit' },
    })
    void allSettled(d.retryTab, { scope, params: 'a' })
    expect(a()?.tabView).toEqual({ state: 'loading', data: null, error: null })
    tabCalls[1]!.ok({ rows: [] })
    await tick()
    expect(a()?.tabView).toEqual({ state: 'ready', data: { rows: [] }, error: null })
    // готовая вкладка, пустой слот и локальная вкладка — без запроса
    void allSettled(d.retryTab, { scope, params: 'a' })
    void allSettled(d.retryTab, { scope, params: 'b' })
    tab('a', 'main')
    void allSettled(d.retryTab, { scope, params: 'a' })
    expect(calls()).toEqual(['d1:audit', 'd1:audit'])
  })

  it('возврат на вкладку с ошибкой — новый запрос (как повторное открытие детали после ошибки)', async () => {
    const { scope, lifecycle, tabCalls, calls, open, tab, a, tick } = setupTabs()
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    tabCalls[0]!.fail()
    await tick()
    expect(a()?.tabView?.state).toBe('error')
    tab('a', 'main')
    tab('a', 'statuses')
    expect(calls()).toEqual(['d1:statuses', 'd1:statuses'])
    expect(a()?.tabView).toEqual({ state: 'loading', data: null, error: null })
  })

  it('вкладка не ждёт детали: деталь ещё грузится — вкладка запрошена и готова', async () => {
    const { scope, lifecycle, tabCalls, calls, open, tab, a, tick } = setupTabs({ holdDetail: true })
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    expect(calls()).toEqual(['d1:statuses'])
    tabCalls[0]!.ok({ rows: ['s'] })
    await tick()
    expect(a()).toMatchObject({ state: 'loading', data: null, tabView: { state: 'ready', data: { rows: ['s'] } } })
  })

  it('$expanded: ключ id:tab; переживает переключение вкладки и закрытие drawer; pageClosed очищает', async () => {
    const { d, scope, lifecycle, open, tab } = setupTabs()
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    void allSettled(d.setExpanded, { scope, params: { id: 'd1', tab: 'linked', keys: ['L2'] } })
    void allSettled(d.setExpanded, { scope, params: { id: 'd1', tab: 'main', keys: ['50'] } })
    tab('a', 'statuses')
    void allSettled(d.close, { scope, params: 'a' })
    expect(scope.getState(d.$expanded)).toEqual({ 'd1:linked': ['L2'], 'd1:main': ['50'] })
    void allSettled(lifecycle.pageClosed, { scope })
    expect(scope.getState(d.$expanded)).toEqual({})
  })

  it('pageClosed чистит кэш вкладок: при возврате — новый запрос', async () => {
    const { scope, lifecycle, tabCalls, calls, open, tab, tick } = setupTabs()
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    tabCalls[0]!.ok()
    await tick()
    void allSettled(lifecycle.pageClosed, { scope })
    void allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    expect(calls()).toEqual(['d1:statuses', 'd1:statuses'])
  })
})

/**
 * Правка (план 2c, Р5–Р6): деталь — сразу или висит до ручного ответа (hold), вкладки — сразу, сбой вкладки по ключу id:tab.
 * Запросы ухода — журналом-стором.
 */
function setupEdit(opts: { guard?: boolean; failTab?: string; failDetail?: boolean } = {}) {
  let n = 0
  let hold = false
  let failDetail = opts.failDetail === true
  const pending: (() => void)[] = []
  const detailCalls: string[] = []
  const detailFx = createEffect<string, Doc, ApiError>((id) => {
    detailCalls.push(id)
    if (failDetail) return Promise.reject(new ApiError(500, null, 'Сбой сервера'))
    const doc = { id, n: ++n }
    return hold ? new Promise<Doc>((r) => { pending.push(() => r(doc)) }) : Promise.resolve(doc)
  })
  const tabCalls: string[] = []
  const tabFx = createEffect<TabQuery, unknown, ApiError>(async (q) => {
    tabCalls.push(`${q.id}:${q.tab}`)
    if (opts.failTab === `${q.id}:${q.tab}`) throw new ApiError(500, null, 'Сбой сервера: вкладка')
    return { rows: [`${q.tab} ${q.id} ${tabCalls.length}`] }
  })
  const lifecycle = createPageLifecycle()
  const d = createDetail({ detailFx, tabFx, lifecycle, ...(opts.guard ? { guard: true } : {}) })
  const $requests = createStore<{ docId: string; intent: LeaveIntent }[]>([]).on(d.leaveRequested, (l, r) => [...l, r])
  const scope = fork()
  const open = (id: string, secondary = false) => allSettled(d.open, { scope, params: { id, secondary } })
  const tab = (slot: 'a' | 'b', t: string) => allSettled(d.setTab, { scope, params: { slot, tab: t } })
  const ids = () => { const st = scope.getState(d.$slots); return { a: st.a?.id ?? null, b: st.b?.id ?? null } }
  const requests = () => scope.getState($requests)
  return {
    d, lifecycle, scope, open, tab, ids, requests, detailCalls, tabCalls,
    hold: (v: boolean) => { hold = v },
    failDetail: (v: boolean) => { failDetail = v },
    release: () => { pending.splice(0).forEach((r) => r()) },
  }
}

describe('createDetail: правка — охрана ухода, replaceDetail, reloadDetail (план 2c, Р5–Р6)', () => {
  it('guard: close(a) с документом — leaveRequested, стек не меняется; leave выполняет', async () => {
    const { d, scope, lifecycle, open, ids, requests } = setupEdit({ guard: true })
    await allSettled(lifecycle.pageOpened, { scope })
    await open('u1'); await open('u2', true)
    await allSettled(d.close, { scope, params: 'a' })
    expect(requests()).toEqual([{ docId: 'u1', intent: { kind: 'close', slot: 'a' } }])
    expect(ids()).toEqual({ a: 'u1', b: 'u2' })
    await allSettled(d.leave, { scope, params: { kind: 'close', slot: 'a' } })
    expect(ids()).toEqual({ a: 'u2', b: null }) // сдвиг B→A — Review Focus 4
    expect(scope.getState(d.$focus)).toEqual({ u2: 1 })
  })

  it('guard: closeTop — запрос для верхнего; open в занятый A — запрос с docId занявшего; в пустой слот и уже открытый — сразу', async () => {
    const { d, scope, lifecycle, open, ids, requests, detailCalls } = setupEdit({ guard: true })
    await allSettled(lifecycle.pageOpened, { scope })
    // пустой стек: close и closeTop — ничего; secondary при пустом A ложится в A — сразу
    await allSettled(d.close, { scope, params: 'a' })
    await allSettled(d.closeTop, { scope })
    await open('u1', true)
    expect(ids()).toEqual({ a: 'u1', b: null })
    // B пуст — сразу
    await open('u2', true)
    expect(ids()).toEqual({ a: 'u1', b: 'u2' })
    expect(requests()).toEqual([])
    await allSettled(d.closeTop, { scope })
    expect(requests()).toEqual([{ docId: 'u2', intent: { kind: 'close', slot: 'b' } }])
    await open('u3')
    await open('u3', true)
    expect(requests().slice(1)).toEqual([
      { docId: 'u1', intent: { kind: 'open', open: { id: 'u3', secondary: false } } },
      { docId: 'u2', intent: { kind: 'open', open: { id: 'u3', secondary: true } } },
    ])
    expect(ids()).toEqual({ a: 'u1', b: 'u2' })
    // уже открытый (в любом слоте) — без запроса, фокус в его drawer
    await open('u2')
    expect(scope.getState(d.$focus)).toEqual({ u2: 1 })
    expect(requests()).toHaveLength(3)
    // leave открытия выполняет его: u3 в A, загрузка
    await allSettled(d.leave, { scope, params: { kind: 'open', open: { id: 'u3', secondary: false } } })
    expect(ids()).toEqual({ a: 'u3', b: 'u2' })
    expect(detailCalls).toEqual(['u1', 'u2', 'u3'])
    // уход с экрана закрывает всё без охраны
    await allSettled(lifecycle.pageClosed, { scope })
    expect(ids()).toEqual({ a: null, b: null })
    expect(requests()).toHaveLength(3)
  })

  it('без guard — как в 2b: close и open сразу, leaveRequested не бывает', async () => {
    const { d, scope, lifecycle, open, ids, requests } = setupEdit()
    await allSettled(lifecycle.pageOpened, { scope })
    await open('u1'); await open('u2', true)
    await open('u3', true)
    expect(ids()).toEqual({ a: 'u1', b: 'u3' })
    await allSettled(d.closeTop, { scope })
    expect(ids()).toEqual({ a: 'u1', b: null })
    await open('u4')
    expect(ids()).toEqual({ a: 'u4', b: null })
    await allSettled(d.close, { scope, params: 'a' })
    expect(ids()).toEqual({ a: null, b: null })
    // leave доступен и без охраны — выполняет уход
    await allSettled(d.leave, { scope, params: { kind: 'open', open: { id: 'u5', secondary: false } } })
    expect(ids()).toEqual({ a: 'u5', b: null })
    expect(requests()).toEqual([])
  })

  it('replaceDetail: деталь в кэше без запроса, ошибки вкладок и кэш вкладок документа сброшены, активная нелокальная вкладка перезапрошена', async () => {
    const { d, scope, lifecycle, open, tab, detailCalls, tabCalls } = setupEdit({ failTab: 'u1:audit' })
    await allSettled(lifecycle.pageOpened, { scope })
    await open('u1')
    await tab('a', 'statuses')
    await tab('a', 'audit')
    expect(scope.getState(d.$slots).a?.tabView).toMatchObject({ state: 'error' })
    await tab('a', 'statuses')
    await open('u2', true)
    await tab('b', 'statuses')
    expect(tabCalls).toEqual(['u1:statuses', 'u1:audit', 'u2:statuses'])
    await allSettled(d.replaceDetail, { scope, params: { id: 'u1', detail: { id: 'u1', n: 99 } } })
    expect(detailCalls).toEqual(['u1', 'u2'])
    expect(scope.getState(d.$slots).a).toMatchObject({ id: 'u1', state: 'ready', data: { id: 'u1', n: 99 } })
    // активная «Статусы» u1 — новым запросом; u2 не тронут
    expect(tabCalls).toEqual(['u1:statuses', 'u1:audit', 'u2:statuses', 'u1:statuses'])
    expect(scope.getState(d.$slots).a?.tabView).toEqual({ state: 'ready', data: { rows: ['statuses u1 4'] }, error: null })
    expect(scope.getState(d.$slots).b?.tabView).toEqual({ state: 'ready', data: { rows: ['statuses u2 3'] }, error: null })
    // ошибка «Аудита» u1 сброшена вместе с кэшем: возврат на вкладку — новый запрос
    await tab('a', 'main')
    await allSettled(d.replaceDetail, { scope, params: { id: 'u1', detail: { id: 'u1', n: 100 } } })
    expect(tabCalls).toHaveLength(4) // локальная активная вкладка — без запроса
    await tab('a', 'audit')
    expect(tabCalls).toEqual(['u1:statuses', 'u1:audit', 'u2:statuses', 'u1:statuses', 'u1:audit'])
  })

  it('replaceDetail снимает ошибку загрузки детали', async () => {
    const { d, scope, lifecycle, open } = setupEdit({ failDetail: true })
    await allSettled(lifecycle.pageOpened, { scope })
    await open('u1')
    expect(scope.getState(d.$slots).a).toMatchObject({ state: 'error' })
    await allSettled(d.replaceDetail, { scope, params: { id: 'u1', detail: { id: 'u1', n: 7 } } })
    expect(scope.getState(d.$slots).a).toMatchObject({ state: 'ready', data: { n: 7 }, error: null })
  })

  it('replaceDetail после ухода с экрана не пишет в кэш', async () => {
    const { d, scope, lifecycle, open, detailCalls } = setupEdit()
    await allSettled(lifecycle.pageOpened, { scope })
    await open('u1')
    await allSettled(lifecycle.pageClosed, { scope })
    await allSettled(d.replaceDetail, { scope, params: { id: 'u1', detail: { id: 'u1', n: 99 } } })
    await allSettled(lifecycle.pageOpened, { scope })
    await open('u1')
    // кэша нет — деталь запрошена заново, ответ сохранения в неё не попал
    expect(detailCalls).toEqual(['u1', 'u1'])
    expect(scope.getState(d.$slots).a).toMatchObject({ state: 'ready', data: { n: 2 } })
  })

  it('reloadDetail: запрос порта, слот остаётся ready со старой деталью до ответа', async () => {
    const { d, scope, lifecycle, open, detailCalls, hold, release } = setupEdit()
    await allSettled(lifecycle.pageOpened, { scope })
    await open('u1')
    hold(true)
    // allSettled ждёт все эффекты скоупа — промисы собираются заранее, ответ отпускается вручную (preflight D14)
    const first = allSettled(d.reloadDetail, { scope, params: 'u1' })
    expect(detailCalls).toEqual(['u1', 'u1'])
    expect(scope.getState(d.$slots).a).toMatchObject({ state: 'ready', data: { n: 1 }, error: null })
    // уже грузится — второй запрос не уходит
    const second = allSettled(d.reloadDetail, { scope, params: 'u1' })
    expect(detailCalls).toHaveLength(2)
    release()
    await Promise.all([first, second])
    expect(scope.getState(d.$slots).a).toMatchObject({ state: 'ready', data: { n: 2 } })
  })

  it('reloadDetail после ухода с экрана — без запроса', async () => {
    const { d, scope, lifecycle, open, detailCalls } = setupEdit()
    await allSettled(lifecycle.pageOpened, { scope })
    await open('u1')
    await allSettled(lifecycle.pageClosed, { scope })
    await allSettled(d.reloadDetail, { scope, params: 'u1' })
    expect(detailCalls).toEqual(['u1'])
  })
})

describe('createDetail: replaceDetail и летящие ответы (эпоха документа, fix 1)', () => {
  it('ответ вкладки, летевший до replaceDetail, кэш не заполняет; свежий запрос уходит сразу', async () => {
    const { d, scope, lifecycle, tabCalls, calls, open, tab, a, tick } = setupTabs()
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    expect(calls()).toEqual(['d1:statuses'])
    // allSettled ждёт все эффекты скоупа — с висящими запросами не дожидаемся (preflight D14)
    void allSettled(d.replaceDetail, { scope, params: { id: 'd1', detail: { id: 'd1', n: 9 } } })
    expect(calls()).toEqual(['d1:statuses', 'd1:statuses'])
    tabCalls[0]!.ok({ rows: ['до правки'] })
    await tick()
    expect(a()?.tabView).toEqual({ state: 'loading', data: null, error: null })
    tabCalls[1]!.ok({ rows: ['после правки'] })
    await tick()
    expect(a()?.tabView).toEqual({ state: 'ready', data: { rows: ['после правки'] }, error: null })
    // старый finally не снял загрузку нового, отказ старого не пишет ошибку: вызовов ровно два
    expect(calls()).toHaveLength(2)
  })

  it('отказ и finally вкладки старой эпохи не трогают загрузку новой', async () => {
    const { d, scope, lifecycle, tabCalls, calls, open, tab, a, tick } = setupTabs()
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    void allSettled(d.replaceDetail, { scope, params: { id: 'd1', detail: { id: 'd1', n: 9 } } })
    tabCalls[0]!.fail()
    await tick()
    expect(a()?.tabView).toEqual({ state: 'loading', data: null, error: null })
    void allSettled(d.retryTab, { scope, params: 'a' })
    expect(calls()).toHaveLength(2)
  })

  it('деталь, летевшая до replaceDetail (перезапрос), кэш не перезаписывает; загрузка снимается', async () => {
    const { d, scope, lifecycle, calls, open, tick } = setupManual()
    await allSettled(lifecycle.pageOpened, { scope })
    void open('d1')
    calls[0]!.ok()
    await tick()
    void allSettled(d.reloadDetail, { scope, params: 'd1' })
    expect(calls).toHaveLength(2)
    void allSettled(d.replaceDetail, { scope, params: { id: 'd1', detail: { id: 'd1', n: 99 } } })
    calls[1]!.ok()
    await tick()
    expect(scope.getState(d.$slots).a).toMatchObject({ state: 'ready', data: { n: 99 } })
    // finally старой эпохи снял загрузку: следующий перезапрос уходит
    void allSettled(d.reloadDetail, { scope, params: 'd1' })
    expect(calls).toHaveLength(3)
    calls[2]!.ok()
    await tick()
    expect(scope.getState(d.$slots).a).toMatchObject({ state: 'ready', data: { n: 3 } })
  })

  it('replaceDetail снимает загрузку сразу: перезапрос уходит, не дожидаясь старого; finally старой эпохи не снимает загрузку новой', async () => {
    const { d, scope, lifecycle, calls, open, tick } = setupManual()
    await allSettled(lifecycle.pageOpened, { scope })
    void open('d1')
    calls[0]!.ok()
    await tick()
    void allSettled(d.reloadDetail, { scope, params: 'd1' })
    expect(calls).toHaveLength(2)
    void allSettled(d.replaceDetail, { scope, params: { id: 'd1', detail: { id: 'd1', n: 99 } } })
    void allSettled(d.reloadDetail, { scope, params: 'd1' })
    expect(calls).toHaveLength(3)
    calls[1]!.ok()
    await tick()
    // новый ещё летит: повторный перезапрос — без запроса
    void allSettled(d.reloadDetail, { scope, params: 'd1' })
    expect(calls).toHaveLength(3)
    calls[2]!.ok()
    await tick()
    expect(scope.getState(d.$slots).a).toMatchObject({ state: 'ready', data: { n: 3 } })
  })
})
