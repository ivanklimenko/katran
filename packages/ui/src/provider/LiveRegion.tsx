import { forwardRef, useImperativeHandle, useState } from 'react'
import s from './Provider.module.css'

export type LiveRegionHandle = { announce: (text: string) => void }

/** Одна живая область на провайдер. Текст перезаписывается — скринридер читает последнее. */
export const LiveRegion = forwardRef<LiveRegionHandle>(function LiveRegion(_, ref) {
  const [text, setText] = useState('')
  useImperativeHandle(ref, () => ({
    announce: (t) => { setText(''); requestAnimationFrame(() => setText(t)) },
  }), [])
  return <div role="status" aria-live="polite" className={s.live}>{text}</div>
})
