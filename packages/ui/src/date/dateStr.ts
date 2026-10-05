/** Даты как строки (спека 2026-09-30 §3): ISO-строки не разбираются через new Date(string) — разбор строки без зоны
 * браузер трактует как UTC и сдвигает день в западных зонах. Арифметика — число дней от эпохи (алгоритм Хиннанта). */
export type IsoDay = string
export type IsoMinute = string
export type DateValue = IsoDay | IsoMinute | ''
export type DateFormat = string

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MIN_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
const p2 = (n: number) => String(n).padStart(2, '0')
const p4 = (n: number) => String(n).padStart(4, '0')
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export const daysInMonth = (y: number, m: number): number => (m === 2 && isLeap(y) ? 29 : MONTH_DAYS[m - 1]!)
export const makeDay = (y: number, m: number, d: number): IsoDay => `${p4(y)}-${p2(m)}-${p2(d)}`

export function isValidDay(s: string): boolean {
  const m = DAY_RE.exec(s)
  if (!m) return false
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  return y >= 1 && mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo)
}
export function isValidMinute(s: string): boolean {
  const m = MIN_RE.exec(s)
  return m !== null && isValidDay(`${m[1]}-${m[2]}-${m[3]}`) && Number(m[4]) <= 23 && Number(m[5]) <= 59
}

const split = (day: IsoDay): [number, number, number] => [Number(day.slice(0, 4)), Number(day.slice(5, 7)), Number(day.slice(8, 10))]

function toDays(y0: number, m: number, d: number): number {
  const y = m <= 2 ? y0 - 1 : y0
  const era = Math.floor(y / 400)
  const yoe = y - era * 400
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}
function fromDays(z0: number): [number, number, number] {
  const z = z0 + 719468
  const era = Math.floor(z / 146097)
  const doe = z - era * 146097
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1
  const m = mp < 10 ? mp + 3 : mp - 9
  return [yoe + era * 400 + (m <= 2 ? 1 : 0), m, d]
}

export const dayOf = (v: IsoDay | IsoMinute): IsoDay => v.slice(0, 10)
/** 'чч:мм' у IsoMinute, '' у IsoDay. */
export const timeOf = (v: IsoDay | IsoMinute): string => (v.length > 10 ? v.slice(11, 16) : '')
export function addDays(day: IsoDay, n: number): IsoDay {
  const [y, m, d] = split(day)
  return makeDay(...fromDays(toDays(y, m, d) + n))
}
/** Сдвиг на месяцы; день, которого нет в целевом месяце, становится последним днём месяца (31.01 + 1 → 28/29.02). */
export function addMonths(day: IsoDay, n: number): IsoDay {
  const [y, m, d] = split(day)
  const t = y * 12 + (m - 1) + n
  const ny = Math.floor(t / 12)
  const nm = t - ny * 12 + 1
  return makeDay(ny, nm, Math.min(d, daysInMonth(ny, nm)))
}
export const startOfMonth = (day: IsoDay): IsoDay => `${day.slice(0, 8)}01`
export function endOfMonth(day: IsoDay): IsoDay {
  const [y, m] = split(day)
  return makeDay(y, m, daysInMonth(y, m))
}
/** День недели: понедельник = 1 … воскресенье = 7. 1970-01-01 — четверг. */
export function weekday(day: IsoDay): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const [y, m, d] = split(day)
  const z = toDays(y, m, d)
  return ((((z + 3) % 7) + 7) % 7 + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7
}
/** 42 дня: 6 недель с понедельника, начиная с недели, где 1-е число месяца. */
export function monthGrid(month: IsoDay): IsoDay[] {
  const first = startOfMonth(month)
  const start = addDays(first, 1 - weekday(first))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}
/** Сегодня по локальным часам машины. */
export function todayLocal(): IsoDay {
  const d = new Date()
  return makeDay(d.getFullYear(), d.getMonth() + 1, d.getDate())
}
export const compareDates = (a: IsoDay | IsoMinute, b: IsoDay | IsoMinute): -1 | 0 | 1 => (a < b ? -1 : a > b ? 1 : 0)

