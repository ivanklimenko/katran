import { attach, combine, createEvent, createStore, merge, sample, split, type Effect, type Event, type EventCallable, type Store } from 'effector'
import { createDrawerStackModel, type DrawerEntry, type DrawerOpen, type DrawerSlot, type DrawerStackModel, type DrawerStackState } from '@katran/effector'
import type { ApiError, TabQuery } from '../../../shared/api'
import type { LeaveIntent } from '../../../shared/lib/detail'
import type { PageLifecycle } from '../../../shared/lib/lifecycle'

export type DetailSlotState = 'loading' | 'ready' | 'error'
/** Нелокальная вкладка слота (спека 2b §3.3): свои загрузка, данные и ошибка — шапку, лейн и другие вкладки не трогают. */
export type TabSlot = { state: DetailSlotState; data: unknown; error: string | null }
export type DetailSlot<D> = {
  slot: DrawerSlot
  id: string
  tab: string
  state: DetailSlotState
  data: D | null
  error: string | null
  /** Активная вкладка, если она грузится своим запросом; null — локальная (данные в детали) или порта вкладок нет. */
  tabView: TabSlot | null
}
export type DetailConfig<D> = {
  detailFx: Effect<string, D, ApiError>
  /** Порт вкладок (спека 2b §3.1, GET …/documents/{id}/tabs/{tab}); нет — нелокальные вкладки не грузятся (tabView null). */
  tabFx?: Effect<TabQuery, unknown, ApiError> | undefined
  /** Вкладки, чьи данные приходят в детали, — без своего запроса; по умолчанию ['main']. */
  localTabs?: string[] | undefined
  lifecycle: PageLifecycle
  /** Вкладка только что открытого документа; по умолчанию 'main'. */
  firstTab?: string | undefined
  /**
   * Охрана ухода (план 2c, Р6): true — close, closeTop и open, уводящие документ из слота, не меняют стек, а дают
   * leaveRequested; уход выполняет leave (его зовёт тот, кто спросил «Отменить правку?»). Нет — как в 2b, стек сразу.
   */
  guard?: boolean | undefined
}
export type Detail<D> = {
  stack: DrawerStackModel
  $slots: Store<{ a: DetailSlot<D> | null; b: DetailSlot<D> | null }>
  /** Метки записей реестра: id → слот (DataGrid marked). */
  $marks: Store<Record<string, DrawerSlot>>
  /**
   * Запросы фокуса по id документа (Drawer focusKey): растут при повторном открытии уже открытого пользователем
   * и у документа, оставшегося после закрытия A при открытом B (он сдвинут в A, R11).
   */
  $focus: Store<Record<string, number>>
  /** Открытые не пользователем (quiet, автооткрытие В-Д4): drawer не забирает фокус при монтировании (R10). Снимается закрытием слота. */
  $quiet: Store<Record<string, true>>
  /** quiet — открытие не пользователем: фокус остаётся, где был. */
  open: EventCallable<DrawerOpen>
  close: EventCallable<DrawerSlot>
  closeTop: EventCallable<void>
  setTab: EventCallable<{ slot: DrawerSlot; tab: string }>
  retry: EventCallable<DrawerSlot>
  /** Повтор загрузки активной нелокальной вкладки слота; готовая, уже грузящаяся, локальная вкладка и пустой слот — без запроса. */
  retryTab: EventCallable<DrawerSlot>
  /**
   * Раскрытое во вкладках по ключу `${id}:${tab}` (строки, аккордеоны, поля «Общих данных»): TabPanel размонтирует
   * неактивную вкладку, а раскрытое переживает переключение и закрытие drawer — до pageClosed (спека 2b §3.3, техдолг M-g).
   */
  $expanded: Store<Record<string, string[]>>
  setExpanded: EventCallable<{ id: string; tab: string; keys: string[] }>
  /**
   * Ответ сохранения правки — в кэш без перезапроса (план 2c §3.4); только при открытом экране. Ошибка детали снимается,
   * кэш и ошибки вкладок `${id}:*` сбрасываются, активная нелокальная вкладка этого id перезапрашивается (если уже не грузится).
   */
  replaceDetail: EventCallable<{ id: string; detail: D }>
  /** Перезапрос детали по id (Р5, 409): кэш остаётся до ответа — слот ready со старой деталью, без скелетона; уже грузящийся — без запроса. */
  reloadDetail: EventCallable<string>
  /**
   * Уход из документа при guard (Р6): close/closeTop с документом в слоте, open в слот, занятый другим документом.
   * Охрана решений не принимает: спрашивать ли (черновик, сохранение в полёте — без вопроса), решает потребитель.
   */
  leaveRequested: Event<{ docId: string; intent: LeaveIntent }>
  /** Выполнить уход: close(slot) или open(…) стека — мимо охраны. */
  leave: EventCallable<LeaveIntent>
}

