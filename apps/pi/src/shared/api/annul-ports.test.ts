import { allSettled, fork } from 'effector'
import { createAnnulPorts } from './annul-ports'
import { ApiError, toApiError } from './problem'
import { requestFx, type HttpRequest } from './request'

const setup = (reply: unknown = null) => {
  const reqs: HttpRequest[] = []
  const ports = createAnnulPorts('fx-docs', (v) => ({ detail: v }))
  const scope = fork({ handlers: [[requestFx, async (r: HttpRequest) => { reqs.push(r); return reply }]] })
  return { reqs, ports, scope }
}

describe('createAnnulPorts', () => {
  it('annulFx: POST …/annul с { reason }; 202 без тела → undefined', async () => {
    const { reqs, ports, scope } = setup(null)
    const r = await allSettled(ports.annulFx, { scope, params: { id: 'a/b', reason: 'x' } })
    expect(reqs[0]).toEqual({ method: 'POST', url: '/grids/fx-docs/documents/a%2Fb/annul', body: { reason: 'x' } })
    expect(r).toEqual({ status: 'done', value: undefined })
  })
  it('ответ команды игнорируется: 204/200 с любым телом — успех', async () => {
    for (const reply of [undefined, '', { any: 1 }, 'ok']) {
      const { ports, scope } = setup(reply)
      expect(await allSettled(ports.annulFx, { scope, params: { id: '1', reason: 'x' } })).toEqual({ status: 'done', value: undefined })
    }
  })
  it('confirmAnnulFx: POST …/annul/confirm с { when }', async () => {
    const { reqs, ports, scope } = setup()
    const r = await allSettled(ports.confirmAnnulFx, { scope, params: { id: '1', when: 'w' } })
    expect(reqs[0]).toEqual({ method: 'POST', url: '/grids/fx-docs/documents/1/annul/confirm', body: { when: 'w' } })
    expect(r).toEqual({ status: 'done', value: undefined })
  })
  it('rejectAnnulFx: POST …/annul/reject с { when, reason }', async () => {
    const { reqs, ports, scope } = setup()
    const r = await allSettled(ports.rejectAnnulFx, { scope, params: { id: '1', when: 'w', reason: 'r' } })
    expect(reqs[0]).toEqual({ method: 'POST', url: '/grids/fx-docs/documents/1/annul/reject', body: { when: 'w', reason: 'r' } })
    expect(r).toEqual({ status: 'done', value: undefined })
  })
  it('detailFx: GET документа через parseDetail; не объект — contractError', async () => {
    const { reqs, ports, scope } = setup({ id: '1' })
    const r = await allSettled(ports.detailFx, { scope, params: '1' })
    expect(reqs[0]).toEqual({ method: 'GET', url: '/grids/fx-docs/documents/1' })
    expect(r).toEqual({ status: 'done', value: { detail: { id: '1' } } })
    const bad = await allSettled(ports.detailFx, { scope: setup('x').scope, params: '1' })
    expect(bad.status).toBe('fail')
    expect((bad.value as ApiError).message).toContain('ответ: ожидался объект')
  })
  it('не-2xx → ApiError со статусом (все команды)', async () => {
    const { ports } = setup()
    const scope = fork({ handlers: [[requestFx, async () => { throw toApiError(409, { type: 'urn:katran:conflict', title: 'Изменили', status: 409 }) }]] })
    for (const [fx, params] of [[ports.annulFx, { id: '1', reason: 'x' }], [ports.confirmAnnulFx, { id: '1', when: 'w' }], [ports.rejectAnnulFx, { id: '1', when: 'w', reason: 'r' }]] as const) {
      const r = await allSettled(fx as typeof ports.annulFx, { scope, params: params as never })
      expect(r.status).toBe('fail')
      expect((r.value as ApiError).status).toBe(409)
    }
  })
})
