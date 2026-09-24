# Состояние проекта katran

Обновлено: 2026-09-24. Документ для человека, который проект не видел. Решения — со ссылками на спеку; хронологии здесь нет.

## 1. Назначение

Katran — самостоятельная дизайн-система (React + effector) для интерфейсов проекта: реестры документов, формы правки, дашборды. Источник вида и поведения — замороженный ванильный стенд `pi-constructor` (реестр валютных ПИ + деталка), прошедший дизайн-ревью. Спека: `docs/superpowers/specs/2026-09-23-katran-design.md`.

## 2. Стек и почему

- **React 19 + effector 23** — целевой стек команды. Admiral не используется и не оборачивается: кит самостоятелен (спека 1.2).
- **pnpm-монорепо**: `packages/tokens`, `packages/ui`, `packages/effector`, `apps/demo`. Границы слоёв проверяет eslint, не договорённость (спека 3.2, см. §3).
- **CSS Modules без рантайма**, имена `k-Component__part` (функция `generateScopedName`, строковый шаблон в Vite 8 давал `k-Provider-module__root`). CSS-in-JS отвергнут: ушёл вместе с Admiral, рантайм-стили на гриде лишние.
- **Токены из одного источника** `tokens.src.ts` → `tokens.css`/`tokens.ts`, CI проверяет `gen:check`. Плотность — умноженные размеры `calc(Npx * var(--k-density))`, а не `zoom`/`rem` на `<html>`: приложение встраивается в метаприложение через федерацию и не имеет права трогать корень документа (спека 3.4, 4.3).
- **Своё демо на Vite**, не Storybook: витрина для показа Заказчику без чужой оболочки (спека 10).
- **vitest + jsdom + Testing Library + jest-axe**; типы jest-axe — локальные шимы в `packages/ui/src/test/` (`@types/jest-axe` тянул `@types/jest` и ломал матчеры vitest).
- **Playwright** только для замера геометрии, вне `pnpm check` (в сети банка браузер может не скачаться). Замер идёт против production-сборки демо: dev-сервер скрывает дефекты сборки.

## 3. Архитектурные решения

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
                      GridRecord, GridSkeleton, ColumnHeader, ColumnsMenu, useGridKeyboard, DataGrid) · format/ · test/ (renderK, шимы)
packages/effector/src types.ts (Filter, GridQuery, GridPage, PersistAdapter) · persist.ts · createFiltersModel.ts · createGridModel.ts
                      · useGrid.ts · useFilters.ts
apps/demo/src         router.ts (хеш) · Shell.tsx (тема/плотность) · pages/* (Tokens, Grid «Реестр», Buttons, Inputs, Values, Overlays, States, Pagination, Tabs)
                      data/docs.ts (87 детерминированных документов) · data/fakeBackend.ts (фильтр/сортировка/страница, задержка 0,25–0,65 с, ?slow=N)
apps/demo/e2e         geometry.spec.ts + playwright.config.ts — замер высот против production-сборки (`pnpm --filter demo e2e`)
eslint.config.js      правила границы слоёв (§3)
docs/superpowers      specs/ (спека) · plans/ (план 1 и план 2 исполнены)
.github/workflows     ci.yml (pnpm check) · pages.yml (демо → https://ivanklimenko.github.io/katran/)
```

## 6. Состояние

- **Репо:** github.com/ivanklimenko/katran, публичный с 24.09.2026 (решение владельца: демо на GitHub Pages, как у стенда `pi-constructor`; до этого был приватным и Pages падал); ревьюер `abugaets` приглашён (на 23.09 приглашение не принято). CI (`ci.yml`) зелёный на `main`.
- **`main` = план 1 + план 2.** План 1 (фундамент + примитивы, 15 задач, 81 тест) слит 2026-09-23; план 2 слит 2026-09-24 fast-forward из ветки `feat/slice1-grid` (все коммиты ветки на базе `7696740`; ветка на origin оставлена).
- **План 2 исполнен целиком** (`docs/superpowers/plans/2026-09-23-katran-slice1-grid.md`, 14 задач, последний коммит `1ca7663`). Состав: `DataGrid` с семейством (типы, `resolveSpans`, `sortRows`, выделение, `ColumnHeader`, `ColumnsMenu`, клавиатура, скелетон), пакет `@katran/effector` (`createFiltersModel`, `createGridModel`, хуки, persist), демо «Реестр», Playwright-замер. Финальное ревью ветки (Opus) → фикс-волна из 6 коммитов → повторное ревью фикс-волны: замечаний нет. Документы (спека, план, CHANGELOG, README, этот файл) приведены к коду отдельным коммитом.
- **Проверки на `1ca7663`:** 160 тестов (tokens 12, ui 125, effector 23), `pnpm check` зелёный. **e2e после плана 2.1** (запись как на стенде, коридор 64–72): 3/3 — запись 68 px, шапка 49, скелетон 68, плотность 125 % → 84.75; стенд `pi-constructor` по замеру 24.09 — запись 68, шапка 48.
- **Открытые решения владельца:** нет — три вопроса от 24.09 (высота записи, Pages, буква StatusDot) решены и исполнены планом 2.1 (`docs/superpowers/plans/2026-09-24-katran-owner-decisions.md`).

## 7. Техдолг (в план 3 или позже)

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
- **`pages.yml` требует источник Pages «GitHub Actions»** (`build_type: workflow`, включено через API 24.09.2026) и публичный репозиторий на бесплатном плане; пока репо был приватным, деплой падал на старте.

## 9. Следующий шаг

1. Ветка `feat/slice1-grid` слита в `main` и запушена 2026-09-24; worktree удалён. Копия леджера плана 2 (`progress.md` с 13 решениями контроллера, брифы и отчёты задач, находки финального ревью) лежит в `katran/.superpowers/sdd/2026-09-23-katran-slice1-grid/` (git-ignored); в спеку и этот файл перенесено всё, что нужно дальше.
2. План 3 — `StatusLane`, `FilterPanel` (режим simple), `BulkBar`, боевой экран реестра с фильтрами (срез 1e). Перед advanced-фильтрами — отдельный дизайн-заход с вариантами (спека 7.2).
