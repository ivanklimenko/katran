import { allSettled, fork } from 'effector'
import { obj, str } from './guards'
import { ApiError, contractError, toApiError } from './problem'
import { toSuggestBody } from './grid-contract'
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
  it('suggestFx: POST /grids/docs/suggest с телом toSuggestBody, ответ — items', async () => {
    const seen: HttpRequest[] = []
    const scope = fork({ handlers: [[requestFx, async (r: HttpRequest) => { seen.push(r); return { items: ['ООО «Кедр»'] } }]] })
    const q = { field: 'name', query: 'кедр', filter: [{ field: 'status', op: 'EQ' as const, value: 'ERROR' }], limit: 10 }
    const r = await allSettled(ports.suggestFx, { scope, params: q })
    expect(r).toEqual({ status: 'done', value: ['ООО «Кедр»'] })
    expect(seen).toEqual([{ method: 'POST', url: '/grids/docs/suggest', body: toSuggestBody(q) }])
  })
  it('отказ транспорта доходит до порта как ApiError', async () => {
    const scope = fork({ handlers: [[requestFx, async () => { throw toApiError(400, { type: 't', title: 'Некорректный фильтр' }) }]] })
    const r = await allSettled(ports.searchFx, { scope, params: { filter: [], sort: [], page: 0, size: 20 } })
    expect(r.status).toBe('fail')
    expect((r.value as ApiError).status).toBe(400)
  })
  const withDetail = createGridPorts({
    gridId: 'docs',
    parseRow: (raw, path) => ({ id: str(obj(raw, path), 'id', path) }),
    parseDetail: (raw, path) => ({ id: str(obj(raw, path), 'id', path), note: str(obj(raw, path), 'note', path) }),
  })
  it('detailFx: GET /grids/docs/documents/{id}, id кодируется; ответ — парсером детали', async () => {
    const seen: HttpRequest[] = []
    const scope = fork({ handlers: [[requestFx, async (r: HttpRequest) => { seen.push(r); return { id: 'a/1', note: 'ок' } }]] })
    const r = await allSettled(withDetail.detailFx, { scope, params: 'a/1' })
    expect(r).toEqual({ status: 'done', value: { id: 'a/1', note: 'ок' } })
    expect(seen).toEqual([{ method: 'GET', url: '/grids/docs/documents/a%2F1' }])
  })
  it('detailFx: ответ не объект или без поля — contractError; отказ транспорта — ApiError со статусом', async () => {
    const notObj = await allSettled(withDetail.detailFx, { scope: fork({ handlers: [[requestFx, async () => [1, 2]]] }), params: 'x' })
    expect(notObj.status).toBe('fail')
    expect((notObj.value as ApiError).message).toBe(contractError('ответ: ожидался объект').message)
    const noField = await allSettled(withDetail.detailFx, { scope: fork({ handlers: [[requestFx, async () => ({ id: 'x' })]] }), params: 'x' })
    expect((noField.value as ApiError).message).toContain('ответ.note: ожидалась строка')
    const gone = await allSettled(withDetail.detailFx, { scope: fork({ handlers: [[requestFx, async () => { throw toApiError(404, { type: 't', title: 'Документ не найден' }) }]] }), params: 'x' })
    expect((gone.value as ApiError).status).toBe(404)
  })
  it('без parseDetail порта детали нет', () => {
    expect('detailFx' in ports).toBe(false)
  })
})
