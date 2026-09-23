import { attach, combine, createEffect, createEvent, createStore, sample, type Effect, type EventCallable, type Store } from 'effector'
import type { ColumnsState, Filter, GridPage, GridQuery, GridViewState, PersistAdapter, Selection, Sort } from './types'

export type GridPersisted = { widths: Record<string, number>; order: string[]; hidden: string[]; pageSize: number }

export type GridModelConfig<Row> = {
  id: string
  columns: { id: string; width?: number | undefined }[]
  pageSize?: number | undefined
  $filter: Store<Filter>
  fetchFx: Effect<GridQuery, GridPage<Row>>
  persist?: PersistAdapter<Partial<GridPersisted>> | undefined
  rowKey: (row: Row) => string
}

export type GridModel<Row> = {
  $rows: Store<Row[]>
  $total: Store<number>
  $page: Store<number>
  $pageSize: Store<number>
  $sort: Store<Sort>
  $widths: Store<Record<string, number>>
  $order: Store<string[]>
  $hidden: Store<string[]>
  $selection: Store<Selection>
  $state: Store<GridViewState>
  $error: Store<string | null>
  $query: Store<GridQuery>
  // EventCallable, а не Event: снаружи события нужно вызывать (model.sortBy(...) и т.д.), просто Event этого не позволяет.
  sortBy: EventCallable<Sort>
  resize: EventCallable<{ id: string; width: number }>
  setColumns: EventCallable<ColumnsState>
  toggleColumn: EventCallable<string>
  moveColumn: EventCallable<{ id: string; dir: -1 | 1 }>
  setPage: EventCallable<number>
  setPageSize: EventCallable<number>
  select: EventCallable<{ id: string; on: boolean }>
  selectPage: EventCallable<{ ids: string[]; on: boolean }>
  selectAll: EventCallable<void>
  clearSelection: EventCallable<void>
  retry: EventCallable<void>
  refresh: EventCallable<void>
  fetchFx: Effect<GridQuery, GridPage<Row>>
  rowKey: (row: Row) => string
}

const EMPTY_SELECTION: Selection = { mode: 'ids', ids: [] }
/** Запросы сравниваются по значению: GridQuery — простые данные (фильтр, сортировка, номер и размер страницы). */
const sameQuery = (a: GridQuery, b: GridQuery) => JSON.stringify(a) === JSON.stringify(b)

/** Сохранённый порядок сверяется с реальными колонками: чужие id выбрасываются, новые дописываются в конец. */
function reconcileOrder(saved: string[] | undefined, ids: string[]): string[] {
  const known = new Set(ids)
  const kept = (saved ?? []).filter((id) => known.has(id))
  const seen = new Set(kept)
  return [...kept, ...ids.filter((id) => !seen.has(id))]
}

