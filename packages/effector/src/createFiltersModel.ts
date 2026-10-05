import { attach, combine, createEffect, createEvent, createStore, is, sample, type Effect, type EventCallable, type Store } from 'effector'
import type { Condition, Filter, FilterMeta, Scalar, SuggestQuery, SuggestState } from './types'

/** Подсказки поля. filter запроса берётся из применённых условий в момент ввода (без условий по самому полю), не из черновика. */
export type SuggestConfig = {
  fetchFx: Effect<SuggestQuery, string[]>
  /** Задержка после последнего ввода, мс; по умолчанию 250. */
  delay?: number | undefined
  /** Короче — без запроса; по умолчанию 1. */
  minChars?: number | undefined
  /** Сколько подсказок просить; по умолчанию 10. */
  limit?: number | undefined
}

export type FiltersModelConfig = {
  /** Каталог полей: значением или стором (каталог, загружаемый с бека, — спека apps/pi §6.1). */
  meta?: FilterMeta | Store<FilterMeta | null> | undefined
  initial?: Filter | undefined
  /** Поле, которым управляет лейн статусов (спека 1e, §3). Без него setLane — no-op. */
  laneField?: string | undefined
  /** Подсказки с бека (спека 2026-09-30 §8); нет — $suggest всегда null. */
  suggest?: SuggestConfig | undefined
}

export type FiltersModel = {
  /** Применённые условия — это и есть $filter для грида. */
  $conditions: Store<Filter>
  /** Черновик панели до нажатия «Применить». */
  $draft: Store<Filter>
  $dirty: Store<boolean>
  /** Значение, если по laneField в применённых ровно одно условие и оно EQ; иначе null (IN, NE или несколько условий по полю — null). */
  $lane: Store<Scalar | null>
  /** Каталог полей; null — ещё не загружен. */
  $meta: Store<FilterMeta | null>
  // EventCallable, а не Event: снаружи события нужно вызывать (edit(...), apply()), просто Event этого не позволяет.
  edit: EventCallable<Condition>
  discard: EventCallable<string>
  apply: EventCallable<void>
  /** Черновик ← применённые: «Отменить» панели. */
  revert: EventCallable<void>
  reset: EventCallable<void>
  remove: EventCallable<string>
  /** Лейн: EQ по laneField сразу в применённые и черновик (без «Применить»); null — снять. */
  setLane: EventCallable<Scalar | null>
  /** Все условия поля разом (контракт §4.4: несколько условий по полю — AND); пустой список снимает поле из черновика. */
  setField: EventCallable<{ field: string; conditions: Condition[] }>
  /** Ввод в поле с подсказками. */
  suggest: EventCallable<{ field: string; query: string }>
  closeSuggest: EventCallable<void>
  /** Подсказки открытого поля; null — закрыто или подсказки не настроены. */
  $suggest: Store<SuggestState | null>
  /** @deprecated Начальное значение каталога; читать $meta. */
  meta: FilterMeta | null
  laneField: string | null
}

type FieldConditions = { field: string; conditions: Condition[] }
/** Заменить условия поля: место поля в списке — место его первого условия; новое поле — в конец. */
const replaceField = (list: Filter, { field, conditions }: FieldConditions): Filter => {
  const own = conditions.filter((c) => c.field === field)
  const i = list.findIndex((x) => x.field === field)
  if (i < 0) return own.length === 0 ? list : [...list, ...own]
  return [...list.slice(0, i), ...own, ...list.slice(i).filter((x) => x.field !== field)]
}
const single = (c: Condition): FieldConditions => ({ field: c.field, conditions: [c] })
const without = (list: Filter, field: string): Filter => list.filter((x) => x.field !== field)
const same = (a: Filter, b: Filter) => JSON.stringify(a) === JSON.stringify(b)

const isMetaStore = (m: FiltersModelConfig['meta']): m is Store<FilterMeta | null> => is.store(m)

