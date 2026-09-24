# Состояние проекта katran

Обновлено: 2026-09-24 (вечер). Документ для человека, который проект не видел. Решения — со ссылками на спеку; хронологии здесь нет.

## 1. Назначение

Katran — самостоятельная дизайн-система (React + effector) для интерфейсов проекта: реестры документов, формы правки, дашборды. Источник вида и поведения — ванильный стенд `pi-constructor` (реестр валютных ПИ + деталка), прошедший дизайн-ревью; стенд замораживается по срезам в момент передачи в кит (§10). Спека: `docs/superpowers/specs/2026-09-23-katran-design.md`.

## 2. Стек и почему

- **Целевая среда (ответы команды 2026-09-24).** Приложение — remote в канальном метаприложении: хост на webpack 5 Module Federation, **React 17.0.2 и react-dom — shared singleton хоста**, то есть кит в рантайме исполняется на React 17. Effector хост шарит, команда использует свой 23.4. Webpack хоста `node_modules` не транспилирует; «ES5» — таргет только собственного кода команды (effector 23 в ES2015+ в проде работает), планка браузера — **Chromium 88**. Vite у команды — только локальный запуск, прод-сборка remote — webpack 5. Кит пока собран и проверен на React 19; перевод на диапазон React 17–19 и таргет `chrome88` — план «совместимость» (§9).
- **React 19 + effector 23** — стек разработки кита. Admiral не используется и не оборачивается: кит самостоятелен (спека 1.2).
- **pnpm-монорепо**: `packages/tokens`, `packages/ui`, `packages/effector`, `apps/demo`. Границы слоёв проверяет eslint, не договорённость (спека 3.2, см. §3).
- **CSS Modules без рантайма**, имена `k-Component__part` (функция `generateScopedName`, строковый шаблон в Vite 8 давал `k-Provider-module__root`). CSS-in-JS отвергнут: ушёл вместе с Admiral, рантайм-стили на гриде лишние.
- **Токены из одного источника** `tokens.src.ts` → `tokens.css`/`tokens.ts`, CI проверяет `gen:check`. Плотность — умноженные размеры `calc(Npx * var(--k-density))`, а не `zoom`/`rem` на `<html>`: приложение встраивается в метаприложение через федерацию и не имеет права трогать корень документа (спека 3.4, 4.3).
- **Своё демо на Vite**, не Storybook: витрина для показа Заказчику без чужой оболочки (спека 10).
- **vitest + jsdom + Testing Library + jest-axe**; типы jest-axe — локальные шимы в `packages/ui/src/test/` (`@types/jest-axe` тянул `@types/jest` и ломал матчеры vitest).
- **Playwright** только для замера геометрии, вне `pnpm check` (в сети банка браузер может не скачаться). Замер идёт против production-сборки демо: dev-сервер скрывает дефекты сборки.

## 3. Архитектурные решения

