import { useRef, type ReactElement, type ReactNode } from 'react'
import { Button } from '../button'
import { useStableId } from '../compat/useStableId'
import { DialogFrame } from './Dialog'
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
  /**
   * Куда вернуть фокус при закрытии, если элемент, бывший в фокусе при открытии, уже не в DOM или фокуса не было (body):
   * кнопка, открывшая окно, исчезла (решение правки) — иначе фокус ушёл бы в body, вне drawer. Вызывается в момент закрытия.
   */
  fallbackFocus?: (() => HTMLElement | null | undefined) | undefined
}

const FIELD = 'input, textarea, select'

/**
 * Подтверждение действия внутри своего документа (спека 2c §2.1, эталон prompt.js) — тонкий слой над `Dialog` (спека 2e §2.1):
 * alertdialog размера m, подложка с data-k-prompt, кнопки — footer. Общее (подложка, ловушка Tab по всем фокусируемым,
 * Esc без всплытия — деталка не закрывается, возврат фокуса и `fallbackFocus`, `busy`) — у `Dialog`; здесь — тексты
 * по умолчанию, пояснение (описание окна), тело, строка ошибки, кнопки и выбор начального фокуса.
 * Тело `children`, `okDisabled`, `busy`, `error` — спека 2d §2.1; `fallbackFocus` — спека 2d, Ruling R19.
 */
export function Prompt({
  open, title = 'Подтвердите действие', note, okLabel = 'Подтвердить', cancelLabel = 'Отмена', tone = 'neutral', onResult,
  children, okDisabled = false, busy = false, error, fallbackFocus,
}: PromptProps): ReactElement | null {
  const noteId = useStableId()
  const body = useRef<HTMLDivElement>(null)
  const ok = useRef<HTMLButtonElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)

  if (!open) return null
  const hasNote = note !== undefined && note !== null && note !== ''
  // с телом — первое поле тела; иначе как в 2c (danger — «Отмена», neutral — основная);
  // недоступная — undefined: Dialog поставит фокус на первую доступную
  const initialFocus = () => {
    const field = body.current?.querySelector<HTMLElement>(FIELD)
    const preferred = (tone === 'danger' ? cancel : ok).current
    return field ?? (preferred && !preferred.disabled ? preferred : undefined)
  }

  return (
    <DialogFrame
      open
      role="alertdialog"
      size="m"
      title={title}
      onClose={() => onResult(false)}
      busy={busy}
      initialFocus={initialFocus}
      fallbackFocus={fallbackFocus}
      describedBy={hasNote ? noteId : undefined}
      scrimMark="prompt"
      bare
      refocusKey={tone}
      watchKey={okDisabled}
      footer={(
        <>
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
        </>
      )}
    >
      {hasNote && <div id={noteId} className={s.note}>{note}</div>}
      {children !== undefined && children !== null && <div ref={body} className={s.body}>{children}</div>}
      {error && <div role="alert" className={s.error}>{error}</div>}
    </DialogFrame>
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
