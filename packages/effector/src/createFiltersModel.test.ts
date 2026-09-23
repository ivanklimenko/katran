import { allSettled, fork } from 'effector'
import { createFiltersModel } from './createFiltersModel'

describe('createFiltersModel', () => {
  it('edit → черновик; apply → применённые; $dirty отражает разницу', async () => {
    const m = createFiltersModel()
    const scope = fork()
    await allSettled(m.edit, { scope, params: { field: 'status', op: 'IN', values: ['ERROR'] } })
    expect(scope.getState(m.$draft)).toEqual([{ field: 'status', op: 'IN', values: ['ERROR'] }])
    expect(scope.getState(m.$conditions)).toEqual([])
    expect(scope.getState(m.$dirty)).toBe(true)
    await allSettled(m.apply, { scope })
    expect(scope.getState(m.$conditions)).toEqual([{ field: 'status', op: 'IN', values: ['ERROR'] }])
    expect(scope.getState(m.$dirty)).toBe(false)
  })

  it('edit по тому же полю заменяет условие, discard убирает из черновика', async () => {
    const m = createFiltersModel()
    const scope = fork()
    await allSettled(m.edit, { scope, params: { field: 'amount', op: 'GT', value: 100 } })
    await allSettled(m.edit, { scope, params: { field: 'amount', op: 'BETWEEN', from: 1, to: 2 } })
    expect(scope.getState(m.$draft)).toEqual([{ field: 'amount', op: 'BETWEEN', from: 1, to: 2 }])
    await allSettled(m.discard, { scope, params: 'amount' })
    expect(scope.getState(m.$draft)).toEqual([])
  })

  it('remove снимает применённое условие и из черновика; reset чистит всё', async () => {
    const m = createFiltersModel({ initial: [{ field: 'a', op: 'EQ', value: 1 }, { field: 'b', op: 'IS_EMPTY' }] })
    const scope = fork()
    expect(scope.getState(m.$conditions)).toHaveLength(2)
    await allSettled(m.remove, { scope, params: 'a' })
    expect(scope.getState(m.$conditions)).toEqual([{ field: 'b', op: 'IS_EMPTY' }])
    expect(scope.getState(m.$draft)).toEqual([{ field: 'b', op: 'IS_EMPTY' }])
    await allSettled(m.reset, { scope })
    expect(scope.getState(m.$conditions)).toEqual([])
    expect(scope.getState(m.$draft)).toEqual([])
  })

  it('remove применённого поля не затирает неприменённую правку другого поля в черновике', async () => {
    const m = createFiltersModel({ initial: [{ field: 'a', op: 'EQ', value: 1 }, { field: 'b', op: 'EQ', value: 2 }] })
    const scope = fork()
    await allSettled(m.edit, { scope, params: { field: 'a', op: 'EQ', value: 42 } })
    await allSettled(m.remove, { scope, params: 'b' })
    expect(scope.getState(m.$conditions)).toEqual([{ field: 'a', op: 'EQ', value: 1 }])
    expect(scope.getState(m.$draft)).toEqual([{ field: 'a', op: 'EQ', value: 42 }])
    expect(scope.getState(m.$dirty)).toBe(true)
  })

  it('две модели независимы (фабрика, не синглтон)', async () => {
    const a = createFiltersModel(), b = createFiltersModel()
    const scope = fork()
    await allSettled(a.edit, { scope, params: { field: 'x', op: 'EQ', value: 1 } })
    expect(scope.getState(b.$draft)).toEqual([])
  })
})
