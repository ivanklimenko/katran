# Срез «Стилизация на styled-components»: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** кит `@katran/ui`, `apps/pi`, `apps/demo` и макет федерации без единого CSS-файла стилей — на styled-components 5.3.11; вид, поведение и скорость грида (порог 15 %) прежние; выпуск `0.2.0`.

**Architecture:** токены остаются переменными `--k-*`, их объявляет styled-корень `KatranProvider`; в шаблоны они попадают ссылками из сгенерированного объекта `k` (`${k.paper}` → `var(--k-paper)`). Правило 1: все компоненты кита — styled-компоненты со статическими шаблонами (без функций). Правило 2: горячий путь грида (`value/`, запись и скелетон грида) — обычные элементы с классами `k-*`, стили один раз на провайдер через `createGlobalStyle`. Шрифты — файлы `woff2` в `@katran/tokens` и компонент `KatranFonts`.

**Tech Stack:** pnpm-монорепо, React 17.0.2 (CI ещё и React 19), styled-components 5.3.11, effector 23.4, Vite 8, Vitest 5 + jsdom + Testing Library 12, Playwright 1.63, eslint, stylelint + `postcss-styled-syntax`, webpack 5 (макет федерации).

**Spec:** `docs/superpowers/specs/2026-10-13-katran-styled-design.md` (утверждена владельцем 14.10.2026). Опыт — ветка `spike/styled`, коммит `cd9d70e`, worktree `katran/.worktrees/spike-styled`: сценарий замера `apps/pi/spike/measure.mjs` (+ `table.mjs`), проверка шрифтов `apps/pi/spike/fonts.mjs`, перенос горячего пути — `packages/ui/src/value/sc.tsx`, `packages/ui/src/grid/sc.tsx`, `packages/ui/src/spikeGlobal.tsx`.

## Global Constraints

- Предусловие: `main` содержит `175ce35` (спека). Работа — в worktree `katran/.worktrees/styled`, ветка `feat/styled` от `main`. Слияние в `main` и push — только по слову владельца.
- `styled-components` — ровно `5.3.11` в разработке; `peerDependencies` `@katran/ui`: `"styled-components": "^5.3.11"`; типы `@types/styled-components` `5.1.34`. `@katran/tokens` и `@katran/effector` от styled-components не зависят.
- Внутри `packages/ui/src` **в шаблонах styled нет функций** (ни от пропсов, ни от `theme`). Токены — только через `k` из `@katran/tokens`. Состояния — атрибутами (`data-*`, `aria-*`, `:disabled`); переменные значения — инлайновой CSS-переменной (как `--k-lines`).
- Горячий путь (правило 2) — ровно: `packages/ui/src/value/**`, `packages/ui/src/grid/GridRecord.tsx`, `packages/ui/src/grid/GridSkeleton.tsx` и порядковый номер `ord` в служебной ячейке `DataGrid.tsx`. В этих модулях нет `styled.*`; классы — `k-` + нынешнее локальное имя в kebab-case (`fieldMain` → `k-field-main`); стили — `:where([data-k-root]) .k-…`.
- Вид не меняется: эталонные снимки Task 0 совпадают пиксель в пиксель (`maxDiffPixels: 0`). Расхождение — дефект перевода, а не повод обновить эталон; обновлять эталон можно только с записью причины в леджер и согласия контроллера.
- Скорость: `pnpm --filter pi perf` (Task 0) против базы — каждый обязательный сценарий не хуже +15 %; для действий с базой короче 100 мс — по времени скриптов.
- Среда: **React 17.0.2**, **Chromium 88** (без `.at`, `Object.hasOwn`, `findLast`, `toSorted`, `structuredClone`, `replaceAll`, CSS `:has`, `inert`); `:where()` допустим.
- Правила стилей прежние и проверяются линтом: размеры только токенами (`px` лишь для `border*`, `outline*`, `box-shadow`, `letter-spacing`, `text-decoration-thickness`, `text-underline-offset`), без hex, именованных цветов, `rgb()`/`hsl()`; новые размеры и цвета — в `packages/tokens/src/tokens.src.ts` → `pnpm gen`.
- Хук для тестов в styled-части — атрибут `data-part="<имя>"` (конвенция уже есть: `data-part="scroll"` у `Drawer`); роли и подписи — предпочтительнее.
- Тесты: Testing Library 12, `user-event` 14, `jest-axe`; jsdom не видит `var()`, раскладку и контраст — это e2e. e2e — **только на переднем плане**; точечно `pnpm --filter pi exec playwright test e2e/<файл>`.
- Публичный репозиторий: никаких имён, адресов, названий репозиториев и папок хоста. Данные — вымышленные.
- Русский язык комментариев и коммитов; коммит — обычный `git commit -m "…"`, **без** `Co-Authored-By` и «Generated with».
- `pnpm check` зелёный на каждом коммите; `pnpm --filter pi e2e` и снимки — в конце каждой задачи переноса. Числа тестов — приращение к базе Task 0; факты — в леджер `.superpowers/sdd/2026-10-14-katran-styled/progress.md`.

