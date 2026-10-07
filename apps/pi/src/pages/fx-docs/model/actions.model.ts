import { sample } from 'effector'
import { createDocActions } from '../../../features/doc-actions'
import { editScope } from '../../../features/doc-edit'
import { createActionPorts } from '../../../shared/api'
import { createDocNumbers } from '../../../shared/lib/doc-numbers'
import type { LeaveIntent } from '../../../shared/lib/detail'
import { docEdit } from './edit.model'
import { detail, lifecycle, registry } from './registry.model'

export const fxActionPorts = createActionPorts('fx-docs')

/** Номер документа: строка реестра, иначе деталь в слотах. */
const numberOf = createDocNumbers({ rows: registry.grid.$rows, slots: detail.$slots, lifecycle })

/**
 * Действия лейна валютного документа (план 2d §3.6). Ссылка — buildDocLink (подмена хоста — configureDocLinks в слое app);
 * запасное имя сообщения SWIFT — '<номер>.txt', номера нет — '<id>.txt'.
 */
export const docActions = createDocActions({
  gridId: 'fx-docs',
  ports: fxActionPorts,
  lifecycle,
  fallbackName: (id) => `${numberOf(id) ?? id}.txt`,
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
