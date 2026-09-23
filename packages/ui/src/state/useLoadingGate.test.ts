import { act, renderHook } from '@testing-library/react'
import { useLoadingGate } from './useLoadingGate'

describe('useLoadingGate', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('короткая загрузка (<200 мс) скелетон не показывает', () => {
    const { result, rerender } = renderHook(({ l }) => useLoadingGate(l), { initialProps: { l: true } })
    expect(result.current).toBe(false)
    act(() => { vi.advanceTimersByTime(150) })
    rerender({ l: false })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current).toBe(false)
  })

  it('долгая загрузка: показ после 200 мс, держится минимум 400 мс', () => {
    const { result, rerender } = renderHook(({ l }) => useLoadingGate(l), { initialProps: { l: true } })
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current).toBe(true)
    rerender({ l: false })
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current).toBe(true)
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current).toBe(false)
  })
})
