import { useCallback } from 'react'
import { useUnit } from 'effector-react'
import type { NotifView } from '../../../shared/lib/detail'
import type { DocNotif } from '../model/createDocNotif'

/**
 * Нотификации по документам (спека 2e §3.3): вкладка «Нотификации» деталки получает NotifView своего документа, не зная о модели —
 * переотправка (без nid — все), «в полёте» этого документа и окно исходного сообщения. Prompt, окно и объявления — NotifOverlay.
 */
export function useNotifOf(model: DocNotif): (docId: string) => NotifView {
  const busy = useUnit(model.$resendBusy)
  const [resendRequested, openMessage] = useUnit([model.resendRequested, model.openMessage])
  return useCallback((docId: string): NotifView => ({
    resend: (nid, n) => resendRequested(nid === undefined ? { docId } : { docId, nid, n }),
    resendBusy: busy[docId] !== undefined,
    openMessage: (nid, n) => openMessage({ docId, nid, n }),
  }), [busy, resendRequested, openMessage])
}