- **Лейн и панель фильтров — один стор условий, не два механизма.** `createFiltersModel({ laneField })`: клик по лейну — условие `EQ` по полю лейна ставится сразу в применённые и в черновик панели (без «Применить»); `$lane` — не отдельное состояние, а производная `$conditions` (условие с другим оператором по тому же полю даёт `$lane = null`, чип в панели показывает его как есть). На стенде лейн и панель фильтровали раздельно — пользователь не видел целиком, что применено (спека 1e, §2–3).
- **Счётчики лейна — фасеты грида по фильтру без условия самого поля лейна.** `createGridModel({ facets: { field, fetchFx } })`: своя `attach`-копия эффекта на каждую смену `$filter` и на `refresh`/`retry`, устаревший ответ отбрасывается по тому же правилу, что у основного запроса; отказ запроса фасетов не трогает `$state` грида — счётчики вспомогательные, реестр без них работает (спека 1e, §4).
- **Типы фильтра живут в `@katran/ui`, не в `@katran/effector`.** `Scalar`, `Condition`, `Filter`, `FilterFieldType`, `FilterField`, `FilterMeta` — в `packages/ui/src/filters/types.ts`: панели фильтров эти типы нужны на месте, а `ui` не имеет права импортировать `effector` (§3.2 выше); `@katran/effector` реэкспортирует их — так же, как `Sort` и `Selection` (спека 1e, §2). Единственная точка breaking в API плана 3: импорт типов фильтра из `@katran/effector` продолжает работать через реэкспорт.
- **UI чистый, состояние в моделях, транспорт в приложении.** `@katran/ui` не знает об effector; `@katran/effector` — фабрики моделей без DOM и HTTP: приложение даёт `fetchFx: Effect<GridQuery, GridPage>` (спека 2, 8.2). Хуки `useGrid`/`useFilters` — единственное место встречи (спека 8.4).
- **Граница слоёв проверяется линтом** (`eslint.config.js`, спека 3.2): `import-x/no-restricted-paths` — ui не импортирует effector; `no-restricted-imports` — `effector`/`effector-react` только в `packages/effector` и демо; в `packages/effector/src` — `@typescript-eslint/no-restricted-imports` (из `@katran/ui` только `import type`, подпути запрещены) и `no-restricted-globals` (`document`, `window`). `localStorage` разрешён — им пользуется persist-адаптер.
- **Токены темы и плотности объявляются под `:root, [data-theme="light"]` и `:root, [data-k-root]`**, не только в `:root`: `var()` внутри custom property резолвится в месте объявления, иначе переопределение на корне провайдера не действует (спека 4.2–4.3; оба дефекта найдены только в браузере).
- **`@katran/ui` объявляет `sideEffects: ["**/*.css", "./src/index.ts"]`.** Вход пакета импортирует `tokens.css`; без `./src/index.ts` в списке бандлер считает вход чистым и production-сборка потребителя выбрасывает токены (спека 3.4).
- **Один плавающий тултип на провайдер** через делегирование `data-k-tip`/`data-k-tip-if="truncated"`; Escape слушается на `document` в capture; удалённая цель убирает тултип (MutationObserver).
- **Popover/Menu** — портал в корень провайдера, Escape в capture с `stopPropagation` (на эталоне Esc из промта закрывал деталку).
- **Запись грида = `<tbody>`** из строки колонок и сквозных строк; сегменты адресуются по id колонок (`resolveSpans(spans, visibleOrder, fullOrder)`), скрытые колонки сжимают сегмент (спека 6.1–6.3). Первая колонка — служебная (чекбокс, открытие, номер), не входит в `layout.columns`.
- **Скелетон совпадает с записью по построению**: `lines: 1|2|3` задаёт и кламп (`--k-lines`), и скелетон, а высоту ячеек скелетона резервируют те же токены, что у записи (`lh-1 × lines`, служебная — `h-ctl-s`), не сами плашки `Skeleton.Line` (спека 6.1). Минимум показа 400 мс: пока скелетон удерживается, данные, пустое состояние и ошибка не показываются.
- **Клавиатура грида** — WAI-ARIA grid: один таб-стоп, стрелки по ячейкам и сквозным строкам, Enter — фокус на первый интерактив ячейки (единственный — клик), внутри ячейки Tab/Shift+Tab ходят по её элементам (ползунок ресайза — `role="slider"`), Escape — назад в ячейку. Интерактив внутри ячеек — `tabIndex={-1}`. События из портала поповера ячейкой не перехватываются: обработчик проверяет `cell.contains(e.target)` (спека 6.3).
- **ARIA-счёт строк абсолютный**: `aria-rowindex = 2 + ((page − 1) · pageSize + i) · perRecord`, `aria-rowcount = 1 + total · perRecord` (со строкой empty/error — не меньше 2). Скелетон скрыт от AT (`aria-hidden`), о загрузке говорит `aria-busy` на таблице. Ключи клавиатуры считаются внутри страницы, от `aria-rowindex` не зависят (спека 6.3).
- **Запись не кликабельна**, деталку открывает только кнопка; второй клик (`e.detail ≥ 2`) — `secondary` (второй drawer рядом).
- **Выделение** `{ mode: 'ids'; ids: string[] } | { mode: 'all'; except: string[] }` — массивы, не `Set` (JSON, сравнение пропов); «всё по фильтру» — серверный режим. Грид сообщает намерение (`onSelect`, `onSelectPage`), следующее состояние считает модель.
- **Модель грида принимает только ответ на текущий запрос**: своя копия `requestFx = attach({ effect: fetchFx })` — `pending` и ответы не смешиваются между гридами на одном `fetchFx`; `done`/`fail` принимаются, только если `params` совпадает с `$query`. Первый запрос делает приложение (`refresh()`), модель при создании в бек не ходит (спека 8.2).
- **`GridQuery.page` с нуля** (как у бека), `$page` модели — с единицы. `persist.load` синхронный (localStorage); серверный адаптер грузит настройки до создания модели.
- **Контраст палитры** проверяется тестами (`packages/tokens/src/contrast.rules.ts`): порог 4.0 только для `ok`/`warn` на своих подложках (вспышка), остальное 4.5; буква в `StatusDot` — только на тонах `flow/flowd/bad/badd/warn/ok`.

