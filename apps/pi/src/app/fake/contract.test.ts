import { allSettled, fork, type Effect } from 'effector'
import { STATUS_LABEL } from '../../entities/doc-status'
import { TRAIL_EXAMPLES, TRAIL_PARSERS, type TrailTabId } from '../../entities/doc-trail'
import { FX_TABS, FX_TYPES, fxDocPorts, parseFxDocDetail } from '../../entities/fx-doc'
import { RUB_TABS, RUB_TYPES, parseRubDocDetail, rubDocPorts } from '../../entities/rub-doc'
import { ApiError, createGridPorts, requestFx, type TabQuery } from '../../shared/api'
import { fakeGrids } from './grids'
import { makeFxDocs } from './fx-docs.data'
import { FX_TRAIL_TABS, fxDocTrail } from './fx-docs.trail'
import { makeRubDocs } from './rub-docs.data'
import { makeRubDocDetail } from './rub-docs.detail'
import { RUB_TRAIL_TABS, rubDocTrail } from './rub-docs.trail'
import { createFakeServer } from './server'
import { tabsOffOf } from './trail.data'

/** Цепочка «порт → requestFx → сервер». Внутри тот же тест гоняется против своего бека: подставить свой обработчик в handlers. */
const scope = () => fork({ handlers: [[requestFx, createFakeServer(fakeGrids)]] })

