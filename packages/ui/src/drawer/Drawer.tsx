import { useEffect, useRef, type ReactNode } from 'react'
import { IconButton } from '../button'
import s from './Drawer.module.css'

export type DrawerProps = {
  /** Доступное имя диалога: «Платёжная инструкция № 812345» (видимый заголовок номера не содержит). */
  label: string
  /** Видимый заголовок шапки. */
  title: string
  /** Правее заголовка: uuid линк-кнопкой, дата создания. */
  meta?: ReactNode | undefined
  onClose: () => void
  /**
   * Куда вернуть фокус при закрытии (размонтировании): элемент передаёт вызывающий. Возврат — только если фокус потерян
   * (был внутри drawer и после его снятия оказался на body); фокус, ушедший из drawer в другое место, не трогается.
   * null, снятый со страницы элемент или исключение в функции — фокус не трогается.
   */
  returnFocus?: (() => HTMLElement | null) | undefined
  /**
   * Переводить ли фокус в заголовок при открытии (монтировании); по умолчанию да. false — открытие не пользователем
   * (автооткрытие первой записи): фокус остаётся, где был. Смена focusKey переводит фокус в заголовок в любом случае.
   */
  initialFocus?: boolean | undefined
  /** Смена значения снова переводит фокус в заголовок — повторное открытие уже открытого документа. */
  focusKey?: number | undefined
  /** Метка слота над шапкой: «A» или «B · сравнение». */
  badge?: { text: string; tone: 'a' | 'b' } | undefined
  children?: ReactNode
}

const X = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>

type ReturnRef = { current: (() => HTMLElement | null) | undefined }
/**
 * Куда кит сам вернул фокус последним закрытием. Фокус, который стоит там же, не пользовательский: Esc по B вернул его
 * на кнопку B, следующий Esc по A должен вернуть его на кнопку A (спека 2a §5), а не оставить у B.
 */
let restoredTo: HTMLElement | null = null

/**
 * Возврат фокуса — отдельной функцией: в очистке эффекта читается последняя переданная returnFocus, а не снимок монтирования.
 * Очистка пассивная — узла drawer уже нет, фокус, бывший внутри, браузер перевёл на body. Возврат — только если фокус
 * потерян так (или стоит там, куда его поставило прошлое закрытие): фокус, который пользователь увёл сам, не трогается.
 * Исключение вызывающего глушится: брошенное из очистки эффекта в React 17 размонтирует всё дерево.
 */
function restoreFocus(ref: ReturnRef) {
  const active = document.activeElement
  if (active !== null && active !== document.body && active !== restoredTo) return
  try {
    const el = ref.current?.()
    if (el && el.isConnected) {
      el.focus()
      restoredTo = el
    }
  } catch {
    // фокус не трогается — как при null
  }
}

/**
 * Панель деталки фиксированной ширины у правого края окна (спека 2a §3.1). Не модальная: реестр под ней рабочий,
 * поэтому роль dialog без aria-modal. Esc и раскладку двух панелей держит DrawerStack.
 */
export function Drawer({ label, title, meta, onClose, returnFocus, initialFocus = true, focusKey, badge, children }: DrawerProps) {
  const head = useRef<HTMLHeadingElement>(null)
  const returnRef = useRef(returnFocus)
  // Актуализация ref — в эффекте, не в теле рендера (правило react-hooks/refs), как в Popover
  useEffect(() => { returnRef.current = returnFocus })
  // фокус в заголовок — при открытии (если initialFocus) и по запросу (смена focusKey)
  const mounted = useRef(false)
  const initialRef = useRef(initialFocus)
  useEffect(() => {
    if (mounted.current || initialRef.current) head.current?.focus()
    mounted.current = true
  }, [focusKey])
  // при закрытии — туда, откуда открыли
  useEffect(() => () => restoreFocus(returnRef), [])
  return (
    <div role="dialog" aria-label={label} data-k-drawer="" data-slot={badge?.tone} className={s.drawer}>
      {badge && <span className={s.badge} data-tone={badge.tone}>{badge.text}</span>}
      {/* div, а не header: два drawer'а дали бы два ориентира banner (axe landmark-no-duplicate-banner) */}
      <div className={s.head} data-part="head">
        <h2 ref={head} tabIndex={-1} className={s.title}>{title}</h2>
        {meta && <div className={s.meta}>{meta}</div>}
        <IconButton label="Закрыть" className={s.close} onClick={onClose}><X /></IconButton>
      </div>
      {children}
    </div>
  )
}