## 4. Соглашения

- Папка компонента: `Thing.tsx`, `Thing.module.css`, `Thing.test.tsx`, `index.ts`; локальные классы camelCase.
- В компонентном CSS нет голых `px` (кроме `border*`/`outline*`/`box-shadow`/`letter-spacing`), нет hex/rgba, custom properties только `--k-*` — stylelint падает.
- Опциональные пропы публичных типов — `?: T | undefined` (`exactOptionalPropertyTypes`).
- Интерактив — настоящие `<button>`/`<input>` с именем; `jsx-a11y` в линте, `axe` в тестах. Никаких `eslint-disable`/`stylelint-disable` — правило без исключений.
- Тесты под `renderK` ищут по ролям/атрибутам, не `container.firstElementChild` (это корень провайдера).
- Новые размеры — только через `tokens.src.ts` + `pnpm gen`, регенерация коммитится.
- Русский язык интерфейса, комментариев, коммитов. **Коммиты без трейлеров `Co-Authored-By` и подписей «Generated with»** — код пойдёт в закрытый контур.
- Планы исполняются субагентами (superpowers: subagent-driven-development): свежий исполнитель на задачу, ревью после каждой, финальное ревью ветки. Леджер решений — `.superpowers/sdd/<план>/progress.md` в worktree (git-ignored).

## 5. Карта проекта

