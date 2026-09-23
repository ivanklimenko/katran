# Состояние проекта katran

Обновлено: 2026-09-23 (передача сессии). Документ для человека, который проект не видел. Решения — со ссылками на спеку; хронологии здесь нет.

## 1. Назначение

Katran — самостоятельная дизайн-система (React + effector) для интерфейсов проекта: реестры документов, формы правки, дашборды. Источник вида и поведения — замороженный ванильный стенд `pi-constructor` (реестр валютных ПИ + деталка), прошедший дизайн-ревью. Спека: `docs/superpowers/specs/2026-09-23-katran-design.md`.

## 2. Стек и почему

- **React 19 + effector 23** — целевой стек команды. Admiral не используется и не оборачивается: кит самостоятелен (спека 1.2).
- **pnpm-монорепо**: `packages/tokens`, `packages/ui`, `packages/effector`, `apps/demo`. Границы слоёв проверяет eslint (`import-x/no-restricted-paths`), не договорённость (спека 3.2).
- **CSS Modules без рантайма**, имена `k-Component__part` (функция `generateScopedName`, строковый шаблон в Vite 8 давал `k-Provider-module__root`). CSS-in-JS отвергнут: ушёл вместе с Admiral, рантайм-стили на гриде лишние.
- **Токены из одного источника** `tokens.src.ts` → `tokens.css`/`tokens.ts`, CI проверяет `gen:check`. Плотность — умноженные размеры `calc(Npx * var(--k-density))`, а не `zoom`/`rem` на `<html>`: приложение встраивается в метаприложение через федерацию и не имеет права трогать корень документа (спека 3.4, 4.3).
- **Своё демо на Vite**, не Storybook: витрина для показа Заказчику без чужой оболочки (спека 10).
- **vitest + jsdom + Testing Library + jest-axe**; типы jest-axe — локальные шимы в `packages/ui/src/test/` (`@types/jest-axe` тянул `@types/jest` и ломал матчеры vitest).
- **Playwright** только для замера геометрии, вне `pnpm check` (в сети банка браузер может не скачаться).

## 3. Архитектурные решения