export function createGridModel<Row>(cfg: GridModelConfig<Row>): GridModel<Row> {
  const ids = cfg.columns.map((c) => c.id)
  const saved = cfg.persist?.load(cfg.id) ?? {}
  const initialWidths: Record<string, number> = {}
  for (const c of cfg.columns) if (c.width !== undefined) initialWidths[c.id] = c.width
  Object.assign(initialWidths, Object.fromEntries(Object.entries(saved.widths ?? {}).filter(([id]) => ids.includes(id))))

  const sortBy = createEvent<Sort>()
  const resize = createEvent<{ id: string; width: number }>()
  const setColumns = createEvent<ColumnsState>()
  const toggleColumn = createEvent<string>()
  const moveColumn = createEvent<{ id: string; dir: -1 | 1 }>()
  const setPage = createEvent<number>()
  const setPageSize = createEvent<number>()
  const select = createEvent<{ id: string; on: boolean }>()
  const selectPage = createEvent<{ ids: string[]; on: boolean }>()
  const selectAll = createEvent<void>()
  const clearSelection = createEvent<void>()
  const retry = createEvent<void>()
  const refresh = createEvent<void>()

  const $rows = createStore<Row[]>([])
  const $total = createStore(0)
  const $page = createStore(1)
  const $pageSize = createStore(saved.pageSize ?? cfg.pageSize ?? 20)
  const $sort = createStore<Sort>(null)
  const $widths = createStore<Record<string, number>>(initialWidths)
  const $order = createStore<string[]>(reconcileOrder(saved.order, ids))
  const $hidden = createStore<string[]>((saved.hidden ?? []).filter((id) => ids.includes(id)))
  const $selection = createStore<Selection>(EMPTY_SELECTION)
  const $error = createStore<string | null>(null)
  const $hasData = createStore(false)

  // --- вид ---
  $widths.on(resize, (w, { id, width }) => ({ ...w, [id]: Math.max(36, Math.round(width)) }))
  $order.on(setColumns, (_, { order }) => reconcileOrder(order, ids))
  $hidden.on(setColumns, (_, { hidden }) => hidden.filter((id) => ids.includes(id)))
  $hidden.on(toggleColumn, (h, id) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]))
  $order.on(moveColumn, (o, { id, dir }) => {
    const i = o.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= o.length) return o
    const next = o.slice()
    next.splice(i, 1)
    next.splice(j, 0, id)
    return next
  })
  $pageSize.on(setPageSize, (_, n) => n)

  // --- выделение ---
  $selection
    .on(select, (s, { id, on }) => {
      if (s.mode === 'ids') return { mode: 'ids', ids: on ? (s.ids.includes(id) ? s.ids : [...s.ids, id]) : s.ids.filter((x) => x !== id) }
      return { mode: 'all', except: on ? s.except.filter((x) => x !== id) : (s.except.includes(id) ? s.except : [...s.except, id]) }
    })
    .on(selectPage, (s, { ids: page, on }) => {
      if (s.mode === 'ids') return { mode: 'ids', ids: on ? [...new Set([...s.ids, ...page])] : s.ids.filter((x) => !page.includes(x)) }
      return { mode: 'all', except: on ? s.except.filter((x) => !page.includes(x)) : [...new Set([...s.except, ...page])] }
    })
    .on(selectAll, () => ({ mode: 'all', except: [] }))
    .reset(clearSelection)

  // --- сортировка и страницы ---
  $sort.on(sortBy, (_, s) => s)
  $page.on(setPage, (_, n) => Math.max(1, n))
  // смена сортировки или размера страницы сбрасывает на первую страницу — .reset допустим, т.к. целевое значение (1) совпадает с начальным.
  // Объявлено раньше sample({clock: cfg.$filter, ...}) ниже: в одном тике effector сперва применяет .on/.reset у сторов, потом читает их в sample.
  $page.reset(sortBy, setPageSize)
  sample({ clock: cfg.$filter, fn: () => 1, target: $page })
  sample({ clock: cfg.$filter, fn: () => EMPTY_SELECTION, target: $selection })

  const $query = combine(cfg.$filter, $sort, $page, $pageSize, (filter, sort, page, size): GridQuery => ({ filter, sort, page: page - 1, size }))

  // Свой экземпляр эффекта на модель: fetchFx приложения может быть общим для нескольких гридов,
  // а done/fail/pending у attach-копии — только от вызовов этой модели.
  const requestFx = attach({ effect: cfg.fetchFx })

  // запрос: изменение фильтра, сортировки, страницы, размера страницы, refresh, retry.
  // Для $filter — отдельный сэмпл: $page сбрасывается в том же тике, но $query (combine) может ещё не пересчитаться к моменту чтения source в общем сэмпле,
  // поэтому страница берётся явной константой 0, а не через $query.
  sample({
    clock: cfg.$filter,
    source: { sort: $sort, size: $pageSize },
    fn: ({ sort, size }, filter): GridQuery => ({ filter, sort, page: 0, size }),
    target: requestFx,
  })
  sample({ clock: [sortBy, setPage, setPageSize, refresh, retry], source: $query, target: requestFx })

  // Принимается только ответ на текущий запрос: поздний ответ на старую страницу/фильтр не перезапишет актуальный.
  const doneData = sample({
    clock: requestFx.done,
    source: $query,
    filter: (q, { params }) => sameQuery(q, params),
    fn: (_, { result }) => result,
  })
  const failData = sample({
    clock: requestFx.fail,
    source: $query,
    filter: (q, { params }) => sameQuery(q, params),
    fn: (_, { error }) => error,
  })

  $rows.on(doneData, (_, p) => p.rows)
  $total.on(doneData, (_, p) => p.total)
  $hasData.on(doneData, () => true)
  $error
    .on(failData, (_, e) => (e instanceof Error ? e.message : String(e)))
    .reset(doneData, retry)

  const $state = combine(
    requestFx.pending,
    $hasData,
    $error,
    (pending, has, err): GridViewState => (pending ? (has ? 'refreshing' : 'loading') : err ? 'error' : has ? 'ready' : 'loading'),
  )

  // --- persist: изменения вида без запроса ---
  if (cfg.persist) {
    const persist = cfg.persist
    const $persisted = combine($widths, $order, $hidden, $pageSize, (widths, order, hidden, pageSize): GridPersisted => ({ widths, order, hidden, pageSize }))
    // .watch на sample под fork() не гарантированно срабатывает — используем эффект как target, эффекты исполняются в scope.
    const persistFx = createEffect((v: GridPersisted) => {
      persist.save(cfg.id, v)
    })
    sample({ clock: [resize, setColumns, toggleColumn, moveColumn, setPageSize], source: $persisted, target: persistFx })
  }

  return {
    $rows, $total, $page, $pageSize, $sort, $widths, $order, $hidden, $selection, $state, $error, $query,
    sortBy, resize, setColumns, toggleColumn, moveColumn, setPage, setPageSize,
    select, selectPage, selectAll, clearSelection, retry, refresh,
    fetchFx: cfg.fetchFx, rowKey: cfg.rowKey,
  }
}
