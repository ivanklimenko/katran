import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import s from './Provider.module.css'

export type LiveRegionHandle = { announce: (text: string) => void }

/** Одна живая область на провайдер. Текст перезаписывается — скринридер читает последнее. */
export const LiveRegion = forwardRef<LiveRegionHandle>(function LiveRegion(_, ref) {
  const [text, setText] = useState('')
  const frame = useRef(0)
  useImperativeHandle(ref, () => ({
    announce: (t) => {
      setText('')
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(() => setText(t))
    },
  }), [])
  // Кадр, запрошенный перед размонтированием, не должен писать в снятый компонент
  // (React 17 ругается на это в dev: «state update on an unmounted component»).
  useEffect(() => {
    const f = frame
    return () => cancelAnimationFrame(f.current)
  }, [])
  return <div role="status" aria-live="polite" className={s.live}>{text}</div>
})
