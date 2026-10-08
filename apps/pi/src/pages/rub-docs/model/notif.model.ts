import { sample } from 'effector'
import { TRAIL_PARSERS } from '../../../entities/doc-trail'
import { createDocNotif } from '../../../features/doc-notif'
import { createNotifPorts } from '../../../shared/api'
import { detail, lifecycle } from './registry.model'

/** Порты нотификаций рублёвого реестра (переотправка, исходное сообщение). */
export const rubNotifPorts = createNotifPorts('rub-docs')

/** Нотификации рублёвого документа (спека 2e §3.3, §3.6): переотправка и окно исходного сообщения — один NotifOverlay на страницу. */
export const docNotif = createDocNotif({ ports: rubNotifPorts, lifecycle })

/**
 * Ответ переотправки — сырое тело вкладки «Нотификации» (порт его не разбирает): тот же парсер, что у GET вкладки. Разобран —
 * в кэш вкладки без её запроса (Review Focus 4); тело не по контракту — в кэш не кладётся, «Обновить» документа (вкладка
 * перезапрашивается и сама покажет ошибку контракта, если она повторится).
 */
type Resent = { id: string; ok: true; data: unknown } | { id: string; ok: false }
const parsed = docNotif.resent.map(({ id, data }): Resent => {
  try {
    return { id, ok: true, data: TRAIL_PARSERS.notif(data, 'ответ') }
  } catch {
    return { id, ok: false }
  }
})
sample({ clock: parsed.filterMap((r) => (r.ok ? { id: r.id, tab: 'notif', data: r.data } : undefined)), target: detail.replaceTab })
sample({ clock: parsed, filter: (r) => !r.ok, fn: ({ id }) => id, target: detail.refreshDoc })
// 409: переотправка уже идёт или документ изменили — «Обновить» документа (деталь и активная вкладка заново)
sample({ clock: docNotif.resendConflict, fn: ({ id }) => id, target: detail.refreshDoc })
