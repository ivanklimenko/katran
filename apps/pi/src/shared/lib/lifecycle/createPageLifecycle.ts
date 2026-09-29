import { createEvent, createStore, type EventCallable, type Store } from 'effector'

/** Жизненный цикл экрана: роутер вызывает pageOpened/pageClosed, модели читают $opened. Модели о роутере не знают. */
export type PageLifecycle = { pageOpened: EventCallable<void>; pageClosed: EventCallable<void>; $opened: Store<boolean> }

export function createPageLifecycle(): PageLifecycle {
  const pageOpened = createEvent<void>()
  const pageClosed = createEvent<void>()
  const $opened = createStore(false).on(pageOpened, () => true).on(pageClosed, () => false)
  return { pageOpened, pageClosed, $opened }
}
