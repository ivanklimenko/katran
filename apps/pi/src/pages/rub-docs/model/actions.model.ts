import { combine, sample } from 'effector'
import { createDocActions } from '../../../features/doc-actions'
import { createActionPorts } from '../../../shared/api'
import { detail, lifecycle, registry } from './registry.model'

export const rubActionPorts = createActionPorts('rub-docs')

/** Запасное имя сообщения (R18): номер из строки реестра, иначе из детали в слотах, иначе id — из сторов скоупа экрана. */
const $fallbackName = combine(registry.grid.$rows, detail.$slots, (rows, { a, b }) => (id: string): string => {
  const row = rows.find((r) => r.id === id)
  const data = a?.id === id ? a.data : b?.id === id ? b.data : null
  const num = row ? row.docNumber : data ? data.docNumber : id
  return `${num}.xml`
})

/**
 * Действия лейна рублёвого документа (план 2d §3.6). Ссылка — buildDocLink (подмена хоста — configureDocLinks в слое app);
 * запасное имя сообщения ED — '<номер>.xml', номера нет — '<id>.xml'.
 */
export const docActions = createDocActions({
  gridId: 'rub-docs',
  ports: rubActionPorts,
  lifecycle,
  fallbackName: $fallbackName,
})

// «Обновить»: модели правки у рубля нет — сразу деталь документа и реестр заново
sample({ clock: docActions.refresh, target: detail.refreshDoc })
sample({ clock: docActions.refresh, target: registry.refreshRequested })