const without = <T,>(o: Record<string, T>, k: string): Record<string, T> => {
  const next = { ...o }
  delete next[k]
  return next
}

/** epoch — эпоха документа при запросе: растёт с каждым replaceDetail, ответ прежней эпохи — доправочный. */
type Load = { id: string; visit: number; epoch: number }
/** Запрос ухода из документа docId: что сделать, если пользователь не держит правку. */
type LeaveRequest = { docId: string; intent: LeaveIntent }
type CloseIntent = Extract<LeaveIntent, { kind: 'close' }>
type OpenIntent = Extract<LeaveIntent, { kind: 'open' }>
type TabLoad = TabQuery & { visit: number; epoch: number }
type Visit = { opened: boolean; visit: number }
type Epochs = Record<string, number>
const tabKey = (id: string, tab: string) => `${id}:${tab}`
/** Ответ своего визита экрана: пришедший после ухода или от прошлого визита не принимается. */
const mine = (cur: Visit, { params }: { params: { visit: number } }) => cur.opened && params.visit === cur.visit
/** Ответ своего визита и эпохи документа: летевший до replaceDetail не возвращает в кэш данные до правки. */
const fresh = (cur: Visit & { epoch: Epochs }, x: { params: { id: string; visit: number; epoch: number } }) =>
  mine(cur, x) && x.params.epoch === (cur.epoch[x.params.id] ?? 0)
const entryOf = (st: DrawerStackState, id: string): DrawerEntry | null => (st.a?.id === id ? st.a : st.b?.id === id ? st.b : null)

/**
 * Деталка экрана (спека 2a §4.3, 2b §3.3): стек A/B кита, загрузка документа по слоту и кэш по id, ленивая загрузка
 * нелокальной вкладки с кэшем по id:tab, раскрытое во вкладках — всё на время открытого экрана.
 * Модель статична после импорта; ответы портов принимаются только пока экран открыт и только своего визита:
 * запрос, висевший при уходе, после возврата не пишет ни в кэш, ни в ошибки, ни в загрузку нового визита.
 */