describe('контракт fx-docs', () => {
  it('search: фильтр по статусу, сортировка по сумме, страница', async () => {
    const r = await allSettled(fxDocPorts.searchFx, { scope: scope(), params: { filter: [{ field: 'status', op: 'EQ', value: 'ERROR' }], sort: [{ key: 'amount', dir: 'desc' }], page: 0, size: 5 } })
    expect(r.status).toBe('done')
    if (r.status !== 'done') return
    expect(r.value.rows.length).toBeLessThanOrEqual(5)
    expect(r.value.rows.every((d) => d.status === 'ERROR')).toBe(true)
    const amounts = r.value.rows.map((d) => d.amount)
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a))
    expect(r.value.total).toBeGreaterThanOrEqual(r.value.rows.length)
  })
  it('search: двухуровневая сортировка — статус (по подписи), внутри статуса сумма по убыванию', async () => {
    const r = await allSettled(fxDocPorts.searchFx, { scope: scope(), params: { filter: [], sort: [{ key: 'status', dir: 'asc' }, { key: 'amount', dir: 'desc' }], page: 0, size: 100 } })
    expect(r.status).toBe('done')
    if (r.status !== 'done') return
    const rows = r.value.rows
    expect(rows).toHaveLength(87)
    const label = (st: string) => STATUS_LABEL[st as keyof typeof STATUS_LABEL]
    // больше одной группы статусов и хоть одна группа из нескольких строк — иначе второй уровень не проверяется
    expect(new Set(rows.map((d) => d.status)).size).toBeGreaterThan(1)
    expect(rows.some((d, i) => i > 0 && rows[i - 1]!.status === d.status)).toBe(true)
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]!, cur = rows[i]!
      const byStatus = label(prev.status).localeCompare(label(cur.status), 'ru')
      expect(byStatus).toBeLessThanOrEqual(0)
      if (byStatus === 0) expect(prev.amount).toBeGreaterThanOrEqual(cur.amount)
    }
  })
  it('facets и filter-meta', async () => {
    const s = scope()
    const f = await allSettled(fxDocPorts.facetsFx, { scope: s, params: { filter: [], field: 'status' } })
    expect(f.status === 'done' && f.value.reduce((n, x) => n + x.count, 0)).toBe(87)
    const m = await allSettled(fxDocPorts.filterMetaFx, { scope: s })
    expect(m.status === 'done' && m.value.fields.map((x) => x.id)).toEqual(['docNumber', 'refIn', 'refOut', 'status', 'type', 'direction', 'currency', 'amount', 'created', 'f50name', 'f59name', 'f52', 'purpose', 'reason'])
    const byId = new Map(m.status === 'done' ? m.value.fields.map((x) => [x.id, x] as const) : [])
    expect(['docNumber', 'refIn', 'refOut'].map((id) => byId.get(id)?.defaultOp)).toEqual(['IN', 'IN', 'IN'])
    expect(['f50name', 'f59name', 'f52', 'purpose', 'reason'].every((id) => byId.get(id)?.suggest === true)).toBe(true)
    expect(byId.get('amount')?.suggest).toBeUndefined()
  })
  it('suggest: различные значения поля по выборке, по убыванию частоты; поле без suggest — 400; ?fail=suggest — 500', async () => {
    const handle = createFakeServer(fakeGrids)
    const res = await handle({ method: 'POST', url: '/grids/fx-docs/suggest', body: { filter: { conditions: [] }, field: 'f50name', query: 'ооо', limit: 3 } }) as { items: string[] }
    expect(res.items.length).toBeGreaterThan(0)
    expect(res.items.length).toBeLessThanOrEqual(3)
    expect(res.items.every((x) => x.toLowerCase().includes('ооо'))).toBe(true)
    // порядок — по убыванию частоты в выборке; выборка сужается условиями других полей
    const rows = makeFxDocs().filter((d) => d.status === 'ERROR')
    const freq = (name: string) => rows.filter((d) => d.f50name === name).length
    const narrowed = await handle({ method: 'POST', url: '/grids/fx-docs/suggest', body: { filter: { conditions: [{ field: 'status', op: 'EQ', value: 'ERROR' }] }, field: 'f50name', query: 'о', limit: 50 } }) as { items: string[] }
    expect(narrowed.items.length).toBeGreaterThan(1)
    expect(narrowed.items.every((x) => freq(x) > 0)).toBe(true)
    const counts = narrowed.items.map(freq)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
    await expect(handle({ method: 'POST', url: '/grids/fx-docs/suggest', body: { filter: { conditions: [] }, field: 'amount', query: '1', limit: 3 } }))
      .rejects.toMatchObject({ status: 400 })
    await expect(handle({ method: 'POST', url: '/grids/fx-docs/suggest', body: { filter: { conditions: [] }, field: 'f50name', query: 'о', limit: 51 } }))
      .rejects.toMatchObject({ status: 400, problem: { errors: [{ code: 'LIMIT_OUT_OF_RANGE' }] } })
    const failing = createFakeServer(fakeGrids, { failing: () => 'suggest' })
    await expect(failing({ method: 'POST', url: '/grids/fx-docs/suggest', body: { filter: { conditions: [] }, field: 'f50name', query: 'о', limit: 3 } }))
      .rejects.toMatchObject({ status: 500 })
  })
  it('suggest: limit необязателен — по умолчанию 10; нестроковый query — 400 с путём query', async () => {
    const handle = createFakeServer(fakeGrids)
    const all = await handle({ method: 'POST', url: '/grids/fx-docs/suggest', body: { filter: { conditions: [] }, field: 'f50name', query: 'о', limit: 50 } }) as { items: string[] }
    const byDefault = await handle({ method: 'POST', url: '/grids/fx-docs/suggest', body: { filter: { conditions: [] }, field: 'f50name', query: 'о' } }) as { items: string[] }
    expect(byDefault.items).toEqual(all.items.slice(0, 10))
    expect(byDefault.items).toHaveLength(Math.min(10, all.items.length))
    await expect(handle({ method: 'POST', url: '/grids/fx-docs/suggest', body: { filter: { conditions: [] }, field: 'f50name', query: 5, limit: 3 } }))
      .rejects.toMatchObject({ status: 400, problem: { errors: [{ path: 'query' }] } })
    await expect(handle({ method: 'POST', url: '/grids/fx-docs/suggest', body: { filter: { conditions: [] }, field: 'f50name', limit: 3 } }))
      .rejects.toMatchObject({ status: 400, problem: { errors: [{ path: 'query' }] } })
  })
  it('suggestFx: порт → requestFx → фейк; rub-docs — подсказки по наименованию получателя', async () => {
    const r = await allSettled(rubDocPorts.suggestFx, { scope: scope(), params: { field: 'toName', query: 'о', filter: [], limit: 5 } })
    expect(r.status).toBe('done')
    if (r.status !== 'done') return
    expect(r.value.length).toBeGreaterThan(0)
    expect(r.value.length).toBeLessThanOrEqual(5)
  })
  it('400 на недопустимый оператор, 404 на неизвестный грид', async () => {
    const bad = await allSettled(fxDocPorts.searchFx, { scope: scope(), params: { filter: [{ field: 'amount', op: 'CONTAINS', value: '1' }], sort: [], page: 0, size: 20 } })
    expect(bad.status).toBe('fail')
    expect((bad.value as ApiError).problem?.errors?.[0]?.code).toBe('OPERATOR_NOT_ALLOWED')
    const nope = createGridPorts({ gridId: 'nope', parseRow: (x) => x })
    const r = await allSettled(nope.searchFx, { scope: scope(), params: { filter: [], sort: [], page: 0, size: 20 } })
    expect((r.value as ApiError).status).toBe(404)
  })
})

