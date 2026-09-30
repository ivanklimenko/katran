import { createEffect, type Effect } from 'effector'
import type { Facet, FacetsQuery, FilterMeta, GridPage, GridQuery, SuggestQuery } from '@katran/effector'
import { fromFacetsResponse, fromFilterMetaResponse, fromSearchResponse, fromSuggestResponse, toFacetsBody, toSearchBody, toSuggestBody, type RowParser } from './grid-contract'
import { obj } from './guards'
import type { ApiError } from './problem'
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
export type GridPortsConfig<Row> = { gridId: string; parseRow: RowParser<Row> }

// перегрузка с деталью — первой: иначе TS примеряет первую, и параметры parseRow/parseDetail в литерале остаются неявным any
export function createGridPorts<Row, D>(cfg: GridPortsConfig<Row> & { parseDetail: DetailParser<D> }): GridPorts<Row> & DetailPort<D>
export function createGridPorts<Row>(cfg: GridPortsConfig<Row>): GridPorts<Row>
export function createGridPorts<Row, D>(
  { gridId, parseRow, parseDetail }: GridPortsConfig<Row> & { parseDetail?: DetailParser<D> | undefined },
): GridPorts<Row> | (GridPorts<Row> & DetailPort<D>) {
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
  const detailFx = createEffect<string, D, ApiError>(async (id) =>
    parseDetail(obj(await requestFx({ method: 'GET', url: `${base}/documents/${encodeURIComponent(id)}` }), 'ответ'), 'ответ'))
  return { searchFx, facetsFx, filterMetaFx, suggestFx, detailFx }
}
