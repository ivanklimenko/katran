/** Ошибка бека в формате RFC 9457 (контракт vtb-filters §8). */
export type ProblemError = { path: string; code: string; message: string }
export type Problem = { type: string; title: string; status?: number | undefined; detail?: string | undefined; errors?: ProblemError[] | undefined }

/** Ошибка транспорта и контракта. Наследник Error: модель грида пишет в $error e.message только для Error. */
export class ApiError extends Error {
  readonly status: number
  readonly problem: Problem | null
  constructor(status: number, problem: Problem | null, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}

const isProblem = (b: unknown): b is Problem =>
  typeof b === 'object' && b !== null && typeof (b as { type?: unknown }).type === 'string' && typeof (b as { title?: unknown }).title === 'string'

/** Для обработчика requestFx: ответ не 2xx → отказ с этим значением. */
export function toApiError(status: number, body: unknown): ApiError {
  const problem = isProblem(body) ? body : null
  const message = problem ? (problem.detail ? `${problem.title}: ${problem.detail}` : problem.title) : `Ошибка запроса (статус ${status})`
  return new ApiError(status, problem, message)
}

/** Ответ пришёл, но не по контракту: грид покажет ошибку, приложение не упадёт. */
export const contractError = (detail: string): ApiError =>
  new ApiError(0, { type: 'urn:katran:contract', title: 'Ответ не по контракту', detail }, `Ответ не по контракту: ${detail}`)
