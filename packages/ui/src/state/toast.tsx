import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { k } from '@katran/tokens'
import { useStableId } from '../compat/useStableId'
import { css, keyframes, styled } from '../styled'
import { BannerLayout, type BannerTone } from './Banner'

export type ToastTone = BannerTone

export type ToastInput = {
  tone?: ToastTone | undefined
  text: string
  /** Миллисекунды. По умолчанию 4000, 0 — до закрытия. */
  duration?: number | undefined
}

export type ToastApi = {
  /** Возвращает ID тоста для close. */
  show: (input: ToastInput) => string
  close: (id: string) => void
}

type ToastEntry = { id: string; tone: ToastTone; text: string; duration: number }

const ToastContext = createContext<ToastApi | null>(null)
const visibleLimit = 4
const defaultDuration = 4000

const Region = styled.div`
  position: fixed;
  top: ${k.sp3};
  right: ${k.sp3};
  z-index: ${k.zToast};
  display: grid;
  gap: ${k.sp2};
  width: min(${k.side}, calc(100% - 2 * ${k.sp3}));
  pointer-events: none;
`

const enterFrames = css`
  from {
    transform: translateY(calc(-1 * ${k.sp1}));
  }
`
const enter = keyframes`${enterFrames}`

const Card = styled(BannerLayout)`
  box-shadow: ${k.shadow};
  overflow-wrap: anywhere;
  pointer-events: auto;
  animation: ${enter} ${k.tFast} ease-out;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

function VisibleToast({ item, close }: { item: ToastEntry; close: ToastApi['close'] }) {
  const { id, duration, tone, text } = item
  useEffect(() => {
    if (duration === 0) return
    const timer = window.setTimeout(() => close(id), duration)
    return () => window.clearTimeout(timer)
  }, [close, duration, id])

  const role = tone === 'warn' || tone === 'bad' ? 'alert' : 'status'
  return <Card tone={tone} messageRole={role} onClose={() => close(id)}>{text}</Card>
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<ToastEntry[]>([])
  const prefix = useStableId()
  const counter = useRef(0)

  const show = useCallback(({ tone = 'neutral', text, duration = defaultDuration }: ToastInput) => {
    const id = prefix + '-toast-' + ++counter.current
    const timeout = Number.isFinite(duration) && duration >= 0 ? Math.min(duration, 2_147_483_647) : defaultDuration
    setQueue((items) => [...items, { id, tone, text, duration: timeout }])
    return id
  }, [prefix])

  const close = useCallback((id: string) => {
    setQueue((items) => {
      const remaining = items.filter((item) => item.id !== id)
      return remaining.length === items.length ? items : remaining
    })
  }, [])

  const api = useMemo(() => ({ show, close }), [show, close])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Region data-part="toasts" aria-live="polite">
        {queue.slice(0, visibleLimit).map((item) => <VisibleToast key={item.id} item={item} close={close} />)}
      </Region>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (api === null) throw new Error('useToast: требуется KatranProvider')
  return api
}
