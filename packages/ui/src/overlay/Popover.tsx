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

  // Escape и клик вне. Окно поверх ([data-k-dialog] — подложка любого Dialog, в том числе Prompt; модальный слой деталки) —
  // не «вне»: его Esc и кнопки решают сами, иначе поповер закрыл бы правку под Prompt раньше ответа (или себя вместо окна).
  // Но фокус, ушедший в такое окно, — окно открылось поверх (с клавиатуры: Tab из поповера дальше по странице и Enter):
  // панель (не список комбобокса — тот живёт под Prompt правки) закрывается, иначе она слоем --k-z-menu осталась бы над
  // подложкой окна и перехватывала бы клики. Фокус окна закрытие не отнимает (возврат — только из body).
  useEffect(() => {
    if (!open) return
    const inDialog = (t: EventTarget | null) => t instanceof Element && t.closest('[data-k-dialog]') !== null
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || inDialog(e.target)) return
      e.stopPropagation()
      onCloseRef.current()
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (box.current?.contains(t) || anchor.current?.contains(t) || inDialog(e.target)) return
      onCloseRef.current()
    }
    const onFocus = (e: FocusEvent) => {
      if (role === 'presentation' || !(e.target instanceof Element) || box.current?.contains(e.target)) return
      // окно, в котором живёт сам якорь (поповер внутри окна), — не «поверх»
      const win = e.target.closest('[data-k-dialog]')
      if (win === null || (anchor.current !== null && win.contains(anchor.current))) return
      onCloseRef.current()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('focusin', onFocus, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('focusin', onFocus, true)
    }
  }, [open, anchor, role])

  if (!open || !portalRoot) return null
  return createPortal(
    <div ref={box} id={id} role={role} aria-label={role === 'presentation' ? undefined : label} className={[s.pop, className].filter(Boolean).join(' ')}>{children}</div>,
    portalRoot,
  )
}
