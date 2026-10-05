import { allSettled, fork } from 'effector'
import { createEditPorts, fromAccountsResponse } from './edit-ports'
import { ApiError, toApiError } from './problem'
import { requestFx, type HttpRequest } from './request'

describe('createEditPorts', () => {
  it('saveEditFx: POST …/documents/{id}/edits с { target, was, now }; ответ — через parseDetail', async () => {
    const reqs: HttpRequest[] = []
    const ports = createEditPorts({ gridId: 'g', parseDetail: (raw, path) => ({ ...(raw as object), path }) })
    const scope = fork({ handlers: [[requestFx, async (r: HttpRequest) => { reqs.push(r); return { id: 'a/b' } }]] })
    const r = await allSettled(ports.saveEditFx, { scope, params: { id: 'a/b', target: 'field:57', was: { lines: ['A'] }, now: { lines: ['B'] } } })
    expect(reqs[0]).toEqual({ method: 'POST', url: '/grids/g/documents/a%2Fb/edits', body: { target: 'field:57', was: { lines: ['A'] }, now: { lines: ['B'] } } })
    expect(r).toEqual({ status: 'done', value: { id: 'a/b', path: 'ответ' } })
  })
  it('saveEditFx: ответ не объект — contractError; отказ бека (409) — ApiError со статусом', async () => {
    const ports = createEditPorts({ gridId: 'g', parseDetail: (raw) => raw })
    const notObj = await allSettled(ports.saveEditFx, { scope: fork({ handlers: [[requestFx, async () => 'ok']] }), params: { id: 'x', target: 'refOut', was: 'A', now: 'B' } })
    expect(notObj.status).toBe('fail')
    expect((notObj.value as ApiError).message).toContain('ответ: ожидался объект')
    const conflict = await allSettled(ports.saveEditFx, {
      scope: fork({ handlers: [[requestFx, async () => { throw toApiError(409, { type: 'urn:katran:edit-conflict', title: 'Документ изменили', status: 409 }) }]] }),
      params: { id: 'x', target: 'refOut', was: 'A', now: 'B' },
    })
    expect((conflict.value as ApiError).status).toBe(409)
    expect((conflict.value as ApiError).problem?.type).toBe('urn:katran:edit-conflict')
  })
  it('accountsFx: GET …/accounts?side=kt → items', async () => {
    const reqs: HttpRequest[] = []
    const ports = createEditPorts({ gridId: 'g', parseDetail: (raw) => raw })
    const items = [{ account: '40817840100050017762', ccy: 'USD', kind: 'Текущий' }]
    const scope = fork({ handlers: [[requestFx, async (r: HttpRequest) => { reqs.push(r); return { items } }]] })
    const r = await allSettled(ports.accountsFx, { scope, params: { id: 'a/b', side: 'kt' } })
    expect(reqs).toEqual([{ method: 'GET', url: '/grids/g/documents/a%2Fb/accounts', query: { side: 'kt' } }])
    expect(r).toEqual({ status: 'done', value: items })
  })
})

describe('fromAccountsResponse', () => {
  it('{ items: [{ account, ccy, kind }] } → AccountItem[]; пустой список — []', () => {
    expect(fromAccountsResponse({ items: [{ account: '1', ccy: 'EUR', kind: 'Депозит' }] })).toEqual([{ account: '1', ccy: 'EUR', kind: 'Депозит' }])
    expect(fromAccountsResponse({ items: [] })).toEqual([])
  })
  it('не по контракту — contractError с путём', () => {
    expect(() => fromAccountsResponse({ items: [{ account: 1 }] })).toThrow('ответ.items[0].account: ожидалась строка')
    expect(() => fromAccountsResponse({ items: [{ account: '1', ccy: 'USD' }] })).toThrow('ответ.items[0].kind: ожидалась строка')
    expect(() => fromAccountsResponse({})).toThrow('ответ.items: ожидался массив')
    expect(() => fromAccountsResponse([])).toThrow(ApiError)
  })
})
