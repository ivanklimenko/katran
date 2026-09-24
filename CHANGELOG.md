# Changelog

## 0.1.0 — в работе

- Срез 1, план 1: токены, провайдер, примитивы реестра, демо.
- Срез 1, план 2: `DataGrid` и семейство — типы контракта, `resolveSpans`, `sortRows`, помощники выделения, `ColumnHeader` (сортировка, ресайз), `ColumnsMenu` (состав колонок), клавиатура по паттерну WAI-ARIA grid (`useGridKeyboard`), скелетон той же геометрии; пакет `@katran/effector` — `createFiltersModel`, `createGridModel`, хуки `useGrid`/`useFilters`, persist-адаптеры `localStoragePersist`/`memoryPersist`; демо «Реестр» на 87 документах с фейковым бэкендом; Playwright-замер геометрии грида (`pnpm --filter demo e2e`, вне `pnpm check`); `@katran/ui` объявляет `sideEffects` входа — production-сборка потребителя не теряет `tokens.css`.
- Срез 1, план 2, после финального ревью: абсолютные `aria-rowindex` по выборке; `aria-busy` на таблице и `aria-hidden` у скелетона; минимум показа скелетона 400 мс соблюдается; модель грида принимает только ответ на текущий запрос (своя `attach`-копия `fetchFx`); `remove` в модели фильтров не затирает черновик; ползунок ширины колонки — `aria-orientation="horizontal"` и `aria-valuetext`; Tab в поповере ячейки не уводит фокус в ячейку; линт проверяет, что effector берёт из `@katran/ui` только типы и не обращается к `document`/`window`.
- Breaking: `GridSkeleton` больше не принимает `rowIndexStart` — скелетон скрыт от AT и индексов строк не несёт.
- План 2.1, решения владельца 24.09.2026: запись грида 68 px, как на стенде `pi-constructor` (вертикальный отступ записи — новый токен `grid-pad` = 6; коридор e2e записи 64–72); грид несёт фон `paper` на корне; наведение подсвечивает всю запись (`tbody`), а не одну строку.
