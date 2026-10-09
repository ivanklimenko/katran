import { createEffect, type Effect } from 'effector'
import { obj } from './guards'
import type { ApiError } from './problem'
import { requestFx } from './request'

export type AnnulQuery = { id: string; reason: string }
/** Решение по запросу на аннулирование: when — метка запроса (бек сверяет с текущей, иначе 409). */
export type AnnulDecisionQuery = { id: string; when: string }
export type AnnulRejectQuery = AnnulDecisionQuery & { reason: string }
/** Порты аннулирования (спека 2e): команды — void, ответ любого 2xx (202/204/200, любое тело) игнорируется; detailFx — перезапрос документа после команды. */
export type AnnulPorts<D> = {
  /** POST /grids/{gridId}/documents/{id}/annul { reason } → 202 */
  annulFx: Effect<AnnulQuery, void, ApiError>
  /** POST …/annul/confirm { when } → 202 */
  confirmAnnulFx: Effect<AnnulDecisionQuery, void, ApiError>
  /** POST …/annul/reject { when, reason } → 202 */
  rejectAnnulFx: Effect<AnnulRejectQuery, void, ApiError>
  /** GET /grids/{gridId}/documents/{id} — тем же маппером детали, что у порта детали сущности. */
  detailFx: Effect<string, D, ApiError>
}

export function createAnnulPorts<D>(gridId: string, parseDetail: (v: unknown) => D): AnnulPorts<D> {
  // id — в пути: кодируется; вызов requestFx внутри обработчика сохраняет scope (effector 23)
  const doc = (id: string) => `/grids/${gridId}/documents/${encodeURIComponent(id)}`
  const command = async (url: string, body: object): Promise<void> => { await requestFx({ method: 'POST', url, body }) }
  const annulFx = createEffect<AnnulQuery, void, ApiError>(({ id, reason }) => command(`${doc(id)}/annul`, { reason }))
  const confirmAnnulFx = createEffect<AnnulDecisionQuery, void, ApiError>(({ id, when }) => command(`${doc(id)}/annul/confirm`, { when }))
  const rejectAnnulFx = createEffect<AnnulRejectQuery, void, ApiError>(({ id, when, reason }) => command(`${doc(id)}/annul/reject`, { when, reason }))
  const detailFx = createEffect<string, D, ApiError>(async (id) =>
    parseDetail(obj(await requestFx({ method: 'GET', url: doc(id) }), 'ответ')))
  return { annulFx, confirmAnnulFx, rejectAnnulFx, detailFx }
}
