import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { computePosition, flip, offset, shift } from '@floating-ui/dom'
import { durations } from '@katran/tokens'
import s from './Tooltip.module.css'

type Props = { root: RefObject<HTMLElement | null> }

const findTarget = (e: Event): HTMLElement | null =>
  (e.target as Element | null)?.closest?.('[data-k-tip]') ?? null

const wants = (el: HTMLElement) =>
  el.dataset.kTipIf !== 'truncated' || el.scrollWidth > el.clientWidth

/** Единственный тултип на провайдер. Управляется делегированием событий с корня. */
export function TooltipLayer({ root }: Props) {
  const id = useId()
  const box = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<{ el: HTMLElement; text: string } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const current = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const host = root.current
    if (!host) return

    const hide = () => {
      window.clearTimeout(timer.current)
      current.current?.removeAttribute('aria-describedby')
      current.current = null
      setState(null)
    }
    const show = (el: HTMLElement) => {
      if (current.current === el) return
      hide()
      if (!wants(el)) return
      current.current = el
      timer.current = window.setTimeout(() => {
        el.setAttribute('aria-describedby', id)
        setState({ el, text: el.dataset.kTip ?? '' })
      }, durations.base)
    }
    const onOver = (e: Event) => { const t = findTarget(e); if (t) show(t) }
    const onOut = (e: Event) => {
      const t = findTarget(e)
      if (!t || t !== current.current) return
      const to = (e as PointerEvent).relatedTarget as Node | null
      if (to && t.contains(to)) return
      hide()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }

    host.addEventListener('pointerover', onOver)
    host.addEventListener('pointerout', onOut)
    host.addEventListener('focusin', onOver)
    host.addEventListener('focusout', onOut)
    host.addEventListener('keydown', onKey)
    return () => {
      hide()
      host.removeEventListener('pointerover', onOver)
      host.removeEventListener('pointerout', onOut)
      host.removeEventListener('focusin', onOver)
      host.removeEventListener('focusout', onOut)
      host.removeEventListener('keydown', onKey)
    }
  }, [root, id])

  useEffect(() => {
    if (!state || !box.current) return
    let alive = true
    computePosition(state.el, box.current, { placement: 'top', middleware: [offset(6), flip(), shift({ padding: 8 })] })
      .then(({ x, y }) => { if (alive && box.current) Object.assign(box.current.style, { left: `${x}px`, top: `${y}px` }) })
    return () => { alive = false }
  }, [state])

  if (!state) return null
  return <div ref={box} id={id} role="tooltip" className={s.tip}>{state.text}</div>
}
