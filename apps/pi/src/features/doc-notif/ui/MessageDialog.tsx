import { useRef, type ReactElement } from 'react'
import styled from 'styled-components'
import { k } from '@katran/tokens'
import { Button, CodeView, Dialog, Skeleton, type CodeLanguage } from '@katran/ui'
import type { NotifMessage } from '../../../shared/api'
import { Sr } from '../../../shared/ui'
import type { NotifMessageState } from '../model/createDocNotif'
import { useDrawerFallback } from './focus'

/** Язык подсветки по типу содержимого (спека 2e §3.3): JSON и XML — с подсветкой, иначе — простой текст. */
export const languageOf = (contentType: NotifMessage['contentType']): CodeLanguage =>
  contentType === 'application/json' ? 'json' : contentType === 'application/xml' ? 'xml' : 'text'

/* ошибка загрузки — текст и «Повторить» в строку (как отказ поповеров деталки) */
const ErrorRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${k.sp2};
  color: ${k.bad};
`

export type MessageDialogProps = {
  message: NotifMessageState
  onClose: () => void
  onRetry: () => void
  /** «Скопировать» — тело в буфер (эффект вида); доступна, когда тело загружено. */
  onCopy: (body: string) => void
}

/**
 * Окно «Исходное сообщение · отправка {n}» (спека 2e §3.3, §4 п. 11): Dialog кита размера l поверх деталки. Загрузка —
 * скелетон кита (aria-busy), ошибка — текст (role="alert") и «Повторить», готово — тело через CodeView (только текстовые
 * узлы, разметка бека не исполняется). Кнопки «Скопировать» и «Закрыть»; Esc закрывает окно, не деталку (Dialog не
 * пускает keydown дальше); фокус возвращается на ссылку строки, её нет — на заголовок drawer.
 */
export function MessageDialog({ message, onClose, onRetry, onCopy }: MessageDialogProps): ReactElement {
  const fallbackFocus = useDrawerFallback()
  const close = useRef<HTMLButtonElement>(null)
  const ready = message.state === 'ready' ? message.message : null
  // «Повторить» пропадает с началом загрузки — фокус заранее на «Закрыть», чтобы не уйти в body (Esc и Tab остаются в окне)
  const retry = () => {
    close.current?.focus()
    onRetry()
  }
  return (
    <Dialog
      open
      size="l"
      title={`Исходное сообщение · отправка ${message.n}`}
      onClose={onClose}
      fallbackFocus={fallbackFocus}
      footer={(
        <>
          <Button disabled={ready === null} onClick={() => { if (ready !== null) onCopy(ready.body) }}>Скопировать</Button>
          <Button ref={close} onClick={onClose}>Закрыть</Button>
        </>
      )}
    >
      {ready !== null ? (
        <CodeView code={ready.body} language={languageOf(ready.contentType)} label="Тело сообщения" />
      ) : message.state === 'error' ? (
        <ErrorRow>
          <span role="alert">{message.error}</span>
          <Button size="s" onClick={retry}>Повторить</Button>
        </ErrorRow>
      ) : (
        <div aria-busy="true">
          <Sr>Загрузка</Sr>
          <Skeleton.Line lines={3} width="80%" />
        </div>
      )}
    </Dialog>
  )
}
