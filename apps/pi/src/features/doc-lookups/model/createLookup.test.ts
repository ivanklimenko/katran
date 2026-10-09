import { allSettled, createEffect, fork } from 'effector'
import { ApiError } from '../../../shared/api'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { createLookup } from './createLookup'

type Pending = { id: string; ok: (r: string) => void; fail: (e: ApiError) => void }

/** Отложенный порт: вызовы копятся в calls, ответ каждого отпускается вручную (ok/fail). */
function setup() {
  const calls: Pending[] = []
  const fx = createEffect<string, string, ApiError>((id) => new Promise<string>((ok, fail) => { calls.push({ id, ok, fail }) }))
  const lifecycle = createPageLifecycle()
  const lookup = createLookup({ fx, lifecycle })
  const scope = fork()
  const inFlight: Promise<unknown>[] = []
  const fire = (p: Promise<unknown>) => { inFlight.push(p) }
  const settle = () => Promise.all(inFlight)
  const data = () => scope.getState(lookup.$data)
  return { lookup, lifecycle, scope, calls, fire, settle, data }
}

/** Пропустить макрозадачу: ответ порта успевает пройти через модель. */
const tick = () => new Promise<void>((ok) => { setTimeout(ok, 0) })
const problem = (detail: string) => new ApiError(500, { type: 'urn:katran:error', title: 'Ошибка', status: 500, detail }, `Ошибка: ${detail}`)

