import { combine, createEvent, createStore, sample, type EventCallable, type Store } from 'effector'
import {
  createFiltersModel, createGridModel, localStoragePersist,
  type FilterMeta, type FiltersModel, type GridModel, type GridPersisted, type PersistAdapter,
} from '@katran/effector'
import { gridColumns, type RecordLayout } from '@katran/ui'
import type { GridPorts } from '../../../shared/api'
import type { PageLifecycle } from '../../../shared/lib/lifecycle'

export type RegistryConfig<Row> = {
  /** gridId и ключ настроек грида. */
  id: string
  layout: RecordLayout<Row>
  ports: GridPorts<Row>
  lifecycle: PageLifecycle
  pageSize?: number | undefined
  persist?: PersistAdapter<Partial<GridPersisted>> | undefined
}

export type Registry<Row> = {
  filters: FiltersModel
  grid: GridModel<Row>
  lifecycle: PageLifecycle
  $metaReady: Store<boolean>
  /** Шов деталки (срез 2): страница решает, что открыть. */
  openRequested: EventCallable<{ id: string; secondary: boolean }>
  /** Шов внешних действий (например, аннулирование в деталке): перезапросить реестр, если он открыт. */
  refreshRequested: EventCallable<void>
}

/** Реестр документов: фильтры + грид + фасеты лейна + жизненный цикл экрана. Вызывать на верхнем уровне модуля модели страницы. */
export function createRegistry<Row>(cfg: RegistryConfig<Row>): Registry<Row> {
  const { ports, lifecycle } = cfg
  const $meta = createStore<FilterMeta | null>(null).on(ports.filterMetaFx.doneData, (_, m) => m)
  const $metaReady = $meta.map((m) => m !== null)
  // подсказки при вводе — порт грида (POST /grids/{gridId}/suggest); задержка, минимум знаков и предел — по умолчанию модели
  const filters = createFiltersModel({ meta: $meta, laneField: 'status', suggest: { fetchFx: ports.suggestFx } })
  const grid = createGridModel<Row>({
    id: cfg.id,
    // gridColumns разворачивает части составных колонок (ColumnDef.split, план 5a, R5) — у частей свои id и ширины
    columns: gridColumns(cfg.layout.columns),
    pageSize: cfg.pageSize ?? 20,
    $filter: filters.$conditions,
    fetchFx: ports.searchFx,
    facets: { field: 'status', fetchFx: ports.facetsFx },
    persist: cfg.persist ?? localStoragePersist('katran-pi'),
    rowKey: cfg.layout.rowKey,
  })
  const openRequested = createEvent<{ id: string; secondary: boolean }>()
  const refreshRequested = createEvent<void>()

  // экран открыт: свежие данные; каталог за сессию не меняется — только если его ещё нет и он не грузится
  sample({ clock: lifecycle.pageOpened, target: grid.refresh })
  sample({
    clock: lifecycle.pageOpened,
    source: combine($metaReady, ports.filterMetaFx.pending, (ready, pending) => !ready && !pending),
    filter: Boolean,
    fn: () => undefined,
    target: ports.filterMetaFx,
  })
  // экран закрыт: выделение снимается (массовое действие над невидимыми записями опасно), срез реестра остаётся
  sample({ clock: lifecycle.pageClosed, target: grid.clearSelection })
  // модели статичны после импорта: реакции извне — только пока экран открыт (docs/guides/effector-fsd.md, раздел 4)
  sample({ clock: refreshRequested, filter: lifecycle.$opened, target: grid.refresh })

  return { filters, grid, lifecycle, $metaReady, openRequested, refreshRequested }
}
