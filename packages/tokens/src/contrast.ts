import type { ColorSet } from './tokens.src'

const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)

export function luminance(hex: string): number {
  const m = hex.replace('#', '').match(/.{2}/g)
  if (!m || m.length < 3) throw new Error(`Не hex-цвет: ${hex}`)
  const [r, g, b] = m.map((x) => channel(parseInt(x, 16) / 255)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(fg: string, bg: string): number {
  const a = luminance(fg), b = luminance(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

export type ContrastRule = { fg: string; bg: string[]; min: number; note: string }
export type Violation = { fg: string; bg: string; ratio: number; min: number; note: string }

export function checkPalette(colors: ColorSet, rules: ContrastRule[]): Violation[] {
  const out: Violation[] = []
  for (const r of rules) for (const bg of r.bg) {
    const f = colors[r.fg], b = colors[bg]
    if (!f || !b) throw new Error(`Нет токена ${!f ? r.fg : bg}`)
    const ratio = contrastRatio(f, b)
    if (ratio < r.min) out.push({ fg: r.fg, bg, ratio: +ratio.toFixed(2), min: r.min, note: r.note })
  }
  return out
}
