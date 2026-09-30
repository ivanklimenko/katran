import { allSettled, createEffect, fork } from 'effector'
import { ApiError } from '../../../shared/api'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { createDetail } from './createDetail'

type Doc = { id: string; n: number }

function setup(opts: { fail?: (id: string, call: number) => boolean; hold?: boolean } = {}) {
  const calls: string[] = []
  let release: (() => void) | null = null
  const detailFx = createEffect<string, Doc, ApiError>(async (id) => {
    calls.push(id)
    if (opts.hold) await new Promise<void>((r) => { release = r })
    if (opts.fail?.(id, calls.length)) throw new ApiError(500, null, 'Сбой сервера')
    return { id, n: calls.length }
  })
  const lifecycle = createPageLifecycle()
  const d = createDetail({ detailFx, lifecycle })
  const scope = fork()
  const open = (id: string, secondary = false) => allSettled(d.open, { scope, params: { id, secondary } })
  return { d, lifecycle, scope, calls, open, release: () => release?.() }
}

describe('createDetail (спека 2a §4.3)', () => {
  it('загрузка по слоту: loading → ready', async () => {
    const { d, scope, lifecycle, calls, release } = setup({ hold: true })
    await allSettled(lifecycle.pageOpened, { scope })
    const p = allSettled(d.open, { scope, params: { id: 'd1', secondary: false } })
    expect(scope.getState(d.$slots).a).toMatchObject({ slot: 'a', id: 'd1', tab: 'main', state: 'loading', data: null, error: null })
    expect(scope.getState(d.$slots).b).toBeNull()
    release()
    await p
    expect(scope.getState(d.$slots).a).toMatchObject({ state: 'ready', data: { id: 'd1', n: 1 } })
    expect(calls).toEqual(['d1'])
  })

  it('кэш по id: сдвиг B в A и повторное открытие не перезапрашивают', async () => {
    const { d, scope, lifecycle, calls, open } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    await open('d2', true)
    await allSettled(d.close, { scope, params: 'a' })
    expect(scope.getState(d.$slots).a).toMatchObject({ id: 'd2', state: 'ready' })
    await open('d1')
    expect(scope.getState(d.$slots).a).toMatchObject({ id: 'd1', state: 'ready', data: { n: 1 } })
    expect(calls).toEqual(['d1', 'd2'])
  })

  it('ошибка — состояние слота с текстом; retry — загрузка заново', async () => {
    const { d, scope, lifecycle, calls, open } = setup({ fail: (_id, call) => call === 1 })
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    expect(scope.getState(d.$slots).a).toMatchObject({ state: 'error', error: 'Сбой сервера', data: null })
    await allSettled(d.retry, { scope, params: 'a' })
    expect(scope.getState(d.$slots).a).toMatchObject({ state: 'ready', error: null })
    expect(calls).toEqual(['d1', 'd1'])
  })

  it('retry пустого слота ничего не делает', async () => {
    const { d, scope, lifecycle, calls } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(d.retry, { scope, params: 'b' })
    expect(calls).toEqual([])
  })

  it('уже открытый документ: запроса нет, счётчик фокуса по id растёт', async () => {
    const { d, scope, lifecycle, calls, open } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    await open('d1', true)
    await open('d1')
    expect(scope.getState(d.$focus)).toEqual({ d1: 2 })
    expect(calls).toEqual(['d1'])
  })

  it('$marks: какая запись открыта в A и в B', async () => {
    const { d, scope, lifecycle, open } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    await open('d2', true)
    expect(scope.getState(d.$marks)).toEqual({ d1: 'a', d2: 'b' })
  })

  it('pageClosed закрывает оба и чистит кэш: при возврате — новый запрос', async () => {
    const { d, scope, lifecycle, calls, open } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    await open('d2', true)
    await allSettled(lifecycle.pageClosed, { scope })
    expect(scope.getState(d.$slots)).toEqual({ a: null, b: null })
    expect(scope.getState(d.$focus)).toEqual({})
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    expect(calls).toEqual(['d1', 'd2', 'd1'])
  })

  it('ответ после ухода с экрана в кэш не попадает', async () => {
    const { d, scope, lifecycle, calls, release } = setup({ hold: true })
    await allSettled(lifecycle.pageOpened, { scope })
    const opening = allSettled(d.open, { scope, params: { id: 'd1', secondary: false } })
    const closing = allSettled(lifecycle.pageClosed, { scope })
    release()
    await Promise.all([opening, closing])
    await allSettled(lifecycle.pageOpened, { scope })
    const again = allSettled(d.open, { scope, params: { id: 'd1', secondary: false } })
    expect(scope.getState(d.$slots).a?.state).toBe('loading')
    release()
    await again
    expect(calls).toEqual(['d1', 'd1'])
  })
})
