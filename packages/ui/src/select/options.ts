import type { Scalar } from '../filters/types'

/** Вариант справочника: hint — приглушённо справа (код, BIC, вид счёта); tag — метка между подписью и hint (валюта счёта). */
export type Option = { value: Scalar; label: string; hint?: string | undefined; tag?: string | undefined }

export const sameScalar = (a: Scalar, b: Scalar): boolean => a === b

/** Поиск без учёта регистра по вхождению в подпись, подсказку и строковое значение; пустой запрос — все варианты. */
export function filterOptions(options: Option[], query: string): Option[] {
  const q = query.trim().toLowerCase()
  if (q === '') return options
  return options.filter((o) => o.label.toLowerCase().includes(q) || (o.hint ?? '').toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q))
}
