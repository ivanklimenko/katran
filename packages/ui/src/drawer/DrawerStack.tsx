import { Fragment, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useKatran } from '../provider/useKatran'
import s from './Drawer.module.css'

export type DrawerStackItem = {
  /** Ключ — id документа: при сдвиге B в A панель не пересоздаётся (фокус и прокрутка остаются). */
  key: string
  slot: 'a' | 'b'
  node: ReactNode
}
export type DrawerStackProps = {
  items: DrawerStackItem[]
  /** Esc вне полей ввода, меню и поповеров — закрыть верхний. */
  onEscape: () => void
}

/** У этих элементов Esc свой: поле ввода, меню, список, поповер (не сама деталка). */
const OWN_ESCAPE = 'input, textarea, select, [contenteditable="true"], [role="menu"], [role="listbox"], [role="dialog"]:not([data-k-drawer])'

/**
 * Раскладка двух drawer'ов (спека 2a §3.1): A у правого края, B слева от A; пустой слот не рендерится.
 * Портал — в корень провайдера: вне скролла и трансформаций страницы, под изоляцией кита.
 * Esc слушается на document в фазе захвата — раньше ячейки грида, которая гасит Esc сама; поповер
 * и меню ловят Esc тоже в захвате и тоже раньше по порядку подписки — их фокус исключён селектором.
 */
export function DrawerStack({ items, onEscape }: DrawerStackProps) {
  const { portalRoot } = useKatran()
  const onEscapeRef = useRef(onEscape)
  useEffect(() => { onEscapeRef.current = onEscape })
  const any = items.length > 0
  useEffect(() => {
    if (!any) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const t = e.target
      if (t instanceof Element && t.closest(OWN_ESCAPE)) return
      e.preventDefault()
      e.stopPropagation()
      onEscapeRef.current()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [any])
  if (!any || !portalRoot) return null
  // flex-end: порядок в DOM — b, затем a, поэтому B встаёт слева от A
  const ordered = [...items].sort((x, y) => (x.slot === y.slot ? 0 : x.slot === 'b' ? -1 : 1))
  return createPortal(
    <div className={s.stack}>{ordered.map((it) => <Fragment key={it.key}>{it.node}</Fragment>)}</div>,
    portalRoot,
  )
}
