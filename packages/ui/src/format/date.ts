const p2 = (n: number) => String(n).padStart(2, '0')
const parse = (iso: string): Date | null => { const d = new Date(iso); return isNaN(d.getTime()) ? null : d }

// Дата без времени (как у бека: дата валютирования) — строкой, без new Date(): иначе полночь UTC
// в западных зонах показывалась бы предыдущим днём.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

export function formatDate(iso: string): string {
  const m = DATE_ONLY.exec(iso)
  if (m) {
    // строка проверяется сама (new Date() тут не участвует): месяц 1–12, день 1–31, иначе — пусто, как у невалидной строки
    const month = Number(m[2]), day = Number(m[3])
    return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? `${m[3]}.${m[2]}.${m[1]}` : ''
  }
  const d = parse(iso); if (!d) return ''
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`
}
const time = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`

/** Компактная форма для грида; полная — в тултипе. */
export function formatDateTimeShort(iso: string): string {
  const d = parse(iso); if (!d) return ''
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)} ${time(d)}`
}
export function formatDateTimeFull(iso: string): string {
  const d = parse(iso); if (!d) return ''
  return `${formatDate(iso)} ${time(d)}`
}
/** «дд.мм.гггг чч:мм» — дата и время из одного момента в локальной зоне (тултип блокировки записи, спека 5a §6). */
export function formatDateTimeMinutes(iso: string): string {
  const d = parse(iso); if (!d) return ''
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}
/** «дд.мм чч:мм» — день.месяц без года и время без секунд (вторая строка «Изм.» рублёвого реестра, решение В-Р1). */
export function formatDayMonthMinutes(iso: string): string {
  const d = parse(iso); if (!d) return ''
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}
