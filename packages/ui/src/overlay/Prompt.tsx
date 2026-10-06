import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactElement, type ReactNode } from 'react'
import { Button } from '../button'
import { useStableId } from '../compat/useStableId'
import s from './Prompt.module.css'

export type PromptTone = 'neutral' | 'danger'

export type PromptProps = {
  open: boolean
  /** Заголовок и доступное имя окна; по умолчанию «Подтвердите действие» (prompt.js). */
  title?: string | undefined
  /** Пояснение — доступное описание окна; «было → стало» собирается элементом PromptChange. */
  note?: ReactNode | undefined
  /** Основная кнопка; по умолчанию «Подтвердить». */
  okLabel?: string | undefined
  /** По умолчанию «Отмена». */
  cancelLabel?: string | undefined
  /** danger — основная кнопка цвета bad, фокус при открытии на «Отмене»; по умолчанию neutral — фокус на основной. */
  tone?: PromptTone | undefined
  /** true — основная кнопка; false — «Отмена», Esc, mousedown по подложке. */
  onResult: (ok: boolean) => void
  /** Тело между пояснением и кнопками (поле причины); при открытии фокус — на первом поле тела. */
  children?: ReactNode | undefined
  /** Основная кнопка недоступна (например, пока обязательное поле тела пусто). */
  okDisabled?: boolean | undefined
  /** Запрос в полёте: обе кнопки недоступны, aria-busy на окне, Esc и подложка не закрывают. */
  busy?: boolean | undefined
  /** Строка ошибки над кнопками (role="alert"). */
  error?: string | undefined
}

/** Фокусируемые элементы коробки (ловушка Tab): поля, кнопки и элементы с неотрицательным tabindex, кроме недоступных. */
const FOCUSABLE = 'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
const FIELD = 'input, textarea, select'
const focusables = (box: HTMLElement): HTMLElement[] =>
  Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !(el as HTMLButtonElement).disabled && el.getAttribute('type') !== 'hidden')

/**
 * Подтверждение действия внутри своего документа (спека 2c §2.1, эталон prompt.js): без портала — рисуется там, куда
 * положен (слой Drawer.overlay), подложка накрывает только этот drawer. Коробка — alertdialog с aria-modal;
 * Tab ходит по кругу по всем фокусируемым коробки (без тела — между двумя кнопками), Esc — отказ без всплытия
 * (деталка не закрывается). Тело `children`, `okDisabled`, `busy`, `error` — спека 2d §2.1; `busy` гасит Esc и подложку.
 * Закрытие (open → false или размонтирование) возвращает фокус туда, где он был при открытии, если тот элемент ещё в DOM.
 */
export function Prompt({
  open, title = 'Подтвердите действие', note, okLabel = 'Подтвердить', cancelLabel = 'Отмена', tone = 'neutral', onResult,
  children, okDisabled = false, busy = false, error,
}: PromptProps): ReactElement | null {
  const titleId = useStableId()
  const noteId = useStableId()
  const box = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const ok = useRef<HTMLButtonElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const before = document.activeElement
    // с телом — первое поле тела; иначе как в 2c (danger — «Отмена», neutral — основная); недоступная — первая доступная
    const field = body.current?.querySelector<HTMLElement>(FIELD)
    const preferred = (tone === 'danger' ? cancel : ok).current
    const target = field ?? (preferred && !preferred.disabled ? preferred : (box.current && focusables(box.current)[0]))
    target?.focus()
    return () => {
      if (before instanceof HTMLElement && before.isConnected) before.focus()
    }
  }, [open, tone])

  // кнопка, ставшая недоступной (busy), теряет клавиатуру: фокус — на коробку, чтобы Esc и Tab оставались в окне
  useEffect(() => {
    if (!open || !box.current) return
    const active = document.activeElement
    const lost = active === null || active === document.body
      || (box.current.contains(active) && (active as HTMLButtonElement).disabled === true)
    if (lost) box.current.focus()
  }, [open, busy, okDisabled])

  if (!open) return null
  const hasNote = note !== undefined && note !== null && note !== ''

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      if (!busy) onResult(false)
    } else if (e.key === 'Tab' && box.current) {
      // по кругу по всем фокусируемым; с коробки (вне списка) Tab — на первый, Shift+Tab — на последний
      e.preventDefault()
      const all = focusables(box.current)
      if (all.length === 0) return
      const i = all.indexOf(document.activeElement as HTMLElement)
      const next = e.shiftKey ? (i <= 0 ? all.length - 1 : i - 1) : (i < 0 || i === all.length - 1 ? 0 : i + 1)
      all[next]?.focus()
    }
  }
  // только левой кнопкой и по самой подложке: mousedown внутри коробки сюда приходит с другим target
  const onScrimDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!busy && e.button === 0 && e.target === e.currentTarget) onResult(false)
  }

  return (
    // клавиши — на подложке (role="presentation", как обёртки поповеров кита): фокус всегда на кнопках коробки, keydown всплывает сюда
    <div role="presentation" className={s.scrim} data-k-prompt="" onMouseDown={onScrimDown} onKeyDown={onKeyDown}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hasNote ? noteId : undefined}
        aria-busy={busy || undefined}
        ref={box}
        // клик по тексту коробки фокусирует её, а не body: Esc и ловушка Tab продолжают работать
        tabIndex={-1}
        className={s.box}
      >
        <h4 id={titleId} className={s.title}>{title}</h4>
        {hasNote && <div id={noteId} className={s.note}>{note}</div>}
        {children !== undefined && children !== null && <div ref={body} className={s.body}>{children}</div>}
        {error && <div role="alert" className={s.error}>{error}</div>}
        <div className={s.acts}>
          <Button ref={cancel} className={s.btn} disabled={busy} onClick={() => onResult(false)}>{cancelLabel}</Button>
          <Button
            ref={ok}
            variant="primary"
            disabled={busy || okDisabled}
            className={[s.btn, tone === 'danger' ? s.danger : ''].filter(Boolean).join(' ')}
            onClick={() => onResult(true)}
          >
            {okLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** «Было → стало» для note: прежнее зачёркнуто, новое выделено (эталон .note .was/.arr/.now). */
export function PromptChange({ was, now }: { was: string; now: string }): ReactElement {
  return (
    <>
      {/* пробелы — текстом вне span: иначе доступное описание склеит «было→стало» */}
      <span className={s.was}>{was}</span>{' '}<span className={s.arr}>→</span>{' '}<span className={s.now}>{now}</span>
    </>
  )
}
