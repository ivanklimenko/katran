export type ShortAccount = { head: string; ccy: string; tail: string; short: boolean }
/** Счёт в гриде: первые 8 знаков … последние 3; знаки 6–8 — код валюты (эталон). */
export function shortAccount(acc: string): ShortAccount {
  const ccy = acc.slice(5, 8)
  if (acc.length <= 11) return { head: acc, ccy, tail: '', short: false }
  return { head: acc.slice(0, 8), ccy, tail: acc.slice(-3), short: true }
}