```
packages/tokens/src   tokens.src.ts (источник) · generate.ts · tokens.css/.ts (генерируются) · contrast.* · fonts.css
packages/ui/src       provider/ (KatranProvider, useKatran, LiveRegion) · tooltip/ · button/ · input/ · value/ (CopyValue, LinkValue,
                      AccountValue, FieldTag, StatusDot, Tag, Counter) · overlay/ (Popover, Menu) · state/ (Skeleton, ProgressBar,
                      EmptyState, ErrorState, useLoadingGate) · pagination/ · tabs/ · grid/ (types, resolveSpans, sortRows, selection,
                      GridRecord, GridSkeleton, ColumnHeader, ColumnsMenu, useGridKeyboard, DataGrid со слотом toolbar) ·
                      filters/ (types — Condition/Filter/FilterMeta и др., opLabels — OP_LABEL/describeCondition, fieldOps —
                      fieldOp/draftOf/conditionFrom/isoDay*, внутренние, не экспортируются; StatusLane, FilterField, FilterPanel, BulkBar) · format/ · test/ (renderK, шимы)
packages/effector/src types.ts (Filter, GridQuery, GridPage, PersistAdapter, Facet, FacetsQuery — типы фильтра реэкспортированы из
                      `@katran/ui`) · persist.ts · createFiltersModel.ts (setLane, $lane, revert) · createGridModel.ts (facets, $facets)
                      · useGrid.ts (facets, onSelectAll, onClearSelection) · useFilters.ts (lane, setLane, revert, meta)
apps/demo/src         router.ts (хеш) · Shell.tsx (тема/плотность) · pages/* (Tokens, Grid «Валютные документы» (меню: «Реестр»), Buttons,
                      Inputs, Values, Overlays, States, Pagination, Tabs)
                      data/docs.ts (87 детерминированных документов, словари STATUS_LABEL/STATUS_TONE/DIRECTION_LABEL, docsFilterMeta —
                      каталог полей панели) · data/fakeBackend.ts (createFakeBackend → { searchFx, facetsFx }, задержка 0,25–0,65 с, ?slow=N)
apps/demo/e2e         geometry.spec.ts + playwright.config.ts — замер высот против production-сборки (`pnpm --filter demo e2e`)
eslint.config.js      правила границы слоёв (§3)
docs/superpowers      specs/ (основная спека · спека-дополнение среза 1e) · plans/ (план 1, план 2, план 2.1 «решения владельца»,
                      план 3 (срез 1e) исполнены)
.github/workflows     ci.yml (pnpm check) · pages.yml (демо → https://ivanklimenko.github.io/katran/)
```

## 6. Состояние

- **Репо:** github.com/ivanklimenko/katran, публичный с 24.09.2026 (решение владельца: демо на GitHub Pages, как у стенда `pi-constructor`; до этого был приватным и Pages падал); ревьюер `abugaets` приглашён (на 23.09 приглашение не принято). CI (`ci.yml`) зелёный на `main`.
- **`main` = планы 1, 2, 2.1 и 3.** План 1 (фундамент + примитивы, 15 задач, 81 тест) слит 2026-09-23; план 2 и план 2.1 (решения владельца) — 2026-09-24; план 3 (срез 1e) слит 2026-09-24 fast-forward из ветки `feat/slice1e-registry` (ветка на origin оставлена, worktree удалён).
- **План 2 исполнен целиком** (`docs/superpowers/plans/2026-09-23-katran-slice1-grid.md`, 14 задач, последний коммит `1ca7663`). Состав: `DataGrid` с семейством (типы, `resolveSpans`, `sortRows`, выделение, `ColumnHeader`, `ColumnsMenu`, клавиатура, скелетон), пакет `@katran/effector` (`createFiltersModel`, `createGridModel`, хуки, persist), демо «Реестр», Playwright-замер. Финальное ревью ветки (Opus) → фикс-волна из 6 коммитов → повторное ревью фикс-волны: замечаний нет. Документы (спека, план, CHANGELOG, README, этот файл) приведены к коду отдельным коммитом.
- **Проверки на `1ca7663`:** 160 тестов (tokens 12, ui 125, effector 23), `pnpm check` зелёный. **e2e после плана 2.1** (запись как на стенде, коридор 64–72): 3/3 — запись 68 px, шапка 49, скелетон 68, плотность 125 % → 84.75; стенд `pi-constructor` по замеру 24.09 — запись 68, шапка 48.
- **Открытые решения владельца:** нет — три вопроса от 24.09 (высота записи, Pages, буква StatusDot) решены и исполнены планом 2.1 (`docs/superpowers/plans/2026-09-24-katran-owner-decisions.md`).
- **План 3 исполнен целиком** (`.superpowers/sdd/2026-09-24-katran-slice1e-registry/`, срез 1e — 8 задач, последний коммит кода `bf50d42`, ветка `feat/slice1e-registry`, слита в `main` 2026-09-24). Состав: типы фильтра переехали в `@katran/ui`; `createFiltersModel` — `setLane`/`$lane`/`revert`; `createGridModel` — фасеты (`facets`/`$facets`); компоненты `StatusLane`, `FilterPanel` (simple), `BulkBar`; слот `toolbar` в `DataGrid`; боевой экран «Валютные документы» в демо на фейковом бэкенде с фасетами. Ревью — после каждой задачи (subagent-driven-development), фикс-раунды по замечаниям на задачах 1, 4, 5, 6; задачи 2, 3, 7 без замечаний. **Проверки на `bf50d42`:** 198 тестов (tokens 12, ui 154, effector 32), `pnpm check` зелёный. **e2e не менялся** (геометрия записи вне плана 3): 3/3 — запись 68, шапка 49, скелетон 68, 125 % → 84.75. Документы (спека-дополнение, CHANGELOG, README, этот файл) приведены к коду отдельным коммитом. **Итоговое ревью всей ветки проведено** (Opus: I1–I3, Minor 1–10); **фикс-волна — коммиты `0ac8401`..этот** (DATETIME очищается из полей, фокус после ✕/«Сбросить», «Выделение снято», тест лейн → `Select`, «-» стирается после «Сбросить», кольцо фокуса лейна, строгое `isOn`, экспорт помощников фильтров урезан, `toolbar` без залипания falsy, лейн без чисел до фасетов, точный `EQ` строк в демо, документы); остальное — техдолг §7. **Проверки после фикс-волны:** 203 теста (tokens 12, ui 159, effector 32), `pnpm check` зелёный, e2e 3/3 — запись 68, шапка 49, скелетон 68, 125 % → 84.75. Повторное ревью фикс-волны — чисто; слито в `main`, демо на Pages обновлено деплоем из `main`. Копия леджера плана 3 — `katran/.superpowers/sdd/2026-09-24-katran-slice1e-registry/` (git-ignored).

