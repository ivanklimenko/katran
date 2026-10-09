import { allSettled, fork } from 'effector'
import { createBalancesFx, parseBalances, parseRates, ratesFx } from './lookup-ports'
import { ApiError, toApiError } from './problem'
import { requestFx, type HttpRequest } from './request'

const cb = { rate: '92,4517', date: '2026-10-07', rub: '924 517,00' }
const deal = { rate: '1,0850', from: 'EUR', to: 'USD', amount: '10 000,00' }

describe('parseRates', () => {
  it('deal: null и deal с курсом конверсии', () => {
    expect(parseRates({ cb, deal: null })).toEqual({ cb, deal: null })
    expect(parseRates({ cb, deal })).toEqual({ cb, deal })
  })
  it('нет ключа deal — как null', () => {
    expect(parseRates({ cb }).deal).toBeNull()
  })
  it('число вместо строки — ошибка с путём', () => {
    expect(() => parseRates({ cb: { ...cb, rate: 92.45 }, deal: null })).toThrow('ответ.cb.rate: ожидалась строка')
    expect(() => parseRates({ cb, deal: { ...deal, amount: 5 } })).toThrow('ответ.deal.amount: ожидалась строка')
    expect(() => parseRates({ deal: null })).toThrow('ответ.cb: ожидался объект')
  })
})

describe('parseBalances', () => {
  const ok = { acc: '30110840700000001842', ccy: 'USD', balance: '1 500,50', available: null }
  const bad = { acc: '40817840100050017762', ccy: 'USD', error: 'Счёт недоступен' }
  it('остаток (available — строка или null) и ошибка счёта — два вида элемента', () => {
    const r = parseBalances({ asOf: '2026-10-07T10:00:00', items: [ok, { ...ok, available: '1 000,00' }, bad] })
    expect(r.asOf).toBe('2026-10-07T10:00:00')
    expect(r.items).toEqual([ok, { ...ok, available: '1 000,00' }, bad])
  })
  it('нет ключа available — null', () => {
    const noAvail: Record<string, unknown> = { ...ok }
    delete noAvail.available
    expect(parseBalances({ asOf: 'x', items: [noAvail] }).items[0]).toEqual(ok)
  })
  it('элемент без balance и без error — ошибка ответ.items[1]', () => {
    expect(() => parseBalances({ asOf: 'x', items: [ok, { acc: 'a', ccy: 'USD' }] })).toThrow('ответ.items[1]')
  })
  it('битые поля — ошибка с путём', () => {
    expect(() => parseBalances({ items: [] })).toThrow('ответ.asOf: ожидалась строка')
    expect(() => parseBalances({ asOf: 'x', items: [{ ...ok, balance: 1 }] })).toThrow('ответ.items[0].balance: ожидалась строка')
  })
})

describe('порты курсов и остатков', () => {
  it('ratesFx: GET /grids/fx-docs/documents/{id}/rates через parseRates', async () => {
    const reqs: HttpRequest[] = []
    const scope = fork({ handlers: [[requestFx, async (r: HttpRequest) => { reqs.push(r); return { cb, deal: null } }]] })
    const r = await allSettled(ratesFx, { scope, params: 'a/b' })
    expect(reqs[0]).toEqual({ method: 'GET', url: '/grids/fx-docs/documents/a%2Fb/rates' })
    expect(r).toEqual({ status: 'done', value: { cb, deal: null } })
  })
  it('createBalancesFx: GET /grids/{gridId}/documents/{id}/balances через parseBalances', async () => {
    const reqs: HttpRequest[] = []
    const body = { asOf: '2026-10-07 10:00', items: [{ acc: '1', ccy: 'RUB', balance: '1', available: null }] }
    const scope = fork({ handlers: [[requestFx, async (r: HttpRequest) => { reqs.push(r); return body }]] })
    const r = await allSettled(createBalancesFx('rub-docs'), { scope, params: '1' })
    expect(reqs[0]).toEqual({ method: 'GET', url: '/grids/rub-docs/documents/1/balances' })
    expect(r).toEqual({ status: 'done', value: body })
  })
  it('битый ответ — contractError; не-2xx — ApiError со статусом', async () => {
    const bad = await allSettled(ratesFx, { scope: fork({ handlers: [[requestFx, async () => 'x']] }), params: '1' })
    expect(bad.status).toBe('fail')
    expect((bad.value as ApiError).message).toContain('ответ: ожидался объект')
    const fail = await allSettled(createBalancesFx('fx-docs'), {
      scope: fork({ handlers: [[requestFx, async () => { throw toApiError(500, { type: 'about:blank', title: 'Сбой', status: 500 }) }]] }), params: '1',
    })
    expect((fail.value as ApiError).status).toBe(500)
  })
})