// --- формат-шаблон: токены DD MM YYYY HH mm и любые разделители между ними ---
const TOKENS = /YYYY|DD|MM|HH|mm/g
type Part = { tok: 'YYYY' | 'DD' | 'MM' | 'HH' | 'mm' } | { sep: string }
function partsOf(format: DateFormat): Part[] {
  const out: Part[] = []
  let last = 0
  for (const m of format.matchAll(TOKENS)) {
    if (m.index! > last) out.push({ sep: format.slice(last, m.index) })
    out.push({ tok: m[0] as 'YYYY' | 'DD' | 'MM' | 'HH' | 'mm' })
    last = m.index! + m[0].length
  }
  if (last < format.length) out.push({ sep: format.slice(last) })
  return out
}
/** Часть шаблона до времени: 'DD.MM.YYYY HH:mm' → 'DD.MM.YYYY'. */
export function datePartOf(format: DateFormat): DateFormat {
  const i = format.indexOf('HH')
  return i < 0 ? format : format.slice(0, i).replace(/[^A-Za-z]+$/, '')
}
/** Шаблон с временем или без: время дописывается как ' HH:mm', если его нет. */
export const withTime = (format: DateFormat, time: boolean): DateFormat =>
  (time ? (format.includes('HH') ? format : `${format} HH:mm`) : datePartOf(format))

/** Оставляет цифры и расставляет разделители шаблона по мере ввода; лишние цифры отбрасываются. */
export function maskDateText(text: string, format: DateFormat): string {
  const digits = text.replace(/\D/g, '')
  let i = 0
  let out = ''
  for (const p of partsOf(format)) {
    if (i >= digits.length) break
    if ('sep' in p) { out += p.sep; continue }
    const chunk = digits.slice(i, i + p.tok.length)
    out += chunk
    i += chunk.length
    if (chunk.length < p.tok.length) break
  }
  // разделитель в конце ставится, только если за ним уже пошли цифры
  return out.replace(/[^0-9]+$/, '')
}
/** Полная строка: вся дата по шаблону; если в шаблоне есть время — или без времени, или с ним целиком. */
export function isComplete(text: string, format: DateFormat): boolean {
  const dateLen = datePartOf(format).length
  return text.length === dateLen || text.length === format.length
}
/** Полная строка по шаблону → ISO; неполная или невалидная — null. */
export function parseDateText(text: string, format: DateFormat): IsoDay | IsoMinute | null {
  if (!isComplete(text, format)) return null
  const fmt = text.length === format.length ? format : datePartOf(format)
  const got: Record<string, string> = {}
  let i = 0
  for (const p of partsOf(fmt)) {
    if ('sep' in p) {
      if (text.slice(i, i + p.sep.length) !== p.sep) return null
      i += p.sep.length
      continue
    }
    const chunk = text.slice(i, i + p.tok.length)
    if (!/^\d+$/.test(chunk) || chunk.length !== p.tok.length) return null
    got[p.tok] = chunk
    i += p.tok.length
  }
  const day = `${got.YYYY}-${got.MM}-${got.DD}`
  if (got.HH === undefined) return isValidDay(day) ? day : null
  const minute = `${day}T${got.HH}:${got.mm}`
  return isValidMinute(minute) ? minute : null
}
/** ISO → строка по шаблону; у дня без времени часть шаблона со временем не выводится. */
export function formatDateText(value: IsoDay | IsoMinute, format: DateFormat): string {
  const fmt = value.length > 10 ? format : datePartOf(format)
  const [y, m, d] = split(value)
  const t = timeOf(value)
  return fmt.replace(TOKENS, (tok) => (tok === 'YYYY' ? p4(y) : tok === 'MM' ? p2(m) : tok === 'DD' ? p2(d) : tok === 'HH' ? t.slice(0, 2) : t.slice(3, 5)))
}

// --- границы со смещением зоны: смещение — на эту минуту (день перехода на летнее время — верно) ---
function offset(y: number, m: number, d: number, hh: number, mm: number): string {
  const o = -new Date(y, m - 1, d, hh, mm).getTimezoneOffset()
  const a = Math.abs(o)
  return `${o < 0 ? '-' : '+'}${p2(Math.floor(a / 60))}:${p2(a % 60)}`
}
function bound(minute: IsoMinute, sec: string): string {
  const [y, m, d] = split(minute)
  const hh = Number(minute.slice(11, 13)), mm = Number(minute.slice(14, 16))
  return `${minute}:${sec}${offset(y, m, d, hh, mm)}`
}
export const isoMinuteStart = (minute: IsoMinute): string => bound(minute, '00')
export const isoMinuteEnd = (minute: IsoMinute): string => bound(minute, '59')
export const isoDayStart = (day: IsoDay): string => isoMinuteStart(`${day}T00:00`)
export const isoDayEnd = (day: IsoDay): string => isoMinuteEnd(`${day}T23:59`)
