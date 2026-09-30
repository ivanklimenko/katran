import { attach, combine, createEvent, createStore, sample, type Effect, type EventCallable, type Store } from 'effector'
import { createDrawerStackModel, type DrawerEntry, type DrawerOpen, type DrawerSlot, type DrawerStackModel, type DrawerStackState } from '@katran/effector'
import type { ApiError } from '../../../shared/api'
import type { PageLifecycle } from '../../../shared/lib/lifecycle'

export type DetailSlotState = 'loading' | 'ready' | 'error'
export type DetailSlot<D> = { slot: DrawerSlot; id: string; tab: string; state: DetailSlotState; data: D | null; error: string | null }
export type DetailConfig<D> = {
  detailFx: Effect<string, D, ApiError>
  lifecycle: PageLifecycle
  /** Вкладка только что открытого документа; по умолчанию 'main'. */
  firstTab?: string | undefined
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
}

const without = <T,>(o: Record<string, T>, k: string): Record<string, T> => {
  const next = { ...o }
  delete next[k]
  return next
}

type Load = { id: string; visit: number }

/**
 * Деталка экрана (спека 2a §4.3): стек A/B кита плюс загрузка документа по слоту и кэш по id на время открытого экрана.
 * Модель статична после импорта; ответы порта принимаются только пока экран открыт и только своего визита:
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

  const $cache = createStore<Record<string, D>>({})
  const $errors = createStore<Record<string, string>>({})
  const $loading = createStore<Record<string, true>>({})
  const $focus = createStore<Record<string, number>>({})
  const $quiet = createStore<Record<string, true>>({})

  sample({
    clock: stack.opened,
    source: { cache: $cache, loading: $loading, visit: $visit },
    filter: ({ cache, loading }, { id }) => !(id in cache) && !(id in loading),
    fn: ({ visit }, { id }): Load => ({ id, visit }),
    target: loadFx,
  })
  sample({
    clock: retry,
    source: { st: stack.$stack, loading: $loading, visit: $visit },
    filter: ({ st, loading }, slot) => { const e = st[slot]; return e !== null && !(e.id in loading) },
    fn: ({ st, visit }, slot): Load => ({ id: st[slot]?.id ?? '', visit }),
    target: loadFx,
  })

  // ответ после ухода с экрана и ответ прошлого визита не принимаются: при возврате деталь запросится заново
  const current = { opened: lifecycle.$opened, visit: $visit }
  const mine = ({ opened, visit }: { opened: boolean; visit: number }, { params }: { params: Load }) => opened && params.visit === visit
  const done = sample({ clock: loadFx.done, source: current, filter: mine, fn: (_, x) => x })
  const failed = sample({ clock: loadFx.fail, source: current, filter: mine, fn: (_, x) => x })
  const settled = sample({ clock: loadFx.finally, source: current, filter: mine, fn: (_, x) => x })
  $loading.on(loadFx, (l, { id }) => ({ ...l, [id]: true })).on(settled, (l, { params }) => without(l, params.id))
  $errors.on(loadFx, (e, { id }) => without(e, id))
  $cache.on(done, (c, { params, result }) => ({ ...c, [params.id]: result }))
  $errors.on(failed, (e, { params, error }) => ({ ...e, [params.id]: error.message }))

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

  sample({ clock: lifecycle.pageClosed, target: stack.closeAll })
  $cache.reset(lifecycle.pageClosed)
  $errors.reset(lifecycle.pageClosed)
  $loading.reset(lifecycle.pageClosed)
  $focus.reset(lifecycle.pageClosed)
  $quiet.reset(lifecycle.pageClosed)
  $shift.reset(lifecycle.pageClosed)

  const view = (slot: DrawerSlot, e: DrawerEntry | null, cache: Record<string, D>, errors: Record<string, string>): DetailSlot<D> | null => {
    if (!e) return null
    const has = e.id in cache
    const error = errors[e.id] ?? null
    return { slot, id: e.id, tab: e.tab, state: has ? 'ready' : error !== null ? 'error' : 'loading', data: has ? (cache[e.id] as D) : null, error }
  }
  const $slots = combine(stack.$a, stack.$b, $cache, $errors, (a, b, cache, errors) => ({ a: view('a', a, cache, errors), b: view('b', b, cache, errors) }))
  const $marks = combine(stack.$a, stack.$b, (a, b) => {
    const m: Record<string, DrawerSlot> = {}
    if (a) m[a.id] = 'a'
    if (b) m[b.id] = 'b'
    return m
  })

  return { stack, $slots, $marks, $focus, $quiet, open: stack.open, close: stack.close, closeTop: stack.closeTop, setTab: stack.setTab, retry }
}
