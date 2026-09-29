# Katran в FSD-приложении на effector

Рекомендация для команд, которые подключают `@katran/ui` и `@katran/effector` в приложение, устроенное по Feature-Sliced Design. Для самого кита не действует: katran — библиотека (пакеты `tokens`/`ui`/`effector`), слоёв FSD в ней нет и не будет.

Основа — выжимка из скилла [effector-fsd](https://github.com/demark-pro/skills/tree/master/skills/effector-fsd) (MIT, состояние на 2026-07-07) и официальных доков FSD v2.1. Оставлено только то, что применимо у нас: effector 23.4 без Farfetched, Atomic Router, Next.js и SSR. Про роутинг хоста ничего не предполагается — там, где нужен признак «экран открыт», подставьте то, что даёт ваш роутер.

Живой образец — `apps/pi` (реестры «Валютные документы» и «Рублёвые документы»): примеры этого документа приведены к его реальным именам (`entities/fx-doc`, `widgets/doc-registry`, `createPageLifecycle`). Перенос во внутреннее приложение — `docs/guides/pi-usage.md`.

## 1. Правила FSD, которые влияют на код с katran

- Слои сверху вниз: `app → pages → widgets → features → entities → shared`. Импорт — только вниз и только через публичный API слайса (`index.ts`); внутри слайса — относительные пути. Соседние слайсы одного слоя друг друга не импортируют (исключение — `@x` между сущностями).
- `app` и `shared` — без слайсов, сразу сегменты: `shared/api`, `shared/lib`, `shared/config`.
- Сегменты по назначению: `ui`, `model`, `api`, `lib`, `config`. Не `components/`, `hooks/`, `store/`, `utils/`.
- `shared` не знает предметной области: ни «платёжного поручения», ни статусов ПИ, ни пользователя.
- Модели делятся по ответственности (`filters.model.ts`, `grid.model.ts`, `page.model.ts`), не по типу юнита (`stores.ts`, `events.ts`, `effects.ts`).
- Слои и сегменты заводятся, когда в них есть содержимое. Пустые `widgets/` и `features/` «на вырост» не нужны.

## 2. Где что лежит

| Что | Куда | Почему |
|---|---|---|
| `@katran/ui`, `@katran/effector` | внешние пакеты, импорт из любого слоя | это уровень `shared`, но копировать или оборачивать их в `shared/ui` не нужно |
| Обёртка над katran без предметки (например, общий `EmptyState` приложения) | `shared/ui` | переиспользуемая, не знает домена |
| HTTP-клиент, базовый URL, разбор ошибок | `shared/api` | транспорт без домена |
| Эффект поиска документов `searchFx: Effect<GridQuery, GridPage<Row>>`, перевод `GridQuery` в DTO бека, эндпоинт `filter-meta` | `entities/<документ>/api` | ресурс домена, нужен не одному экрану |
| Тип записи, словари статусов (`STATUS_LABEL`, `STATUS_TONE`), колонки и раскладка записи | `entities/<документ>/model` или `config` | факты о документе, не об экране |
| Визуал документа без действий (статус с причиной, счёт сокращённо) | `entities/<документ>/ui` | повторяется на реестре и в деталке |
| Экземпляры `createFiltersModel` и `createGridModel` конкретного реестра | `pages/<реестр>/model` | фильтр, сортировка, пагинация, выделение — состояние экрана |
| То же, если один и тот же реестр встраивается в несколько экранов | `widgets/<реестр>/model` | самостоятельный блок; виджет ради одного экрана не заводить |
| Массовые действия (аннулировать, экспорт), правка поля в деталке | `features/<действие>` | действие пользователя со своей мутацией и валидацией |
| Персональные настройки грида на беке (адаптер `persist`) | `entities/<настройки>` или `app` | не `shared`: адаптер знает пользователя |
| Запуск приложения, общая реакция на 401, инвалидация между экранами | `app/model` | связывает несколько слоёв |

Пример реестра — по образцу `apps/pi` (реестр `entities/fx-doc`, виджет `widgets/doc-registry`; `features/pi-annul` ниже — иллюстрация слоя, в `apps/pi` такой фичи нет, эндпоинт аннулирования не поставлен):

```txt
src/
  entities/fx-doc/
    index.ts
    api/ports.ts             # fxDocPorts: searchFx, facetsFx, filterMetaFx
    model/fxDoc.ts           # тип записи, раскладка колонок — apps/pi/src/entities/fx-doc/model, ui/layout.ts
    ui/cells.tsx
  features/pi-annul/
    index.ts                 # piAnnulled, $$piAnnul
    api/annul.ts
    model/annul.model.ts
    ui/annul-button.tsx
  widgets/doc-registry/
    index.ts
    lib/createRegistry.ts    # createFiltersModel + createGridModel + жизненный цикл экрана — раздел 3
    ui/DocRegistry.tsx
  pages/fx-docs/
    index.ts
    model/registry.model.ts  # createPageLifecycle() + widgets/doc-registry:createRegistry(...)
    ui/FxDocsPage.tsx
```

## 3. Модели katran в приложении

**Фабрики вызываются на верхнем уровне модуля модели**, не в компоненте и не в `useMemo`: юниты effector — статический граф, создание при рендере даёт новую модель на каждый маунт и утечку подписок.

В `apps/pi` фабрики вызываются не прямо в модели страницы, а внутри переиспользуемой обёртки `widgets/doc-registry/lib/createRegistry.ts` — оба реестра (`fx-docs`, `rub-docs`) отличаются только раскладкой и портами, а не устройством модели:

```ts
// widgets/doc-registry/lib/createRegistry.ts
import { createFiltersModel, createGridModel, localStoragePersist } from '@katran/effector'
import { gridColumns } from '@katran/ui'

export function createRegistry<Row>(cfg: RegistryConfig<Row>) {
  const $meta = createStore<FilterMeta | null>(null).on(cfg.ports.filterMetaFx.doneData, (_, m) => m)
  const filters = createFiltersModel({ meta: $meta, laneField: 'status' })
  const grid = createGridModel<Row>({
    id: cfg.id,
    columns: gridColumns(cfg.layout.columns),
    $filter: filters.$conditions,
    fetchFx: cfg.ports.searchFx,
    facets: { field: 'status', fetchFx: cfg.ports.facetsFx },
    persist: cfg.persist ?? localStoragePersist('katran-pi'),
    rowKey: cfg.layout.rowKey,
  })
  // ...
}
```

Если у вас один реестр (не два одинаково устроенных, как в `apps/pi`) — оправданнее звать `createFiltersModel`/`createGridModel` прямо в `pages/<реестр>/model/filters.model.ts` и `grid.model.ts`, без обёртки; правило не в наличии `createRegistry`, а в том, что фабрики вызываются один раз при загрузке модуля:

```ts
// pages/fx-docs/model/registry.model.ts
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { createRegistry } from '../../../widgets/doc-registry'
import { fxDocLayout, fxDocPorts } from '../../../entities/fx-doc'

export const lifecycle = createPageLifecycle()
export const registry = createRegistry({ id: 'fx-docs', layout: fxDocLayout, ports: fxDocPorts, lifecycle })
```

**Компонент только связывает.** `useGrid(grid)` и `useFilters(filters)` — единственное место встречи модели с `DataGrid` и панелью фильтров; юнитов в компоненте не создавать (`pages/fx-docs/ui/FxDocsPage.tsx` передаёт готовый `registry` в `DocRegistry`, а не создаёт модель).

**Первый запрос — из события страницы.** Модель грида сама в бек не ходит, нужен `grid.refresh()`. Роль «события страницы» в `apps/pi` играет `lifecycle.pageOpened` (`createPageLifecycle`, раздел 1) — его вызывает роутер, когда экран открылся (`docs/guides/pi-usage.md`, раздел 5), а не компонент в `useEffect`:

```ts
// widgets/doc-registry/lib/createRegistry.ts
sample({ clock: lifecycle.pageOpened, target: grid.refresh })
```

## 4. Статический граф: грабли, которые не видит линтер импортов

**Модель страницы жива, пока жив модуль.** Импортированный модуль с `sample` реагирует всегда, даже когда экран закрыт; для remote в Module Federation — до перезагрузки хоста. Отсюда два следствия.

1. Реакция страницы на событие фичи гейтится признаком «экран открыт», иначе закрытый реестр перезапрашивает данные после действия на другом экране. В `apps/pi` это уже сделано на уровне виджета: `Registry.refreshRequested` (`widgets/doc-registry/lib/createRegistry.ts`) — внешний код зовёт `registry.refreshRequested()`, сам виджет решает, обновлять ли грид, по `lifecycle.$opened`:

   ```ts
   // widgets/doc-registry/lib/createRegistry.ts
   sample({ clock: refreshRequested, filter: lifecycle.$opened, target: grid.refresh })
   ```

   По тому же образцу — реакция страницы на событие фичи из другого слайса:

   ```ts
   sample({
     clock: piAnnulled,
     source: lifecycle.$opened,   // из createPageLifecycle или своего роутера
     filter: Boolean,
     target: grid.refresh,
   })
   ```

   Если после действия нужно обновить несколько экранов, это не реакции в каждой странице, а одна инвалидация в `app` или в сущности — каждый реестр слушает общее событие через свой `refreshRequested`.

2. Состояние моделей katran (фильтры, выделение, страница) переживает размонтирование экрана. Если при уходе с экрана оно должно сбрасываться — это решение экрана: в `apps/pi` `createRegistry` снимает выделение при уходе безусловно (`sample({ clock: lifecycle.pageClosed, target: grid.clearSelection })`), а фильтры и сортировку намеренно оставляет — то же поведение, что у стенда-эталона (спека `2026-09-28-katran-pi-app-design.md` §7.2). Полный сброс экрана — `sample({ clock: pageClosed, target: [filters.reset, grid.clearSelection] })`.

**Фича отдаёт факты, а не внутренности.** Публичный API фичи — UI, фасад `$$feature` и события-факты (`piAnnulled`), а не голый эффект, на `.done` которого подписывается страница. Иначе страница зависит от реализации фичи и не отличит «аннулировано» от «отменено пользователем».

```ts
// features/pi-annul/index.ts
export { AnnulButton } from './ui/annul-button'
export { piAnnulled, $$piAnnul } from './model/annul.model'
```

**Ресурс не живёт в странице только потому, что первым его запросил экран.** Поиск документов и контракт фильтра нужны реестру, дашборду и деталке — место им в `entities/<документ>/api`. В `pages/<экран>/api` — только запросы, которые больше никому не нужны.

**`shared/api` — только транспорт.** Если клиент начинает зеркалить сессию, подставлять пользователя или перенаправлять при 401, эта часть уезжает в `app` или `entities/session`.

## 5. Чек-лист ревью

- [ ] Нет импортов вверх по слоям и между соседними слайсами одного слоя.
- [ ] Импорт чужого слайса — только из его `index.ts`, без путей внутрь.
- [ ] В `shared` нет слов предметной области.
- [ ] `createGridModel`/`createFiltersModel` вызваны на верхнем уровне модуля модели, не в компоненте.
- [ ] Первый `refresh` — из события страницы, не разбросан по `useEffect`.
- [ ] Каждая реакция страницы на чужое событие загейчена признаком «экран открыт».
- [ ] Фичи экспортируют факты и фасад, а не эффекты и внутренние сторы.
- [ ] Поиск и контракт документа — в `entities`, а не в `pages`.
- [ ] Модели разбиты по ответственности, не на `stores/events/effects`.
- [ ] Нет пустых слоёв и сегментов.

## 6. Проверка инструментами

- [Steiger](https://github.com/feature-sliced/steiger) — линтер FSD: запрещённые импорты, публичные API, лишние сегменты. Запускать в CI рядом с eslint; отключать правило — только с комментарием в конфиге.
- Для effector — [`eslint-plugin-effector`](https://eslint.effector.dev): именование `$store`/`Fx`, `sample` вместо устаревших операторов.
- Алиасы путей (`@/entities/...`) настраиваются одинаково в `tsconfig` и в webpack remote, иначе линтер и сборка видят разное.

## Что сознательно не взято из источника

Размещение Farfetched-запросов и барьеров, Atomic Router, адаптеры Next.js (`_app`/`_pages`, `index.server.ts`), SSR, `Scope` и SID-плагин. У нас этого нет; если появится — смотреть первоисточник.
