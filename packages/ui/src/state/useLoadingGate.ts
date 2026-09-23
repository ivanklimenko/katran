import { useEffect, useRef, useState } from 'react'
import { durations } from '@katran/tokens'

export type LoadingGateOptions = { show?: number; min?: number }

/** Порог показа и минимальная длительность скелетона: не мигать на быстрых ответах. */
export function useLoadingGate(loading: boolean, { show = durations['sk-show'], min = durations['sk-min'] }: LoadingGateOptions = {}): boolean {
  const [visible, setVisible] = useState(false)
  const shownAt = useRef<number | null>(null)

  useEffect(() => {
    let t: number | undefined
    if (loading) {
      if (shownAt.current === null) {
        t = window.setTimeout(() => { shownAt.current = Date.now(); setVisible(true) }, show)
      }
    } else if (shownAt.current !== null) {
      const left = Math.max(0, min - (Date.now() - shownAt.current))
      t = window.setTimeout(() => { shownAt.current = null; setVisible(false) }, left)
    }
    return () => window.clearTimeout(t)
  }, [loading, show, min])

  return visible
}