## 7. Техдолг (в план 4 или позже)

Из ревью плана 3:

- **`sameByValue<T>` вместо двух отдельных сравнений через `JSON.stringify`** — `sameQuery()` в `createGridModel.ts` и `same()` в `createFiltersModel.ts` делают одно и то же сравнение по значению; общий помощник заодно снял бы чувствительность к порядку ключей объекта.
- **Сравнение условий (`same()` в `createFiltersModel.ts`, `$dirty`) через `JSON.stringify`** — зависит от порядка ключей объекта-условия; на практике условия строятся одним и тем же путём (`conditionFrom`), но порядок не гарантирован типом.
- **`retry` в `createGridModel` перезапрашивает и фасеты**, даже если отказал только основной запрос (`sample({ clock: [refresh, retry], source: $facetsQuery, target: facetsFx })` не различает, что именно отказало) — лишний запрос, не баг: `$facets` от него не портится.
- **`Counter` в заголовке экрана (`h1`) визуально бледный на `paper`** — не проходил контрастный скрипт токенов, слабее, чем `Counter` в кнопках лейна/панели (см. также спека 1e, §9).
- **`formatDate` (`packages/ui/src/format/date.ts`) парсит через `new Date(iso)`** — зависит от часового пояса машины для строк без смещения; `describeCondition` (`opLabels.ts`) для чипов эту ловушку уже обходит регэкспом по строке, `formatDate` — нет.

Из финального ревью ветки плана 3 (вне фикс-волны):

- **Маска дат в чипе без календарной проверки** — `describeCondition` (`opLabels.ts`) переставляет части `YYYY-MM-DD` регэкспом и покажет «31.02.2026» как есть (по Ruling 3 — чип показывает строку бека, без `new Date()`).
- **Повторный одинаковый запрос фасетов при клике по лейну** — лейн меняет `$conditions`, а фасеты считаются по фильтру без условия поля лейна: запрос тот же, что и прошлый, но уходит снова (`createGridModel`, `sample({ clock: cfg.$filter, … target: facetsFx })`); нужна дедупликация по `$facetsQuery`.
- **Длинный STRING-чип** без `max-width`/многоточия/тултипа — строка чипов растягивается на длинном значении.
- **`isoDayEnd`/`isoDayStart` берут смещение зоны на полночь дня** (`fieldOps.ts`, `offsetOf`) — в день перехода на летнее время смещение в 23:59:59 другое; поправить и описать в JSDoc.
- **Пробелы тестов:** `FilterPanel` — BOOLEAN, пустая мета, поле без скалярного оператора (не показывается), DATETIME — только сценарий одной границы и очистки (фикс-волна); `BulkBar` — `n === total` (кнопки «Выбрать все» нет); `useGrid` — непустые `facets`; тест пустого слота `DataGrid` ищет обёртку по `[class*="toolbar"]` — хрупко.
- **`[data-zero]` перебивает `[data-active]` у `Counter`** — активный счётчик с нулём выглядит как неактивный.

