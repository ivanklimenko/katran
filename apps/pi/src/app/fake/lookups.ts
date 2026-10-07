/**
 * Справочные запросы фейка (спека 2e §3.7, pi-api.md §1.12, §1.13): курсы и остатки. Числа — строками, уже отформатированными «беком»
 * (запятая, неразрывные пробелы между разрядами); все значения вымышленные и детерминированы от входа (валюта, дата, счёт).
 */

type Detail = Record<string, unknown>

const NBSP = ' '
/** «1 234 567,89»: два знака, запятая, неразрывные пробелы между разрядами. */
export function money(n: number): string {
  const [int = '0', frac = '00'] = Math.abs(n).toFixed(2).split('.')
  return `${n < 0 ? '-' : ''}${int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)},${frac}`
}
/** Курс с четырьмя знаками через запятую: «92,4517». */
const rateText = (r: number) => r.toFixed(4).replace('.', ',')

/** FNV-1a: небольшой устойчивый хеш строки. */
function hashOf(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/** Вымышленные базовые курсы ЦБ (рублей за единицу валюты): на дату уходят вверх-вниз до ±2 % от хеша даты и валюты. */
const BASE_RATE: Record<string, number> = { USD: 92.45, EUR: 100.2, CNY: 12.75, RUB: 1 }
/** Валюта зачисления по конверсии (вымышленная пара к валюте списания). */
const DEAL_TO: Record<string, string> = { USD: 'EUR', EUR: 'USD', CNY: 'USD', RUB: 'USD' }

/** Курс ЦБ валюты на дату: детерминированно от пары (валюта, дата). Рубль — ровно 1. */
export function cbRate(ccy: string, date: string): number {
  const base = BASE_RATE[ccy] ?? 1
  if (ccy === 'RUB') return base
  return Math.round(base * (1 + ((hashOf(`${ccy}|${date}`) % 401) - 200) / 10000) * 10000) / 10000
}

/**
 * Курсы документа валюты: `cb` — курс ЦБ валюты 32A на дату 32A и рублёвый эквивалент суммы; `deal` — у документов с полем 36
 * (курс — значение поля 36, валюта списания — из поля 33B, зачисления — вымышленная пара), у прочих `null`.
 */
export function ratesOf(detail: Detail): unknown {
  const ccy = String(detail.currency)
  const date = String(detail.vdDt ?? detail.created).slice(0, 10)
  const amount = Number(detail.amount)
  const rate = cbRate(ccy, date)
  const fields = (detail.fields ?? {}) as Record<string, { lines?: string[] } | undefined>
  const f36 = fields['36']?.lines?.[0]
  const from = (fields['33B']?.lines?.[0] ?? '').split(' ')[0] || ccy
  return {
    cb: { rate: rateText(rate), date, rub: money(amount * rate) },
    deal: f36 ? { rate: f36, from, to: DEAL_TO[from] ?? 'USD', amount: money(amount) } : null,
  }
}

/** Счёт сида, которого «нет в АБС»: счёт доходов по комиссиям — он есть в проводках документов с комиссией (каждый третий валютный). */
export const ABS_ERROR_ACCOUNT = '70601840100000000519'
export const ABS_ERROR_TEXT = 'Счёт не найден в АБС'

/**
 * Остатки по уникальным счетам проводок в порядке проводок: остаток — детерминированно от хеша счёта, `available` у трети счетов `null`;
 * у счёта сида — `error`. `asOf` — текущее время фейка.
 */
export function balancesOf(detail: Detail, asOf: string): unknown {
  const txs = (detail.txs ?? []) as { acc: string; currency: string }[]
  const seen = new Set<string>()
  const items: Record<string, unknown>[] = []
  for (const t of txs) {
    if (seen.has(t.acc)) continue
    seen.add(t.acc)
    if (t.acc === ABS_ERROR_ACCOUNT) { items.push({ acc: t.acc, ccy: t.currency, error: ABS_ERROR_TEXT }); continue }
    const h = hashOf(t.acc)
    const balance = 1000 + (h % 900_000_000) / 100
    items.push({ acc: t.acc, ccy: t.currency, balance: money(balance), available: h % 3 === 0 ? null : money(balance - (h % 1000)) })
  }
  return { asOf, items }
}