## Сквозной контракт имён

| Где | Имя | Что |
|---|---|---|
| `@katran/tokens` | `k` | `{ readonly [ключ в camelCase]: 'var(--k-<имя>)' }` — все токены, включая `density`, `z*`, `t*` (`k.valSoft`, `k.sp1`, `k.zModal`, `k.tFast`, `k.density`) |
| `@katran/tokens` | `declarations` | `{ base: string; sizes: string; light: string; dark: string }` — тексты объявлений `--k-*: …;` без селекторов |
| `@katran/tokens/fonts` | `fontFaces`, `FontFaceSpec` | `FontFaceSpec = { family: 'IBM Plex Sans' \| 'IBM Plex Mono'; weight: 400 \| 500 \| 600 \| 700; unicodeRange: string; url: string }`; `fontFaces: readonly FontFaceSpec[]` (14 начертаний) |
| `@katran/ui` | `KatranFonts` | `() => JSX.Element` — `createGlobalStyle` с `@font-face` из `fontFaces`, `font-display: swap` |
| `@katran/ui` | тема | `KatranProvider` → `ThemeProvider theme={(outer) => ({ ...outer, katran: k })}`; `DefaultTheme` дополнен `katran: typeof k` |
| `packages/ui/src/provider` | `HotStyles` | `createGlobalStyle` горячего пути, монтирует `KatranProvider` |
| `packages/ui/src/value/value.hot.ts`, `grid/grid.hot.ts` | `valueHot`, `gridHot` | фрагменты `css` правил горячего пути (селекторы `.k-*` без префикса — префикс добавляет `HotStyles`) |
| стенд `apps/pi` | `?docs=N`, `?size=N`, `?noauto` | размер набора фейка (по умолчанию 87), начальный размер страницы реестра, без автооткрытия деталки |

## Review Focus

1. **Хост со своей темой styled-components.** Кит внутри чужого `ThemeProvider`: ключи темы хоста видны коду под `KatranProvider`, кит добавляет только `katran`. Тест — Task 2 («тема хоста сохраняется»), макет — Task 10.
2. **Два `KatranProvider` на странице** (два экрана команды): размонтирование одного не снимает стили горячего пути и переменные у другого. Тест — Task 5 («второй провайдер переживает первый»).
3. **Тема «системная» при тёмной ОС и вложенный `data-theme="light"`** (страница токенов демо): внутри секции светлая палитра. Тест — Task 2, снимок — Task 10.
4. **Вторая копия styled-components у хоста** (shared не настроен): кит выглядит так же, потому что не читает тему. Проверка — Task 10, вариант макета без shared.
5. **Переопределение потребителем через `styled(Компонент)`** — его правило побеждает правило кита той же специфичности, в том числе у компонентов горячего пути. Тест — Task 6 (табличный тест `className`), для горячего пути — Task 5.

---

## Порядок перевода модуля (для Task 5–10)

Один модуль `X.module.css` и его импортёры за раз:

1. Правила переносятся один к одному: селектор `.a` → компонент `A` (или `&`), `.a .b` → `& ${B}`; специфичность сохраняется; удвоенный класс → `&&`. `var(--k-x)` → `${k.x}`.
2. Классы-модификаторы → атрибуты (`data-*`, `aria-*`), их значения — в описании модуля в коммите.
3. Корень компонента принимает `className` (и прежние пропсы); строка в табличном тесте Task 6.
4. Тесты, читавшие классы, переходят на роли, подписи, `data-part`.
5. `X.module.css` удаляется вместе с импортом; `pnpm check` зелёный.

Конец задачи переноса: `pnpm check`, `pnpm --filter pi e2e`, `pnpm --filter pi visual`, `pnpm --filter demo visual` — всё зелёное.

---

### Task 0: Основание замеров — эталонные снимки, регуляторы стенда, инструмент скорости