Из финального ревью плана 2:

- **persist на каждый `pointermove`** при ресайзе колонки — для серверного адаптера нужен дебаунс или сохранение по `pointerup`.
- **`GridRecord` не мемоизирован** — при ресайзе перерисовываются все записи на каждый `pointermove`.
- **Sticky-обёртка полосы прогресса** занимает место в потоке и сдвигает таблицу на 3 px при `refreshing`.
- **`.filler { padding: 0 }` перебивается** более специфичным `.record > tr > td`.
- **`LEAD_WIDTH = 84` в `DataGrid.tsx` дублирует токен `grid-lead`** — JS считает ширину таблицы, CSS — ширину служебной колонки.
- **Публичный экспорт `@katran/ui` открывает внутренности грида** (`GridRecord`, `GridSkeleton`, `fillSegments`, `SpanCell`, `CellProps`, `ColumnHeader`, `ColumnsMenu`, `useGridKeyboard`) — урезать до первого semver-релиза.
- **Двойной клик по кнопке открытия** шлёт сначала `onOpen(row, { secondary: false })`, затем `true` — учесть в дизайне drawer-стека среза 2.
- **`refreshing` держится, пока жив устаревший запрос** — отмены запросов (AbortSignal) нет; данные при этом верные.
- **`same()`/`sameQuery()` через `JSON.stringify`** чувствительны к порядку ключей.
- **Таб-стоп в состояниях empty/error** стоит на шапке — поведение тестом не закреплено.
- **JSDoc на русском** у `createGridModel`, `GridModelConfig`, `useGrid`, `DataGridProps`.
- **`_ok` в `useGrid.ts`** — рантайм-остаток проверки типов; перенести в `*.test-d.ts` или `satisfies`.
- **Демо без регуляторов** для показа empty/error.
- **Поиск в `ColumnsMenu`** не сбрасывается при закрытии меню.
- **`Doc` → `Record<string, unknown>`** в фейковом бэкенде держится на нюансе TS (type alias без индекс-сигнатуры).
- **`persist.keep` не реализован** — набор сохраняемых полей фиксирован (спека 8.2).

Из плана 1 и раньше:

- **Потребители `@katran/ui` типизируются по исходникам** — нужен `css-modules.d.ts` в `include` (см. §8).
- **Общий `generateScopedName`** — дубль в `packages/ui/vite.config.ts` и `apps/demo/vite.config.ts`.
- `ThemeSwitch`/`DensitySwitch`, `useFlash`, вложенные поповеры, `Tabs`/`Menu` при всех disabled, тултип на `FieldTag` с клавиатуры.

## 8. Грабли

