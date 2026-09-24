import { useUnit } from 'effector-react'
import type { FiltersModel } from './createFiltersModel'
import type { Condition, Filter, FilterMeta, Scalar } from './types'

export type FiltersBinding = {
  conditions: Filter
  draft: Filter
  dirty: boolean
  lane: Scalar | null
  meta: FilterMeta | null
  edit: (c: Condition) => void
  discard: (field: string) => void
  apply: () => void
  revert: () => void
  reset: () => void
  remove: (field: string) => void
  setLane: (v: Scalar | null) => void
}

export function useFilters(m: FiltersModel): FiltersBinding {
  const [conditions, draft, dirty, lane] = useUnit([m.$conditions, m.$draft, m.$dirty, m.$lane])
  const [edit, discard, apply, revert, reset, remove, setLane] = useUnit([m.edit, m.discard, m.apply, m.revert, m.reset, m.remove, m.setLane])
  return { conditions, draft, dirty, lane, meta: m.meta, edit, discard, apply, revert, reset, remove, setLane }
}
