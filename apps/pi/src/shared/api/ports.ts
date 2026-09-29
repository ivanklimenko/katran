import { createEffect, type Effect } from 'effector'
import type { Facet, FacetsQuery, FilterMeta, GridPage, GridQuery } from '@katran/effector'
import { fromFacetsResponse, fromFilterMetaResponse, fromSearchResponse, toFacetsBody, toSearchBody, type RowParser } from './grid-contract'
import type { ApiError } from './problem'
import { requestFx } from './request'

/** Порты грида: доменные типы снаружи, контракт и транспорт внутри. Farfetched оборачивает их как есть: createQuery({ effect: searchFx }). */
export type GridPorts<Row> = {
  searchFx: Effect<GridQuery, GridPage<Row>, ApiError>
  facetsFx: Effect<FacetsQuery, Facet[], ApiError>
  filterMetaFx: Effect<void, FilterMeta, ApiError>
}

export function createGridPorts<Row>({ gridId, parseRow }: { gridId: string; parseRow: RowParser<Row> }): GridPorts<Row> {
  const base = `/grids/${gridId}`
  // вызов requestFx внутри обработчика сохраняет scope (effector 23)
  const searchFx = createEffect<GridQuery, GridPage<Row>, ApiError>(async (q) =>
    fromSearchResponse(await requestFx({ method: 'POST', url: `${base}/search`, body: toSearchBody(q) }), parseRow))
  const facetsFx = createEffect<FacetsQuery, Facet[], ApiError>(async (q) =>
    fromFacetsResponse(await requestFx({ method: 'POST', url: `${base}/facets`, body: toFacetsBody(q) })))
  const filterMetaFx = createEffect<void, FilterMeta, ApiError>(async () =>
    fromFilterMetaResponse(await requestFx({ method: 'GET', url: `${base}/filter-meta` })))
  return { searchFx, facetsFx, filterMetaFx }
}