describe('createLookup (спека 2e §3.3)', () => {
  it('load: loading → ready со значением; повторный load при ready — без запроса', async () => {
    const t = setup()
    t.fire(allSettled(t.lookup.load, { scope: t.scope, params: '1' }))
    expect(t.calls.map((c) => c.id)).toEqual(['1'])
    expect(t.data()).toEqual({ '1': { state: 'loading', value: null, error: null } })
    t.calls[0]!.ok('курс 1')
    await t.settle()
    expect(t.data()).toEqual({ '1': { state: 'ready', value: 'курс 1', error: null } })
    await allSettled(t.lookup.load, { scope: t.scope, params: '1' })
    expect(t.calls).toHaveLength(1)
  })

  it('load в полёте — без второго запроса; документы независимы', async () => {
    const t = setup()
    t.fire(allSettled(t.lookup.load, { scope: t.scope, params: '1' }))
    t.fire(allSettled(t.lookup.load, { scope: t.scope, params: '1' }))
    t.fire(allSettled(t.lookup.load, { scope: t.scope, params: '2' }))
    expect(t.calls.map((c) => c.id)).toEqual(['1', '2'])
    t.calls[1]!.ok('два')
    t.calls[0]!.ok('один')
    await t.settle()
    expect(t.data()['1']?.value).toBe('один')
    expect(t.data()['2']?.value).toBe('два')
  })

  it('ошибка → error с текстом Problem detail; без detail — message', async () => {
    const t = setup()
    t.fire(allSettled(t.lookup.load, { scope: t.scope, params: '1' }))
    t.fire(allSettled(t.lookup.load, { scope: t.scope, params: '2' }))
    t.calls[0]!.fail(problem('Курс недоступен'))
    t.calls[1]!.fail(new ApiError(0, null, 'Сеть недоступна'))
    await t.settle()
    expect(t.data()['1']).toEqual({ state: 'error', value: null, error: 'Курс недоступен' })
    expect(t.data()['2']).toEqual({ state: 'error', value: null, error: 'Сеть недоступна' })
  })

  it('retry после ошибки — запрос; retry при ready и в полёте — без запроса', async () => {
    const t = setup()
    t.fire(allSettled(t.lookup.load, { scope: t.scope, params: '1' }))
    t.fire(allSettled(t.lookup.retry, { scope: t.scope, params: '1' }))
    expect(t.calls).toHaveLength(1)
    t.calls[0]!.fail(problem('Сбой'))
    await t.settle()
    t.fire(allSettled(t.lookup.retry, { scope: t.scope, params: '1' }))
    expect(t.calls).toHaveLength(2)
    expect(t.data()['1']).toEqual({ state: 'loading', value: null, error: null })
    t.calls[1]!.ok('есть')
    await t.settle()
    expect(t.data()['1']).toEqual({ state: 'ready', value: 'есть', error: null })
    await allSettled(t.lookup.retry, { scope: t.scope, params: '1' })
    expect(t.calls).toHaveLength(2)
  })

  it('load после ошибки (повторное открытие поповера) — запрос', async () => {
    const t = setup()
    t.fire(allSettled(t.lookup.load, { scope: t.scope, params: '1' }))
    t.calls[0]!.fail(problem('Сбой'))
    await t.settle()
    t.fire(allSettled(t.lookup.load, { scope: t.scope, params: '1' }))
    expect(t.calls).toHaveLength(2)
  })

  it('refresh при ready — запрос, во время запроса loading с прежним value; ответ — новое значение', async () => {
    const t = setup()
    t.fire(allSettled(t.lookup.load, { scope: t.scope, params: '1' }))
    t.calls[0]!.ok('старое')
    await t.settle()
    t.fire(allSettled(t.lookup.refresh, { scope: t.scope, params: '1' }))
    expect(t.calls).toHaveLength(2)
    expect(t.data()['1']).toEqual({ state: 'loading', value: 'старое', error: null })
    t.fire(allSettled(t.lookup.refresh, { scope: t.scope, params: '1' }))
    expect(t.calls).toHaveLength(2)
    t.calls[1]!.ok('новое')
    await t.settle()
    expect(t.data()['1']).toEqual({ state: 'ready', value: 'новое', error: null })
  })

  it('refresh без значения — без запроса', async () => {
    const t = setup()
    await allSettled(t.lookup.refresh, { scope: t.scope, params: '1' })
    expect(t.calls).toHaveLength(0)
    expect(t.data()).toEqual({})
  })

  it('Review Focus 3: неудачный refresh → error, value прежнее; retry — запрос, value видно до ответа', async () => {
    const t = setup()
    t.fire(allSettled(t.lookup.load, { scope: t.scope, params: '1' }))
    t.calls[0]!.ok('старое')
    await t.settle()
    t.fire(allSettled(t.lookup.refresh, { scope: t.scope, params: '1' }))
    t.calls[1]!.fail(problem('Остатки недоступны'))
    await t.settle()
    expect(t.data()['1']).toEqual({ state: 'error', value: 'старое', error: 'Остатки недоступны' })
    t.fire(allSettled(t.lookup.retry, { scope: t.scope, params: '1' }))
    expect(t.calls).toHaveLength(3)
    expect(t.data()['1']).toEqual({ state: 'loading', value: 'старое', error: null })
  })

  it('reset во время запроса — ответ отброшен, записи нет; новый load — свежий запрос, его ответ принят', async () => {
    const t = setup()
    t.fire(allSettled(t.lookup.load, { scope: t.scope, params: '1' }))
    t.fire(allSettled(t.lookup.reset, { scope: t.scope, params: '1' }))
    expect(t.data()).toEqual({})
    t.fire(allSettled(t.lookup.load, { scope: t.scope, params: '1' }))
    expect(t.calls).toHaveLength(2)
    t.calls[0]!.ok('до сброса')
    await tick()
    expect(t.data()['1']).toEqual({ state: 'loading', value: null, error: null })
    t.calls[1]!.ok('после сброса')
    await t.settle()
    expect(t.data()['1']).toEqual({ state: 'ready', value: 'после сброса', error: null })
  })

  it('reset во время запроса — и отказ отброшен', async () => {
    const t = setup()
    t.fire(allSettled(t.lookup.load, { scope: t.scope, params: '1' }))
    t.fire(allSettled(t.lookup.reset, { scope: t.scope, params: '1' }))
    t.calls[0]!.fail(problem('Сбой'))
    await t.settle()
    expect(t.data()).toEqual({})
  })

  it('reset другого документа не трогает этот', async () => {
    const t = setup()
    t.fire(allSettled(t.lookup.load, { scope: t.scope, params: '1' }))
    t.fire(allSettled(t.lookup.reset, { scope: t.scope, params: '2' }))
    t.calls[0]!.ok('один')
    await t.settle()
    expect(t.data()['1']?.value).toBe('один')
  })

  it('pageClosed — $data пуст, ответ после него отброшен (и после повторного входа)', async () => {
    const t = setup()
    await allSettled(t.lifecycle.pageOpened, { scope: t.scope })
    t.fire(allSettled(t.lookup.load, { scope: t.scope, params: '1' }))
    t.fire(allSettled(t.lookup.load, { scope: t.scope, params: '2' }))
    t.calls[1]!.ok('два')
    await tick()
    expect(t.data()['2']?.value).toBe('два')
    t.fire(allSettled(t.lifecycle.pageClosed, { scope: t.scope }))
    expect(t.data()).toEqual({})
    t.fire(allSettled(t.lifecycle.pageOpened, { scope: t.scope }))
    t.calls[0]!.ok('поздний')
    await t.settle()
    expect(t.data()).toEqual({})
  })
})
