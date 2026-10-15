import { useCallback } from 'react'
import { useUnit } from 'effector-react'
import { gridFocusTarget, useKatran } from '@katran/ui'
import { FxCellStyles, fxCommitView, fxDocLayout } from '../../../entities/fx-doc'
import { useEditContexts } from '../../../features/doc-edit'
import { useActionsOf } from '../../../features/doc-actions'
import { useAnnulOf } from '../../../features/doc-annul'
import { useLookupOf } from '../../../features/doc-lookups'
import { NotifOverlay, useNotifOf } from '../../../features/doc-notif'
import type { DetailLookups } from '../../../shared/lib/detail'
import { DocDetail } from '../../../widgets/doc-detail'
import { DocRegistry } from '../../../widgets/doc-registry'
import { docEdit } from '../model/edit.model'
import { docActions } from '../model/actions.model'
import { docAnnul } from '../model/annul.model'
import { balances, rates } from '../model/lookups.model'
import { docNotif } from '../model/notif.model'
import { detail, registry } from '../model/registry.model'
import { fxDetailDomain } from './detailDomain'

const TITLE = 'Валютные документы'

/** note — пояснение над реестром; текст задаёт приложение (у стенда — про фейковый сервер), слайс его не знает. */
export function FxDocsPage({ note }: { note?: string | undefined }) {
  const { announce } = useKatran()
  const [rows, marks] = useUnit([registry.grid.$rows, detail.$marks])
  // правка деталки (план 2c): контекст правки своего документа — деталка не знает о модели
  const editOf = useEditContexts(docEdit, fxCommitView)
  // действия лейна: один вызов на модель (иначе объявления $notice двоятся), деталка получает функцию
  const actionsOf = useActionsOf(docActions)
  // срез 2e: аннулирование (один вызов — объявления итога не двоятся), «Курс» и «Проверить баланс», нотификации
  const annulOf = useAnnulOf(docAnnul)
  const ratesOf = useLookupOf(rates)
  const balancesOf = useLookupOf(balances)
  const lookupsOf = useCallback((id: string): DetailLookups => ({ rates: ratesOf(id), balances: balancesOf(id) }), [ratesOf, balancesOf])
  const notifOf = useNotifOf(docNotif)
  return (
    <>
      {/* стили своих элементов ячеек реестра (правило 2, спека styled §4.7) */}
      <FxCellStyles />
      <DocRegistry
        registry={registry}
        layout={fxDocLayout}
        title={TITLE}
        describe={(d) => `документ ${d.docNumber}`}
        note={note}
        bulkActions={[
          { label: 'Экспортировать', onClick: (n) => announce(`Экспорт: выбрано ${n}`) },
          { label: 'Отложить', onClick: (n) => announce(`Отложить: выбрано ${n}`) },
        ]}
        rowState={(d) => (d.lock ? { kind: 'locked', ...d.lock } : d.inactive ? { kind: 'inactive', ...d.inactive } : null)}
        openHint="Открыть деталку · двойной клик или Shift — рядом для сравнения"
        marked={(d) => marks[fxDocLayout.rowKey(d)] ?? null}
      />
      <DocDetail
        detail={detail}
        domain={fxDetailDomain}
        rowOf={(id) => rows.find((r) => fxDocLayout.rowKey(r) === id) ?? null}
        returnFocus={(id) => gridFocusTarget(TITLE, id)}
        editOf={editOf}
        actionsOf={actionsOf}
        annulOf={annulOf}
        lookupsOf={lookupsOf}
        notifOf={notifOf}
      />
      {/* Prompt переотправки и окно исходного сообщения — один на страницу, поверх drawer */}
      <NotifOverlay model={docNotif} />
    </>
  )
}
