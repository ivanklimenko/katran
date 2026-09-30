import { createEvent, createStore, sample, type Event, type EventCallable, type Store } from 'effector'

/** Слот деталки: a — у правого края окна, b — слева от a, для сравнения (спека 2a §3.1–3.2). */
export type DrawerSlot = 'a' | 'b'
export type DrawerEntry = { id: string; tab: string }
export type DrawerStackState = { a: DrawerEntry | null; b: DrawerEntry | null }
/** Запрос открытия. quiet — открытие не пользователем (автооткрытие): модель его не толкует, только передаёт в opened/alreadyOpen. */
export type DrawerOpen = { id: string; secondary: boolean; quiet?: boolean | undefined }
/** Куда лёг (или где уже открыт) документ; quiet — из запроса, только если он был true. */
export type DrawerHit = { id: string; slot: DrawerSlot; quiet?: boolean | undefined }

export type DrawerStackConfig = {
  /** Вкладка только что открытого документа; по умолчанию 'main' («Общие данные»). */
  firstTab?: string | undefined
}

export type DrawerStackModel = {
  $stack: Store<DrawerStackState>
  $a: Store<DrawerEntry | null>
  $b: Store<DrawerEntry | null>
  /** Слот, который закроет closeTop (и Esc): b, если открыт, иначе a; null — оба пусты. */
  $top: Store<DrawerSlot | null>
  open: EventCallable<DrawerOpen>
  close: EventCallable<DrawerSlot>
  closeTop: EventCallable<void>
  /** Закрыть оба слота — уход с экрана. */
  closeAll: EventCallable<void>
  setTab: EventCallable<{ slot: DrawerSlot; tab: string }>
  /** Документ впервые положен в слот — сигнал загрузки для потребителя (модель данных не знает). */
  opened: Event<DrawerHit>
  /** Документ уже открыт: стек не меняется, слот сообщается для фокуса. */
  alreadyOpen: Event<DrawerHit>
}

const EMPTY: DrawerStackState = { a: null, b: null }

const hit = (id: string, slot: DrawerSlot, quiet: boolean | undefined): DrawerHit => (quiet ? { id, slot, quiet: true } : { id, slot })

const slotOf = (s: DrawerStackState, id: string): DrawerSlot | null => (s.a?.id === id ? 'a' : s.b?.id === id ? 'b' : null)

/** Обычное открытие заменяет A; secondary кладёт в B, а при пустом A — в A (эталон grid.html:2152–2189, уточнение спеки 2a §3.2). */
function place(s: DrawerStackState, id: string, secondary: boolean, tab: string): DrawerStackState {
  const entry = { id, tab }
  return secondary && s.a ? { a: s.a, b: entry } : { a: entry, b: s.b }
}

/** Закрытие A при открытом B сдвигает B в A — второй документ остаётся у правого края. */
function remove(s: DrawerStackState, slot: DrawerSlot): DrawerStackState {
  if (slot === 'b') return { a: s.a, b: null }
  return s.b ? { a: s.b, b: null } : EMPTY
}

/** Стек двух drawer'ов деталки: что где открыто и на какой вкладке. Загрузку данных модель не знает. */
export function createDrawerStackModel(cfg: DrawerStackConfig = {}): DrawerStackModel {
  const firstTab = cfg.firstTab ?? 'main'
  const open = createEvent<DrawerOpen>()
  const close = createEvent<DrawerSlot>()
  const closeTop = createEvent<void>()
  const closeAll = createEvent<void>()
  const setTab = createEvent<{ slot: DrawerSlot; tab: string }>()
  const opened = createEvent<DrawerHit>()
  const alreadyOpen = createEvent<DrawerHit>()

  const $stack = createStore<DrawerStackState>(EMPTY)
  const $a = $stack.map((s) => s.a)
  const $b = $stack.map((s) => s.b)
  const $top = $stack.map((s): DrawerSlot | null => (s.b ? 'b' : s.a ? 'a' : null))

  sample({
    clock: open,
    source: $stack,
    filter: (s, p) => slotOf(s, p.id) !== null,
    fn: (s, p) => hit(p.id, slotOf(s, p.id) ?? 'a', p.quiet),
    target: alreadyOpen,
  })
  const placed = sample({
    clock: open,
    source: $stack,
    filter: (s, p) => slotOf(s, p.id) === null,
    fn: (s, p) => ({ next: place(s, p.id, p.secondary, firstTab), id: p.id, quiet: p.quiet }),
  })
  $stack.on(placed, (_, x) => x.next)
  sample({ clock: placed, fn: ({ next, id, quiet }) => hit(id, slotOf(next, id) ?? 'a', quiet), target: opened })

  $stack.on(close, (s, slot) => remove(s, slot))
  sample({ clock: closeTop, source: $top, filter: (top: DrawerSlot | null): top is DrawerSlot => top !== null, target: close })
  $stack.on(closeAll, () => EMPTY)
  $stack.on(setTab, (s, { slot, tab }) => {
    const e = s[slot]
    if (!e) return s
    return slot === 'a' ? { a: { ...e, tab }, b: s.b } : { a: s.a, b: { ...e, tab } }
  })

  return { $stack, $a, $b, $top, open, close, closeTop, closeAll, setTab, opened, alreadyOpen }
}
