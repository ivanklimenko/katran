import type { Filter } from '@katran/effector'
import { toApiError, type FacetsBody, type FilterMetaDto, type HttpRequest, type Problem, type ProblemError, type SearchBody, type SuggestBody } from '../../shared/api'
import type { FakeGrid } from './grid'

export type FakeServerOptions = {
  delayMs?: (() => number) | undefined
  failing?: (() => string | null) | undefined
  /** ?conflict=edit — 409 на любой правке (план 2c). */
  conflicting?: (() => string | null) | undefined
  /** Время правки: ISO без зоны до минут; по умолчанию — локальное «сейчас». */
  now?: (() => string) | undefined
  /** Каждый пришедший запрос — до задержки и регуляторов: транспорт стенда в странице, сеть его не видит (e2e считает запросы). */
  observe?: ((req: HttpRequest) => void) | undefined
}

const ROUTE = /^\/grids\/([^/]+)\/(search|facets|suggest|filter-meta)$/
const DOCUMENT = /^\/grids\/([^/]+)\/documents\/([^/]+)$/
const TAB = /^\/grids\/([^/]+)\/documents\/([^/]+)\/tabs\/([^/]+)$/
const EDITS = /^\/grids\/([^/]+)\/documents\/([^/]+)\/edits$/
const ACCOUNTS = /^\/grids\/([^/]+)\/documents\/([^/]+)\/accounts$/
const pad2 = (n: number) => String(n).padStart(2, '0')
/** Локальное «сейчас» до минут: «ГГГГ-ММ-ДДTчч:мм:00». */
const localMinute = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`
}
const fail = (status: number, title: string, detail: string): never => {
  const p: Problem = { type: 'urn:katran:fake', title, status, detail }
  throw toApiError(status, p)
}

/** Проверка тела по каталогу — подмножество §8 контракта. */
function validate(meta: FilterMetaDto, conditions: Filter, size: number | null): ProblemError[] {
  const errors: ProblemError[] = []
  conditions.forEach((c, i) => {
    const f = meta.fields.find((x) => x.id === c.field)
    if (!f) errors.push({ path: `filter.conditions[${i}].field`, code: 'UNKNOWN_FIELD', message: `Поле ${c.field} неизвестно` })
    else if (!f.operators.includes(c.op)) errors.push({ path: `filter.conditions[${i}].op`, code: 'OPERATOR_NOT_ALLOWED', message: `Оператор ${c.op} недопустим для поля ${c.field} типа ${f.type}` })
  })
  if (size !== null && (size < 1 || size > 500)) errors.push({ path: 'page.size', code: 'PAGE_SIZE_OUT_OF_RANGE', message: 'Размер страницы — от 1 до 500' })
  return errors
}

/** Обработчик requestFx на контракте vtb-filters: JSON на входе и выходе, ошибки — Problem Details через toApiError, как у настоящего клиента. */
export function createFakeServer(grids: Record<string, FakeGrid>, opts: FakeServerOptions = {}) {
  return async (req: HttpRequest): Promise<unknown> => {
    opts.observe?.(req)
    const delay = opts.delayMs?.() ?? 0
    if (delay > 0) await new Promise((r) => setTimeout(r, delay))
    const tabRoute = TAB.exec(req.url)
    if (tabRoute) {
      const [, gridId = '', rawId = '', rawTab = ''] = tabRoute
      const grid = grids[gridId]
      if (!grid) return fail(404, 'Неизвестный грид', gridId)
      const id = decodeURIComponent(rawId)
      const tab = decodeURIComponent(rawTab)
      if (!grid.tabs || !grid.tabs.ids.includes(tab)) return fail(404, 'Неизвестная вкладка', `${gridId}: ${tab}`)
      // ?fail=tab — любая вкладка, ?fail=tab:<id> — одна; ?fail=detail сюда не доходит
      const failing = opts.failing?.() ?? null
      if (failing === 'tab' || failing === `tab:${tab}`) return fail(500, 'Сбой сервера', `Регулятор ?fail=${failing}`)
      const body = grid.tabs.get(id, tab)
      if (body === null || body === undefined) return fail(404, 'Документ не найден', `${gridId}/${id}`)
      return body
    }
    const editRoute = EDITS.exec(req.url)
    if (editRoute) {
      const [, gridId = '', raw = ''] = editRoute
      const grid = grids[gridId]
      if (!grid) return fail(404, 'Неизвестный грид', gridId)
      if (req.method !== 'POST' || !grid.edit) return fail(404, 'Не найдено', `Нет маршрута ${req.method} ${req.url}`)
      if (opts.failing?.() === 'edit') return fail(500, 'Сбой сервера', 'Регулятор ?fail=edit')
      // ?conflict=edit — документ «изменили»: 409 до сверки was, тот же Problem, что у хранилища правок
      if (opts.conflicting?.() === 'edit') throw toApiError(409, { type: 'urn:katran:edit-conflict', title: 'Документ изменили', status: 409 })
      const id = decodeURIComponent(raw)
      const body = grid.edit(id, req.body, opts.now?.() ?? localMinute())
      if (body === null || body === undefined) return fail(404, 'Документ не найден', `${gridId}/${id}`)
      return body
    }
    const accRoute = ACCOUNTS.exec(req.url)
    if (accRoute) {
      const [, gridId = '', raw = ''] = accRoute
      const grid = grids[gridId]
      if (!grid) return fail(404, 'Неизвестный грид', gridId)
      if (req.method !== 'GET' || !grid.accounts) return fail(404, 'Не найдено', `Нет маршрута ${req.method} ${req.url}`)
      if (opts.failing?.() === 'accounts') return fail(500, 'Сбой сервера', 'Регулятор ?fail=accounts')
      const id = decodeURIComponent(raw)
      const body = grid.accounts(id, req.query?.side)
      if (body === null || body === undefined) return fail(404, 'Документ не найден', `${gridId}/${id}`)
      return body
    }
    const doc = DOCUMENT.exec(req.url)
    if (doc) {
      const [, gridId = '', raw = ''] = doc
      const grid = grids[gridId]
      if (!grid) return fail(404, 'Неизвестный грид', gridId)
      if (opts.failing?.() === 'detail') return fail(500, 'Сбой сервера', 'Регулятор ?fail=detail')
      const id = decodeURIComponent(raw)
      const body = grid.detail ? grid.detail(id) : null
      if (body === null || body === undefined) return fail(404, 'Документ не найден', `${gridId}/${id}`)
      return body
    }
    const m = ROUTE.exec(req.url)
    if (!m) return fail(404, 'Не найдено', `Нет маршрута ${req.method} ${req.url}`)
    const [, gridId = '', op = ''] = m
    const grid = grids[gridId]
    if (!grid) return fail(404, 'Неизвестный грид', gridId)
    if (opts.failing?.() === (op === 'filter-meta' ? 'meta' : op)) return fail(500, 'Сбой сервера', `Регулятор ?fail=${op === 'filter-meta' ? 'meta' : op}`)
    if (op === 'filter-meta') return grid.meta
    const body = req.body as SearchBody | FacetsBody | SuggestBody
    const errors = validate(grid.meta, body.filter.conditions, 'page' in body ? body.page.size : null)
    if (errors.length > 0) {
      const p: Problem = { type: 'urn:vtb:grid:filter-validation', title: 'Некорректный фильтр', status: 400, detail: `Ошибок: ${errors.length}`, errors }
      throw toApiError(400, p)
    }
    if (op === 'suggest') {
      // тело пришло по сети: limit необязателен (по умолчанию 10), query может оказаться не строкой — проверяем, а не верим типу
      const sb = body as Omit<SuggestBody, 'query' | 'limit'> & { query?: unknown; limit?: unknown }
      const f = grid.meta.fields.find((x) => x.id === sb.field)
      const limit = sb.limit === undefined ? 10 : sb.limit
      const bad: ProblemError[] = []
      if (!f || f.suggest !== true) bad.push({ path: 'field', code: 'SUGGEST_NOT_SUPPORTED', message: `У поля ${sb.field} нет подсказок` })
      if (typeof sb.query !== 'string') bad.push({ path: 'query', code: 'QUERY_NOT_STRING', message: 'query — строка' })
      if (!(typeof limit === 'number' && limit >= 1 && limit <= 50)) bad.push({ path: 'limit', code: 'LIMIT_OUT_OF_RANGE', message: 'limit — от 1 до 50' })
      if (bad.length > 0 || typeof sb.query !== 'string' || typeof limit !== 'number') {
        throw toApiError(400, { type: 'urn:vtb:grid:filter-validation', title: 'Некорректный запрос подсказок', status: 400, detail: `Ошибок: ${bad.length}`, errors: bad })
      }
      return grid.suggest({ ...sb, query: sb.query, limit })
    }
    return op === 'search' ? grid.search(body as SearchBody) : grid.facets(body as FacetsBody)
  }
}