**Files:**
- Create: `apps/pi/visual/registry.visual.ts`, `apps/pi/visual/detail.visual.ts`, `apps/pi/playwright.visual.config.ts`, `apps/demo/visual/pages.visual.ts`, `apps/demo/playwright.visual.config.ts`
- Create: `apps/pi/src/shared/lib/stand.ts`; Modify: `apps/pi/src/app/fake/params.ts`, `apps/pi/src/app/fake/grids.ts`, `apps/pi/src/widgets/doc-registry/lib/createRegistry.ts`, `apps/pi/src/pages/{fx-docs,rub-docs}/model/registry.model.ts`
- Create: `apps/pi/perf/measure.mjs`, `apps/pi/perf/build-base.sh`, `apps/pi/perf/README.md`
- Modify: `apps/pi/package.json`, `apps/demo/package.json` (скрипты `visual`, `perf`, `perf:base`), `.gitignore` (`apps/pi/perf/base/`, `apps/pi/perf/head/`)

**Interfaces:**
- Produces: `standParam(name: 'docs' | 'size' | 'noauto'): string | null` (`shared/lib/stand.ts`); `pnpm --filter pi visual`, `pnpm --filter demo visual` (сравнение с эталоном), `pnpm --filter pi perf:base <ref>`, `pnpm --filter pi perf` (код выхода 1 — порог нарушен).

- [ ] **Step 1: worktree и база.** `git worktree add .worktrees/styled -b feat/styled main`, `pnpm install`, `pnpm check`, `pnpm --filter pi e2e`; числа тестов и e2e — в леджер.
- [ ] **Step 2: тесты регуляторов.** В `apps/pi/src/shared/lib/stand.test.ts`: `standParam('docs')` при `?docs=500` → `'500'`; без параметра → `null`; `?noauto` → `''`. В тесте фейка: `?docs=500` даёт 500 валютных документов, без параметра — 87. В тесте модели реестра: при `?noauto` первая запись не открывается.
- [ ] **Step 3: прогнать — FAIL.** `pnpm --filter pi exec vitest run src/shared/lib/stand.test.ts` → нет модуля.
- [ ] **Step 4: реализовать регуляторы.** `standParam` читает `location.search`; фейк — `makeFxDocs(Number(standParam('docs')) || 87)` и так же рублёвые; `createRegistry` — `pageSize: cfg.pageSize ?? (Number(standParam('size')) || 20)`; автооткрытие в обоих `registry.model.ts` выключается при `standParam('noauto') !== null`. Описать три регулятора в шапке `params.ts`.
- [ ] **Step 5: прогнать — PASS**, `pnpm check`.
- [ ] **Step 6: эталонные снимки.** Конфиги — по образцу `apps/pi/playwright.config.ts` (preview-порт pi 5187, демо 5188), `expect.toHaveScreenshot: { maxDiffPixels: 0, animations: 'disabled', caret: 'hide' }`, ожидание `document.fonts.ready`, адрес `?slow=0`. Экраны pi: оба реестра (светлая, тёмная, плотность 125 %); валютный — запись выделенная, открытая в A и B, заблокированная, неактивная (наведение — отдельный снимок); деталка валютного и рублёвого документа — каждая вкладка, правка поля, плашка аннулирования, окно «Курс»; панель фильтров развёрнута, поповер периода, список `MultiSelect`, подсказки. Демо — каждая страница из `apps/demo/src/pages` в светлой и тёмной теме. Снимки — в git (`apps/*/visual/__screenshots__`).
- [ ] **Step 7: снять эталон.** `pnpm --filter pi exec playwright test -c playwright.visual.config.ts --update-snapshots`, то же для демо; повторный прогон без флага — PASS дважды подряд (снимки стабильны).
- [ ] **Step 8: инструмент скорости.** Перенести `apps/pi/spike/measure.mjs` и `table.mjs` из `spike/styled` в `apps/pi/perf/measure.mjs`: сравнивает две сборки (`perf/base`, `perf/head`), сценарии и порядок — как в опыте (8 кругов, 50 и 200 записей, ×1 и ×4, клики внутри страницы по простому селектору: `getByRole` с именем перебирает тысячи кнопок ячеек и сам добавляет ~1 с на действие), адрес `?slow=0&noauto&docs=500&size=N`; печатает таблицу и выходит с кодом 1, если обязательный сценарий хуже +15 % (полное время; для базы < 100 мс — время скриптов). `build-base.sh <ref>` собирает `apps/pi` из `<ref>` во временном worktree в `perf/base`. `pnpm --filter pi perf` собирает текущий `apps/pi` в `perf/head` и сравнивает.
- [ ] **Step 9: проверить инструмент на себе.** `pnpm --filter pi perf:base HEAD && pnpm --filter pi perf` → код 0, отличия в пределах шума.
- [ ] **Step 10: коммит.** «Основание среза: эталонные снимки pi и демо, регуляторы стенда ?docs ?size ?noauto, инструмент замера скорости».

