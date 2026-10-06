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

Пример реестра — по образцу `apps/pi` (реестр `entities/fx-doc`, виджеты `widgets/doc-registry` и `widgets/doc-detail`, фича `features/doc-edit` — правка документа в деталке, срез 2c; дерево сокращено до файлов, о которых речь):

```txt
src/
  entities/fx-doc/
    index.ts
    api/ports.ts             # fxDocPorts: searchFx, facetsFx, filterMetaFx, detailFx, tabFx; fxEditPorts — правка (2c)
    api/fxDoc.mapper.ts      # parseFxDoc: строка content[] → FxDoc
    model/fxDoc.ts           # тип записи FxDoc
    ui/layout.tsx            # fxDocLayout — раскладка колонок и рендер ячеек
    ui/cells.module.css      # классы ячеек (двойные классы .num.num — перебить стиль кита)
    model/rules.ts           # validateFxEdit, normalizeFxEdit, fxEditableTargets — правила правки (домен)
    ui/edit.tsx              # виды правки 20 исх, счетов, даты; formEdit для ConfigForm — по EditContext
  features/doc-edit/
    index.ts                 # createDocEdit, useEditContexts, editKey, editScope
    model/createDocEdit.ts   # createEditModel кита + порты saveEditFx/accountsFx; факты docEdited, conflict
    ui/useEditContexts.ts    # EditContext документа для деталки — из модели фичи
  widgets/doc-registry/
    index.ts
    lib/createRegistry.ts    # createFiltersModel + createGridModel + жизненный цикл экрана — раздел 3
    ui/DocRegistry.tsx
  widgets/doc-detail/
    lib/createDetail.ts      # стек A/B, загрузка, кэш; guard, leaveRequested/leave, replaceDetail, reloadDetail
    ui/DocDetail.tsx         # editOf: (docId) => EditContext — правку получает контекстом
  pages/fx-docs/
    index.ts
    model/registry.model.ts  # createPageLifecycle() + createRegistry(...) + createDetail({ guard: true })
    model/edit.model.ts      # createDocEdit(...) и связи фичи с деталкой и реестром
    ui/FxDocsPage.tsx        # editOf = useEditContexts(docEdit, …) → <DocDetail editOf={editOf} />
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

   По тому же образцу — реакция страницы на факт фичи (`apps/pi/src/pages/fx-docs/model/edit.model.ts`): правка сохранена — реестр перезапрашивается через `refreshRequested`, гейт «экран открыт» уже внутри виджета:

   ```ts
   // pages/fx-docs/model/edit.model.ts
   export const docEdit = createDocEdit({ ports: fxEditPorts, validate: validateFxEdit, normalize: normalizeFxEdit, same: sameEditValue, confirmTargets: FX_CONFIRM_TARGETS, lifecycle })
   sample({ clock: docEdit.docEdited, target: detail.replaceDetail })        // деталь из ответа — в кэш деталки
   sample({ clock: docEdit.docEdited, target: registry.refreshRequested })   // строка реестра могла измениться
   ```

   Если у виджета такого шва нет, гейт ставится на стороне страницы: `sample({ clock: fact, source: lifecycle.$opened, filter: Boolean, target: grid.refresh })`.

   Если после действия нужно обновить несколько экранов, это не реакции в каждой странице, а одна инвалидация в `app` или в сущности — каждый реестр слушает общее событие через свой `refreshRequested`.

2. Состояние моделей katran (фильтры, выделение, страница) переживает размонтирование экрана. Если при уходе с экрана оно должно сбрасываться — это решение экрана: в `apps/pi` `createRegistry` снимает выделение при уходе безусловно (`sample({ clock: lifecycle.pageClosed, target: grid.clearSelection })`), а фильтры и сортировку намеренно оставляет — то же поведение, что у стенда-эталона (спека `2026-09-28-katran-pi-app-design.md` §7.2). Полный сброс экрана — `sample({ clock: pageClosed, target: [filters.reset, grid.clearSelection] })`.

**Фича отдаёт факты, а не внутренности.** Публичный API фичи — фабрика или фасад, UI-связка и события-факты, а не голый эффект, на `.done` которого подписывается страница. Иначе страница зависит от реализации фичи и не отличит «сохранено» от «отказано» или «отменено пользователем». В `apps/pi` `createDocEdit` отдаёт факты `docEdited({ id, detail })` (бек принял правку) и `conflict({ id })` (`409`), а эффект сохранения — своя `attach`-копия порта внутри фичи, наружу не выходит:

```ts
// features/doc-edit/index.ts
export { CONFLICT_TEXT, DISCARD_VIEW, createDocEdit, editKey, editScope, type DocEdit, type DocEditConfig } from './model/createDocEdit'
export { useEditContexts } from './ui/useEditContexts'
```

**Виджет получает правку контекстом и фичу не импортирует.** Виджет (`widgets/doc-detail`) стоит выше фичи по слоям, но о конкретной фиче знать не должен — иначе деталка рубля, где правки нет, тянула бы правку валюты. Шов — тип в `shared/lib/detail`: `EditContext` (состояние редактора документа и команды `open`/`change`/`save`/`cancel`/`revert`) и `LeaveIntent`. Страница собирает контексты из модели фичи (`useEditContexts(docEdit, …)`) и передаёт виджету функцией `editOf: (docId) => EditContext`; виджет отдаёт контекст видам сущности (`renderHero`, `renderBlock`, `formEdit` домена). Обратная связь — тоже через страницу: виджет с `guard: true` сообщает `leaveRequested` о **любом** уходе из документа (×, Esc, замена документа в слоте, закрытие A при открытом B) — есть ли там правка и нужен ли вопрос, решает модель правки; страница пересылает запрос в модель фичи, а ответ модели (`leave`) — обратно в виджет. Без этой связи деталка с `guard: true` не закрывается вовсе. Так же в 2b вкладки получали `TabContext`. Правило держит линт: зона `widgets/doc-detail` ↛ `features` в `eslint.config.js` (`fsdZones`), рядом с `doc-detail` ↛ `entities`.

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
- [ ] Виджет не импортирует фичу: правка и действия приходят в него контекстом (тип в `shared`), связи — в модели страницы.
- [ ] Поиск и контракт документа — в `entities`, а не в `pages`.
- [ ] Модели разбиты по ответственности, не на `stores/events/effects`.
- [ ] Нет пустых слоёв и сегментов.

## 6. Проверка инструментами

- [Steiger](https://github.com/feature-sliced/steiger) — линтер FSD: запрещённые импорты, публичные API, лишние сегменты. Запускать в CI рядом с eslint; отключать правило — только с комментарием в конфиге.
- Для effector — [`eslint-plugin-effector`](https://eslint.effector.dev): именование `$store`/`Fx`, `sample` вместо устаревших операторов.
- Алиасы путей (`@/entities/...`) настраиваются одинаково в `tsconfig` и в webpack remote, иначе линтер и сборка видят разное.

## Что сознательно не взято из источника

Размещение Farfetched-запросов и барьеров, Atomic Router, адаптеры Next.js (`_app`/`_pages`, `index.server.ts`), SSR, `Scope` и SID-плагин. У нас этого нет; если появится — смотреть первоисточник.
