import { createEffect } from 'effector'
import { ApiError } from './problem'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
export type HttpRequest = { method: HttpMethod; url: string; query?: Record<string, string> | undefined; body?: unknown }

/**
 * Единственный транспорт приложения. Обработчик подключает слой app: requestFx.use(handler).
 * Правило обработчика: 2xx → разобранный JSON; иначе — отказ с toApiError(status, body).
 */
/** Запрос файла: адрес контракта (GET). Обработчик подключает слой app: requestFileFx.use(handler). */
export type FileRequest = { url: string }
/** Файл как пришёл: содержимое и имя (из Content-Disposition; нет заголовка или транспорт без заголовков — null). */
export type FileResponse = { blob: Blob; name: string | null }

export const requestFx = createEffect<HttpRequest, unknown, ApiError>(() => {
  throw new ApiError(0, null, 'Транспорт не подключён: вызовите requestFx.use(…) в слое app')
})

export const requestFileFx = createEffect<FileRequest, FileResponse, ApiError>(() => {
  throw new ApiError(0, null, 'Транспорт файлов не подключён: вызовите requestFileFx.use(…) в слое app')
})

/** Имя файла из Content-Disposition: filename*=UTF-8''… приоритетнее filename="…"; нет заголовка или имени — null. */
export function fileNameOf(header: string | null): string | null {
  if (!header) return null
  const star = /filename\*\s*=\s*(?:[\w-]+)?'[^']*'([^;]+)/i.exec(header)
  if (star?.[1]) {
    try { return decodeURIComponent(star[1].trim()) } catch { /* битая кодировка — пробуем filename */ }
  }
  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(header)
  const name = (plain?.[1] ?? plain?.[2])?.trim()
  return name ? name : null
}
