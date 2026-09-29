import { ApiError } from './problem'
import { fromFacetsResponse, fromFilterMetaResponse, fromSearchResponse, toFacetsBody, toSearchBody } from './grid-contract'
import { obj, str } from './guards'

const parseRow = (raw: unknown, path: string) => { const o = obj(raw, path); return { id: str(o, 'id', path) } }

describe('контракт грида', () => {
  it('toSearchBody: фильтр, уровни сортировки, страница, includeTotal (§5.1)', () => {
    expect(toSearchBody({ filter: [{ field: 'status', op: 'IN', values: ['ERROR'] }], sort: [{ key: 'created', dir: 'desc' }, { key: 'amount', dir: 'asc' }], page: 2, size: 20 })).toEqual({
      filter: { conditions: [{ field: 'status', op: 'IN', values: ['ERROR'] }] },
      sort: [{ field: 'created', direction: 'DESC' }, { field: 'amount', direction: 'ASC' }],
      page: { number: 2, size: 20 },
      includeTotal: true,
    })
  })
  it('toFacetsBody', () => {
    expect(toFacetsBody({ filter: [], field: 'status' })).toEqual({ filter: { conditions: [] }, field: 'status' })
  })
  it('fromSearchResponse: content → строки, totalElements → total (§5.2)', () => {
    const body = { content: [{ id: 'DOC-1' }, { id: 'DOC-2' }], page: { number: 0, size: 50, totalElements: 651, totalPages: 14, hasNext: true } }
    expect(fromSearchResponse(body, parseRow)).toEqual({ rows: [{ id: 'DOC-1' }, { id: 'DOC-2' }], total: 651 })
    expect(fromSearchResponse({ content: [], page: { number: 0, size: 20, totalElements: 0 } }, parseRow)).toEqual({ rows: [], total: 0 })
  })
  it('битая форма → ApiError urn:katran:contract с путём поля', () => {
    const run = () => fromSearchResponse({ content: [{ id: 7 }], page: { totalElements: 1 } }, parseRow)
    expect(run).toThrow(ApiError)
    expect(run).toThrow('content[0].id: ожидалась строка')
    expect(() => fromSearchResponse({ page: { totalElements: 1 } }, parseRow)).toThrow('content: ожидался массив')
  })
  it('fromFacetsResponse', () => {
    expect(fromFacetsResponse([{ value: 'ERROR', count: 3 }])).toEqual([{ value: 'ERROR', count: 3 }])
    expect(() => fromFacetsResponse([{ value: 'ERROR' }])).toThrow(ApiError)
  })
  it('fromFilterMetaResponse: операторы, INLINE-справочник, группа (§6)', () => {
    const body = {
      gridId: 'documents',
      groups: [{ id: 'main', title: 'Основные', fields: ['status', 'docNumber'] }],
      fields: [
        { id: 'status', label: 'Статус', type: 'ENUM', dictionary: 'docStatus', operators: ['EQ', 'IN'] },
        { id: 'docNumber', label: 'Номер документа', type: 'STRING', operators: ['EQ', 'CONTAINS'] },
        { id: 'bic', label: 'БИК', type: 'STRING', dictionary: 'bic', operators: ['EQ'] },
      ],
      dictionaries: { docStatus: { mode: 'INLINE', items: [{ value: 'ERROR', label: 'Ошибка' }] }, bic: { mode: 'LOOKUP' } },
    }
    expect(fromFilterMetaResponse(body)).toEqual({ fields: [
      { id: 'status', label: 'Статус', type: 'ENUM', ops: ['EQ', 'IN'], values: [{ value: 'ERROR', label: 'Ошибка' }], group: 'Основные' },
      { id: 'docNumber', label: 'Номер документа', type: 'STRING', ops: ['EQ', 'CONTAINS'], values: undefined, group: 'Основные' },
      { id: 'bic', label: 'БИК', type: 'STRING', ops: ['EQ'], values: undefined, group: undefined },
    ] })
    expect(() => fromFilterMetaResponse({ fields: [{ id: 'a', label: 'А', type: 'STRING', operators: ['LIKE'] }] })).toThrow('fields[0].operators[0]: неизвестный оператор')
  })
})