### Task 1: Зависимость и токены для шаблонов

**Files:**
- Modify: `packages/tokens/src/generate.ts`, `packages/tokens/scripts/gen.ts`, `packages/tokens/src/index.ts`, `packages/tokens/src/generate.test.ts` (или новый)
- Create (генерируются): `packages/tokens/src/vars.ts`, `packages/tokens/src/declarations.ts`
- Modify: `packages/ui/package.json`, `apps/pi/package.json`, `apps/demo/package.json`, `pnpm-lock.yaml`, `package.json` (`gen:check` — новые файлы)

**Interfaces:**
- Produces: `k`, `declarations` (контракт имён); `renderVars(src: TokenSource): string`, `renderDeclarations(src: TokenSource): string` в `generate.ts`.

- [ ] **Step 1: тесты генератора.** `renderVars(source)` содержит `valSoft: 'var(--k-val-soft)'`, `sp1: 'var(--k-sp-1)'`, `density: 'var(--k-density)'`, `zModal: 'var(--k-z-modal)'`, `tFast: 'var(--k-t-fast)'`; каждый токен из `tokens.css` текущего `main` имеет ключ (сравнить множества имён). `renderDeclarations(source)`: `sizes` содержит `--k-sp-1: calc(4px * var(--k-density));` (значение — из `tokens.src.ts`), `dark` — `--k-paper: #161B26;`, `base` — `--k-density: 1;`.
- [ ] **Step 2: прогнать — FAIL.**
- [ ] **Step 3: реализовать** `renderVars`, `renderDeclarations`; `gen.ts` пишет `vars.ts`, `declarations.ts` (рядом пока остаётся `tokens.css` — его убирает Task 2); `index.ts` экспортирует `k`, `declarations`; `gen:check` проверяет и новые файлы.
- [ ] **Step 4: зависимость.** `@katran/ui`: `peerDependencies` `styled-components ^5.3.11`, `devDependencies` `styled-components 5.3.11`, `@types/styled-components 5.1.34`; `apps/pi`, `apps/demo` — `dependencies` `styled-components 5.3.11`. Vite-конфиги ui/pi/demo — без babel-плагина.
- [ ] **Step 5: PASS**, `pnpm check`, CI-сценарий React 19 локально: `node scripts/use-react.mjs 19 && pnpm install --no-frozen-lockfile && pnpm --filter @katran/ui --filter @katran/effector run test && pnpm --filter @katran/ui run build`, затем `git checkout -- . && pnpm install`.
- [ ] **Step 6: коммит.**

### Task 2: Корень провайдера на styled-components

**Files:**
- Modify: `packages/ui/src/provider/KatranProvider.tsx`, `packages/ui/src/index.ts` (убрать импорт `@katran/tokens/tokens.css`)
- Create: `packages/ui/src/provider/Root.tsx` (styled-корень), `packages/ui/src/provider/theme.ts` (дополнение `DefaultTheme`)
- Delete: `packages/ui/src/provider/Provider.module.css`, `packages/tokens/src/tokens.css`; Modify: `packages/tokens/package.json` (экспорт `./tokens.css` убрать), `packages/tokens/scripts/gen.ts`, `package.json` (`gen:check`, `check:target` — без `tokens.css`)
- Test: `packages/ui/src/provider/KatranProvider.test.tsx`

**Interfaces:**
- Consumes: `declarations`, `k` (Task 1).
- Produces: корень `[data-k-root]` объявляет все `--k-*`; тема `katran`.

- [ ] **Step 1: тесты.** (а) В `<style>` документа после рендера провайдера есть правило с `--k-paper: #FFFFFF` для корня и с `--k-paper: #161B26` для `[data-theme="dark"]`; (б) правило тёмной палитры под `@media (prefers-color-scheme: dark)` применяется к корню без `data-theme` и к потомку без `data-theme`, а потомок с `data-theme="light"` получает светлую палитру (проверка по тексту правил: селекторы `&[data-theme='light'], & [data-theme='light']` и т. п.); (в) **тема хоста сохраняется**: `<ThemeProvider theme={{ host: 'h' }}><KatranProvider><Probe/></KatranProvider></ThemeProvider>`, где `Probe` читает `useTheme()` → `{ host: 'h', katran: k }`; (г) без внешней темы `useTheme().katran === k`; (д) правило `box-sizing: content-box` для корня и потомков стоит в листе стилей раньше любого правила компонента (порядок групп).
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: реализовать.** `Root = styled.div` с объявлениями из `declarations` по схеме нынешнего `tokens.css`, но с `&` вместо `:root` (светлая — `&, &[data-theme='light'], & [data-theme='light']`; тёмная — `&[data-theme='dark'], & [data-theme='dark']`; системная — `@media (prefers-color-scheme: dark) { &:not([data-theme='light']) … }` с тем же правилом для потомков), плюс правила изоляции из `Provider.module.css` один к одному; `.live` → `data-part="live"` у `LiveRegion`. Корень определяется в модуле, который импортируется раньше модулей компонентов (порядок групп styled-components = порядок определения).
- [ ] **Step 4: PASS**, `pnpm check`, `pnpm --filter pi e2e` (особенно `isolation.spec.ts`), оба `visual` — совпадение.
- [ ] **Step 5: коммит.**

