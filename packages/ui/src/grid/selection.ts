import type { Selection } from './types'

export const EMPTY_SELECTION: Selection = { mode: 'ids', ids: [] }

export const isSelected = (sel: Selection, id: string): boolean =>
  sel.mode === 'ids' ? sel.ids.includes(id) : !sel.except.includes(id)

/** «Выбрано N» для BulkBar: в режиме all — всё по фильтру минус исключения. */
export const selectedCount = (sel: Selection, total: number): number =>
  sel.mode === 'ids' ? sel.ids.length : Math.max(0, total - sel.except.length)

/** Трёхпозиционный чекбокс шапки — по записям текущей страницы. */
export function pageState(sel: Selection, pageIds: string[]): 'none' | 'some' | 'all' {
  if (pageIds.length === 0) return 'none'
  const n = pageIds.filter((id) => isSelected(sel, id)).length
  return n === 0 ? 'none' : n === pageIds.length ? 'all' : 'some'
}
