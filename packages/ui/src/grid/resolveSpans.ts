import type { ColumnDef, ResolvedSpan, SpanDef } from './types'

/**
 * Сквозные сегменты адресуются по id колонок, не числом colspan — состав колонок пользовательский (спека 6.3).
 * Диапазон берётся по ПОЛНОМУ порядку (между from и to включительно, границы нормализуются),
 * а индексы считаются по видимым колонкам: скрытые сжимают сегмент, полностью скрытый диапазон сегмента не даёт.
 */
export function resolveSpans(spans: SpanDef<unknown>[], visibleOrder: string[], fullOrder: string[] = visibleOrder): ResolvedSpan[] {
  const out: ResolvedSpan[] = []
  for (const s of spans) {
    const fa = fullOrder.indexOf(s.from)
    const fb = fullOrder.indexOf(s.to)
    if (fa < 0 || fb < 0) continue
    const [lo, hi] = fa <= fb ? [fa, fb] : [fb, fa]
    const covered = new Set(fullOrder.slice(lo, hi + 1))
    const idx = visibleOrder.map((id, i) => (covered.has(id) ? i : -1)).filter((i) => i >= 0)
    if (idx.length === 0) continue
    const start = Math.min(...idx)
    const end = Math.max(...idx)
    out.push({ id: s.id, colStart: start, colSpan: end - start + 1 })
  }
  return out.sort((x, y) => x.colStart - y.colStart)
}

/** Колонки в пользовательском порядке без скрытых; колонки вне order — в конец. */
export function visibleColumns<Row>(order: string[], hidden: string[], columns: ColumnDef<Row>[]): ColumnDef<Row>[] {
  const byId = new Map(columns.map((c) => [c.id, c]))
  const seen = new Set<string>()
  const out: ColumnDef<Row>[] = []
  for (const id of order) {
    const c = byId.get(id)
    if (c && !seen.has(id)) {
      seen.add(id)
      out.push(c)
    }
  }
  for (const c of columns) if (!seen.has(c.id)) out.push(c)
  const hiddenSet = new Set(hidden)
  return out.filter((c) => !hiddenSet.has(c.id))
}
