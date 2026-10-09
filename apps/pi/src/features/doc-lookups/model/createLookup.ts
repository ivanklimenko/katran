import { attach, createEvent, createStore, sample, type Effect, type EventCallable, type Store } from 'effector'
import type { ApiError } from '../../../shared/api'
import type { PageLifecycle } from '../../../shared/lib/lifecycle'

/** Запись кэша справочного запроса документа: value держится и в loading/error, если уже было (refresh, Review Focus 3). */
export type LookupEntry<T> = { state: 'loading' | 'ready' | 'error'; value: T | null; error: string | null }

export type Lookup<T> = {
  /** Первое открытие поповера: запрос, если записи нет или она в ошибке; ready и запрос в полёте — ничего. */
  load: EventCallable<string>
  /** «Повторить» после ошибки; не в ошибке — ничего. */
  retry: EventCallable<string>
  /** «Обновить» готового значения: перезапрос, прежнее value видно до ответа; не ready — ничего. */
  refresh: EventCallable<string>
  /** Документ обновили (refreshDoc, replaceDetail): запись снята, ответ летящего запроса отбрасывается (эпоха документа). */
  reset: EventCallable<string>
  $data: Store<Record<string, LookupEntry<T>>>
}

export type LookupConfig<T> = { fx: Effect<string, T, ApiError>; lifecycle: PageLifecycle }

/** visit — визит экрана (растёт с pageClosed), epoch — эпоха документа (растёт с reset): ответ чужого визита или эпохи не принимается. */
type Req = { id: string; visit: number; epoch: number }

/** Текст ошибки (как в 2d): detail Problem, иначе message. */
const errorText = (e: ApiError): string => e.problem?.detail || e.message

const without = <V,>(m: Record<string, V>, k: string): Record<string, V> => {
  if (!(k in m)) return m
  const next = { ...m }
  delete next[k]
  return next
}

/**
 * Справочный запрос документа по требованию (спека 2e §3.3): «Курс», «Проверить баланс». Кэш по id документа на время
 * открытого экрана; повторное открытие поповера показывает кэш. Ответ, ушедший до reset документа или до ухода с экрана,
 * ни в кэш, ни в ошибку не попадает.
 */
export function createLookup<T>(cfg: LookupConfig<T>): Lookup<T> {
  const { lifecycle } = cfg
  const load = createEvent<string>()
  const retry = createEvent<string>()
  const refresh = createEvent<string>()
  const reset = createEvent<string>()
  const requested = createEvent<string>()

  // своя копия порта: pending и отказы этой модели не смешиваются с другими потребителями; порту уходит только id
  const reqFx = attach({ effect: cfg.fx, mapParams: (p: Req) => p.id })

  const $visit = createStore(0).on(lifecycle.pageClosed, (v) => v + 1)
  const $epoch = createStore<Record<string, number>>({})
    .on(reset, (m, id) => ({ ...m, [id]: (m[id] ?? 0) + 1 }))
    .reset(lifecycle.pageClosed)
  const $data = createStore<Record<string, LookupEntry<T>>>({})
    // запрос: прежнее значение (если было) видно до ответа
    .on(requested, (m, id) => ({ ...m, [id]: { state: 'loading', value: m[id]?.value ?? null, error: null } }))
    .on(reset, (m, id) => without(m, id))
    .reset(lifecycle.pageClosed)

  const current = { visit: $visit, epoch: $epoch }
  const fresh = (c: { visit: number; epoch: Record<string, number> }, { params }: { params: Req }) =>
    params.visit === c.visit && params.epoch === (c.epoch[params.id] ?? 0)
  const done = sample({ clock: reqFx.done, source: current, filter: fresh, fn: (_, x) => x })
  const failed = sample({ clock: reqFx.fail, source: current, filter: fresh, fn: (_, x) => x })
  $data
    .on(done, (m, { params, result }) => ({ ...m, [params.id]: { state: 'ready', value: result, error: null } }))
    // неудачный refresh: значение остаётся, рядом — ошибка и «Повторить» (Review Focus 3)
    .on(failed, (m, { params, error }) => ({ ...m, [params.id]: { state: 'error', value: m[params.id]?.value ?? null, error: errorText(error) } }))

  // запуск — после редьюсеров $data (правило global-constraints: .on раньше sample, читающего тот же стор)
  sample({ clock: load, source: $data, filter: (m, id) => m[id] === undefined || m[id].state === 'error', fn: (_, id) => id, target: requested })
  sample({ clock: retry, source: $data, filter: (m, id) => m[id]?.state === 'error', fn: (_, id) => id, target: requested })
  sample({ clock: refresh, source: $data, filter: (m, id) => m[id]?.state === 'ready', fn: (_, id) => id, target: requested })
  sample({
    clock: requested,
    source: { visit: $visit, epoch: $epoch },
    fn: ({ visit, epoch }, id): Req => ({ id, visit, epoch: epoch[id] ?? 0 }),
    target: reqFx,
  })

  return { load, retry, refresh, reset, $data }
}
