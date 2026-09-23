import { combine, createEvent, createStore, sample, type EventCallable, type Store } from 'effector'
import type { Condition, Filter, FilterMeta } from './types'

export type FiltersModelConfig = {
  meta?: FilterMeta | undefined
  initial?: Filter | undefined
}

export type FiltersModel = {
  /** Применённые условия — это и есть $filter для грида. */
  $conditions: Store<Filter>
  /** Черновик панели до нажатия «Применить». */
  $draft: Store<Filter>
  $dirty: Store<boolean>
  // EventCallable, а не Event: снаружи события нужно вызывать (edit(...), apply()), просто Event этого не позволяет.
  edit: EventCallable<Condition>
  discard: EventCallable<string>
  apply: EventCallable<void>
  reset: EventCallable<void>
  remove: EventCallable<string>
  meta: FilterMeta | null
}

const upsert = (list: Filter, c: Condition): Filter => {
  const i = list.findIndex((x) => x.field === c.field)
  return i < 0 ? [...list, c] : list.map((x, j) => (j === i ? c : x))
}
const without = (list: Filter, field: string): Filter => list.filter((x) => x.field !== field)
const same = (a: Filter, b: Filter) => JSON.stringify(a) === JSON.stringify(b)

export function createFiltersModel({ meta, initial = [] }: FiltersModelConfig = {}): FiltersModel {
  const edit = createEvent<Condition>()
  const discard = createEvent<string>()
  const apply = createEvent<void>()
  const reset = createEvent<void>()
  const remove = createEvent<string>()

  const $conditions = createStore<Filter>(initial)
  const $draft = createStore<Filter>(initial)

  // reset должен очищать стор в [], а не откатывать к initial из конфига — .reset() тут не подходит.
  $draft.on(edit, upsert).on(discard, without).on(reset, () => [])
  $conditions.on(remove, without).on(reset, () => [])
  // apply: черновик → применённые; remove: применённые → черновик (чтобы панель не показывала снятое)
  sample({ clock: apply, source: $draft, target: $conditions })
  sample({ clock: remove, source: $conditions, target: $draft })

  const $dirty = combine($conditions, $draft, (c, d) => !same(c, d))

  return { $conditions, $draft, $dirty, edit, discard, apply, reset, remove, meta: meta ?? null }
}
