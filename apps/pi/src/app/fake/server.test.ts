import type { ColumnDef } from '@katran/ui'
import { ApiError, type HttpRequest } from '../../shared/api'
import { fxDocsMeta, makeFxDocs } from './fx-docs.data'
import { makeRubDocs } from './rub-docs.data'
import { makeFxDocDetail } from './fx-docs.detail'
import { fakeGrid } from './grid'
import { createFakeGrids, createFxDocsEditStore } from './grids'
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
const get = (url: string): HttpRequest => ({ method: 'GET', url })
const tabbed = (failing?: string) => createFakeServer(
  { docs: fakeGrid(rows, columns, meta, { detail: (r) => r, tabs: { ids: ['notes', 'a/b'], data: (r, i) => ({ notes: { items: [r.name, i] }, 'a/b': { id: r.id } }) } }) },
  failing ? { failing: () => failing } : {},
)

describe('фейковый сервер', () => {
  it('search: фильтр, сортировка по уровню, страница — ответ по контракту §5.2', async () => {
    const body = await server(post('/grids/docs/search', search({ filter: { conditions: [{ field: 'status', op: 'EQ', value: 'ERROR' }] }, sort: [{ field: 'amount', direction: 'DESC' }], page: { number: 0, size: 1 } })))
    expect(body).toEqual({ content: [rows[2]], page: { number: 0, size: 1, totalElements: 2, totalPages: 2, hasNext: true } })
  })
  it('facets: счётчики по полю', async () => {
    expect(await server(post('/grids/docs/facets', { filter: { conditions: [] }, field: 'status' }))).toEqual([{ value: 'ERROR', count: 2 }, { value: 'DONE', count: 1 }])
  })
  it('observe: каждый запрос — до задержки и регуляторов, и отказной тоже', async () => {
    const seen: HttpRequest[] = []
    const watched = createFakeServer({ docs: fakeGrid(rows, columns, meta) }, { observe: (r) => seen.push(r), failing: () => 'search' })
    await watched({ method: 'GET', url: '/grids/docs/filter-meta' })
    await expect(watched(post('/grids/docs/search', search()))).rejects.toBeInstanceOf(ApiError)
    expect(seen.map((r) => `${r.method} ${r.url}`)).toEqual(['GET /grids/docs/filter-meta', 'POST /grids/docs/search'])
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
  it('GET documents/{id}/tabs/{tab}: данные вкладки документа; id и tab декодируются', async () => {
    const s = tabbed()
    expect(await s(get('/grids/docs/documents/2/tabs/notes'))).toEqual({ items: ['Бета', 1] })
    expect(await s(get('/grids/docs/documents/1/tabs/a%2Fb'))).toEqual({ id: '1' })
  })
  it('вкладки: 404 — неизвестный грид, документ, вкладка не из набора; грид без вкладок', async () => {
    const s = tabbed()
    await expect(s(get('/grids/nope/documents/1/tabs/notes'))).rejects.toMatchObject({ status: 404, problem: { title: 'Неизвестный грид' } })
    await expect(s(get('/grids/docs/documents/nope/tabs/notes'))).rejects.toMatchObject({ status: 404, problem: { title: 'Документ не найден' } })
    await expect(s(get('/grids/docs/documents/1/tabs/audit'))).rejects.toMatchObject({ status: 404, problem: { title: 'Неизвестная вкладка' } })
    await expect(server(get('/grids/docs/documents/1/tabs/notes'))).rejects.toMatchObject({ status: 404, problem: { title: 'Неизвестная вкладка' } })
  })
  it('?fail=tab — 500 на любой вкладке; ?fail=tab:<id> — только на ней; регуляторы детали и вкладок не пересекаются', async () => {
    const any = tabbed('tab')
    await expect(any(get('/grids/docs/documents/1/tabs/notes'))).rejects.toMatchObject({ status: 500 })
    await expect(any(get('/grids/docs/documents/1/tabs/a%2Fb'))).rejects.toMatchObject({ status: 500 })
    await expect(any(get('/grids/docs/documents/1'))).resolves.toEqual(rows[0])
    const one = tabbed('tab:notes')
    await expect(one(get('/grids/docs/documents/1/tabs/notes'))).rejects.toMatchObject({ status: 500, problem: { detail: 'Регулятор ?fail=tab:notes' } })
    await expect(one(get('/grids/docs/documents/1/tabs/a%2Fb'))).resolves.toEqual({ id: '1' })
    const detail = tabbed('detail')
    await expect(detail(get('/grids/docs/documents/1'))).rejects.toMatchObject({ status: 500 })
    await expect(detail(get('/grids/docs/documents/1/tabs/notes'))).resolves.toEqual({ items: ['Альфа', 0] })
  })
  it('деталь получает весь набор строк третьим аргументом (Task 7: tabsOff по данным вкладок)', async () => {
    const s = createFakeServer({ docs: fakeGrid(rows, columns, meta, { detail: (r, i, all) => ({ id: r.id, i, n: all.length }) }) })
    expect(await s(get('/grids/docs/documents/3'))).toEqual({ id: '3', i: 2, n: 3 })
  })
})

describe('фейковый сервер: правка детали (план 2c)', () => {
  // fx-подобная деталь: [0] MT199 USD, [1] MT202 CNY, [2] MT103 RUB (заблокирован, № 811306), [3] MT103 CNY; у каждого сервера — своё хранилище правок
  const fxRows = makeFxDocs(4)
  const doc = fxRows[3]!
  const locked = fxRows[2]!
  const edited = (opts: Parameters<typeof createFakeServer>[1] = {}) =>
    createFakeServer({ fx: fakeGrid(fxRows, [], fxDocsMeta, { detail: makeFxDocDetail, edits: createFxDocsEditStore(null) }) }, { now: () => '2026-10-06T12:30:00', ...opts })
  const editUrl = (id: string) => `/grids/fx/documents/${encodeURIComponent(id)}/edits`
  const bank57 = { opt: 'A', lines: [doc.f57name, doc.f57] }
  const next57 = { opt: 'A', lines: [doc.f57name, 'VKRBRU8K2KD'] }
  type Detail = { fields: Record<string, unknown>; edits: Record<string, { now: unknown; hist: Record<string, unknown>[] }> }

  it('POST edits: 200 — деталь с правкой и записью pending; GET detail после — та же правка', async () => {
    const s = edited()
    const before = (await s(get(`/grids/fx/documents/${doc.id}`))) as Detail
    expect(before.edits).toEqual({})
    const after = (await s(post(editUrl(doc.id), { target: 'field:57', was: bank57, now: next57 }))) as Detail
    expect(after.fields['57']).toEqual(next57)
    expect(after.edits['field:57']).toEqual({ now: next57, canConfirm: false, hist: [{ who: 'Вы', when: '2026-10-06T12:30:00', was: bank57, now: next57, status: 'pending' }] })
    expect(await s(get(`/grids/fx/documents/${doc.id}`))).toEqual(after)
    // «стало» = текущее — 200 без новой записи
    const same = (await s(post(editUrl(doc.id), { target: 'field:57', was: next57, now: next57 }))) as Detail
    expect(same.edits['field:57']?.hist).toHaveLength(1)
    // правки не трогают реестр (спека §3.6)
    const page = (await s(post('/grids/fx/search', search()))) as { content: { id: string; f57: string }[] }
    expect(page.content.find((r) => r.id === doc.id)?.f57).toBe(doc.f57)
  })
  it('409: was не совпал; ?conflict=edit — 409 всегда', async () => {
    const s = edited()
    const stale = s(post(editUrl(doc.id), { target: 'field:57', was: next57, now: bank57 }))
    await expect(stale).rejects.toMatchObject({ status: 409, problem: { type: 'urn:katran:edit-conflict', title: 'Документ изменили', status: 409 } })
    // после правки прежнее «было» тоже устарело
    await s(post(editUrl(doc.id), { target: 'field:57', was: bank57, now: next57 }))
    await expect(s(post(editUrl(doc.id), { target: 'field:57', was: bank57, now: { opt: 'D', lines: ['X'] } }))).rejects.toMatchObject({ status: 409 })
    const conflicting = edited({ conflicting: () => 'edit' })
    await expect(conflicting(post(editUrl(doc.id), { target: 'field:57', was: bank57, now: next57 }))).rejects.toMatchObject({ status: 409 })
    // регулятор правки не трогает деталь: правка не записана
    expect(((await conflicting(get(`/grids/fx/documents/${doc.id}`))) as Detail).edits).toEqual({})
  })
  it('400: цель не из профиля, тело без target, значение не той формы', async () => {
    const s = edited()
    const bad = async (body: unknown, id = doc.id) => (await s(post(editUrl(id), body)).catch((e: unknown) => e)) as ApiError
    const notInProfile = await bad({ target: 'field:53', was: { lines: [] }, now: { lines: ['X'] } })
    expect(notInProfile).toBeInstanceOf(ApiError)
    expect(notInProfile.status).toBe(400)
    expect(notInProfile.problem?.errors?.[0]).toMatchObject({ path: 'target', code: 'VALIDATION' })
    // 79 — поле MT199, у MT103 его нет; дата валютирования MT199 не правится
    expect((await bad({ target: 'field:79', was: { lines: [] }, now: { lines: ['X'] } })).status).toBe(400)
    expect((await bad({ target: 'valueDate', was: '2026-09-23', now: '2026-09-24' }, fxRows[0]!.id)).status).toBe(400)
    const noTarget = await bad({ was: 'A', now: 'B' })
    expect(noTarget.status).toBe(400)
    expect(noTarget.problem?.errors?.[0]).toMatchObject({ path: 'target', code: 'VALIDATION' })
    expect((await bad({ target: 'refOut', was: 'A' })).problem?.errors?.[0]).toMatchObject({ path: 'now', code: 'VALIDATION' })
    expect((await bad({ target: 'refOut', was: doc.refOut ?? '', now: { lines: ['X'] } })).problem?.errors?.[0]).toMatchObject({ path: 'now' })
    expect((await bad({ target: 'field:57', was: bank57, now: 'X' })).problem?.errors?.[0]).toMatchObject({ path: 'now' })
    expect((await bad('x')).status).toBe(400)
    // заблокированный документ — только просмотр (Д66): любая цель — 400 по target
    expect(locked.lock).not.toBeNull()
    expect((await bad({ target: 'refOut', was: locked.refOut ?? '', now: 'FX1' }, locked.id)).problem?.errors?.[0]).toMatchObject({ path: 'target', code: 'VALIDATION' })
    // счёт не из списка — текст эталона (документ в CNY, счёт клиента в USD)
    const accKt = ((await s(get(`/grids/fx/documents/${doc.id}`))) as { accKt: string }).accKt
    expect((await bad({ target: 'accKt', was: accKt, now: '40817840100050017762' })).problem?.errors?.[0])
      .toEqual({ path: 'now', code: 'VALIDATION', message: 'Счёт не из карточки клиента — выберите из списка' })
    await expect(s(post(editUrl('nope'), { target: 'refOut', was: '', now: 'A' }))).rejects.toMatchObject({ status: 404 })
  })
  it('400 VALIDATION: бек повторяет правила — кириллица в поле 57', async () => {
    const s = edited()
    const error = (await s(post(editUrl(doc.id), { target: 'field:57', was: bank57, now: { opt: 'A', lines: ['БАНК'] } })).catch((e: unknown) => e)) as ApiError
    expect(error.status).toBe(400)
    expect(error.problem?.errors?.[0]).toEqual({ path: 'now', code: 'VALIDATION', message: "Строка 1: недопустимые символы (только латиница, цифры и / - ? : ( ) . , ' +)" })
    // дата валютирования — ГГГГ-ММ-ДД, 20 исх — правила референса
    const vd = (await s(get(`/grids/fx/documents/${doc.id}`)) as { valueDates: string[] }).valueDates[0]!
    expect((await s(post(editUrl(doc.id), { target: 'valueDate', was: vd, now: 'завтра' })).catch((e: unknown) => e) as ApiError).status).toBe(400)
    expect((await s(post(editUrl(doc.id), { target: 'refOut', was: doc.refOut ?? '', now: '/REF' })).catch((e: unknown) => e) as ApiError).status).toBe(400)
  })
  it('↺ к пустому исходному 20 исх принимается: откат не проверяется правилами (спека §4)', async () => {
    const rows = makeFxDocs()
    const id = rows.find((r) => r.refOut === null)!.id
    const s = createFakeServer({ fx: fakeGrid(rows, [], fxDocsMeta, { detail: makeFxDocDetail, edits: createFxDocsEditStore(null) }) }, { now: () => '2026-10-06T12:30:00' })
    const original = ((await s(get(`/grids/fx/documents/${id}`))) as { refOut: string | null }).refOut ?? ''
    expect(original).toBe('')
    await s(post(editUrl(id), { target: 'refOut', was: '', now: 'FX1' }))
    const back = (await s(post(editUrl(id), { target: 'refOut', was: 'FX1', now: '' }))) as Detail & { refOut: string }
    expect(back.refOut).toBe('')
    expect(back.edits.refOut?.hist).toHaveLength(2)
  })
  it('?fail=edit и ?fail=accounts — 500 только у своего маршрута', async () => {
    const accUrl = `/grids/fx/documents/${doc.id}/accounts`
    const body = { target: 'field:57', was: bank57, now: next57 }
    const failEdit = edited({ failing: () => 'edit' })
    await expect(failEdit(post(editUrl(doc.id), body))).rejects.toMatchObject({ status: 500, problem: { detail: 'Регулятор ?fail=edit' } })
    await expect(failEdit({ method: 'GET', url: accUrl, query: { side: 'kt' } })).resolves.toBeDefined()
    await expect(failEdit(get(`/grids/fx/documents/${doc.id}`))).resolves.toBeDefined()
    const failAcc = edited({ failing: () => 'accounts' })
    await expect(failAcc({ method: 'GET', url: accUrl, query: { side: 'kt' } })).rejects.toMatchObject({ status: 500, problem: { detail: 'Регулятор ?fail=accounts' } })
    await expect(failAcc(post(editUrl(doc.id), body))).resolves.toBeDefined()
    // ?fail=detail правку и счета не трогает
    const failDetail = edited({ failing: () => 'detail' })
    await expect(failDetail(post(editUrl(doc.id), body))).resolves.toBeDefined()
  })
  it('маршруты правки: edits — только POST, accounts — только GET; грид без правки — 404', async () => {
    const s = edited()
    await expect(s(get(editUrl(doc.id)))).rejects.toMatchObject({ status: 404 })
    await expect(s(post(`/grids/fx/documents/${doc.id}/accounts`, {}))).rejects.toMatchObject({ status: 404 })
    await expect(s({ method: 'GET', url: `/grids/fx/documents/${doc.id}/accounts`, query: { side: 'x' } })).rejects.toMatchObject({ status: 400 })
    const plain = createFakeServer({ docs: fakeGrid(rows, columns, meta, { detail: (r) => r }) })
    await expect(plain(post('/grids/docs/documents/1/edits', { target: 'refOut', was: '', now: 'A' }))).rejects.toMatchObject({ status: 404 })
    await expect(plain({ method: 'GET', url: '/grids/docs/documents/1/accounts', query: { side: 'kt' } })).rejects.toMatchObject({ status: 404 })
  })
})

describe('фейковый сервер: утверждение и отклонение правки (срез 2d)', () => {
  const WHEN = '2026-10-07T15:20:00'
  const fxRows = makeFxDocs()
  // сид поля 57 — первый документ с полем 57 (MT202, CNY); сид accKt — второй MT103 в USD без блокировки (чужая ожидающая правка)
  const doc57 = fxRows[1]!
  const accDoc = fxRows[14]!
  const own = fxRows[3]!
  const fresh = () => createFakeServer(createFakeGrids(), { now: () => WHEN })
  const decideUrl = (id: string, target: string, kind: string, grid = 'fx-docs') => `/grids/${grid}/documents/${encodeURIComponent(id)}/edits/${encodeURIComponent(target)}/${kind}`
  type Hist = { who: string; when: string; was: unknown; now: unknown; status: string; by?: string; at?: string; reason?: string; note?: string }
  type D = { accKt: string; routeAcc: string; fields: Record<string, unknown>; edits: Record<string, { now: unknown; canConfirm: boolean; hist: Hist[] }> }
  const detail = async (s: ReturnType<typeof fresh>, id: string) => (await s(get(`/grids/fx-docs/documents/${id}`))) as D
  const code = async (p: Promise<unknown>) => (await p.catch((e: unknown) => e)) as ApiError

  it('canConfirm: чужая ожидающая правка поля 57 — true; своя после POST edits — false', async () => {
    const s = fresh()
    const d = await detail(s, doc57.id)
    expect(d.edits['field:57']?.canConfirm).toBe(true)
    const cur = d.fields['57']
    const next = { opt: 'A', lines: [doc57.f57name, 'VKRBRU8K2KD'] }
    const after = (await s(post(`/grids/fx-docs/documents/${doc57.id}/edits`, { target: 'field:57', was: cur, now: next }))) as D
    expect(after.edits['field:57']?.canConfirm).toBe(false)
    const mine = (await s(post(`/grids/fx-docs/documents/${own.id}/edits`, { target: 'refOut', was: own.refOut ?? '', now: 'FX1' }))) as D
    expect(mine.edits.refOut?.canConfirm).toBe(false)
  })
  it('confirm: запись confirmed, by «Вы», at = now фейка, canConfirm false; GET после — то же', async () => {
    const s = fresh()
    const d = await detail(s, doc57.id)
    const when = d.edits['field:57']!.hist[1]!.when
    const after = (await s(post(decideUrl(doc57.id, 'field:57', 'confirm'), { when }))) as D
    expect(after.edits['field:57']?.hist[1]).toMatchObject({ status: 'confirmed', by: 'Вы', at: WHEN })
    expect(after.edits['field:57']?.canConfirm).toBe(false)
    expect(after.fields['57']).toEqual(d.fields['57'])
    expect(await detail(s, doc57.id)).toEqual(after)
  })
  it('confirm: чужой when — 409 edit-conflict, повторный — 409; свою правку — 403; нет правок цели — 404', async () => {
    const s = fresh()
    const when = (await detail(s, doc57.id)).edits['field:57']!.hist[1]!.when
    await expect(s(post(decideUrl(doc57.id, 'field:57', 'confirm'), { when: '2020-01-01T00:00:00' }))).rejects.toMatchObject({ status: 409, problem: { type: 'urn:katran:edit-conflict' } })
    await s(post(decideUrl(doc57.id, 'field:57', 'confirm'), { when }))
    await expect(s(post(decideUrl(doc57.id, 'field:57', 'confirm'), { when }))).rejects.toMatchObject({ status: 409, problem: { type: 'urn:katran:edit-conflict' } })
    const mine = (await s(post(`/grids/fx-docs/documents/${own.id}/edits`, { target: 'refOut', was: own.refOut ?? '', now: 'FX1' }))) as D
    expect((await code(s(post(decideUrl(own.id, 'refOut', 'confirm'), { when: mine.edits.refOut!.hist[0]!.when })))).status).toBe(403)
    expect((await code(s(post(decideUrl(own.id, 'refOut', 'reject'), { when: mine.edits.refOut!.hist[0]!.when, reason: 'нет' })))).status).toBe(403)
    // MT202COV без правок цели
    const cov = fxRows.find((r) => r.type === 'MT202COV')!
    expect((await code(s(post(decideUrl(cov.id, 'field:B.57', 'confirm'), { when })))).status).toBe(404)
    expect((await code(s(post(decideUrl('nope', 'field:57', 'confirm'), { when })))).status).toBe(404)
  })
  it('target в пути декодируется: field%3A57', async () => {
    const s = fresh()
    const when = (await detail(s, doc57.id)).edits['field:57']!.hist[1]!.when
    expect(decideUrl(doc57.id, 'field:57', 'confirm')).toContain('/edits/field%3A57/confirm')
    await expect(s(post(decideUrl(doc57.id, 'field:57', 'confirm'), { when }))).resolves.toBeDefined()
  })
  it('reject: пустая и слишком длинная причина — 400 по пути reason; тело не той формы — 400', async () => {
    const s = fresh()
    const when = (await detail(s, doc57.id)).edits['field:57']!.hist[1]!.when
    for (const reason of ['  ', 'я'.repeat(141)]) {
      const e = await code(s(post(decideUrl(doc57.id, 'field:57', 'reject'), { when, reason })))
      expect(e.status).toBe(400)
      expect(e.problem?.type).toBe('urn:katran:edit-validation')
      expect(e.problem?.errors?.[0]).toMatchObject({ path: 'reason', code: 'VALIDATION' })
    }
    expect((await code(s(post(decideUrl(doc57.id, 'field:57', 'reject'), { when })))).problem?.errors?.[0]).toMatchObject({ path: 'reason' })
    expect((await code(s(post(decideUrl(doc57.id, 'field:57', 'confirm'), {})))).problem?.errors?.[0]).toMatchObject({ path: 'when' })
    expect((await code(s(post(decideUrl(doc57.id, 'field:57', 'confirm'), 'x')))).status).toBe(400)
    // граница: 140 знаков после trim принимаются
    const ok = (await s(post(decideUrl(doc57.id, 'field:57', 'reject'), { when, reason: ` ${'я'.repeat(140)} ` }))) as D
    expect(ok.edits['field:57']?.hist[1]?.reason).toBe('я'.repeat(140))
  })
  it('reject поля 57: запись rejected с причиной, значение цели = was записи, note автора на месте', async () => {
    const s = fresh()
    const before = await detail(s, doc57.id)
    const h = before.edits['field:57']!.hist[1]!
    const after = (await s(post(decideUrl(doc57.id, 'field:57', 'reject'), { when: h.when, reason: ' Не согласовано ' }))) as D
    expect(after.edits['field:57']?.hist[1]).toEqual({ ...h, status: 'rejected', by: 'Вы', at: WHEN, reason: 'Не согласовано' })
    expect(after.edits['field:57']?.hist).toHaveLength(2)
    expect(after.fields['57']).toEqual(h.was)
    expect(after.edits['field:57']?.now).toEqual(h.was)
    expect(after.edits['field:57']?.canConfirm).toBe(false)
  })
  it('сид accKt: чужая ожидающая правка у второго MT103 в USD; reject — Кт = was, маршрут пересчитан, route от «система»', async () => {
    const s = fresh()
    const d0 = await detail(s, accDoc.id)
    const [h] = d0.edits.accKt!.hist
    expect(accDoc).toMatchObject({ type: 'MT103', currency: 'USD', lock: null })
    expect(h).toMatchObject({ who: 'Кузнецов Д. А.', status: 'pending' })
    expect(d0.edits.accKt?.canConfirm).toBe(true)
    expect(d0.accKt).toBe(h!.now)
    expect(d0.edits.route?.hist).toHaveLength(1)
    const after = (await s(post(decideUrl(accDoc.id, 'accKt', 'reject'), { when: h!.when, reason: 'Счёт не согласован с клиентом' }))) as D
    expect(after.accKt).toBe(h!.was)
    expect(after.edits.accKt?.hist[0]).toMatchObject({ status: 'rejected', by: 'Вы', at: WHEN, reason: 'Счёт не согласован с клиентом' })
    const route = after.edits.route!.hist
    expect(route).toHaveLength(2)
    expect(route[1]).toMatchObject({ who: 'система', status: 'confirmed', by: 'система', when: WHEN, was: route[0]!.now, now: route[0]!.was })
    expect(after.routeAcc).not.toBe(d0.routeAcc)
  })
  it('маршрут решения: нет edit у грида или не POST — 404', async () => {
    const s = fresh()
    await expect(s(get(decideUrl(doc57.id, 'x', 'confirm')))).rejects.toMatchObject({ status: 404 })
    await expect(s(post(decideUrl(makeRubDocs()[0]!.id, 'x', 'confirm', 'rub-docs'), { when: 'w' }))).rejects.toMatchObject({ status: 404 })
    await expect(s(post(decideUrl('1', 'x', 'confirm', 'nope'), { when: 'w' }))).rejects.toMatchObject({ status: 404 })
    await expect(s(post(`/grids/fx-docs/documents/${doc57.id}/edits/x/maybe`, {}))).rejects.toMatchObject({ status: 404 })
  })
})
