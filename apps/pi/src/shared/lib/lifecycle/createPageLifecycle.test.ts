import { allSettled, fork } from 'effector'
import { createPageLifecycle } from './createPageLifecycle'

describe('createPageLifecycle', () => {
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
