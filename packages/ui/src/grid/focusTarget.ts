/**
 * Куда вернуть фокус после закрытия деталки (спека 2a §5): кнопка открытия записи id в гриде с доступным именем grid;
 * записи на странице уже нет — таб-стоп грида (ячейка с tabindex 0). Грида нет — null.
 * Без CSS.escape: ключ записи и имя грида сравниваются как строки.
 */
export function gridFocusTarget(grid: string, id: string, root: ParentNode = document): HTMLElement | null {
  const table = Array.from(root.querySelectorAll<HTMLElement>('table[role="grid"]')).find((t) => t.getAttribute('aria-label') === grid)
  if (!table) return null
  const open = Array.from(table.querySelectorAll<HTMLElement>('[data-k-open]')).find((b) => b.getAttribute('data-k-open') === id)
  return open ?? table.querySelector<HTMLElement>('[data-cell][tabindex="0"]')
}
