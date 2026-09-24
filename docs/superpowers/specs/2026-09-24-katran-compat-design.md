# katran: совместимость с метаприложением — дизайн

Дата: 2026-09-24. Дополнение к основной спеке `2026-09-23-katran-design.md` (binding). Основание — ответы команды владельца о хосте (24.09), спайки `spike/react17` и `spike/federation` (итоги — `docs/STATE.md` §9, макет — `spikes/federation/README.md` на ветке спайка) и быстрые дефекты из сверки с эталоном `docs/reference/registry-drift.md`.

## 1. Целевая среда

| Что | Значение |
|---|---|
| Встраивание | приложение команды — remote в канальном метаприложении; webpack 5, классический `webpack.container.ModuleFederationPlugin` |
| React в рантайме | **17.0.2**, `react` и `react-dom` — shared singleton хоста |
| effector | хост шарит effector **23.4**; команда — та же 23.4; effector-react хост не шарит |
| Транспиляция | webpack хоста и remote **не транспилирует `node_modules`**; кит приходит уже пониженным |
| Планка браузера | **Chromium 88** (синтаксис, рантайм-API, CSS) |
| Локальный запуск | Vite (только у разработчика); прод-сборка remote — webpack 5 |

## 2. Решения

### 2.1. React 17–19

- Кит поддерживает **React 17, 18, 19**: `peerDependencies` `react`/`react-dom` — `>=17`.
- Рабочее пространство (разработка, тесты, демо, Pages) — **на React 17.0.2**: прод работает на 17, а `react/jsx-runtime` React 19 элементы для React 17 не создаёт (ошибка React #31) — разработка на 19 при проде на 17 прячет такие дефекты.
- CI дополнительно гоняет пакеты кита на **React 19** (задача `react19`: переключение devDeps скриптом, тесты и сборка `tokens`/`ui`/`effector`). Демо в эту задачу не входит: `ReactDOM.render` в 19 удалён.
- API React 18+ в `packages/ui` и `packages/effector` **запрещены линтом**: `useId`, `useSyncExternalStore`, `useTransition`, `useDeferredValue`, `useInsertionEffect`, `startTransition`, `use`, `useOptimistic`, `useActionState`, `useFormStatus`, модуль `react-dom/client`. Совместимые замены живут в `packages/ui/src/compat/` (сейчас — `useStableId`: `React.useId`, если есть, иначе счётчик модуля с префиксом экземпляра).
- Тесты хуков — через свой `renderHook` на `render` (в RTL 12 `renderHook` нет, в 16 есть — свой одинаков в обоих).
- Компоненты не пишут в стейт после размонтирования (таймеры и кадры снимаются в очистке, после `await` — проверка «смонтирован»): React 17 в dev ругается на это в консоль.

### 2.2. Сборка и поставка

- `@katran/ui`, `@katran/tokens`, `@katran/effector` публикуются **собранными**: `dist` (ESM, один файл) + `d.ts`, `publishConfig` переключает `main`/`types`/`exports` на `dist`. В монорепо пакеты по-прежнему указывают на `src` (разработка без пересборки). `@katran/effector` перестаёт быть `private`.
- Таргет сборки — `chrome88` (`build.target` и `build.cssTarget`); без него Vite 8 собирает под `baseline-widely-available` (Chromium 107+).
- `@katran/ui` собирается с **classic JSX runtime**: элементы создаёт `createElement` того React, что пришёл из общего доступа хоста; `dist` не импортирует `react/jsx-runtime` (у React 17 нет поля `exports`, и webpack 5 в ESM-пакете не разрешает `react/jsx-runtime` без `.js`).
- Корневое поле `browserslist: ["chrome >= 88"]` — единственный источник планки. Проверка `pnpm check:target` (входит в `pnpm check`): `es-check` по `dist` трёх пакетов (синтаксис и API новее планки) и `scripts/check-css-target.mjs` по CSS (`doiuse` + регулярки для того, чего нет в базе caniuse). Осознанное исключение — `accent-color` (Chromium 93): в 88 чекбокс системного цвета, разметка та же.

### 2.3. Изоляция от стилей хоста

Корень `KatranProvider` (`[data-k-root]`) — граница изоляции: геометрия под ним не зависит от глобальных стилей хоста.

- Модель коробки под корнем — `content-box` для всех элементов и псевдоэлементов (типичный сброс хоста `* { box-sizing: border-box }` сужал колонки и поля).
- **Исключение — ячейки грида: `border-box`** (`[data-k-root] .table :where(th, td)`). Ширина колонки в раскладке и в ползунке ресайза — это полная ширина ячейки с паддингом; раньше фактическая ширина была на 16 px больше заданной (сверка W2). Ширины колонок демо увеличены на 16, чтобы вид не изменился.
- Ячейки грида без рамок по умолчанию (`.table :where(td, th) { border: 0 }`) — глобальное `td, th { border }` хоста не протекает в запись.
- Контролы под корнем сбрасывают `text-transform` и `letter-spacing` (глобальная типографика `button` хоста).
- Фокус ячеек — только внутри `.table`: глобальный `td[tabindex]:focus-visible` красил бы таблицы хоста.
- Наружу кит выпускает только `--k-*` на `:root` и `@font-face` IBM Plex — это допустимо.
- Демо проверяет изоляцию режимом `?hostile`: подключается файл глобальных стилей «враждебного хоста», e2e сверяет геометрию записи и ширину колонки.

### 2.4. Контракт для remote команды

Документ `docs/consuming.md`: установка, импорт `@katran/tokens/fonts.css` и `@katran/ui/styles.css`, `KatranProvider` с `storageKey`, shared-конфиг, CORS для шрифтов, ErrorBoundary у хоста. Рекомендуемый shared (проверен макетом, 21/21):

```js
shared: {
  react:       { singleton: true, requiredVersion: '^17.0.2', strictVersion: true, import: false },
  'react-dom': { singleton: true, requiredVersion: '^17.0.2', strictVersion: true, import: false },
  effector:    { singleton: true, requiredVersion: '^23.4.0', strictVersion: true, import: false },
  // effector-react.mjs импортирует 'effector/effector.mjs' — без этого ключа на странице вторая копия effector
  'effector/effector.mjs': { singleton: true, shareKey: 'effector', requiredVersion: '^23.4.0', strictVersion: true, import: false },
  // react/jsx-runtime и effector-react — НЕ шарить; React 17 — в devDependencies remote
}
```

Макет цепочки переезжает из ветки спайка в `examples/federation/` (вне pnpm workspace, ставится npm) — воспроизводимая проверка для команды.

### 2.5. Быстрые дефекты из сверки (класс D и решённые мелочи)

| Сверка | Что | Решение |
|---|---|---|
| P1 | Тело панели фильтров видно и в свёрнутом виде (`.body { display: grid }` перебивает `hidden`) | `.body[hidden] { display: none }` |
| T4 | Подзаголовок отсортированной колонки не синий | `.sorted .thSub { color: var(--k-val) }` |
| B3 | Shift+клик по кнопке открытия не даёт второй drawer | `secondary: e.detail >= 2 \|\| e.shiftKey` |
| B6 | У статусной точки нет тултипа — статус виден только цветом | `StatusDot` с `label` получает `data-k-tip={label}` |
| Z3 | В пустом состоянии нет пояснения | проп `emptyText` у `DataGrid` → `EmptyState.text` |
| W2 | Фактическая ширина колонки на 16 px больше заданной | §2.3, ячейки `border-box` |
| B5 | В демо строка «Открыт документ…» сдвигает грид, двойной клик промахивается | строка зарезервирована всегда |
| F1 | Дата документа в гриде | **«22.09.2026 07:33:22»** (решение владельца В5) — `formatDateTimeFull`; спека 5.1 уточняется |
| F2 | Дата валютирования сырым ISO | `formatDate`; `formatDate` разбирает `YYYY-MM-DD` без `new Date()` (дата без зоны не сдвигается часовым поясом) |
| F4 | Код валюты в рублёвом счёте 643 | 810 в знаках 6–8 (правило владельца) |
| F6 | «Невалидный» вместо INVALID | подпись `INVALID` |
| F7 | Направление в фильтре словами, в гриде кодом | в фильтре — коды IN/OUT/TRANSIT/OTHER |

Остальные пункты сверки (типографика T1–T3, колонки R1–R16, состояния записи B1, многоуровневая сортировка S1, раскладка «вместе/раздельно», вид лейна и фильтров) — план 5 «Реестр по эталону» со своей спекой-дельтой.

## 3. Проверки

- `pnpm check` (React 17) зелёный, включая `check:target`.
- CI: задача `check` (React 17) и задача `react19` (тесты и сборка пакетов кита на React 19).
- e2e демо (вне `pnpm check`): геометрия как раньше (запись 64–72, шапка 40–56, скелетон = запись ± 2, 125 % = ×1.25 ± 2) плюс новые: тело панели фильтров скрыто в свёрнутом виде; фактическая ширина колонки равна заданной; в режиме `?hostile` запись в коридоре и ширина колонки равна заданной.
- Макет `examples/federation/`: `node e2e/check.mjs` — 21/21 (руками, вне CI: нужен npm-реестр и браузер).
