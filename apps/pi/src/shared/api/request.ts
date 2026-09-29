import { createEffect } from 'effector'
import { ApiError } from './problem'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
export type HttpRequest = { method: HttpMethod; url: string; query?: Record<string, string> | undefined; body?: unknown }

/**
 * Единственный транспорт приложения. Обработчик подключает слой app: requestFx.use(handler).
 * Правило обработчика: 2xx → разобранный JSON; иначе — отказ с toApiError(status, body).
 */
export const requestFx = createEffect<HttpRequest, unknown, ApiError>(() => {
  throw new ApiError(0, null, 'Транспорт не подключён: вызовите requestFx.use(…) в слое app')
})
