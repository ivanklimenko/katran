const NNBSP = ' '
/** Сумма: группы разделены узким неразрывным пробелом, десятичная запятая. */
export function formatAmount(n: number, fraction = 2): string {
  const sign = n < 0 ? '-' : ''
  const [int, frac] = Math.abs(n).toFixed(fraction).split('.')
  const grouped = (int ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP)
  return sign + grouped + (frac ? ',' + frac : '')
}
