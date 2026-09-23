import { act, renderHook } from '@testing-library/react'
import { createEffect, createStore } from 'effector'
import { createFiltersModel } from './createFiltersModel'
import { createGridModel } from './createGridModel'
import type { Filter, GridPage, GridQuery } from './types'
import { useFilters } from './useFilters'
import { useGrid } from './useGrid'

type Row = { id: string }

describe('useGrid', () => {
  it('отдаёт состояние и обработчики; обработчики двигают модель', async () => {
    const fetchFx = createEffect<GridQuery, GridPage<Row>>(async () => ({ rows: [{ id: 'a' }], total: 1 }))
    const model = createGridModel<Row>({ id: 'g', columns: [{ id: 'c1' }], $filter: createStore<Filter>([]), fetchFx, rowKey: (r) => r.id })
    const { result } = renderHook(() => useGrid(model))
    expect(result.current.page).toBe(1)
    expect(result.current.state).toBe('loading')
    await act(async () => { result.current.onPage(3) })
    expect(result.current.page).toBe(3)
    expect(result.current.rows).toEqual([{ id: 'a' }])
    expect(result.current.state).toBe('ready')
    act(() => { result.current.onSort({ key: 'c1', dir: 'asc' }) })
    expect(result.current.sort).toEqual({ key: 'c1', dir: 'asc' })
    expect(result.current.page).toBe(1)
    act(() => { result.current.onSelect({ id: 'a', on: true }) })
    expect(result.current.selection).toEqual({ mode: 'ids', ids: ['a'] })
    act(() => { result.current.onColumns({ order: ['c1'], hidden: ['c1'] }) })
    expect(result.current.hidden).toEqual(['c1'])
  })
})

describe('useFilters', () => {
  it('edit/apply через хук', () => {
    const model = createFiltersModel()
    const { result } = renderHook(() => useFilters(model))
    act(() => { result.current.edit({ field: 'status', op: 'EQ', value: 'DONE' }) })
    expect(result.current.dirty).toBe(true)
    act(() => { result.current.apply() })
    expect(result.current.conditions).toEqual([{ field: 'status', op: 'EQ', value: 'DONE' }])
    expect(result.current.dirty).toBe(false)
  })
})