export function createFiltersModel(cfg: FiltersModelConfig = {}): FiltersModel {
  const { meta, initial = [], laneField } = cfg
  const edit = createEvent<Condition>()
  const discard = createEvent<string>()
  const apply = createEvent<void>()
  const revert = createEvent<void>()
  const reset = createEvent<void>()
  const remove = createEvent<string>()
  const setLane = createEvent<Scalar | null>()
  const setField = createEvent<FieldConditions>()

  const $meta: Store<FilterMeta | null> = isMetaStore(meta) ? meta : createStore<FilterMeta | null>(meta ?? null)

  const $conditions = createStore<Filter>(initial)
  const $draft = createStore<Filter>(initial)

  const lane = laneField ?? null
  // лейн пишет в оба стора одинаково: условие EQ по полю лейна ставится или снимается, остальное не трогается
  const applyLane = (list: Filter, v: Scalar | null): Filter =>
    lane === null ? list : replaceField(list, { field: lane, conditions: v === null ? [] : [{ field: lane, op: 'EQ', value: v }] })

  // reset должен очищать стор в [], а не откатывать к initial из конфига — .reset() тут не подходит.
  // remove снимает условие и из применённых, и из черновика (чтобы панель не показывала снятое),
  // не трогая неприменённые правки других полей в черновике.
  $draft.on(edit, (l, c) => replaceField(l, single(c))).on(setField, replaceField).on(discard, without).on(remove, without).on(reset, () => []).on(setLane, applyLane)
  $conditions.on(remove, without).on(reset, () => []).on(setLane, applyLane)
  // apply: черновик → применённые
  sample({ clock: apply, source: $draft, target: $conditions })
  // revert: применённые → черновик («Отменить» панели)
  sample({ clock: revert, source: $conditions, target: $draft })

  const $dirty = combine($conditions, $draft, (c, d) => !same(c, d))
  const $lane = $conditions.map((list): Scalar | null => {
    if (lane === null) return null
    const own = list.filter((x) => x.field === lane)
    return own.length === 1 && own[0]!.op === 'EQ' ? own[0]!.value : null
  })

  // --- подсказки (спека 2026-09-30 §8): задержка ввода — эффект-таймер модели, свой attach-экземпляр транспорта,
  // ответ принимается только на последний отправленный запрос (сравнение по значению) ---
  const suggest = createEvent<{ field: string; query: string }>()
  const closeSuggest = createEvent<void>()
  const $suggest = createStore<SuggestState | null>(null)
  if (cfg.suggest) {
    const { fetchFx, delay = 250, minChars = 1, limit = 10 } = cfg.suggest
    const short = (q: string) => q.trim().length < minChars
    const sameQuery = (a: SuggestQuery, b: SuggestQuery) => JSON.stringify(a) === JSON.stringify(b)
    const requestFx = attach({ effect: fetchFx })
    const waitFx = createEffect((q: SuggestQuery) => new Promise<SuggestQuery>((resolve) => { setTimeout(() => resolve(q), delay) }))
    // последний запрошенный запрос: всё, что с ним не совпало (новый ввод, закрытие), отбрасывается
    const $pending = createStore<SuggestQuery | null>(null)
    $suggest
      .on(suggest, (st, { field, query }) => (short(query)
        ? { field, query, items: [], loading: false }
        : { field, query, items: st !== null && st.field === field ? st.items : [], loading: true }))
      .on(closeSuggest, () => null)
    const asked = sample({
      clock: suggest,
      source: $conditions,
      filter: (_, { query }) => !short(query),
      fn: (conds, { field, query }): SuggestQuery => ({ field, query: query.trim(), filter: conds.filter((c) => c.field !== field), limit }),
    })
    $pending.on(suggest, (p, { query }) => (short(query) ? null : p)).on(asked, (_, q) => q).on(closeSuggest, () => null)
    sample({ clock: asked, target: waitFx })
    sample({ clock: waitFx.doneData, source: $pending, filter: (p, q) => p !== null && sameQuery(p, q), fn: (_, q) => q, target: requestFx })
    const got = sample({ clock: requestFx.done, source: $pending, filter: (p, { params }) => p !== null && sameQuery(p, params), fn: (_, { result }) => result })
    const failed = sample({ clock: requestFx.fail, source: $pending, filter: (p, { params }) => p !== null && sameQuery(p, params) })
    $suggest
      .on(got, (st, items) => (st === null ? st : { ...st, items, loading: false }))
      .on(failed, (st) => (st === null ? st : { ...st, items: [], loading: false }))
  }

  return { $conditions, $draft, $dirty, $lane, $meta, edit, discard, apply, revert, reset, remove, setLane, setField, suggest, closeSuggest, $suggest, meta: isMetaStore(meta) ? null : (meta ?? null), laneField: lane }
}
