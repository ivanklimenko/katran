import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { autoUpdate, computePosition, flip, offset, shift, type Placement } from '@floating-ui/dom'
import { useKatran } from '../provider/useKatran'
import s from './Overlay.module.css'

export type PopoverProps = {
  open: boolean
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  placement?: Placement
  /** Доступное имя панели. */
  label?: string | undefined
  role?: 'dialog' | 'menu'
  children: ReactNode
  className?: string
  /** Не переносить фокус внутрь автоматически (меню делает это само). */
  manualFocus?: boolean
}

const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function Popover({ open, anchor, onClose, placement = 'bottom-start', label, role = 'dialog', children, className, manualFocus }: PopoverProps) {
  const { portalRoot } = useKatran()
  const box = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  // Актуализация ref происходит в эффекте (без списка зависимостей — на каждый
  // рендер), а не во время самого рендера: мутация ref.current в теле рендера
  // запрещена правилом react-hooks/refs.
  useEffect(() => { onCloseRef.current = onClose })

  // позиция
  useEffect(() => {
    if (!open || !anchor.current || !box.current) return
    const a = anchor.current, b = box.current
    return autoUpdate(a, b, () => {
      computePosition(a, b, { placement, middleware: [offset(4), flip(), shift({ padding: 8 })] })
        .then(({ x, y }) => Object.assign(b.style, { left: `${x}px`, top: `${y}px` }))
    })
  }, [open, anchor, placement])

  // фокус внутрь, возврат при закрытии
  useEffect(() => {
    if (!open || !box.current) return
    const returnTo = anchor.current
    if (!manualFocus) (box.current.querySelector(FOCUSABLE) as HTMLElement | null)?.focus()
    return () => { returnTo?.focus() }
  }, [open, anchor, manualFocus])

  // Escape и клик вне
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current() } }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (box.current?.contains(t) || anchor.current?.contains(t)) return
      onCloseRef.current()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [open, anchor])

  if (!open || !portalRoot) return null
  return createPortal(
    <div ref={box} role={role} aria-label={label} className={[s.pop, className].filter(Boolean).join(' ')}>{children}</div>,
    portalRoot,
  )
}
