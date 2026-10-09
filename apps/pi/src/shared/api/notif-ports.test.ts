import { allSettled, fork } from 'effector'
import { createNotifPorts, parseNotifMessage } from './notif-ports'
import { ApiError, toApiError } from './problem'
import { requestFx, type HttpRequest } from './request'

describe('parseNotifMessage', () => {
  it('три contentType разбираются', () => {
    for (const contentType of ['application/json', 'application/xml', 'text/plain'] as const) {
      expect(parseNotifMessage({ contentType, body: 'тело' })).toEqual({ contentType, body: 'тело' })
    }
  })
  it('text/html — ошибка с путём ответ.contentType', () => {
    expect(() => parseNotifMessage({ contentType: 'text/html', body: '<b>' })).toThrow('ответ.contentType: недопустимое значение «text/html»')
  })
  it('нет body или не объект — ошибка с путём', () => {
    expect(() => parseNotifMessage({ contentType: 'text/plain' })).toThrow('ответ.body: ожидалась строка')
    expect(() => parseNotifMessage('x')).toThrow('ответ: ожидался объект')
  })
})

describe('createNotifPorts', () => {
  const setup = (reply: unknown) => {
    const reqs: HttpRequest[] = []
    const scope = fork({ handlers: [[requestFx, async (r: HttpRequest) => { reqs.push(r); return reply }]] })
    return { reqs, scope, ports: createNotifPorts('fx-docs') }
  }
  it('resendFx без nid: POST …/notifications/resend с {}; сырое тело отдаётся как есть', async () => {
    const { reqs, scope, ports } = setup({ items: [1] })
    const r = await allSettled(ports.resendFx, { scope, params: { id: '1' } })
    expect(reqs[0]).toEqual({ method: 'POST', url: '/grids/fx-docs/documents/1/notifications/resend', body: {} })
    expect(r).toEqual({ status: 'done', value: { items: [1] } })
  })
  it('resendFx с nid: POST …/notifications/{nid}/resend, nid кодируется', async () => {
    const { reqs, scope, ports } = setup(null)
    await allSettled(ports.resendFx, { scope, params: { id: '1', nid: 'n:1' } })
    expect(reqs[0]).toEqual({ method: 'POST', url: '/grids/fx-docs/documents/1/notifications/n%3A1/resend', body: {} })
  })
  it('messageFx: GET …/notifications/{nid}/message через parseNotifMessage', async () => {
    const { reqs, scope, ports } = setup({ contentType: 'text/plain', body: 'т' })
    const r = await allSettled(ports.messageFx, { scope, params: { id: '1', nid: 'n:1' } })
    expect(reqs[0]).toEqual({ method: 'GET', url: '/grids/fx-docs/documents/1/notifications/n%3A1/message' })
    expect(r).toEqual({ status: 'done', value: { contentType: 'text/plain', body: 'т' } })
    const bad = await allSettled(ports.messageFx, { scope: setup('x').scope, params: { id: '1', nid: 'n' } })
    expect((bad.value as ApiError).message).toContain('ответ: ожидался объект')
  })
  it('не-2xx → ApiError со статусом', async () => {
    const ports = createNotifPorts('fx-docs')
    const scope = fork({ handlers: [[requestFx, async () => { throw toApiError(409, { type: 'about:blank', title: 'x', status: 409 }) }]] })
    const r = await allSettled(ports.resendFx, { scope, params: { id: '1' } })
    expect((r.value as ApiError).status).toBe(409)
    const m = await allSettled(ports.messageFx, { scope, params: { id: '1', nid: 'n' } })
    expect((m.value as ApiError).status).toBe(409)
  })
})
