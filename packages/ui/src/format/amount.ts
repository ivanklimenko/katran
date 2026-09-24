/** Разделитель разрядов — обычный неразрывный пробел (U+00A0). Узкий U+202F в Plex Sans на кегле 12.5 шириной ~2 px и не читается как разделитель. */
const NBSP = ' '
/** Сумма: разряды всегда разделены неразрывным пробелом, десятичная точка — как на стенде pi-constructor и в выгрузках АБС. */
export function formatAmount(n: number, fraction = 2): string {
  const sign = n < 0 ? '-' : ''
  const [int, frac] = Math.abs(n).toFixed(fraction).split('.')
  const grouped = (int ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  return sign + grouped + (frac ? '.' + frac : '')
}
