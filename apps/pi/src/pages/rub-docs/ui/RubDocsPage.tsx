import { useCallback } from 'react'
import { useUnit } from 'effector-react'
import { gridFocusTarget, useKatran } from '@katran/ui'
import { rubDocLayout } from '../../../entities/rub-doc'
import { useActionsOf } from '../../../features/doc-actions'
import { useAnnulOf } from '../../../features/doc-annul'
import { useLookupOf } from '../../../features/doc-lookups'
import { NotifOverlay, useNotifOf } from '../../../features/doc-notif'
import type { DetailLookups } from '../../../shared/lib/detail'
import { DocDetail } from '../../../widgets/doc-detail'
import { DocRegistry } from '../../../widgets/doc-registry'
import { docActions } from '../model/actions.model'
import { docAnnul } from '../model/annul.model'
import { balances } from '../model/lookups.model'
import { docNotif } from '../model/notif.model'
import { detail, registry } from '../model/registry.model'
import { rubDetailDomain } from './detailDomain'

const TITLE = 'Рублёвые документы'

/** note — пояснение над реестром; текст задаёт приложение (у стенда — про фейковый сервер), слайс его не знает. */
export function RubDocsPage({ note }: { note?: string | undefined }) {
  const { announce } = useKatran()
  const [rows, marks] = useUnit([registry.grid.$rows, detail.$marks])
  // действия лейна: один вызов на модель (иначе объявления $notice двоятся), деталка получает функцию
  const actionsOf = useActionsOf(docActions)
  // срез 2e: аннулирование (один вызов — объявления итога не двоятся), «Проверить баланс» (курса у рубля нет), нотификации
  const annulOf = useAnnulOf(docAnnul)
  const balancesOf = useLookupOf(balances)
  const lookupsOf = useCallback((id: string): DetailLookups => ({ balances: balancesOf(id) }), [balancesOf])
  const notifOf = useNotifOf(docNotif)
  return (
    <>
      <DocRegistry
        registry={registry}
        layout={rubDocLayout}
        title={TITLE}
        describe={(d) => `документ ${d.docNumber}`}
        note={note}
        bulkActions={[
          { label: 'Экспортировать', onClick: (n) => announce(`Экспорт: выбрано ${n}`) },
          { label: 'Отложить', onClick: (n) => announce(`Отложить: выбрано ${n}`) },
        ]}
        rowState={(d) => (d.lock ? { kind: 'locked', ...d.lock } : d.inactive ? { kind: 'inactive', ...d.inactive } : null)}
        openHint="Открыть деталку · двойной клик или Shift — рядом для сравнения"
        marked={(d) => marks[rubDocLayout.rowKey(d)] ?? null}
      />
      <DocDetail
        detail={detail}
        domain={rubDetailDomain}
        rowOf={(id) => rows.find((r) => rubDocLayout.rowKey(r) === id) ?? null}
        returnFocus={(id) => gridFocusTarget(TITLE, id)}
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
