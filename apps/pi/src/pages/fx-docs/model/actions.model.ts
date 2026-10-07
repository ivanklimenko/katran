import { combine, sample } from 'effector'
import { createDocActions } from '../../../features/doc-actions'
import { editScope } from '../../../features/doc-edit'
import { createActionPorts } from '../../../shared/api'
import type { LeaveIntent } from '../../../shared/lib/detail'
import { docEdit } from './edit.model'
import { detail, lifecycle, registry } from './registry.model'

export const fxActionPorts = createActionPorts('fx-docs')

/** Запасное имя сообщения (R18): номер из строки реестра, иначе из детали в слотах, иначе id — из сторов скоупа экрана. */
const $fallbackName = combine(registry.grid.$rows, detail.$slots, (rows, { a, b }) => (id: string): string => {
  const row = rows.find((r) => r.id === id)
  const data = a?.id === id ? a.data : b?.id === id ? b.data : null
  const num = row ? String(row.docNumber) : data ? String(data.docNumber) : id
  return `${num}.txt`
})

/**
 * Действия лейна валютного документа (план 2d §3.6). Ссылка — buildDocLink (подмена хоста — configureDocLinks в слое app);
 * запасное имя сообщения SWIFT — '<номер>.txt', номера нет — '<id>.txt'.
 */
export const docActions = createDocActions({
  gridId: 'fx-docs',
  ports: fxActionPorts,
  lifecycle,
  fallbackName: $fallbackName,
})

// «Обновить» — через охрану правки (R16): грязный черновик документа держит Prompt «Отменить правку?», чистый редактор
// закрывается без вопроса. docActions.refresh здесь не связывается — иначе обновление шло бы мимо охраны.
sample({
  clock: docActions.refreshRequested,
  fn: (id) => ({ scope: editScope(id), next: { kind: 'refresh', id } as LeaveIntent }),
  target: docEdit.model.requestLeave,
})
const refreshLeave = sample({
  clock: docEdit.model.leave,
  filter: (intent): intent is Extract<LeaveIntent, { kind: 'refresh' }> => intent.kind === 'refresh',
})
const refreshAccepted = sample({ clock: refreshLeave, fn: ({ id }) => id })
sample({ clock: refreshAccepted, target: detail.refreshDoc })
sample({ clock: refreshAccepted, target: registry.refreshRequested })