### Task 3: Шрифты без CSS-файла

**Files:**
- Create: `packages/tokens/fonts/*.woff2` (14 файлов, копируются `pnpm gen` из `@fontsource/ibm-plex-sans` и `@fontsource/ibm-plex-mono` — те же, что в нынешнем `fonts.css`; в git), `packages/tokens/src/fonts.ts` (генерируется: `fontFaces` с `unicode-range` из CSS `@fontsource` и `url: new URL('../fonts/<файл>', import.meta.url).href`)
- Create: `packages/ui/src/provider/KatranFonts.tsx`; Modify: `packages/ui/src/index.ts`
- Delete: `packages/tokens/src/fonts.css`; Modify: `packages/tokens/package.json` (экспорт `./fonts` → `dist/fonts.js` и `katran-source` → `src/fonts.ts`; `files` += `fonts`; `@fontsource/*` → `devDependencies`), `packages/tokens/vite.config.ts` (вход `fonts`; ресурсы не встраиваются)
- Modify: `apps/pi/src/app/App.tsx`, `apps/demo/src/App.tsx` (`<KatranFonts />`, импорт `fonts.css` убрать), `scripts/release-pack.mjs` (в тарболе `@katran/tokens` — 14 `fonts/*.woff2`), `scripts/check-install.mjs`
- Modify: `examples/federation/remote/src/*` (`KatranFonts` вместо `fonts.css`), `examples/federation/e2e/check.mjs`

**Interfaces:**
- Produces: `fontFaces`, `FontFaceSpec`, `KatranFonts` (контракт имён).

- [ ] **Step 1: тесты.** `fontFaces.length === 14`; у каждого `url` оканчивается на `.woff2`, `unicodeRange` непустой; кириллица Sans 400 — `unicodeRange` совпадает с файлом `@fontsource/ibm-plex-sans/cyrillic-400.css`. Рендер `<KatranFonts />` добавляет 14 правил `@font-face` с `font-display: swap`.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: реализовать** генерацию, `KatranFonts`, сборку `tokens` так, чтобы `dist/fonts.js` содержал `new URL('../fonts/…', import.meta.url)`, а не встроенные данные.
- [ ] **Step 4: проверка сборок (§3.3 спеки).** `grep -c "new URL" packages/tokens/dist/fonts.js` → 14; `pnpm release:pack && pnpm check:install` — `check:install` дополнен: проект рендерит `KatranFonts`, после `vite build` в `dist/assets` 14 файлов `.woff2`, а в браузере (Playwright) Vite dev и Vite build загружают шрифты: `document.fonts.check('600 12px "IBM Plex Sans"')` → `true`. Макет федерации (`examples/federation`, prod-вариант с `--cors`): `check.mjs` дополнен той же проверкой шрифта — PASS. **Если любая проверка не проходит — остановиться и вернуть владельцу вопрос о запасном пути (спека §4.5)**, не встраивая шрифты самостоятельно.
- [ ] **Step 5: PASS**, `pnpm check`, `visual` — совпадение.
- [ ] **Step 6: коммит.**

### Task 4: Проверки стилей для шаблонов

**Files:**
- Modify: `stylelint.config.js`, `package.json` (`lint` — глобы `.ts/.tsx`), `eslint.config.js`, `scripts/check-css-target.mjs`; `devDependencies` корня: `postcss-styled-syntax`
- Create: `scripts/fixtures/styled-bad.tsx.txt`, `scripts/fixtures/styled-bad-hot.tsx.txt` (образцы нарушений), `scripts/check-style-rules.mjs` (копирует образцы во временные файлы в `packages/ui/src` и `packages/ui/src/value`, запускает eslint, stylelint и `check-css-target` и падает, если хоть одно ожидаемое нарушение не найдено; временные файлы удаляет всегда)

