import { allSettled, fork } from 'effector'
import { createPageLifecycle } from './createPageLifecycle'

describe('createPageLifecycle', () => {
  it('два вызова фабрики создают независимые lifecycle', async () => {
    const a = createPageLifecycle()
    const b = createPageLifecycle()
    const scope = fork()
    await allSettled(a.pageOpened, { scope })
    expect(scope.getState(a.$opened)).toBe(true)
    expect(scope.getState(b.$opened)).toBe(false)
    await allSettled(b.pageOpened, { scope })
    await allSettled(a.pageClosed, { scope })
    expect(scope.getState(a.$opened)).toBe(false)
    expect(scope.getState(b.$opened)).toBe(true)
  })

  it('$opened: false → pageOpened → true → pageClosed → false', async () => {
    const l = createPageLifecycle()
    const scope = fork()
    expect(scope.getState(l.$opened)).toBe(false)
    await allSettled(l.pageOpened, { scope })
    expect(scope.getState(l.$opened)).toBe(true)
    await allSettled(l.pageClosed, { scope })
    expect(scope.getState(l.$opened)).toBe(false)
  })
})
