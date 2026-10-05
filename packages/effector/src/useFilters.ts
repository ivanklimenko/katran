import { useUnit } from 'effector-react'
import type { FiltersModel } from './createFiltersModel'
import type { Condition, Filter, FilterMeta, Scalar, SuggestState } from './types'

export type FiltersBinding = {
  conditions: Filter
  draft: Filter
  dirty: boolean
  lane: Scalar | null
  meta: FilterMeta | null
  suggest: SuggestState | null
  edit: (c: Condition) => void
  setField: (p: { field: string; conditions: Condition[] }) => void
  discard: (field: string) => void
  apply: () => void
  revert: () => void
  reset: () => void
  remove: (field: string) => void
  setLane: (v: Scalar | null) => void
  onSuggest: (p: { field: string; query: string }) => void
  onSuggestClose: () => void
}

export function useFilters(m: FiltersModel): FiltersBinding {
  const [conditions, draft, dirty, lane, meta, suggest] = useUnit([m.$conditions, m.$draft, m.$dirty, m.$lane, m.$meta, m.$suggest])
  const [edit, setField, discard, apply, revert, reset, remove, setLane, onSuggest, onSuggestClose] = useUnit([m.edit, m.setField, m.discard, m.apply, m.revert, m.reset, m.remove, m.setLane, m.suggest, m.closeSuggest])
  return { conditions, draft, dirty, lane, meta, suggest, edit, setField, discard, apply, revert, reset, remove, setLane, onSuggest, onSuggestClose }
}