**Interfaces:**
- Produces: `pnpm lint` проверяет шаблоны styled в `packages/ui/src`, `apps/*/src`, `examples/federation/remote/src`; `node scripts/check-css-target.mjs` без аргументов сканирует шаблоны там же.

- [ ] **Step 1: проверки-«красные».** Временный файл в `packages/ui/src` с шаблоном `styled.div\`width: 10px; color: #fff; :has(a) {}\`` и `styled.div\`color: ${(p) => p.c};\`` — `pnpm lint` должен дать: `unit-disallowed-list`, `color-no-hex`, ошибку eslint «функция в шаблоне styled»; `check-css-target` — `:has`. Временный файл в `packages/ui/src/value` с `import styled from 'styled-components'` — ошибка eslint «горячий путь без styled». Шаги — командами, файлы удаляются после проверки; эти же образцы — в `scripts/fixtures/`, `pnpm check` вызывает `node scripts/check-style-rules.mjs` (скрипт `check:rules`).
- [ ] **Step 2: FAIL** — нынешние конфиги этих нарушений не видят.
- [ ] **Step 3: реализовать.** stylelint: `overrides` для `**/*.{ts,tsx}` с `customSyntax: 'postcss-styled-syntax'`, те же правила; `selector-class-pattern` допускает и `k-[a-z0-9-]+` (горячий путь). eslint: `no-restricted-syntax` для `packages/ui/src/**` — `TaggedTemplateExpression > TemplateLiteral > :matches(ArrowFunctionExpression, FunctionExpression)`; для файлов горячего пути (Global Constraints) — запрет default-импорта из `styled-components`. `check-css-target`: без аргументов — разбор шаблонов `postcss-styled-syntax`, интерполяции заменяются на `var(--k-x)`; с аргументами — как раньше.
- [ ] **Step 4: PASS** — образцы ловятся, рабочий код чист; `pnpm check`.
- [ ] **Step 5: коммит.**

### Task 5: Горячий путь

**Files:**
- Modify: все `packages/ui/src/value/*.tsx`, `packages/ui/src/grid/GridRecord.tsx`, `packages/ui/src/grid/GridSkeleton.tsx`, `packages/ui/src/grid/DataGrid.tsx` (только `ord`), `packages/ui/src/provider/KatranProvider.tsx`
- Create: `packages/ui/src/value/value.hot.ts`, `packages/ui/src/grid/grid.hot.ts`, `packages/ui/src/provider/HotStyles.tsx`
- Delete: `packages/ui/src/value/Value.module.css`; из `Grid.module.css` — правила `record`, `selected`, `clamp`, `clampSkeleton`, `cell`, `lead`, `leadSkeleton`, `ord`, `spanEmpty`, `filler` и состояний записи (остальное — Task 7)
- Test: `packages/ui/src/value/Value.test.tsx`, `packages/ui/src/grid/GridRecord.test.tsx`, `packages/ui/src/grid/DataGrid.test.tsx`, `packages/ui/src/provider/HotStyles.test.tsx`; e2e `apps/pi/e2e/registry.spec.ts`, `filters.spec.ts`

**Interfaces:**
- Consumes: `k`; `Root` (Task 2); правила Task 4.
- Produces: классы `k-*` горячего пути; модификаторы: `tbody[data-selected]`, `CopyValue` — `data-tone`, `data-size="s"`, `data-flash`; `LinkValue` без значения — `:disabled`; `StatusDot` — `data-size`.

- [ ] **Step 1: тесты.** Перевести утверждения о классах в `Value.test.tsx` (`size="s"`, тон `muted`, точка размера `l`) и `GridRecord.test.tsx` / `DataGrid.test.tsx` (`selected`) на атрибуты выше. Новые в `HotStyles.test.tsx`: (а) после рендера провайдера в листе стилей есть `:where([data-k-root]) .k-copy`; (б) **второй провайдер переживает первый**: два провайдера, размонтировать первый — правило `.k-copy` в листе стилей остаётся; (в) переопределение горячего пути: `styled(CopyValue)\`color: rgb(1, 2, 3);\`` внутри провайдера → `getComputedStyle(button).color === 'rgb(1, 2, 3)'`.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: реализовать** по «Порядку перевода» и правилу 2: правила — из `Value.module.css` и записи `Grid.module.css` один к одному (готовый перенос части — `spike/styled`: `value/sc.tsx`, `grid/sc.tsx`, `spikeGlobal.tsx`); `HotStyles` монтируется в корне провайдера. e2e-селекторы `[class*="copy"]` продолжают работать (`k-copy`) — оставить.
- [ ] **Step 4: PASS**, `pnpm check`, `pnpm --filter pi e2e`, оба `visual`.
- [ ] **Step 5: промежуточный замер.** `pnpm --filter pi perf:base main && pnpm --filter pi perf` → код 0; таблица — в леджер. Код 1 — остановиться и разобрать (чек-бокс и кнопка открытия в служебной ячейке ещё на CSS Modules — их перевод в Task 6 тоже идёт в итоговый замер).
- [ ] **Step 6: коммит.**

