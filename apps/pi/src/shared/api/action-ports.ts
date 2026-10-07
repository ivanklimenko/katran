import { createEffect, type Effect } from 'effector'
import type { ApiError } from './problem'
import { requestFileFx, type FileResponse } from './request'

export type PrintQuery = { id: string; form: string }
/** Порты действий документа (pi-api §1.9–1.10): сообщение и печатная форма — файлом через requestFileFx. */
export type ActionPorts = {
  messageFx: Effect<string, FileResponse, ApiError>
  printFx: Effect<PrintQuery, FileResponse, ApiError>
}

export function createActionPorts(gridId: string): ActionPorts {
  const doc = (id: string) => `/grids/${gridId}/documents/${encodeURIComponent(id)}`
  const messageFx = createEffect<string, FileResponse, ApiError>((id) => requestFileFx({ url: `${doc(id)}/message` }))
  const printFx = createEffect<PrintQuery, FileResponse, ApiError>(({ id, form }) =>
    requestFileFx({ url: `${doc(id)}/print/${encodeURIComponent(form)}` }))
  return { messageFx, printFx }
}
