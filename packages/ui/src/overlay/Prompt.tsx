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
}

/**
 * Подтверждение действия внутри своего документа (спека 2c §2.1, эталон prompt.js): без портала — рисуется там, куда
 * положен (слой Drawer.overlay), подложка накрывает только этот drawer. Коробка — alertdialog с aria-modal;
 * Tab ходит только между двумя кнопками, Esc — отказ без всплытия (деталка не закрывается).
 * Закрытие (open → false или размонтирование) возвращает фокус туда, где он был при открытии, если тот элемент ещё в DOM.
 */
export function Prompt({
  open, title = 'Подтвердите действие', note, okLabel = 'Подтвердить', cancelLabel = 'Отмена', tone = 'neutral', onResult,
}: PromptProps): ReactElement | null {
  const titleId = useStableId()
  const noteId = useStableId()
  const ok = useRef<HTMLButtonElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const before = document.activeElement
    ;(tone === 'danger' ? cancel : ok).current?.focus()
    return () => {
      if (before instanceof HTMLElement && before.isConnected) before.focus()
    }
  }, [open, tone])

  if (!open) return null
  const hasNote = note !== undefined && note !== null && note !== ''

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onResult(false)
    } else if (e.key === 'Tab') {
      // кнопок две: и Tab, и Shift+Tab ведут на другую
      e.preventDefault()
      ;(document.activeElement === cancel.current ? ok : cancel).current?.focus()
    }
  }
  // только левой кнопкой и по самой подложке: mousedown внутри коробки сюда приходит с другим target
  const onScrimDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button === 0 && e.target === e.currentTarget) onResult(false)
  }

  return (
    // клавиши — на подложке (role="presentation", как обёртки поповеров кита): фокус всегда на кнопках коробки, keydown всплывает сюда
    <div role="presentation" className={s.scrim} data-k-prompt="" onMouseDown={onScrimDown} onKeyDown={onKeyDown}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hasNote ? noteId : undefined}
        // клик по тексту коробки фокусирует её, а не body: Esc и ловушка Tab продолжают работать
        tabIndex={-1}
        className={s.box}
      >
        <h4 id={titleId} className={s.title}>{title}</h4>
        {hasNote && <div id={noteId} className={s.note}>{note}</div>}
        <div className={s.acts}>
          <Button ref={cancel} className={s.btn} onClick={() => onResult(false)}>{cancelLabel}</Button>
          <Button
            ref={ok}
            variant="primary"
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