describe('контракт rub-docs', () => {
  it('search и filter-meta (10 полей)', async () => {
    const s = scope()
    // R21: очерёдность — число; справочник ENUM отдаёт числовые value, и фильтр шлёт число, а не строку "5".
    const r = await allSettled(rubDocPorts.searchFx, { scope: s, params: { filter: [{ field: 'queue', op: 'EQ', value: 5 }], sort: [], page: 0, size: 20 } })
    // R16: формула эталона `1 + (i*5)%5` всегда даёт 1 — фильтр по очерёдности 5 раньше проходил
    // впустую (rows.length === 0, every() на пустом массиве — true). Явно проверяем непустой результат.
    expect(r.status).toBe('done')
    if (r.status !== 'done') return
    expect(r.value.rows.length).toBeGreaterThan(0)
    expect(r.value.rows.every((d) => d.queue === 5)).toBe(true)
    const m = await allSettled(rubDocPorts.filterMetaFx, { scope: s })
    expect(m.status === 'done' && m.value.fields).toHaveLength(10)
    const queue = m.status === 'done' ? m.value.fields.find((f) => f.id === 'queue') : undefined
    expect(queue?.values?.map((v) => v.value)).toEqual([1, 2, 3, 4, 5])
  })
  it('данные валидны: счёт 20 цифр, у клиентских 810 в знаках 6–8; БИК 9; ИНН 10/12; КПП 9 или пусто', () => {
    for (const d of makeRubDocs()) {
      for (const acc of [d.fromAcc, d.toAcc]) {
        expect(acc).toMatch(/^\d{20}$/)
        if (/^40[5-8]/.test(acc)) expect(acc.slice(5, 8)).toBe('810')
      }
      for (const bic of [d.fromBic, d.toBic]) expect(bic).toMatch(/^\d{9}$/)
      for (const inn of [d.fromInn, d.toInn]) expect(inn).toMatch(/^(\d{10}|\d{12})$/)
      for (const kpp of [d.fromKpp, d.toKpp]) expect(kpp).toMatch(/^(\d{9}|0?)$/)
    }
  })
  it('есть записи с блокировкой и с неактивностью (В-Р2)', () => {
    const rows = makeRubDocs()
    expect(rows.some((d) => d.lock !== null)).toBe(true)
    expect(rows.some((d) => d.inactive !== null)).toBe(true)
  })
  // Р13/R15: формула эталона (`dir==='IN' && i%4===1`) математически недостижима при k=i%12 (см. комментарий
  // в rub-docs.data.ts и registry-drift.md) — заменена на `i%8===3` (класс C, сознательное отклонение),
  // чтобы состояние «нет значения» LinkValue.docRef реально встречалось в данных.
  it('есть записи с пустым docRef (Р13/R15)', () => {
    expect(makeRubDocs().some((d) => d.docRef === '')).toBe(true)
  })
})

describe('контракт детали fx-docs (спека 2a §6): порт → requestFx → фейк', () => {
  const firstRows = async (sc: ReturnType<typeof scope>) => {
    const page = await allSettled(fxDocPorts.searchFx, { scope: sc, params: { filter: [], sort: [], page: 0, size: 100 } })
    if (page.status !== 'done') throw new Error('search не прошёл')
    return page.value.rows
  }
  it('200: номер, сумма, статус и стороны — как в строке реестра', async () => {
    const sc = scope()
    const row = (await firstRows(sc))[0]!
    const r = await allSettled(fxDocPorts.detailFx, { scope: sc, params: row.id })
    expect(r.status).toBe('done')
    if (r.status !== 'done') return
    expect(r.value).toMatchObject({ id: row.id, docNumber: row.docNumber, amount: row.amount, status: row.status, type: row.type })
    expect(r.value.fields['50']?.acc).toBe(row.f50acc)
    expect(r.value.fields['57']?.lines).toEqual([row.f57name, row.f57])
  })
  it('каждый тип MT разбирается маппером; у MT202COV есть последовательность B', async () => {
    const sc = scope()
    const rows = await firstRows(sc)
    for (const t of FX_TYPES) {
      const row = rows.find((x) => x.type === t)
      expect(row, t).toBeDefined()
      if (!row) continue
      const r = await allSettled(fxDocPorts.detailFx, { scope: sc, params: row.id })
      expect(r.status, t).toBe('done')
      if (r.status === 'done' && t === 'MT202COV') expect(r.value.fields['B.50']).toBeDefined()
    }
  })
  it('404 на неизвестный id; 500 по регулятору detail', async () => {
    const nope = await allSettled(fxDocPorts.detailFx, { scope: scope(), params: 'nope' })
    expect(nope.status).toBe('fail')
    expect((nope.value as ApiError).status).toBe(404)
    const failing = fork({ handlers: [[requestFx, createFakeServer(fakeGrids, { failing: () => 'detail' })]] })
    const sc = scope()
    const row = (await firstRows(sc))[0]!
    const r = await allSettled(fxDocPorts.detailFx, { scope: failing, params: row.id })
    expect((r.value as ApiError).status).toBe(500)
  })
})

