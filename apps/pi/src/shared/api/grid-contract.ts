import type { Condition, Facet, FacetsQuery, Filter, FilterField, FilterFieldType, FilterMeta, GridPage, GridQuery, Scalar, SuggestQuery } from '@katran/effector'
import { contractError } from './problem'
import { arr, num, obj, oneOf, scalar, str } from './guards'

/** Тела и ответы POST /grids/{gridId}/search|facets|suggest и GET /grids/{gridId}/filter-meta — контракт vtb-filters §5–6 (facets и suggest — предложения, docs/reference/pi-api.md). */
export type SortDto = { field: string; direction: 'ASC' | 'DESC' }
export type SearchBody = { filter: { conditions: Filter }; sort: SortDto[]; page: { number: number; size: number }; includeTotal: boolean }
export type FacetsBody = { filter: { conditions: Filter }; field: string }
export type FieldDto = {
  id: string; label: string; type: FilterFieldType; operators: Condition['op'][]; dictionary?: string | undefined
  /** Оператор по умолчанию (контракт §6). */
  defaultOperator?: Condition['op'] | undefined
  /** Подсказки по полю (предложение, docs/reference/suggest-proposal.md). */
  suggest?: boolean | undefined
}
export type SuggestBody = { filter: { conditions: Filter }; field: string; query: string; limit: number }
export type FilterMetaDto = {
  gridId?: string | undefined
  groups?: { id: string; title: string; fields: string[] }[] | undefined
  fields: FieldDto[]
  dictionaries?: Record<string, { mode: 'INLINE' | 'LOOKUP'; items?: { value: Scalar; label: string }[] | undefined }> | undefined
}
/** Строка грида: сущность проверяет форму и переименовывает поля бека. Бросает contractError. */
export type RowParser<Row> = (raw: unknown, path: string) => Row

export const OPERATORS = ['EQ', 'NE', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IN', 'NOT_IN', 'IS_EMPTY', 'IS_NOT_EMPTY'] as const
export const FIELD_TYPES = ['STRING', 'NUMBER', 'DATE', 'DATETIME', 'ENUM', 'BOOLEAN'] as const

export const toSearchBody = (q: GridQuery): SearchBody => ({
  filter: { conditions: q.filter },
  sort: q.sort.map((l) => ({ field: l.key, direction: l.dir === 'asc' ? 'ASC' : 'DESC' })),
  page: { number: q.page, size: q.size },
  includeTotal: true,
})

export const toFacetsBody = (q: FacetsQuery): FacetsBody => ({ filter: { conditions: q.filter }, field: q.field })

export const toSuggestBody = (q: SuggestQuery): SuggestBody => ({ filter: { conditions: q.filter }, field: q.field, query: q.query, limit: q.limit })

export function fromSearchResponse<Row>(body: unknown, parseRow: RowParser<Row>): GridPage<Row> {
  const o = obj(body, 'ответ')
  const rows = arr(o.content, 'content').map((r, i) => parseRow(r, `content[${i}]`))
  return { rows, total: num(obj(o.page, 'page'), 'totalElements', 'page') }
}

export function fromFacetsResponse(body: unknown): Facet[] {
  return arr(body, 'ответ').map((x, i) => {
    const o = obj(x, `[${i}]`)
    return { value: scalar(o.value, `[${i}].value`), count: num(o, 'count', `[${i}]`) }
  })
}

export function fromSuggestResponse(body: unknown): string[] {
  return arr(obj(body, 'ответ').items, 'items').map((x, i) => {
    if (typeof x !== 'string') throw contractError(`items[${i}]: ожидалась строка`)
    return x
  })
}

export function fromFilterMetaResponse(body: unknown): FilterMeta {
  const o = obj(body, 'ответ')
  const dicts = o.dictionaries === undefined || o.dictionaries === null ? {} : obj(o.dictionaries, 'dictionaries')
  const groupOf = new Map<string, string>()
  if (o.groups !== undefined && o.groups !== null) {
    arr(o.groups, 'groups').forEach((g, i) => {
      const go = obj(g, `groups[${i}]`)
      const title = str(go, 'title', `groups[${i}]`)
      for (const f of arr(go.fields, `groups[${i}].fields`)) if (typeof f === 'string') groupOf.set(f, title)
    })
  }
  const fields = arr(o.fields, 'fields').map((f, i): FilterField => {
    const p = `fields[${i}]`
    const fo = obj(f, p)
    const id = str(fo, 'id', p)
    const ops = arr(fo.operators, `${p}.operators`).map((op, j) => {
      if (typeof op !== 'string' || !(OPERATORS as readonly string[]).includes(op)) throw contractError(`${p}.operators[${j}]: неизвестный оператор`)
      return op as Condition['op']
    })
    let defaultOp: Condition['op'] | undefined
    if (fo.defaultOperator !== undefined && fo.defaultOperator !== null) {
      if (typeof fo.defaultOperator !== 'string' || !(OPERATORS as readonly string[]).includes(fo.defaultOperator)) throw contractError(`${p}.defaultOperator: неизвестный оператор`)
      defaultOp = fo.defaultOperator as Condition['op']
    }
    if (fo.suggest !== undefined && fo.suggest !== null && typeof fo.suggest !== 'boolean') throw contractError(`${p}.suggest: ожидалось true или false`)
    const suggest = fo.suggest === true ? true : undefined
    const dictId = typeof fo.dictionary === 'string' ? fo.dictionary : null
    const d = dictId !== null && dicts[dictId] !== undefined ? obj(dicts[dictId], `dictionaries.${dictId}`) : null
    const values = d !== null && d.mode === 'INLINE'
      ? arr(d.items, `dictionaries.${dictId}.items`).map((it, k) => {
        const ip = `dictionaries.${dictId}.items[${k}]`
        const io = obj(it, ip)
        return { value: scalar(io.value, `${ip}.value`), label: str(io, 'label', ip) }
      })
      : undefined
    return { id, label: str(fo, 'label', p), type: oneOf(fo, 'type', FIELD_TYPES, p), ops, values, group: groupOf.get(id), defaultOp, suggest }
  })
  return { fields }
}
