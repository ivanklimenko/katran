import type { CodeLanguage } from '@katran/ui'
import type { TabContext } from '../../../shared/lib/detail'

/** Пропсы вида вкладки: данные, разобранные парсером той же вкладки (TRAIL_PARSERS), и контекст деталки. */
export type TrailTabProps<T> = { data: T; ctx: TabContext }

/** Заглушки кнопок вкладок до среза 2d (как у лейна 2a). */
export const STUB = 'Действие будет в 2d'

/** Порог «медленно» для Δ статусов (эталон statusesHtml: > 30 с). */
export const SLOW_MS = 30000

/** Новый список раскрытых ключей: открыть — в конец без дублей, закрыть — убрать. */
export const toggleKey = (keys: string[], key: string, open: boolean): string[] =>
  open ? (keys.includes(key) ? keys : [...keys, key]) : keys.filter((k) => k !== key)

/** «N ключ / ключа / ключей» — склонение по правилам русского (эталон auditHtml ошибался на 21, 22…). */
export function keysLabel(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return `${n} ключ`
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ключа`
  return `${n} ключей`
}

/** Язык исходника (эталон sourceHtml): начинается с «<» — XML, иначе SWIFT. */
export const codeLanguage = (text: string): CodeLanguage => (/^\s*</.test(text) ? 'xml' : 'swift')
