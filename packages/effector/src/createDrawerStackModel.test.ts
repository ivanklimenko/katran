import { allSettled, createStore, fork } from 'effector'
import { createDrawerStackModel, type DrawerSlot } from './createDrawerStackModel'

type Hit = { id: string; slot: DrawerSlot }

function setup(cfg?: Parameters<typeof createDrawerStackModel>[0]) {
  const m = createDrawerStackModel(cfg)
  // журналы событий — сторами: в fork-скоупе их читает getState
  const $opened = createStore<Hit[]>([]).on(m.opened, (l, x) => [...l, x])
  const $already = createStore<Hit[]>([]).on(m.alreadyOpen, (l, x) => [...l, x])
  const scope = fork()
  const open = (id: string, secondary = false) => allSettled(m.open, { scope, params: { id, secondary } })
  const ids = () => { const s = scope.getState(m.$stack); return { a: s.a?.id ?? null, b: s.b?.id ?? null } }
  return { m, scope, open, ids, opened: () => scope.getState($opened), already: () => scope.getState($already) }
}

describe('createDrawerStackModel (спека 2a §3.2)', () => {
  it('старт: оба слота пусты, верхнего нет', () => {
    const { m, scope, ids } = setup()
    expect(ids()).toEqual({ a: null, b: null })
    expect(scope.getState(m.$top)).toBeNull()
  })

  it('обычное открытие кладёт документ в A с первой вкладкой и сообщает слот', async () => {
    const { m, scope, open, opened } = setup()
    await open('d1')
    expect(scope.getState(m.$a)).toEqual({ id: 'd1', tab: 'main' })
    expect(scope.getState(m.$b)).toBeNull()
    expect(scope.getState(m.$top)).toBe('a')
    expect(opened()).toEqual([{ id: 'd1', slot: 'a' }])
  })

  it('обычное открытие заменяет A, B не трогает', async () => {
    const { open, ids } = setup()
    await open('d1')
    await open('d2', true)
    await open('d3')
    expect(ids()).toEqual({ a: 'd3', b: 'd2' })
  })

  it('secondary кладёт документ в B; при пустом A — в A', async () => {
    const { open, ids, opened } = setup()
    await open('d1', true)
    expect(ids()).toEqual({ a: 'd1', b: null })
    await open('d2', true)
    expect(ids()).toEqual({ a: 'd1', b: 'd2' })
    expect(opened()).toEqual([{ id: 'd1', slot: 'a' }, { id: 'd2', slot: 'b' }])
  })

  it('secondary при открытом B заменяет B', async () => {
    const { open, ids } = setup()
    await open('d1')
    await open('d2', true)
    await open('d3', true)
    expect(ids()).toEqual({ a: 'd1', b: 'd3' })
  })

  it('открытие уже открытого документа ничего не меняет и сообщает его слот', async () => {
    const { m, scope, open, ids, opened, already } = setup()
    await open('d1')
    await open('d2', true)
    await allSettled(m.setTab, { scope, params: { slot: 'a', tab: 'audit' } })
    await open('d1', true)
    await open('d2')
    expect(ids()).toEqual({ a: 'd1', b: 'd2' })
    expect(scope.getState(m.$a)?.tab).toBe('audit')
    expect(already()).toEqual([{ id: 'd1', slot: 'a' }, { id: 'd2', slot: 'b' }])
    expect(opened()).toHaveLength(2)
  })

  it("close('a') при открытом B сдвигает B в A вместе с вкладкой", async () => {
    const { m, scope, open, ids } = setup()
    await open('d1')
    await open('d2', true)
    await allSettled(m.setTab, { scope, params: { slot: 'b', tab: 'statuses' } })
    await allSettled(m.close, { scope, params: 'a' })
    expect(ids()).toEqual({ a: 'd2', b: null })
    expect(scope.getState(m.$a)?.tab).toBe('statuses')
  })

  it("close('b') закрывает только B; close('a') без B — пусто", async () => {
    const { m, scope, open, ids } = setup()
    await open('d1')
    await open('d2', true)
    await allSettled(m.close, { scope, params: 'b' })
    expect(ids()).toEqual({ a: 'd1', b: null })
    await allSettled(m.close, { scope, params: 'a' })
    expect(ids()).toEqual({ a: null, b: null })
  })

  it('closeTop закрывает B, если открыт, иначе A; на пустом — ничего', async () => {
    const { m, scope, open, ids } = setup()
    await allSettled(m.closeTop, { scope })
    expect(ids()).toEqual({ a: null, b: null })
    await open('d1')
    await open('d2', true)
    expect(scope.getState(m.$top)).toBe('b')
    await allSettled(m.closeTop, { scope })
    expect(ids()).toEqual({ a: 'd1', b: null })
    await allSettled(m.closeTop, { scope })
    expect(ids()).toEqual({ a: null, b: null })
  })

  it('closeAll закрывает оба', async () => {
    const { m, scope, open, ids } = setup()
    await open('d1')
    await open('d2', true)
    await allSettled(m.closeAll, { scope })
    expect(ids()).toEqual({ a: null, b: null })
  })

  it('setTab меняет вкладку слота; пустой слот не трогает', async () => {
    const { m, scope, open } = setup()
    await allSettled(m.setTab, { scope, params: { slot: 'b', tab: 'audit' } })
    expect(scope.getState(m.$b)).toBeNull()
    await open('d1')
    await allSettled(m.setTab, { scope, params: { slot: 'a', tab: 'audit' } })
    expect(scope.getState(m.$a)).toEqual({ id: 'd1', tab: 'audit' })
  })

  it('firstTab конфигурируется; повторное открытие после закрытия — снова первая вкладка', async () => {
    const { m, scope, open } = setup({ firstTab: 'general' })
    await open('d1')
    await allSettled(m.setTab, { scope, params: { slot: 'a', tab: 'audit' } })
    await allSettled(m.close, { scope, params: 'a' })
    await open('d1')
    expect(scope.getState(m.$a)).toEqual({ id: 'd1', tab: 'general' })
  })
})
