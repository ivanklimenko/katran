import { allSettled, fork } from 'effector'
import { ApiError } from './problem'
import { requestFx } from './request'

describe('requestFx', () => {
  it('без подключённого обработчика отказывает понятной ApiError', async () => {
    const r = await allSettled(requestFx, { scope: fork(), params: { method: 'GET', url: '/x' } })
    expect(r.status).toBe('fail')
    expect(r.value).toBeInstanceOf(ApiError)
    expect((r.value as ApiError).message).toMatch(/Транспорт не подключён/)
  })
  it('обработчик подключается через fork handlers', async () => {
    const scope = fork({ handlers: [[requestFx, async () => ({ ok: true })]] })
    const r = await allSettled(requestFx, { scope, params: { method: 'GET', url: '/x' } })
    expect(r).toEqual({ status: 'done', value: { ok: true } })
  })
})
