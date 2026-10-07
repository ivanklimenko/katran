import { sample } from 'effector'
import { createDocActions } from '../../../features/doc-actions'
import { createActionPorts } from '../../../shared/api'
import { createDocNumbers } from '../../../shared/lib/doc-numbers'
import { detail, lifecycle, registry } from './registry.model'

export const rubActionPorts = createActionPorts('rub-docs')

/** Номер документа: строка реестра, иначе деталь в слотах. */
const numberOf = createDocNumbers({ rows: registry.grid.$rows, slots: detail.$slots, lifecycle })

/**
 * Действия лейна рублёвого документа (план 2d §3.6). Ссылка — buildDocLink (подмена хоста — configureDocLinks в слое app);
 * запасное имя сообщения ED — '<номер>.xml', номера нет — '<id>.xml'.
 */
export const docActions = createDocActions({
  gridId: 'rub-docs',
  ports: rubActionPorts,
  lifecycle,
  fallbackName: (id) => `${numberOf(id) ?? id}.xml`,
})

// «Обновить»: модели правки у рубля нет — сразу деталь документа и реестр заново
sample({ clock: docActions.refresh, target: detail.refreshDoc })
sample({ clock: docActions.refresh, target: registry.refreshRequested })
