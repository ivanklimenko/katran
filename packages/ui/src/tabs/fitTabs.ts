/**
 * Какие вкладки помещаются в полосу (спека 2a §3.1, эталон fitTabs index.html:1089): хвост уходит в меню «••• N»,
 * выбранная остаётся видимой — вместо неё в меню уходят предыдущие по порядку.
 * widths — ширины вкладок в порядке показа; avail — ширина полосы; more — ширина кнопки «••• N»;
 * selected — индекс выбранной (−1 — нет); gap — зазор между соседними вкладками;
 * sep — разделитель групп перед вкладкой at шириной width: считается (с зазором), только когда видны вкладки обеих групп.
 * Возвращает индексы видимых вкладок по возрастанию; хотя бы одна видна всегда.
 */
export function fitTabs(
  widths: number[], avail: number, more: number, selected: number, gap = 0,
  sep?: { at: number; width: number } | undefined,
): number[] {
  const split = (ids: number[]) => sep !== undefined && ids.some((i) => i < sep.at) && ids.some((i) => i >= sep.at)
  const total = (ids: number[]) => ids.reduce((sum, i) => sum + (widths[i] ?? 0), 0) + gap * Math.max(0, ids.length - 1)
    + (split(ids) && sep ? sep.width + gap : 0)
  const all = widths.map((_, i) => i)
  if (total(all) <= avail) return all
  const room = avail - more - gap
  const shown: number[] = []
  for (const i of all) {
    if (total([...shown, i]) > room) break
    shown.push(i)
  }
  if (selected >= 0 && !shown.includes(selected)) {
    while (shown.length > 0 && total([...shown, selected]) > room) shown.pop()
    shown.push(selected)
  }
  if (shown.length === 0) shown.push(0)
  return shown.sort((a, b) => a - b)
}
