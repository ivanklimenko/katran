import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { useStableId } from './useStableId'

const Probe = ({ n }: { n: number }) => <span data-testid="p" data-n={n}>{useStableId()}</span>

describe('useStableId', () => {
  it('на React 18+ — это React.useId, на 17 — фолбэк', () => {
    const native = (React as unknown as { useId?: unknown }).useId
    if (typeof native === 'function') expect(useStableId).toBe(native)
    else expect(useStableId).not.toBe(native)
  })

  it('id уникальны у экземпляров и не меняются между рендерами', () => {
    const { rerender } = render(<><Probe n={1} /><Probe n={1} /></>)
    const first = screen.getAllByTestId('p').map((e) => e.textContent)
    expect(first[0]).toBeTruthy()
    expect(first[0]).not.toBe(first[1])
    rerender(<><Probe n={2} /><Probe n={2} /></>)
    expect(screen.getAllByTestId('p').map((e) => e.textContent)).toEqual(first)
  })
})
