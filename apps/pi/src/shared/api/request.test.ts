import { allSettled, fork } from 'effector'
import { ApiError } from './problem'
import { fileNameOf, requestFileFx, requestFx } from './request'

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

describe('requestFileFx', () => {
  it('без подключённого обработчика отказывает ApiError про requestFileFx.use', async () => {
    const r = await allSettled(requestFileFx, { scope: fork(), params: { url: '/x' } })
    expect(r.status).toBe('fail')
    expect(r.value).toBeInstanceOf(ApiError)
    expect((r.value as ApiError).message).toMatch(/requestFileFx\.use/)
  })
})

describe('fileNameOf', () => {
  it('filename="…"', () => expect(fileNameOf('attachment; filename="a b.txt"')).toBe('a b.txt'))
  it('filename*=UTF-8 приоритетнее filename', () =>
    expect(fileNameOf("attachment; filename=\"x.xml\"; filename*=UTF-8''%D0%9F.xml")).toBe('П.xml'))
  it('null и inline — null', () => {
    expect(fileNameOf(null)).toBeNull()
    expect(fileNameOf('inline')).toBeNull()
  })
})
