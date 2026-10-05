const p2 = (n: number) => String(n).padStart(2, '0')

/** Метка времени события по частям: дата без года, время, миллисекунды отдельно (приглушаются), полная форма — для тултипа. */
export type TimestampParts = {
  /** 'ДД.ММ' */
  date: string
  /** 'ЧЧ:ММ:СС' */
  time: string
  /** '123' — три цифры; '' — у метки нет долей секунды */
  ms: string
  /** 'ДД.ММ.ГГГГ ЧЧ:ММ:СС.ммм' (без '.ммм', если долей нет) */
  full: string
}

// Время вкладок бек отдаёт ISO без зоны: '2026-09-22T07:31:45.241', иногда без долей секунды. Разбор — настенное время:
// берутся цифры строки, без new Date() и без пересчёта в зону браузера (как эталон tmHtml, index.html:1157).
// Разделитель — «T» или пробел; хвост зоны («Z», ±ЧЧ:ММ, ±ЧЧММ) допускается и тоже не пересчитывается — показываются цифры строки.
const ISO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:Z|[+-]\d{2}:?\d{2})?$/

type Wall = { y: number; mo: number; d: number; h: number; mi: number; s: number; ms: string }

function wall(iso: string): Wall | null {
  const m = ISO.exec(iso.trim())
  if (!m) return null
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6]].map(Number) as [number, number, number, number, number, number]
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null
  // доли секунды — ровно три знака: '5' → '500', '051765' → '051' (лишние отбрасываются, не округляются)
  return { y, mo, d, h, mi, s, ms: m[7] === undefined ? '' : m[7].slice(0, 3).padEnd(3, '0') }
}

/** Разбор метки времени бека; null — строка не дата-время ISO (показывается как есть). */
export function formatTimestamp(iso: string): TimestampParts | null {
  const w = wall(iso)
  if (!w) return null
  const date = `${p2(w.d)}.${p2(w.mo)}`
  const time = `${p2(w.h)}:${p2(w.mi)}:${p2(w.s)}`
  return { date, time, ms: w.ms, full: `${date}.${w.y} ${time}${w.ms ? `.${w.ms}` : ''}` }
}

/**
 * Миллисекунды между двумя метками времени бека (to − from) по цифрам строк, как formatTimestamp (зона не учитывается);
 * null — одна из меток не разобралась. Для Δ статусов (эталон dur(), index.html:1159).
 */
export function timestampDiff(from: string, to: string): number | null {
  const a = wall(from), b = wall(to)
  if (!a || !b) return null
  const t = (w: Wall) => Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s, w.ms ? Number(w.ms) : 0)
  return t(b) - t(a)
}

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN

/**
 * Длительность для людей (Δ статусов, эталон dur(), index.html:1159):
 * до секунды — «850 мс»; до минуты — секунды с одним знаком через запятую, без округления вверх («59,9 с», не «60,0 с»);
 * до часа — «3 мин 5 с» (ноль секунд не пишется: «1 мин»); дальше — «2 ч 10 мин» («1 ч»).
 * Дробные миллисекунды округляются до целых. Отрицательное, NaN и бесконечность — '' (как эталон: Δ не показывается).
 * Порог «медленно» задаёт вызывающий.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return ''
  const n = Math.round(ms)
  if (n < SEC) return `${n} мс`
  if (n < MIN) {
    const tenths = Math.floor(n / 100)
    return `${Math.floor(tenths / 10)},${tenths % 10} с`
  }
  if (n < HOUR) {
    const m = Math.floor(n / MIN), s = Math.floor((n % MIN) / SEC)
    return s ? `${m} мин ${s} с` : `${m} мин`
  }
  const h = Math.floor(n / HOUR), m = Math.floor((n % HOUR) / MIN)
  return m ? `${h} ч ${m} мин` : `${h} ч`
}
