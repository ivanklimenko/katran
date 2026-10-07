import { useCallback, useEffect, useRef } from 'react'
import { useUnit } from 'effector-react'
import { useKatran } from '@katran/ui'
import type { ActionsView } from '../../../shared/lib/detail'
import { PRINT_PENDING_TEXT, pendingKey, type DocActions } from '../model/createDocActions'

/**
 * Окно печати — синхронно в обработчике клика (до любого await), иначе браузер его заблокирует. opener снят (вкладка с
 * blob-PDF не управляет экраном); строка «Формируется…» — заголовком и textContent, без innerHTML. null — заблокировано.
 */
function openPrintWindow(): Window | null {
  const win = window.open('', '_blank')
  if (win === null) return null
  win.opener = null
  win.document.title = PRINT_PENDING_TEXT
  if (win.document.body) win.document.body.textContent = PRINT_PENDING_TEXT
  return win
}

/**
 * Виды действий лейна по документам (план 2d §3.3): деталка получает ActionsView своего документа, не зная о модели.
 * esid и ban — срез 2e: run без действия (объявление-заглушку 2a для них оставляет виджет).
 * Рост $notice.count — объявление его текста в живой области (на монтировании — без объявления).
 */
export function useActionsOf(actions: DocActions): (docId: string) => ActionsView {
  const [pending, linkFallback, linkDoc, notice] = useUnit([actions.$pending, actions.$linkFallback, actions.$linkFallbackDoc, actions.$notice])
  const [refreshRequested, copyLink, download, print, closeLinkFallback] = useUnit([
    actions.refreshRequested, actions.copyLink, actions.download, actions.print, actions.closeLinkFallback,
  ])
  const { announce } = useKatran()

  const seen = useRef(notice.count)
  useEffect(() => {
    if (notice.count > seen.current) announce(notice.text)
    seen.current = notice.count
  }, [notice, announce])

  return useCallback((docId: string): ActionsView => ({
    run: (action, form) => {
      switch (action.id) {
        case 'refresh': refreshRequested(docId); break
        case 'link': copyLink(docId); break
        case 'down': download(docId); break
        case 'print':
          // второй клик по печати в полёте — ни окна, ни запроса
          if (form !== undefined && !pending[pendingKey(docId, 'print')]) print({ id: docId, form: form.form, win: openPrintWindow() })
          break
        default:
          // esid, ban — срез 2e
          break
      }
    },
    pending: (actionId) => Boolean(pending[pendingKey(docId, actionId)]),
    linkFallback: linkDoc === docId ? linkFallback : null,
    closeLinkFallback: () => { if (linkDoc === docId) closeLinkFallback() },
  }), [pending, linkFallback, linkDoc, refreshRequested, copyLink, download, print, closeLinkFallback])
}
