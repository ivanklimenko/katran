const p2 = (n: number) => String(n).padStart(2, '0')
const parse = (iso: string): Date | null => { const d = new Date(iso); return isNaN(d.getTime()) ? null : d }

export function formatDate(iso: string): string {
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
