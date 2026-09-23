import { useUnit } from 'effector-react'
import type { FiltersModel } from './createFiltersModel'
import type { Condition, Filter } from './types'

export type FiltersBinding = {
  conditions: Filter
  draft: Filter
  dirty: boolean
  edit: (c: Condition) => void
  discard: (field: string) => void
  apply: () => void
  reset: () => void
  remove: (field: string) => void
}

export function useFilters(m: FiltersModel): FiltersBinding {
  const [conditions, draft, dirty] = useUnit([m.$conditions, m.$draft, m.$dirty])
  const [edit, discard, apply, reset, remove] = useUnit([m.edit, m.discard, m.apply, m.reset, m.remove])
  return { conditions, draft, dirty, edit, discard, apply, reset, remove }
}
