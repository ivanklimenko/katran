import type { ColumnDef } from '@katran/ui'
import { ApiError, type HttpRequest } from '../../shared/api'
import { fakeGrid } from './grid'
import { field, inline } from './meta'
import { createFakeServer } from './server'

type Row = { id: string; status: string; amount: number; name: string }
const rows: Row[] = [
  { id: '1', status: 'ERROR', amount: 10, name: 'Альфа' },
  { id: '2', status: 'DONE', amount: 30, name: 'Бета' },
  { id: '3', status: 'ERROR', amount: 20, name: 'Гамма' },
]
const columns: ColumnDef<Row>[] = [
  { id: 'status', sort: [{ id: 'status', label: 'Статус' }], render: (r) => r.status },
  { id: 'amount', sort: [{ id: 'amount', label: 'Сумма', type: 'number' }], render: (r) => r.amount },
]
const meta = { fields: [field('status', 'Статус', 'ENUM', 'st'), field('amount', 'Сумма', 'NUMBER'), field('name', 'Имя', 'STRING')], dictionaries: { st: inline({ ERROR: 'Ошибка', DONE: 'Обработан' }) } }
const server = createFakeServer({ docs: fakeGrid(rows, columns, meta) })
const post = (url: string, body: unknown): HttpRequest => ({ method: 'POST', url, body })
const search = (over: object = {}) => ({ filter: { conditions: [] }, sort: [], page: { number: 0, size: 20 }, includeTotal: true, ...over })

describe('фейковый сервер', () => {
  it('search: фильтр, сортировка по уровню, страница — ответ по контракту §5.2', async () => {
    const body = await server(post('/grids/docs/search', search({ filter: { conditions: [{ field: 'status', op: 'EQ', value: 'ERROR' }] }, sort: [{ field: 'amount', direction: 'DESC' }], page: { number: 0, size: 1 } })))
    expect(body).toEqual({ content: [rows[2]], page: { number: 0, size: 1, totalElements: 2, totalPages: 2, hasNext: true } })
  })
  it('facets: счётчики по полю', async () => {
    expect(await server(post('/grids/docs/facets', { filter: { conditions: [] }, field: 'status' }))).toEqual([{ value: 'ERROR', count: 2 }, { value: 'DONE', count: 1 }])
  })
  it('filter-meta: DTO как есть', async () => {
    expect(await server({ method: 'GET', url: '/grids/docs/filter-meta' })).toEqual(meta)
  })
  it('400 Problem Details: неизвестное поле, оператор не по типу, размер страницы (§8)', async () => {
    const run = server(post('/grids/docs/search', search({ filter: { conditions: [{ field: 'nope', op: 'EQ', value: 1 }, { field: 'amount', op: 'CONTAINS', value: '1' }] }, page: { number: 0, size: 900 } })))
    await expect(run).rejects.toBeInstanceOf(ApiError)
    const e = (await run.catch((x: unknown) => x)) as ApiError
    expect(e.status).toBe(400)
    expect(e.problem?.type).toBe('urn:vtb:grid:filter-validation')
    expect(e.problem?.errors?.map((x) => x.code)).toEqual(['UNKNOWN_FIELD', 'OPERATOR_NOT_ALLOWED', 'PAGE_SIZE_OUT_OF_RANGE'])
  })
  it('404 на неизвестный грид и маршрут', async () => {
    await expect(server(post('/grids/nope/search', search()))).rejects.toMatchObject({ status: 404 })
    await expect(server({ method: 'GET', url: '/other' })).rejects.toMatchObject({ status: 404 })
  })
  it('регулятор failing: 500 только у названного запроса', async () => {
    const s = createFakeServer({ docs: fakeGrid(rows, columns, meta) }, { failing: () => 'facets' })
    await expect(s(post('/grids/docs/facets', { filter: { conditions: [] }, field: 'status' }))).rejects.toMatchObject({ status: 500 })
    await expect(s(post('/grids/docs/search', search()))).resolves.toBeDefined()
  })
  it('R3: sortLabels сортирует по подписи, а не по коду', async () => {
    // код по алфавиту: DONE < ERROR, но подписи «Обработан» < «Ошибка» — при sortLabels порядок идёт по подписи, а не по коду
    const statusLabel: Record<string, string> = { ERROR: 'Ошибка', DONE: 'Обработан' }
    const g = fakeGrid(rows, columns, meta, { sortLabels: { status: statusLabel } })
    const s = createFakeServer({ docs: g })
    const body = (await s(post('/grids/docs/search', search({ sort: [{ field: 'status', direction: 'ASC' }] })))) as { content: Row[] }
    expect(body.content.map((r) => r.status)).toEqual(['DONE', 'ERROR', 'ERROR'])
  })
  it('GET documents/{id}: деталь из строки реестра; неизвестный id — 404; ?fail=detail — 500', async () => {
    const s = createFakeServer({ docs: fakeGrid(rows, columns, meta, { detail: (r, i) => ({ ...r, i }) }) })
    expect(await s({ method: 'GET', url: '/grids/docs/documents/2' })).toEqual({ ...rows[1], i: 1 })
    await expect(s({ method: 'GET', url: '/grids/docs/documents/nope' })).rejects.toMatchObject({ status: 404 })
    await expect(s({ method: 'GET', url: '/grids/nope/documents/1' })).rejects.toMatchObject({ status: 404 })
    // грид без детали
    await expect(server({ method: 'GET', url: '/grids/docs/documents/1' })).rejects.toMatchObject({ status: 404 })
    const failing = createFakeServer({ docs: fakeGrid(rows, columns, meta, { detail: (r) => r }) }, { failing: () => 'detail' })
    await expect(failing({ method: 'GET', url: '/grids/docs/documents/1' })).rejects.toMatchObject({ status: 500 })
    // регулятор детали не трогает поиск
    await expect(failing(post('/grids/docs/search', search()))).resolves.toBeDefined()
  })
  it('id в пути декодируется', async () => {
    const odd: Row[] = [{ id: 'a/1', status: 'DONE', amount: 1, name: 'Д' }]
    const s = createFakeServer({ docs: fakeGrid(odd, columns, meta, { detail: (r) => r }) })
    expect(await s({ method: 'GET', url: '/grids/docs/documents/a%2F1' })).toEqual(odd[0])
  })
})
