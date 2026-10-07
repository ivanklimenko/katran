import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactElement, type ReactNode } from 'react'
import { useStableId } from '../compat/useStableId'
import s from './Dialog.module.css'

export type DialogTone = 'neutral' | 'danger'

export type DialogProps = {
  open: boolean
  /** Видимый заголовок и доступное имя окна (aria-labelledby). */
  title: string
  /** Esc, mousedown левой кнопкой по подложке — пока не `busy`. Кнопки footer закрывают окно сами. */
  onClose: () => void
  children: ReactNode
  /** Кнопки окна — справа внизу. */
  footer?: ReactNode | undefined
  /** danger — заголовок цветом bad. */
  tone?: DialogTone | undefined
  /** Запрос в полёте: aria-busy на окне, Esc и подложка не вызывают onClose. Кнопки гасит потребитель. */
  busy?: boolean | undefined
  /** m — ширина Prompt (токен prompt-w), l — окно сообщения (токен dialog-l); по умолчанию m. */
  size?: 'm' | 'l' | undefined
  /** По умолчанию dialog; Prompt передаёт alertdialog. */
  role?: 'dialog' | 'alertdialog' | undefined
  /** Куда поставить фокус при открытии; null/undefined — первый фокусируемый окна, нет такого — само окно. */
  initialFocus?: (() => HTMLElement | null | undefined) | undefined
  /**
   * Куда вернуть фокус при закрытии, если элемент, бывший в фокусе при открытии, уже не в DOM или фокуса не было (body).
   * Вызывается в момент закрытия.
   */
  fallbackFocus?: (() => HTMLElement | null | undefined) | undefined
}

/**
 * Внутренние расширения для Prompt (не экспортируются из пакета): Prompt рисуется поверх Dialog без изменения поведения 2c–2d.
 * `describedBy` — id пояснения; `scrimMark` — data-k-prompt на подложке (по нему Popover и правка приложения узнают слой Prompt);
 * `bare` — тело без обёртки (отступы блоков Prompt — свои); `refocusKey` — смена при открытом окне заново ставит начальный фокус
 * (Prompt: tone); `watchKey` — смена заново проверяет потерю фокуса (Prompt: okDisabled).
 */
export type DialogFrameProps = DialogProps & {
  describedBy?: string | undefined
  scrimMark?: 'prompt' | undefined
  bare?: boolean | undefined
  refocusKey?: string | undefined
  watchKey?: boolean | undefined
}

/** Фокусируемые элементы окна (ловушка Tab): поля, кнопки и элементы с неотрицательным tabindex, кроме недоступных. */
const FOCUSABLE = 'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
const focusables = (box: HTMLElement): HTMLElement[] =>
  Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !(el as HTMLButtonElement).disabled && el.getAttribute('type') !== 'hidden')

/**
 * Модальное окно внутри своего слоя (спека 2e §2.1): без портала — подложка `position: absolute; inset: 0` накрывает
 * ближайший позиционированный предок (в деталке — слой Drawer.overlay, только этот drawer; в демо — обёртку с
 * `position: relative`). Окно — dialog (или alertdialog) с aria-modal и именем из заголовка; Tab ходит по кругу по всем
 * фокусируемым окна; Esc — onClose без всплытия (drawer не закрывается), mousedown левой кнопкой по подложке — onClose;
 * `busy` гасит оба. Закрытие (open → false или размонтирование) возвращает фокус туда, где он был при открытии, если тот
 * элемент ещё в DOM; иначе — на `fallbackFocus()`. Без `dialog.showModal` и `inert` (Chromium 88).
 */
export function Dialog(props: DialogProps): ReactElement | null {
  return <DialogFrame {...props} />
}

export function DialogFrame({
  open, title, onClose, children, footer, tone = 'neutral', busy = false, size = 'm', role = 'dialog', initialFocus, fallbackFocus,
  describedBy, scrimMark, bare = false, refocusKey, watchKey,
}: DialogFrameProps): ReactElement | null {
  const titleId = useStableId()
  const box = useRef<HTMLDivElement>(null)
  // функции фокуса — свежие из последнего рендера, без пересоздания эффектов
  const initial = useRef(initialFocus)
  const fallback = useRef(fallbackFocus)
  useLayoutEffect(() => {
    initial.current = initialFocus
    fallback.current = fallbackFocus
  })

  useEffect(() => {
    if (!open) return undefined
    const before = document.activeElement
    const target = initial.current?.() ?? (box.current && (focusables(box.current)[0] ?? box.current))
    target?.focus()
    return () => {
      // body — фокуса не было (открывшая кнопка пропала, едва окно открылось): тоже запасной
      if (before instanceof HTMLElement && before !== document.body && before.isConnected) before.focus()
      else fallback.current?.()?.focus()
    }
  }, [open, refocusKey])

  // кнопка, ставшая недоступной (busy), теряет клавиатуру: фокус — на окно, чтобы Esc и Tab оставались в нём
  useEffect(() => {
    if (!open || !box.current) return
    const active = document.activeElement
    const lost = active === null || active === document.body
      || (box.current.contains(active) && (active as HTMLButtonElement).disabled === true)
    if (lost) box.current.focus()
  }, [open, busy, watchKey])

  if (!open) return null

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      if (!busy) onClose()
    } else if (e.key === 'Tab' && box.current) {
      // по кругу по всем фокусируемым; с окна (вне списка) Tab — на первый, Shift+Tab — на последний
      e.preventDefault()
      const all = focusables(box.current)
      if (all.length === 0) return
      const i = all.indexOf(document.activeElement as HTMLElement)
      const next = e.shiftKey ? (i <= 0 ? all.length - 1 : i - 1) : (i < 0 || i === all.length - 1 ? 0 : i + 1)
      all[next]?.focus()
    }
  }
  // только левой кнопкой и по самой подложке: mousedown внутри окна сюда приходит с другим target
  const onScrimDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!busy && e.button === 0 && e.target === e.currentTarget) onClose()
  }

  return (
    // клавиши — на подложке (role="presentation", как обёртки поповеров кита): фокус всегда внутри окна, keydown всплывает сюда
    <div
      role="presentation"
      className={s.scrim}
      data-k-dialog=""
      data-k-prompt={scrimMark === 'prompt' ? '' : undefined}
      onMouseDown={onScrimDown}
      onKeyDown={onKeyDown}
    >
      <div
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        aria-busy={busy || undefined}
        ref={box}
        // клик по тексту окна фокусирует его, а не body: Esc и ловушка Tab продолжают работать
        tabIndex={-1}
        className={s.box}
        data-size={size}
        data-tone={tone}
      >
        <h4 id={titleId} className={s.title}>{title}</h4>
        {bare ? children : <div className={s.content}>{children}</div>}
        {footer !== undefined && footer !== null && <div className={s.acts}>{footer}</div>}
      </div>
    </div>
  )
}