- **`var()` в custom property резолвится там, где объявлено.** Размеры и цвета темы дублируются под селектором корня провайдера — иначе плотность/`data-theme="light"` не работают. Правило в спеке 4.3.
- **`sideEffects` с одними CSS-глобами делает вход пакета «чистым»** — production-сборка потребителя выбрасывает импорт CSS из `src/index.ts`, в dev всё на месте. Вход с побочным эффектом перечисляется в `sideEffects` явно.
- **Синтетические события React всплывают через портал** к предку в React-дереве, а не в DOM: `keydown` из поповера приходит в обработчик ячейки. Обработчики ячейки обязаны проверять `cell.contains(e.target)`.
- **Плашки `Skeleton.Line` ниже строки текста** — высоту скелетона резервирует контейнер ячейки теми же токенами, что у записи, а не плашка.
- **`rAF` и таймеры в jsdom** — тесты минимума показа скелетона и ворот загрузки идут на фейковых таймерах (`vi.useFakeTimers`); в браузерных проверках скрытой вкладки ждать `setTimeout`, не `requestAnimationFrame`.
- **`generateScopedName` строкой** в Vite 8 даёт `k-Provider-module__root` — только функцией (скопирована в `ui` и `demo`; общий модуль — техдолг).
- **`@types/jest-axe`** подменяет глобальный `expect` типами jest → шимы в `packages/ui/src/test/`.
- **Потребители `@katran/ui` типизируются по исходникам** (`types: src/index.ts`) — `tsc` каждого потребителя тянет граф `ui/src` и нуждается в `../ui/src/css-modules.d.ts` в `include` (так у demo и effector). Переход на собранные типы — техдолг.
- **`container.firstElementChild` под `renderK`** — это корень провайдера, не компонент.
- **Haiku-исполнитель теряет `\u`-escape** (пишет литерал) — на таких брифах Sonnet.
- **`effector`: `.reset(ev)` откатывает к initial**, не к пустому — `.on(ev, () => [])`; публичные события — `EventCallable<T>`; редьюсеры `.on` объявлять раньше `sample`, читающего тот же стор; побочные эффекты в scope — через `createEffect` как target, не `.watch`; в тестах с перекрывающимися запросами `allSettled` ждёт все эффекты scope — промисы собирать заранее, запросы отпускать вручную.
- **`/Users/shaman/_CODE/VTB/.claude/launch.json` откатывается из `.bak`** — записи `katran-demo` (порт 5181, `--dir katran`) и `katran-grid` (5183, worktree) продублированы в `.bak`. Порт 5180 занят `vtb-filters-dev`.
- **500 в консоли демо при HMR** — Vite не находит импортированный, но ещё не созданный файл; после перезагрузки `failedResources` пуст.
- **jsx-a11y не моделирует фокусируемый separator** — ручка ресайза `role="slider"`.
- **`pages.yml` требует источник Pages «GitHub Actions»** (`build_type: workflow`, включено через API 24.09.2026) и публичный репозиторий на бесплатном плане; пока репо был приватным, деплой падал на старте. Второй капкан: `${{ … }}` внутри flow-словаря YAML (`environment: { name: …, url: ${{ … }} }`) GitHub не разбирает — прогон падает без джобов, а в его имени вместо `name:` стоит путь к файлу. Workflow — только блочным стилем. Деплой проверен 24.09: https://ivanklimenko.github.io/katran/ (запись 68 px, консоль чистая).

## 9. Следующий шаг

