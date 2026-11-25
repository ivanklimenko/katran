import { localStoragePersist } from '@katran/effector'
import type { ColumnsState } from '@katran/ui'
import { createEffect, createEvent, createStore, sample } from 'effector'
import { lifecycle } from './workspace'

type ColumnPreferences = ColumnsState & { widths: Record<string, number> }
const storage = localStoragePersist<ColumnPreferences>('katran-pi')
const key = 'nzr-report:columns'
const initial: ColumnPreferences = { order: [], hidden: [], widths: {} }
const loadFx = createEffect(() => storage.load(key))
const saveFx = createEffect((state: ColumnPreferences) => storage.save(key, state))

export const columnsChanged = createEvent<ColumnsState>()
export const widthChanged = createEvent<{ id: string; width: number }>()
export const widthReset = createEvent<string>()
export const widthsReset = createEvent()

export const $columns = createStore(initial)
  .on(loadFx.doneData, (state, saved) => saved ?? state)
  .on(columnsChanged, (state, columns) => ({ ...state, ...columns }))
  .on(widthChanged, (state, { id, width }) => ({ ...state, widths: { ...state.widths, [id]: width } }))
  .on(widthReset, (state, id) => {
    const widths = { ...state.widths }
    delete widths[id]
    return { ...state, widths }
  })
  .on(widthsReset, (state) => ({ ...state, widths: {} }))

sample({ clock: lifecycle.pageOpened, target: loadFx })
sample({ clock: [columnsChanged, widthChanged, widthReset, widthsReset], source: $columns, target: saveFx })