describe('контракт детали rub-docs (спека 2a §6)', () => {
  it('200 для каждого вида документа: номер, сумма, статус и стороны — из строки реестра', async () => {
    const sc = scope()
    const page = await allSettled(rubDocPorts.searchFx, { scope: sc, params: { filter: [], sort: [], page: 0, size: 100 } })
    if (page.status !== 'done') throw new Error('search не прошёл')
    for (const t of RUB_TYPES) {
      const row = page.value.rows.find((x) => x.type === t)!
      const r = await allSettled(rubDocPorts.detailFx, { scope: sc, params: row.id })
      expect(r.status, t).toBe('done')
      if (r.status !== 'done') continue
      expect(r.value).toMatchObject({ docNumber: row.docNumber, amount: row.amount, status: row.status })
      expect(r.value.party.s.acc).toBe(row.fromAcc)
      expect(r.value.party.r.inn).toBe(row.toInn)
    }
  })
  it('есть документ с бюджетными реквизитами и с посредниками', () => {
    const rows = makeRubDocs()
    const details = rows.map((row, i) => makeRubDocDetail(row, i, rows))
    expect(details.some((d) => (d.budget as { b101: string }).b101 !== '')).toBe(true)
    expect(details.some((d) => (d.agents as unknown[]).length > 0)).toBe(true)
  })
  it('404 на неизвестный id', async () => {
    const r = await allSettled(rubDocPorts.detailFx, { scope: scope(), params: 'rub-9999' })
    expect((r.value as ApiError).status).toBe(404)
  })
})

