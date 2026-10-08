import { useEffect, useRef, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useUnit } from 'effector-react'
import { Prompt, useKatran } from '@katran/ui'
import type { DocNotif } from '../model/createDocNotif'
import { writeClipboardFx } from '../../../shared/lib/clipboard'
import { useDrawerFallback } from './focus'
import { MessageDialog } from './MessageDialog'
import s from './notif.module.css'

/** Тексты Prompt переотправки (спека 2e §3.3). */
export const RESEND_PROMPT = {
  all: 'Переотправить все нотификации?',
  one: (n: number) => `Переотправить нотификацию № ${n}?`,
  note: 'Будет создана новая попытка отправки',
}

/** Prompt переотправки: занят, пока переотправка документа в полёте; фокус после закрытия — на нажатую кнопку вкладки. */
function ResendPrompt({ n, busy, onResult }: { n: number | null; busy: boolean; onResult: (ok: boolean) => void }) {
  const fallbackFocus = useDrawerFallback()
  return (
    <Prompt
      open
      title={n === null ? RESEND_PROMPT.all : RESEND_PROMPT.one(n)}
      note={RESEND_PROMPT.note}
      okLabel="Переотправить"
      cancelLabel="Отмена"
      busy={busy}
      onResult={onResult}
      fallbackFocus={fallbackFocus}
    />
  )
}

/**
 * Слой окон страницы поверх деталки: Dialog кита без портала накрывает ближайший позиционированный предок, а NotifOverlay
 * стоит в разметке страницы — под DrawerStack (портал в корень провайдера, слой --k-z-drawer), и окно оказалось бы под
 * drawer'ами. Поэтому — свой портал в корень провайдера на весь экран выше слоя деталки (--k-z-modal) и ниже поповеров
 * и подсказок. Пустой слой не рисуется — клики проходят в реестр и деталь. Esc окна деталь не закрывает: фокус в окне
 * (role="dialog"/"alertdialog" — OWN_ESCAPE DrawerStack), а Dialog гасит всплытие.
 */
function PageLayer({ children }: { children: ReactNode }): ReactElement | null {
  const { portalRoot } = useKatran()
  if (!portalRoot) return null
  return createPortal(<div className={s.layer} data-k-layer="notif">{children}</div>, portalRoot)
}

/**
 * Слой нотификаций страницы (спека 2e §3.3, §3.6): Prompt переотправки и окно «Исходное сообщение» — по одному на страницу,
 * поверх деталки; объявления модели. Рост $notice.count — объявление его текста в живой области; на монтировании — без
 * объявления ($notice не сбрасывается с уходом с экрана). «Скопировать» — эффект буфера, итог — событием copied модели.
 */
export function NotifOverlay({ model }: { model: DocNotif }): ReactElement {
  const [prompt, busy, message, notice] = useUnit([model.$resendPrompt, model.$resendBusy, model.$message, model.$notice])
  const [resendResult, closeMessage, retryMessage, copied] = useUnit([model.resendResult, model.closeMessage, model.retryMessage, model.copied])
  const copy = useUnit(writeClipboardFx)
  const { announce } = useKatran()

  const seen = useRef(notice.count)
  useEffect(() => {
    if (notice.count > seen.current) announce(notice.text)
    seen.current = notice.count
  }, [notice, announce])

  if (prompt === null && message === null) return <></>
  return (
    <PageLayer>
      {prompt !== null && (
        <ResendPrompt
          key={`${prompt.docId}:${prompt.nid ?? '*'}`}
          n={prompt.n}
          busy={busy[prompt.docId] !== undefined}
          onResult={(ok) => resendResult({ docId: prompt.docId, ok })}
        />
      )}
      {message !== null && (
        <MessageDialog
          // другое окно — заново: начальный фокус и запасной drawer — от новой ссылки
          key={`${message.docId}:${message.nid}`}
          message={message}
          onClose={closeMessage}
          onRetry={retryMessage}
          onCopy={(body) => { copy(body).then(() => copied(true), () => copied(false)) }}
        />
      )}
    </PageLayer>
  )
}