### Task 6: Примитивы и поля

**Files:**
- Modify/Delete по «Порядку перевода»: `packages/ui/src/button/*`, `input/*`, `tag/*`, `select/*`, `date/*`, `form/*` (17 модулей CSS)
- Create: `packages/ui/src/test/className.test.tsx`
- Test: `Input.test.tsx`, `ButtonLink.test.tsx`, `ConfigForm.test.tsx`, `FieldRow.test.tsx`, `Disclosure.test.tsx`, `KeyValueList.test.tsx`; e2e `apps/pi/e2e/filters.spec.ts` (`[class*="fieldBox"]` → `data-part="field-box"`), `detail-edit.spec.ts`

**Interfaces:**
- Produces: табличный тест `className.test.tsx` — строка на компонент, Task 7–8 добавляют свои.

- [ ] **Step 1: табличный тест.** Для каждого экспортированного компонента этих семейств с корневым элементом: (а) `<X className="probe" …минимальные пропсы/>` → корень имеет класс `probe`; (б) `styled(X)\`color: rgb(1, 2, 3);\`` → `getComputedStyle(корень).color === 'rgb(1, 2, 3)'`. Перевести утверждения о классах в перечисленных тестах на роли/атрибуты.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: перевести модули** по «Порядку перевода»; `Checkbox` и `Button size="s"` — тоже в служебной ячейке грида, их шаблоны статические.
- [ ] **Step 4: PASS**, конец задачи переноса (check, e2e, visual).
- [ ] **Step 5: коммит** (можно по семейству — по коммиту на семейство).

### Task 7: Остальной грид и реестр

**Files:**
- Modify/Delete: остаток `packages/ui/src/grid/Grid.module.css` (таблица, заголовок, ресайз, `sortChips`, меню колонок, `dim`, `toolbar`), `filters/*` (4), `pagination/*`, `table/*`, `state/*` (5), `code/*`
- Test: `DataGrid.test.tsx` (`[class*="toolbar"]` → `data-part="toolbar"`), `StatusLane.test.tsx`, `MiniTable.test.tsx`, `CodeView.test.tsx`; e2e `registry.spec.ts` (`[class*="thSub"]` → `data-part="th-sub"`), `detail-ops.spec.ts` (`span[class]` в `CodeView` → `span[data-tok]` или иной явный атрибут подсветки); строки в `className.test.tsx`

- [ ] **Step 1: тесты** — перевод утверждений и новые строки табличного теста.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: перевести модули.** Таблица грида: правила `.table :where(td, th)` и фокус ячеек `.table td[tabindex]:focus-visible` — на styled-таблице с вложенными селекторами (ячейки — обычные элементы горячего пути).
- [ ] **Step 4: PASS**, конец задачи переноса.
- [ ] **Step 5: коммит.**

### Task 8: Наложения

**Files:**
- Modify/Delete: `packages/ui/src/overlay/*` (4), `tooltip/*`, `drawer/*` (2), `tabs/*`
- Test: тесты семейств; строки в `className.test.tsx`; e2e `detail*.spec.ts`, `lane-actions.spec.ts`

- [ ] **Step 1–4:** как Task 7: тесты → FAIL → перевод → PASS, конец задачи переноса. Слои (`--k-z-*`), подложки и анимации появления — через `k`; `Drawer` сохраняет `data-part="scroll"`.
- [ ] **Step 5: проверка «ни одного CSS в ките».** `find packages/ui/src -name "*.css"` → пусто; `grep -r "module.css" packages/ui/src` → пусто.
- [ ] **Step 6: коммит.**

### Task 9: `apps/pi`

**Files:**
- Modify/Delete: 13 модулей CSS `apps/pi/src/**` и их импортёры
- Test: `DocDetail.test.tsx`, `useAnnulOf.test.tsx`, `tabs1.test.tsx`, `ExtraTab.test.tsx`; e2e — все

