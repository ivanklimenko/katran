import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { autoUpdate, computePosition, flip, offset, shift, type Placement } from '@floating-ui/dom'
import { useKatran } from '../provider/useKatran'
import s from './Overlay.module.css'

export type PopoverProps = {
  open: boolean
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  placement?: Placement | undefined
  /** id панели — для aria-controls кнопки, которая её открывает. */
  id?: string | undefined
  /** Доступное имя панели. */
  label?: string | undefined
  /** presentation — всплывающий список комбобокса: роль несёт сам `listbox` внутри. */
  role?: 'dialog' | 'menu' | 'presentation' | undefined
  children: ReactNode
  className?: string | undefined
  /** Не переносить фокус внутрь автоматически (меню делает это само). */
  manualFocus?: boolean | undefined
  /** Куда вернуть фокус при закрытии; по умолчанию anchor (для полей с обёрткой-якорем — само поле). */
  returnFocus?: RefObject<HTMLElement | null> | undefined
}

const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function Popover({ open, anchor, onClose, placement = 'bottom-start', id, label, role = 'dialog', children, className, manualFocus, returnFocus }: PopoverProps) {
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

  // фокус внутрь, возврат при закрытии. У списка комбобокса (presentation) — ни того, ни другого:
  // фокус всё время в поле, а возврат при закрытии по Tab забрал бы его из следующего поля.
  useEffect(() => {
    if (!open || !box.current || role === 'presentation') return
    const returnTo = (returnFocus ?? anchor).current
    if (!manualFocus) (box.current.querySelector(FOCUSABLE) as HTMLElement | null)?.focus()
    // Возврат — только если фокус был внутри снятой панели (тогда activeElement — body/null). Если фокус уже ушёл
    // в другой элемент (Tab с края панели, клик по соседней кнопке), отнимать его нельзя: эффект очистки в React 17
    // срабатывает уже после перехода по Tab.
    return () => {
      const at = document.activeElement
      if (at === null || at === document.body) returnTo?.focus()
    }
  }, [open, anchor, returnFocus, role, manualFocus])

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
    <div ref={box} id={id} role={role} aria-label={role === 'presentation' ? undefined : label} className={[s.pop, className].filter(Boolean).join(' ')}>{children}</div>,
    portalRoot,
  )
}
