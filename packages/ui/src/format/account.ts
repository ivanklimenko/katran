export type ShortAccount = { head: string; ccy: string; tail: string; short: boolean }
/** Счёт в гриде: первые 8 знаков … последние tail (4 по умолчанию, 3 — рублёвый реестр); знаки 6–8 — код валюты (эталон 9e98754). */
export function shortAccount(acc: string, tail: 3 | 4 = 4): ShortAccount {
  const ccy = acc.slice(5, 8)
  if (acc.length <= 8 + tail) return { head: acc, ccy, tail: '', short: false }
  return { head: acc.slice(0, 8), ccy, tail: acc.slice(-tail), short: true }
}
