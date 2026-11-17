import { combine, createEvent, createStore, sample, type EventCallable, type Store } from 'effector'
import {
  createFiltersModel, createGridModel, localStoragePersist,
  type FilterMeta, type FiltersModel, type GridModel, type GridPersisted, type PersistAdapter,
} from '@katran/effector'
import { gridColumns, type RecordLayout } from '@katran/ui'
import type { GridPorts } from '../../../shared/api'
import type { PageLifecycle } from '../../../shared/lib/lifecycle'
import { standParam } from '../../../shared/lib/stand'

export type RegistryConfig<Row> = {
  /** gridId и ключ настроек грида. */
  id: string
  layout: RecordLayout<Row>
  ports: GridPorts<Row>
  lifecycle: PageLifecycle
  /** Видимость/активность конкретного реестра; вместе с lifecycle.$opened. Без опции — активен весь открытый экран. */
  $active?: Store<boolean> | undefined
  pageSize?: number | undefined
  persist?: PersistAdapter<Partial<GridPersisted>> | undefined
}

export type Registry<Row> = {
  filters: FiltersModel
  grid: GridModel<Row>
  lifecycle: PageLifecycle
  /** Эффективная активность: страница открыта и реестр видим. */
  $active: Store<boolean>
  $metaReady: Store<boolean>
  /** Шов деталки (срез 2): страница решает, что открыть. */
  openRequested: EventCallable<{ id: string; secondary: boolean }>
  /** Шов внешних действий (например, аннулирование в деталке): перезапросить реестр, если он открыт. */
  refreshRequested: EventCallable<void>
}

/** Реестр документов: фильтры + грид + фасеты лейна + жизненный цикл экрана. Вызывать на верхнем уровне модуля модели страницы. */
export function createRegistry<Row>(cfg: RegistryConfig<Row>): Registry<Row> {
  const { ports, lifecycle } = cfg
  const $active = cfg.$active ? combine(lifecycle.$opened, cfg.$active, (opened, visible) => opened && visible) : lifecycle.$opened
  const $meta = createStore<FilterMeta | null>(null).on(ports.filterMetaFx.doneData, (_, m) => m)
  const $metaReady = $meta.map((m) => m !== null)
  // подсказки при вводе — порт грида (POST /grids/{gridId}/suggest); задержка, минимум знаков и предел — по умолчанию модели
  const filters = createFiltersModel({ $active, meta: $meta, laneField: 'status', suggest: { fetchFx: ports.suggestFx } })
  const grid = createGridModel<Row>({
    id: cfg.id,
    // gridColumns разворачивает части составных колонок (ColumnDef.split, план 5a, R5) — у частей свои id и ширины
    columns: gridColumns(cfg.layout.columns),
    // регулятор стенда ?size=N — начальный размер страницы (замеры); сохранённый пользователем размер важнее
    pageSize: cfg.pageSize ?? (Number(standParam('size')) || 20),
    $filter: filters.$conditions,
    $active,
    fetchFx: ports.searchFx,
    facets: { field: 'status', fetchFx: ports.facetsFx },
    persist: cfg.persist ?? localStoragePersist('katran-pi'),
    rowKey: cfg.layout.rowKey,
  })
  const openRequested = createEvent<{ id: string; secondary: boolean }>()
  const refreshRequested = createEvent<void>()

  // экран открыт: свежие данные; каталог за сессию не меняется — только если его ещё нет и он не грузится
  // Search/facets запускаются моделью грида ровно при переходе $active в true.
  sample({
    clock: [lifecycle.pageOpened, $active.updates],
    source: combine($metaReady, ports.filterMetaFx.pending, $active, (ready, pending, active) => active && !ready && !pending),
    filter: Boolean,
    fn: () => undefined,
    target: ports.filterMetaFx,
  })
  // экран закрыт: выделение снимается (массовое действие над невидимыми записями опасно), срез реестра остаётся
  sample({ clock: lifecycle.pageClosed, target: grid.clearSelection })
  // Старый контракт без $active: каждый явный pageOpened обновлял грид.
  // Первый вызов уже обработан переходом активности; последующие не меняют $opened.
  if (!cfg.$active) {
    const $openCount = createStore(0).on(lifecycle.pageOpened, (count) => count + 1).reset(lifecycle.pageClosed)
    sample({ clock: lifecycle.pageOpened, source: $openCount, filter: (count) => count > 1, fn: () => undefined, target: grid.refresh })
  }
  // модели статичны после импорта: реакции извне — только пока экран открыт (docs/guides/effector-fsd.md, раздел 4)
  sample({ clock: refreshRequested, filter: $active, target: grid.refresh })

  return { filters, grid, lifecycle, $active, $metaReady, openRequested, refreshRequested }
}