1. **План «совместимость»** — собрать в один план по итогам спайков 2026-09-24 и расхождений с эталоном:
   - **React 17–19.** Спайк `spike/react17` (локальная ветка, 6 коммитов поверх `28bd557`, не запушена): `useStableId` вместо `useId`, свой `renderHook` для RTL 12, защита от записи в стейт после размонтирования, правка `useRef` в провайдере, `peerDependencies react >=17`; 205/205 тестов на 17 и на 19, e2e 3/3, консоль чистая. Ловушка: `react/jsx-runtime` React 19 не рендерится на React 17 — remote и демо собирать с React 17. В план: перенос правок, CI-матрица 17/19, eslint-запрет API React 18+ в `ui`/`effector`.
   - **Встраивание.** Спайк `spike/federation` (локальная ветка от `spike/react17`, 6 коммитов, не запушена; макет — `spikes/federation/`, README там): цепочка кит → remote на webpack 5 → хост webpack 5 MF с React 17 работает, 21/21 проверка в dev и prod, консоль чистая, запись 68. Переносить в `main`: сборка `@katran/ui` под `chrome88` и classic JSX runtime (dist не импортирует `react/jsx-runtime`); dist + d.ts у `@katran/tokens` и `@katran/effector` (сейчас указывают на `.ts` — webpack не собирает); изоляция от глобальных стилей хоста (`box-sizing`, `td/th border`, типографика `button`, фокус ячеек только внутри `.table`); CI `check:target` (es-check + проверка CSS на Chromium 88); документ для потребителя. Рекомендуемый shared remote: react, react-dom, effector — `singleton`, `strictVersion`, `import: false` (брать у хоста) плюс ключ `effector/effector.mjs` с `shareKey: 'effector'` (иначе effector-react тянет вторую копию и ломает `$dirty`); `react/jsx-runtime` и effector-react не шарить, React 17 — в devDeps remote; CORS на сервере remote (шрифты). Открыто: точная версия effector хоста (ниже `requiredVersion` — экран не поднимется, хосту нужен ErrorBoundary); живой Chromium 88 не прогонялся (только статически); `KatranProvider` не принимает `className`/`style`.
   - **Расхождения реестра с эталоном** — `docs/reference/registry-drift.md` (§10): пункты классов A/B/D, решённые владельцем.
2. **Затем план 4, выбор за владельцем**: advanced-режим фильтров отдельным дизайн-заходом (спека 7.2 основной спеки: каталог полей с группами и поиском, модификатор оператора, наборы фильтров, OR) либо срез 2 (деталка, спека §5.2). Оба не блокируют друг друга — модель фильтров одна на оба режима (§7.1 основной спеки).

## 10. Эталон и заморозка по срезам

Решение владельца 2026-09-24 (спека §1, принцип 6). У стенда и кита разные задачи: стенд — быстрый цикл «показал пользователям → поправил» без ограничений среды; кит — код для прода с React 17, `chrome88`, федерацией, effector и a11y. Поэтому стенд не замораживается целиком и не живёт отдельно навсегда, а замораживается **по частям в момент передачи в кит**.

- **Точка передачи.** Когда срез начинают переносить, коммит стенда фиксируется как эталон среза (таблица ниже). Спека среза ссылается на этот коммит; e2e кита сверяет геометрию с ним.
- **После передачи** новое поведение этой части идёт только через кит: спека-дельта → модель effector → компонент → демо. На стенде эта часть получает только исправления. Витрина переданной части для пользователей — демо кита на Pages.
- **Непереданные части** стенд развивает свободно (сейчас — деталка).
- **Effector как критерий переноса.** Поведение, переезжающее со стенда, выражается моделью в `@katran/effector`, а не локальным состоянием компонента: на стенде состояние живёт в замыканиях (`SORT`, выбор деталки A/B, `f.hist`), в ките у каждого куска — модель. Нет модели — поведение не перенесено.
- **Сверка.** При заморозке части составляется список расхождений кита с эталоном (класс A — стенд ушёл вперёд после переноса; B — было на стенде, в срез не попало; C — кит отличается сознательно, со ссылкой на решение; D — дефект кита). Решённые пункты A/B/D идут в план; C фиксируются, чтобы их не «чинили».
- **Конец пути.** Когда в кит переедет деталка (срез 2), демо кита заменит стенд для пользователей, стенд уходит в архив.

| Часть стенда | Эталон (pi-constructor) | Срез кита | Расхождения |
|---|---|---|---|
| Валютный реестр (`grid.html`) | `887b37f`, 2026-09-24 16:15 | 1 (1a–1e) | `docs/reference/registry-drift.md` |
| Деталка валюты и рубля (`index.html`) | не заморожена — развивается на стенде | 2 | — |
| Рублёвый реестр (`rub-grid.html`) | не заморожен | отдельного среза нет (спека §1 — рублёвые реестры в области кита) | кратко — раздел «Рублёвый реестр» в `registry-drift.md` |
