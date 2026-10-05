import { createEffect, type Effect } from 'effector'
import type { Facet, FacetsQuery, FilterMeta, GridPage, GridQuery, SuggestQuery } from '@katran/effector'
import { fromFacetsResponse, fromFilterMetaResponse, fromSearchResponse, fromSuggestResponse, toFacetsBody, toSearchBody, toSuggestBody, type RowParser } from './grid-contract'
import { obj } from './guards'
import { contractError, type ApiError } from './problem'
import { requestFx } from './request'

/** Порты грида: доменные типы снаружи, контракт и транспорт внутри. Farfetched оборачивает их как есть: createQuery({ effect: searchFx }). */
export type GridPorts<Row> = {
  searchFx: Effect<GridQuery, GridPage<Row>, ApiError>
  facetsFx: Effect<FacetsQuery, Facet[], ApiError>
  filterMetaFx: Effect<void, FilterMeta, ApiError>
  /** Подсказки при вводе: POST /grids/{gridId}/suggest — предложение в контракт, как /facets (docs/reference/pi-api.md). */
  suggestFx: Effect<SuggestQuery, string[], ApiError>
}
/** Документ целиком (спека 2a §4.1): сущность проверяет форму ответа и переименовывает поля бека. Бросает contractError. */
export type DetailParser<D> = (raw: unknown, path: string) => D
/** Порт детали: GET /grids/{gridId}/documents/{id} — предложение в контракт vtb-filters, как /facets (docs/reference/pi-api.md). */
export type DetailPort<D> = { detailFx: Effect<string, D, ApiError> }
/** Запрос одной вкладки деталки (спека 2b §3.1): id документа и id вкладки из FX_TABS / RUB_TABS. */
export type TabQuery = { id: string; tab: string }
/** Парсер данных вкладки: получает объект ответа, бросает contractError. Тип данных знают сущность и её вид вкладки. */
export type TabParser = (raw: unknown, path: string) => unknown
/** Порт вкладок: GET /grids/{gridId}/documents/{id}/tabs/{tab} — предложение в контракт vtb-filters (docs/reference/pi-api.md). */
export type TabPort = { tabFx: Effect<TabQuery, unknown, ApiError> }
export type GridPortsConfig<Row> = { gridId: string; parseRow: RowParser<Row> }

const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

// перегрузки — от полной к простой: TS примеряет первую, и параметры парсеров в литерале остаются неявным any,
// если в первой перегрузке их нет (parseRow и parseDetail есть во всех, где встречаются)
export function createGridPorts<Row, D>(cfg: GridPortsConfig<Row> & { parseDetail: DetailParser<D>; parseTab: Record<string, TabParser> }): GridPorts<Row> & DetailPort<D> & TabPort
export function createGridPorts<Row, D>(cfg: GridPortsConfig<Row> & { parseDetail: DetailParser<D> }): GridPorts<Row> & DetailPort<D>
export function createGridPorts<Row>(cfg: GridPortsConfig<Row>): GridPorts<Row>
export function createGridPorts<Row, D>(
  { gridId, parseRow, parseDetail, parseTab }: GridPortsConfig<Row> & { parseDetail?: DetailParser<D> | undefined; parseTab?: Record<string, TabParser> | undefined },
): GridPorts<Row> | (GridPorts<Row> & DetailPort<D>) | (GridPorts<Row> & DetailPort<D> & TabPort) {
  const base = `/grids/${gridId}`
  // вызов requestFx внутри обработчика сохраняет scope (effector 23)
  const searchFx = createEffect<GridQuery, GridPage<Row>, ApiError>(async (q) =>
    fromSearchResponse(await requestFx({ method: 'POST', url: `${base}/search`, body: toSearchBody(q) }), parseRow))
  const facetsFx = createEffect<FacetsQuery, Facet[], ApiError>(async (q) =>
    fromFacetsResponse(await requestFx({ method: 'POST', url: `${base}/facets`, body: toFacetsBody(q) })))
  const filterMetaFx = createEffect<void, FilterMeta, ApiError>(async () =>
    fromFilterMetaResponse(await requestFx({ method: 'GET', url: `${base}/filter-meta` })))
  const suggestFx = createEffect<SuggestQuery, string[], ApiError>(async (q) =>
    fromSuggestResponse(await requestFx({ method: 'POST', url: `${base}/suggest`, body: toSuggestBody(q) })))
  if (!parseDetail) return { searchFx, facetsFx, filterMetaFx, suggestFx }
  // id — в пути: кодируется, чтобы «/», «?» и «#» в идентификаторе бека не ломали маршрут
  const doc = (id: string) => `${base}/documents/${encodeURIComponent(id)}`
  const detailFx = createEffect<string, D, ApiError>(async (id) =>
    parseDetail(obj(await requestFx({ method: 'GET', url: doc(id) }), 'ответ'), 'ответ'))
  if (!parseTab) return { searchFx, facetsFx, filterMetaFx, suggestFx, detailFx }
  const tabFx = createEffect<TabQuery, unknown, ApiError>(async ({ id, tab }) => {
    // вкладка без парсера — ошибка контракта сущности, запрос не уходит; hasOwn — чтобы «toString» не нашёлся в прототипе
    const parse = hasOwn(parseTab, tab) ? parseTab[tab] : undefined
    if (!parse) throw contractError(`вкладка «${tab}»: нет парсера`)
    return parse(obj(await requestFx({ method: 'GET', url: `${doc(id)}/tabs/${encodeURIComponent(tab)}` }), 'ответ'), 'ответ')
  })
  return { searchFx, facetsFx, filterMetaFx, suggestFx, detailFx, tabFx }
}
