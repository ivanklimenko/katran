import type { ColumnDef, ResolvedSpan, SpanDef } from './types'

/**
 * Сквозные сегменты адресуются по id колонок, не числом colspan — состав колонок пользовательский (спека 6.3).
 * Диапазон берётся по ПОЛНОМУ порядку (между from и to включительно, границы нормализуются),
 * а индексы считаются по видимым колонкам: скрытые сжимают сегмент, полностью скрытый диапазон сегмента не даёт.
 * Колонки на всю высоту записи (tall) рисуются rowSpan в первой строке — сквозная строка под ними не проходит:
 * участок сегмента — это первая покрытая колонка первой строки и далее подряд, пока колонки покрыты и не высокие.
 */
export function resolveSpans(spans: SpanDef<unknown>[], visibleOrder: string[], fullOrder: string[] = visibleOrder, tall: ReadonlySet<string> = new Set()): ResolvedSpan[] {
  const out: ResolvedSpan[] = []
  for (const s of spans) {
    const fa = fullOrder.indexOf(s.from)
    const fb = fullOrder.indexOf(s.to)
    if (fa < 0 || fb < 0) continue
    const [lo, hi] = fa <= fb ? [fa, fb] : [fb, fa]
    const covered = new Set(fullOrder.slice(lo, hi + 1))
    const first = visibleOrder.findIndex((id) => covered.has(id) && !tall.has(id))
    if (first < 0) continue
    let end = first
    while (end + 1 < visibleOrder.length && covered.has(visibleOrder[end + 1]!) && !tall.has(visibleOrder[end + 1]!)) end += 1
    out.push({ id: s.id, colStart: first, colSpan: end - first + 1 })
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

/** «Раздельно» (спека 5a §4): хост рисует split.render, части — сразу за ним; ключи частей уходят из хоста, если split.sort не задан. */
export function expandColumns<Row>(columns: ColumnDef<Row>[], split: string[]): ColumnDef<Row>[] {
  const on = new Set(split)
  return columns.flatMap((c) => {
    if (!c.split || !on.has(c.id)) return [c]
    const partKeys = new Set(c.split.parts.flatMap((p) => (p.sort ?? []).map((k) => k.id)))
    const host: ColumnDef<Row> = { ...c, render: c.split.render, sort: c.split.sort ?? (c.sort ?? []).filter((k) => !partKeys.has(k.id)) }
    return [host, ...c.split.parts]
  })
}

/** id и ширины всех колонок раскладки, включая части split — для GridModelConfig.columns. */
export const gridColumns = <Row,>(columns: ColumnDef<Row>[]): { id: string; width?: number | undefined }[] =>
  columns.flatMap((c) => [{ id: c.id, width: c.width }, ...(c.split?.parts ?? []).map((p) => ({ id: p.id, width: p.width }))])
