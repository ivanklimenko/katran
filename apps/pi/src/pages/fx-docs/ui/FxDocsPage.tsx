import { useUnit } from 'effector-react'
import { gridFocusTarget, useKatran } from '@katran/ui'
import { fxCommitView, fxDocLayout } from '../../../entities/fx-doc'
import { useEditContexts } from '../../../features/doc-edit'
import { useActionsOf } from '../../../features/doc-actions'
import { DocDetail } from '../../../widgets/doc-detail'
import { DocRegistry } from '../../../widgets/doc-registry'
import { docEdit } from '../model/edit.model'
import { docActions } from '../model/actions.model'
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
  return (
    <>
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
      />
    </>
  )
}
