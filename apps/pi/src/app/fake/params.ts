import type { FakeServerOptions } from './server'

/**
 * Регуляторы стенда в адресе: ?slow=N — задержка ровно N мс (иначе 0,25–0,65 с); ?fail=search|facets|suggest|meta|detail — отказ 500;
 * ?fail=tab — 500 на любой вкладке деталки, ?fail=tab:<id> — только на вкладке <id>;
 * ?fail=edit — 500 на сохранении правки, ?fail=accounts — 500 на справочнике счетов; ?conflict=edit — 409 «Документ изменили» на любой правке (план 2c);
 * ?fail=decide — 500 на «Утвердить»/«Отклонить» правки, ?fail=message — 500 на «Скачать», ?fail=print — 500 на печатной форме (план 2d).
 * Срез 2e: ?annul=instant|pending|fail — итог аннулирования: instant — сразу (статус «Отказ»), pending — через утверждение, fail — команда принята,
 * документ не изменился (без регулятора — по правилу фейка: сумма > 1 000 000 — через утверждение);
 * ?fail=annul|rates|balances|resend|notifmsg — 500 на аннулировании (annul, confirm, reject), курсах, остатках, переотправке нотификаций, исходном сообщении.
 * Повторная переотправка документа в течение 2 с — 409 (RESEND_WINDOW_MS, notif.ts).
 * Каждый запрос — событие окна FAKE_REQUEST_EVENT с { method, url }: фейк живёт в странице, сеть его не видит, e2e считает запросы по событию.
 */
export const FAKE_REQUEST_EVENT = 'k-fake-request'
export const browserFakeOptions: FakeServerOptions = {
  delayMs: () => { const slow = new URLSearchParams(location.search).get('slow'); return slow ? Number(slow) : 250 + Math.random() * 400 },
  failing: () => new URLSearchParams(location.search).get('fail'),
  conflicting: () => new URLSearchParams(location.search).get('conflict'),
  annulMode: () => new URLSearchParams(location.search).get('annul'),
  observe: (req) => { window.dispatchEvent(new CustomEvent(FAKE_REQUEST_EVENT, { detail: { method: req.method, url: req.url } })) },
}
