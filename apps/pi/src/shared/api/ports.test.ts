import { allSettled, fork } from 'effector'
import { obj, str } from './guards'
import { ApiError, toApiError } from './problem'
import { createGridPorts } from './ports'
import { requestFx, type HttpRequest } from './request'

const ports = createGridPorts({ gridId: 'docs', parseRow: (raw, path) => ({ id: str(obj(raw, path), 'id', path) }) })

describe('createGridPorts', () => {
  it('searchFx: POST /grids/docs/search с телом контракта, ответ маппится', async () => {
    const seen: HttpRequest[] = []
    const scope = fork({ handlers: [[requestFx, async (r: HttpRequest) => { seen.push(r); return { content: [{ id: 'a' }], page: { totalElements: 1 } } }]] })
    const r = await allSettled(ports.searchFx, { scope, params: { filter: [], sort: [], page: 0, size: 20 } })
    expect(r).toEqual({ status: 'done', value: { rows: [{ id: 'a' }], total: 1 } })
    expect(seen).toEqual([{ method: 'POST', url: '/grids/docs/search', body: { filter: { conditions: [] }, sort: [], page: { number: 0, size: 20 }, includeTotal: true } }])
  })
  it('facetsFx и filterMetaFx ходят по своим адресам', async () => {
    const seen: string[] = []
    const scope = fork({ handlers: [[requestFx, async (r: HttpRequest) => { seen.push(`${r.method} ${r.url}`); return r.url.endsWith('facets') ? [] : { fields: [] } }]] })
    await allSettled(ports.facetsFx, { scope, params: { filter: [], field: 'status' } })
    await allSettled(ports.filterMetaFx, { scope })
    expect(seen).toEqual(['POST /grids/docs/facets', 'GET /grids/docs/filter-meta'])
  })
  it('отказ транспорта доходит до порта как ApiError', async () => {
    const scope = fork({ handlers: [[requestFx, async () => { throw toApiError(400, { type: 't', title: 'Некорректный фильтр' }) }]] })
    const r = await allSettled(ports.searchFx, { scope, params: { filter: [], sort: [], page: 0, size: 20 } })
    expect(r.status).toBe('fail')
    expect((r.value as ApiError).status).toBe(400)
  })
})
