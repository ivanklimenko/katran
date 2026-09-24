import { combine, createEvent, createStore, sample, type EventCallable, type Store } from 'effector'
import type { Condition, Filter, FilterMeta, Scalar } from './types'

export type FiltersModelConfig = {
  meta?: FilterMeta | undefined
  initial?: Filter | undefined
  /** Поле, которым управляет лейн статусов (спека 1e, §3). Без него setLane — no-op. */
  laneField?: string | undefined
}

export type FiltersModel = {
  /** Применённые условия — это и есть $filter для грида. */
  $conditions: Store<Filter>
  /** Черновик панели до нажатия «Применить». */
  $draft: Store<Filter>
  $dirty: Store<boolean>
  /** Значение условия EQ по laneField в применённых, иначе null (условие IN по тому же полю — тоже null). */
  $lane: Store<Scalar | null>
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
  meta: FilterMeta | null
  laneField: string | null
}

const upsert = (list: Filter, c: Condition): Filter => {
  const i = list.findIndex((x) => x.field === c.field)
  return i < 0 ? [...list, c] : list.map((x, j) => (j === i ? c : x))
}
const without = (list: Filter, field: string): Filter => list.filter((x) => x.field !== field)
const same = (a: Filter, b: Filter) => JSON.stringify(a) === JSON.stringify(b)

export function createFiltersModel({ meta, initial = [], laneField }: FiltersModelConfig = {}): FiltersModel {
  const edit = createEvent<Condition>()
  const discard = createEvent<string>()
  const apply = createEvent<void>()
  const revert = createEvent<void>()
  const reset = createEvent<void>()
  const remove = createEvent<string>()
  const setLane = createEvent<Scalar | null>()

  const $conditions = createStore<Filter>(initial)
  const $draft = createStore<Filter>(initial)

  const lane = laneField ?? null
  // лейн пишет в оба стора одинаково: условие EQ по полю лейна ставится или снимается, остальное не трогается
  const applyLane = (list: Filter, v: Scalar | null): Filter =>
    lane === null ? list : v === null ? without(list, lane) : upsert(list, { field: lane, op: 'EQ', value: v })

  // reset должен очищать стор в [], а не откатывать к initial из конфига — .reset() тут не подходит.
  // remove снимает условие и из применённых, и из черновика (чтобы панель не показывала снятое),
  // не трогая неприменённые правки других полей в черновике.
  $draft.on(edit, upsert).on(discard, without).on(remove, without).on(reset, () => []).on(setLane, applyLane)
  $conditions.on(remove, without).on(reset, () => []).on(setLane, applyLane)
  // apply: черновик → применённые
  sample({ clock: apply, source: $draft, target: $conditions })
  // revert: применённые → черновик («Отменить» панели)
  sample({ clock: revert, source: $conditions, target: $draft })

  const $dirty = combine($conditions, $draft, (c, d) => !same(c, d))
  const $lane = $conditions.map((list): Scalar | null => {
    if (lane === null) return null
    const c = list.find((x) => x.field === lane)
    return c && c.op === 'EQ' ? c.value : null
  })

  return { $conditions, $draft, $dirty, $lane, edit, discard, apply, revert, reset, remove, setLane, meta: meta ?? null, laneField: lane }
}
