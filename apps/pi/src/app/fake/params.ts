import type { FakeServerOptions } from './server'

/**
 * Регуляторы стенда в адресе: ?slow=N — задержка ровно N мс (иначе 0,25–0,65 с); ?fail=search|facets|suggest|meta|detail — отказ 500;
 * ?fail=tab — 500 на любой вкладке деталки, ?fail=tab:<id> — только на вкладке <id>;
 * ?fail=edit — 500 на сохранении правки, ?fail=accounts — 500 на справочнике счетов; ?conflict=edit — 409 «Документ изменили» на любой правке (план 2c).
 * Каждый запрос — событие окна FAKE_REQUEST_EVENT с { method, url }: фейк живёт в странице, сеть его не видит, e2e считает запросы по событию.
 */
export const FAKE_REQUEST_EVENT = 'k-fake-request'
export const browserFakeOptions: FakeServerOptions = {
  delayMs: () => { const slow = new URLSearchParams(location.search).get('slow'); return slow ? Number(slow) : 250 + Math.random() * 400 },
  failing: () => new URLSearchParams(location.search).get('fail'),
  conflicting: () => new URLSearchParams(location.search).get('conflict'),
  observe: (req) => { window.dispatchEvent(new CustomEvent(FAKE_REQUEST_EVENT, { detail: { method: req.method, url: req.url } })) },
}
