import { sample } from 'effector'
import { fxAnnulPorts, statusLabelOf } from '../../../entities/fx-doc'
import { createDocAnnul } from '../../../features/doc-annul'
import { $annulBusy, docEdit } from './edit.model'
import { detail, lifecycle, registry } from './registry.model'

/**
 * Аннулирование валютного документа (спека 2e §3.3, §3.6). Одна операция над документом за раз: документ с операцией правки
 * (docEdit.$busyDocs) аннулировать нельзя, а открытый Prompt аннулирования блокирует правку — через промежуточный стор
 * страницы $annulBusy (edit.model.ts), иначе модели ссылались бы друг на друга при создании.
 */
export const docAnnul = createDocAnnul({ ports: fxAnnulPorts, lifecycle, blockedDocs: docEdit.$busyDocs, statusLabelOf })
sample({ clock: docAnnul.$busyDocs, target: $annulBusy })

// команда принята — свежая деталь в кэш без запроса детали (сам replaceDetail отсекает закрытый экран), реестр заново;
// курсы и остатки документа сбрасывает replaceDetail (lookups.model.ts)
sample({ clock: docAnnul.docAnnulled, fn: ({ id, detail: d }) => ({ id, detail: d }), target: detail.replaceDetail })
sample({ clock: docAnnul.docAnnulled, target: registry.refreshRequested })
// 409 или деталь после команды не получена — «Обновить» документа и реестр заново
sample({ clock: docAnnul.refreshNeeded, fn: ({ id }) => id, target: detail.refreshDoc })
sample({ clock: docAnnul.refreshNeeded, target: registry.refreshRequested })

// R12 (как у решения правки, edit.model.ts): открытый не busy Prompt документа, ушедшего из слотов, снимается — иначе при
// повторном открытии всплыл бы старый. Prompt в полёте снимет ответ. Ушедших за одно обновление слотов — не больше двух.
const leftWithPrompt = sample({
  clock: detail.$slots.updates,
  source: docAnnul.$prompt,
  fn: (prompt, { a, b }) => Object.keys(prompt).filter((id) => !prompt[id]!.busy && a?.id !== id && b?.id !== id),
})
sample({ clock: leftWithPrompt, filter: (ids) => ids.length > 0, fn: (ids) => ({ docId: ids[0]!, ok: false }), target: docAnnul.promptResult })
sample({ clock: leftWithPrompt, filter: (ids) => ids.length > 1, fn: (ids) => ({ docId: ids[1]!, ok: false }), target: docAnnul.promptResult })
