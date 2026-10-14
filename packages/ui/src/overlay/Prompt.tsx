import { useRef, type ReactElement, type ReactNode } from 'react'
import { k } from '@katran/tokens'
import { Button } from '../button'
import { useStableId } from '../compat/useStableId'
import { styled } from '../styled'
import { DialogFrame } from './Dialog'

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
  /** Класс корня — подложки окна. */
  className?: string | undefined
}

/* Подложка, окно, заголовок и ряд кнопок — у Dialog; здесь — блоки тела Prompt и его кнопки */

const Note = styled.div`
  margin: ${k.sp2} 0 0;
  font: ${k.fs1} / 1.45 ${k.sans};
  color: ${k.ink2};
`

/* «было → стало» (эталон .note .was/.arr/.now): значения моноширинно, стрелка служебная */
const Was = styled.span`
  font-family: ${k.mono};
  color: ${k.muted};
  text-decoration: line-through;
  text-decoration-color: ${k.line};
`

const Arr = styled.span`
  color: ${k.faint};
`

const Now = styled.span`
  font-family: ${k.mono};
  font-weight: 600;
  color: ${k.ink};
`

/* тело (поле причины) под пояснением; строка ошибки — над кнопками, цвет bad */
const Body = styled.div`
  margin-top: ${k.sp3};
`

const ErrorLine = styled.div`
  margin-top: ${k.sp2};
  font: ${k.fs2} / 1.3 ${k.sans};
  color: ${k.bad};
`

/*
 * Кнопки кита высотой 30 с отступом 14 (эталон .pr button); двойной класс — выше размера кнопки (0,1,0).
 * tone="danger" (data-tone на основной): цвет bad (эталон .pr.danger button.pri) — выше варианта primary.
 */
const Btn = styled(Button)`
  && {
    height: ${k.promptBtn};
    padding: 0 ${k.promptBtnPx};
  }

  /* danger до :focus-visible — порядок по возрастанию специфичности (no-descending-specificity); свойства не пересекаются */
  &&:where([data-tone='danger']) {
    background: ${k.bad};
    border-color: ${k.bad};
  }

  &&:focus-visible {
    outline-offset: 2px;
  }

  &&:where([data-tone='danger']):focus-visible {
    outline-color: ${k.bad};
  }
`

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
  children, okDisabled = false, busy = false, error, fallbackFocus, className,
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
      className={className}
      describedBy={hasNote ? noteId : undefined}
      scrimMark="prompt"
      bare
      refocusKey={tone}
      watchKey={okDisabled}
      footer={(
        <>
          <Btn ref={cancel} disabled={busy} onClick={() => onResult(false)}>{cancelLabel}</Btn>
          <Btn
            ref={ok}
            variant="primary"
            disabled={busy || okDisabled}
            data-tone={tone === 'danger' ? 'danger' : undefined}
            onClick={() => onResult(true)}
          >
            {okLabel}
          </Btn>
        </>
      )}
    >
      {hasNote && <Note id={noteId}>{note}</Note>}
      {children !== undefined && children !== null && <Body ref={body}>{children}</Body>}
      {error && <ErrorLine role="alert">{error}</ErrorLine>}
    </DialogFrame>
  )
}

/** «Было → стало» для note: прежнее зачёркнуто, новое выделено (эталон .note .was/.arr/.now). */
export function PromptChange({ was, now }: { was: string; now: string }): ReactElement {
  return (
    <>
      {/* пробелы — текстом вне span: иначе доступное описание склеит «было→стало» */}
      <Was>{was}</Was>{' '}<Arr>→</Arr>{' '}<Now>{now}</Now>
    </>
  )
}
