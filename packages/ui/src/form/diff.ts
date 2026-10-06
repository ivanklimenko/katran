import type { FieldValue } from './types'

/** Строка диффа правки: label — 'опция' | 'счёт' | '1/'…'N/' | '' (текст без разбивки); пустая сторона — ''. */
export type EditDiffLine = { label: string; was: string; now: string }

/**
 * Что изменилось между двумя значениями SWIFT-поля (эталон diffLines, index.html:960–966):
 * опция, счёт, затем строки по номеру — только отличающиеся. Равные значения — [].
 */
export function diffFieldValues(was: FieldValue, now: FieldValue): EditDiffLine[] {
  const out: EditDiffLine[] = []
  const wasOpt = was.opt ?? ''
  const nowOpt = now.opt ?? ''
  if (wasOpt !== nowOpt) out.push({ label: 'опция', was: wasOpt, now: nowOpt })
  const wasAcc = was.acc ?? ''
  const nowAcc = now.acc ?? ''
  if (wasAcc !== nowAcc) out.push({ label: 'счёт', was: wasAcc, now: nowAcc })
  const n = Math.max(was.lines.length, now.lines.length)
  for (let k = 0; k < n; k++) {
    const a = was.lines[k] ?? ''
    const b = now.lines[k] ?? ''
    if (a !== b) out.push({ label: `${k + 1}/`, was: a, now: b })
  }
  return out
}

/** Дифф однострочного значения (20 исх, счёт, дата): одна строка без метки или []. */
export function diffText(was: string, now: string): EditDiffLine[] {
  return was === now ? [] : [{ label: '', was, now }]
}

/** «n изменение / изменения / изменений» — по правилам русского языка (план 2c, Р10; эталон ошибается с 21). */
export function editCountLabel(n: number): string {
  const d = n % 10
  const h = n % 100
  const word = d === 1 && h !== 11 ? 'изменение' : d >= 2 && d <= 4 && (h < 12 || h > 14) ? 'изменения' : 'изменений'
  return `${n} ${word}`
}