export function createDetail<D>(cfg: DetailConfig<D>): Detail<D> {
  const { lifecycle } = cfg
  const stack = createDrawerStackModel({ firstTab: cfg.firstTab ?? 'main' })
  // своя копия эффекта: pending и отказы этой деталки не смешиваются с другими потребителями порта;
  // в параметрах — номер визита экрана, порту уходит только id
  const loadFx = attach({ effect: cfg.detailFx, mapParams: (p: Load) => p.id })
  const retry = createEvent<DrawerSlot>()
  // номер визита: растёт при каждом входе на экран
  const $visit = createStore(0).on(lifecycle.pageOpened, (v) => v + 1)
  const current = { opened: lifecycle.$opened, visit: $visit }

  const $cache = createStore<Record<string, D>>({})
  const $errors = createStore<Record<string, string>>({})
  const $loading = createStore<Record<string, true>>({})
  const $focus = createStore<Record<string, number>>({})
  const $quiet = createStore<Record<string, true>>({})

  // --- правка (план 2c, Р5): ответ сохранения в кэш, перезапрос по 409 ---
  const replaceDetail = createEvent<{ id: string; detail: D }>()
  const reloadDetail = createEvent<string>()
  // ответ сохранения после ухода с экрана не пишется: при возврате деталь запросится заново (Review Focus 1)
  const replaced = sample({ clock: replaceDetail, source: lifecycle.$opened, filter: (opened) => opened, fn: (_, x) => x })
  // эпоха документа: запросы детали и вкладок, ушедшие до replaceDetail, своими ответами кэш не трогают
  const $epoch = createStore<Epochs>({}).on(replaced, (m, { id }) => ({ ...m, [id]: (m[id] ?? 0) + 1 }))
  const epochOf = (m: Epochs, id: string) => m[id] ?? 0
  const currentEpoch = { ...current, epoch: $epoch }

  sample({
    clock: stack.opened,
    source: { cache: $cache, loading: $loading, visit: $visit, epoch: $epoch },
    filter: ({ cache, loading }, { id }) => !(id in cache) && !(id in loading),
    fn: ({ visit, epoch }, { id }): Load => ({ id, visit, epoch: epochOf(epoch, id) }),
    target: loadFx,
  })
  sample({
    clock: retry,
    source: { st: stack.$stack, loading: $loading, visit: $visit, epoch: $epoch },
    filter: ({ st, loading }, slot) => { const e = st[slot]; return e !== null && !(e.id in loading) },
    fn: ({ st, visit, epoch }, slot): Load => { const id = st[slot]?.id ?? ''; return { id, visit, epoch: epochOf(epoch, id) } },
    target: loadFx,
  })

  // ответ после ухода с экрана и ответ прошлого визита не принимаются: при возврате деталь запросится заново;
  // ответ прежней эпохи (ушёл до replaceDetail) — доправочный: ни в кэш, ни в ошибки, ни в загрузку. Загрузку документа
  // снимает сам replaceDetail (деталь уже есть — перезапрос уходит сразу), а finally старой эпохи не снимает загрузку новой
  const done = sample({ clock: loadFx.done, source: currentEpoch, filter: fresh, fn: (_, x) => x })
  const failed = sample({ clock: loadFx.fail, source: currentEpoch, filter: fresh, fn: (_, x) => x })
  const settled = sample({ clock: loadFx.finally, source: currentEpoch, filter: fresh, fn: (_, x) => x })
  $loading
    .on(loadFx, (l, { id }) => ({ ...l, [id]: true }))
    .on(settled, (l, { params }) => without(l, params.id))
    .on(replaced, (l, { id }) => without(l, id))
  $errors.on(loadFx, (e, { id }) => without(e, id))
  $cache.on(done, (c, { params, result }) => ({ ...c, [params.id]: result }))
  $errors.on(failed, (e, { params, error }) => ({ ...e, [params.id]: error.message }))

  $cache.on(replaced, (c, { id, detail }) => ({ ...c, [id]: detail }))
  $errors.on(replaced, (e, { id }) => without(e, id))
  // кэш не трогается до ответа: слот остаётся ready со старой деталью; ответ — общий путь done/failed
  sample({
    clock: reloadDetail,
    source: { opened: lifecycle.$opened, loading: $loading, visit: $visit, epoch: $epoch },
    filter: ({ opened, loading }, id) => opened && !(id in loading),
    fn: ({ visit, epoch }, id): Load => ({ id, visit, epoch: epochOf(epoch, id) }),
    target: loadFx,
  })

  // --- вкладки (спека 2b §3.3) ---
  const localTabs = cfg.localTabs ?? ['main']
  const tabFx = cfg.tabFx
  const remote = (tab: string) => tabFx !== undefined && !localTabs.includes(tab)
  const retryTab = createEvent<DrawerSlot>()
  const setExpanded = createEvent<{ id: string; tab: string; keys: string[] }>()
  const $tabCache = createStore<Record<string, unknown>>({})
  const $tabErrors = createStore<Record<string, string>>({})
  const $tabLoading = createStore<Record<string, true>>({})
  const $expanded = createStore<Record<string, string[]>>({})
  $expanded.on(setExpanded, (m, { id, tab, keys }) => ({ ...m, [tabKey(id, tab)]: keys }))
  // новая деталь — вкладки документа устарели: кэш, ошибки и загрузки `${id}:*` сбрасываются (раскрытое остаётся);
  // летящий запрос вкладки прежней эпохи доживёт, но его ответ отбросит fresh, а need() сразу отправит свежий
  const dropDoc = <T,>(m: Record<string, T>, id: string): Record<string, T> => {
    const keys = Object.keys(m).filter((k) => k.startsWith(`${id}:`))
    if (keys.length === 0) return m
    const next = { ...m }
    for (const k of keys) delete next[k]
    return next
  }
  $tabCache.on(replaced, (c, { id }) => dropDoc(c, id))
  $tabErrors.on(replaced, (e, { id }) => dropDoc(e, id))
  $tabLoading.on(replaced, (l, { id }) => dropDoc(l, id))

  if (tabFx) {
    // своя копия порта, как у детали; порту уходит только { id, tab }
    const loadTabFx = attach({ effect: tabFx, mapParams: (p: TabLoad): TabQuery => ({ id: p.id, tab: p.tab }) })
    type Need = { cache: Record<string, unknown>; loading: Record<string, true> }
    // вкладку грузим, если она нелокальная, её нет в кэше и она уже не грузится (ошибка — не препятствие: повторный выбор = повтор)
    const need = ({ cache, loading }: Need, e: DrawerEntry | null): boolean => {
      if (e === null || !remote(e.tab)) return false
      const k = tabKey(e.id, e.tab)
      return !(k in cache) && !(k in loading)
    }
    const load = (e: DrawerEntry | null, visit: number, epoch: Epochs): TabLoad => {
      const id = e?.id ?? ''
      return { id, tab: e?.tab ?? '', visit, epoch: epochOf(epoch, id) }
    }
    // вкладка стала активной в слоте: setTab, открытие, сдвиг B в A. $a/$b обновляются только при смене своей записи —
    // открытие B и переключение вкладки в B запись A не трогают. Деталь не ждём: эндпоинт вкладки самостоятелен (§3.1)
    sample({
      clock: merge([stack.$a.updates, stack.$b.updates]),
      source: { cache: $tabCache, loading: $tabLoading, visit: $visit, epoch: $epoch },
      filter: need,
      fn: ({ visit, epoch }, e) => load(e, visit, epoch),
      target: loadTabFx,
    })
    // replaceDetail: активная нелокальная вкладка этого документа — заново (кэш уже сброшен редьюсером выше)
    sample({
      clock: replaced,
      source: { st: stack.$stack, cache: $tabCache, loading: $tabLoading, visit: $visit, epoch: $epoch },
      filter: (src, { id }) => need(src, entryOf(src.st, id)),
      fn: ({ st, visit, epoch }, { id }) => load(entryOf(st, id), visit, epoch),
      target: loadTabFx,
    })
    sample({
      clock: retryTab,
      source: { st: stack.$stack, cache: $tabCache, loading: $tabLoading, visit: $visit, epoch: $epoch },
      filter: (src, slot) => need(src, src.st[slot]),
      fn: ({ st, visit, epoch }, slot) => load(st[slot], visit, epoch),
      target: loadTabFx,
    })
    // счётчик визитов — тот же, что у детали; внутри визита дубли исключает карта загрузок,
    // а ответ другой вкладки при быстром переключении ложится в кэш своего ключа
    // эпоха и на finally: загрузку ключа после replaceDetail держит уже новый запрос — старый её не снимает
    const tabDone = sample({ clock: loadTabFx.done, source: currentEpoch, filter: fresh, fn: (_, x) => x })
    const tabFailed = sample({ clock: loadTabFx.fail, source: currentEpoch, filter: fresh, fn: (_, x) => x })
    const tabSettled = sample({ clock: loadTabFx.finally, source: currentEpoch, filter: fresh, fn: (_, x) => x })
    $tabLoading
      .on(loadTabFx, (l, p) => ({ ...l, [tabKey(p.id, p.tab)]: true }))
      .on(tabSettled, (l, { params }) => without(l, tabKey(params.id, params.tab)))
    $tabErrors
      .on(loadTabFx, (e, p) => without(e, tabKey(p.id, p.tab)))
      .on(tabFailed, (e, { params, error }) => ({ ...e, [tabKey(params.id, params.tab)]: error.message }))
    $tabCache.on(tabDone, (c, { params, result }) => ({ ...c, [tabKey(params.id, params.tab)]: result }))
  }

  const bump = (f: Record<string, number>, id: string) => ({ ...f, [id]: (f[id] ?? 0) + 1 })
  // повторное открытие уже открытого пользователем — фокус в его drawer; quiet-открытие фокус не трогает
  $focus.on(sample({ clock: stack.alreadyOpen, filter: (h) => !h.quiet }), (f, { id }) => bump(f, id))
  // R11: закрытие A при открытом B — B сдвигается в A, фокус в его заголовок (а не в грид)
  // сдвиг распознаётся по переходу состояния: прежний B стал A, B пуст (так меняет стек только close('a') при открытом B);
  // прежнее состояние — в своём сторе, source у sample читал бы уже новое
  const $shift = createStore<{ prev: DrawerStackState; id: string | null }>({ prev: { a: null, b: null }, id: null })
    .on(stack.$stack.updates, ({ prev }, st) => ({ prev: st, id: prev.b !== null && st.b === null && st.a?.id === prev.b.id ? prev.b.id : null }))
  const shifted = sample({ clock: $shift.updates, filter: (x) => x.id !== null, fn: (x) => x.id ?? '' })
  $focus.on(shifted, bump)
  $quiet.on(stack.opened, (q, { id, quiet }) => (quiet ? { ...q, [id]: true } : without(q, id)))
  // закрытый слот — метка снимается (повторное открытие того же id пользователем — уже не тихое)
  $quiet.on(stack.$stack.updates, (q, st) => {
    const keep: Record<string, true> = {}
    for (const id of Object.keys(q)) if (st.a?.id === id || st.b?.id === id) keep[id] = true
    return Object.keys(keep).length === Object.keys(q).length ? q : keep
  })

  // --- охрана ухода (план 2c, Р6) ---
  const leave = createEvent<LeaveIntent>()
  const leaveRequested = createEvent<LeaveRequest>()
  const leaving = split(leave, { close: (i): i is CloseIntent => i.kind === 'close', open: (i): i is OpenIntent => i.kind === 'open' })
  sample({ clock: leaving.close, fn: (i) => i.slot, target: stack.close })
  sample({ clock: leaving.open, fn: (i) => i.open, target: stack.open })
  let open = stack.open
  let close = stack.close
  let closeTop = stack.closeTop
  if (cfg.guard) {
    open = createEvent<DrawerOpen>()
    close = createEvent<DrawerSlot>()
    closeTop = createEvent<void>()
    // close: документ в слоте — запрос ухода; пустой слот — ничего
    sample({
      clock: close,
      source: stack.$stack,
      filter: (st, slot) => st[slot] !== null,
      fn: (st, slot): LeaveRequest => ({ docId: st[slot]?.id ?? '', intent: { kind: 'close', slot } }),
      target: leaveRequested,
    })
    // closeTop (Esc): тот же путь для верхнего слота
    sample({ clock: closeTop, source: stack.$top, filter: (top: DrawerSlot | null): top is DrawerSlot => top !== null, target: close })
    // open: уже открытый (любой слот) — в стек сразу (фокус); иначе слот назначения — как place стека; занят другим — запрос ухода
    const decided = sample({
      clock: open,
      source: stack.$stack,
      fn: (st, p) => {
        if (st.a?.id === p.id || st.b?.id === p.id) return { p, occupant: null }
        const e = st[p.secondary && st.a ? 'b' : 'a']
        return { p, occupant: e ? e.id : null }
      },
    })
    sample({ clock: decided, filter: ({ occupant }) => occupant === null, fn: ({ p }) => p, target: stack.open })
    sample({
      clock: decided,
      filter: ({ occupant }) => occupant !== null,
      fn: ({ p, occupant }): LeaveRequest => ({ docId: occupant ?? '', intent: { kind: 'open', open: p } }),
      target: leaveRequested,
    })
  }

  // уход с экрана — без охраны
  sample({ clock: lifecycle.pageClosed, target: stack.closeAll })
  $cache.reset(lifecycle.pageClosed)
  $errors.reset(lifecycle.pageClosed)
  $loading.reset(lifecycle.pageClosed)
  $focus.reset(lifecycle.pageClosed)
  $quiet.reset(lifecycle.pageClosed)
  $shift.reset(lifecycle.pageClosed)
  $epoch.reset(lifecycle.pageClosed)
  $tabCache.reset(lifecycle.pageClosed)
  $tabErrors.reset(lifecycle.pageClosed)
  $tabLoading.reset(lifecycle.pageClosed)
  $expanded.reset(lifecycle.pageClosed)

  type Maps = { cache: Record<string, D>; errors: Record<string, string>; tabCache: Record<string, unknown>; tabErrors: Record<string, string> }
  const tabViewOf = (e: DrawerEntry, m: Maps): TabSlot | null => {
    if (!remote(e.tab)) return null
    const k = tabKey(e.id, e.tab)
    if (k in m.tabCache) return { state: 'ready', data: m.tabCache[k], error: null }
    const error = m.tabErrors[k] ?? null
    return { state: error !== null ? 'error' : 'loading', data: null, error }
  }
  const view = (slot: DrawerSlot, e: DrawerEntry | null, m: Maps): DetailSlot<D> | null => {
    if (!e) return null
    const has = e.id in m.cache
    const error = m.errors[e.id] ?? null
    return {
      slot, id: e.id, tab: e.tab,
      state: has ? 'ready' : error !== null ? 'error' : 'loading',
      data: has ? (m.cache[e.id] as D) : null,
      error,
      tabView: tabViewOf(e, m),
    }
  }
  const $slots = combine(
    { a: stack.$a, b: stack.$b, cache: $cache, errors: $errors, tabCache: $tabCache, tabErrors: $tabErrors },
    (m) => ({ a: view('a', m.a, m), b: view('b', m.b, m) }),
  )
  const $marks = combine(stack.$a, stack.$b, (a, b) => {
    const m: Record<string, DrawerSlot> = {}
    if (a) m[a.id] = 'a'
    if (b) m[b.id] = 'b'
    return m
  })

  return {
    stack, $slots, $marks, $focus, $quiet,
    open, close, closeTop, setTab: stack.setTab, retry,
    retryTab, $expanded, setExpanded,
    replaceDetail, reloadDetail, leaveRequested, leave,
  }
}
