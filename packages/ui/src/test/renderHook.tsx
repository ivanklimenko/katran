import { render } from '@testing-library/react'

// renderHook без зависимости от версии Testing Library: в @testing-library/react 16 он
// встроен, в 12 (последняя для React 17) — вынесен в @testing-library/react-hooks,
// который не ставится на React 18+. Свой — на `render`, одинаковом в 12 и 16,
// поэтому тесты хуков идут на React 17 и 19 без правок.
export function renderHook<R, P = undefined>(cb: (props: P) => R, o?: { initialProps?: P | undefined }) {
  const result = { current: undefined as R }
  function Probe({ props }: { props: P }) {
    result.current = cb(props)
    return null
  }
  const r = render(<Probe props={o?.initialProps as P} />)
  return {
    result,
    rerender: (props: P) => r.rerender(<Probe props={props} />),
    unmount: r.unmount,
  }
}