describe('контракт вкладок (спека 2b §3.1, §3.5): порт → requestFx → фейк', () => {
  // порты вкладок сущностей подключает Task 10; здесь — те же парсеры поверх того же фейка
  const fxTabPorts = createGridPorts({ gridId: 'fx-docs', parseRow: (x) => x, parseDetail: parseFxDocDetail, parseTab: TRAIL_PARSERS })
  const rubTabPorts = createGridPorts({ gridId: 'rub-docs', parseRow: (x) => x, parseDetail: parseRubDocDetail, parseTab: TRAIL_PARSERS })
  const remoteOf = (tabs: { id: string }[], local: string[]) => tabs.map((t) => t.id).filter((id) => !local.includes(id))
  /** Пустота в домене: список без строк, аудит без секций, исходники без текста; комплаенс пустым не бывает. */
  const isEmpty = (data: unknown) => (Array.isArray(data) ? data.length === 0 : Object.values(data as Record<string, unknown>).every((v) => v === ''))

  async function everyDoc<D extends { tabsOff: string[] }>(detailFx: Effect<string, D, ApiError>, tabFx: Effect<TabQuery, unknown, ApiError>, ids: string[], tabs: readonly string[]) {
    const sc = scope()
    for (const id of ids) {
      const d = await allSettled(detailFx, { scope: sc, params: id })
      if (d.status !== 'done') throw new Error(`${id}: деталь не пришла`)
      const off = d.value.tabsOff
      const got = await Promise.all(tabs.map((tab) => allSettled(tabFx, { scope: sc, params: { id, tab } })))
      tabs.forEach((tab, k) => {
        const r = got[k]!
        if (r.status !== 'done') throw new Error(`${id}/${tab}: ${r.value.message}`)
        expect(isEmpty(r.value), `${id}/${tab}: пусто ⇔ в tabsOff`).toBe(off.includes(tab))
      })
    }
  }

  it('TRAIL_PARSERS: ключи — ровно TrailTabId, это объединение нелокальных вкладок обоих реестров; наборы фейка — нелокальные вкладки реестра', () => {
    const fx = remoteOf(FX_TABS, ['main', 'extra'])
    const rub = remoteOf(RUB_TABS, ['main'])
    const keys = Object.keys(TRAIL_PARSERS).sort()
    expect(keys).toEqual(['audit', 'compliance', 'ed244', 'linked', 'mpu', 'notif', 'source', 'statuses', 'stream', 'tasks'])
    expect(keys).toEqual([...new Set([...fx, ...rub])].sort())
    expect([...FX_TRAIL_TABS]).toEqual(fx)
    expect([...RUB_TRAIL_TABS]).toEqual(rub)
  })
  it('TRAIL_EXAMPLES (форма pi-api.md) разбираются TRAIL_PARSERS', () => {
    expect(Object.keys(TRAIL_EXAMPLES).sort()).toEqual(Object.keys(TRAIL_PARSERS).sort())
    for (const tab of Object.keys(TRAIL_PARSERS) as TrailTabId[]) expect(() => TRAIL_PARSERS[tab](TRAIL_EXAMPLES[tab], 'ответ'), tab).not.toThrow()
  })
  it('fx-docs: каждая вкладка каждого документа разбирается; вкладка в tabsOff ⇔ её данные пусты', async () => {
    await everyDoc(fxTabPorts.detailFx, fxTabPorts.tabFx, makeFxDocs().map((r) => r.id), FX_TRAIL_TABS)
  }, 60_000)
  it('rub-docs: каждая вкладка каждого документа разбирается; вкладка в tabsOff ⇔ её данные пусты', async () => {
    await everyDoc(rubTabPorts.detailFx, rubTabPorts.tabFx, makeRubDocs().map((r) => r.id), RUB_TRAIL_TABS)
  }, 60_000)
  it('данные разнообразны: у части документов вкладка пуста, у части — нет', () => {
    const fx = makeFxDocs()
    const rub = makeRubDocs()
    const fxOff = fx.map((r, i) => tabsOffOf(FX_TRAIL_TABS, fxDocTrail(r, i, fx)))
    const rubOff = rub.map((r, i) => tabsOffOf(RUB_TRAIL_TABS, rubDocTrail(r, i, rub)))
    for (const tab of ['notif', 'stream', 'mpu']) {
      expect(fxOff.some((o) => o.includes(tab)), `fx ${tab} пуста`).toBe(true)
      expect(fxOff.some((o) => !o.includes(tab)), `fx ${tab} непуста`).toBe(true)
    }
    for (const tab of ['linked', 'notif', 'ed244', 'stream', 'mpu']) {
      expect(rubOff.some((o) => o.includes(tab)), `rub ${tab} пуста`).toBe(true)
      expect(rubOff.some((o) => !o.includes(tab)), `rub ${tab} непуста`).toBe(true)
    }
  })
  it('«Связанные» ссылаются на существующие документы того же реестра', () => {
    const fx = makeFxDocs()
    const fxIds = new Set(fx.map((r) => r.id))
    for (const [i, r] of fx.entries()) {
      for (const l of (fxDocTrail(r, i, fx).linked as { documents: { docId: string }[] }).documents) expect(fxIds.has(l.docId), l.docId).toBe(true)
    }
    const rub = makeRubDocs()
    const rubIds = new Set(rub.map((r) => r.id))
    for (const [i, r] of rub.entries()) {
      for (const l of (rubDocTrail(r, i, rub).linked as { documents: { docId: string }[] }).documents) expect(rubIds.has(l.docId), l.docId).toBe(true)
    }
  })
  it('рубль — свои данные: сценарии SC_NCB_*, события rub_evt_*, без артефактов валюты', () => {
    const rows = makeRubDocs()
    const trails = rows.map((r, i) => rubDocTrail(r, i, rows))
    expect(JSON.stringify(trails)).not.toMatch(/USD|EUR|CNY|fx[-_]|RT_FX|Nostro/)
    for (const t of trails) {
      for (const e of (t.statuses as { events: { route: string | null }[] }).events) if (e.route !== null) expect(e.route).toMatch(/^SC_NCB_/)
      for (const e of (t.stream as { events: { event: string }[] }).events) expect(e.event).toMatch(/^rub_evt_/)
    }
  })
  it('404 на вкладку не из набора реестра; ?fail=tab:<id> — 500 только на ней', async () => {
    const fxId = makeFxDocs()[0]!.id
    const rubId = makeRubDocs()[0]!.id
    const ed = await allSettled(fxTabPorts.tabFx, { scope: scope(), params: { id: fxId, tab: 'ed244' } })
    expect((ed.value as ApiError).status).toBe(404)
    const src = await allSettled(rubTabPorts.tabFx, { scope: scope(), params: { id: rubId, tab: 'source' } })
    expect((src.value as ApiError).status).toBe(404)
    const failing = fork({ handlers: [[requestFx, createFakeServer(fakeGrids, { failing: () => 'tab:statuses' })]] })
    const st = await allSettled(fxTabPorts.tabFx, { scope: failing, params: { id: fxId, tab: 'statuses' } })
    expect((st.value as ApiError).status).toBe(500)
    const au = await allSettled(fxTabPorts.tabFx, { scope: failing, params: { id: fxId, tab: 'audit' } })
    expect(au.status).toBe('done')
  })
})
