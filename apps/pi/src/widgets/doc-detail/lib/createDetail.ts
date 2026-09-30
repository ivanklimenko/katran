import { attach, combine, createEvent, createStore, sample, type Effect, type EventCallable, type Store } from 'effector'
import { createDrawerStackModel, type DrawerEntry, type DrawerSlot, type DrawerStackModel } from '@katran/effector'
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
  /** Запросы фокуса по id документа: растут при повторном открытии уже открытого (Drawer focusKey). */
  $focus: Store<Record<string, number>>
  open: EventCallable<{ id: string; secondary: boolean }>
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

/**
 * Деталка экрана (спека 2a §4.3): стек A/B кита плюс загрузка документа по слоту и кэш по id на время открытого экрана.
 * Модель статична после импорта; реакции извне (ответы порта) принимаются только пока экран открыт.
 */
export function createDetail<D>(cfg: DetailConfig<D>): Detail<D> {
  const { lifecycle } = cfg
  const stack = createDrawerStackModel({ firstTab: cfg.firstTab ?? 'main' })
  // своя копия эффекта: pending и отказы этой деталки не смешиваются с другими потребителями порта
  const loadFx = attach({ effect: cfg.detailFx })
  const retry = createEvent<DrawerSlot>()

  const $cache = createStore<Record<string, D>>({})
  const $errors = createStore<Record<string, string>>({})
  const $loading = createStore<Record<string, true>>({})
  const $focus = createStore<Record<string, number>>({})

  sample({
    clock: stack.opened,
    source: { cache: $cache, loading: $loading },
    filter: ({ cache, loading }, { id }) => !(id in cache) && !(id in loading),
    fn: (_, { id }) => id,
    target: loadFx,
  })
  sample({
    clock: retry,
    source: { st: stack.$stack, loading: $loading },
    filter: ({ st, loading }, slot) => { const e = st[slot]; return e !== null && !(e.id in loading) },
    fn: ({ st }, slot) => st[slot]?.id ?? '',
    target: loadFx,
  })

  $loading.on(loadFx, (l, id) => ({ ...l, [id]: true })).on(loadFx.finally, (l, { params }) => without(l, params))
  $errors.on(loadFx, (e, id) => without(e, id))
  // ответ после ухода с экрана не кладётся в кэш: при возврате деталь запросится заново
  const done = sample({ clock: loadFx.done, filter: lifecycle.$opened })
  const failed = sample({ clock: loadFx.fail, filter: lifecycle.$opened })
  $cache.on(done, (c, { params, result }) => ({ ...c, [params]: result }))
  $errors.on(failed, (e, { params, error }) => ({ ...e, [params]: error.message }))
  $focus.on(stack.alreadyOpen, (f, { id }) => ({ ...f, [id]: (f[id] ?? 0) + 1 }))

  sample({ clock: lifecycle.pageClosed, target: stack.closeAll })
  $cache.reset(lifecycle.pageClosed)
  $errors.reset(lifecycle.pageClosed)
  $loading.reset(lifecycle.pageClosed)
  $focus.reset(lifecycle.pageClosed)

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

  return { stack, $slots, $marks, $focus, open: stack.open, close: stack.close, closeTop: stack.closeTop, setTab: stack.setTab, retry }
}