- **UI чистый, состояние в моделях, транспорт в приложении.** `@katran/ui` не знает об effector; `@katran/effector` — фабрики моделей без DOM и HTTP: приложение даёт `fetchFx: Effect<GridQuery, GridPage>` (спека 2, 8.2). Хуки `useGrid`/`useFilters` — единственное место встречи (спека 8.4).
- **Токены темы и плотности объявляются под `:root, [data-theme="light"]` и `:root, [data-k-root]`**, не только в `:root`: `var()` внутри custom property резолвится в месте объявления, иначе переопределение на корне провайдера не действует (спека 4.2–4.3; оба дефекта найдены только в браузере).
- **Один плавающий тултип на провайдер** через делегирование `data-k-tip`/`data-k-tip-if="truncated"`; Escape слушается на `document` в capture; удалённая цель убирает тултип (MutationObserver).
- **Popover/Menu** — портал в корень провайдера, Escape в capture с `stopPropagation` (на эталоне Esc из промта закрывал деталку).
- **Запись грида = `<tbody>`** из строки колонок и сквозных строк; сегменты адресуются по id колонок (`resolveSpans(spans, visibleOrder, fullOrder)`), скрытые колонки сжимают сегмент (спека 6.1–6.3). `lines: 1|2|3` у колонки задаёт и кламп (`--k-lines`), и скелетон — геометрия совпадает по построению.
- **Клавиатура грида** — WAI-ARIA grid: один таб-стоп, стрелки по ячейкам и сквозным строкам, Enter — клик по единственному интерактиву в ячейке, внутри ячейки Tab/Shift+Tab ходят по её элементам (ползунок ресайза — `role="slider"`), Escape — назад в ячейку. Интерактив внутри ячеек — `tabIndex={-1}`.
- **Запись не кликабельна**, деталку открывает только кнопка; второй клик (`e.detail ≥ 2`) — `secondary` (второй drawer рядом).
- **Выделение** `{ mode: 'ids'; ids: string[] } | { mode: 'all'; except: string[] }` — массивы, не `Set` (сторы effector, persist, сравнение пропов); «всё по фильтру» — серверный режим.
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
packages/effector/src types.ts (Filter, GridQuery, GridPage, persist) · persist.ts · createFiltersModel.ts · createGridModel.ts · useGrid.ts · useFilters.ts
apps/demo/src         router.ts (хеш) · Shell.tsx (тема/плотность) · pages/* (Tokens, Grid «Реестр», Buttons, Inputs, Values, Overlays, States, Pagination, Tabs)
                      data/docs.ts (87 детерминированных документов) · data/fakeBackend.ts (фильтр/сортировка/страница, ?slow=)
apps/demo/e2e         geometry.spec.ts + playwright.config.ts — замер высот (черновик задачи 14, см. §6)
docs/superpowers      specs/ (спека) · plans/ (план 1 исполнен, план 2 исполняется)
.github/workflows     ci.yml (pnpm check) · pages.yml (падает: Pages недоступен на приватном репо)
```

## 6. Состояние

- **Репо:** github.com/ivanklimenko/katran, приватный; ревьюер `abugaets` приглашён (на 23.09 приглашение не принято). CI (`ci.yml`) зелёный на `main`.
- **`main` = план 1** (фундамент + примитивы, 15 задач, финальное ревью и фикс-волна влиты): токены, провайдер, 20 компонентов, демо на 8 страниц. 81 тест.
- **Ветка `feat/slice1-grid` = план 2** (`docs/superpowers/plans/2026-09-23-katran-slice1-grid.md`), worktree `.worktrees/feat-slice1-grid`, база `7696740`. Задачи 1–13 закрыты и отревьюены (последний коммит `144309a`): типы и `resolveSpans`, `sortRows`, выделение, пакет effector с persist, `createFiltersModel`, `createGridModel`, стили/запись/скелетон, `ColumnHeader`, `ColumnsMenu`, `DataGrid`, клавиатура, хуки, демо «Реестр». 148 тестов, `pnpm check` зелёный. Демо-реестр проверен в браузере: высота записи 72 px, шапка 48.5, 125 % → ×1.247, сортировка/скрытие колонок/выделение/открытие/ползунок — работают.
- **Задача 14 (Playwright-замер) — незакоммиченный черновик** в worktree: `apps/demo/playwright.config.ts`, `apps/demo/e2e/geometry.spec.ts`, `apps/demo/package.json` (+`@playwright/test`, скрипт `e2e`), `pnpm-lock.yaml`; `apps/demo/test-results/` — артефакт прогона, добавлен в `.gitignore`. Исполнитель был прерван паузой на обновление Claude Desktop. Отчёта нет. Что делать: проверить `pnpm --filter demo e2e` (браузер chromium, вероятно, уже установлен — `test-results/` существует); если 3 теста зелёные — закоммитить как задачу 14 и отправить на ревью по брифу `.superpowers/sdd/2026-09-23-katran-slice1-grid/task-14-brief.md`; если нет — сверить числа с коридорами (запись 60–74, шапка 40–56, скелетон = запись ±2, 125 % = ×1.25 ±2) и не двигать коридоры.
- **После задачи 14:** финальное ревью всей ветки (самая сильная модель, вход — леджер `progress.md` с 7 решениями и отложенными minor), одна фикс-волна, docs-коммит (план 2: T8 роль `slider`, T10 тест `slider`, `--k-lines`; спека: 4 отклонения из шапки плана 2), слияние в `main`, push.
- **Открытые решения владельца:** Pages на приватном репо (сделать публичным / ручной запуск / оставить красным); буква `StatusDot` на светлых тонах (контраст 3.0–3.2).
- **Дальше:** план 3 — `StatusLane`, `FilterPanel` (режим simple), `BulkBar`, боевой экран реестра с фильтрами; перед advanced-фильтрами — отдельный дизайн-заход (спека 7.2). В план 3 или позже: `ThemeSwitch`/`DensitySwitch`, `useFlash`, общий `generateScopedName`, вложенные поповеры, `Tabs`/`Menu` при всех disabled, тултип на `FieldTag` с клавиатуры.

## 7. Грабли

- **`var()` в custom property резолвится там, где объявлено.** Размеры и цвета темы дублируются под селектором корня провайдера — иначе плотность/`data-theme="light"` не работают. Правило в спеке 4.3.
- **`generateScopedName` строкой** в Vite 8 даёт `k-Provider-module__root` — только функцией (скопирована в `ui` и `demo`; общий модуль — техдолг).
- **`@types/jest-axe`** подменяет глобальный `expect` типами jest → шимы в `packages/ui/src/test/`.
- **Потребители `@katran/ui` типизируются по исходникам** (`types: src/index.ts`) — `tsc` каждого потребителя тянет граф `ui/src` и нуждается в `../ui/src/css-modules.d.ts` в `include` (так у demo и effector). Переход на собранные типы — техдолг.
- **`rAF` в скрытой вкладке не срабатывает** — в браузерных проверках ждать `setTimeout`, не `requestAnimationFrame`.
- **`container.firstElementChild` под `renderK`** — это корень провайдера, не компонент.
- **Haiku-исполнитель теряет `\u`-escape** (пишет литерал) — на таких брифах Sonnet.
- **`effector`: `.reset(ev)` откатывает к initial**, не к пустому — `.on(ev, () => [])`; публичные события — `EventCallable<T>`; редьюсеры `.on` объявлять раньше `sample`, читающего тот же стор; побочные эффекты в scope — через `createEffect` как target, не `.watch`.
- **`/Users/shaman/_CODE/VTB/.claude/launch.json` откатывается из `.bak`** — записи `katran-demo` (порт 5181, `--dir katran`) и `katran-grid` (5183, worktree) продублированы в `.bak`. Порт 5180 занят `vtb-filters-dev`.
- **500 в консоли демо при HMR** — Vite не находит импортированный, но ещё не созданный файл; после перезагрузки `failedResources` пуст.
- **jsx-a11y не моделирует фокусируемый separator** — ручка ресайза `role="slider"`.
- **`pages.yml` падает на старте** — окружение `github-pages` недоступно на приватном репо бесплатного плана; `ci.yml` при этом зелёный.

## 8. Следующий шаг

Возобновить план 2 с задачи 14 в worktree `.worktrees/feat-slice1-grid`: `pnpm --filter demo e2e` → коммит → ревью → финальное ревью ветки → фикс-волна → docs → слияние в `main` → push. Инструкция и леджер: `.worktrees/feat-slice1-grid/.superpowers/sdd/2026-09-23-katran-slice1-grid/progress.md` (копия — в scratchpad прошлой сессии, если worktree утерян — история в git: ветка `feat/slice1-grid` запушена).
