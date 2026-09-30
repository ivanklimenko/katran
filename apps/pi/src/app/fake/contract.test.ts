import { allSettled, fork } from 'effector'
import { STATUS_LABEL } from '../../entities/doc-status'
import { FX_TYPES, fxDocPorts } from '../../entities/fx-doc'
import { RUB_TYPES, rubDocPorts } from '../../entities/rub-doc'
import { ApiError, createGridPorts, requestFx } from '../../shared/api'
import { fakeGrids } from './grids'
import { makeRubDocs } from './rub-docs.data'
import { makeRubDocDetail } from './rub-docs.detail'
import { createFakeServer } from './server'

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
    expect(m.status === 'done' && m.value.fields.map((x) => x.id)).toEqual(['docNumber', 'status', 'type', 'direction', 'currency', 'amount', 'created', 'f50name', 'f59name'])
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
    const details = rows.map((row, i) => makeRubDocDetail(row, i))
    expect(details.some((d) => (d.budget as { b101: string }).b101 !== '')).toBe(true)
    expect(details.some((d) => (d.agents as unknown[]).length > 0)).toBe(true)
  })
  it('404 на неизвестный id', async () => {
    const r = await allSettled(rubDocPorts.detailFx, { scope: scope(), params: 'rub-9999' })
    expect((r.value as ApiError).status).toBe(404)
  })
})
