import { allSettled, fork } from 'effector'
import { fxDocPorts } from '../../entities/fx-doc'
import { rubDocPorts } from '../../entities/rub-doc'
import { ApiError, createGridPorts, requestFx } from '../../shared/api'
import { fakeGrids } from './grids'
import { makeRubDocs } from './rub-docs.data'
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
    const r = await allSettled(rubDocPorts.searchFx, { scope: s, params: { filter: [{ field: 'queue', op: 'EQ', value: '5' }], sort: [], page: 0, size: 20 } })
    // R16: формула эталона `1 + (i*5)%5` всегда даёт 1 — фильтр по очерёдности 5 раньше проходил
    // впустую (rows.length === 0, every() на пустом массиве — true). Явно проверяем непустой результат.
    expect(r.status).toBe('done')
    if (r.status !== 'done') return
    expect(r.value.rows.length).toBeGreaterThan(0)
    expect(r.value.rows.every((d) => d.queue === 5)).toBe(true)
    const m = await allSettled(rubDocPorts.filterMetaFx, { scope: s })
    expect(m.status === 'done' && m.value.fields).toHaveLength(10)
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
