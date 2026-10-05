import type { FakeServerOptions } from './server'

/** Регуляторы стенда в адресе: ?slow=N — задержка ровно N мс (иначе 0,25–0,65 с); ?fail=search|facets|suggest|meta|detail — отказ 500. */
export const browserFakeOptions: FakeServerOptions = {
  delayMs: () => { const slow = new URLSearchParams(location.search).get('slow'); return slow ? Number(slow) : 250 + Math.random() * 400 },
  failing: () => new URLSearchParams(location.search).get('fail'),
}
