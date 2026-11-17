import { attach, combine, createEvent, createStore, sample, type Effect, type Store } from 'effector'

/** Внутренний запрос грида: поколение хранится в scope и меняется при запросе и смене активности. */
export function activeRequest<P, R>($active: Store<boolean>, $query: Store<P>, fetchFx: Effect<P, R>, same: (a: P, b: P) => boolean) {
  const request = createEvent<P>()
  const started = createEvent<P>()
  sample({ clock: request, filter: $active, target: started })
  const $version = createStore(0).on(started, (version) => version + 1).on($active, (version) => version + 1)
  type Call = { query: P; version: number }
  const effect = attach({ effect: fetchFx, mapParams: (call: Call) => call.query })
  sample({ clock: started, source: $version, fn: (version, query): Call => ({ query, version }), target: effect })
  const $current = combine({ active: $active, query: $query, version: $version })
  const done = sample({
    clock: effect.done,
    source: $current,
    filter: (state, { params }) => state.active && state.version === params.version && same(state.query, params.query),
    fn: (_, { result }) => result,
  })
  const failed = sample({
    clock: effect.fail,
    source: $current,
    filter: (state, { params }) => state.active && state.version === params.version && same(state.query, params.query),
    fn: (_, { error }) => error,
  })
  // pending attached-эффекта включает старые визиты; состояние вида зависит только от текущего запроса.
  const $pending = createStore(false).on(started, () => true).on($active, () => false).reset(done, failed)
  return { request, done, failed, $pending }
}
