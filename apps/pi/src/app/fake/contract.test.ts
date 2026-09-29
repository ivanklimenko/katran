import { allSettled, fork } from 'effector'
import { fxDocPorts } from '../../entities/fx-doc'
import { ApiError, createGridPorts, requestFx } from '../../shared/api'
import { fakeGrids } from './grids'
import { createFakeServer } from './server'

/** Цепочка «порт → requestFx → сервер». Внутри тот же тест гоняется против своего бека: подставить свой обработчик в handlers. */
const scope = () => fork({ handlers: [[requestFx, createFakeServer(fakeGrids)]] })

describe('контракт fx-docs', () => {
  it('search: фильтр по статусу, сортировка по сумме, страница', async () => {
    const r = await allSettled(fxDocPorts.searchFx, { scope: scope(), params: { filter: [{ field: 'status', op: 'EQ', value: 'ERROR' }], sort: [{ key: 'amount', dir: 'desc' }], page: 0, size: 5 } })
    expect(r.status).toBe('done')
    if (r.status !== 'done') return
    expect(r.value.rows.length).toBeLessThanOrEqual(5)
    expect(r.value.rows.every((d) => d.status === 'ERROR')).toBe(true)
    const amounts = r.value.rows.map((d) => d.amount)
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a))
    expect(r.value.total).toBeGreaterThanOrEqual(r.value.rows.length)
  })
  it('facets и filter-meta', async () => {
    const s = scope()
    const f = await allSettled(fxDocPorts.facetsFx, { scope: s, params: { filter: [], field: 'status' } })
    expect(f.status === 'done' && f.value.reduce((n, x) => n + x.count, 0)).toBe(87)
    const m = await allSettled(fxDocPorts.filterMetaFx, { scope: s })
    expect(m.status === 'done' && m.value.fields.map((x) => x.id)).toEqual(['docNumber', 'status', 'type', 'direction', 'currency', 'amount', 'created', 'f50name', 'f59name'])
  })
  it('400 на недопустимый оператор, 404 на неизвестный грид', async () => {
    const bad = await allSettled(fxDocPorts.searchFx, { scope: scope(), params: { filter: [{ field: 'amount', op: 'CONTAINS', value: '1' }], sort: [], page: 0, size: 20 } })
    expect(bad.status).toBe('fail')
    expect((bad.value as ApiError).problem?.errors?.[0]?.code).toBe('OPERATOR_NOT_ALLOWED')
    const nope = createGridPorts({ gridId: 'nope', parseRow: (x) => x })
    const r = await allSettled(nope.searchFx, { scope: scope(), params: { filter: [], sort: [], page: 0, size: 20 } })
    expect((r.value as ApiError).status).toBe(404)
  })
})
