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
// уход «Обновить» (kind 'refresh') выполняет actions.model.ts; закрытие и замена документа — деталка, как в 2c
sample({ clock: docEdit.model.leave, filter: (intent) => intent.kind !== 'refresh', target: detail.leave })
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

// R12: открытое (не в полёте) решение документа, ушедшего из слотов не уходом с экрана (закрыли слот, в A открыли другой),
// снимается — иначе при повторном открытии всплыл бы старый Prompt. Решение в полёте снимет его ответ. Документов в слотах
// не больше двух — ушедших за одно обновление тоже не больше двух.
const leftWithDecision = sample({
  clock: detail.$slots.updates,
  source: docEdit.$decision,
  fn: (decision, { a, b }) => Object.keys(decision).filter((id) => !decision[id]!.busy && a?.id !== id && b?.id !== id),
})
sample({ clock: leftWithDecision, filter: (ids) => ids.length > 0, fn: (ids) => ({ docId: ids[0]!, ok: false }), target: docEdit.decisionResult })
sample({ clock: leftWithDecision, filter: (ids) => ids.length > 1, fn: (ids) => ({ docId: ids[1]!, ok: false }), target: docEdit.decisionResult })
