export type ShortAccount = { head: string; ccy: string; tail: string; short: boolean }
/** Счёт в гриде: первые 8 знаков … последние 4; знаки 6–8 — код валюты (эталон 9e98754). */
export function shortAccount(acc: string): ShortAccount {
  const ccy = acc.slice(5, 8)
  if (acc.length <= 12) return { head: acc, ccy, tail: '', short: false }
  return { head: acc.slice(0, 8), ccy, tail: acc.slice(-4), short: true }
}