- [ ] **Step 1–4:** как Task 7. Стиль — как в ките (статические шаблоны, `k`), styled-компоненты в файле компонента, имена частей с заглавной буквы (спека §8 п. 1). Свои элементы в ячейках (`entities/*/ui/cells`) — статические styled-компоненты (спека §4.7). `public/hostile.css` не трогать.
- [ ] **Step 5: итоговый замер приложения.** `pnpm --filter pi perf:base main && pnpm --filter pi perf` → код 0. Код 1 — свои элементы ячеек перевести на правило 2 (обычные элементы и один `createGlobalStyle` рядом с раскладкой колонок), повторить замер; итог — в леджер.
- [ ] **Step 6: коммит.**

### Task 10: `apps/demo` и макет федерации

**Files:**
- Modify/Delete: `apps/demo/src/Shell.module.css`, `apps/demo/src/pages/Page.module.css` и импортёры
- Modify: `examples/federation/remote/src/DocumentsScreen.module.css` → styled; `examples/federation/remote/webpack.config.js`, `examples/federation/host/webpack.config.js` (`styled-components` — shared singleton `^5.3.11`), `examples/federation/remote/package.json`, `examples/federation/host/src/bootstrap.js` (хост оборачивает remote в свой `ThemeProvider` с `{ hostMark: 'host' }`), `examples/federation/e2e/check.mjs`, `examples/federation/README.md`

- [ ] **Step 1: проверки макета.** В `check.mjs`: (а) элемент remote, читающий `theme.hostMark` под `KatranProvider`, показывает `host`; (б) запись грида той же высоты, что и в варианте без shared `styled-components` (переключатель варианта — как прочие в шапке `webpack.config.js`); (в) шрифт загружен (Task 3).
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: перевести** демо и remote макета; страница токенов демо — вложенные `data-theme` работают (Task 2).
- [ ] **Step 4: PASS:** `pnpm check`, `pnpm --filter demo visual`, макет — по `examples/federation/README.md` (dev и prod, `check.mjs` — все проверки), `sh scripts/matrix.sh`.
- [ ] **Step 5: коммит.**

### Task 11: Уборка, выпуск `0.2.0`, документы

**Files:**
- Delete: `packages/ui/src/css-modules.d.ts`; `generateScopedName` и `css.modules` в `packages/ui/vite.config.ts`, `apps/pi/vite.config.ts`, `apps/demo/vite.config.ts`; `classNameStrategy` в `vitest.config.ts` ui и pi; `include` с `css-modules.d.ts` в `tsconfig.json` effector/demo/pi
- Modify: `packages/ui/package.json` (экспорт `./styles.css` и `cssFileName` убрать, `sideEffects: false`), `packages/tokens/package.json` (`sideEffects: false`), версии трёх пакетов `0.2.0`; `package.json` (`lint` — без CSS-глобов, `check:target` — шаблоны вместо `dist/ui.css`); `scripts/release-pack.mjs` (в тарболе `ui` нет `.css`), `scripts/check-install.mjs` (ни одного импорта CSS; `styled-components` в зависимостях проекта)
- Modify: `docs/consuming.md` (подключение без CSS, `styled-components` в shared, CSP, `DefaultTheme`), `docs/guides/pi-usage.md` (правило ячеек и числа спеки §3.2), `README.md`, `apps/pi/README.md`, `CHANGELOG.md` (раздел `0.2.0`, breaking по спеке §4.6), `docs/STATE.md` (§2 — новое решение о стилизации со ссылкой на спеку; §5 карта; §8 грабли из леджера; §9), основная спека и спека совместимости — пометка «отменено спекой 2026-10-13» у решения о CSS Modules

- [ ] **Step 1: проверки «красные».** `find packages apps examples/federation/remote -name "*.css" -not -path "*/node_modules/*" -not -path "*/dist/*" -not -name hostile.css -not -name host.css` → сейчас непусто (по ходу задач уже пусто — тогда шаг подтверждает); `release-pack` падает, если в тарболе `ui` есть `.css` (добавить проверку, убедиться, что на старом манифесте она ловит `dist/ui.css`).
- [ ] **Step 2: уборка и манифесты.**
- [ ] **Step 3: полный прогон.** `pnpm check`, `pnpm release:pack`, `pnpm check:install`, `pnpm --filter pi e2e`, оба `visual`, макет федерации, CI-сценарий React 19 (как Task 1 Step 5).
- [ ] **Step 4: итоговый замер.** `pnpm --filter pi perf:base main && pnpm --filter pi perf` → код 0; таблица — в леджер и в `docs/STATE.md` §6.
- [ ] **Step 5: документы.**
- [ ] **Step 6: коммит.** Затем финальное ревью ветки; слияние — по слову владельца.
