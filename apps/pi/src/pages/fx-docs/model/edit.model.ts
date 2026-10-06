import { sample } from 'effector'
import { FX_CONFIRM_TARGETS, fxEditPorts, normalizeFxEdit, sameEditValue, validateFxEdit } from '../../../entities/fx-doc'
import { createDocEdit, editScope } from '../../../features/doc-edit'
import { detail, lifecycle, registry } from './registry.model'

/**
 * Правка валютного документа на экране (план 2c §3.2): модель правки на жизненном цикле страницы, связи с деталкой и реестром.
 * same — равенство значений сущности: JSON модели чувствителен к порядку ключей, и только что открытый редактор был бы «грязным».
 */
export const docEdit = createDocEdit({
  ports: fxEditPorts,
  validate: validateFxEdit,
  normalize: normalizeFxEdit,
  same: sameEditValue,
  confirmTargets: FX_CONFIRM_TARGETS,
  lifecycle,
})

// охрана ухода деталки (guard: true): решает модель правки — черновик держит Prompt «Отменить правку?», чистый и в полёте — сразу
sample({ clock: detail.leaveRequested, fn: ({ docId, intent }) => ({ scope: editScope(docId), next: intent }), target: docEdit.model.requestLeave })
sample({ clock: docEdit.model.leave, target: detail.leave })
// бек принял правку: деталь ответа — в кэш без запроса детали; реестр — заново (строка могла измениться)
sample({ clock: docEdit.docEdited, target: detail.replaceDetail })
sample({ clock: docEdit.docEdited, target: registry.refreshRequested })
// 409: документ изменили — деталь перезапрашивается, редактор с черновиком остаётся
sample({ clock: docEdit.conflict, fn: ({ id }) => id, target: detail.reloadDetail })
// документ пришёл заблокированным (перезапрос по 409) — только просмотр (Д66): вид редактор не рисует, модель его закрывает,
// иначе невидимый грязный черновик держал бы Prompt «Отменить правку?» при уходе
sample({
  source: { slots: detail.$slots, editing: docEdit.model.$editing },
  filter: ({ slots, editing }) => editing !== null
    && [slots.a, slots.b].some((s) => s !== null && s.data !== null && s.data.lock !== null && editing.key.startsWith(editScope(s.id))),
  target: docEdit.model.cancel,
})
