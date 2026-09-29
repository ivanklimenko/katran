# Срез 2a «Деталка на просмотр» в `apps/pi`: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** деталка «Платёжная инструкция» открывается из обоих реестров `apps/pi` на просмотр: drawer A у правого края, drawer B слева от него для сравнения, шапка, лейн действий-заглушек, вкладки с переполнением, вкладка «Общие данные» валюты (MT103 / MT202 / MT202COV / MT199) и рубля (PAYDOCRU / REQDOCRU / PAYORDRU) по профилям стенда, порт детали и фейковый сервер.

**Architecture:** механизмы — в ките: `createDrawerStackModel` (`@katran/effector`), `Drawer`/`DrawerStack`, `Tabs` с `overflow`, `FieldRow`/`ConfigForm`/`Disclosure`, разведение жестов и метка открытых в `DataGrid` (`@katran/ui`). Домен — в `apps/pi` по FSD: порт `detailFx` в `shared/api`, реестры полей, профили, мапперы и блоки — в `entities/fx-doc`, `entities/rub-doc` (проводки — в новой сущности `entities/posting`), общая сборка деталки — виджет `widgets/doc-detail` (модель `createDetail` поверх стека кита и загрузки по слоту, компонент `DocDetail`), связь с реестром — в модели страницы (`sample` из `registry.openRequested` в `detail.open`). Всё доменное виджет получает объектом `DetailDomain` (тип в `shared/lib/detail`) и сущностей не импортирует.

**Tech Stack:** pnpm-монорепо, React 17.0.2, effector 23.4, effector-react, Vite 8, Vitest 5 + jsdom + Testing Library 12 + jest-axe, Playwright 1.63, eslint (`import-x`, `jsx-a11y`, `react-hooks`), stylelint.

**Spec:** `docs/superpowers/specs/2026-09-29-katran-detail-view-design.md` (§7 — порядок задач 0–12). Основная спека — `docs/superpowers/specs/2026-09-23-katran-design.md` (§5.2), спека `apps/pi` — `docs/superpowers/specs/2026-09-28-katran-pi-app-design.md`. Эталон — стенд `/Users/shaman/_CODE/VTB/pi-constructor` (`index.html`, `grid.html`, `rub-grid.html`), коммит фиксирует Task 1.

## Global Constraints

- Предусловие: план `apps/pi` слит в `main` (коммит слияния `00398d0`), `pnpm check` зелёный (Task 0).
- Среда внутри: **React 17.0.2** (shared singleton хоста), effector 23.4, **Chromium 88**. Во всём коде (кит и `apps/pi`): legacy `render` из `react-dom`, без `createRoot`, `useId`, `useSyncExternalStore` и прочих API React 18+ (замена `useId` — `useStableId`, `packages/ui/src/compat/useStableId.ts`); без `.at`, `Object.hasOwn`, `findLast`, `toSorted`, `structuredClone`, CSS `:has`, `inert`, `dialog.showModal`. `ResizeObserver` в Chromium 88 есть (с 64), в jsdom — нет: код проверяет `typeof ResizeObserver !== 'undefined'`.
- Тесты: `@testing-library/react` 12 + `@testing-library/dom` 8, `@testing-library/user-event` 14, `jest-axe`; `renderHook` — локальный (`packages/ui/src/test/renderHook.tsx`, `packages/effector/src/test/renderHook.tsx`). Фейковые таймеры — `vi.useFakeTimers()` / `vi.advanceTimersByTime()` внутри `act`.
- jsdom не видит каскад CSS-модулей, раскладку и контраст: геометрия, ширины и цвета — только e2e в Chromium; в jsdom ширины подменяются заглушками.
- CSS — только `var(--k-*)`; голые `px` только в `border*`/`outline*`/`box-shadow`/`letter-spacing`; без hex/rgba/named-цветов. Новые размеры — токенами в `packages/tokens/src/tokens.src.ts`, затем `pnpm gen` (коммитить `tokens.src.ts`, `tokens.css`, `tokens.ts`). Под корнем провайдера модель коробки `content-box`: блоки, чья ширина/высота сверяется с эталоном, задают `box-sizing: border-box` явно.
- Опциональные поля публичных типов — `?: T | undefined` (`exactOptionalPropertyTypes`).
- Импорты относительные, без алиасов. FSD-зоны eslint: слои только вниз; чужой слайс — только через `index.ts`; соседние сущности — только через свой файл `@x/<потребитель>.ts`; виджеты между собой не импортируются; `widgets/doc-detail` не импортирует `entities`. Никаких `eslint-disable` / `stylelint-disable`.
- Данные — только вымышленные; словари — с замороженного стенда (он обезличен). Никаких данных с фото прода.
- Русский язык интерфейса, комментариев, коммитов. Коммиты: `git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "…"`, **без** трейлеров `Co-Authored-By` и подписей «Generated with»; файлы добавлять поимённо (`git add <файлы>`, не `-A`).
- Порты: `apps/pi` dev — 5185, e2e preview — 5186, временный сервер стенда (Task 1) — 5187.
- e2e (`pnpm --filter pi e2e`, `playwright test`) — только на переднем плане, дождаться результата; в фоне не запускать.
- `pnpm check` зелёный после каждой задачи (документные задачи — минимум `pnpm lint`, но лучше целиком).

---

## Карта файлов

```txt
packages/tokens/src/tokens.src.ts · tokens.css · tokens.ts · generate.test.ts      — Task 3, 4, 5, 6 (новые токены)
packages/effector/src/
  createDrawerStackModel.ts · createDrawerStackModel.test.ts · index.ts          — Task 2
packages/ui/src/
  drawer/ Drawer.tsx · DrawerStack.tsx · Drawer.module.css · Drawer.test.tsx · index.ts   — Task 3
  tabs/   Tabs.tsx · Tabs.module.css · fitTabs.ts · fitTabs.test.ts · Tabs.overflow.test.tsx · index.ts — Task 4
  form/   types.ts · present.ts · FieldRow.tsx · ConfigForm.tsx · Disclosure.tsx · Form.module.css
          FieldRow.test.tsx · ConfigForm.test.tsx · Disclosure.test.tsx · index.ts            — Task 5
  grid/   DataGrid.tsx · GridRecord.tsx · Grid.module.css · focusTarget.ts · focusTarget.test.ts
          DataGrid.open.test.tsx · DataGrid.test.tsx · index.ts                              — Task 6
  index.ts                                                                                   — Task 3, 5
apps/pi/src/
  shared/api/ ports.ts · ports.test.ts · guards.ts · guards.test.ts · index.ts             — Task 7
  shared/lib/detail/ index.ts · types.ts                                                    — Task 7
  app/fake/ server.ts · grid.ts · params.ts · server.test.ts                                — Task 7
  entities/posting/ index.ts · @x/fx-doc.ts · @x/rub-doc.ts · model/posting.ts
                    api/posting.mapper.ts · api/posting.mapper.test.ts · ui/TxBlock.tsx · ui/posting.module.css — Task 8, 9
  entities/fx-doc/  model/detail.ts · model/swift.ts · model/swift.test.ts · api/detail.mapper.ts
                    api/detail.example.ts · api/detail.mapper.test.ts · api/ports.ts
                    ui/detail.tsx · ui/detail.module.css · ui/detail.test.tsx · index.ts       — Task 8
  entities/rub-doc/ model/detail.ts · model/profiles.ts · model/profiles.test.ts · api/detail.mapper.ts
                    api/detail.example.ts · api/detail.mapper.test.ts · api/ports.ts
                    ui/detail.tsx · ui/detail.module.css · ui/detail.test.tsx · index.ts       — Task 9
  app/fake/ fx-docs.detail.ts · rub-docs.detail.ts · grids.ts · contract.test.ts            — Task 8, 9
  widgets/doc-detail/ index.ts · lib/createDetail.ts · lib/createDetail.test.ts
                      ui/DocDetail.tsx · ui/DocDetail.module.css · ui/icons.tsx · ui/DocDetail.test.tsx — Task 10
  app/details.a11y.test.tsx                                                                 — Task 10
  widgets/doc-registry/ui/DocRegistry.tsx · DocRegistry.test.tsx                            — Task 6, 11
  pages/fx-docs/  model/registry.model.ts · ui/FxDocsPage.tsx                               — Task 11
  pages/rub-docs/ model/registry.model.ts · ui/RubDocsPage.tsx                              — Task 11
apps/pi/e2e/detail.spec.ts                                                                  — Task 11
apps/pi/e2e-stand/ playwright.config.ts · stand.spec.ts        (временно, удаляются в Task 1)
docs/reference/detail-drift.md (новый) · docs/STATE.md                                      — Task 1, 12
docs/reference/pi-api.md · docs/guides/pi-usage.md · apps/pi/README.md · CHANGELOG.md
docs/superpowers/specs/2026-09-23-katran-design.md · docs/superpowers/specs/2026-09-28-katran-pi-app-design.md — Task 12
```

---

### Task 0: Проверка предусловий

**Files:** только чтение.

- [ ] **Step 1: `apps/pi` в `main`.** `git log --oneline -5 main` — есть слияние `00398d0` «Слияние feat/pi-app…» и коммит спеки `3c089d4`. Иначе **остановиться**: этот план идёт после `apps/pi`.
- [ ] **Step 2: рабочая ветка.** Работа — в ветке `feat/detail-view` от `main` (worktree `katran/.worktrees/detail-view`, если контроллер так решил). В основной checkout не коммитить.
- [ ] **Step 3: `pnpm install && pnpm check`** — зелёный. Записать в леджер число тестов (`pnpm test` — сумма по пакетам) и прогнать `pnpm --filter pi e2e` на переднем плане — 26/26. Иначе остановиться.
- [ ] **Step 4: сверка имён, на которые опирается план.** Открыть и убедиться, что совпадает (если нет — записать в леджер фактическое имя и использовать его во всех задачах):
  - `packages/ui/src/tabs/Tabs.tsx` — `TabItem = { id; label; count?; disabled? }`, проп `orientation`, экспорт `tabId`, `panelId`;
  - `packages/ui/src/overlay/Menu.tsx` — `MenuItem.hint`, `MenuItem.disabled`, `MenuProps.title`; `Popover` ловит Escape на `document` в фазе захвата и вызывает `stopPropagation`;
  - `packages/ui/src/grid/DataGrid.tsx` — `onOpen(row, { secondary, state })`, `secondary: e.detail >= 2 || e.shiftKey`; `GridRecord` ставит `data-key`, `data-state` на `tbody`;
  - `packages/ui/src/value/useUnmountGuard.ts` — `useUnmountGuard(timer)` снимает таймер при размонтировании;
  - `packages/tokens/src/tokens.src.ts` — `z.drawer = 100`, `durations` без `drawer` и `open-delay`, `sizes['h-field'] = 23`;
  - `apps/pi/src/shared/api/ports.ts` — `createGridPorts({ gridId, parseRow })` без детали; `apps/pi/src/app/fake/server.ts` — `ROUTE` без `documents`;
  - `apps/pi/src/widgets/doc-registry/lib/createRegistry.ts` — `openRequested: EventCallable<{ id: string; secondary: boolean }>`.
- [ ] **Step 5: стенд.** `git -C /Users/shaman/_CODE/VTB/pi-constructor log --oneline -1` и `git -C /Users/shaman/_CODE/VTB/pi-constructor status --short` — рабочая копия чистая. Хеш — в леджер (Task 1 фиксирует его эталоном).

---

### Task 1: Заморозка деталки стенда, замер, `detail-drift.md`, вопросы B

**Files:**
- Modify: `docs/STATE.md` (§10, строка «Деталка валюты и рубля»)
- Create: `docs/reference/detail-drift.md`
- Create (временно, удаляются в этой же задаче): `apps/pi/e2e-stand/playwright.config.ts`, `apps/pi/e2e-stand/stand.spec.ts`

**Interfaces:**
- Produces: числа эталона `REF` для e2e Task 11 — ширина drawer, высота шапки, лейна, полосы вкладок, строки SWIFT-поля (валюта), строки таблицы сторон (рубль), положение B относительно A. Значения, прочитанные из CSS стенда при написании плана (Task 1 их подтверждает или заменяет): **drawer 800** (`.dw{width:800px}`), **шапка 44** (`.dh` 10 + кнопка 26 + 8), **лейн 36** (`.lane{height:36px}`), **полоса вкладок 32** (`.tabs span` 7 + 16.9 + 6 + 2), **строка SWIFT-поля 27** (`.cell{min-height:27px}`), **строка сторон рубля 23** (`.rpr{min-height:23px}`), **B вплотную слева от A**.
- Produces: список вопросов B владельцу `В-Д1…` — ответы нужны до Task 8 (В-Д1), Task 9 (В-Д2, В-Д3), Task 11 (В-Д4). Задачи кита (2–6), шва данных (7) и виджета (10) решений не ждут.

- [ ] **Step 1: зафиксировать эталон.** `git -C /Users/shaman/_CODE/VTB/pi-constructor log -1 --format='%h %ci'` — хеш и дата. В `docs/STATE.md` §10 в строке «Деталка валюты и рубля (`index.html`)» заменить «не заморожена — развивается на стенде» на `<хеш>, <дата время> (замер: …; Step 3)`, срез — «2 (2a–2d)», расхождения — «`docs/reference/detail-drift.md`». Абзац «**Непереданные части** стенд развивает свободно (сейчас — деталка)» заменить на «**Непереданных частей** больше нет: деталка заморожена целиком (срез 2a, решение владельца 29.09); до конца 2d стенд остаётся витриной для пользователей и получает только исправления».
- [ ] **Step 2: замер эталона.** Создать `apps/pi/e2e-stand/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

// Временный конфиг Task 1: замер замороженной деталки стенда. Удаляется в этой же задаче.
export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5187', viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 },
  webServer: {
    command: 'python3 -m http.server 5187 --directory /Users/shaman/_CODE/VTB/pi-constructor',
    url: 'http://localhost:5187/grid.html',
    reuseExistingServer: false,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
```

и `apps/pi/e2e-stand/stand.spec.ts`:

```ts
import { test, type Page } from '@playwright/test'

type Box = { x: number; w: number; h: number } | null
const box = async (page: Page, sel: string): Promise<Box> => {
  const b = await page.locator(sel).first().boundingBox()
  return b ? { x: Math.round(b.x * 10) / 10, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 } : null
}

for (const file of ['grid.html', 'rub-grid.html'] as const) {
  test(`замер деталки стенда (${file})`, async ({ page }) => {
    // масштаб стенда 100 % (ключ index.html:579), иначе на широком экране — 125 %
    await page.addInitScript(() => localStorage.setItem('pi-zoom', '1'))
    await page.goto(`/${file}`)
    // первая запись открывается в A при загрузке (grid.html:2192); анимация slidein — 180 мс
    await page.locator('#pair .dw').first().waitFor()
    await page.waitForTimeout(400)
    const one = {
      drawer: await box(page, '#pair .dw'),
      head: await box(page, '#pair .dw .dh'),
      lane: await box(page, '#pair .dw .lane'),
      tabs: await box(page, '#pair .dw .tabs'),
      hero: await box(page, '#pair .dw .hero'),
      field: await box(page, '#pair .dw .fg .cell:not(.null):not(.txt):not(.gap)'),
      fieldNull: await box(page, '#pair .dw .fg .cell.null'),
      partyRow: await box(page, '#pair .dw .rpr'),
      txRow: await box(page, '#pair .dw .tx'),
    }
    console.log(`STAND ${file} A: ${JSON.stringify(one)}`)
    // двойной клик по кнопке открытия второй записи — B рядом (grid.html:2165)
    await page.locator('[data-open="1"]').first().dblclick()
    await page.waitForTimeout(400)
    const both = await page.locator('#pair .dw').evaluateAll((els) =>
      els.map((e) => { const r = e.getBoundingClientRect(); return { slot: (e as HTMLElement).dataset.slot, x: r.x, w: r.width } }))
    console.log(`STAND ${file} A+B: ${JSON.stringify(both)}`)
    await page.screenshot({ path: test.info().outputPath(`stand-${file}.png`) })
  })
}
```

Run: `cd apps/pi && pnpm exec playwright test -c e2e-stand/playwright.config.ts --reporter=line`
Expected: две строки `STAND grid.html A: {...}` / `A+B: [...]` и две для `rub-grid.html`. У валютного: `drawer.w` = 800, `drawer.x` = 800; `head.h` ≈ 44; `lane.h` = 36; `tabs.h` ≈ 32; `field.h` = 27; в `A+B` B (`slot: "B"`) с `x` = 0, A с `x` = 800. У рублёвого вместо `field` — `partyRow.h` = 23. Скриншоты — в `apps/pi/test-results/…/stand-*.png` (для сверки в Task 11). Если число расходится с «Interfaces» больше чем на 1 px — записать фактическое, в Task 11 брать его (и токен в ките поправить задачей, где он вводится).
- [ ] **Step 3: записать замер.** В STATE §10 в строку деталки — «замер: drawer 800, шапка 44, лейн 36, вкладки 32, строка поля 27, строка сторон рубля 23, B вплотную слева от A, Chromium 1600×1000» (фактические числа Step 2). Удалить каталог `apps/pi/e2e-stand/` (`rm -r apps/pi/e2e-stand`), убедиться, что `git status` его не показывает.
- [ ] **Step 4: сверка — `docs/reference/detail-drift.md`.** Создать документ в формате `registry-drift.md`. Шапка — таблица «| | |» (Эталон — `pi-constructor`, `index.html` + хост `grid.html`/`rub-grid.html`, хеш Step 1; katran — `main` на момент сверки, хеш; Дата сверки; Метод — код `index.html` (FIELDS 597, PROFILES 625, TABS 647, TABS_RUB 723, ACTIONS 729–738, RFIELDS/RSECTIONS 689–722, `cell` 941, `gridHtml`/`textHtml`/`extraHtml` 993–1018, `txBlockHtml` 1023, `dhHtml`/`laneHtml`/`heroHtml` 1031–1065, `tabsHtml`/`fitTabs` 1082–1102, `rub*Html` 1111–1156, CSS `.dw` 77–300, 479–500), хост `grid.html:719–728` и `2151–2192`, Playwright-замер Step 2; «Замер эталона» — числа Step 2; «Вне объёма» — части 2b–2d по спеке §1.2, сверяются в начале своих подсрезов против того же хеша). Затем абзац «**Классы.** A/B/C/D» дословно по смыслу `registry-drift.md`. Затем «### Таблица сверки» `| № | Эталон | katran (план 2a) | Кл. | Решение | Где в ките | Объём |` — колонка «katran» описывает то, что даст этот план (кит ещё не написан). Начальное наполнение (проверить каждый пункт по коду стенда на хеше Step 1 и дописать найденное сверх списка — по шапке, лейну, вкладкам, «Общим» валюты и рубля, открытию/закрытию, Esc, фокусу):

| № | Эталон | katran (план 2a) | Кл. | Решение |
|---|---|---|---|---|
| Д1 | Клик и двойной клик разводит обработчик страницы реестра: 220 мс ожидания, `dblclick` отменяет (`grid.html:2165–2172`) | `DataGrid`: клик откладывается на 220 мс (токен `open-delay`) и отменяется вторым кликом; двойной — одно `onOpen(…secondary)`; Shift и клавиатура — сразу | C | Спека 2a §2, §3.1 |
| Д2 | Повторное открытие того же документа создаёт второй drawer с ним же | Документ, уже открытый в любом слоте, повторно не открывается — фокус в его drawer | C | Спека 2a §3.2, §5 |
| Д3 | Двойной клик при пустом A кладёт документ в B, A пуст | `secondary` при пустом A — в A | C | Спека 2a §3.2 |
| Д4 | Масштаб 100/110/125 % — CSS `zoom` на `<html>` | Плотность `KatranProvider`, отдельного переключателя в деталке нет | C | Спека 2a §1.2, основная спека 3.4 |
| Д5 | Действия лейна: печать — тост «формируется PDF», остальные без реакции | Все действия — заглушки с `announce`; печать — меню форм кита (`Menu`) | C | Спека 2a §1.1 |
| Д6 | Номера слотов действий (`.slot`, режим `show-slots`), горячие клавиши F5/E в подсказке | Горячие клавиши — только в подсказке; номера слотов не переносятся | C | Действия — 2d |
| Д7 | Заголовок: «Платёжная инструкция ВАЛЮТА» у валюты (`render`, 1369), «Платёжная инструкция» у рубля | «Платёжная инструкция» у обоих (спека 2a §1.1) | B | **В-Д1** |
| Д8 | Кнопка «Назад» в шапке; в хосте реестра скрыта (`#pair .dw .dh .back{display:none}`) | Нет | C | Как в хосте |
| Д9 | uuid — `mono` + кнопка «⧉» (копировать) | uuid — `LinkValue` кита (клик копирует, вспышка, `announce`) | C | Спека 2a §1.1 |
| Д10 | Тень drawer `-8px 0 28px rgba(…,.14)`, у B — `.1`; рамка слева | Общий токен `--k-shadow`, рамка слева `line` | C | Тени — токенами (спека 4.3) |
| Д11 | Метка слота: «A» — `paper` на `val`, «B · сравнение» — `paper` на `warn` | «A» — `paper` на `val`; «B · сравнение» — `ink2` на `warn-soft` | C | Контраст `paper`/`warn` ниже 4.5 для 10 px |
| Д12 | Статус в лейне — пилюля трёх семейств (`ok`/`bad`/`wait`) | `StatusDot` девяти тонов + подпись, как в реестре | C | Один словарь статусов (`doc-status`) |
| Д13 | Состояния проводок — цветной текст на мягком фоне | Точка `StatusDot` + текст `ink2` | C | Контраст |
| Д14 | Первая запись реестра открывается в A при загрузке страницы (`grid.html:2192`) | Реестр открывается без деталки | B | **В-Д4** |
| Д15 | «Курс» в сводке 32A, «Проверить баланс» в блоке транзакций — ссылки без действия | Не переносятся | C | Действия — 2d |
| Д16 | Карандаши правки, «✎ Изменить», аудит поля, правка даты валютирования, счетов Дт/Кт, 20 исх | Нет | C | 2c |
| Д17 | Вкладки кроме «Общих»: скелетон 700 мс и содержимое | Состояние «Вкладка «…» — будет в срезе 2b» | C | Спека 2a §1.1 |
| Д18 | Состав вкладок рубля (`TABS_RUB`, 723) — открытый вопрос стенда | Как на эталоне | B | **В-Д2** |
| Д19 | Пути ED107 (`AcctWithInst`, `PrevInstrAgent`), коды операций рубля | Как на эталоне | B | **В-Д3** |
| Д20 | Линия «видимая область 1080p ≈ 860 px» (`.fold`) | Нет (инструмент конструктора, в хосте скрыта) | C | — |
| Д21 | Шрифт drawer 12.5 / 1.35 | Токены кита `fs-1` 12.5 / `lh-1` 17 | C | Типографика токенами |
| Д22 | Переполнение вкладок считается один раз при рендере (`fitTabs`) | Пересчёт по `ResizeObserver` | C | — |
| Д23 | Esc — обработчик `document`, закрывает B, потом A; не в `.acced,.fe,input` | Esc — `DrawerStack`, фаза захвата; не в полях ввода, меню, списках, поповерах | C | Спека 2a §3.1 |
| Д24 | Высота строки SWIFT-поля — `min-height: 27px`; 23 px — строка таблицы сторон рубля (`.rpr`) | `FieldRow` — токен `field-row` 27; строка сторон — токен `party-row` 23 | — | Спека 2a §3.1 называла 23 для поля — уточнено замером |

  Раздел «### Замер эталона» — таблица чисел Step 2 (валюта, рубль, A+B) с селекторами. Раздел «### Вопросы владельцу» — все пункты класса B: **В-Д1** (заголовок валюты — «Платёжная инструкция» или «…ВАЛЮТА»; влияет на `FX_DETAIL_TITLE`, Task 8), **В-Д2** (состав вкладок рубля — как `TABS_RUB` стенда или иначе; Task 9), **В-Д3** (пути ED107 и коды операций рубля — как на стенде или по справочнику ЦБ; Task 9), **В-Д4** (открывать ли первую запись при входе на экран; Task 11). Раздел «### Не проверено» — что не удалось сверить.
- [ ] **Step 5: вопросы владельцу.** Список «Вопросы владельцу» передать контроллеру. **Остановиться только перед Task 8** (нужен ответ В-Д1), **Task 9** (В-Д2, В-Д3) и **Task 11** (В-Д4); Task 2–7 и 10 идут без ответов. Ответ «как на эталоне» по любому вопросу — пункт делается по колонке «Эталон».
- [ ] **Step 6: проверка и commit.** `pnpm lint` — зелёный (документы линт не трогает, но проверка обязательна после удаления `e2e-stand`).

```bash
git add docs/STATE.md docs/reference/detail-drift.md
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "Деталка стенда: эталон заморожен целиком, замер геометрии и сверка с планом 2a"
```

---
### Task 2: Кит — `createDrawerStackModel`

**Files:**
- Create: `packages/effector/src/createDrawerStackModel.ts`
- Test: `packages/effector/src/createDrawerStackModel.test.ts`
- Modify: `packages/effector/src/index.ts`, `CHANGELOG.md`

**Interfaces:**
- Produces (экспорт `@katran/effector`):

```ts
type DrawerSlot = 'a' | 'b'
type DrawerEntry = { id: string; tab: string }
type DrawerStackState = { a: DrawerEntry | null; b: DrawerEntry | null }
type DrawerStackConfig = { firstTab?: string | undefined }          // по умолчанию 'main'
type DrawerStackModel = {
  $stack: Store<DrawerStackState>
  $a: Store<DrawerEntry | null>
  $b: Store<DrawerEntry | null>
  $top: Store<DrawerSlot | null>
  open: EventCallable<{ id: string; secondary: boolean }>
  close: EventCallable<DrawerSlot>
  closeTop: EventCallable<void>
  closeAll: EventCallable<void>
  setTab: EventCallable<{ slot: DrawerSlot; tab: string }>
  opened: Event<{ id: string; slot: DrawerSlot }>
  alreadyOpen: Event<{ id: string; slot: DrawerSlot }>
}
createDrawerStackModel(cfg?: DrawerStackConfig): DrawerStackModel
```

  `closeAll` — сверх перечня спеки §3.2: нужен для «`pageClosed` закрывает оба слота» (спека §4.3) без двух событий подряд.
- Consumes: ничего нового.

- [ ] **Step 1: тесты (падают).** Создать `packages/effector/src/createDrawerStackModel.test.ts`:

```ts
import { allSettled, createStore, fork } from 'effector'
import { createDrawerStackModel, type DrawerSlot } from './createDrawerStackModel'

type Hit = { id: string; slot: DrawerSlot }

function setup(cfg?: Parameters<typeof createDrawerStackModel>[0]) {
  const m = createDrawerStackModel(cfg)
  // журналы событий — сторами: в fork-скоупе их читает getState
  const $opened = createStore<Hit[]>([]).on(m.opened, (l, x) => [...l, x])
  const $already = createStore<Hit[]>([]).on(m.alreadyOpen, (l, x) => [...l, x])
  const scope = fork()
  const open = (id: string, secondary = false) => allSettled(m.open, { scope, params: { id, secondary } })
  const ids = () => { const s = scope.getState(m.$stack); return { a: s.a?.id ?? null, b: s.b?.id ?? null } }
  return { m, scope, open, ids, opened: () => scope.getState($opened), already: () => scope.getState($already) }
}

describe('createDrawerStackModel (спека 2a §3.2)', () => {
  it('старт: оба слота пусты, верхнего нет', () => {
    const { m, scope, ids } = setup()
    expect(ids()).toEqual({ a: null, b: null })
    expect(scope.getState(m.$top)).toBeNull()
  })

  it('обычное открытие кладёт документ в A с первой вкладкой и сообщает слот', async () => {
    const { m, scope, open, opened } = setup()
    await open('d1')
    expect(scope.getState(m.$a)).toEqual({ id: 'd1', tab: 'main' })
    expect(scope.getState(m.$b)).toBeNull()
    expect(scope.getState(m.$top)).toBe('a')
    expect(opened()).toEqual([{ id: 'd1', slot: 'a' }])
  })

  it('обычное открытие заменяет A, B не трогает', async () => {
    const { open, ids } = setup()
    await open('d1')
    await open('d2', true)
    await open('d3')
    expect(ids()).toEqual({ a: 'd3', b: 'd2' })
  })

  it('secondary кладёт документ в B; при пустом A — в A', async () => {
    const { open, ids, opened } = setup()
    await open('d1', true)
    expect(ids()).toEqual({ a: 'd1', b: null })
    await open('d2', true)
    expect(ids()).toEqual({ a: 'd1', b: 'd2' })
    expect(opened()).toEqual([{ id: 'd1', slot: 'a' }, { id: 'd2', slot: 'b' }])
  })

  it('secondary при открытом B заменяет B', async () => {
    const { open, ids } = setup()
    await open('d1')
    await open('d2', true)
    await open('d3', true)
    expect(ids()).toEqual({ a: 'd1', b: 'd3' })
  })

  it('открытие уже открытого документа ничего не меняет и сообщает его слот', async () => {
    const { m, scope, open, ids, opened, already } = setup()
    await open('d1')
    await open('d2', true)
    await allSettled(m.setTab, { scope, params: { slot: 'a', tab: 'audit' } })
    await open('d1', true)
    await open('d2')
    expect(ids()).toEqual({ a: 'd1', b: 'd2' })
    expect(scope.getState(m.$a)?.tab).toBe('audit')
    expect(already()).toEqual([{ id: 'd1', slot: 'a' }, { id: 'd2', slot: 'b' }])
    expect(opened()).toHaveLength(2)
  })

  it("close('a') при открытом B сдвигает B в A вместе с вкладкой", async () => {
    const { m, scope, open, ids } = setup()
    await open('d1')
    await open('d2', true)
    await allSettled(m.setTab, { scope, params: { slot: 'b', tab: 'statuses' } })
    await allSettled(m.close, { scope, params: 'a' })
    expect(ids()).toEqual({ a: 'd2', b: null })
    expect(scope.getState(m.$a)?.tab).toBe('statuses')
  })

  it("close('b') закрывает только B; close('a') без B — пусто", async () => {
    const { m, scope, open, ids } = setup()
    await open('d1')
    await open('d2', true)
    await allSettled(m.close, { scope, params: 'b' })
    expect(ids()).toEqual({ a: 'd1', b: null })
    await allSettled(m.close, { scope, params: 'a' })
    expect(ids()).toEqual({ a: null, b: null })
  })

  it('closeTop закрывает B, если открыт, иначе A; на пустом — ничего', async () => {
    const { m, scope, open, ids } = setup()
    await allSettled(m.closeTop, { scope })
    expect(ids()).toEqual({ a: null, b: null })
    await open('d1')
    await open('d2', true)
    expect(scope.getState(m.$top)).toBe('b')
    await allSettled(m.closeTop, { scope })
    expect(ids()).toEqual({ a: 'd1', b: null })
    await allSettled(m.closeTop, { scope })
    expect(ids()).toEqual({ a: null, b: null })
  })

  it('closeAll закрывает оба', async () => {
    const { m, scope, open, ids } = setup()
    await open('d1')
    await open('d2', true)
    await allSettled(m.closeAll, { scope })
    expect(ids()).toEqual({ a: null, b: null })
  })

  it('setTab меняет вкладку слота; пустой слот не трогает', async () => {
    const { m, scope, open } = setup()
    await allSettled(m.setTab, { scope, params: { slot: 'b', tab: 'audit' } })
    expect(scope.getState(m.$b)).toBeNull()
    await open('d1')
    await allSettled(m.setTab, { scope, params: { slot: 'a', tab: 'audit' } })
    expect(scope.getState(m.$a)).toEqual({ id: 'd1', tab: 'audit' })
  })

  it('firstTab конфигурируется; повторное открытие после закрытия — снова первая вкладка', async () => {
    const { m, scope, open } = setup({ firstTab: 'general' })
    await open('d1')
    await allSettled(m.setTab, { scope, params: { slot: 'a', tab: 'audit' } })
    await allSettled(m.close, { scope, params: 'a' })
    await open('d1')
    expect(scope.getState(m.$a)).toEqual({ id: 'd1', tab: 'general' })
  })
})
```

- [ ] **Step 2: запуск.** `pnpm --filter @katran/effector test -- createDrawerStackModel` — FAIL: модуль не найден.
- [ ] **Step 3: реализация.** Создать `packages/effector/src/createDrawerStackModel.ts`:

```ts
import { createEvent, createStore, sample, type Event, type EventCallable, type Store } from 'effector'

/** Слот деталки: a — у правого края окна, b — слева от a, для сравнения (спека 2a §3.1–3.2). */
export type DrawerSlot = 'a' | 'b'
export type DrawerEntry = { id: string; tab: string }
export type DrawerStackState = { a: DrawerEntry | null; b: DrawerEntry | null }

export type DrawerStackConfig = {
  /** Вкладка только что открытого документа; по умолчанию 'main' («Общие данные»). */
  firstTab?: string | undefined
}

export type DrawerStackModel = {
  $stack: Store<DrawerStackState>
  $a: Store<DrawerEntry | null>
  $b: Store<DrawerEntry | null>
  /** Слот, который закроет closeTop (и Esc): b, если открыт, иначе a; null — оба пусты. */
  $top: Store<DrawerSlot | null>
  open: EventCallable<{ id: string; secondary: boolean }>
  close: EventCallable<DrawerSlot>
  closeTop: EventCallable<void>
  /** Закрыть оба слота — уход с экрана. */
  closeAll: EventCallable<void>
  setTab: EventCallable<{ slot: DrawerSlot; tab: string }>
  /** Документ впервые положен в слот — сигнал загрузки для потребителя (модель данных не знает). */
  opened: Event<{ id: string; slot: DrawerSlot }>
  /** Документ уже открыт: стек не меняется, слот сообщается для фокуса. */
  alreadyOpen: Event<{ id: string; slot: DrawerSlot }>
}

const EMPTY: DrawerStackState = { a: null, b: null }

const slotOf = (s: DrawerStackState, id: string): DrawerSlot | null => (s.a?.id === id ? 'a' : s.b?.id === id ? 'b' : null)

/** Обычное открытие заменяет A; secondary кладёт в B, а при пустом A — в A (эталон grid.html:2152–2189, уточнение спеки 2a §3.2). */
function place(s: DrawerStackState, id: string, secondary: boolean, tab: string): DrawerStackState {
  const entry = { id, tab }
  return secondary && s.a ? { a: s.a, b: entry } : { a: entry, b: s.b }
}

/** Закрытие A при открытом B сдвигает B в A — второй документ остаётся у правого края. */
function remove(s: DrawerStackState, slot: DrawerSlot): DrawerStackState {
  if (slot === 'b') return { a: s.a, b: null }
  return s.b ? { a: s.b, b: null } : EMPTY
}

/** Стек двух drawer'ов деталки: что где открыто и на какой вкладке. Загрузку данных модель не знает. */
export function createDrawerStackModel(cfg: DrawerStackConfig = {}): DrawerStackModel {
  const firstTab = cfg.firstTab ?? 'main'
  const open = createEvent<{ id: string; secondary: boolean }>()
  const close = createEvent<DrawerSlot>()
  const closeTop = createEvent<void>()
  const closeAll = createEvent<void>()
  const setTab = createEvent<{ slot: DrawerSlot; tab: string }>()
  const opened = createEvent<{ id: string; slot: DrawerSlot }>()
  const alreadyOpen = createEvent<{ id: string; slot: DrawerSlot }>()

  const $stack = createStore<DrawerStackState>(EMPTY)
  const $a = $stack.map((s) => s.a)
  const $b = $stack.map((s) => s.b)
  const $top = $stack.map((s): DrawerSlot | null => (s.b ? 'b' : s.a ? 'a' : null))

  sample({
    clock: open,
    source: $stack,
    filter: (s, p) => slotOf(s, p.id) !== null,
    fn: (s, p) => ({ id: p.id, slot: slotOf(s, p.id) ?? 'a' }),
    target: alreadyOpen,
  })
  const placed = sample({
    clock: open,
    source: $stack,
    filter: (s, p) => slotOf(s, p.id) === null,
    fn: (s, p) => ({ next: place(s, p.id, p.secondary, firstTab), id: p.id }),
  })
  $stack.on(placed, (_, x) => x.next)
  sample({ clock: placed, fn: ({ next, id }) => ({ id, slot: slotOf(next, id) ?? 'a' }), target: opened })

  $stack.on(close, (s, slot) => remove(s, slot))
  sample({ clock: closeTop, source: $top, filter: (top: DrawerSlot | null): top is DrawerSlot => top !== null, target: close })
  $stack.on(closeAll, () => EMPTY)
  $stack.on(setTab, (s, { slot, tab }) => {
    const e = s[slot]
    if (!e) return s
    return slot === 'a' ? { a: { ...e, tab }, b: s.b } : { a: s.a, b: { ...e, tab } }
  })

  return { $stack, $a, $b, $top, open, close, closeTop, closeAll, setTab, opened, alreadyOpen }
}
```

  В `packages/effector/src/index.ts` добавить строку:

```ts
export { createDrawerStackModel, type DrawerEntry, type DrawerSlot, type DrawerStackConfig, type DrawerStackModel, type DrawerStackState } from './createDrawerStackModel'
```

- [ ] **Step 4: запуск.** `pnpm --filter @katran/effector test` — PASS (все прежние + 12 новых). `pnpm check` — зелёный.
- [ ] **Step 5: CHANGELOG.** В `CHANGELOG.md` в конец списка «0.1.0 — в работе» добавить: «- Срез 2a: `createDrawerStackModel` в `@katran/effector` — стек двух drawer'ов деталки (A у правого края, B слева для сравнения): `open({ id, secondary })`, `close(slot)`, `closeTop`, `closeAll`, `setTab`, сигналы `opened`/`alreadyOpen`; правила эталона — обычное открытие заменяет A, `secondary` — в B (при пустом A — в A), повторное открытие открытого не меняет стек, закрытие A сдвигает B в A.»
- [ ] **Step 6: commit.**

```bash
git add packages/effector/src/createDrawerStackModel.ts packages/effector/src/createDrawerStackModel.test.ts packages/effector/src/index.ts CHANGELOG.md
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "effector: createDrawerStackModel — стек A/B деталки по правилам эталона"
```

---

### Task 3: Кит — `Drawer`, `DrawerStack`

**Files:**
- Create: `packages/ui/src/drawer/Drawer.tsx`, `packages/ui/src/drawer/DrawerStack.tsx`, `packages/ui/src/drawer/Drawer.module.css`, `packages/ui/src/drawer/index.ts`
- Test: `packages/ui/src/drawer/Drawer.test.tsx`
- Modify: `packages/ui/src/index.ts`, `packages/tokens/src/tokens.src.ts` (+ `pnpm gen` → `tokens.css`, `tokens.ts`), `packages/tokens/src/generate.test.ts`, `CHANGELOG.md`

**Interfaces:**
- Produces (экспорт `@katran/ui`):

```ts
type DrawerProps = {
  label: string                      // доступное имя: «Платёжная инструкция № 812345»
  title: string                      // видимый заголовок шапки
  meta?: ReactNode | undefined       // правее заголовка: uuid, дата создания
  onClose: () => void
  returnFocus?: (() => HTMLElement | null) | undefined   // куда вернуть фокус при закрытии
  focusKey?: number | undefined      // смена значения — фокус снова в заголовок
  badge?: { text: string; tone: 'a' | 'b' } | undefined
  children?: ReactNode
}
type DrawerStackItem = { key: string; slot: 'a' | 'b'; node: ReactNode }
type DrawerStackProps = { items: DrawerStackItem[]; onEscape: () => void }
Drawer(props: DrawerProps): JSX.Element     // корень: role="dialog", data-k-drawer, без aria-modal
DrawerStack(props: DrawerStackProps): JSX.Element | null   // портал в корень провайдера; B слева от A
```

- Produces (токены): `sizes.drawer` 800, `sizes['drawer-shift']` 30, `sizes['fs-h2']` 16, `sizes['dw-pad']` 14, `sizes.lane` 36; `durations.drawer` 180 → CSS `--k-drawer`, `--k-drawer-shift`, `--k-fs-h2`, `--k-dw-pad`, `--k-lane`, `--k-t-drawer`. Значения — эталон (`.dw{width:800px}`, `slidein .18s translateX(30px)`, `.dh b{font-size:16px}`, `.db` и `.tabs` — 14 по горизонтали, `.lane{height:36px}`); Task 1 подтверждает замером.

- [ ] **Step 1: токены.** В `packages/tokens/src/tokens.src.ts` в `sizes` после строки `'hatch': 10, …` добавить:

```ts
  // деталка (спека 2a §3.1, эталон .dw/.dh/.lane index.html:77–110): ширина drawer, сдвиг анимации появления,
  // кегль заголовка шапки, горизонтальный отступ содержимого, высота лейна действий
  'drawer': 800, 'drawer-shift': 30, 'fs-h2': 16, 'dw-pad': 14, 'lane': 36,
```

  и в `durations` — `drawer: 180` (итог: `export const durations = { fast: 120, base: 200, 'sk-show': 200, 'sk-min': 400, drawer: 180 }`). В `packages/tokens/src/generate.test.ts` в `describe('renderCss')` добавить:

```ts
  it('деталка: ширина drawer и длительность появления (спека 2a)', () => {
    expect(css).toMatch(/--k-drawer: calc\(800px \* var\(--k-density\)\)/)
    expect(css).toContain('--k-t-drawer: 180ms')
    expect(css).toMatch(/--k-lane: calc\(36px \* var\(--k-density\)\)/)
  })
```

  Run: `pnpm gen && pnpm --filter @katran/tokens test` — PASS.
- [ ] **Step 2: тесты (падают).** Создать `packages/ui/src/drawer/Drawer.test.tsx`:

```tsx
import { useRef, useState, type ReactNode } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Menu } from '../overlay'
import { Drawer } from './Drawer'
import { DrawerStack, type DrawerStackItem } from './DrawerStack'

type Open = { a: string | null; b: string | null }

/** Стенд теста: две кнопки открытия, стек, внешний «грид» с собственным Esc (как ячейка DataGrid). */
function Host({ start = { a: null, b: null }, extra }: { start?: Open; extra?: ReactNode }) {
  const [open, setOpen] = useState<Open>(start)
  const [tick, setTick] = useState(0)
  const opener = useRef<HTMLButtonElement>(null)
  const pane = (slot: 'a' | 'b', id: string) => (
    <Drawer
      label={`Документ ${id}`}
      title="Платёжная инструкция"
      meta={<span>uuid-{id}</span>}
      badge={slot === 'b' ? { text: 'B · сравнение', tone: 'b' } : { text: 'A', tone: 'a' }}
      onClose={() => setOpen((o) => (slot === 'b' ? { a: o.a, b: null } : { a: o.b, b: null }))}
      returnFocus={() => opener.current}
      focusKey={tick}
    >
      <input aria-label={`Поле ${id}`} />
      {extra}
    </Drawer>
  )
  const items: DrawerStackItem[] = []
  if (open.a) items.push({ key: open.a, slot: 'a', node: pane('a', open.a) })
  if (open.b) items.push({ key: open.b, slot: 'b', node: pane('b', open.b) })
  return (
    <>
      <button ref={opener} onClick={() => setOpen((o) => ({ ...o, a: 'd1' }))}>Открыть d1</button>
      <button onClick={() => setOpen((o) => ({ ...o, b: 'd2' }))}>Открыть d2 рядом</button>
      <button onClick={() => setTick((t) => t + 1)}>Фокус</button>
      {/* ячейка грида гасит Esc сама (useGridKeyboard) — деталка перехватывает раньше, в фазе захвата */}
      <div role="grid" aria-label="Грид"><div role="row"><div role="gridcell" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Escape') e.stopPropagation() }}>Ячейка</div></div></div>
      <DrawerStack items={items} onEscape={() => setOpen((o) => (o.b ? { a: o.a, b: null } : { a: null, b: null }))} />
    </>
  )
}

const names = () => screen.queryAllByRole('dialog').map((d) => d.getAttribute('aria-label'))

describe('Drawer / DrawerStack (спека 2a §3.1)', () => {
  it('открытие: dialog с именем без aria-modal, фокус в заголовке', async () => {
    renderK(<Host />)
    await userEvent.click(screen.getByText('Открыть d1'))
    const d = screen.getByRole('dialog', { name: 'Документ d1' })
    expect(d).not.toHaveAttribute('aria-modal')
    expect(d).toHaveAttribute('data-k-drawer')
    expect(screen.getByRole('heading', { name: 'Платёжная инструкция' })).toHaveFocus()
    expect(d).toHaveTextContent('uuid-d1')
  })

  it('«Закрыть» закрывает и возвращает фокус туда, откуда открыли', async () => {
    renderK(<Host />)
    await userEvent.click(screen.getByText('Открыть d1'))
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Открыть d1')).toHaveFocus()
  })

  it('B слева от A: в DOM сначала B; пустой слот не рендерится', () => {
    renderK(<Host start={{ a: 'd1', b: 'd2' }} />)
    expect(names()).toEqual(['Документ d2', 'Документ d1'])
    expect(screen.getByText('B · сравнение')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('без открытых — ничего не рендерится', () => {
    renderK(<Host />)
    expect(names()).toEqual([])
  })

  it('Esc закрывает верхний: сначала B, потом A', async () => {
    renderK(<Host start={{ a: 'd1', b: 'd2' }} />)
    await userEvent.keyboard('{Escape}')
    expect(names()).toEqual(['Документ d1'])
    await userEvent.keyboard('{Escape}')
    expect(names()).toEqual([])
  })

  it('Esc в поле ввода не закрывает', async () => {
    renderK(<Host start={{ a: 'd1', b: null }} />)
    await userEvent.click(screen.getByLabelText('Поле d1'))
    await userEvent.keyboard('{Escape}')
    expect(names()).toEqual(['Документ d1'])
  })

  it('Esc из ячейки, гасящей Esc сама, всё равно закрывает деталку (фаза захвата)', async () => {
    renderK(<Host start={{ a: 'd1', b: null }} />)
    screen.getByText('Ячейка').focus()
    await userEvent.keyboard('{Escape}')
    expect(names()).toEqual([])
  })

  it('Esc в открытом меню закрывает меню, а не drawer', async () => {
    function PrintMenu() {
      const [open, setOpen] = useState(false)
      const anchor = useRef<HTMLButtonElement>(null)
      return (
        <>
          <button ref={anchor} onClick={() => setOpen(true)}>Печать</button>
          <Menu open={open} anchor={anchor} onClose={() => setOpen(false)} items={[{ id: 'p', label: 'Платёжное поручение' }]} />
        </>
      )
    }
    renderK(<Host start={{ a: 'd1', b: null }} extra={<PrintMenu />} />)
    await userEvent.click(screen.getByText('Печать'))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(names()).toEqual(['Документ d1'])
    await userEvent.keyboard('{Escape}')
    expect(names()).toEqual([])
  })

  it('focusKey возвращает фокус в заголовок (повторное открытие открытого)', async () => {
    renderK(<Host start={{ a: 'd1', b: null }} />)
    await userEvent.click(screen.getByLabelText('Поле d1'))
    await userEvent.click(screen.getByText('Фокус'))
    expect(screen.getByRole('heading', { name: 'Платёжная инструкция' })).toHaveFocus()
  })

  it('без нарушений axe (A и B)', async () => {
    const { container } = renderK(<Host start={{ a: 'd1', b: 'd2' }} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

  Run: `pnpm --filter @katran/ui test -- drawer` — FAIL: модуль не найден.
- [ ] **Step 3: реализация.** Создать `packages/ui/src/drawer/Drawer.tsx`:

```tsx
import { useEffect, useRef, type ReactNode } from 'react'
import { IconButton } from '../button'
import s from './Drawer.module.css'

export type DrawerProps = {
  /** Доступное имя диалога: «Платёжная инструкция № 812345» (видимый заголовок номера не содержит). */
  label: string
  /** Видимый заголовок шапки. */
  title: string
  /** Правее заголовка: uuid линк-кнопкой, дата создания. */
  meta?: ReactNode | undefined
  onClose: () => void
  /** Куда вернуть фокус при закрытии (размонтировании): элемент передаёт вызывающий; null или снятый со страницы — фокус не трогается. */
  returnFocus?: (() => HTMLElement | null) | undefined
  /** Смена значения снова переводит фокус в заголовок — повторное открытие уже открытого документа. */
  focusKey?: number | undefined
  /** Метка слота над шапкой: «A» или «B · сравнение». */
  badge?: { text: string; tone: 'a' | 'b' } | undefined
  children?: ReactNode
}

const X = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>

type ReturnRef = { current: (() => HTMLElement | null) | undefined }
/** Возврат фокуса — отдельной функцией: в очистке эффекта читается последняя переданная returnFocus, а не снимок монтирования. */
function restoreFocus(ref: ReturnRef) {
  const el = ref.current?.()
  if (el && el.isConnected) el.focus()
}

/**
 * Панель деталки фиксированной ширины у правого края окна (спека 2a §3.1). Не модальная: реестр под ней рабочий,
 * поэтому роль dialog без aria-modal. Esc и раскладку двух панелей держит DrawerStack.
 */
export function Drawer({ label, title, meta, onClose, returnFocus, focusKey, badge, children }: DrawerProps) {
  const head = useRef<HTMLHeadingElement>(null)
  const returnRef = useRef(returnFocus)
  // Актуализация ref — в эффекте, не в теле рендера (правило react-hooks/refs), как в Popover
  useEffect(() => { returnRef.current = returnFocus })
  // фокус в заголовок — при открытии и по запросу
  useEffect(() => { head.current?.focus() }, [focusKey])
  // при закрытии — туда, откуда открыли
  useEffect(() => () => restoreFocus(returnRef), [])
  return (
    <div role="dialog" aria-label={label} data-k-drawer="" data-slot={badge?.tone} className={s.drawer}>
      {badge && <span className={s.badge} data-tone={badge.tone}>{badge.text}</span>}
      {/* div, а не header: два drawer'а дали бы два ориентира banner (axe landmark-no-duplicate-banner) */}
      <div className={s.head} data-part="head">
        <h2 ref={head} tabIndex={-1} className={s.title}>{title}</h2>
        {meta && <div className={s.meta}>{meta}</div>}
        <IconButton label="Закрыть" className={s.close} onClick={onClose}><X /></IconButton>
      </div>
      {children}
    </div>
  )
}
```

  Создать `packages/ui/src/drawer/DrawerStack.tsx`:

```tsx
import { Fragment, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useKatran } from '../provider/useKatran'
import s from './Drawer.module.css'

export type DrawerStackItem = {
  /** Ключ — id документа: при сдвиге B в A панель не пересоздаётся (фокус и прокрутка остаются). */
  key: string
  slot: 'a' | 'b'
  node: ReactNode
}
export type DrawerStackProps = {
  items: DrawerStackItem[]
  /** Esc вне полей ввода, меню и поповеров — закрыть верхний. */
  onEscape: () => void
}

/** У этих элементов Esc свой: поле ввода, меню, список, поповер (не сама деталка). */
const OWN_ESCAPE = 'input, textarea, select, [contenteditable="true"], [role="menu"], [role="listbox"], [role="dialog"]:not([data-k-drawer])'

/**
 * Раскладка двух drawer'ов (спека 2a §3.1): A у правого края, B слева от A; пустой слот не рендерится.
 * Портал — в корень провайдера: вне скролла и трансформаций страницы, под изоляцией кита.
 * Esc слушается на document в фазе захвата — раньше ячейки грида, которая гасит Esc сама; поповер
 * и меню ловят Esc тоже в захвате и тоже раньше по порядку подписки — их фокус исключён селектором.
 */
export function DrawerStack({ items, onEscape }: DrawerStackProps) {
  const { portalRoot } = useKatran()
  const onEscapeRef = useRef(onEscape)
  useEffect(() => { onEscapeRef.current = onEscape })
  const any = items.length > 0
  useEffect(() => {
    if (!any) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const t = e.target
      if (t instanceof Element && t.closest(OWN_ESCAPE)) return
      e.preventDefault()
      e.stopPropagation()
      onEscapeRef.current()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [any])
  if (!any || !portalRoot) return null
  // flex-end: порядок в DOM — b, затем a, поэтому B встаёт слева от A
  const ordered = [...items].sort((x, y) => (x.slot === y.slot ? 0 : x.slot === 'b' ? -1 : 1))
  return createPortal(
    <div className={s.stack}>{ordered.map((it) => <Fragment key={it.key}>{it.node}</Fragment>)}</div>,
    portalRoot,
  )
}
```

  > Меню кита (`Popover`) подписывается на `keydown` в захвате позже `DrawerStack` (открывается позже), поэтому обработчик стека срабатывает первым; фокус в этот момент — на пункте меню (`[role="menu"]` в `OWN_ESCAPE`), стек выходит, меню закрывается своим обработчиком. Проверено тестом «Esc в открытом меню…».

  Создать `packages/ui/src/drawer/Drawer.module.css`:

```css
/* Слой деталки: у правого края окна на всю высоту, клики мимо панелей проходят в реестр (спека 2a §3.1, эталон #pair grid.html:720) */
.stack {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: var(--k-z-drawer);
  display: flex;
  justify-content: flex-end;
  pointer-events: none;
}

/* Ширина — полная, с рамкой: под корнем провайдера content-box, эталон сверяется по внешней ширине */
.drawer {
  box-sizing: border-box;
  position: relative;
  flex: none;
  width: var(--k-drawer);
  height: 100%;
  overflow: hidden auto;
  background: var(--k-paper);
  border-left: 1px solid var(--k-line);
  box-shadow: var(--k-shadow);
  font: var(--k-fs-1) / var(--k-lh-1) var(--k-sans);
  color: var(--k-ink);
  pointer-events: auto;
  animation: k-drawer-in var(--k-t-drawer) ease-out both;
}

@keyframes k-drawer-in {
  from {
    opacity: 0;
    transform: translateX(var(--k-drawer-shift));
  }
}

@media (prefers-reduced-motion: reduce) {
  .drawer {
    animation: none;
  }
}

/* Метка слота (эталон .slotlbl): прилипает к верху при прокрутке. B — warn-soft/ink2: paper на warn ниже 4.5 для мелкого текста */
.badge {
  position: sticky;
  top: 0;
  z-index: 1;
  float: right;
  padding: 0 var(--k-sp-1);
  border-radius: 0 0 0 var(--k-r-s);
  font: 600 var(--k-fs-3) / var(--k-lh-3) var(--k-sans);
  letter-spacing: 0.06em;
}

.badge[data-tone='a'] {
  background: var(--k-val);
  color: var(--k-paper);
}

.badge[data-tone='b'] {
  background: var(--k-warn-soft);
  color: var(--k-ink2);
}

/* Шапка 44 = sp-2 + кнопка h-ctl-m 28 + sp-2 (эталон .dh: 10 + 26 + 8) */
.head {
  display: flex;
  align-items: center;
  gap: var(--k-sp-2);
  padding: var(--k-sp-2) var(--k-dw-pad);
}

.title {
  margin: 0;
  font: 700 var(--k-fs-h2) / var(--k-lh-1) var(--k-sans);
  white-space: nowrap;
}

.title:focus {
  outline: none;
}

.title:focus-visible {
  outline: 2px solid var(--k-val);
  outline-offset: 2px;
}

.meta {
  display: flex;
  align-items: center;
  gap: var(--k-sp-2);
  min-width: 0;
  color: var(--k-muted);
  font-size: var(--k-fs-2);
}

.close {
  margin-left: auto;
  flex: none;
}
```

  Создать `packages/ui/src/drawer/index.ts`:

```ts
export { Drawer, type DrawerProps } from './Drawer'
export { DrawerStack, type DrawerStackItem, type DrawerStackProps } from './DrawerStack'
```

  В `packages/ui/src/index.ts` после `export * from './tabs'` добавить `export * from './drawer'`.
- [ ] **Step 4: запуск.** `pnpm --filter @katran/ui test -- drawer` — PASS (10 тестов). `pnpm check` — зелёный (в том числе `check:target`: `@keyframes`, `prefers-reduced-motion`, `overflow: hidden auto`, `position: sticky` — в Chromium 88 есть).
- [ ] **Step 5: CHANGELOG.** Добавить: «- Срез 2a: `Drawer` и `DrawerStack` в `@katran/ui` — не модальная панель деталки шириной `--k-drawer` (800) у правого края окна: роль `dialog` без `aria-modal`, имя — `label`, фокус в заголовок при открытии и по `focusKey`, возврат фокуса в `returnFocus` при закрытии, метка слота; `DrawerStack` — портал двух панелей (B слева от A), Esc закрывает верхнюю, кроме полей ввода, меню и поповеров; анимация появления отключается при `prefers-reduced-motion`. Токены `drawer`, `drawer-shift`, `fs-h2`, `dw-pad`, `lane`, `t-drawer`.»
- [ ] **Step 6: commit.**

```bash
git add packages/ui/src/drawer/Drawer.tsx packages/ui/src/drawer/DrawerStack.tsx packages/ui/src/drawer/Drawer.module.css packages/ui/src/drawer/Drawer.test.tsx packages/ui/src/drawer/index.ts packages/ui/src/index.ts packages/tokens/src/tokens.src.ts packages/tokens/src/tokens.css packages/tokens/src/tokens.ts packages/tokens/src/generate.test.ts CHANGELOG.md
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "ui: Drawer и DrawerStack — не модальная деталка A/B, фокус, Esc, токены геометрии"
```

---
### Task 4: Кит — `Tabs` с переполнением

**Files:**
- Create: `packages/ui/src/tabs/fitTabs.ts`
- Test: `packages/ui/src/tabs/fitTabs.test.ts`, `packages/ui/src/tabs/Tabs.overflow.test.tsx`
- Modify: `packages/ui/src/tabs/Tabs.tsx`, `packages/ui/src/tabs/Tabs.module.css`, `packages/ui/src/tabs/index.ts`, `packages/tokens/src/tokens.src.ts` (+ `pnpm gen`), `CHANGELOG.md`

**Interfaces:**
- Produces:

```ts
type TabItem = { id: string; label: string; count?: number | undefined; disabled?: boolean | undefined; hint?: string | undefined }
type TabsProps = {
  id: string; items: TabItem[]; value: string; onChange: (id: string) => void
  orientation?: 'horizontal' | 'vertical' | undefined; label: string
  overflow?: boolean | undefined            // новое: переполнение «••• N»
  variant?: 'segment' | 'line' | undefined  // новое: 'line' — полоса с подчёркиванием (деталка)
}
fitTabs(widths: number[], avail: number, more: number, selected: number, gap?: number): number[]   // экспорт @katran/ui
```

  Без `overflow` разметка и поведение `Tabs` прежние (корень — `role="tablist"`). С `overflow` корень — обёртка `.bar`, внутри `tablist`, кнопка «••• N» (`aria-haspopup="menu"`, имя «Ещё вкладки: N») и `Menu` кита с заголовком «Вкладки».
- Produces (токены): `sizes['tab-line']` 32, `sizes['tab-px']` 10 → `--k-tab-line`, `--k-tab-px` (эталон `.tabs span{padding:7px 10px 6px}` + подчёркивание 2 → 32; Task 1 подтверждает).
- Consumes: `Menu`, `MenuItem` (`../overlay`), `Counter` (`../value`).

- [ ] **Step 1: токены.** В `sizes` после строки деталки Task 3 добавить:

```ts
  // вкладки деталки линией (эталон .tabs index.html:127–129): высота полосы с подчёркиванием, горизонтальный отступ вкладки
  'tab-line': 32, 'tab-px': 10,
```

  `pnpm gen`.
- [ ] **Step 2: тесты `fitTabs` (падают).** Создать `packages/ui/src/tabs/fitTabs.test.ts`:

```ts
import { fitTabs } from './fitTabs'

describe('fitTabs (эталон fitTabs, index.html:1089)', () => {
  it('всё помещается — все вкладки', () => {
    expect(fitTabs([100, 100, 100], 300, 40, 0)).toEqual([0, 1, 2])
  })
  it('не помещается — хвост уходит, место под «••• N» учтено', () => {
    expect(fitTabs([100, 100, 100, 100], 330, 40, 0)).toEqual([0, 1])
  })
  it('выбранная из хвоста остаётся видимой вместо предыдущих', () => {
    expect(fitTabs([100, 100, 100, 100], 330, 40, 3)).toEqual([0, 3])
  })
  it('зазор между вкладками учитывается', () => {
    expect(fitTabs([100, 100, 100], 310, 40, 0, 10)).toEqual([0, 1])
    expect(fitTabs([100, 100, 100], 320, 40, 0, 10)).toEqual([0, 1, 2])
  })
  it('совсем тесно — видна хотя бы выбранная', () => {
    expect(fitTabs([100, 100, 100], 50, 40, 2)).toEqual([2])
    expect(fitTabs([100, 100, 100], 50, 40, -1)).toEqual([0])
  })
})
```

- [ ] **Step 3: тесты переполнения (падают).** Создать `packages/ui/src/tabs/Tabs.overflow.test.tsx`:

```tsx
import { useState } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Tabs, type TabItem } from './Tabs'

// Вкладки валютной деталки стенда (TABS, index.html:647); недоступные — как tabsOff нечётной записи
const FX: TabItem[] = [
  { id: 'main', label: 'Общие данные' }, { id: 'extra', label: 'Доп. поля' }, { id: 'statuses', label: 'Статусы' },
  { id: 'compliance', label: 'Комплаенс' }, { id: 'linked', label: 'Связанные документы' }, { id: 'tasks', label: 'Задачи' },
  { id: 'notif', label: 'Нотификации', disabled: true, hint: 'Нет данных' }, { id: 'source', label: 'Исходный текст' },
  { id: 'stream', label: 'Стриминг', disabled: true, hint: 'Нет данных' }, { id: 'mpu', label: 'MPU', disabled: true, hint: 'Нет данных' },
  { id: 'audit', label: 'Аудит' },
]

// jsdom не считает раскладку: ширины — заглушкой (замер вкладки 100, замер «•••» 40, полоса — BAR),
// ResizeObserver — синхронный: вызывает колбэк при observe, как первый замер в Chromium.
let BAR = 1000
class SyncResizeObserver {
  cb: () => void
  constructor(cb: () => void) { this.cb = cb }
  observe() { this.cb() }
  unobserve() {}
  disconnect() {}
}
beforeEach(() => {
  BAR = 1000
  vi.stubGlobal('ResizeObserver', SyncResizeObserver)
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    const m = this.getAttribute('data-k-measure')
    return m === '__more' ? 40 : m ? 100 : 0
  })
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(() => BAR)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function Host({ start = 'main', overflow = true }: { start?: string; overflow?: boolean }) {
  const [v, setV] = useState(start)
  return <Tabs id="dt" label="Разделы документа" items={FX} value={v} onChange={setV} overflow={overflow} variant="line" />
}
const names = () => screen.getAllByRole('tab').map((t) => t.textContent)

describe('Tabs: переполнение (спека 2a §3.1)', () => {
  it('недоступные — второй группой тем же порядком; не поместившиеся — в «••• N»', async () => {
    renderK(<Host />)
    expect(names()).toEqual(['Общие данные', 'Доп. поля', 'Статусы', 'Комплаенс', 'Связанные документы', 'Задачи', 'Исходный текст', 'Аудит', 'Нотификации'])
    expect(screen.getByRole('tab', { name: 'Нотификации' })).toBeDisabled()
    const more = screen.getByRole('button', { name: 'Ещё вкладки: 2' })
    expect(more).toHaveTextContent('••• 2')
    await userEvent.click(more)
    const menu = screen.getByRole('menu', { name: 'Вкладки' })
    expect(within(menu).getAllByRole('menuitem').map((x) => x.textContent)).toEqual(['СтримингНет данных', 'MPUНет данных'])
    expect(within(menu).getByRole('menuitem', { name: /Стриминг/ })).toBeDisabled()
  })

  it('выбранная вкладка всегда видна в полосе', () => {
    BAR = 540
    renderK(<Host start="audit" />)
    expect(names()).toEqual(['Общие данные', 'Доп. поля', 'Статусы', 'Комплаенс', 'Аудит'])
    expect(screen.getByRole('tab', { name: 'Аудит' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Ещё вкладки: 6' })).toBeInTheDocument()
  })

  it('выбор из меню — onChange, вкладка встаёт в полосу выбранной', async () => {
    BAR = 540
    renderK(<Host />)
    expect(screen.queryByRole('tab', { name: 'Задачи' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Ещё вкладки/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Задачи' }))
    expect(screen.getByRole('tab', { name: 'Задачи' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('клавиатура: стрелки ходят только по видимым доступным, выбор — Enter', async () => {
    renderK(<Host />)
    screen.getByRole('tab', { name: 'Общие данные' }).focus()
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Аудит' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Общие данные' })).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}{Enter}')
    expect(screen.getByRole('tab', { name: 'Аудит' })).toHaveAttribute('aria-selected', 'true')
  })

  it('без overflow — как раньше: порядок как задан, без «•••», корень — tablist', () => {
    const { container } = renderK(<Host overflow={false} />)
    expect(names()).toEqual(FX.map((t) => t.label))
    expect(screen.queryByRole('button', { name: /Ещё вкладки/ })).toBeNull()
    expect(container.querySelector('[data-k-measure]')).toBeNull()
  })

  it('без ResizeObserver (jsdom без заглушки) — все вкладки в полосе', () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('ResizeObserver', undefined)
    renderK(<Host />)
    expect(screen.getAllByRole('tab')).toHaveLength(11)
  })

  it('без нарушений axe', async () => {
    const { container } = renderK(<Host />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

  Run: `pnpm --filter @katran/ui test -- tabs` — FAIL (нет `fitTabs`, нет пропа `overflow`).
- [ ] **Step 4: реализация `fitTabs`.** Создать `packages/ui/src/tabs/fitTabs.ts`:

```ts
/**
 * Какие вкладки помещаются в полосу (спека 2a §3.1, эталон fitTabs index.html:1089): хвост уходит в меню «••• N»,
 * выбранная остаётся видимой — вместо неё в меню уходят предыдущие по порядку.
 * widths — ширины вкладок в порядке показа; avail — ширина полосы; more — ширина кнопки «••• N»;
 * selected — индекс выбранной (−1 — нет); gap — зазор между соседними вкладками.
 * Возвращает индексы видимых вкладок по возрастанию; хотя бы одна видна всегда.
 */
export function fitTabs(widths: number[], avail: number, more: number, selected: number, gap = 0): number[] {
  const total = (ids: number[]) => ids.reduce((sum, i) => sum + (widths[i] ?? 0), 0) + gap * Math.max(0, ids.length - 1)
  const all = widths.map((_, i) => i)
  if (total(all) <= avail) return all
  const room = avail - more - gap
  const shown: number[] = []
  for (const i of all) {
    if (total([...shown, i]) > room) break
    shown.push(i)
  }
  if (selected >= 0 && !shown.includes(selected)) {
    while (shown.length > 0 && total([...shown, selected]) > room) shown.pop()
    shown.push(selected)
  }
  if (shown.length === 0) shown.push(0)
  return shown.sort((a, b) => a - b)
}
```

- [ ] **Step 5: реализация `Tabs`.** Заменить `packages/ui/src/tabs/Tabs.tsx` целиком:

```tsx
import { Fragment, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Menu } from '../overlay'
import { Counter } from '../value'
import { fitTabs } from './fitTabs'
import s from './Tabs.module.css'

export type TabItem = {
  id: string
  label: string
  count?: number | undefined
  disabled?: boolean | undefined
  /** Подсказка вкладки; недоступная в меню переполнения показывает её вместо «нет данных». */
  hint?: string | undefined
}
export type TabsProps = {
  /** Префикс идентификаторов: таб `${id}-tab-${item}`, панель `${id}-panel-${item}`. */
  id: string
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  orientation?: 'horizontal' | 'vertical' | undefined
  /** Доступное имя списка табов. */
  label: string
  /**
   * Переполнение (спека 2a §3.1): порядок фиксированный, недоступные — второй группой тем же порядком,
   * не поместившиеся по ширине — в меню «••• N»; выбранная всегда в полосе.
   */
  overflow?: boolean | undefined
  /** Вид горизонтальной полосы: сегментный контрол (по умолчанию) или линия с подчёркиванием (вкладки деталки). */
  variant?: 'segment' | 'line' | undefined
}

export const tabId = (tabs: string, item: string) => `${tabs}-tab-${item}`
export const panelId = (tabs: string, item: string) => `${tabs}-panel-${item}`

/** Ключ замера кнопки «••• N» среди замеров вкладок. */
const MORE = '__more'
type Fit = { avail: number; widths: Record<string, number>; more: number; gap: number }

/** WAI-ARIA Tabs с ручной активацией: стрелки двигают фокус, Enter/Space выбирает. */
export function Tabs({ id, items, value, onChange, orientation = 'horizontal', label, overflow = false, variant = 'segment' }: TabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const bar = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [fit, setFit] = useState<Fit | null>(null)

  // С переполнением порядок фиксирован, недоступные — второй группой (эталон TABS, index.html:647)
  const ordered = overflow ? [...items.filter((it) => !it.disabled), ...items.filter((it) => it.disabled)] : items
  const selected = ordered.findIndex((it) => it.id === value)
  const shownIdx = overflow && fit
    ? fitTabs(ordered.map((it) => fit.widths[it.id] ?? 0), fit.avail, fit.more, selected, fit.gap)
    : ordered.map((_, i) => i)
  const shown = shownIdx.map((i) => ordered[i]!)
  const hidden = ordered.filter((_, i) => !shownIdx.includes(i))
  const enabled = shown.filter((it) => !it.disabled)
  const stopId = enabled.some((it) => it.id === value) ? value : enabled[0]?.id
  const focusAt = (i: number) => { const it = enabled[(i + enabled.length) % enabled.length]; if (it) refs.current[it.id]?.focus() }

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, it: TabItem) => {
    const pos = enabled.findIndex((x) => x.id === it.id)
    const next = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'
    const prev = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
    if (e.key === next) { e.preventDefault(); focusAt(pos + 1) }
    else if (e.key === prev) { e.preventDefault(); focusAt(pos - 1) }
    else if (e.key === 'Home') { e.preventDefault(); focusAt(0) }
    else if (e.key === 'End') { e.preventDefault(); focusAt(enabled.length - 1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(it.id) }
  }

  // Замер — в колбэке ResizeObserver (первый вызов — сразу после observe): ширина полосы и скрытого ряда замеров.
  // Ряд замеров меняет ширину при смене подписей — наблюдатель срабатывает и на это. Без ResizeObserver (jsdom) — всё видно.
  useLayoutEffect(() => {
    const box = bar.current
    if (!overflow || !box || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const widths: Record<string, number> = {}
      box.querySelectorAll<HTMLElement>('[data-k-measure]').forEach((el) => { widths[el.getAttribute('data-k-measure') ?? ''] = el.offsetWidth })
      const list = box.querySelector<HTMLElement>('[role="tablist"]')
      const gap = list ? parseFloat(getComputedStyle(list).columnGap) || 0 : 0
      setFit({ avail: box.clientWidth, widths, more: widths[MORE] ?? 0, gap })
    }
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    const row = box.querySelector('[data-k-measures]')
    if (row) ro.observe(row)
    return () => ro.disconnect()
  }, [overflow])

  const mod = orientation === 'vertical' ? s.vertical : variant === 'line' ? s.line : s.horizontal
  const firstOff = overflow ? shown.findIndex((it) => it.disabled) : -1
  const list = (
    <div role="tablist" aria-label={label} aria-orientation={orientation} className={[s.list, mod].join(' ')}>
      {shown.map((it, i) => {
        const sel = it.id === value
        return (
          <Fragment key={it.id}>
            {i === firstOff && i > 0 && <span className={s.sep} aria-hidden="true" />}
            <button
              ref={(el) => { refs.current[it.id] = el }}
              type="button"
              role="tab"
              id={tabId(id, it.id)}
              aria-selected={sel}
              aria-controls={panelId(id, it.id)}
              aria-disabled={it.disabled || undefined}
              disabled={it.disabled}
              tabIndex={it.id === stopId ? 0 : -1}
              className={s.tab}
              data-k-tip={it.hint}
              onClick={() => !it.disabled && onChange(it.id)}
              onKeyDown={(e) => onKey(e, it)}
            >
              <span>{it.label}</span>
              {it.count !== undefined && <Counter value={it.count} active={sel} />}
            </button>
          </Fragment>
        )
      })}
    </div>
  )
  if (!overflow) return list
  return (
    <div ref={bar} className={s.bar}>
      {list}
      {hidden.length > 0 && (
        <button ref={moreRef} type="button" className={s.more} aria-haspopup="menu" aria-expanded={menuOpen} aria-label={`Ещё вкладки: ${hidden.length}`} onClick={() => setMenuOpen(true)}>
          ••• {hidden.length}
        </button>
      )}
      <div className={[s.measure, mod].join(' ')} aria-hidden="true" data-k-measures="">
        {ordered.map((it) => (
          <span key={it.id} data-k-measure={it.id} className={s.tab}>
            <span>{it.label}</span>
            {it.count !== undefined && <Counter value={it.count} />}
          </span>
        ))}
        <span data-k-measure={MORE} className={s.more}>••• 99</span>
      </div>
      <Menu
        open={menuOpen && hidden.length > 0}
        anchor={moreRef}
        onClose={() => setMenuOpen(false)}
        title="Вкладки"
        items={hidden.map((it) => ({
          id: it.id,
          label: it.label,
          disabled: it.disabled,
          hint: it.disabled ? (it.hint ?? 'нет данных') : undefined,
          onSelect: () => onChange(it.id),
        }))}
      />
    </div>
  )
}
```

  В `packages/ui/src/tabs/Tabs.module.css` — в конец файла:

```css
/* линия с подчёркиванием — вкладки деталки (эталон .tabs index.html:127–129, 263–283): 32 = высота вкладки с подчёркиванием;
   нижнюю рамку полосы рисует контейнер потребителя, подчёркивание выбранной ложится на неё (margin-bottom: -1px) */
.line {
  gap: 0;
}

.line .tab {
  height: var(--k-tab-line);
  padding: 0 var(--k-tab-px);
  border: 0;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  font-weight: 400;
  color: var(--k-muted);
}

.line .tab:hover:not(:disabled) {
  color: var(--k-ink);
}

.line .tab[aria-selected="true"] {
  border-bottom-color: var(--k-val);
  font-weight: 500;
  color: var(--k-ink);
}

/* переполнение: полоса + кнопка «••• N»; вкладки, не поместившиеся до первого замера, не вылезают */
.bar {
  position: relative;
  display: flex;
  align-items: stretch;
  min-width: 0;
}

.bar > .list {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

.more {
  flex: none;
  margin-left: auto;
  padding: 0 var(--k-tab-px);
  border: 0;
  background: none;
  font: 600 var(--k-fs-1) / 1 var(--k-sans);
  letter-spacing: 0.1em;
  color: var(--k-muted);
  white-space: nowrap;
  cursor: pointer;
}

.more:hover {
  color: var(--k-ink);
}

.more:focus-visible {
  outline: 2px solid var(--k-val);
  outline-offset: -2px;
}

/* разделитель групп: доступные | недоступные (эталон .tdiv) */
.sep {
  flex: none;
  width: 0;
  margin: var(--k-sp-2) var(--k-sp-1);
  border-left: 1px solid var(--k-line);
}

/* скрытый ряд замеров: те же классы вкладок, вне потока, не виден и не кликается */
.measure {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  height: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
  white-space: nowrap;
}
```

  В `packages/ui/src/tabs/index.ts` добавить строку `export { fitTabs } from './fitTabs'`.
- [ ] **Step 6: запуск.** `pnpm --filter @katran/ui test -- tabs` — PASS: прежние 6 тестов `Tabs.test.tsx` без правок + 5 `fitTabs` + 7 переполнения. `pnpm check` — зелёный.
- [ ] **Step 7: CHANGELOG.** Добавить: «- Срез 2a: `Tabs` — проп `overflow` (недоступные вкладки второй группой, не поместившиеся — в меню «••• N» на `Menu` кита, выбранная всегда видна; пересчёт по `ResizeObserver`), проп `variant: 'segment' | 'line'` (линия с подчёркиванием — вкладки деталки), `TabItem.hint`; помощник `fitTabs`. Токены `tab-line`, `tab-px`. Без новых пропов `Tabs` ведёт себя как раньше.»
- [ ] **Step 8: commit.**

```bash
git add packages/ui/src/tabs/Tabs.tsx packages/ui/src/tabs/Tabs.module.css packages/ui/src/tabs/fitTabs.ts packages/ui/src/tabs/fitTabs.test.ts packages/ui/src/tabs/Tabs.overflow.test.tsx packages/ui/src/tabs/index.ts packages/tokens/src/tokens.src.ts packages/tokens/src/tokens.css packages/tokens/src/tokens.ts CHANGELOG.md
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "ui: Tabs — переполнение «••• N», неактивные второй группой, вид линией"
```

---
### Task 5: Кит — `FieldRow`, `ConfigForm`, `Disclosure`

**Files:**
- Create: `packages/ui/src/form/types.ts`, `packages/ui/src/form/present.ts`, `packages/ui/src/form/FieldRow.tsx`, `packages/ui/src/form/ConfigForm.tsx`, `packages/ui/src/form/Disclosure.tsx`, `packages/ui/src/form/Form.module.css`, `packages/ui/src/form/index.ts`
- Test: `packages/ui/src/form/FieldRow.test.tsx`, `packages/ui/src/form/ConfigForm.test.tsx`, `packages/ui/src/form/Disclosure.test.tsx`
- Modify: `packages/ui/src/index.ts`, `packages/tokens/src/tokens.src.ts` (+ `pnpm gen`), `CHANGELOG.md`

**Interfaces:**
- Produces (экспорт `@katran/ui`). Имена уточнены по профилям стенда (`FIELDS`/`PROFILES`, index.html:597–645) при сохранении принципа спеки §3.1 — схема и реестр полей — данные приложения, `ConfigForm` — механизм без знания SWIFT: `FieldDef.label` (на стенде `name`), `FieldDef.show` (видимые строки текста), `FieldValue.acc` (счёт 50/59 отдельно от строк, как на стенде), `FormSchema.fieldsTitle`/`fieldsHint`/`seqB`/`sectionsTitle`, `hero` — ключи ячеек, содержимое которых рендерит приложение (`renderHero`), вид значения — `present` приложения (у валюты — правила BIC и нумерация строк SWIFT).

```ts
type FieldDef = { label: string; kind: 'ref' | 'amount' | 'short' | 'party' | 'bank' | 'text'; opts?: string[] | undefined; lines?: number | undefined; width?: number | undefined; show?: number | undefined }
type FieldRef = string | { tag: string; hideIfEmpty?: boolean | undefined }
type FieldValue = { opt?: string | undefined; acc?: string | undefined; lines: string[] }
type FormPart = { grid?: [FieldRef | null, FieldRef | null][] | undefined; text?: FieldRef[] | undefined; extra?: FieldRef[] | undefined }
type FormSection = { id: string; title: string; collapsed?: boolean | undefined }        // collapsed по умолчанию true (эталон: все свёрнуты)
type FormSchema = FormPart & {
  hero?: string[] | undefined; blocks?: string[] | undefined
  fieldsTitle?: string | undefined; fieldsHint?: string | undefined
  seqB?: (FormPart & { title: string }) | undefined
  sections?: FormSection[] | undefined; sectionsTitle?: string | undefined
}
type HeroCell = { label: ReactNode; value: ReactNode; align?: 'right' | undefined; tip?: string | undefined }
type SectionContent = { body: ReactNode; count?: number | undefined } | null      // null — «нет данных»
type FieldView = { main: string; second: string; full: string[] }
type FieldPresenter = (tag: string, v: FieldValue) => FieldView
defaultPresent: FieldPresenter
isEmptyValue(v: FieldValue | null): boolean
type FieldRowProps = { tag: string; def: FieldDef | undefined; value: FieldValue | null; present?: FieldPresenter | undefined; optionLabels?: Record<string, string> | undefined; open?: boolean | undefined; onToggle?: (() => void) | undefined; wide?: boolean | undefined }
type ConfigFormProps = {
  schema: FormSchema; fields: Record<string, FieldDef>; value: (tag: string) => FieldValue | null
  present?: FieldPresenter | undefined; optionLabels?: Record<string, string> | undefined
  renderHero?: ((id: string) => HeroCell) | undefined
  renderBlock?: ((id: string) => ReactNode) | undefined
  renderSection?: ((id: string) => SectionContent) | undefined
}
type DisclosureProps = { title: string; aside?: ReactNode | undefined; count?: number | undefined; open?: boolean | undefined; defaultOpen?: boolean | undefined; onOpenChange?: ((open: boolean) => void) | undefined; empty?: boolean | undefined; level?: 'block' | 'sub' | undefined; children?: ReactNode }
FieldRow, ConfigForm, Disclosure
```

  Разметка, на которую опираются e2e и тесты приложения: строка поля — `data-field="<тег>"`, пустая — ещё `data-empty=""`; сводка — `data-part="hero"`.
- Produces (токены, эталон index.html:131–260, 486–488; Task 1 подтверждает замером `field-row` и `party-row`): `field-row` 27, `field-tag` 26, `field-opt` 14, `field-gap` 6, `fs-pre` 11.5, `lh-pre` 16.3, `fs-hero` 13.5, `fs-sum` 17, `party-row` 23 и сетки блоков деталки приложения (`.tx`, `.rph/.rpr`, `.rsec .xr`, `.xg.byname .xr`, `RSECTIONS.agents`): `dt-dir` 62, `dt-acc` 156, `dt-sum` 150, `dt-st` 84, `dt-time` 104, `dt-bic` 90, `dt-label-s` 128, `dt-label-m` 150, `dt-label-l` 250.

- [ ] **Step 1: токены.** В `sizes` после строки Task 4 добавить:

```ts
  // «Общие данные» деталки (эталон .cell/.hero/.amt/.cell.txt pre, index.html:131–260): строка SWIFT-поля 27, колонки тега/опции,
  // зазор, моноширинный текст полей 70/72/79, кегли сводки; строка таблицы сторон рубля 23 (.rpr)
  'field-row': 27, 'field-tag': 26, 'field-opt': 14, 'field-gap': 6, 'fs-pre': 11.5, 'lh-pre': 16.3, 'fs-hero': 13.5, 'fs-sum': 17, 'party-row': 23,
  // сетки блоков деталки приложения: проводки (.tx), стороны и секции рубля (.rph/.rpr, .rsec .xr, RSECTIONS.agents)
  'dt-dir': 62, 'dt-acc': 156, 'dt-sum': 150, 'dt-st': 84, 'dt-time': 104, 'dt-bic': 90, 'dt-label-s': 128, 'dt-label-m': 150, 'dt-label-l': 250,
```

  `pnpm gen`.
- [ ] **Step 2: тесты (падают).** Создать `packages/ui/src/form/FieldRow.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { useState } from 'react'
import { renderK } from '../test/renderK'
import { FieldRow } from './FieldRow'
import type { FieldDef, FieldValue } from './types'

const party: FieldDef = { label: 'Приказодатель', kind: 'party', opts: ['A', 'F', 'K'] }
const text72: FieldDef = { label: 'Информация отправителя получателю', kind: 'text', lines: 6, width: 35, show: 4 }
const v50: FieldValue = { opt: 'F', acc: '40817840500010042371', lines: ['LAVRENTIEV DMITRY OLEGOVICH', 'ULITSA PROFSOYUZNAYA 83-1-214', 'RU/ MOSCOW, 117279'] }
const T72 = ['/INS/ NRDIRUMMXXX', '/ACC/ PLEASE CREDIT WITHOUT DELAY', '/REC/ REF FX2609220000417', '/BNF/ CONTRACT 12-45 DD 01.03.2026', '/INT/ MRDNGB2LXXX', '//CHARGES OUR']

function Toggle({ tag, def, value }: { tag: string; def: FieldDef; value: FieldValue | null }) {
  const [open, setOpen] = useState(false)
  return <FieldRow tag={tag} def={def} value={value} open={open} onToggle={() => setOpen((o) => !o)} optionLabels={{ F: 'Опция F — имя и адрес структурированно' }} />
}

describe('FieldRow (спека 2a §3.1)', () => {
  it('пустое поле — бледная строка с прочерком, доступный текст «не заполнено», без кнопки', () => {
    renderK(<FieldRow tag="55" def={{ label: 'Третье возмещающее учреждение', kind: 'bank' }} value={{ lines: [] }} />)
    const row = document.querySelector('[data-field="55"]')!
    expect(row).toHaveAttribute('data-empty')
    expect(row).toHaveTextContent('55')
    expect(row).toHaveTextContent('—')
    expect(screen.getByText('не заполнено')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('55')).toHaveAttribute('data-k-tip', '55 · Третье возмещающее учреждение')
  })

  it('null — тоже пустая строка', () => {
    renderK(<FieldRow tag="56" def={undefined} value={null} />)
    expect(document.querySelector('[data-field="56"]')).toHaveAttribute('data-empty')
  })

  it('заполненное: тег, буква опции с подсказкой, первая строка и счёт; клик раскрывает полный текст', async () => {
    renderK(<Toggle tag="50" def={party} value={v50} />)
    const btn = screen.getByRole('button', { name: /LAVRENTIEV/ })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    expect(btn).toHaveTextContent('50')
    expect(btn).toHaveTextContent('40817840500010042371')
    expect(screen.getByText('F')).toHaveAttribute('data-k-tip', 'Опция F — имя и адрес структурированно')
    expect(screen.queryByText(/ULITSA PROFSOYUZNAYA/)).not.toBeVisible()
    await userEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/ULITSA PROFSOYUZNAYA/)).toBeVisible()
  })

  it('тег последовательности B показывается без префикса', () => {
    renderK(<FieldRow tag="B.50" def={party} value={v50} />)
    expect(document.querySelector('[data-field="B.50"]')).toHaveTextContent(/^50/)
  })

  it('многострочное текстовое: видно show строк и «ещё N стр.»; раскрытие показывает все', async () => {
    renderK(<Toggle tag="72" def={text72} value={{ lines: T72 }} />)
    const row = document.querySelector('[data-field="72"]')!
    expect(row).toHaveTextContent('/INS/ NRDIRUMMXXX')
    expect(row).not.toHaveTextContent('//CHARGES OUR')
    await userEvent.click(screen.getByRole('button', { name: 'ещё 2 стр.' }))
    expect(row).toHaveTextContent('//CHARGES OUR')
    expect(screen.getByRole('button', { name: 'свернуть' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('пустое текстовое — «не заполнено»', () => {
    renderK(<FieldRow tag="70" def={{ label: 'Детали платежа', kind: 'text', lines: 4, width: 35 }} value={{ lines: [] }} />)
    expect(document.querySelector('[data-field="70"]')).toHaveAttribute('data-empty')
    expect(screen.getByText('не заполнено')).toBeInTheDocument()
  })

  it('без нарушений axe', async () => {
    const { container } = renderK(<><Toggle tag="50" def={party} value={v50} /><FieldRow tag="55" def={party} value={null} /><Toggle tag="72" def={text72} value={{ lines: T72 }} /></>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

  Создать `packages/ui/src/form/Disclosure.test.tsx`:

```tsx
import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Disclosure } from './Disclosure'

describe('Disclosure', () => {
  it('кнопка заголовка с aria-expanded управляет панелью; по умолчанию свёрнут', async () => {
    renderK(<Disclosure title="Транзакции" count={6} aside={<a href="#x">txId</a>}><p>Проводки</p></Disclosure>)
    const btn = screen.getByRole('button', { name: 'Транзакции' })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Проводки')).not.toBeVisible()
    expect(screen.getByText('6')).toBeInTheDocument()
    await userEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Проводки')).toBeVisible()
    expect(document.getElementById(btn.getAttribute('aria-controls')!)).toHaveTextContent('Проводки')
  })

  it('шеврон справа тоже переключает (мышь), из порядка Tab исключён', async () => {
    renderK(<Disclosure title="Маршрут" defaultOpen><p>Правило</p></Disclosure>)
    const chev = document.querySelector('[data-part="chevron"]') as HTMLButtonElement
    expect(chev).toHaveAttribute('tabindex', '-1')
    expect(chev).toHaveAttribute('aria-hidden', 'true')
    await userEvent.click(chev)
    expect(screen.getByRole('button', { name: 'Маршрут' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('управляемый: open/onOpenChange', async () => {
    function Host() {
      const [o, setO] = useState(true)
      return <><Disclosure title="Бюджетные реквизиты" open={o} onOpenChange={setO}><p>101</p></Disclosure><span>{o ? 'открыт' : 'закрыт'}</span></>
    }
    renderK(<Host />)
    await userEvent.click(screen.getByRole('button', { name: 'Бюджетные реквизиты' }))
    expect(screen.getByText('закрыт')).toBeInTheDocument()
  })

  it('без данных — бледный заголовок «нет данных», не раскрывается', () => {
    renderK(<Disclosure title="Посредник" empty />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Посредник' })).toBeInTheDocument()
    expect(screen.getByText('нет данных')).toBeInTheDocument()
  })

  it('вложенный уровень — заголовок h4', () => {
    renderK(<Disclosure title="Информация о банке-плательщике" level="sub" defaultOpen><p>BIC</p></Disclosure>)
    expect(screen.getByRole('heading', { level: 4, name: 'Информация о банке-плательщике' })).toBeInTheDocument()
  })

  it('без нарушений axe', async () => {
    const { container } = renderK(<><Disclosure title="Транзакции" count={2}><p>x</p></Disclosure><Disclosure title="Посредник" empty /></>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

  Создать `packages/ui/src/form/ConfigForm.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { ConfigForm } from './ConfigForm'
import type { FieldDef, FieldValue, FormSchema } from './types'

// Упрощённый MT103/MT202COV стенда (PROFILES, index.html:625): пары 50–54 | 55–59, текст 70/72, extra, последовательность B, секции
const fields: Record<string, FieldDef> = {
  '20': { label: 'Референс отправителя', kind: 'ref' },
  '33B': { label: 'Валюта и сумма инструкции', kind: 'short' },
  '36': { label: 'Курс', kind: 'short' },
  '50': { label: 'Приказодатель', kind: 'party', opts: ['A', 'F', 'K'] },
  '52': { label: 'Банк приказодателя', kind: 'bank', opts: ['A', 'D'] },
  '55': { label: 'Третье возмещающее учреждение', kind: 'bank' },
  '56': { label: 'Банк-посредник', kind: 'bank' },
  '57': { label: 'Банк получателя', kind: 'bank' },
  '59': { label: 'Бенефициар', kind: 'party' },
  '70': { label: 'Детали платежа', kind: 'text', lines: 4, width: 35 },
  '72': { label: 'Информация отправителя получателю', kind: 'text', lines: 6, width: 35, show: 4 },
}
const values: Record<string, FieldValue> = {
  '50': { opt: 'F', acc: '40817840500010042371', lines: ['LAVRENTIEV DMITRY OLEGOVICH'] },
  '52': { opt: 'A', lines: ['NORDINVEST BANK MOSCOW', 'NRDIRUMMXXX'] },
  '57': { opt: 'A', lines: ['VOSTOCHNY KREDIT BANK KHABAROVSK BR', 'VKRBRU8KXXX'] },
  '59': { opt: 'F', acc: '40817840100050017762', lines: ['SEMENOVA IRINA VLADIMIROVNA'] },
  '70': { lines: ['/INV/ 2026-0417 DD 15.09.2026'] },
  '72': { lines: ['/INS/ NRDIRUMMXXX'] },
  '33B': { lines: ['EUR 1148300,00'] },
  'B.50': { opt: 'F', acc: '40817840500010042371', lines: ['LAVRENTIEV DMITRY OLEGOVICH'] },
}
const schema: FormSchema = {
  hero: ['20', 'sum'],
  blocks: ['msgs', 'tx'],
  fieldsTitle: 'Поля MT103',
  fieldsHint: '50–54 слева · 55–59 справа',
  grid: [['50', { tag: '55', hideIfEmpty: true }], ['52', '57'], [{ tag: '55', hideIfEmpty: true }, { tag: '56', hideIfEmpty: true }], [null, '59']],
  text: ['70', '72'],
  extra: ['33B', '36'],
  seqB: { title: 'Покрываемый клиентский платёж · последовательность B', grid: [['B.50', null]] },
  sections: [{ id: 'budget', title: 'Бюджетные реквизиты' }, { id: 'agents', title: 'Посредник' }],
}
const hero = (id: string) => (id === 'sum' ? { label: '32A · сумма', value: '1 250 000.00 USD', align: 'right' as const } : { label: '20 · № / от', value: 'FX2609220000417', tip: '20 · Референс отправителя' })
const section = (id: string) => (id === 'budget' ? { body: <p>Код статуса плательщика 51</p> } : null)

const renderForm = () => renderK(
  <ConfigForm schema={schema} fields={fields} value={(t) => values[t] ?? null} renderHero={hero} renderBlock={(id) => <div>Блок {id}</div>} renderSection={section} />,
)
const row = (tag: string) => document.querySelector(`[data-field="${tag}"]`)

describe('ConfigForm (спека 2a §3.1)', () => {
  it('сводка: ячейки по схеме, последняя справа, подсказка подписи', () => {
    renderForm()
    const heroEl = document.querySelector('[data-part="hero"]')!
    expect(heroEl).toHaveTextContent('20 · № / от')
    expect(heroEl).toHaveTextContent('1 250 000.00 USD')
    expect(within(heroEl as HTMLElement).getByText('20 · № / от')).toHaveAttribute('data-k-tip', '20 · Референс отправителя')
    expect(within(heroEl as HTMLElement).getByText('1 250 000.00 USD').closest('[data-align]')).toHaveAttribute('data-align', 'right')
  })

  it('блоки — слотами приложения, в порядке схемы, до полей', () => {
    renderForm()
    const text = document.body.textContent ?? ''
    expect(text.indexOf('Блок msgs')).toBeLessThan(text.indexOf('Блок tx'))
    expect(text.indexOf('Блок tx')).toBeLessThan(text.indexOf('Поля MT103'))
  })

  it('сетка: пары, null и скрытое пустое — промежуток, строка из двух скрытых пропадает', () => {
    renderForm()
    expect(screen.getByRole('heading', { name: 'Поля MT103' })).toBeInTheDocument()
    expect(screen.getByText('50–54 слева · 55–59 справа')).toBeInTheDocument()
    expect(row('50')).not.toBeNull()
    expect(row('55')).toBeNull()
    expect(row('56')).toBeNull()
    // промежутки: скрытое 55 в первой строке, null перед 59, null в строке последовательности B
    expect(document.querySelectorAll('[data-part="gap"]')).toHaveLength(3)
    expect(row('59')).not.toBeNull()
  })

  it('поле раскрывается вместе с соседом по строке', async () => {
    renderForm()
    await userEvent.click(within(row('52') as HTMLElement).getByRole('button'))
    expect(within(row('52') as HTMLElement).getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    expect(within(row('57') as HTMLElement).getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    expect(within(row('50') as HTMLElement).getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  })

  it('«Развернуть поля» раскрывает все заполненные, подпись меняется', async () => {
    renderForm()
    await userEvent.click(screen.getByRole('button', { name: 'Развернуть поля' }))
    for (const t of ['50', '52', '57', '59', 'B.50']) expect(within(row(t) as HTMLElement).getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Свернуть поля' })).toBeInTheDocument()
  })

  it('extra: значение одной строкой, пустое — «не заполнено»', () => {
    renderForm()
    expect(screen.getByText('EUR 1148300,00')).toBeInTheDocument()
    expect(screen.getByText('36').parentElement).toHaveTextContent('не заполнено')
  })

  it('последовательность B — заголовок и поля с префиксом', () => {
    renderForm()
    expect(screen.getByRole('heading', { name: 'Покрываемый клиентский платёж · последовательность B' })).toBeInTheDocument()
    expect(row('B.50')).toHaveTextContent('LAVRENTIEV')
  })

  it('секции: свёрнуты по умолчанию, пустая — «нет данных», «Развернуть все»', async () => {
    renderForm()
    expect(screen.getByRole('button', { name: 'Бюджетные реквизиты' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('heading', { name: 'Посредник' }).parentElement).toHaveTextContent('нет данных')
    await userEvent.click(screen.getByRole('button', { name: 'Развернуть все' }))
    expect(screen.getByText('Код статуса плательщика 51')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Свернуть все' })).toBeInTheDocument()
  })

  it('без полей в схеме — нет заголовка полей и ссылки «Развернуть поля»', () => {
    renderK(<ConfigForm schema={{ hero: ['20'], blocks: ['party'] }} fields={{}} value={() => null} renderHero={hero} renderBlock={() => <div>Стороны</div>} />)
    expect(screen.queryByRole('button', { name: 'Развернуть поля' })).toBeNull()
    expect(screen.getByText('Стороны')).toBeInTheDocument()
  })

  it('без нарушений axe', async () => {
    const { container } = renderForm()
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

  Run: `pnpm --filter @katran/ui test -- form` — FAIL: модули не найдены.
- [ ] **Step 3: типы и представление.** Создать `packages/ui/src/form/types.ts`:

```ts
import type { ReactNode } from 'react'

/** Описание поля из реестра полей приложения (у валюты — FIELDS стенда, index.html:597). Ключ реестра — тег. */
export type FieldDef = {
  /** Название поля — в подсказке номера: «50 · Приказодатель». */
  label: string
  kind: 'ref' | 'amount' | 'short' | 'party' | 'bank' | 'text'
  /** Допустимые буквы опции (правка — срез 2c). */
  opts?: string[] | undefined
  /** Текстовое поле: строк всего и знаков в строке (70 — 4×35, 72 — 6×35, 79 — 35×50). */
  lines?: number | undefined
  width?: number | undefined
  /** Сколько строк текстового поля видно до раскрытия; по умолчанию lines, не больше 4. */
  show?: number | undefined
}

/** Поле в схеме: тег или тег с условием; префикс «B.» — поле последовательности B (MT202COV), описание — по тегу без префикса. */
export type FieldRef = string | { tag: string; hideIfEmpty?: boolean | undefined }

/** Значение поля: буква опции, счёт (у сторон), строки. */
export type FieldValue = { opt?: string | undefined; acc?: string | undefined; lines: string[] }

export type FormPart = {
  /** Пары строк сетки: слева 50–54, справа 55–59; null — пустое место. */
  grid?: [FieldRef | null, FieldRef | null][] | undefined
  /** Текстовые поля под сеткой; одно — во всю ширину. */
  text?: FieldRef[] | undefined
  /** Короткие поля одной строкой под сеткой. */
  extra?: FieldRef[] | undefined
}

/** Сворачиваемая секция после полей; содержимое — renderSection приложения. collapsed по умолчанию true (эталон: все свёрнуты). */
export type FormSection = { id: string; title: string; collapsed?: boolean | undefined }

/** Схема «Общих данных» — данные приложения (профиль типа документа), ConfigForm — механизм. */
export type FormSchema = FormPart & {
  /** Ячейки сводки; содержимое каждой — renderHero(id). */
  hero?: string[] | undefined
  /** Именованные блоки между сводкой и полями; рендерит приложение. */
  blocks?: string[] | undefined
  /** Заголовок полей («Поля MT103») и подсказка раскладки («50–54 слева · 55–59 справа»). */
  fieldsTitle?: string | undefined
  fieldsHint?: string | undefined
  /** Вторая группа полей со своим заголовком (MT202COV — последовательность B). */
  seqB?: (FormPart & { title: string }) | undefined
  sections?: FormSection[] | undefined
  /** Заголовок над секциями; по умолчанию «Дополнительные блоки». */
  sectionsTitle?: string | undefined
}

/** Ячейка сводки: подпись (с подсказкой), значение, выравнивание суммы вправо. */
export type HeroCell = { label: ReactNode; value: ReactNode; align?: 'right' | undefined; tip?: string | undefined }

/** Содержимое секции; null — секция без данных: бледный заголовок, не раскрывается (состав блоков не прыгает между документами). */
export type SectionContent = { body: ReactNode; count?: number | undefined } | null
```

  Создать `packages/ui/src/form/present.ts`:

```ts
import type { FieldValue } from './types'

/** Вид значения в строке поля: главное (первая строка), второе справа (счёт, код), полный текст раскрытия. */
export type FieldView = { main: string; second: string; full: string[] }
/** Правила вида задаёт приложение (у валюты — BIC и нумерация строк SWIFT); кит их не знает. */
export type FieldPresenter = (tag: string, v: FieldValue) => FieldView

export const defaultPresent: FieldPresenter = (_tag, v) => ({
  main: v.lines[0] ?? '',
  second: v.acc ?? '',
  full: v.acc ? [`/${v.acc}`, ...v.lines] : v.lines,
})

/** Пустое поле — ни строк, ни счёта (эталон isNull, index.html:935). */
export const isEmptyValue = (v: FieldValue | null): boolean => v === null || (v.lines.length === 0 && !v.acc)
```

- [ ] **Step 4: `FieldRow`.** Создать `packages/ui/src/form/FieldRow.tsx`:

```tsx
import type { CSSProperties } from 'react'
import { useStableId } from '../compat/useStableId'
import { defaultPresent, isEmptyValue, type FieldPresenter } from './present'
import type { FieldDef, FieldValue } from './types'
import s from './Form.module.css'

export type FieldRowProps = {
  /** Тег как в схеме: '50' или 'B.50' — показывается без префикса. */
  tag: string
  def: FieldDef | undefined
  value: FieldValue | null
  present?: FieldPresenter | undefined
  /** Подсказки букв опции: { A: 'Опция A — BIC', … } — данные приложения. */
  optionLabels?: Record<string, string> | undefined
  open?: boolean | undefined
  onToggle?: (() => void) | undefined
  /** Текстовое поле одно в группе — во всю ширину сетки. */
  wide?: boolean | undefined
}

const Eye = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /></svg>

/**
 * Строка SWIFT-поля (спека 2a §3.1, эталон cell() и textHtml(), index.html:941, 1004): тег, буква опции, значение.
 * Пустое поле остаётся бледной строкой с прочерком — два документа рядом читаются построчно; доступный текст — «не заполнено».
 */
export function FieldRow({ tag, def, value, present = defaultPresent, optionLabels, open = false, onToggle, wide }: FieldRowProps) {
  const panel = useStableId()
  const base = tag.replace(/^B\./, '')
  const tip = def ? `${base} · ${def.label}` : base
  const empty = value === null || isEmptyValue(value)
  const tagEl = <span className={s.tag} data-k-tip={tip}>{base}</span>

  if (def?.kind === 'text') {
    const lines = value?.lines ?? []
    const show = Math.min(def.show ?? def.lines ?? 4, def.lines ?? 4)
    const more = lines.length - show
    return (
      <div className={[s.cell, s.text, empty ? s.null : '', wide ? s.wide : ''].filter(Boolean).join(' ')} data-field={tag} data-empty={empty ? '' : undefined} style={{ '--k-show': String(show) } as CSSProperties}>
        {tagEl}
        <div className={s.body}>
          {empty
            ? <><span className={s.pre} aria-hidden="true">—</span><span className={s.sr}>не заполнено</span></>
            : <pre id={panel} className={s.pre}>{(open ? lines : lines.slice(0, show)).join('\n')}</pre>}
          {more > 0 && (
            <button type="button" className={s.more} aria-expanded={open} aria-controls={panel} onClick={onToggle}>
              {open ? 'свернуть' : `ещё ${more} стр.`}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (value === null || empty) {
    return (
      <div className={[s.cell, s.null].join(' ')} data-field={tag} data-empty="">
        <div className={s.row}>
          {tagEl}
          <span />
          <span className={s.main} aria-hidden="true">—</span>
          <span className={s.sr}>не заполнено</span>
        </div>
      </div>
    )
  }

  const view = present(tag, value)
  return (
    <div className={[s.cell, open ? s.open : ''].filter(Boolean).join(' ')} data-field={tag}>
      <button type="button" className={[s.row, s.toggle].join(' ')} aria-expanded={open} aria-controls={panel} onClick={onToggle}>
        {tagEl}
        <span className={s.opt} data-k-tip={value.opt ? optionLabels?.[value.opt] : undefined}>{value.opt ?? ''}</span>
        <span className={s.main}>{view.main}</span>
        <span className={s.second}>{view.second}</span>
        <span className={s.eye} aria-hidden="true"><Eye /></span>
      </button>
      <div id={panel} className={s.full} hidden={!open}>{view.full.join('\n')}</div>
    </div>
  )
}
```

- [ ] **Step 5: `Disclosure`.** Создать `packages/ui/src/form/Disclosure.tsx`:

```tsx
import { useState, type ReactNode } from 'react'
import { useStableId } from '../compat/useStableId'
import { Counter } from '../value'
import s from './Form.module.css'

export type DisclosureProps = {
  title: string
  /** Правее заголовка: сводка, ссылки, время — интерактивное сюда, не в кнопку заголовка. */
  aside?: ReactNode | undefined
  count?: number | undefined
  /** Управляемый режим; без него — своё состояние от defaultOpen. */
  open?: boolean | undefined
  defaultOpen?: boolean | undefined
  onOpenChange?: ((open: boolean) => void) | undefined
  /** Нет данных: пунктирная рамка, бледный заголовок «нет данных», не раскрывается. */
  empty?: boolean | undefined
  /** Вложенный уровень (подгруппы секции): без рамки, заголовок h4. */
  level?: 'block' | 'sub' | undefined
  children?: ReactNode
}

/** Сворачиваемый блок (эталон .blk/.bh/.bb, index.html:167–174): кнопка заголовка с aria-expanded и панель. */
export function Disclosure({ title, aside, count, open, defaultOpen = false, onOpenChange, empty, level = 'block', children }: DisclosureProps) {
  const [inner, setInner] = useState(defaultOpen)
  const panel = useStableId()
  const isOpen = open ?? inner
  const set = (v: boolean) => { if (open === undefined) setInner(v); onOpenChange?.(v) }
  const H = level === 'sub' ? 'h4' : 'h3'
  const lv = level === 'sub' ? s.lvSub : s.lvBlock
  if (empty) {
    return (
      <div className={[s.blk, lv, s.empty].join(' ')}>
        <div className={s.bh}>
          <H className={s.bhTitle}>{title}</H>
          <span className={s.hint}>нет данных</span>
        </div>
      </div>
    )
  }
  return (
    <div className={[s.blk, lv, isOpen ? '' : s.shut].filter(Boolean).join(' ')}>
      <div className={s.bh}>
        <H className={s.bhTitle}>
          <button type="button" className={s.bhBtn} aria-expanded={isOpen} aria-controls={panel} onClick={() => set(!isOpen)}>{title}</button>
        </H>
        {count !== undefined && <Counter value={count} />}
        {aside}
        {/* шеврон — дубль кнопки заголовка для мыши (эталон .tg), вне порядка Tab и дерева доступности */}
        <button type="button" tabIndex={-1} aria-hidden="true" data-part="chevron" className={s.chev} onClick={() => set(!isOpen)}>▲</button>
      </div>
      <div id={panel} className={s.bb} hidden={!isOpen}>{children}</div>
    </div>
  )
}
```

- [ ] **Step 6: `ConfigForm`.** Создать `packages/ui/src/form/ConfigForm.tsx`:

```tsx
import { Fragment, useState, type ReactNode } from 'react'
import { Disclosure } from './Disclosure'
import { FieldRow } from './FieldRow'
import { isEmptyValue, type FieldPresenter } from './present'
import type { FieldDef, FieldRef, FieldValue, FormPart, FormSchema, HeroCell, SectionContent } from './types'
import s from './Form.module.css'

export type ConfigFormProps = {
  schema: FormSchema
  /** Реестр полей по тегу без префикса «B.». */
  fields: Record<string, FieldDef>
  value: (tag: string) => FieldValue | null
  present?: FieldPresenter | undefined
  optionLabels?: Record<string, string> | undefined
  renderHero?: ((id: string) => HeroCell) | undefined
  renderBlock?: ((id: string) => ReactNode) | undefined
  renderSection?: ((id: string) => SectionContent) | undefined
}

const tagOf = (r: FieldRef): string => (typeof r === 'string' ? r : r.tag)
const baseOf = (tag: string) => tag.replace(/^B\./, '')
const refsOfRow = (row: [FieldRef | null, FieldRef | null]) => row.filter((r): r is FieldRef => r !== null)

/** Группы, раскрываемые вместе: пара строки сетки и текстовые поля группы — соседняя карточка не растягивается пустой (эталон rowMates, index.html:1104). */
function mateGroups(parts: FormPart[]): string[][] {
  const groups: string[][] = []
  for (const p of parts) {
    for (const row of p.grid ?? []) groups.push(refsOfRow(row).map(tagOf))
    if (p.text && p.text.length > 1) groups.push(p.text.map(tagOf))
  }
  return groups
}

/**
 * Рендер «Общих данных» по схеме (спека 2a §3.1): сводка → блоки → поля (сетка пар, текст, extra) → последовательность B → секции.
 * Схема и реестр полей — данные приложения; ConfigForm не знает SWIFT.
 */
export function ConfigForm({ schema, fields, value, present, optionLabels, renderHero, renderBlock, renderSection }: ConfigFormProps) {
  const [open, setOpen] = useState<string[]>([])
  const [sections, setSections] = useState<Record<string, boolean>>({})
  const parts: FormPart[] = [schema, ...(schema.seqB ? [schema.seqB] : [])]
  const filled = (tag: string) => !isEmptyValue(value(tag))
  const groups = mateGroups(parts)
  const allTags = parts.flatMap((p) => [...(p.grid ?? []).flatMap((row) => refsOfRow(row).map(tagOf)), ...(p.text ?? []).map(tagOf)]).filter(filled)
  const allOpen = allTags.length > 0 && allTags.every((t) => open.includes(t))
  const hasGrid = (schema.grid?.length ?? 0) > 0 || schema.seqB !== undefined
  const hasFields = hasGrid || (schema.text?.length ?? 0) > 0 || (schema.extra?.length ?? 0) > 0

  const toggle = (tag: string) => {
    const mates = groups.find((g) => g.includes(tag)) ?? [tag]
    setOpen((cur) => (cur.includes(tag)
      ? cur.filter((t) => !mates.includes(t))
      : [...cur.filter((t) => !mates.includes(t)), ...mates.filter(filled)]))
  }

  const cell = (ref: FieldRef, wide: boolean) => {
    const tag = tagOf(ref)
    return (
      <FieldRow key={tag} tag={tag} def={fields[baseOf(tag)]} value={value(tag)} present={present} optionLabels={optionLabels}
        open={open.includes(tag)} onToggle={() => toggle(tag)} wide={wide} />
    )
  }
  const grid = (part: FormPart) => (
    <div className={s.fg}>
      {(part.grid ?? []).map((row, i) => {
        const hide = row.map((r) => r === null || (typeof r !== 'string' && r.hideIfEmpty === true && !filled(r.tag)))
        if (hide.every(Boolean)) return null
        return (
          <Fragment key={i}>
            {row.map((r, k) => (r === null || hide[k]
              ? <div key={`gap${k}`} className={s.gap} data-part="gap" aria-hidden="true" />
              : cell(r, false)))}
          </Fragment>
        )
      })}
      {(part.text ?? []).map((r) => cell(r, (part.text ?? []).length === 1))}
    </div>
  )
  const extra = (refs: FieldRef[] | undefined) => (refs && refs.length > 0 ? (
    <div className={s.extra}>
      {refs.map((r) => {
        const tag = tagOf(r)
        const v = value(tag)
        const def = fields[baseOf(tag)]
        return (
          <span key={tag} className={s.extraItem}>
            <span className={s.tag} data-k-tip={def ? `${baseOf(tag)} · ${def.label}` : undefined}>{baseOf(tag)}</span>
            {v === null || isEmptyValue(v)
              ? <span className={s.none}><span aria-hidden="true">—</span><span className={s.sr}>не заполнено</span></span>
              : <span className={s.extraVal}>{v.lines.join(' ')}</span>}
          </span>
        )
      })}
    </div>
  ) : null)

  const secs = (schema.sections ?? []).map((sec) => ({ sec, content: renderSection ? renderSection(sec.id) : null }))
  const secOpen = (id: string, collapsed: boolean | undefined) => sections[id] ?? !(collapsed ?? true)
  const anyShut = secs.some(({ sec, content }) => content !== null && !secOpen(sec.id, sec.collapsed))

  return (
    <div className={s.form}>
      {schema.hero && schema.hero.length > 0 && renderHero && (
        <div className={s.hero} data-part="hero" style={{ gridTemplateColumns: schema.hero.map((_, i, a) => (i === a.length - 1 ? '1fr' : 'auto')).join(' ') }}>
          {schema.hero.map((id) => {
            const c = renderHero(id)
            return (
              <div key={id} className={s.heroCell} data-align={c.align}>
                <span className={s.heroLabel} data-k-tip={c.tip}>{c.label}</span>
                <span className={s.heroValue}>{c.value}</span>
              </div>
            )
          })}
        </div>
      )}
      {(schema.blocks ?? []).map((id) => <Fragment key={id}>{renderBlock?.(id)}</Fragment>)}
      {hasFields && (
        <>
          <div className={s.fh}>
            {schema.fieldsTitle && <h3 className={s.fhTitle}>{schema.fieldsTitle}</h3>}
            {schema.fieldsHint && <span className={s.hint}>{schema.fieldsHint}</span>}
            {hasGrid && (
              <button type="button" className={s.link} onClick={() => setOpen(allOpen ? [] : allTags)}>
                {allOpen ? 'Свернуть поля' : 'Развернуть поля'}
              </button>
            )}
          </div>
          {grid(schema)}
          {extra(schema.extra)}
        </>
      )}
      {schema.seqB && (
        <>
          <div className={s.fh}><h3 className={s.fhTitle}>{schema.seqB.title}</h3></div>
          {grid(schema.seqB)}
          {extra(schema.seqB.extra)}
        </>
      )}
      {secs.length > 0 && (
        <>
          <div className={s.fh}>
            <h3 className={s.fhTitle}>{schema.sectionsTitle ?? 'Дополнительные блоки'}</h3>
            {secs.some(({ content }) => content !== null) && (
              <button type="button" className={s.link} onClick={() => setSections(Object.fromEntries(secs.map(({ sec }) => [sec.id, anyShut])))}>
                {anyShut ? 'Развернуть все' : 'Свернуть все'}
              </button>
            )}
          </div>
          {secs.map(({ sec, content }) => (
            <Disclosure key={sec.id} title={sec.title} empty={content === null} count={content?.count}
              open={secOpen(sec.id, sec.collapsed)} onOpenChange={(o) => setSections((cur) => ({ ...cur, [sec.id]: o }))}>
              {content?.body}
            </Disclosure>
          ))}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 7: стили.** Создать `packages/ui/src/form/Form.module.css`:

```css
/* «Общие данные» деталки (спека 2a §3.1, эталон index.html:131–260) */
.form {
  display: flex;
  flex-direction: column;
  gap: var(--k-sp-2);
}

/* сводка (эталон .hero) */
.hero {
  display: grid;
  border: 1px solid var(--k-line);
  border-radius: var(--k-r-s);
  background: var(--k-sunk);
}

.heroCell {
  min-width: 0;
  padding: var(--k-sp-1) var(--k-sp-3);
}

.heroCell + .heroCell {
  border-left: 1px solid var(--k-line);
}

.heroCell[data-align='right'] {
  text-align: right;
}

.heroLabel {
  display: block;
  font: var(--k-fs-3) / var(--k-lh-3) var(--k-sans);
  color: var(--k-muted);
}

.heroValue {
  font: 600 var(--k-fs-hero) / var(--k-lh-1) var(--k-sans);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* заголовок группы полей (эталон .fh) */
.fh {
  display: flex;
  align-items: baseline;
  gap: var(--k-sp-2);
}

.fhTitle {
  margin: 0;
  font: 600 var(--k-fs-2) / var(--k-lh-2) var(--k-sans);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--k-ink2);
}

.hint {
  font-size: var(--k-fs-2);
  color: var(--k-muted);
}

.link {
  margin-left: auto;
  padding: 0;
  border: 0;
  background: none;
  font: 500 var(--k-fs-1) / var(--k-lh-1) var(--k-sans);
  color: var(--k-val);
  cursor: pointer;
}

.link:hover {
  text-decoration: underline;
}

.link:focus-visible {
  outline: 2px solid var(--k-val);
  outline-offset: 1px;
}

/* сетка пар 50–54 | 55–59 (эталон .fg) */
.fg {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--k-sp-1) var(--k-sp-2);
}

.gap {
  visibility: hidden;
}

/* строка поля 27 с рамкой (эталон .cell, border-box) */
.cell {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  min-height: var(--k-field-row);
  padding: 0 var(--k-sp-2);
  border: 1px solid var(--k-line);
  border-radius: var(--k-r-s);
}

.cell:hover {
  border-color: var(--k-val);
}

.row {
  display: grid;
  grid-template-columns: var(--k-field-tag) var(--k-field-opt) minmax(0, 1fr) auto var(--k-icon-m);
  gap: 0 var(--k-field-gap);
  align-items: center;
  width: 100%;
}

.toggle {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.toggle:focus-visible {
  outline: 2px solid var(--k-val);
  outline-offset: 2px;
}

.null {
  border-style: dashed;
}

.null:hover {
  border-color: var(--k-line);
}

.tag {
  font: 600 var(--k-fs-1) / 1 var(--k-mono);
  color: var(--k-ink);
  cursor: help;
}

.opt {
  font: 700 var(--k-fs-1) / 1 var(--k-mono);
  color: var(--k-opt);
  text-align: center;
}

.main {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  color: var(--k-val);
}

.null .main {
  font-weight: 400;
  color: var(--k-faint);
}

.second {
  font: var(--k-fs-2) / var(--k-lh-2) var(--k-mono);
  color: var(--k-ink2);
  white-space: nowrap;
}

.open .second {
  visibility: hidden;
}

.eye {
  display: grid;
  place-items: center;
  color: var(--k-faint);
}

.eye svg {
  width: var(--k-icon-m);
  height: var(--k-icon-m);
}

.cell:hover .eye {
  color: var(--k-val);
}

/* полный текст раскрытого поля под значением (эталон .full) */
.full {
  margin: 0 0 var(--k-sp-1) calc(var(--k-field-tag) + var(--k-field-opt) + 2 * var(--k-field-gap));
  padding-top: var(--k-sp-1);
  border-top: 1px dashed var(--k-line);
  font: var(--k-fs-1) / var(--k-lh-1) var(--k-mono);
  color: var(--k-val);
  white-space: pre-wrap;
}

/* текстовые поля 70/72/79 (эталон .cell.txt) */
.text {
  flex-direction: row;
  align-items: flex-start;
  justify-content: flex-start;
  gap: var(--k-field-gap);
  padding-top: var(--k-sp-1);
  padding-bottom: var(--k-sp-1);
}

.text:hover {
  border-color: var(--k-line);
}

.text .tag {
  flex: none;
  width: var(--k-field-tag);
}

.body {
  flex: 1;
  min-width: 0;
}

.pre {
  display: block;
  margin: 0;
  min-height: calc(var(--k-lh-pre) * var(--k-show, 4));
  overflow: hidden;
  font: var(--k-fs-pre) / var(--k-lh-pre) var(--k-mono);
  color: var(--k-val);
  white-space: pre;
}

.null .pre {
  color: var(--k-faint);
}

.wide {
  grid-column: 1 / -1;
}

.more {
  padding: 0;
  border: 0;
  background: none;
  font: var(--k-fs-3) / var(--k-lh-3) var(--k-sans);
  color: var(--k-muted);
  cursor: pointer;
}

.more:hover {
  color: var(--k-val);
}

/* короткие поля одной строкой (эталон .xrow) */
.extra {
  display: flex;
  flex-wrap: wrap;
  gap: var(--k-sp-1) var(--k-sp-4);
  padding: var(--k-sp-1) var(--k-sp-2);
  border: 1px solid var(--k-line);
  border-radius: var(--k-r-s);
  white-space: nowrap;
}

.extraItem {
  display: inline-flex;
  align-items: baseline;
  gap: var(--k-sp-1);
}

.extraVal {
  color: var(--k-val);
}

.none {
  color: var(--k-faint);
}

/* только для скринридера — как живая область провайдера */
.sr {
  position: absolute;
  inline-size: 0;
  block-size: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* сворачиваемый блок (эталон .blk/.bh/.bb) */
.blk {
  border: 1px solid var(--k-line);
  border-radius: var(--k-r-s);
}

.bh {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: var(--k-sp-2);
  min-height: var(--k-field-row);
  padding: 0 var(--k-sp-2);
}

.bhTitle {
  margin: 0;
  font: 600 var(--k-fs-2) / var(--k-lh-2) var(--k-sans);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--k-ink2);
}

/* двойной класс (0,2,0): сброс типографики кнопок провайдера (:where(button), 0,1,0) не должен зависеть от порядка правил в бандле */
.bhBtn.bhBtn {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: inherit;
  cursor: pointer;
}

.bhBtn:hover {
  color: var(--k-val);
}

.bhBtn:focus-visible {
  outline: 2px solid var(--k-val);
  outline-offset: 1px;
}

.chev {
  margin-left: auto;
  padding: 0 var(--k-sp-1);
  border: 0;
  background: none;
  font-size: var(--k-fs-3);
  color: var(--k-muted);
  cursor: pointer;
}

.shut > .bh > .chev {
  transform: rotate(180deg);
}

.bb {
  display: flex;
  flex-direction: column;
  gap: var(--k-sp-1);
  padding: 0 var(--k-sp-2) var(--k-sp-1);
}

/* display выше перебил бы атрибут hidden */
.bb[hidden] {
  display: none;
}

.empty {
  border-style: dashed;
}

.empty .bhTitle {
  color: var(--k-faint);
}

.lvBlock {
  background: var(--k-paper);
}

.lvSub {
  border: 0;
  border-radius: 0;
}

.lvSub > .bh {
  min-height: var(--k-h-field);
  background: var(--k-sunk);
}

.lvSub .bhTitle {
  font-size: var(--k-fs-3);
}
```

  Создать `packages/ui/src/form/index.ts`:

```ts
export type { FieldDef, FieldRef, FieldValue, FormPart, FormSchema, FormSection, HeroCell, SectionContent } from './types'
export { defaultPresent, isEmptyValue, type FieldPresenter, type FieldView } from './present'
export { FieldRow, type FieldRowProps } from './FieldRow'
export { Disclosure, type DisclosureProps } from './Disclosure'
export { ConfigForm, type ConfigFormProps } from './ConfigForm'
```

  В `packages/ui/src/index.ts` после `export * from './drawer'` добавить `export * from './form'`.
- [ ] **Step 8: запуск.** `pnpm --filter @katran/ui test -- form` — PASS (7 + 6 + 10). `pnpm check` — зелёный.
- [ ] **Step 9: CHANGELOG.** Добавить: «- Срез 2a: `FieldRow`, `ConfigForm`, `Disclosure` в `@katran/ui` — строка SWIFT-поля (тег, буква опции, значение; пустое — бледная строка «не заполнено»; многострочные 70/72/79 с «ещё N стр.»), рендер «Общих данных» по схеме приложения (`FormSchema`: сводка, блоки-слоты, сетка пар, текст, extra, последовательность B, сворачиваемые секции), сворачиваемый блок с `aria-expanded`. Типы `FieldDef`, `FieldRef`, `FieldValue`, `FormSchema`, `HeroCell`, `SectionContent`, `FieldPresenter`. Токены строки поля, сводки и сеток блоков деталки (`field-*`, `fs-pre`, `lh-pre`, `fs-hero`, `fs-sum`, `party-row`, `dt-*`).»
- [ ] **Step 10: commit.**

```bash
git add packages/ui/src/form/types.ts packages/ui/src/form/present.ts packages/ui/src/form/FieldRow.tsx packages/ui/src/form/ConfigForm.tsx packages/ui/src/form/Disclosure.tsx packages/ui/src/form/Form.module.css packages/ui/src/form/index.ts packages/ui/src/form/FieldRow.test.tsx packages/ui/src/form/ConfigForm.test.tsx packages/ui/src/form/Disclosure.test.tsx packages/ui/src/index.ts packages/tokens/src/tokens.src.ts packages/tokens/src/tokens.css packages/tokens/src/tokens.ts CHANGELOG.md
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "ui: FieldRow, ConfigForm, Disclosure — «Общие данные» по схеме приложения"
```

---
### Task 6: Кит — `DataGrid`: разведение жестов открытия, `marked`

**Files:**
- Create: `packages/ui/src/grid/focusTarget.ts`
- Test: `packages/ui/src/grid/DataGrid.open.test.tsx`, `packages/ui/src/grid/focusTarget.test.ts`
- Modify: `packages/ui/src/grid/DataGrid.tsx`, `packages/ui/src/grid/GridRecord.tsx`, `packages/ui/src/grid/Grid.module.css`, `packages/ui/src/grid/index.ts`, `packages/ui/src/grid/DataGrid.test.tsx`, `apps/pi/src/widgets/doc-registry/ui/DocRegistry.test.tsx`, `packages/tokens/src/tokens.src.ts` (+ `pnpm gen`), `CHANGELOG.md`

**Interfaces:**
- Produces:

```ts
// DataGridProps<Row> — новое
marked?: ((row: Row) => 'a' | 'b' | null) | undefined
// onOpen — прежняя сигнатура, новая семантика: клик мышью — через 220 мс (второй клик отменяет),
// второй клик двойного — одно onOpen(row, { secondary: true }), Shift — secondary сразу, клавиатура (detail 0) — сразу
onOpen?: ((row: Row, opts: { secondary: boolean; state: RowState }) => void) | undefined
// GridRecordProps<Row> — новое
mark?: 'a' | 'b' | null | undefined           // → tbody[data-mark]
// кнопка открытия записи — атрибут data-k-open="<rowKey>"
gridFocusTarget(grid: string, id: string, root?: ParentNode): HTMLElement | null   // экспорт @katran/ui
```

- Produces (токены): `durations['open-delay']` 220 → `--k-t-open-delay` (эталон `setTimeout(…,220)`, grid.html:2172).
- Consumes: `useUnmountGuard` (`../value/useUnmountGuard`).

- [ ] **Step 1: токен.** В `durations` добавить `'open-delay': 220` (итог: `{ fast: 120, base: 200, 'sk-show': 200, 'sk-min': 400, drawer: 180, 'open-delay': 220 }`). `pnpm gen`.
- [ ] **Step 2: тесты (падают).** Создать `packages/ui/src/grid/DataGrid.open.test.tsx`:

```tsx
import { act, fireEvent, screen } from '@testing-library/react'
import { renderK } from '../test/renderK'
import { DataGrid, type DataGridProps } from './DataGrid'
import type { RecordLayout } from './types'

type Doc = { id: string; num: string }
const docs: Doc[] = [{ id: 'd1', num: '800' }, { id: 'd2', num: '801' }]
const layout: RecordLayout<Doc> = { rowKey: (d) => d.id, columns: [{ id: 'num', title: 'Номер', render: (d) => d.num }] }
const props = (over: Partial<DataGridProps<Doc>> = {}): DataGridProps<Doc> => ({
  label: 'Документы', layout, rows: docs, total: 2, page: 1, pageSize: 20, onPage: vi.fn(), sort: [], onSort: vi.fn(),
  widths: {}, onResize: vi.fn(), order: ['num'], hidden: [], onColumns: vi.fn(), state: 'ready', onOpen: vi.fn(), ...over,
})
const btn = (n: number) => screen.getByRole('button', { name: new RegExp(`^Открыть запись ${n}(\\D|$)`) })
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

describe('DataGrid: жесты открытия (спека 2a §3.1, эталон grid.html:2165–2172)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('клик — открытие в A через 220 мс, не раньше', () => {
    const p = props()
    renderK(<DataGrid {...p} />)
    fireEvent.click(btn(1), { detail: 1 })
    wait(219)
    expect(p.onOpen).not.toHaveBeenCalled()
    wait(1)
    expect(p.onOpen).toHaveBeenCalledTimes(1)
    expect(p.onOpen).toHaveBeenCalledWith(docs[0], { secondary: false, state: null })
  })

  it('двойной клик — одно открытие рядом; первое отменено', () => {
    const p = props()
    renderK(<DataGrid {...p} />)
    fireEvent.click(btn(1), { detail: 1 })
    wait(100)
    fireEvent.click(btn(1), { detail: 2 })
    fireEvent.doubleClick(btn(1))
    wait(500)
    expect(p.onOpen).toHaveBeenCalledTimes(1)
    expect(p.onOpen).toHaveBeenCalledWith(docs[0], { secondary: true, state: null })
  })

  it('тройной клик не даёт второго открытия', () => {
    const p = props()
    renderK(<DataGrid {...p} />)
    fireEvent.click(btn(1), { detail: 1 })
    fireEvent.click(btn(1), { detail: 2 })
    fireEvent.click(btn(1), { detail: 3 })
    wait(500)
    expect(p.onOpen).toHaveBeenCalledTimes(1)
  })

  it('Shift+клик — рядом сразу', () => {
    const p = props()
    renderK(<DataGrid {...p} />)
    fireEvent.click(btn(2), { detail: 1, shiftKey: true })
    expect(p.onOpen).toHaveBeenCalledWith(docs[1], { secondary: true, state: null })
    wait(500)
    expect(p.onOpen).toHaveBeenCalledTimes(1)
  })

  it('клавиатура (Enter/Space — клик с detail 0) — сразу, без задержки', () => {
    const p = props()
    renderK(<DataGrid {...p} />)
    fireEvent.click(btn(1))
    expect(p.onOpen).toHaveBeenCalledWith(docs[0], { secondary: false, state: null })
  })

  it('клик по другой записи в пределах 220 мс отменяет первую — открывается последняя', () => {
    const p = props()
    renderK(<DataGrid {...p} />)
    fireEvent.click(btn(1), { detail: 1 })
    wait(100)
    fireEvent.click(btn(2), { detail: 1 })
    wait(220)
    expect(p.onOpen).toHaveBeenCalledTimes(1)
    expect(p.onOpen).toHaveBeenCalledWith(docs[1], { secondary: false, state: null })
  })

  it('размонтирование снимает отложенное открытие', () => {
    const p = props()
    const { unmount } = renderK(<DataGrid {...p} />)
    fireEvent.click(btn(1), { detail: 1 })
    unmount()
    wait(500)
    expect(p.onOpen).not.toHaveBeenCalled()
  })

  it('marked: запись A и B помечена data-mark, в имени кнопки — где открыта', () => {
    renderK(<DataGrid {...props({ marked: (d) => (d.id === 'd1' ? 'a' : d.id === 'd2' ? 'b' : null) })} />)
    expect(document.querySelector('tbody[data-key="d1"]')).toHaveAttribute('data-mark', 'a')
    expect(document.querySelector('tbody[data-key="d2"]')).toHaveAttribute('data-mark', 'b')
    expect(btn(1)).toHaveAccessibleName('Открыть запись 1 · открыта в деталке')
    expect(btn(2)).toHaveAccessibleName('Открыть запись 2 · открыта для сравнения')
  })

  it('без marked — атрибута нет; у кнопки открытия — data-k-open с ключом записи', () => {
    renderK(<DataGrid {...props()} />)
    expect(document.querySelector('tbody[data-key="d1"]')).not.toHaveAttribute('data-mark')
    expect(btn(1)).toHaveAttribute('data-k-open', 'd1')
  })
})
```

  Создать `packages/ui/src/grid/focusTarget.test.ts`:

```ts
import { gridFocusTarget } from './focusTarget'

describe('gridFocusTarget (спека 2a §5: фокус после закрытия деталки)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <table role="grid" aria-label="Другой"><tbody><tr><td data-cell="2:0" tabindex="0"><button data-k-open="d1">x</button></td></tr></tbody></table>
      <table role="grid" aria-label="Валютные документы"><tbody><tr>
        <td data-cell="2:0" tabindex="-1"><button data-k-open="d1">1</button></td>
        <td data-cell="2:1" tabindex="0">яч</td>
      </tr></tbody></table>`
  })
  it('кнопка открытия записи в гриде с этим именем', () => {
    expect(gridFocusTarget('Валютные документы', 'd1')?.textContent).toBe('1')
  })
  it('записи на странице нет — таб-стоп грида', () => {
    expect(gridFocusTarget('Валютные документы', 'd9')?.getAttribute('data-cell')).toBe('2:1')
  })
  it('грида нет — null', () => {
    expect(gridFocusTarget('Рублёвые документы', 'd1')).toBeNull()
  })
})
```

  Run: `pnpm --filter @katran/ui test -- DataGrid.open focusTarget` — FAIL.
- [ ] **Step 3: `focusTarget.ts`.** Создать `packages/ui/src/grid/focusTarget.ts`:

```ts
/**
 * Куда вернуть фокус после закрытия деталки (спека 2a §5): кнопка открытия записи id в гриде с доступным именем grid;
 * записи на странице уже нет — таб-стоп грида (ячейка с tabindex 0). Грида нет — null.
 * Без CSS.escape: ключ записи и имя грида сравниваются как строки.
 */
export function gridFocusTarget(grid: string, id: string, root: ParentNode = document): HTMLElement | null {
  const table = Array.from(root.querySelectorAll<HTMLElement>('table[role="grid"]')).find((t) => t.getAttribute('aria-label') === grid)
  if (!table) return null
  const open = Array.from(table.querySelectorAll<HTMLElement>('[data-k-open]')).find((b) => b.getAttribute('data-k-open') === id)
  return open ?? table.querySelector<HTMLElement>('[data-cell][tabindex="0"]')
}
```

  В `packages/ui/src/grid/index.ts` добавить `export { gridFocusTarget } from './focusTarget'`.
- [ ] **Step 4: `DataGrid` и `GridRecord`.** В `packages/ui/src/grid/DataGrid.tsx`:
  1. Импорты: первую строку заменить на `import { useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'`; строку `import { sizes } from '@katran/tokens'` — на `import { durations, sizes } from '@katran/tokens'`; добавить `import { useUnmountGuard } from '../value/useUnmountGuard'`.
  2. В `DataGridProps` комментарий и тип `onOpen` заменить, после `openHint` добавить `marked`:

```ts
  /**
   * Открытие записи (спека 2a §3.1, эталон grid.html:2165–2172): клик мышью — через 220 мс (токен open-delay), второй клик
   * отменяет его и даёт одно открытие с secondary (второй drawer рядом); Shift+клик — secondary сразу; клавиатура
   * (Enter на ячейке, Enter/Space на кнопке — клик с detail 0) — сразу. state — RowState записи (спека 5a §6).
   */
  onOpen?: ((row: Row, opts: { secondary: boolean; state: RowState }) => void) | undefined
```

```ts
  /** Открытые в деталке записи (спека 2a §3.1, эталон selA/selB grid.html:651–654): 'a' — основная, 'b' — сравнение. */
  marked?: ((row: Row) => 'a' | 'b' | null) | undefined
```

  3. После `const LEAD_WIDTH = sizes['grid-lead']` добавить:

```ts
// задержка одиночного клика по кнопке открытия: ждём, не будет ли второго (эталон grid.html:2172)
const OPEN_DELAY = durations['open-delay']
```

  4. В теле `DataGrid` после `const colsBtn = useRef<HTMLButtonElement>(null)` добавить:

```ts
  const openTimer = useRef<number | undefined>(undefined)
  useUnmountGuard(openTimer)
  const openClick = (row: Row, st: RowState) => (e: ReactMouseEvent<HTMLButtonElement>) => {
    const onOpen = p.onOpen
    if (!onOpen) return
    // любой клик по кнопке открытия отменяет ожидающий одиночный — выигрывает последний жест
    window.clearTimeout(openTimer.current)
    if (e.detail === 0 || e.shiftKey) { onOpen(row, { secondary: e.shiftKey, state: st }); return }
    if (e.detail === 2) { onOpen(row, { secondary: true, state: st }); return }
    if (e.detail > 2) return
    openTimer.current = window.setTimeout(() => onOpen(row, { secondary: false, state: st }), OPEN_DELAY)
  }
```

  5. В рендере записи: после `const st = stateOf(row)` добавить `const mark = p.marked?.(row) ?? null`; строки `const openLabel = …` и `const openTip = …` заменить на (текст блокировки — отдельной переменной, чтобы пометка слота попадала в имя кнопки, но не в подсказку):

```ts
            const markNote = mark === 'a' ? ' · открыта в деталке' : mark === 'b' ? ' · открыта для сравнения' : ''
            const lockText = st?.kind === 'locked' ? `Заблокирована: ${st.who}, с ${formatDateTimeMinutes(st.since)} · открыть только для просмотра` : null
            const openLabel = (lockText ?? `Открыть запись ${ord}`) + markNote
            const openTip = lockText ?? (st?.kind === 'inactive' ? `${st.why} · открыть` : p.openHint)
```

     У `IconButton` открытия заменить `onClick={(e) => p.onOpen!(row, { secondary: e.detail >= 2 || e.shiftKey, state: st })}` на `data-k-open={id} onClick={openClick(row, st)}`; в `<GridRecord … state={st} />` добавить `mark={mark}`.

  В `packages/ui/src/grid/GridRecord.tsx`: в `GridRecordProps` после `state` добавить

```ts
  /** Открыта в деталке (спека 2a §3.1): data-mark на tbody, подсветка как selA/selB эталона. */
  mark?: 'a' | 'b' | null | undefined
```

  в сигнатуре функции — `mark` в деструктуризацию, у `<tbody …>` — атрибут `data-mark={mark ?? undefined}`.

  В конец `packages/ui/src/grid/Grid.module.css`:

```css
/* открытые в деталке (спека 2a §3.1, эталон selA/selB grid.html:651–654): A — val, B — warn. После наведения и состояний
   записи: при равной специфичности метка побеждает подсветку наведения и полосу блокировки */
.record[data-mark='a'] > tr > td {
  background: var(--k-val-soft);
}

.record[data-mark='a'] > tr:first-child > td:first-child {
  box-shadow: inset 3px 0 0 var(--k-val);
}

.record[data-mark='b'] > tr > td {
  background: var(--k-warn-row);
}

.record[data-mark='b'] > tr:first-child > td:first-child {
  box-shadow: inset 3px 0 0 var(--k-warn);
}
```

- [ ] **Step 5: прежние тесты — под новую семантику.** В `packages/ui/src/grid/DataGrid.test.tsx` тест «открытие: кнопка, запись не кликабельна; второй клик — secondary» заменить:

```tsx
  it('открытие: кнопка, запись не кликабельна; клавиатурный клик — сразу, Shift — рядом (задержка — DataGrid.open.test)', async () => {
    const p = base({ onOpen: vi.fn() })
    renderK(<DataGrid {...p} />)
    await userEvent.click(screen.getAllByRole('row')[1]!)
    expect(p.onOpen).not.toHaveBeenCalled()
    const btn = screen.getByRole('button', { name: 'Открыть запись 1' })
    fireEvent.click(btn)
    expect(p.onOpen).toHaveBeenLastCalledWith(docs[0], { secondary: false, state: null })
    fireEvent.click(btn, { detail: 1, shiftKey: true })
    expect(p.onOpen).toHaveBeenLastCalledWith(docs[0], { secondary: true, state: null })
  })
```

  В тесте «B1: заблокированная — замок и подсказка…» строку `await userEvent.click(lock)` заменить на `fireEvent.click(lock)` (клик с detail 0 — без задержки). В `apps/pi/src/widgets/doc-registry/ui/DocRegistry.test.tsx` (тест про строку открытия) обе проверки после кликов по кнопкам открытия заменить на ожидание — открытие мышью теперь через 220 мс:

```tsx
    await userEvent.click(screen.getByRole('button', { name: 'Открыть запись 1' }))
    expect(await screen.findByText('Открыт документ Альфа')).toBeInTheDocument()
    expect(screen.queryByText('Документ не открыт')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Заблокирована/ }))
    expect(await screen.findByText('Открыт документ Бета (только просмотр)')).toBeInTheDocument()
```

- [ ] **Step 6: запуск.** `pnpm --filter @katran/ui test` — PASS (все прежние, включая `DataGrid.keyboard.test.tsx` без правок: Enter на ячейке шлёт клик с detail 0, открытие сразу; + 9 + 3 новых). `pnpm --filter pi test` — PASS. `pnpm check` — зелёный.
- [ ] **Step 7: CHANGELOG.** Добавить: «- Срез 2a: `DataGrid` — разведение жестов открытия (клик мышью — через 220 мс, токен `t-open-delay`; второй клик отменяет его и даёт одно `onOpen(…, { secondary: true })`; Shift — рядом сразу; клавиатура — сразу; раньше первый клик двойного открывал A, а второй — B с тем же документом), проп `marked` (запись, открытая в деталке, — `tbody[data-mark="a"|"b"]`, подсветка как на эталоне, пометка в имени кнопки открытия), атрибут `data-k-open` у кнопки открытия; помощник `gridFocusTarget(grid, id)` — куда вернуть фокус после закрытия деталки.»
- [ ] **Step 8: commit.**

```bash
git add packages/ui/src/grid/DataGrid.tsx packages/ui/src/grid/GridRecord.tsx packages/ui/src/grid/Grid.module.css packages/ui/src/grid/focusTarget.ts packages/ui/src/grid/focusTarget.test.ts packages/ui/src/grid/DataGrid.open.test.tsx packages/ui/src/grid/DataGrid.test.tsx packages/ui/src/grid/index.ts apps/pi/src/widgets/doc-registry/ui/DocRegistry.test.tsx packages/tokens/src/tokens.src.ts packages/tokens/src/tokens.css packages/tokens/src/tokens.ts CHANGELOG.md
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "ui: DataGrid — клик и двойной клик разведены (220 мс), метка открытых в деталке, возврат фокуса"
```

---

### Task 7: `shared`: `detailFx` в `createGridPorts`, типы деталки; фейк — `GET …/documents/{id}`

**Files:**
- Create: `apps/pi/src/shared/lib/detail/index.ts`, `apps/pi/src/shared/lib/detail/types.ts`, `apps/pi/src/shared/api/guards.test.ts`
- Modify: `apps/pi/src/shared/api/ports.ts`, `apps/pi/src/shared/api/guards.ts`, `apps/pi/src/shared/api/index.ts`, `apps/pi/src/shared/api/ports.test.ts`, `apps/pi/src/app/fake/server.ts`, `apps/pi/src/app/fake/grid.ts`, `apps/pi/src/app/fake/params.ts`, `apps/pi/src/app/fake/server.test.ts`

**Interfaces:**
- Produces (`shared/api`):

```ts
type DetailParser<D> = (raw: unknown, path: string) => D
type DetailPort<D> = { detailFx: Effect<string, D, ApiError> }
type GridPortsConfig<Row> = { gridId: string; parseRow: RowParser<Row> }
createGridPorts<Row>(cfg: GridPortsConfig<Row>): GridPorts<Row>
createGridPorts<Row, D>(cfg: GridPortsConfig<Row> & { parseDetail: DetailParser<D> }): GridPorts<Row> & DetailPort<D>
strArr(v: unknown, path: string): string[]            // гард: массив строк
```

  `detailFx(id)` — `GET /grids/{gridId}/documents/{encodeURIComponent(id)}`; ответ — `obj(body, 'ответ')`, затем `parseDetail(o, 'ответ')`; ошибки — `ApiError` транспорта или `contractError`.
- Produces (`shared/lib/detail`) — доменные контракты деталки, общие для сущностей и виджета:

```ts
type DetailTab = { id: string; label: string }
type ActionIcon = 'refresh' | 'edit' | 'doc' | 'download' | 'print' | 'link' | 'ban'
type DetailAction = { id: string; label: string; icon: ActionIcon; hotkey?: string | undefined; menu?: string[] | undefined; danger?: boolean | undefined }
type DetailSummary = { label: string; uuid: string; created: string; type: string; status: { tone: StatusTone; label: string }; kind: string; tabsOff: string[] }
type DetailDomain<D, Row> = {
  title: string; tabs: DetailTab[]; actions: DetailAction[]
  fields: Record<string, FieldDef>; optionLabels?: Record<string, string> | undefined; present?: FieldPresenter | undefined
  schemaOf: (d: D) => FormSchema
  value: (d: D, tag: string) => FieldValue | null
  summary: (d: D) => DetailSummary
  rowSummary: (row: Row) => DetailSummary
  renderHero: (d: D, id: string) => HeroCell
  renderBlock: (d: D, id: string) => ReactNode
  renderSection?: ((d: D, id: string) => SectionContent) | undefined
}
```

- Produces (фейк): `FakeGrid.detail?: ((id: string) => unknown) | undefined`; `FakeGridOptions<Row>.detail?: ((row: Row, index: number) => unknown) | undefined`; маршрут `GET /grids/{gridId}/documents/{id}` → деталь, `null` → 404 «Документ не найден»; грид без `detail` → 404; регулятор `?fail=detail` → 500.

- [ ] **Step 1: тесты (падают).** В `apps/pi/src/shared/api/ports.test.ts` импорты дополнить (`import { ApiError, contractError, toApiError } from './problem'`) и в `describe` добавить:

```ts
  const withDetail = createGridPorts({
    gridId: 'docs',
    parseRow: (raw, path) => ({ id: str(obj(raw, path), 'id', path) }),
    parseDetail: (raw, path) => ({ id: str(obj(raw, path), 'id', path), note: str(obj(raw, path), 'note', path) }),
  })
  it('detailFx: GET /grids/docs/documents/{id}, id кодируется; ответ — парсером детали', async () => {
    const seen: HttpRequest[] = []
    const scope = fork({ handlers: [[requestFx, async (r: HttpRequest) => { seen.push(r); return { id: 'a/1', note: 'ок' } }]] })
    const r = await allSettled(withDetail.detailFx, { scope, params: 'a/1' })
    expect(r).toEqual({ status: 'done', value: { id: 'a/1', note: 'ок' } })
    expect(seen).toEqual([{ method: 'GET', url: '/grids/docs/documents/a%2F1' }])
  })
  it('detailFx: ответ не объект или без поля — contractError; отказ транспорта — ApiError со статусом', async () => {
    const notObj = await allSettled(withDetail.detailFx, { scope: fork({ handlers: [[requestFx, async () => [1, 2]]] }), params: 'x' })
    expect(notObj.status).toBe('fail')
    expect((notObj.value as ApiError).message).toBe(contractError('ответ: ожидался объект').message)
    const noField = await allSettled(withDetail.detailFx, { scope: fork({ handlers: [[requestFx, async () => ({ id: 'x' })]] }), params: 'x' })
    expect((noField.value as ApiError).message).toContain('ответ.note: ожидалась строка')
    const gone = await allSettled(withDetail.detailFx, { scope: fork({ handlers: [[requestFx, async () => { throw toApiError(404, { type: 't', title: 'Документ не найден' }) }]] }), params: 'x' })
    expect((gone.value as ApiError).status).toBe(404)
  })
  it('без parseDetail порта детали нет', () => {
    expect('detailFx' in ports).toBe(false)
  })
```

  Создать `apps/pi/src/shared/api/guards.test.ts`:

```ts
import { ApiError } from './problem'
import { strArr } from './guards'

describe('strArr', () => {
  it('массив строк — как есть', () => { expect(strArr(['a', 'b'], 'x')).toEqual(['a', 'b']) })
  it('не массив или не строка внутри — contractError с путём', () => {
    expect(() => strArr('a', 'd.lines')).toThrow('d.lines: ожидался массив')
    expect(() => strArr(['a', 1], 'd.lines')).toThrow('d.lines[1]: ожидалась строка')
    expect(() => strArr([1], 'x')).toThrow(ApiError)
  })
})
```

  В `apps/pi/src/app/fake/server.test.ts` в `describe('фейковый сервер')` добавить:

```ts
  it('GET documents/{id}: деталь из строки реестра; неизвестный id — 404; ?fail=detail — 500', async () => {
    const s = createFakeServer({ docs: fakeGrid(rows, columns, meta, { detail: (r, i) => ({ ...r, i }) }) })
    expect(await s({ method: 'GET', url: '/grids/docs/documents/2' })).toEqual({ ...rows[1], i: 1 })
    await expect(s({ method: 'GET', url: '/grids/docs/documents/nope' })).rejects.toMatchObject({ status: 404 })
    await expect(s({ method: 'GET', url: '/grids/nope/documents/1' })).rejects.toMatchObject({ status: 404 })
    // грид без детали
    await expect(server({ method: 'GET', url: '/grids/docs/documents/1' })).rejects.toMatchObject({ status: 404 })
    const failing = createFakeServer({ docs: fakeGrid(rows, columns, meta, { detail: (r) => r }) }, { failing: () => 'detail' })
    await expect(failing({ method: 'GET', url: '/grids/docs/documents/1' })).rejects.toMatchObject({ status: 500 })
    // регулятор детали не трогает поиск
    await expect(failing(post('/grids/docs/search', search()))).resolves.toBeDefined()
  })
  it('id в пути декодируется', async () => {
    const odd: Row[] = [{ id: 'a/1', status: 'DONE', amount: 1, name: 'Д' }]
    const s = createFakeServer({ docs: fakeGrid(odd, columns, meta, { detail: (r) => r }) })
    expect(await s({ method: 'GET', url: '/grids/docs/documents/a%2F1' })).toEqual(odd[0])
  })
```

  Run: `pnpm --filter pi test -- ports guards server` — FAIL.
- [ ] **Step 2: гард и порты.** В `apps/pi/src/shared/api/guards.ts` после `arr` добавить:

```ts
export function strArr(v: unknown, path: string): string[] {
  return arr(v, path).map((x, i) => {
    if (typeof x !== 'string') throw contractError(`${path}[${i}]: ожидалась строка`)
    return x
  })
}
```

  Заменить `apps/pi/src/shared/api/ports.ts` целиком:

```ts
import { createEffect, type Effect } from 'effector'
import type { Facet, FacetsQuery, FilterMeta, GridPage, GridQuery } from '@katran/effector'
import { fromFacetsResponse, fromFilterMetaResponse, fromSearchResponse, toFacetsBody, toSearchBody, type RowParser } from './grid-contract'
import { obj } from './guards'
import type { ApiError } from './problem'
import { requestFx } from './request'

/** Порты грида: доменные типы снаружи, контракт и транспорт внутри. Farfetched оборачивает их как есть: createQuery({ effect: searchFx }). */
export type GridPorts<Row> = {
  searchFx: Effect<GridQuery, GridPage<Row>, ApiError>
  facetsFx: Effect<FacetsQuery, Facet[], ApiError>
  filterMetaFx: Effect<void, FilterMeta, ApiError>
}
/** Документ целиком (спека 2a §4.1): сущность проверяет форму ответа и переименовывает поля бека. Бросает contractError. */
export type DetailParser<D> = (raw: unknown, path: string) => D
/** Порт детали: GET /grids/{gridId}/documents/{id} — предложение в контракт vtb-filters, как /facets (docs/reference/pi-api.md). */
export type DetailPort<D> = { detailFx: Effect<string, D, ApiError> }
export type GridPortsConfig<Row> = { gridId: string; parseRow: RowParser<Row> }

export function createGridPorts<Row>(cfg: GridPortsConfig<Row>): GridPorts<Row>
export function createGridPorts<Row, D>(cfg: GridPortsConfig<Row> & { parseDetail: DetailParser<D> }): GridPorts<Row> & DetailPort<D>
export function createGridPorts<Row, D>(
  { gridId, parseRow, parseDetail }: GridPortsConfig<Row> & { parseDetail?: DetailParser<D> | undefined },
): GridPorts<Row> | (GridPorts<Row> & DetailPort<D>) {
  const base = `/grids/${gridId}`
  // вызов requestFx внутри обработчика сохраняет scope (effector 23)
  const searchFx = createEffect<GridQuery, GridPage<Row>, ApiError>(async (q) =>
    fromSearchResponse(await requestFx({ method: 'POST', url: `${base}/search`, body: toSearchBody(q) }), parseRow))
  const facetsFx = createEffect<FacetsQuery, Facet[], ApiError>(async (q) =>
    fromFacetsResponse(await requestFx({ method: 'POST', url: `${base}/facets`, body: toFacetsBody(q) })))
  const filterMetaFx = createEffect<void, FilterMeta, ApiError>(async () =>
    fromFilterMetaResponse(await requestFx({ method: 'GET', url: `${base}/filter-meta` })))
  if (!parseDetail) return { searchFx, facetsFx, filterMetaFx }
  // id — в пути: кодируется, чтобы «/», «?» и «#» в идентификаторе бека не ломали маршрут
  const detailFx = createEffect<string, D, ApiError>(async (id) =>
    parseDetail(obj(await requestFx({ method: 'GET', url: `${base}/documents/${encodeURIComponent(id)}` }), 'ответ'), 'ответ'))
  return { searchFx, facetsFx, filterMetaFx, detailFx }
}
```

  В `apps/pi/src/shared/api/index.ts`: в строке гардов добавить `strArr`; строку портов заменить на `export { createGridPorts, type DetailParser, type DetailPort, type GridPorts, type GridPortsConfig } from './ports'`.
- [ ] **Step 3: `shared/lib/detail`.** Создать `apps/pi/src/shared/lib/detail/types.ts`:

```ts
import type { ReactNode } from 'react'
import type { FieldDef, FieldPresenter, FieldValue, FormSchema, HeroCell, SectionContent, StatusTone } from '@katran/ui'

/** Вкладка деталки (эталон TABS/TAB_KEY, index.html:647–648). */
export type DetailTab = { id: string; label: string }
/** Иконка действия лейна — ключ набора widgets/doc-detail. */
export type ActionIcon = 'refresh' | 'edit' | 'doc' | 'download' | 'print' | 'link' | 'ban'
/** Действие лейна (эталон ACTIONS, index.html:729): в 2a — заглушка с объявлением; menu — печатные формы. */
export type DetailAction = {
  id: string
  label: string
  icon: ActionIcon
  /** Горячая клавиша — только в подсказке (привязка — вместе с настоящими действиями, 2d). */
  hotkey?: string | undefined
  menu?: string[] | undefined
  /** За разделителем, красное при наведении («Аннулировать»). */
  danger?: boolean | undefined
}
/** Шапка и лейн деталки: из загруженной детали или, до загрузки и при ошибке, из строки реестра (спека 2a §4.3). */
export type DetailSummary = {
  /** Доступное имя drawer: «Платёжная инструкция № 812345». */
  label: string
  uuid: string
  /** Дата создания, отформатированная. */
  created: string
  /** Тег типа в лейне: MT103, PAYDOCRU. */
  type: string
  status: { tone: StatusTone; label: string }
  /** «Клиентский перевод · Входящий от ЦБ». */
  kind: string
  /** Вкладки без данных — вторая группа полосы; до загрузки — пусто. */
  tabsOff: string[]
}
/** Всё доменное, что виджет деталки получает от сущности (спека 2a §4.3): widgets/doc-detail не импортирует entities. */
export type DetailDomain<D, Row> = {
  /** Заголовок шапки: «Платёжная инструкция». */
  title: string
  tabs: DetailTab[]
  actions: DetailAction[]
  fields: Record<string, FieldDef>
  optionLabels?: Record<string, string> | undefined
  present?: FieldPresenter | undefined
  schemaOf: (d: D) => FormSchema
  value: (d: D, tag: string) => FieldValue | null
  summary: (d: D) => DetailSummary
  rowSummary: (row: Row) => DetailSummary
  renderHero: (d: D, id: string) => HeroCell
  renderBlock: (d: D, id: string) => ReactNode
  renderSection?: ((d: D, id: string) => SectionContent) | undefined
}
```

  Создать `apps/pi/src/shared/lib/detail/index.ts`:

```ts
export type { ActionIcon, DetailAction, DetailDomain, DetailSummary, DetailTab } from './types'
```

- [ ] **Step 4: фейк.** В `apps/pi/src/app/fake/grid.ts` заменить типы и `fakeGrid`:

```ts
/** Один грид фейкового сервера: данные, колонки (ключи сортировки) и каталог. Наружу — только JSON контракта. */
export type FakeGrid = {
  meta: FilterMetaDto
  search: (b: SearchBody) => unknown
  facets: (b: FacetsBody) => unknown
  /** Документ по id; null — такого нет (404). Нет поля — у грида нет детали. */
  detail?: ((id: string) => unknown) | undefined
}

/** Опции фейкового грида. sortLabels — как у createFakeBackend демо (сверка S3): перечисленные ключи сортируются по подписи, а не по коду. */
export type FakeGridOptions<Row> = {
  sortLabels?: Record<string, Record<string, string>> | undefined
  /** Деталь из строки реестра (спека 2a §4.4): index — номер строки в наборе, для детерминированных полей. */
  detail?: ((row: Row, index: number) => unknown) | undefined
}

const fromSortDto = (dto: SortDto[]): Sort => dto.map((s) => ({ key: s.field, dir: s.direction === 'ASC' ? 'asc' : 'desc' }))

export function fakeGrid<Row extends Record<string, unknown>>(rows: Row[], columns: ColumnDef<Row>[], meta: FilterMetaDto, opts: FakeGridOptions<Row> = {}): FakeGrid {
  const get = (row: Row, key: string) => {
    const v = row[key]
    const labels = opts.sortLabels?.[key]
    return labels && typeof v === 'string' ? (labels[v] ?? v) : v
  }
  const grid: FakeGrid = {
    meta,
    search: (b) => {
      const sorted = sortRows(applyFilter(rows, b.filter.conditions), fromSortDto(b.sort), columns, get)
      const { number, size } = b.page
      const total = sorted.length
      return { content: sorted.slice(number * size, (number + 1) * size), page: { number, size, totalElements: total, totalPages: Math.ceil(total / size), hasNext: (number + 1) * size < total } }
    },
    facets: (b) => {
      const counts = new Map<string, number>()
      for (const r of applyFilter(rows, b.filter.conditions)) { const k = String(r[b.field]); counts.set(k, (counts.get(k) ?? 0) + 1) }
      return [...counts].map(([value, count]) => ({ value, count }))
    },
  }
  const toDetail = opts.detail
  if (toDetail) {
    grid.detail = (id) => {
      const i = rows.findIndex((r) => r.id === id)
      return i < 0 ? null : toDetail(rows[i]!, i)
    }
  }
  return grid
}
```

  В `apps/pi/src/app/fake/server.ts` после `const ROUTE = …` добавить `const DOCUMENT = /^\/grids\/([^/]+)\/documents\/([^/]+)$/` и в возвращаемом обработчике сразу после задержки (`if (delay > 0) …`) вставить:

```ts
    const doc = DOCUMENT.exec(req.url)
    if (doc) {
      const [, gridId = '', raw = ''] = doc
      const grid = grids[gridId]
      if (!grid) return fail(404, 'Неизвестный грид', gridId)
      if (opts.failing?.() === 'detail') return fail(500, 'Сбой сервера', 'Регулятор ?fail=detail')
      const id = decodeURIComponent(raw)
      const body = grid.detail ? grid.detail(id) : null
      if (body === null || body === undefined) return fail(404, 'Документ не найден', `${gridId}/${id}`)
      return body
    }
```

  В `apps/pi/src/app/fake/params.ts` комментарий заменить на: `/** Регуляторы стенда в адресе: ?slow=N — задержка ровно N мс (иначе 0,25–0,65 с); ?fail=search|facets|meta|detail — отказ 500. */`.
- [ ] **Step 5: запуск.** `pnpm --filter pi test` — PASS (+3 портов, +2 гарда, +2 сервера). `pnpm check` — зелёный (eslint видит новый сегмент `shared/lib/detail` — зоны строятся по каталогам).
- [ ] **Step 6: commit.**

```bash
git add apps/pi/src/shared/api/ports.ts apps/pi/src/shared/api/ports.test.ts apps/pi/src/shared/api/guards.ts apps/pi/src/shared/api/guards.test.ts apps/pi/src/shared/api/index.ts apps/pi/src/shared/lib/detail/index.ts apps/pi/src/shared/lib/detail/types.ts apps/pi/src/app/fake/server.ts apps/pi/src/app/fake/grid.ts apps/pi/src/app/fake/params.ts apps/pi/src/app/fake/server.test.ts
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "apps/pi: порт детали detailFx, доменный контракт деталки, фейк GET …/documents/{id} и ?fail=detail"
```

---
### Task 8: `entities/fx-doc` — деталь, профили MT, маппер, блоки, данные фейка (и сущность `posting`)

**Стоп-точка:** начинать после ответа владельца на **В-Д1** (Task 1). Ответ «как на эталоне» — `FX_DETAIL_TITLE = 'Платёжная инструкция ВАЛЮТА'`, иначе — `'Платёжная инструкция'` (как ниже).

**Files:**
- Create: `apps/pi/src/entities/posting/{index.ts, @x/fx-doc.ts, model/posting.ts, api/posting.mapper.ts, api/posting.mapper.test.ts, ui/TxBlock.tsx, ui/posting.module.css}`
- Create: `apps/pi/src/entities/fx-doc/{model/detail.ts, model/swift.ts, model/swift.test.ts, api/detail.mapper.ts, api/detail.example.ts, api/detail.mapper.test.ts, ui/detail.tsx, ui/detail.module.css, ui/detail.test.tsx}`
- Create: `apps/pi/src/app/fake/fx-docs.detail.ts`
- Modify: `apps/pi/src/entities/fx-doc/api/ports.ts`, `apps/pi/src/entities/fx-doc/index.ts`, `apps/pi/src/app/fake/grids.ts`, `apps/pi/src/app/fake/contract.test.ts`

**Interfaces:**
- Produces (`entities/posting`, публичный API и `@x/fx-doc.ts`):

```ts
TX_DIRS = ['DEBIT', 'CREDIT'] as const;  TX_STATES = ['EXECUTED', 'PENDING', 'CANCELED'] as const
type Tx = { dir: TxDir; st: TxState; acc: string; reg: string; time: string | null; amount: number; currency: string }
parseTx(raw: unknown, path: string): Tx;  parseTxs(v: unknown, path: string): Tx[]
type TxBlockProps = { txs: Tx[]; txId: string; txAt: string; defaultOpen?: boolean | undefined; aside?: ReactNode | undefined }
TxBlock(props: TxBlockProps): JSX.Element
```

- Produces (`entities/fx-doc`, публичный API):

```ts
type SwiftValue = { opt?: string | undefined; acc?: string | undefined; lines: string[] }     // = FieldValue кита
type FxDocDetail = FxDoc & {
  numDate: string; valueDates: [string, string, string, string]; fields: Record<string, SwiftValue>
  inSender: string | null; inReceiver: string | null; accDt: string; accKt: string
  routeDesc: string; routeText: string; txId: string; txAt: string; txs: Tx[]; tabsOff: string[]
}
FX_DETAIL_TITLE: string; FX_FIELDS: Record<string, FieldDef>; FX_OPTION_LABELS: Record<string, string>
FX_PROFILES: Record<FxDoc['type'], { title: string; schema: FormSchema }>
FX_TABS: DetailTab[]; FX_ACTIONS: DetailAction[]
fxSchemaOf(d: { type: FxDoc['type'] }): FormSchema
swiftPresent: FieldPresenter
parseFxDocDetail(raw: unknown, path: string): FxDocDetail
fxDocPorts: GridPorts<FxDoc> & DetailPort<FxDocDetail>
fxRowSummary(row: FxDoc): DetailSummary;  fxDocSummary(d: FxDocDetail): DetailSummary
fxHero(d: FxDocDetail, id: string): HeroCell;  fxBlock(d: FxDocDetail, id: string): ReactNode
fxDocDetailDomain: DetailDomain<FxDocDetail, FxDoc>
```

- Produces (фейк): `makeFxDocDetail(row: FxDoc, i: number): Record<string, unknown>` — DTO детали; `fakeGrids['fx-docs']` отвечает на `GET /grids/fx-docs/documents/{id}`.
- Consumes: `strArr`, `obj`, `str`, `strOrNull`, `num`, `oneOf`, `arr`, `contractError`, `createGridPorts` с `parseDetail` (Task 7); `DetailTab`, `DetailAction`, `DetailSummary`, `DetailDomain` (Task 7); `ConfigForm`, `Disclosure`, `FieldDef`, `FieldView`, `FormSchema`, `HeroCell`, `Tag`, `StatusDot`, `LinkValue`, форматтеры (кит, Task 5).

- [ ] **Step 1: проводки — тест (падает).** Создать `apps/pi/src/entities/posting/api/posting.mapper.test.ts`:

```ts
import { ApiError } from '../../../shared/api'
import { parseTx, parseTxs } from './posting.mapper'

const tx = { dir: 'DEBIT', st: 'EXECUTED', acc: '30110840700000001842', reg: '00000_NostroUSD', time: '2026-09-22T07:33:22.730Z', amount: 1250000, currency: 'USD' }

describe('parseTx', () => {
  it('проводка контракта → Tx; time null — ещё не проведена', () => {
    expect(parseTx(tx, 'txs[0]')).toEqual(tx)
    expect(parseTx({ ...tx, st: 'PENDING', time: null }, 'txs[1]').time).toBeNull()
  })
  it('недопустимое состояние и не та форма — contractError с путём', () => {
    expect(() => parseTx({ ...tx, st: 'DONE' }, 'txs[2]')).toThrow('txs[2].st: недопустимое значение «DONE»')
    expect(() => parseTxs({}, 'txs')).toThrow(ApiError)
    expect(() => parseTxs([tx, { ...tx, amount: '1' }], 'txs')).toThrow('txs[1].amount: ожидалось число')
  })
})
```

- [ ] **Step 2: проводки — реализация.** Создать `apps/pi/src/entities/posting/model/posting.ts`:

```ts
export const TX_DIRS = ['DEBIT', 'CREDIT'] as const
export const TX_STATES = ['EXECUTED', 'PENDING', 'CANCELED'] as const
export type TxDir = (typeof TX_DIRS)[number]
export type TxState = (typeof TX_STATES)[number]
/** Проводка документа (эталон TX6, index.html:759): направление, состояние, счёт, регистр, время (null — ещё не проведена), сумма, валюта. */
export type Tx = { dir: TxDir; st: TxState; acc: string; reg: string; time: string | null; amount: number; currency: string }
```

  `apps/pi/src/entities/posting/api/posting.mapper.ts`:

```ts
import { arr, num, obj, oneOf, str, strOrNull } from '../../../shared/api'
import { TX_DIRS, TX_STATES, type Tx } from '../model/posting'

/** Проводка бека → Tx. Если бек называет поля иначе — правится только этот файл. */
export function parseTx(raw: unknown, path: string): Tx {
  const o = obj(raw, path)
  return {
    dir: oneOf(o, 'dir', TX_DIRS, path), st: oneOf(o, 'st', TX_STATES, path),
    acc: str(o, 'acc', path), reg: str(o, 'reg', path), time: strOrNull(o, 'time', path),
    amount: num(o, 'amount', path), currency: str(o, 'currency', path),
  }
}

export const parseTxs = (v: unknown, path: string): Tx[] => arr(v, path).map((x, i) => parseTx(x, `${path}[${i}]`))
```

  `apps/pi/src/entities/posting/ui/TxBlock.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Disclosure, LinkValue, StatusDot, formatAmount, formatDateTimeFull, formatDateTimeShort, type StatusTone } from '@katran/ui'
import type { Tx, TxDir, TxState } from '../model/posting'
import s from './posting.module.css'

const TONE: Record<TxState, StatusTone> = { EXECUTED: 'ok', PENDING: 'warn', CANCELED: 'bad' }
const ORDER: TxState[] = ['EXECUTED', 'PENDING', 'CANCELED']

const Arrow = ({ dir }: { dir: TxDir }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d={dir === 'DEBIT' ? 'M8 3v10M4 9l4 4 4-4' : 'M8 13V3M4 7l4-4 4 4'} />
  </svg>
)

export type TxBlockProps = {
  txs: Tx[]
  txId: string
  txAt: string
  /** Эталон: блок свёрнут (mkui(true), grid.html:2154). */
  defaultOpen?: boolean | undefined
  /** Сверх заголовка — между сводкой и txId (у рубля на эталоне «Проверить баланс», в 2a не переносится). */
  aside?: ReactNode | undefined
}

/** Блок «Транзакции» (эталон txBlockHtml, index.html:1023): число, сводка по состояниям, txId и время; строки проводок. */
export function TxBlock({ txs, txId, txAt, defaultOpen = false, aside }: TxBlockProps) {
  const counts = ORDER.map((st) => ({ st, n: txs.filter((t) => t.st === st).length })).filter((x) => x.n > 0)
  return (
    <Disclosure
      title="Транзакции"
      count={txs.length}
      defaultOpen={defaultOpen}
      aside={(
        <>
          <span className={s.summary}>
            {counts.map(({ st, n }) => <span key={st} className={s.sumItem}><StatusDot tone={TONE[st]} size="s" label={st} />{n}</span>)}
          </span>
          {aside}
          <span className={s.ids}><LinkValue name="txId" value={txId} /><span className={s.at}>{formatDateTimeFull(txAt)}</span></span>
        </>
      )}
    >
      <div className={s.rows}>
        {txs.map((t, i) => (
          <div key={i} className={s.row}>
            <span className={s.dir}><Arrow dir={t.dir} />{t.dir}</span>
            <span className={s.acc}>{t.acc}</span>
            <span className={s.sum}>{formatAmount(t.amount)}<small className={s.ccy}>{t.currency}</small></span>
            <span className={s.st}><StatusDot tone={TONE[t.st]} size="s" />{t.st}</span>
            <span className={s.reg} data-k-tip={`Тип регистра: ${t.reg}`}>{t.reg}</span>
            <span className={s.time} data-k-tip={t.time ?? undefined}>{t.time ? formatDateTimeShort(t.time) : '—'}</span>
          </div>
        ))}
      </div>
    </Disclosure>
  )
}
```

  `apps/pi/src/entities/posting/ui/posting.module.css`:

```css
/* Блок «Транзакции» (эталон .tx/.txs, index.html:176–186) */
.summary {
  display: inline-flex;
  gap: var(--k-sp-1);
}

.sumItem {
  display: inline-flex;
  align-items: center;
  gap: var(--k-sp-1);
  font: 600 var(--k-fs-3) / 1 var(--k-mono);
  color: var(--k-ink2);
}

.ids {
  display: inline-flex;
  align-items: baseline;
  gap: var(--k-sp-2);
  margin-left: auto;
}

.at {
  font-size: var(--k-fs-2);
  color: var(--k-muted);
}

.rows {
  margin: 0 calc(-1 * var(--k-sp-2));
}

.row {
  display: grid;
  grid-template-columns: var(--k-dt-dir) var(--k-dt-acc) var(--k-dt-sum) var(--k-dt-st) minmax(0, 1fr) var(--k-dt-time);
  gap: 0 var(--k-sp-2);
  align-items: center;
  min-height: var(--k-h-field);
  padding: 0 var(--k-sp-2);
  border-top: 1px solid var(--k-line2);
  white-space: nowrap;
}

.row > * {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dir {
  display: inline-flex;
  align-items: center;
  gap: var(--k-sp-1);
  font: 600 var(--k-fs-3) / 1 var(--k-mono);
  color: var(--k-ink2);
}

.dir svg {
  flex: none;
  width: var(--k-fs-1);
  height: var(--k-fs-1);
}

.acc {
  font: var(--k-fs-2) / var(--k-lh-2) var(--k-mono);
  color: var(--k-val);
}

.sum {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.ccy {
  margin-left: var(--k-sp-1);
  font-size: var(--k-fs-2);
  font-weight: 600;
  color: var(--k-val);
}

.st {
  display: inline-flex;
  align-items: center;
  gap: var(--k-sp-1);
  font: 600 var(--k-fs-3) / 1 var(--k-sans);
  color: var(--k-ink2);
}

.reg {
  font-size: var(--k-fs-2);
  color: var(--k-muted);
}

.time {
  font: var(--k-fs-2) / var(--k-lh-2) var(--k-mono);
  font-variant-numeric: tabular-nums;
  color: var(--k-ink2);
}
```

  `apps/pi/src/entities/posting/index.ts`:

```ts
export { TX_DIRS, TX_STATES, type Tx, type TxDir, type TxState } from './model/posting'
export { parseTx, parseTxs } from './api/posting.mapper'
export { TxBlock, type TxBlockProps } from './ui/TxBlock'
```

  `apps/pi/src/entities/posting/@x/fx-doc.ts`:

```ts
/** Публичный API posting для соседней сущности fx-doc (FSD @x). */
export type { Tx } from '../model/posting'
export { parseTxs } from '../api/posting.mapper'
export { TxBlock } from '../ui/TxBlock'
```

  Run: `pnpm --filter pi test -- posting` — PASS.
- [ ] **Step 3: модель валютной детали и профили.** Создать `apps/pi/src/entities/fx-doc/model/detail.ts`:

```ts
import type { Tx } from '../../posting/@x/fx-doc'
import type { FxDoc } from './fxDoc'

/** Значение SWIFT-поля: буква опции, счёт (50/59), строки. Та же форма, что FieldValue кита. */
export type SwiftValue = { opt?: string | undefined; acc?: string | undefined; lines: string[] }

/** Валютный документ в деталке (спека 2a §4.2): строка реестра плюс поля и блоки «Общих данных». Имена бека держит маппер. */
export type FxDocDetail = FxDoc & {
  /** Дата документа (ISO) — «№ 417 от 22.09.2026». */
  numDate: string
  /** Даты валютирования: вх, исх, по Дт, по Кт (ISO; эталон vd[0..3]). */
  valueDates: [string, string, string, string]
  /** SWIFT-поля по тегу; теги «B.…» — последовательность B (MT202COV). */
  fields: Record<string, SwiftValue>
  /** Входящее сообщение: отправитель → получатель; null — документ без входящего. */
  inSender: string | null
  inReceiver: string | null
  /** Счета Дт / Кт (20 знаков). */
  accDt: string
  accKt: string
  /** Маршрут: описание счёта и правило (тип, BIC, счёт — в строке реестра). */
  routeDesc: string
  routeText: string
  txId: string
  txAt: string
  txs: Tx[]
  /** Вкладки без данных (ключи FX_TABS) — вторая группа полосы. */
  tabsOff: string[]
}
```

  Создать `apps/pi/src/entities/fx-doc/model/swift.ts`:

```ts
import type { FieldDef, FieldView, FormSchema } from '@katran/ui'
import type { DetailAction, DetailTab } from '../../../shared/lib/detail'
import type { SwiftValue } from './detail'
import type { FxDoc } from './fxDoc'

/** Заголовок деталки (спека 2a §1.1). Эталон валюты — «Платёжная инструкция ВАЛЮТА»: вопрос В-Д1, detail-drift.md. */
export const FX_DETAIL_TITLE = 'Платёжная инструкция'

/** Реестр SWIFT-полей — FIELDS стенда (index.html:597) дословно: name → label; признак правки (editable) — срез 2c. */
export const FX_FIELDS: Record<string, FieldDef> = {
  '20': { label: 'Референс отправителя', kind: 'ref' },
  '21': { label: 'Связанный референс', kind: 'ref' },
  '32A': { label: 'Дата валютирования, валюта, сумма', kind: 'amount' },
  '33B': { label: 'Валюта и сумма инструкции', kind: 'short' },
  '36': { label: 'Курс', kind: 'short' },
  '50': { label: 'Приказодатель', kind: 'party', opts: ['A', 'F', 'K'] },
  '52': { label: 'Банк приказодателя', kind: 'bank', opts: ['A', 'D'] },
  '53': { label: 'Корреспондент отправителя', kind: 'bank', opts: ['A', 'B', 'D'] },
  '54': { label: 'Корреспондент получателя', kind: 'bank', opts: ['A', 'B', 'D'] },
  '55': { label: 'Третье возмещающее учреждение', kind: 'bank', opts: ['A', 'B', 'D'] },
  '56': { label: 'Банк-посредник', kind: 'bank', opts: ['A', 'C', 'D'] },
  '57': { label: 'Банк получателя', kind: 'bank', opts: ['A', 'B', 'C', 'D'] },
  '58': { label: 'Учреждение-бенефициар', kind: 'bank', opts: ['A', 'D'] },
  '59': { label: 'Бенефициар', kind: 'party', opts: ['', 'A', 'F'] },
  '70': { label: 'Детали платежа', kind: 'text', lines: 4, width: 35 },
  '71A': { label: 'Детали расходов', kind: 'short' },
  '71B': { label: 'Расходы, взимаемые получателем', kind: 'short' },
  '71F': { label: 'Расходы отправителя', kind: 'short' },
  '71G': { label: 'Расходы получателя', kind: 'short' },
  '121': { label: 'UETR — уникальный сквозной референс', kind: 'ref' },
  '72': { label: 'Информация отправителя получателю', kind: 'text', lines: 6, width: 35, show: 4 },
  '77B': { label: 'Регуляторная отчётность', kind: 'short' },
  '79': { label: 'Текст сообщения', kind: 'text', lines: 35, width: 50, show: 6 },
}

/** Подсказки букв опции — OPTS стенда (index.html:937). */
export const FX_OPTION_LABELS: Record<string, string> = {
  A: 'Опция A — BIC', B: 'Опция B — код местоположения', C: 'Опция C — счёт',
  D: 'Опция D — наименование и адрес', F: 'Опция F — имя и адрес структурированно', K: 'Опция K — имя и адрес',
}

const HINT = '50–54 слева · 55–59 справа'
/** Профили типов сообщений — PROFILES стенда (index.html:625) в форме FormSchema кита; ключи сводки: 20, 21, 71A, vd, 32A; блоки: msgs, route, tx. */
export const FX_PROFILES: Record<FxDoc['type'], { title: string; schema: FormSchema }> = {
  MT103: {
    title: 'Клиентский перевод',
    schema: {
      hero: ['20', '71A', 'vd', '32A'], blocks: ['msgs', 'route', 'tx'], fieldsTitle: 'Поля MT103', fieldsHint: HINT,
      grid: [['50', { tag: '55', hideIfEmpty: true }], ['52', { tag: '56', hideIfEmpty: true }], ['53', '57'], ['54', '59']],
      text: ['70', '72'], extra: ['33B', '36', '77B'],
    },
  },
  MT202: {
    title: 'Межбанковский перевод',
    schema: {
      hero: ['20', '21', 'vd', '32A'], blocks: ['msgs', 'route', 'tx'], fieldsTitle: 'Поля MT202', fieldsHint: HINT,
      grid: [['52', '56'], ['53', '57'], ['54', '58']], text: ['72'],
    },
  },
  MT202COV: {
    title: 'Межбанковский перевод с покрытием',
    schema: {
      hero: ['20', '21', 'vd', '32A'], blocks: ['msgs', 'route', 'tx'], fieldsTitle: 'Поля MT202COV', fieldsHint: HINT,
      grid: [['52', '56'], ['53', '57'], ['54', '58']], text: ['72'],
      seqB: {
        title: 'Покрываемый клиентский платёж · последовательность B',
        grid: [['B.50', { tag: 'B.56', hideIfEmpty: true }], ['B.52', 'B.57'], [null, 'B.59']], text: ['B.70', 'B.72'], extra: ['B.33B'],
      },
    },
  },
  MT199: {
    title: 'Свободный формат',
    schema: { hero: ['20', '21'], blocks: ['msgs'], fieldsTitle: 'Поля MT199', grid: [], text: ['79'] },
  },
}

export const fxSchemaOf = (d: { type: FxDoc['type'] }): FormSchema => FX_PROFILES[d.type].schema

/** Вкладки — TABS/TAB_KEY стенда (index.html:647–648), фиксированный порядок. */
export const FX_TABS: DetailTab[] = [
  { id: 'main', label: 'Общие данные' }, { id: 'extra', label: 'Доп. поля' }, { id: 'statuses', label: 'Статусы' },
  { id: 'compliance', label: 'Комплаенс' }, { id: 'linked', label: 'Связанные документы' }, { id: 'tasks', label: 'Задачи' },
  { id: 'notif', label: 'Нотификации' }, { id: 'source', label: 'Исходный текст' }, { id: 'stream', label: 'Стриминг' },
  { id: 'mpu', label: 'MPU' }, { id: 'audit', label: 'Аудит' },
]

/** Действия лейна — ACTIONS стенда (index.html:729); в 2a — заглушки. */
export const FX_ACTIONS: DetailAction[] = [
  { id: 'refresh', label: 'Обновить', icon: 'refresh', hotkey: 'F5' },
  { id: 'edit', label: 'Редактировать', icon: 'edit', hotkey: 'E' },
  { id: 'esid', label: 'Создать служебный документ', icon: 'doc' },
  { id: 'down', label: 'Скачать SWIFT-сообщение', icon: 'download' },
  { id: 'print', label: 'Печать', icon: 'print', menu: ['Платёжное поручение', 'Мемориальный ордер', 'Форма SWIFT'] },
  { id: 'link', label: 'Скопировать ссылку на документ', icon: 'link' },
  { id: 'ban', label: 'Аннулировать', icon: 'ban', danger: true },
]

const BIC = /^[A-Z0-9]{8}([A-Z0-9]{3})?$/
/**
 * Вид SWIFT-поля в строке (эталон cell() и full(), index.html:936, 941): главное — первая строка; справа — счёт или BIC
 * последней строкой; одиночный BIC — только справа; полный текст — «/счёт» и строки с номерами «1/ …».
 */
export function swiftPresent(_tag: string, v: SwiftValue): FieldView {
  const lines = v.lines
  const last = lines[lines.length - 1] ?? ''
  let main = lines[0] ?? ''
  let second = v.acc ?? (lines.length > 1 && BIC.test(last) ? last : '')
  if (!v.acc && lines.length === 1 && BIC.test(main)) { second = main; main = '' }
  const full = [...(v.acc ? [`/${v.acc}`] : []), ...lines.map((l, i) => `${i + 1}/ ${l}`)]
  return { main, second, full }
}
```

  Создать `apps/pi/src/entities/fx-doc/model/swift.test.ts`:

```ts
import type { FieldRef, FormPart } from '@katran/ui'
import { FX_TYPES } from './fxDoc'
import { FX_ACTIONS, FX_FIELDS, FX_PROFILES, FX_TABS, fxSchemaOf, swiftPresent } from './swift'

const tagsOf = (p: FormPart): string[] => [
  ...(p.grid ?? []).flatMap((row) => row.filter((r): r is FieldRef => r !== null)),
  ...(p.text ?? []), ...(p.extra ?? []),
].map((r) => (typeof r === 'string' ? r : r.tag).replace(/^B\./, ''))

describe('профили MT (PROFILES стенда)', () => {
  it('у каждого типа реестра есть профиль; все теги схем — в реестре полей', () => {
    for (const t of FX_TYPES) {
      const { schema } = FX_PROFILES[t]
      for (const tag of [...tagsOf(schema), ...(schema.seqB ? tagsOf(schema.seqB) : [])]) expect(FX_FIELDS[tag], `${t}: ${tag}`).toBeDefined()
    }
  })
  it('последовательность B — только у MT202COV; у MT199 нет сетки', () => {
    expect(FX_TYPES.filter((t) => FX_PROFILES[t].schema.seqB)).toEqual(['MT202COV'])
    expect(fxSchemaOf({ type: 'MT199' }).grid).toEqual([])
    expect(fxSchemaOf({ type: 'MT103' }).hero).toEqual(['20', '71A', 'vd', '32A'])
  })
  it('вкладки и действия — порядок эталона', () => {
    expect(FX_TABS.map((t) => t.id)).toEqual(['main', 'extra', 'statuses', 'compliance', 'linked', 'tasks', 'notif', 'source', 'stream', 'mpu', 'audit'])
    expect(FX_ACTIONS.map((a) => a.id)).toEqual(['refresh', 'edit', 'esid', 'down', 'print', 'link', 'ban'])
    expect(FX_ACTIONS[FX_ACTIONS.length - 1]).toMatchObject({ label: 'Аннулировать', danger: true })
    expect(FX_ACTIONS.find((a) => a.id === 'print')?.menu).toHaveLength(3)
  })
})

describe('swiftPresent (эталон cell/full)', () => {
  it('сторона: первая строка и счёт, полный текст — счёт и нумерованные строки', () => {
    expect(swiftPresent('50', { opt: 'F', acc: '40817840500010042371', lines: ['LAVRENTIEV DMITRY OLEGOVICH', 'RU/ MOSCOW, 117279'] })).toEqual({
      main: 'LAVRENTIEV DMITRY OLEGOVICH', second: '40817840500010042371',
      full: ['/40817840500010042371', '1/ LAVRENTIEV DMITRY OLEGOVICH', '2/ RU/ MOSCOW, 117279'],
    })
  })
  it('банк: наименование и BIC последней строкой', () => {
    expect(swiftPresent('57', { opt: 'A', lines: ['VOSTOCHNY KREDIT BANK KHABAROVSK BR', 'VKRBRU8KXXX'] })).toMatchObject({ main: 'VOSTOCHNY KREDIT BANK KHABAROVSK BR', second: 'VKRBRU8KXXX' })
  })
  it('одиночный BIC — только справа', () => {
    expect(swiftPresent('53', { opt: 'A', lines: ['BCLHLV22XXX'] })).toMatchObject({ main: '', second: 'BCLHLV22XXX' })
  })
})
```

- [ ] **Step 4: маппер — тест (падает).** Создать `apps/pi/src/entities/fx-doc/api/detail.example.ts` — канонический пример ответа (Task 12 переносит его в `pi-api.md` дословно):

```ts
/** Пример ответа GET /grids/fx-docs/documents/{id} (MT103, данные вымышленные; значения полей — со стенда, index.html:747–824). Источник примера в pi-api.md. */
export const FX_DETAIL_EXAMPLE = {
  id: 'u1', docNumber: 812345, refIn: 'FX2609220000417', refOut: null, uetr: 'eb6305c9-1f8c-41e3-a3b2-6d7e9f2a4c10',
  created: '2026-09-23T10:52:11', vdDt: '2026-09-23', vdKt: '2026-09-23',
  type: 'MT103', direction: 'IN', dirTxt: 'Входящий от ЦБ', amount: 1500.5, currency: 'USD',
  f50name: 'LAVRENTIEV DMITRY OLEGOVICH', f50acc: '40817840500010042371', purpose: 'Оплата по договору № 12-45 от 01.03.2026',
  f52: 'NRDIRUMMXXX', f57: 'VKRBRU8KXXX', f59name: 'SEMENOVA IRINA VLADIMIROVNA', f59acc: '40817840100050017762',
  status: 'ERROR', reason: 'Превышен лимит',
  sender: 'NRDIRUMMXXX', receiver: 'VKRBRU8KXXX', provS: 'LORO', provR: 'NOSTRO',
  lock: null, inactive: null,
  f50opt: 'F', f59opt: 'F', f52name: 'NORDINVEST BANK MOSCOW', f57name: 'VOSTOCHNY KREDIT BANK KHABAROVSK BR',
  f58: null, f58name: null, outSender: 'VKRBRU8KXXX', outReceiver: 'BCLHLV22XXX',
  routeType: 'NOSTRO', routeRecv: 'BCLHLV22XXX', routeAcc: '30114840900000000517',
  numDate: '2026-09-23',
  valueDates: ['2026-09-23', '2026-09-23', '2026-09-23', '2026-09-23'],
  fields: {
    '20': { lines: ['FX2609220000417'] },
    '21': { lines: ['NONREF'] },
    '71A': { lines: ['OUR'] },
    '71F': { lines: ['USD 35,00'] },
    '33B': { lines: ['EUR 1148300,00'] },
    '36': { lines: ['1,0886'] },
    '77B': { lines: [] },
    '50': { opt: 'F', acc: '40817840500010042371', lines: ['LAVRENTIEV DMITRY OLEGOVICH', 'ULITSA PROFSOYUZNAYA 83-1-214', 'RU/ MOSCOW, 117279'] },
    '52': { opt: 'A', lines: ['NORDINVEST BANK MOSCOW', 'NRDIRUMMXXX'] },
    '53': { opt: 'A', lines: ['BALTIC CLEARING BANK RIGA', 'BCLHLV22XXX'] },
    '54': { opt: 'A', lines: ['HANSEATIC TRADE BANK HAMBURG', 'HSTBDEHHXXX'] },
    '55': { lines: [] },
    '56': { opt: 'A', lines: ['MERIDIAN INTERMEDIARY BANK LONDON', 'MRDNGB2LXXX'] },
    '57': { opt: 'A', lines: ['VOSTOCHNY KREDIT BANK KHABAROVSK BR', 'VKRBRU8KXXX'] },
    '59': { opt: 'F', acc: '40817840100050017762', lines: ['SEMENOVA IRINA VLADIMIROVNA', 'PROSPEKT MIRA 101-2-45', 'RU/ MOSCOW, 129085'] },
    '70': { lines: ['/INV/ 2026-0417 DD 15.09.2026', 'PAYMENT FOR CONSULTING SERVICES', 'UNDER CONTRACT 12-45 DD 01.03.2026', 'VAT NOT APPLICABLE'] },
    '72': { lines: ['/INS/ NRDIRUMMXXX', '/ACC/ PLEASE CREDIT WITHOUT DELAY', '/REC/ REF FX2609220000417', '/BNF/ CONTRACT 12-45 DD 01.03.2026', '/INT/ MRDNGB2LXXX', '//CHARGES OUR'] },
  },
  inSender: 'NRDIRUMMXXX', inReceiver: 'VKRBRU8KXXX',
  accDt: '30110840700000001842', accKt: '40817840100050017762',
  routeDesc: 'Счёт ностро в Baltic Clearing Bank (Рига), USD',
  routeText: 'Маршрут через Baltic Clearing по правилу для USD от контрагентов ЕС',
  txId: 'ba5ac473-d0a4-40ea-b639-47326d3b8e45', txAt: '2026-09-23T10:52:21',
  txs: [
    { dir: 'DEBIT', st: 'EXECUTED', acc: '30110840700000001842', reg: '00000_NostroUSD', time: '2026-09-23T07:52:22.730Z', amount: 1500.5, currency: 'USD' },
    { dir: 'CREDIT', st: 'EXECUTED', acc: '40817840100050017762', reg: '00010_ClientCurrent', time: '2026-09-23T07:52:22.731Z', amount: 1500.5, currency: 'USD' },
    { dir: 'CREDIT', st: 'PENDING', acc: '47422840500000000311', reg: '00030_FxConversion', time: null, amount: 1500.5, currency: 'USD' },
  ],
  tabsOff: ['mpu'],
}
```

  Создать `apps/pi/src/entities/fx-doc/api/detail.mapper.test.ts`:

```ts
import { ApiError } from '../../../shared/api'
import { FX_DETAIL_EXAMPLE as ex } from './detail.example'
import { parseFxDocDetail } from './detail.mapper'

describe('parseFxDocDetail (пример pi-api.md)', () => {
  it('ответ контракта → FxDocDetail: строка реестра, поля, даты, блоки', () => {
    const d = parseFxDocDetail(ex, 'ответ')
    expect(d).toMatchObject({ id: 'u1', docNumber: 812345, type: 'MT103', status: 'ERROR', amount: 1500.5, numDate: '2026-09-23', accDt: '30110840700000001842', inSender: 'NRDIRUMMXXX', tabsOff: ['mpu'] })
    expect(d.valueDates).toEqual(['2026-09-23', '2026-09-23', '2026-09-23', '2026-09-23'])
    expect(d.fields['50']).toEqual(ex.fields['50'])
    expect(d.fields['55']).toEqual({ lines: [] })
    expect(d.txs).toHaveLength(3)
    expect(d.txs[2]).toMatchObject({ st: 'PENDING', time: null })
  })
  it('пустая буква опции — поля opt нет (59 допускает опцию без буквы)', () => {
    const d = parseFxDocDetail({ ...ex, fields: { '59': { opt: '', lines: ['X'] } } }, 'ответ')
    expect(d.fields['59']).toEqual({ lines: ['X'] })
  })
  it('битая форма — contractError с путём', () => {
    expect(() => parseFxDocDetail({ ...ex, fields: { '50': { lines: 'LAVRENTIEV' } } }, 'ответ')).toThrow('ответ.fields.50.lines: ожидался массив')
    expect(() => parseFxDocDetail({ ...ex, valueDates: ['2026-09-23'] }, 'ответ')).toThrow('ответ.valueDates: ожидалось 4 даты')
    expect(() => parseFxDocDetail({ ...ex, txs: [{ ...ex.txs[0], st: 'DONE' }] }, 'ответ')).toThrow('ответ.txs[0].st: недопустимое значение «DONE»')
    expect(() => parseFxDocDetail({ ...ex, amount: '1 500' }, 'ответ')).toThrow(ApiError)
  })
})
```

- [ ] **Step 5: маппер и порты.** Создать `apps/pi/src/entities/fx-doc/api/detail.mapper.ts`:

```ts
import { contractError, obj, str, strArr, strOrNull } from '../../../shared/api'
import { parseTxs } from '../../posting/@x/fx-doc'
import type { FxDocDetail, SwiftValue } from '../model/detail'
import { parseFxDoc } from './fxDoc.mapper'

function parseSwiftValue(raw: unknown, path: string): SwiftValue {
  const o = obj(raw, path)
  const opt = strOrNull(o, 'opt', path)
  const acc = strOrNull(o, 'acc', path)
  // пустая буква опции (59 допускает '') и пустой счёт — как отсутствие
  return { lines: strArr(o.lines, `${path}.lines`), ...(opt ? { opt } : {}), ...(acc ? { acc } : {}) }
}

function parseFields(raw: unknown, path: string): Record<string, SwiftValue> {
  const o = obj(raw, path)
  const out: Record<string, SwiftValue> = {}
  for (const tag of Object.keys(o)) out[tag] = parseSwiftValue(o[tag], `${path}.${tag}`)
  return out
}

/** Ответ GET /grids/fx-docs/documents/{id} → FxDocDetail. Если бек называет поля иначе — правится только этот файл. */
export function parseFxDocDetail(raw: unknown, path: string): FxDocDetail {
  const o = obj(raw, path)
  const vd = strArr(o.valueDates, `${path}.valueDates`)
  if (vd.length !== 4) throw contractError(`${path}.valueDates: ожидалось 4 даты (вх, исх, по Дт, по Кт)`)
  return {
    ...parseFxDoc(o, path),
    numDate: str(o, 'numDate', path),
    valueDates: [vd[0]!, vd[1]!, vd[2]!, vd[3]!],
    fields: parseFields(o.fields, `${path}.fields`),
    inSender: strOrNull(o, 'inSender', path),
    inReceiver: strOrNull(o, 'inReceiver', path),
    accDt: str(o, 'accDt', path),
    accKt: str(o, 'accKt', path),
    routeDesc: str(o, 'routeDesc', path),
    routeText: str(o, 'routeText', path),
    txId: str(o, 'txId', path),
    txAt: str(o, 'txAt', path),
    txs: parseTxs(o.txs, `${path}.txs`),
    tabsOff: strArr(o.tabsOff, `${path}.tabsOff`),
  }
}
```

  Заменить `apps/pi/src/entities/fx-doc/api/ports.ts`:

```ts
import { createGridPorts } from '../../../shared/api'
import { parseFxDocDetail } from './detail.mapper'
import { parseFxDoc } from './fxDoc.mapper'

export const fxDocPorts = createGridPorts({ gridId: 'fx-docs', parseRow: parseFxDoc, parseDetail: parseFxDocDetail })
```

  Run: `pnpm --filter pi test -- fx-doc` — PASS (маппер, профили).
- [ ] **Step 6: блоки и домен — тест (падает).** Создать `apps/pi/src/entities/fx-doc/ui/detail.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { ConfigForm } from '@katran/ui'
import { renderK } from '../../../shared/lib/test'
import { FX_DETAIL_EXAMPLE } from '../api/detail.example'
import { parseFxDocDetail } from '../api/detail.mapper'
import type { FxDocDetail } from '../model/detail'
import { fxDocDetailDomain as dom } from './detail'

const d = parseFxDocDetail(FX_DETAIL_EXAMPLE, 'ответ')
const renderMain = (doc: FxDocDetail = d) => renderK(
  <ConfigForm schema={dom.schemaOf(doc)} fields={dom.fields} value={(t) => dom.value(doc, t)} present={dom.present}
    optionLabels={dom.optionLabels} renderHero={(id) => dom.renderHero(doc, id)} renderBlock={(id) => dom.renderBlock(doc, id)} />,
)
const hero = () => document.querySelector('[data-part="hero"]') as HTMLElement

describe('«Общие данные» валюты (PROFILES стенда)', () => {
  it('сводка MT103: 20 · № / от, 71A, валютирование с ✓, сумма справа', () => {
    renderMain()
    expect(hero()).toHaveTextContent('FX2609220000417')
    expect(hero()).toHaveTextContent('№ 812345 от 23.09.2026')
    expect(hero()).toHaveTextContent('OUR')
    expect(within(hero()).getByRole('img', { name: 'Вх, Исх, по Дт и по Кт совпадают' })).toBeInTheDocument()
    expect(hero()).toHaveTextContent(/1\s500\.50USD/)
  })

  it('сообщения: S → R входящего и исходящего, 20 исх — «нет значения», счета группами', () => {
    renderMain()
    expect(screen.getByText('Входящее SWIFT').parentElement).toHaveTextContent('NRDIRUMMXXX→VKRBRU8KXXX')
    expect(screen.getByText('Исходящее SWIFT').parentElement).toHaveTextContent('нет значения')
    expect(screen.getByText('30110 840 7 0000 0001842')).toBeInTheDocument()
  })

  it('маршрут раскрыт, транзакции свёрнуты со сводкой', async () => {
    renderMain()
    expect(screen.getByRole('button', { name: 'Маршрут' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Маршрут через Baltic Clearing по правилу для USD от контрагентов ЕС')).toBeVisible()
    const tx = screen.getByRole('button', { name: 'Транзакции' })
    expect(tx).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('img', { name: 'PENDING' })).toBeInTheDocument()
    await userEvent.click(tx)
    expect(screen.getByText('00030_FxConversion')).toBeVisible()
  })

  it('поля: сторона со счётом, банк с BIC, пустое 55 скрыто, пары 53–57', () => {
    renderMain()
    const f50 = document.querySelector('[data-field="50"]') as HTMLElement
    expect(f50).toHaveTextContent('LAVRENTIEV DMITRY OLEGOVICH')
    expect(f50).toHaveTextContent('40817840500010042371')
    expect(document.querySelector('[data-field="57"]')).toHaveTextContent('VKRBRU8KXXX')
    expect(document.querySelector('[data-field="55"]')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Поля MT103' })).toBeInTheDocument()
    expect(screen.getByText('77B').parentElement).toHaveTextContent('не заполнено')
  })

  it('MT202COV — последовательность B; MT199 — только 79, без «Развернуть поля»', () => {
    const cov: FxDocDetail = { ...d, type: 'MT202COV', fields: { ...d.fields, 'B.50': d.fields['50']! } }
    const { unmount } = renderMain(cov)
    expect(screen.getByRole('heading', { name: 'Покрываемый клиентский платёж · последовательность B' })).toBeInTheDocument()
    expect(document.querySelector('[data-field="B.50"]')).toHaveTextContent('LAVRENTIEV')
    unmount()
    renderMain({ ...d, type: 'MT199', fields: { ...d.fields, '79': { lines: ['RE YOUR MT103 FX2609220000417'] } } })
    expect(document.querySelector('[data-field="79"]')).toHaveTextContent('RE YOUR MT103')
    expect(screen.queryByRole('button', { name: 'Развернуть поля' })).toBeNull()
  })

  it('шапка и лейн: из детали и из строки реестра', () => {
    expect(dom.summary(d)).toEqual({
      label: 'Платёжная инструкция № 812345', uuid: 'u1', created: '23.09.2026 10:52:11', type: 'MT103',
      status: { tone: 'bad', label: 'Ошибка' }, kind: 'Клиентский перевод · Входящий от ЦБ', tabsOff: ['mpu'],
    })
    expect(dom.rowSummary(d).tabsOff).toEqual([])
  })

  it('без нарушений axe', async () => {
    const { container } = renderMain()
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

- [ ] **Step 7: блоки и домен — реализация.** Создать `apps/pi/src/entities/fx-doc/ui/detail.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Disclosure, Tag, formatAmount, formatDate, formatDateTimeFull, type HeroCell } from '@katran/ui'
import type { DetailDomain, DetailSummary } from '../../../shared/lib/detail'
import { STATUS_LABEL, STATUS_TONE } from '../../doc-status/@x/fx-doc'
import { TxBlock } from '../../posting/@x/fx-doc'
import type { FxDocDetail } from '../model/detail'
import type { FxDoc } from '../model/fxDoc'
import { FX_ACTIONS, FX_DETAIL_TITLE, FX_FIELDS, FX_OPTION_LABELS, FX_PROFILES, FX_TABS, fxSchemaOf, swiftPresent } from '../model/swift'
import s from './detail.module.css'

/** Счёт группами 5-3-1-4-7 (эталон accFmt, index.html:1302). */
const groupAccount = (a: string) => (a.length === 20 ? `${a.slice(0, 5)} ${a.slice(5, 8)} ${a.slice(8, 9)} ${a.slice(9, 13)} ${a.slice(13)}` : a)

function Mono({ v }: { v: string | null }) {
  return v
    ? <span className={[s.mono, s.cut].join(' ')}>{v}</span>
    : <span className={s.none}><span aria-hidden="true">—</span><span className={s.sr}>нет значения</span></span>
}
function Pair({ from, to }: { from: string | null; to: string | null }) {
  if (!from || !to) return <Mono v={null} />
  return <span className={[s.mono, s.cut].join(' ')}>{from}<span className={s.ar}>→</span>{to}</span>
}

/** Сообщения и счета (эталон B.msgs, index.html:1357): входящее, исходящее, Дт/Кт. Правка 20 исх и счетов — 2c. */
export function FxMessages({ d }: { d: FxDocDetail }) {
  return (
    <div className={s.msgs}>
      <div className={s.col}>
        <div className={s.colTitle}>Входящее SWIFT</div>
        <span className={s.lbl}>S → R</span><Pair from={d.inSender} to={d.inReceiver} />
        <span className={s.lbl}>20 вх</span><Mono v={d.fields['20']?.lines[0] ?? null} />
      </div>
      <div className={s.col}>
        <div className={s.colTitle}>Исходящее SWIFT</div>
        <span className={s.lbl}>S → R</span><Pair from={d.outSender} to={d.outReceiver} />
        <span className={s.lbl}>20 исх</span><Mono v={d.refOut} />
      </div>
      <div className={s.col}>
        <div className={s.colTitle}>Счета</div>
        <span className={s.lbl}>Дт</span><Mono v={groupAccount(d.accDt)} />
        <span className={s.lbl}>Кт</span><Mono v={groupAccount(d.accKt)} />
      </div>
    </div>
  )
}

/** Маршрут (эталон B.route, index.html:1361): тип, счёт → получатель в заголовке, правило в теле; раскрыт. */
export function FxRoute({ d }: { d: FxDocDetail }) {
  return (
    <Disclosure
      title="Маршрут"
      defaultOpen
      aside={(
        <span className={s.routeLine}>
          <Tag>{d.routeType}</Tag>
          <span className={s.lbl}>Счёт</span><span className={s.mono} data-k-tip={d.routeDesc}>{d.routeAcc}</span>
          <span className={s.ar}>→</span>
          <span className={s.lbl}>Receiver</span><span className={s.mono}>{d.routeRecv}</span>
        </span>
      )}
    >
      <span className={s.routeText} data-k-tip={d.routeText}>{d.routeText}</span>
    </Disclosure>
  )
}

const fieldTip = (tag: string) => `${tag} · ${FX_FIELDS[tag]?.label ?? ''}`
const line = (d: FxDocDetail, tag: string) => d.fields[tag]?.lines[0] ?? ''

/** Ячейки сводки (эталон heroHtml, index.html:1037). Правка даты валютирования и «Курс» — 2c/2d. */
export function fxHero(d: FxDocDetail, id: string): HeroCell {
  switch (id) {
    case '20':
      return { label: '20 · № / от', tip: fieldTip('20'), value: <><span className={s.mono}>{line(d, '20') || '—'}</span> <span className={s.heroSub}>№ {d.docNumber} от {formatDate(d.numDate)}</span></> }
    case '21':
      return { label: '21', tip: fieldTip('21'), value: <span className={s.mono}>{line(d, '21') || '—'}</span> }
    case '71A':
      return { label: '71A', tip: fieldTip('71A'), value: line(d, '71A') || '—' }
    case 'vd': {
      const [vin, vout, vdt, vkt] = d.valueDates
      const same = vin === vout && vin === vdt && vin === vkt
      return {
        label: 'Валютирование',
        tip: `Вх: ${formatDate(vin)} · Исх: ${formatDate(vout)} · по Дт: ${formatDate(vdt)} · по Кт: ${formatDate(vkt)}`,
        value: <>{formatDate(vin)}{same && <span className={s.same} role="img" aria-label="Вх, Исх, по Дт и по Кт совпадают">✓</span>}</>,
      }
    }
    case '32A':
      return { label: '32A · сумма', tip: fieldTip('32A'), align: 'right', value: <span className={s.amt}>{formatAmount(d.amount)}<small className={s.ccy}>{d.currency}</small></span> }
    default:
      return { label: id, value: '—' }
  }
}

/** Блоки-слоты профиля: msgs, route, tx. */
export function fxBlock(d: FxDocDetail, id: string): ReactNode {
  if (id === 'msgs') return <FxMessages d={d} />
  if (id === 'route') return <FxRoute d={d} />
  if (id === 'tx') return <TxBlock txs={d.txs} txId={d.txId} txAt={d.txAt} />
  return null
}

/** Шапка и лейн из строки реестра — до загрузки детали и при ошибке (спека 2a §4.3). */
export function fxRowSummary(row: FxDoc): DetailSummary {
  return {
    label: `${FX_DETAIL_TITLE} № ${row.docNumber}`,
    uuid: row.id,
    created: formatDateTimeFull(row.created),
    type: row.type,
    status: { tone: STATUS_TONE[row.status], label: STATUS_LABEL[row.status] },
    kind: `${FX_PROFILES[row.type].title} · ${row.dirTxt}`,
    tabsOff: [],
  }
}
export const fxDocSummary = (d: FxDocDetail): DetailSummary => ({ ...fxRowSummary(d), tabsOff: d.tabsOff })

/** Всё доменное для widgets/doc-detail (спека 2a §4.3). */
export const fxDocDetailDomain: DetailDomain<FxDocDetail, FxDoc> = {
  title: FX_DETAIL_TITLE,
  tabs: FX_TABS,
  actions: FX_ACTIONS,
  fields: FX_FIELDS,
  optionLabels: FX_OPTION_LABELS,
  present: swiftPresent,
  schemaOf: fxSchemaOf,
  value: (d, tag) => d.fields[tag] ?? null,
  summary: fxDocSummary,
  rowSummary: fxRowSummary,
  renderHero: fxHero,
  renderBlock: fxBlock,
}
```

  Создать `apps/pi/src/entities/fx-doc/ui/detail.module.css`:

```css
/* Блоки «Общих данных» валюты (эталон .msgs/.hero/.amt/.ln, index.html:131–175) */
.msgs {
  display: grid;
  grid-template-columns: 1fr 1fr 1.15fr;
  border: 1px solid var(--k-line);
  border-radius: var(--k-r-s);
}

.col {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0 var(--k-sp-2);
  align-content: start;
  min-width: 0;
  padding: var(--k-sp-1) var(--k-sp-2);
}

.col + .col {
  border-left: 1px solid var(--k-line);
}

.colTitle {
  grid-column: 1 / -1;
  font: 500 var(--k-fs-3) / var(--k-lh-3) var(--k-sans);
  letter-spacing: 0.03em;
  color: var(--k-muted);
}

.lbl {
  font-size: var(--k-fs-2);
  color: var(--k-muted);
}

.mono {
  font: var(--k-fs-1) / var(--k-lh-1) var(--k-mono);
  letter-spacing: -0.01em;
  color: var(--k-val);
}

.cut {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.none {
  color: var(--k-faint);
}

.ar {
  margin: 0 var(--k-sp-1);
  color: var(--k-faint);
}

.sr {
  position: absolute;
  inline-size: 0;
  block-size: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.heroSub {
  font-weight: 500;
}

.amt {
  font: 600 var(--k-fs-sum) / 1 var(--k-sans);
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ccy {
  margin-left: var(--k-sp-1);
  font-size: var(--k-fs-1);
  font-weight: 600;
  color: var(--k-val);
}

.same {
  margin-left: var(--k-sp-1);
  font-size: var(--k-fs-2);
  color: var(--k-ok);
}

.routeLine {
  display: inline-flex;
  align-items: baseline;
  gap: 0 var(--k-sp-2);
  min-width: 0;
  white-space: nowrap;
}

.routeText {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--k-val);
}
```

  В `apps/pi/src/entities/fx-doc/index.ts` добавить:

```ts
export type { FxDocDetail, SwiftValue } from './model/detail'
export { FX_ACTIONS, FX_DETAIL_TITLE, FX_FIELDS, FX_OPTION_LABELS, FX_PROFILES, FX_TABS, fxSchemaOf, swiftPresent } from './model/swift'
export { parseFxDocDetail } from './api/detail.mapper'
export { FX_DETAIL_EXAMPLE } from './api/detail.example'
export { fxBlock, fxDocDetailDomain, fxDocSummary, fxHero, fxRowSummary } from './ui/detail'
```

  Run: `pnpm --filter pi test -- fx-doc` — PASS.
- [ ] **Step 8: данные фейка.** Создать `apps/pi/src/app/fake/fx-docs.detail.ts`:

```ts
import type { FxDoc } from '../../entities/fx-doc'

// Словари — со стенда pi-constructor (index.html:742–757, grid.html:1747–1783), обезличен; данные вымышленные.
const ROUTE_BY_TYPE: Record<FxDoc['routeType'], { desc: string; text: string }> = {
  NOSTRO: { desc: 'Счёт ностро в Baltic Clearing Bank (Рига), USD', text: 'Маршрут через Baltic Clearing по правилу для USD от контрагентов ЕС' },
  LORO: { desc: 'Счёт лоро Meridian Intermediary Bank, USD', text: 'Зачисление через лоро-счёт посредника, правило LORO_USD_V2' },
  INTERNAL: { desc: 'Внутрибанковский конверсионный счёт', text: 'Внутренний маршрут: счёт Кт открыт в нашем банке, внешний перевод не требуется' },
}
const ADDR50 = ['ULITSA PROFSOYUZNAYA 83-1-214', 'RU/ MOSCOW, 117279']
const ADDR59 = ['PROSPEKT MIRA 101-2-45', 'RU/ MOSCOW, 129085']
const B53 = { opt: 'A', lines: ['BALTIC CLEARING BANK RIGA', 'BCLHLV22XXX'] }
const B54 = { opt: 'A', lines: ['HANSEATIC TRADE BANK HAMBURG', 'HSTBDEHHXXX'] }
const B55 = { opt: 'A', lines: ['CENTRAL EURO SETTLEMENT AG FRANKFURT', 'CESEDEFFXXX'] }
const B56 = { opt: 'A', lines: ['MERIDIAN INTERMEDIARY BANK LONDON', 'MRDNGB2LXXX'] }
const T72 = ['/INS/ NRDIRUMMXXX', '/ACC/ PLEASE CREDIT WITHOUT DELAY', '/REC/ REF FX2609220000417', '/BNF/ CONTRACT 12-45 DD 01.03.2026', '/INT/ MRDNGB2LXXX', '//CHARGES OUR']
const T79 = ['RE YOUR MT103 FX2609220000417 DD 22.09.2026', 'AMOUNT USD 1250000,00', 'PLS BE ADVISED THAT BENEFICIARY ACCOUNT', '40817840100050017762 IS CLOSED.', 'KINDLY AUTHORIZE US TO RETURN THE FUNDS', 'LESS OUR CHARGES USD 35,00', 'OR PROVIDE AMENDED BENEFICIARY DETAILS.', 'BEST REGARDS', 'PAYMENTS DEPT, VOSTOCHNY KREDIT BANK']
const CHARGES = ['OUR', 'SHA', 'BEN']
const EMPTY = { lines: [] as string[] }
const pad = (n: number, w: number) => String(n).padStart(w, '0')
/** Строки по 35 знаков по границе слова — формат поля 70 (эталон grid.html:1783). */
const by35 = (s: string) => (s.match(/.{1,35}(?=\s|$)|.{1,35}/g) ?? []).map((x) => x.trim()).filter(Boolean)
const swiftAmount = (n: number) => n.toFixed(2).replace('.', ',')

/**
 * Деталь валютного документа (спека 2a §4.4): строка реестра как есть (номер, сумма, статус совпадают с реестром)
 * плюс поля по профилю, сообщения, маршрут и проводки — детерминированно по номеру строки i.
 */
export function makeFxDocDetail(row: FxDoc, i: number): Record<string, unknown> {
  const inbound = row.direction === 'IN' || row.direction === 'TRANSIT'
  const accDt = inbound ? row.routeAcc : row.f50acc
  const accKt = inbound ? row.f59acc : row.routeAcc
  const party50 = { opt: row.f50opt, acc: row.f50acc, lines: [row.f50name, ...ADDR50] }
  const party59 = { opt: row.f59opt, acc: row.f59acc, lines: [row.f59name, ...ADDR59] }
  const bank52 = { opt: 'A', lines: [row.f52name, row.f52] }
  const bank57 = { opt: 'A', lines: [row.f57name, row.f57] }
  const f70 = { lines: row.purpose ? by35(row.purpose) : [] }
  const cover = { lines: [`${row.currency} ${swiftAmount(row.amount)}`] }
  const fields: Record<string, unknown> = {
    '20': { lines: row.refIn ? [row.refIn] : [] },
    '21': { lines: ['NONREF'] },
    '71A': { lines: [CHARGES[i % 3]!] },
    '71F': i % 3 === 0 ? { lines: [`${row.currency} 35,00`] } : EMPTY,
    '33B': i % 4 === 0 ? cover : EMPTY,
    '36': i % 4 === 0 ? { lines: ['1,0886'] } : EMPTY,
    '77B': i % 5 === 0 ? { lines: ['/ORDERRES/RU//CONTRACT 12-45 DD 01.03.2026'] } : EMPTY,
    '50': party50, '52': bank52, '53': i % 2 === 0 ? B53 : EMPTY, '54': i % 3 !== 1 ? B54 : EMPTY,
    '55': i % 4 === 0 ? B55 : EMPTY, '56': i % 3 === 0 ? B56 : EMPTY, '57': bank57,
    '58': row.f58 ? { opt: 'A', lines: [row.f58name ?? '', row.f58] } : EMPTY,
    '59': party59, '70': f70, '72': i % 2 === 0 ? { lines: T72 } : EMPTY,
    '79': row.type === 'MT199' ? { lines: T79 } : EMPTY,
  }
  if (row.type === 'MT202COV') {
    Object.assign(fields, {
      'B.50': party50, 'B.52': bank52, 'B.56': i % 3 === 0 ? B56 : EMPTY, 'B.57': bank57, 'B.59': party59, 'B.70': f70,
      'B.72': { lines: ['/INS/ NRDIRUMMXXX', `/BNF/ COVER FOR ${row.refIn ?? 'NONREF'}`] }, 'B.33B': cover,
    })
  }
  const pending = row.status === 'IN_PROGRESS' || row.status === 'ERROR' || row.status === 'DEFERRED'
  const base = Date.parse(`${row.created}Z`)
  const at = (sec: number) => new Date(base + sec * 1000 + ((i * 37) % 1000)).toISOString()
  const tx = (dir: 'DEBIT' | 'CREDIT', st: 'EXECUTED' | 'PENDING' | 'CANCELED', acc: string, reg: string, sec: number, amount = row.amount) =>
    ({ dir, st, acc, reg, time: st === 'PENDING' ? null : at(sec), amount, currency: row.currency })
  const txs = [
    tx('DEBIT', 'EXECUTED', accDt, `00000_Nostro${row.currency}`, 1),
    tx('CREDIT', pending ? 'PENDING' : 'EXECUTED', accKt, '00010_ClientCurrent', 2),
    ...(row.status === 'REJECTED' ? [tx('CREDIT', 'CANCELED', accKt, '00010_ClientCurrent', 2)] : []),
    ...(i % 3 === 0 ? [tx('DEBIT', 'EXECUTED', accKt, '00010_ClientCurrent', 3, 35), tx('CREDIT', 'EXECUTED', '70601840100000000519', '00020_CommissionIncome', 3, 35)] : []),
  ]
  return {
    ...row,
    numDate: row.created.slice(0, 10),
    valueDates: [row.vdDt, row.vdDt, row.vdDt, row.vdKt],
    fields,
    inSender: inbound ? row.sender : null,
    inReceiver: inbound ? row.receiver : null,
    accDt, accKt,
    routeDesc: ROUTE_BY_TYPE[row.routeType].desc,
    routeText: ROUTE_BY_TYPE[row.routeType].text,
    txId: `ba5ac4${pad(i % 100, 2)}-d0a4-40ea-b639-${pad((i * 7919) % 1e12, 12)}`,
    txAt: row.created,
    txs,
    tabsOff: i % 2 ? ['notif', 'stream', 'mpu'] : ['mpu'],
  }
}
```

  В `apps/pi/src/app/fake/grids.ts` добавить импорт `import { makeFxDocDetail } from './fx-docs.detail'` и в опции `fx-docs` — `detail: makeFxDocDetail`: `fakeGrid(makeFxDocs(), fxDocLayout.columns, fxDocsMeta, { sortLabels: { status: STATUS_LABEL }, detail: makeFxDocDetail })`.
- [ ] **Step 9: контрактная цепочка.** В `apps/pi/src/app/fake/contract.test.ts` добавить импорт `import { FX_TYPES } from '../../entities/fx-doc'` и блок:

```ts
describe('контракт детали fx-docs (спека 2a §6): порт → requestFx → фейк', () => {
  const firstRows = async (sc: ReturnType<typeof scope>) => {
    const page = await allSettled(fxDocPorts.searchFx, { scope: sc, params: { filter: [], sort: [], page: 0, size: 100 } })
    if (page.status !== 'done') throw new Error('search не прошёл')
    return page.value.rows
  }
  it('200: номер, сумма, статус и стороны — как в строке реестра', async () => {
    const sc = scope()
    const row = (await firstRows(sc))[0]!
    const r = await allSettled(fxDocPorts.detailFx, { scope: sc, params: row.id })
    expect(r.status).toBe('done')
    if (r.status !== 'done') return
    expect(r.value).toMatchObject({ id: row.id, docNumber: row.docNumber, amount: row.amount, status: row.status, type: row.type })
    expect(r.value.fields['50']?.acc).toBe(row.f50acc)
    expect(r.value.fields['57']?.lines).toEqual([row.f57name, row.f57])
  })
  it('каждый тип MT разбирается маппером; у MT202COV есть последовательность B', async () => {
    const sc = scope()
    const rows = await firstRows(sc)
    for (const t of FX_TYPES) {
      const row = rows.find((x) => x.type === t)
      if (!row) continue
      const r = await allSettled(fxDocPorts.detailFx, { scope: sc, params: row.id })
      expect(r.status, t).toBe('done')
      if (r.status === 'done' && t === 'MT202COV') expect(r.value.fields['B.50']).toBeDefined()
    }
  })
  it('404 на неизвестный id; 500 по регулятору detail', async () => {
    const nope = await allSettled(fxDocPorts.detailFx, { scope: scope(), params: 'nope' })
    expect(nope.status).toBe('fail')
    expect((nope.value as ApiError).status).toBe(404)
    const failing = fork({ handlers: [[requestFx, createFakeServer(fakeGrids, { failing: () => 'detail' })]] })
    const sc = scope()
    const row = (await firstRows(sc))[0]!
    const r = await allSettled(fxDocPorts.detailFx, { scope: failing, params: row.id })
    expect((r.value as ApiError).status).toBe(500)
  })
})
```

  (`fork`, `allSettled`, `requestFx`, `ApiError`, `createFakeServer`, `fakeGrids` в файле уже импортированы — проверить, недостающие добавить.)
- [ ] **Step 10: запуск.** `pnpm --filter pi test` — PASS. `pnpm check` — зелёный (eslint: `fx-doc` берёт `posting` и `doc-status` только через `@x/fx-doc.ts`).
- [ ] **Step 11: commit.**

```bash
git add apps/pi/src/entities/posting apps/pi/src/entities/fx-doc/model/detail.ts apps/pi/src/entities/fx-doc/model/swift.ts apps/pi/src/entities/fx-doc/model/swift.test.ts apps/pi/src/entities/fx-doc/api/detail.mapper.ts apps/pi/src/entities/fx-doc/api/detail.example.ts apps/pi/src/entities/fx-doc/api/detail.mapper.test.ts apps/pi/src/entities/fx-doc/api/ports.ts apps/pi/src/entities/fx-doc/ui/detail.tsx apps/pi/src/entities/fx-doc/ui/detail.module.css apps/pi/src/entities/fx-doc/ui/detail.test.tsx apps/pi/src/entities/fx-doc/index.ts apps/pi/src/app/fake/fx-docs.detail.ts apps/pi/src/app/fake/grids.ts apps/pi/src/app/fake/contract.test.ts
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "apps/pi: деталь валютного документа — профили MT, маппер, блоки «Общих данных», проводки, фейк детали"
```

  (`git add apps/pi/src/entities/posting` — каталог целиком создан этой задачей, его файлы перечислены в «Files».)

---
### Task 9: `entities/rub-doc` — деталь рубля, профили, секции, маппер, данные фейка

**Стоп-точка:** начинать после ответов владельца на **В-Д2** (состав вкладок рубля) и **В-Д3** (пути ED107, коды операций). Ответ «как на эталоне» — всё ниже без изменений; иначе правятся только `RUB_TABS`, `ED107_GROUPS`, `RUB_OPERATION` в `model/profiles.ts` и пример/тесты под них.

**Files:**
- Create: `apps/pi/src/entities/posting/@x/rub-doc.ts`
- Create: `apps/pi/src/entities/rub-doc/{model/detail.ts, model/profiles.ts, model/profiles.test.ts, api/detail.mapper.ts, api/detail.example.ts, api/detail.mapper.test.ts, ui/detail.tsx, ui/detail.module.css, ui/detail.test.tsx}`
- Create: `apps/pi/src/app/fake/rub-docs.detail.ts`
- Modify: `apps/pi/src/entities/rub-doc/api/ports.ts`, `apps/pi/src/entities/rub-doc/index.ts`, `apps/pi/src/app/fake/rub-docs.data.ts` (экспорт `RBANKS`), `apps/pi/src/app/fake/grids.ts`, `apps/pi/src/app/fake/contract.test.ts`

**Interfaces:**
- Produces (`entities/rub-doc`, публичный API):

```ts
type RubParty = Record<'name' | 'opt' | 'acc' | 'inn' | 'kpp' | 'info' | 'addr' | 'bank' | 'bic' | 'bankAcc' | 'bankInfo', string>
type RubAgent = Record<'name' | 'bic' | 'bankAcc' | 'acc', string>
type RubDocDetail = RubDoc & {
  numDate: string; opCode: string; opName: string; scenario: string; sysFrom: string; sysTo: string
  party: { s: RubParty; r: RubParty }
  purposeExtra: Record<'instr' | 'uip' | 'reserve' | 'f20', string>
  agents: RubAgent[]
  budget: Record<'b101' | 'b104' | 'b105' | 'b106' | 'b107' | 'b108' | 'b109' | 'b110', string>
  ed107: Record<'relId' | 'initId' | 'relDate' | 'execDate', string> & { v: Record<string, string> }
  collect: Record<'c48' | 'cLimit' | 'c70' | 'c38' | 'c39' | 'c40' | 'c41', string>
  txAt: string; txs: Tx[]; tabsOff: string[]
}
RUB_DETAIL_TITLE; RFIELDS: Record<string, RubFieldMeta>; RUB_PARTY; RUB_SECTIONS; RSECTION_TITLE; ED107_GROUPS; RUB_OPERATION
RUB_PROFILES: Record<RubType, { title: string; schema: FormSchema }>; rubSchemaOf(d: { type: RubType }): FormSchema
RUB_TABS: DetailTab[]; RUB_ACTIONS: DetailAction[]
parseRubDocDetail(raw: unknown, path: string): RubDocDetail
rubDocPorts: GridPorts<RubDoc> & DetailPort<RubDocDetail>
rubRowSummary(row: RubDoc): DetailSummary; rubDocSummary(d: RubDocDetail): DetailSummary
rubHero(d, id): HeroCell; rubBlock(d, id): ReactNode; rubSection(d, id): SectionContent
rubDocDetailDomain: DetailDomain<RubDocDetail, RubDoc>
RUB_DETAIL_EXAMPLE
```

  Разметка для e2e Task 11: первая строка таблицы сторон — `tr[data-part="party-row"]`.
- Produces (фейк): `makeRubDocDetail(row: RubDoc, i: number): Record<string, unknown>`; `fakeGrids['rub-docs']` отвечает на `GET /grids/rub-docs/documents/{id}`.
- Consumes: всё из Task 7; `TxBlock`, `parseTxs`, `Tx` (через `posting/@x/rub-doc.ts`); `Disclosure`, `LinkValue`, `Tag`, форматтеры (кит).

- [ ] **Step 1: профили — тест (падает).** Создать `apps/pi/src/entities/rub-doc/model/profiles.test.ts`:

```ts
import { RUB_TYPES } from './rubDoc'
import { ED107_GROUPS, RFIELDS, RUB_ACTIONS, RUB_PARTY, RUB_PROFILES, RUB_SECTIONS, RUB_TABS, rubSchemaOf } from './profiles'

describe('профили рубля (PROFILES/RSECTIONS стенда, index.html:689–738)', () => {
  it('у каждого типа — профиль с одной схемой: сводка, блоки, пять секций по порядку', () => {
    for (const t of RUB_TYPES) {
      const sc = rubSchemaOf({ type: t })
      expect(sc.hero).toEqual(['num', 'op', 'queue', 'sum'])
      expect(sc.blocks).toEqual(['scen', 'tx', 'party', 'purpose'])
      expect(sc.sections?.map((x) => x.id)).toEqual([...RUB_SECTIONS])
      expect(sc.grid).toBeUndefined()
    }
    expect(RUB_PROFILES.REQDOCRU.title).toBe('Инкассовое поручение')
  })
  it('у каждого реквизита сторон и секций есть подпись', () => {
    for (const k of RUB_PARTY) expect(RFIELDS[k]?.label, k).toBeTruthy()
    expect(RFIELDS.b104).toEqual({ no: '104', label: 'Код бюджетной классификации', mono: true })
  })
  it('вкладки: ED244 вместо «Исходного текста», без «Доп. полей»; действия — печать четырёх форм', () => {
    expect(RUB_TABS.map((t) => t.id)).toEqual(['main', 'statuses', 'compliance', 'linked', 'tasks', 'notif', 'ed244', 'stream', 'mpu', 'audit'])
    expect(RUB_ACTIONS.find((a) => a.id === 'down')?.label).toBe('Скачать сообщение ED (XML)')
    expect(RUB_ACTIONS.find((a) => a.id === 'print')?.menu).toEqual(['Платёжное поручение', 'Инкассовое поручение', 'Платёжный ордер', 'Мемориальный ордер'])
  })
  it('ED107: шесть подгрупп, узлы как на эталоне', () => {
    expect(ED107_GROUPS.map((g) => g.node)).toEqual(['OrderingBank', 'AcctWithInst', 'Beneficiary', 'PrevInstrAgent', 'InstructingAgent', 'InstructedAgent'])
  })
})
```

- [ ] **Step 2: модель и профили.** Создать `apps/pi/src/entities/rub-doc/model/profiles.ts`:

```ts
import type { FormSchema } from '@katran/ui'
import type { DetailAction, DetailTab } from '../../../shared/lib/detail'
import type { RubType } from './rubDoc'

/** Заголовок деталки (спека 2a §1.1; эталон рубля — «Платёжная инструкция», rubHtml, index.html:1150). */
export const RUB_DETAIL_TITLE = 'Платёжная инструкция'

/** Реквизит рубля: подпись, номер поля платёжного документа (тег), моноширинное значение — RFIELDS стенда (index.html:689). */
export type RubFieldMeta = { label: string; no?: string | undefined; mono?: boolean | undefined }
export const RFIELDS: Record<string, RubFieldMeta> = {
  name: { label: 'Наименование' }, opt: { label: 'Опция' }, acc: { label: 'Номер счёта', mono: true }, inn: { label: 'ИНН', mono: true },
  kpp: { label: 'КПП', mono: true }, info: { label: 'Доп. информация' }, addr: { label: 'Адрес' }, bank: { label: 'Наименование банка' },
  bic: { label: 'БИК', mono: true }, bankAcc: { label: 'Счёт банка', mono: true }, bankInfo: { label: 'Доп. информация' },
  purpose: { label: 'Назначение платежа' },
  instr: { label: 'Инструкция получателю' }, uip: { label: 'УИП', mono: true }, reserve: { label: 'Резервное поле' }, f20: { label: 'Назначение платежа. Поле 20' },
  b101: { no: '101', label: 'Код статуса плательщика', mono: true }, b104: { no: '104', label: 'Код бюджетной классификации', mono: true },
  b105: { no: '105', label: 'ОКТМО', mono: true }, b106: { no: '106', label: 'Основание налогового платежа' },
  b107: { no: '107', label: 'Налоговый период' }, b108: { no: '108', label: 'Номер документа' },
  b109: { no: '109', label: 'Дата налогового документа' }, b110: { no: '110', label: 'Код вида налогового платежа', mono: true },
  c48: { no: '48', label: 'Дата поступления документов' }, cLimit: { label: 'Идентификатор ограничения', mono: true },
  c70: { no: '70', label: 'Содержание операции' }, c38: { no: '38', label: 'Номер частичного платежа' },
  c39: { no: '39', label: 'Шифр частичного платежа' }, c40: { no: '40', label: 'Исходное распоряжение. Номер документа' },
  c41: { no: '41', label: 'Исходное распоряжение. Дата выписки' },
}

/** Строки таблицы «отправитель | получатель» — RUB_PARTY стенда (index.html:718). */
export const RUB_PARTY = ['name', 'opt', 'acc', 'inn', 'kpp', 'info', 'addr', 'bank', 'bic', 'bankAcc', 'bankInfo'] as const
export const PURPOSE_EXTRA_ROWS = ['instr', 'uip', 'reserve', 'f20'] as const
export const BUDGET_ROWS = ['b101', 'b104', 'b105', 'b106', 'b107', 'b108', 'b109', 'b110'] as const
/** «|» — разделитель групп строк секции (эталон RSECTIONS.collect). */
export const COLLECT_ROWS = ['c48', 'cLimit', 'c70', '|', 'c38', 'c39', 'c40', 'c41'] as const
export const COLLECT_KEYS = ['c48', 'cLimit', 'c70', 'c38', 'c39', 'c40', 'c41'] as const
export const AGENT_COLS = [['Наименование', 'name'], ['БИК', 'bic'], ['Счёт банка', 'bankAcc'], ['Счёт получателя', 'acc']] as const
export const AGENT_KEYS = ['name', 'bic', 'bankAcc', 'acc'] as const
export const ED107_HEAD = [['relId', 'ID связанного документа'], ['initId', 'ID инициирующего документа'], ['relDate', 'Дата связанного документа'], ['execDate', 'Запрошенная дата исполнения']] as const
export const ED107_KEYS = ['relId', 'initId', 'relDate', 'execDate'] as const
/** Подгруппы ED107 — узлы ЭС и реквизиты (эталон RSECTIONS.ed107.groups, index.html:707–713; вопрос В-Д3). */
export const ED107_GROUPS = [
  { id: 'payer', title: 'Информация о банке-плательщике', node: 'OrderingBank', rows: ['BIC', 'ed:Name', 'BankAccount', 'SWBIC'] },
  { id: 'acctWith', title: 'Информация об агенте банка-получателя', node: 'AcctWithInst', rows: ['BIC', 'ed:Name', 'BankAccount', 'SWBIC'] },
  { id: 'benef', title: 'Информация о банке-получателе', node: 'Beneficiary', rows: ['BIC', 'ed:Name', 'BankAccount', 'SWBIC'] },
  { id: 'prev', title: 'Информация о предыдущем инструктирующем банке', node: 'PrevInstrAgent', rows: ['BIC', 'ed:Name', 'BankAccount', 'SWBIC'] },
  { id: 'instg', title: 'Информация о банке-отправителе', node: 'InstructingAgent', rows: ['BIC', 'CorrespAcc', 'SWBIC'] },
  { id: 'instd', title: 'Информация о банке-исполнителе', node: 'InstructedAgent', rows: ['BIC', 'CorrespAcc', 'SWBIC'] },
] as const

/** Сворачиваемые секции — RUB_SECTIONS/RSECTIONS стенда (index.html:700–717), по порядку. */
export const RUB_SECTIONS = ['purposeExtra', 'agents', 'budget', 'ed107', 'collect'] as const
export type RubSectionId = (typeof RUB_SECTIONS)[number]
export const RSECTION_TITLE: Record<RubSectionId, string> = {
  purposeExtra: 'Назначение платежа. Дополнительная информация', agents: 'Посредник', budget: 'Бюджетные реквизиты',
  ed107: 'Параметры ED107', collect: 'Параметры инкассового поручения',
}

/** Код операции по типу (эталон r.opCode: 01 — платёжное, 06 — инкассовое; 16 — платёжный ордер; вопрос В-Д3). */
export const RUB_OPERATION: Record<RubType, string> = { PAYDOCRU: '01', REQDOCRU: '06', PAYORDRU: '16' }

const SCHEMA: FormSchema = {
  hero: ['num', 'op', 'queue', 'sum'],
  blocks: ['scen', 'tx', 'party', 'purpose'],
  sections: RUB_SECTIONS.map((id) => ({ id, title: RSECTION_TITLE[id] })),
  sectionsTitle: 'Дополнительные блоки',
}
/** Профили видов документа — PROFILES.PAYDOCRU/REQDOCRU/PAYORDRU стенда (index.html:720–722): компоновка одна, отличается заголовок. */
export const RUB_PROFILES: Record<RubType, { title: string; schema: FormSchema }> = {
  PAYDOCRU: { title: 'Платёжное поручение', schema: SCHEMA },
  REQDOCRU: { title: 'Инкассовое поручение', schema: SCHEMA },
  PAYORDRU: { title: 'Платёжный ордер', schema: SCHEMA },
}
export const rubSchemaOf = (d: { type: RubType }): FormSchema => RUB_PROFILES[d.type].schema

/** Вкладки — TABS_RUB стенда (index.html:723): ED244 вместо «Исходного текста», без «Доп. полей» (вопрос В-Д2). */
export const RUB_TABS: DetailTab[] = [
  { id: 'main', label: 'Общие данные' }, { id: 'statuses', label: 'Статусы' }, { id: 'compliance', label: 'Комплаенс' },
  { id: 'linked', label: 'Связанные документы' }, { id: 'tasks', label: 'Задачи' }, { id: 'notif', label: 'Нотификации' },
  { id: 'ed244', label: 'ED244' }, { id: 'stream', label: 'Стриминг' }, { id: 'mpu', label: 'MPU' }, { id: 'audit', label: 'Аудит' },
]

/** Действия — ACTIONS_RUB стенда (index.html:734): как у валюты, кроме скачивания и форм печати. */
export const RUB_ACTIONS: DetailAction[] = [
  { id: 'refresh', label: 'Обновить', icon: 'refresh', hotkey: 'F5' },
  { id: 'edit', label: 'Редактировать', icon: 'edit', hotkey: 'E' },
  { id: 'esid', label: 'Создать служебный документ', icon: 'doc' },
  { id: 'down', label: 'Скачать сообщение ED (XML)', icon: 'download' },
  { id: 'print', label: 'Печать', icon: 'print', menu: ['Платёжное поручение', 'Инкассовое поручение', 'Платёжный ордер', 'Мемориальный ордер'] },
  { id: 'link', label: 'Скопировать ссылку на документ', icon: 'link' },
  { id: 'ban', label: 'Аннулировать', icon: 'ban', danger: true },
]
```

  Создать `apps/pi/src/entities/rub-doc/model/detail.ts`:

```ts
import type { Tx } from '../../posting/@x/rub-doc'
import type { AGENT_KEYS, BUDGET_ROWS, COLLECT_KEYS, ED107_KEYS, PURPOSE_EXTRA_ROWS, RUB_PARTY } from './profiles'
import type { RubDoc } from './rubDoc'

export type RubParty = Record<(typeof RUB_PARTY)[number], string>
export type RubAgent = Record<(typeof AGENT_KEYS)[number], string>
export type RubPurposeExtra = Record<(typeof PURPOSE_EXTRA_ROWS)[number], string>
export type RubBudget = Record<(typeof BUDGET_ROWS)[number], string>
export type RubCollect = Record<(typeof COLLECT_KEYS)[number], string>
/** Шапка ED107 и значения узлов по пути «узел/реквизит» (эталон ed107.v). */
export type RubEd107 = Record<(typeof ED107_KEYS)[number], string> & { v: Record<string, string> }

/** Рублёвый документ в деталке (спека 2a §4.2): строка реестра плюс реквизиты «Общих данных». Пустой реквизит — ''. */
export type RubDocDetail = RubDoc & {
  /** Дата документа (ISO). */
  numDate: string
  opCode: string
  opName: string
  /** Сценарий и системы S → R (эталон r.scen, r.from, r.to). */
  scenario: string
  sysFrom: string
  sysTo: string
  party: { s: RubParty; r: RubParty }
  purposeExtra: RubPurposeExtra
  agents: RubAgent[]
  budget: RubBudget
  ed107: RubEd107
  collect: RubCollect
  txAt: string
  txs: Tx[]
  /** Вкладки без данных (ключи RUB_TABS). */
  tabsOff: string[]
}
```

  Создать `apps/pi/src/entities/posting/@x/rub-doc.ts`:

```ts
/** Публичный API posting для соседней сущности rub-doc (FSD @x). */
export type { Tx } from '../model/posting'
export { parseTxs } from '../api/posting.mapper'
export { TxBlock } from '../ui/TxBlock'
```

  Run: `pnpm --filter pi test -- profiles` — PASS.
- [ ] **Step 3: маппер — тест (падает).** Создать `apps/pi/src/entities/rub-doc/api/detail.example.ts` (значения — со стенда, первый рублёвый документ, index.html:895–911; обезличены):

```ts
/** Пример ответа GET /grids/rub-docs/documents/{id} (PAYDOCRU, данные вымышленные, со стенда). Источник примера в pi-api.md. */
export const RUB_DETAIL_EXAMPLE = {
  id: 'r1', docNumber: '3741', uuid: '72aa73fb-dae6-4672-8d09-e15afc0a523d', txId: '03d45fed-f505-4fca-a267-60cba12b82f2', docRef: 'ED101-5210472026066',
  created: '2026-09-24T11:08:14', changed: '2026-09-24T11:08:20',
  type: 'PAYDOCRU', edCode: 'ED101', direction: 'IN', dirTxt: 'входящий от ЦБ на клиента', amount: 76394.81, queue: 5, prio: 0,
  fromName: 'ООО «ХУРЫГУПЯ»', fromAcc: '40702810064578557830', fromInn: '4340195751', fromKpp: '473897776', fromBic: '049597373', fromBank: 'АО «ЗОДО БАНК»',
  toName: 'ИП ТЫСЫЛИОВ ГИБАС ЗУДЫОВИЧ', toAcc: '40802810820980451081', toInn: '394831189084', toKpp: '', toBic: '042993195', toBank: 'БАНК «ХАРОГА» (АО)',
  initiator: 'NCB.NCB_IN', source: 'UFX', destination: 'RTL',
  purpose: 'Оплата по счёту № 6945-2101 от 18.07.2026 за оборудование по договору 65-89 от 27.02.2026. В том числе НДС 20% — 18 658.24 руб.',
  status: 'DONE', reason: null, lock: null, inactive: null,
  numDate: '2026-09-24', opCode: '01', opName: 'Платёжное поручение',
  scenario: 'SC_NCB_IN_CREDIT', sysFrom: 'DB01', sysTo: 'DB02',
  party: {
    s: { name: 'ООО «ХУРЫГУПЯ»', opt: '', acc: '40702810064578557830', inn: '4340195751', kpp: '473897776', info: '', addr: '740828, Г. ЛЫСУЛА, УЛ. НИФЕМЯ, Д. 133, ПОМ. 520', bank: 'АО «ЗОДО БАНК»', bic: '049597373', bankAcc: '30101810508469019375', bankInfo: '' },
    r: { name: 'ИП ТЫСЫЛИОВ ГИБАС ЗУДЫОВИЧ', opt: '', acc: '40802810820980451081', inn: '394831189084', kpp: '', info: '', addr: '057617, Г. СОЛОКЫ, УЛ. МЕСОБО, Д. 83, КВ. 143', bank: 'БАНК «ХАРОГА» (АО)', bic: '042993195', bankAcc: '30101810664602335376', bankInfo: 'Филиал в г. Хупево' },
  },
  purposeExtra: { instr: 'Гяналу тыпепо вуза факе пысему вя ни лидефе фотохо ва мезе мокефо', uip: '68578800898192015437', reserve: 'Зувивофе дыто симу', f20: 'Руди фибеку собыве сясе' },
  agents: [
    { name: 'ФИЛИАЛ № 3826 БАНКА «НУВОСЕ» (ПАО)', bic: '041550162', bankAcc: '30101810951233369033', acc: '30110810217115096554' },
    { name: 'БАНК «ВЯХИЛЯ» (АО)', bic: '041916658', bankAcc: '30101810196704420940', acc: '30110810928566570883' },
  ],
  budget: { b101: '', b104: '', b105: '', b106: '', b107: '', b108: '', b109: '', b110: '' },
  ed107: {
    relId: '5108', initId: '46713', relDate: '2026-09-24', execDate: '2026-09-24',
    v: {
      'OrderingBank/BIC': '045131779', 'OrderingBank/ed:Name': 'БАНК «ВУХИДО» (АО)', 'OrderingBank/BankAccount': '30101810105950215060', 'OrderingBank/SWBIC': 'DUZFRUY9',
      'InstructingAgent/BIC': '047485823', 'InstructingAgent/CorrespAcc': '30101810372488940093', 'InstructingAgent/SWBIC': 'XEANRURA',
    },
  },
  collect: { c48: '', cLimit: '', c70: '', c38: '', c39: '', c40: '', c41: '' },
  txAt: '2026-09-24T11:08:20',
  txs: [
    { dir: 'DEBIT', st: 'EXECUTED', acc: '30102810738223744290', reg: '00000_CorrCBR', time: '2026-09-24T08:08:20.114Z', amount: 76394.81, currency: 'RUB' },
    { dir: 'CREDIT', st: 'EXECUTED', acc: '40802810820980451081', reg: '00010_ClientCurrent', time: '2026-09-24T08:08:20.118Z', amount: 76394.81, currency: 'RUB' },
  ],
  tabsOff: ['stream', 'mpu'],
}
```

  Создать `apps/pi/src/entities/rub-doc/api/detail.mapper.test.ts`:

```ts
import { ApiError } from '../../../shared/api'
import { RUB_DETAIL_EXAMPLE as ex } from './detail.example'
import { parseRubDocDetail } from './detail.mapper'

describe('parseRubDocDetail (пример pi-api.md)', () => {
  it('ответ контракта → RubDocDetail: строка реестра, стороны, секции, проводки', () => {
    const d = parseRubDocDetail(ex, 'ответ')
    expect(d).toMatchObject({ id: 'r1', docNumber: '3741', type: 'PAYDOCRU', opCode: '01', scenario: 'SC_NCB_IN_CREDIT', tabsOff: ['stream', 'mpu'] })
    expect(d.party.r.bankInfo).toBe('Филиал в г. Хупево')
    expect(d.agents).toHaveLength(2)
    expect(d.ed107.v['OrderingBank/SWBIC']).toBe('DUZFRUY9')
    expect(d.budget.b101).toBe('')
    expect(d.txs[0]?.currency).toBe('RUB')
  })
  it('битая форма — contractError с путём', () => {
    const noKpp: Record<string, string> = { ...ex.party.s }
    delete noKpp.kpp
    expect(() => parseRubDocDetail({ ...ex, party: { ...ex.party, s: noKpp } }, 'ответ')).toThrow('ответ.party.s.kpp: ожидалась строка')
    expect(() => parseRubDocDetail({ ...ex, agents: {} }, 'ответ')).toThrow('ответ.agents: ожидался массив')
    expect(() => parseRubDocDetail({ ...ex, ed107: { ...ex.ed107, v: { 'OrderingBank/BIC': 45131779 } } }, 'ответ')).toThrow('ответ.ed107.v.OrderingBank/BIC: ожидалась строка')
    expect(() => parseRubDocDetail({ ...ex, prio: 2 }, 'ответ')).toThrow(ApiError)
  })
})
```

- [ ] **Step 4: маппер и порты.** Создать `apps/pi/src/entities/rub-doc/api/detail.mapper.ts`:

```ts
import { arr, contractError, obj, str, strArr, type Obj } from '../../../shared/api'
import { parseTxs } from '../../posting/@x/rub-doc'
import type { RubDocDetail } from '../model/detail'
import { AGENT_KEYS, BUDGET_ROWS, COLLECT_KEYS, ED107_KEYS, PURPOSE_EXTRA_ROWS, RUB_PARTY } from '../model/profiles'
import { parseRubDoc } from './rubDoc.mapper'

/** Объект со строковыми реквизитами по списку ключей; пустой реквизит бек отдаёт ''. */
function strRecord<K extends string>(raw: unknown, keys: readonly K[], path: string): Record<K, string> {
  const o = obj(raw, path)
  const out = {} as Record<K, string>
  for (const k of keys) out[k] = str(o, k, path)
  return out
}

function strMap(raw: unknown, path: string): Record<string, string> {
  const o: Obj = obj(raw, path)
  const out: Record<string, string> = {}
  for (const k of Object.keys(o)) {
    const v = o[k]
    if (typeof v !== 'string') throw contractError(`${path}.${k}: ожидалась строка`)
    out[k] = v
  }
  return out
}

/** Ответ GET /grids/rub-docs/documents/{id} → RubDocDetail. Если бек называет поля иначе — правится только этот файл. */
export function parseRubDocDetail(raw: unknown, path: string): RubDocDetail {
  const o = obj(raw, path)
  const party = obj(o.party, `${path}.party`)
  const ed = obj(o.ed107, `${path}.ed107`)
  return {
    ...parseRubDoc(o, path),
    numDate: str(o, 'numDate', path),
    opCode: str(o, 'opCode', path),
    opName: str(o, 'opName', path),
    scenario: str(o, 'scenario', path),
    sysFrom: str(o, 'sysFrom', path),
    sysTo: str(o, 'sysTo', path),
    party: { s: strRecord(party.s, RUB_PARTY, `${path}.party.s`), r: strRecord(party.r, RUB_PARTY, `${path}.party.r`) },
    purposeExtra: strRecord(o.purposeExtra, PURPOSE_EXTRA_ROWS, `${path}.purposeExtra`),
    agents: arr(o.agents, `${path}.agents`).map((a, i) => strRecord(a, AGENT_KEYS, `${path}.agents[${i}]`)),
    budget: strRecord(o.budget, BUDGET_ROWS, `${path}.budget`),
    ed107: { ...strRecord(ed, ED107_KEYS, `${path}.ed107`), v: strMap(ed.v, `${path}.ed107.v`) },
    collect: strRecord(o.collect, COLLECT_KEYS, `${path}.collect`),
    txAt: str(o, 'txAt', path),
    txs: parseTxs(o.txs, `${path}.txs`),
    tabsOff: strArr(o.tabsOff, `${path}.tabsOff`),
  }
}
```

  Заменить `apps/pi/src/entities/rub-doc/api/ports.ts`:

```ts
import { createGridPorts } from '../../../shared/api'
import { parseRubDocDetail } from './detail.mapper'
import { parseRubDoc } from './rubDoc.mapper'

export const rubDocPorts = createGridPorts({ gridId: 'rub-docs', parseRow: parseRubDoc, parseDetail: parseRubDocDetail })
```

  Run: `pnpm --filter pi test -- rub-doc` — PASS.
- [ ] **Step 5: блоки и секции — тест (падает).** Создать `apps/pi/src/entities/rub-doc/ui/detail.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { ConfigForm } from '@katran/ui'
import { renderK } from '../../../shared/lib/test'
import { RUB_DETAIL_EXAMPLE } from '../api/detail.example'
import { parseRubDocDetail } from '../api/detail.mapper'
import type { RubDocDetail } from '../model/detail'
import { rubDocDetailDomain as dom } from './detail'

const d = parseRubDocDetail(RUB_DETAIL_EXAMPLE, 'ответ')
const renderMain = (doc: RubDocDetail = d) => {
  const renderSection = dom.renderSection!
  return renderK(
    <ConfigForm schema={dom.schemaOf(doc)} fields={dom.fields} value={(t) => dom.value(doc, t)}
      renderHero={(id) => dom.renderHero(doc, id)} renderBlock={(id) => dom.renderBlock(doc, id)} renderSection={(id) => renderSection(doc, id)} />,
  )
}
const hero = () => document.querySelector('[data-part="hero"]') as HTMLElement

describe('«Общие данные» рубля (rubHtml стенда, index.html:1149)', () => {
  it('сводка: номер · от, операция, очерёдность «неприоритетный», сумма RUB справа', () => {
    renderMain()
    expect(hero()).toHaveTextContent('№ 3741 от 24.09.2026')
    expect(hero()).toHaveTextContent('01 Платёжное поручение')
    expect(hero()).toHaveTextContent('5неприоритетный')
    expect(hero()).toHaveTextContent(/76\s394\.81RUB/)
  })
  it('срочный — тег «СРОЧНО»', () => {
    renderMain({ ...d, prio: 1 })
    expect(within(hero()).getByText('СРОЧНО')).toBeInTheDocument()
  })
  it('сценарий, системы, ссылки линк-кнопками', () => {
    renderMain()
    expect(screen.getByText('SC_NCB_IN_CREDIT')).toBeInTheDocument()
    expect(screen.getByText('Системы').parentElement).toHaveTextContent('NCB.NCB_IN')
    expect(screen.getByRole('button', { name: 'docRef' })).toHaveAttribute('data-k-tip', 'ED101-5210472026066 — копировать')
    expect(screen.getByRole('button', { name: 'УИП' })).toBeEnabled()
  })
  it('стороны: строки по порядку, пустые с обеих сторон — бледные, моноширинные значения', () => {
    renderMain()
    const table = screen.getByRole('table', { name: 'Отправитель и получатель' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual(['Наименование', 'Опция', 'Номер счёта', 'ИНН', 'КПП', 'Доп. информация', 'Адрес', 'Наименование банка', 'БИК', 'Счёт банка', 'Доп. информация'])
    expect(rows[1]).toHaveAttribute('data-empty')
    expect(rows[10]).not.toHaveAttribute('data-empty')
    expect(table.querySelector('tr[data-part="party-row"]')).toBe(rows[0])
  })
  it('назначение платежа — строкой под сторонами', () => {
    renderMain()
    expect(screen.getByText(/Оплата по счёту № 6945-2101/)).toBeInTheDocument()
  })
  it('секции: свёрнуты; без данных — «нет данных»; посредники — таблица со счётчиком; ED107 — подгруппы', async () => {
    renderMain()
    expect(screen.getByRole('heading', { name: 'Бюджетные реквизиты' }).parentElement).toHaveTextContent('нет данных')
    expect(screen.getByRole('heading', { name: 'Параметры инкассового поручения' }).parentElement).toHaveTextContent('нет данных')
    await userEvent.click(screen.getByRole('button', { name: 'Посредник' }))
    expect(screen.getByText('ФИЛИАЛ № 3826 БАНКА «НУВОСЕ» (ПАО)')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Параметры ED107' }))
    const payer = screen.getByRole('button', { name: 'Информация о банке-плательщике' })
    expect(payer).toHaveAttribute('aria-expanded', 'true')
    expect(payer.closest('div')?.parentElement).toHaveTextContent('4 / 4')
    expect(screen.getByRole('button', { name: 'Информация об агенте банка-получателя' }).closest('div')?.parentElement).toHaveTextContent('0 / 4')
    expect(screen.getByText('DUZFRUY9')).toBeVisible()
  })
  it('шапка и лейн', () => {
    expect(dom.summary(d)).toMatchObject({ label: 'Платёжная инструкция № 3741', uuid: '72aa73fb-dae6-4672-8d09-e15afc0a523d', type: 'PAYDOCRU', kind: 'Платёжное поручение · входящий от ЦБ на клиента', tabsOff: ['stream', 'mpu'] })
  })
  it('без нарушений axe', async () => {
    const { container } = renderMain()
    await userEvent.click(screen.getByRole('button', { name: 'Развернуть все' }))
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

- [ ] **Step 6: блоки, секции, домен — реализация.** Создать `apps/pi/src/entities/rub-doc/ui/detail.tsx`:

```tsx
import type { CSSProperties, ReactNode } from 'react'
import { Disclosure, LinkValue, Tag, formatAmount, formatDate, formatDateTimeFull, type HeroCell, type SectionContent } from '@katran/ui'
import type { DetailDomain, DetailSummary } from '../../../shared/lib/detail'
import { STATUS_LABEL, STATUS_TONE } from '../../doc-status/@x/rub-doc'
import { TxBlock } from '../../posting/@x/rub-doc'
import type { RubDocDetail, RubEd107 } from '../model/detail'
import {
  AGENT_COLS, BUDGET_ROWS, COLLECT_ROWS, ED107_GROUPS, ED107_HEAD, PURPOSE_EXTRA_ROWS, RFIELDS, RUB_ACTIONS, RUB_DETAIL_TITLE,
  RUB_PARTY, RUB_PROFILES, RUB_TABS, rubSchemaOf,
} from '../model/profiles'
import type { RubDoc } from '../model/rubDoc'
import s from './detail.module.css'

/** Есть ли хоть одно непустое значение (эталон filled, index.html:1134). */
function filled(o: unknown): boolean {
  if (Array.isArray(o)) return o.length > 0
  if (o && typeof o === 'object') return Object.keys(o).some((k) => filled((o as Record<string, unknown>)[k]))
  return typeof o === 'string' ? o !== '' : o != null
}

const None = () => <span className={s.none}><span aria-hidden="true">—</span><span className={s.sr}>не заполнено</span></span>
function RLabel({ k }: { k: string }) {
  const m = RFIELDS[k] ?? { label: k }
  return <>{m.no && <span className={s.no} data-k-tip={`${m.no} · ${m.label}`}>{m.no}</span>}{m.label}</>
}
function RVal({ k, v, mono }: { k: string; v: string; mono?: boolean | undefined }) {
  if (!v) return <None />
  return <span className={(mono ?? RFIELDS[k]?.mono) ? s.valMono : s.val}>{v}</span>
}

/** Строки «реквизит — значение» секции; «|» — разделитель групп (эталон rubSectionHtml kv). */
function Kv({ rows, data }: { rows: readonly string[]; data: Record<string, string> }) {
  return (
    <div className={s.kv}>
      {rows.map((k, i) => (k === '|'
        ? <div key={`sep${i}`} className={s.kvSep} aria-hidden="true" />
        : (
          <div key={k} className={[s.kvRow, data[k] ? '' : s.null].filter(Boolean).join(' ')}>
            <span className={s.kvName}><RLabel k={k} /></span>
            <RVal k={k} v={data[k] ?? ''} />
          </div>
        )))}
    </div>
  )
}

function Agents({ d }: { d: RubDocDetail }) {
  return (
    <table className={s.agents}>
      <thead><tr>{AGENT_COLS.map(([title]) => <th key={title} scope="col">{title}</th>)}</tr></thead>
      <tbody>
        {d.agents.map((a, i) => (
          <tr key={i}>{AGENT_COLS.map(([, key]) => <td key={key}><RVal k={key} v={a[key]} mono={key !== 'name'} /></td>)}</tr>
        ))}
      </tbody>
    </table>
  )
}

/** ED107: шапка из четырёх реквизитов и подгруппы узлов ЭС; пустое значение — бледная строка (эталон rubSectionHtml ed107). */
function Ed107({ e }: { e: RubEd107 }) {
  return (
    <div className={s.ed}>
      <div className={s.kvs}>
        {ED107_HEAD.map(([k, label]) => (
          <span key={k} className={s.kvsItem}>
            <span className={s.lbl}>{label}</span>
            {e[k] ? <span className={s.val}>{k.endsWith('Date') ? formatDate(e[k]) : e[k]}</span> : <None />}
          </span>
        ))}
      </div>
      {ED107_GROUPS.map((g) => {
        const cnt = g.rows.filter((r) => e.v[`${g.node}/${r}`]).length
        return (
          <Disclosure key={g.id} title={g.title} level="sub" defaultOpen aside={<span className={s.cnt}>{cnt} / {g.rows.length}</span>}>
            {g.rows.map((r) => {
              const path = `${g.node}/${r}`
              const v = e.v[path] ?? ''
              return (
                <div key={path} className={[s.kvRow, v ? '' : s.null].filter(Boolean).join(' ')}>
                  <span className={[s.kvName, s.mono].join(' ')}>ed:{path}</span>
                  <RVal k={path} v={v} mono={r === 'BIC' || /Acc|Account/.test(r)} />
                </div>
              )
            })}
          </Disclosure>
        )
      })}
    </div>
  )
}

/** Секции «Дополнительных блоков» (эталон RSECTIONS): null — без данных, заголовок бледный, не раскрывается. */
export function rubSection(d: RubDocDetail, id: string): SectionContent {
  switch (id) {
    case 'purposeExtra': return filled(d.purposeExtra) ? { body: <Kv rows={PURPOSE_EXTRA_ROWS} data={d.purposeExtra} /> } : null
    case 'agents': return d.agents.length > 0 ? { count: d.agents.length, body: <Agents d={d} /> } : null
    case 'budget': return filled(d.budget) ? { body: <Kv rows={BUDGET_ROWS} data={d.budget} /> } : null
    case 'ed107': return filled(d.ed107) ? { body: <Ed107 e={d.ed107} /> } : null
    case 'collect': return filled(d.collect) ? { body: <Kv rows={COLLECT_ROWS} data={d.collect} /> } : null
    default: return null
  }
}

/** Сценарий, системы, идентификаторы — аналог «Маршрута» валюты (эталон rubScenHtml, index.html:1121). */
function Scenario({ d }: { d: RubDocDetail }) {
  return (
    <div className={s.msgs}>
      <div className={s.col}>
        <div className={s.colTitle}>Сценарий</div>
        <span className={s.lbl}>Код</span><span className={[s.valMono, s.cut].join(' ')} data-k-tip={d.scenario}>{d.scenario}</span>
        <span className={s.lbl}>S → R</span><span className={[s.valMono, s.cut].join(' ')}>{d.sysFrom}<span className={s.ar}>→</span>{d.sysTo}</span>
      </div>
      <div className={s.col}>
        <div className={s.colTitle}>Системы</div>
        <span className={s.lbl}>Initiator</span><span className={[s.valMono, s.cut].join(' ')}>{d.initiator}</span>
        <span className={s.lbl}>Source</span><span className={[s.valMono, s.cut].join(' ')}>{d.source}</span>
        <span className={s.lbl}>Destination</span><span className={[s.valMono, s.cut].join(' ')}>{d.destination}</span>
      </div>
      <div className={s.col}>
        <div className={s.colTitle}>Идентификаторы</div>
        <span className={s.lbl}>Ссылки</span>
        <span className={s.links}>
          <LinkValue name="txId" value={d.txId || undefined} />
          <LinkValue name="docRef" value={d.docRef || undefined} />
          <LinkValue name="УИП" value={d.purposeExtra.uip || undefined} />
        </span>
      </div>
    </div>
  )
}

/** Таблица «отправитель | получатель»: строки фиксированы, пустые с обеих сторон — бледные (эталон rubPartyHtml, index.html:1127). */
function Party({ d }: { d: RubDocDetail }) {
  return (
    <div className={s.partyWrap}>
      <div className={s.fh}><h3 className={s.fhTitle}>Отправитель / Получатель</h3><span className={s.lbl}>отправитель слева · получатель справа</span></div>
      <table className={s.party} aria-label="Отправитель и получатель">
        <colgroup><col style={{ width: 'var(--k-dt-label-s)' } as CSSProperties} /><col /><col /></colgroup>
        <thead><tr><th scope="col"><span className={s.sr}>Реквизит</span></th><th scope="col">Отправитель</th><th scope="col">Получатель</th></tr></thead>
        <tbody>
          {RUB_PARTY.map((k, i) => {
            const a = d.party.s[k], b = d.party.r[k]
            return (
              <tr key={k} data-empty={!a && !b ? '' : undefined} data-part={i === 0 ? 'party-row' : undefined} className={!a && !b ? s.null : undefined}>
                <th scope="row" className={s.kvName}>{RFIELDS[k]?.label ?? k}</th>
                <td><RVal k={k} v={a} /></td>
                <td><RVal k={k} v={b} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Purpose({ d }: { d: RubDocDetail }) {
  return (
    <div className={[s.rtxt, d.purpose ? '' : s.null].filter(Boolean).join(' ')}>
      <span className={s.rtxtLbl}>{RFIELDS.purpose?.label}</span>
      {d.purpose ? <span className={s.val}>{d.purpose}</span> : <None />}
    </div>
  )
}

/** Ячейки сводки (эталон rubHeroHtml, index.html:1114). */
export function rubHero(d: RubDocDetail, id: string): HeroCell {
  switch (id) {
    case 'num': return { label: 'Номер документа · от', value: <>№ {d.docNumber} <span className={s.heroSub}>от {formatDate(d.numDate)}</span></> }
    case 'op': return { label: 'Операция', value: <><span className={s.valMono}>{d.opCode}</span> <span className={s.heroSub}>{d.opName}</span></> }
    case 'queue': return {
      label: 'Очерёдность · приоритет',
      value: <>{d.queue}{d.prio === 1 ? <span className={s.prio}><Tag tone="warn">СРОЧНО</Tag></span> : <span className={s.noPrio}>неприоритетный</span>}</>,
    }
    case 'sum': return { label: 'Сумма', align: 'right', value: <span className={s.amt}>{formatAmount(d.amount)}<small className={s.ccy}>RUB</small></span> }
    default: return { label: id, value: '—' }
  }
}

/** Блоки-слоты профиля: scen, tx, party, purpose. «Проверить баланс» у транзакций — не переносится (detail-drift Д15). */
export function rubBlock(d: RubDocDetail, id: string): ReactNode {
  if (id === 'scen') return <Scenario d={d} />
  if (id === 'tx') return <TxBlock txs={d.txs} txId={d.txId} txAt={d.txAt} />
  if (id === 'party') return <Party d={d} />
  if (id === 'purpose') return <Purpose d={d} />
  return null
}

export function rubRowSummary(row: RubDoc): DetailSummary {
  return {
    label: `${RUB_DETAIL_TITLE} № ${row.docNumber}`,
    uuid: row.uuid,
    created: formatDateTimeFull(row.created),
    type: row.type,
    status: { tone: STATUS_TONE[row.status], label: STATUS_LABEL[row.status] },
    kind: `${RUB_PROFILES[row.type].title} · ${row.dirTxt}`,
    tabsOff: [],
  }
}
export const rubDocSummary = (d: RubDocDetail): DetailSummary => ({ ...rubRowSummary(d), tabsOff: d.tabsOff })

/** Всё доменное для widgets/doc-detail. Полей SWIFT у рубля нет — реестр полей пуст, всё в блоках и секциях. */
export const rubDocDetailDomain: DetailDomain<RubDocDetail, RubDoc> = {
  title: RUB_DETAIL_TITLE,
  tabs: RUB_TABS,
  actions: RUB_ACTIONS,
  fields: {},
  schemaOf: rubSchemaOf,
  value: () => null,
  summary: rubDocSummary,
  rowSummary: rubRowSummary,
  renderHero: rubHero,
  renderBlock: rubBlock,
  renderSection: rubSection,
}
```

  Создать `apps/pi/src/entities/rub-doc/ui/detail.module.css`:

```css
/* Блоки «Общих данных» рубля (эталон .msgs/.rp/.rph/.rpr/.rtxt/.rsec/.kvs, index.html:161–165, 343–345, 479–500) */
.msgs {
  display: grid;
  grid-template-columns: 1fr 1fr 1.15fr;
  border: 1px solid var(--k-line);
  border-radius: var(--k-r-s);
}

.col {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0 var(--k-sp-2);
  align-content: start;
  min-width: 0;
  padding: var(--k-sp-1) var(--k-sp-2);
}

.col + .col {
  border-left: 1px solid var(--k-line);
}

.colTitle {
  grid-column: 1 / -1;
  font: 500 var(--k-fs-3) / var(--k-lh-3) var(--k-sans);
  letter-spacing: 0.03em;
  color: var(--k-muted);
}

.lbl {
  font-size: var(--k-fs-2);
  color: var(--k-muted);
}

.val {
  overflow-wrap: anywhere;
  color: var(--k-val);
}

.valMono {
  font: var(--k-fs-1) / var(--k-lh-1) var(--k-mono);
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
  color: var(--k-val);
}

.mono {
  font-family: var(--k-mono);
}

.cut {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ar {
  margin: 0 var(--k-sp-1);
  color: var(--k-faint);
}

.links {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0 var(--k-sp-2);
}

.none {
  color: var(--k-faint);
}

.sr {
  position: absolute;
  inline-size: 0;
  block-size: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.heroSub {
  font-weight: 500;
}

.prio {
  margin-left: var(--k-sp-2);
}

.noPrio {
  margin-left: var(--k-sp-2);
  font-size: var(--k-fs-2);
  font-weight: 400;
  color: var(--k-muted);
}

.amt {
  font: 600 var(--k-fs-sum) / 1 var(--k-sans);
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ccy {
  margin-left: var(--k-sp-1);
  font-size: var(--k-fs-1);
  font-weight: 600;
  color: var(--k-val);
}

.partyWrap {
  display: flex;
  flex-direction: column;
  gap: var(--k-sp-1);
}

.fh {
  display: flex;
  align-items: baseline;
  gap: var(--k-sp-2);
}

.fhTitle {
  margin: 0;
  font: 600 var(--k-fs-2) / var(--k-lh-2) var(--k-sans);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--k-ink2);
}

/* таблица сторон: строка 23 (эталон .rpr), шапка прописными на sunk */
.party,
.agents {
  width: 100%;
  border: 1px solid var(--k-line);
  border-collapse: collapse;
  border-radius: var(--k-r-s);
  table-layout: fixed;
}

.party th,
.party td,
.agents th,
.agents td {
  height: var(--k-party-row);
  padding: 0 var(--k-sp-2);
  border-bottom: 1px solid var(--k-line2);
  text-align: left;
  vertical-align: baseline;
}

.party thead th,
.agents thead th {
  background: var(--k-sunk);
  font: 600 var(--k-fs-3) / var(--k-lh-3) var(--k-sans);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--k-muted);
}

.agents td {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agents th:first-child {
  width: 40%;
}

.agents th:nth-child(2) {
  width: var(--k-dt-bic);
}

.kvName {
  font-size: var(--k-fs-2);
  font-weight: 400;
  color: var(--k-muted);
}

.null .kvName,
.null > th {
  color: var(--k-faint);
}

.rtxt {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0 var(--k-sp-3);
  align-items: baseline;
  padding: var(--k-sp-1) var(--k-sp-2);
  border: 1px solid var(--k-line);
  border-radius: var(--k-r-s);
}

.rtxt.null {
  border-style: dashed;
}

.rtxtLbl {
  font: 600 var(--k-fs-3) / var(--k-lh-3) var(--k-sans);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--k-ink2);
}

/* строки секции: подпись 250 (эталон .rsec .xr) */
.kv {
  display: flex;
  flex-direction: column;
}

.kvRow {
  display: grid;
  grid-template-columns: var(--k-dt-label-l) minmax(0, 1fr);
  gap: 0 var(--k-sp-3);
  align-items: baseline;
  min-height: var(--k-party-row);
  border-bottom: 1px solid var(--k-line2);
}

.kvRow:last-child {
  border-bottom: 0;
}

.kvSep {
  height: var(--k-sp-2);
  border-bottom: 1px solid var(--k-line);
}

.no {
  margin-right: var(--k-sp-1);
  font: 600 var(--k-fs-1) / 1 var(--k-mono);
  color: var(--k-ink);
  cursor: help;
}

.ed {
  display: flex;
  flex-direction: column;
  gap: var(--k-sp-1);
}

.kvs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 var(--k-sp-3);
}

.kvsItem {
  display: flex;
  align-items: baseline;
  gap: var(--k-sp-2);
  min-width: 0;
}

.cnt {
  margin-left: auto;
  font: 500 var(--k-fs-3) / 1 var(--k-mono);
  color: var(--k-faint);
}
```

  (`width: 40%` у первой колонки таблицы посредников — эталон `minmax(0,1.5fr)` из четырёх колонок ≈ 1.5 / 3.9; процент без `px` линт пропускает.)

  В `apps/pi/src/entities/rub-doc/index.ts` добавить:

```ts
export type { RubAgent, RubDocDetail, RubEd107, RubParty } from './model/detail'
export {
  ED107_GROUPS, RFIELDS, RSECTION_TITLE, RUB_ACTIONS, RUB_DETAIL_TITLE, RUB_OPERATION, RUB_PARTY, RUB_PROFILES, RUB_SECTIONS, RUB_TABS, rubSchemaOf,
  type RubFieldMeta, type RubSectionId,
} from './model/profiles'
export { parseRubDocDetail } from './api/detail.mapper'
export { RUB_DETAIL_EXAMPLE } from './api/detail.example'
export { rubBlock, rubDocDetailDomain, rubDocSummary, rubHero, rubRowSummary, rubSection } from './ui/detail'
```

  Run: `pnpm --filter pi test -- rub-doc` — PASS.
- [ ] **Step 7: данные фейка.** В `apps/pi/src/app/fake/rub-docs.data.ts` у `const RBANKS` добавить `export` (строка 43: `export const RBANKS: [string, string, string][] = [`). Создать `apps/pi/src/app/fake/rub-docs.detail.ts`:

```ts
import { RUB_OPERATION, TYPE_NAME, type RubDoc } from '../../entities/rub-doc'
import { RBANKS } from './rub-docs.data'

// Словари — со стенда pi-constructor (первый и второй рублёвые документы, index.html:895–921), обезличен; данные вымышленные.
const ADDR = ['740828, Г. ЛЫСУЛА, УЛ. НИФЕМЯ, Д. 133, ПОМ. 520', '057617, Г. СОЛОКЫ, УЛ. МЕСОБО, Д. 83, КВ. 143']
const PURPOSE_EXTRA = { instr: 'Гяналу тыпепо вуза факе пысему вя ни лидефе фотохо ва мезе мокефо', reserve: 'Зувивофе дыто симу', f20: 'Руди фибеку собыве сясе' }
const AGENTS = [
  { name: 'ФИЛИАЛ № 3826 БАНКА «НУВОСЕ» (ПАО)', bic: '041550162', bankAcc: '30101810951233369033', acc: '30110810217115096554' },
  { name: 'БАНК «ВЯХИЛЯ» (АО)', bic: '041916658', bankAcc: '30101810196704420940', acc: '30110810928566570883' },
  { name: 'АО «ФАДОФЯ БАНК»', bic: '047917152', bankAcc: '30101810671568607430', acc: '30110810450582275781' },
]
const BUDGET = { b101: '51', b104: '96939832480279714550', b105: '92564093', b106: 'ТП', b107: 'МС.02.2026', b108: '200', b109: '26.02.2026', b110: '649' }
const NO_BUDGET = { b101: '', b104: '', b105: '', b106: '', b107: '', b108: '', b109: '', b110: '' }
const ED107_FULL: Record<string, string> = {
  'OrderingBank/BIC': '045131779', 'OrderingBank/ed:Name': 'БАНК «ВУХИДО» (АО)', 'OrderingBank/BankAccount': '30101810105950215060', 'OrderingBank/SWBIC': 'DUZFRUY9',
  'AcctWithInst/BIC': '045027178', 'AcctWithInst/ed:Name': 'БАНК «ВЫНАФА» (АО)', 'AcctWithInst/BankAccount': '30101810168267985543', 'AcctWithInst/SWBIC': 'KDHCRU2F',
  'Beneficiary/BIC': '049719713', 'Beneficiary/ed:Name': 'ФИЛИАЛ № 6857 БАНКА «ВАХАСЫ» (ПАО)', 'Beneficiary/BankAccount': '30101810424324905006', 'Beneficiary/SWBIC': 'REFNRUAM',
  'PrevInstrAgent/BIC': '049125896', 'PrevInstrAgent/ed:Name': 'БАНК «ВЯЗУРЕ» (АО)', 'PrevInstrAgent/BankAccount': '30101810347900853104', 'PrevInstrAgent/SWBIC': 'TEMGRU4U',
  'InstructingAgent/BIC': '047485823', 'InstructingAgent/CorrespAcc': '30101810372488940093', 'InstructingAgent/SWBIC': 'XEANRURA',
  'InstructedAgent/BIC': '040266426', 'InstructedAgent/CorrespAcc': '30101810122840500735', 'InstructedAgent/SWBIC': 'HDNZRU99',
}
const ED107_SHORT: Record<string, string> = {
  'OrderingBank/BIC': '048768792', 'OrderingBank/ed:Name': 'БАНК «МУДЫТЫ» (АО)', 'OrderingBank/BankAccount': '30101810766322191206', 'OrderingBank/SWBIC': 'FPNTRU2T',
  'InstructingAgent/BIC': '042878504', 'InstructingAgent/CorrespAcc': '30101810317932318025', 'InstructingAgent/SWBIC': 'ZZULRUAZ',
  'InstructedAgent/BIC': '047521494', 'InstructedAgent/CorrespAcc': '30101810721171571828', 'InstructedAgent/SWBIC': 'DVHURU8C',
}
// даты реквизитов документа — текстом, как в платёжном документе (эталон collect)
const COLLECT = { c48: '23.09.2026', cLimit: '93997231', c70: 'Вабудя ферави тефе сы саси', c38: '85', c39: '54', c40: '350658401', c41: '06.09.2026' }
const NO_COLLECT = { c48: '', cLimit: '', c70: '', c38: '', c39: '', c40: '', c41: '' }
const pad = (n: number, w: number) => String(n).padStart(w, '0')
const corrOf = (bic: string) => RBANKS.find((b) => b[1] === bic)?.[2] ?? ''

/**
 * Деталь рублёвого документа (спека 2a §4.4): строка реестра как есть (номер, сумма, статус — из реестра),
 * стороны из реквизитов строки, секции и проводки — детерминированно по номеру строки i.
 */
export function makeRubDocDetail(row: RubDoc, i: number): Record<string, unknown> {
  const inbound = row.direction === 'IN'
  const pending = row.status === 'IN_PROGRESS' || row.status === 'ERROR' || row.status === 'DEFERRED'
  const base = Date.parse(`${row.created}Z`)
  const at = (sec: number) => new Date(base + sec * 1000 + ((i * 41) % 1000)).toISOString()
  const corr = `30102810${pad((i * 7919 + 17) % 1e12, 12)}`
  const client = inbound ? row.toAcc : row.fromAcc
  return {
    ...row,
    numDate: row.created.slice(0, 10),
    opCode: RUB_OPERATION[row.type],
    opName: TYPE_NAME[row.type],
    scenario: inbound ? 'SC_NCB_IN_CREDIT' : row.direction === 'OUT' ? 'SC_NCB_OUT_DEBIT' : 'SC_NCB_TRANSIT',
    sysFrom: inbound ? 'DB01' : 'DB02',
    sysTo: inbound ? 'DB02' : 'DB01',
    party: {
      s: { name: row.fromName, opt: '', acc: row.fromAcc, inn: row.fromInn, kpp: row.fromKpp, info: '', addr: i % 3 === 0 ? ADDR[0]! : '', bank: row.fromBank, bic: row.fromBic, bankAcc: corrOf(row.fromBic), bankInfo: '' },
      r: { name: row.toName, opt: '', acc: row.toAcc, inn: row.toInn, kpp: row.toKpp, info: '', addr: i % 3 === 0 ? ADDR[1]! : '', bank: row.toBank, bic: row.toBic, bankAcc: corrOf(row.toBic), bankInfo: i % 4 === 1 ? 'Филиал в г. Хупево' : '' },
    },
    purposeExtra: i % 3 === 0 ? { ...PURPOSE_EXTRA, uip: pad((i * 104729) % 1e20, 20) } : { instr: '', uip: i % 2 ? pad((i * 104729) % 1e20, 20) : '', reserve: '', f20: '' },
    agents: i % 4 === 0 ? AGENTS.slice(0, 1 + (i % 3)) : [],
    // бюджетные реквизиты — у платежей в казначейство (счёт получателя 03…)
    budget: row.toAcc.startsWith('03') ? BUDGET : NO_BUDGET,
    ed107: { relId: String(5000 + i), initId: String(46000 + i * 7), relDate: row.created.slice(0, 10), execDate: row.created.slice(0, 10), v: i % 2 === 0 ? ED107_FULL : ED107_SHORT },
    collect: row.type === 'REQDOCRU' || i % 5 === 0 ? COLLECT : NO_COLLECT,
    txAt: row.created,
    txs: [
      { dir: 'DEBIT', st: 'EXECUTED', acc: inbound ? corr : client, reg: inbound ? '00000_CorrCBR' : '00010_ClientCurrent', time: at(6), amount: row.amount, currency: 'RUB' },
      { dir: 'CREDIT', st: pending ? 'PENDING' : 'EXECUTED', acc: inbound ? client : corr, reg: inbound ? '00010_ClientCurrent' : '00000_CorrCBR', time: pending ? null : at(6), amount: row.amount, currency: 'RUB' },
    ],
    tabsOff: i % 2 ? ['mpu'] : ['stream', 'mpu'],
  }
}
```

  В `apps/pi/src/app/fake/grids.ts`: `import { makeRubDocDetail } from './rub-docs.detail'` и `'rub-docs': fakeGrid(makeRubDocs(), rubDocLayout.columns, rubDocsMeta, { sortLabels: { status: STATUS_LABEL }, detail: makeRubDocDetail })`.
- [ ] **Step 8: контрактная цепочка.** В `apps/pi/src/app/fake/contract.test.ts` добавить импорт `import { RUB_TYPES } from '../../entities/rub-doc'` и блок:

```ts
describe('контракт детали rub-docs (спека 2a §6)', () => {
  it('200 для каждого вида документа: номер, сумма, статус и стороны — из строки реестра', async () => {
    const sc = scope()
    const page = await allSettled(rubDocPorts.searchFx, { scope: sc, params: { filter: [], sort: [], page: 0, size: 100 } })
    if (page.status !== 'done') throw new Error('search не прошёл')
    for (const t of RUB_TYPES) {
      const row = page.value.rows.find((x) => x.type === t)!
      const r = await allSettled(rubDocPorts.detailFx, { scope: sc, params: row.id })
      expect(r.status, t).toBe('done')
      if (r.status !== 'done') continue
      expect(r.value).toMatchObject({ docNumber: row.docNumber, amount: row.amount, status: row.status })
      expect(r.value.party.s.acc).toBe(row.fromAcc)
      expect(r.value.party.r.inn).toBe(row.toInn)
    }
  })
  it('есть документ с бюджетными реквизитами и с посредниками', () => {
    const rows = makeRubDocs()
    const details = rows.map((row, i) => makeRubDocDetail(row, i))
    expect(details.some((d) => (d.budget as { b101: string }).b101 !== '')).toBe(true)
    expect(details.some((d) => (d.agents as unknown[]).length > 0)).toBe(true)
  })
  it('404 на неизвестный id', async () => {
    const r = await allSettled(rubDocPorts.detailFx, { scope: scope(), params: 'rub-9999' })
    expect((r.value as ApiError).status).toBe(404)
  })
})
```

  (дополнить импорт `import { makeRubDocDetail } from './rub-docs.detail'`; `makeRubDocs` уже импортирован.)
- [ ] **Step 9: запуск.** `pnpm --filter pi test` — PASS. `pnpm check` — зелёный.
- [ ] **Step 10: commit.**

```bash
git add apps/pi/src/entities/posting/@x/rub-doc.ts apps/pi/src/entities/rub-doc/model/detail.ts apps/pi/src/entities/rub-doc/model/profiles.ts apps/pi/src/entities/rub-doc/model/profiles.test.ts apps/pi/src/entities/rub-doc/api/detail.mapper.ts apps/pi/src/entities/rub-doc/api/detail.example.ts apps/pi/src/entities/rub-doc/api/detail.mapper.test.ts apps/pi/src/entities/rub-doc/api/ports.ts apps/pi/src/entities/rub-doc/ui/detail.tsx apps/pi/src/entities/rub-doc/ui/detail.module.css apps/pi/src/entities/rub-doc/ui/detail.test.tsx apps/pi/src/entities/rub-doc/index.ts apps/pi/src/app/fake/rub-docs.detail.ts apps/pi/src/app/fake/rub-docs.data.ts apps/pi/src/app/fake/grids.ts apps/pi/src/app/fake/contract.test.ts
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "apps/pi: деталь рублёвого документа — профили, стороны, секции RSECTIONS, маппер, фейк детали"
```

---
### Task 10: `widgets/doc-detail` — `createDetail`, `DocDetail`

**Files:**
- Create: `apps/pi/src/widgets/doc-detail/{index.ts, lib/createDetail.ts, lib/createDetail.test.ts, ui/DocDetail.tsx, ui/DocDetail.module.css, ui/icons.tsx, ui/DocDetail.test.tsx}`
- Create: `apps/pi/src/app/details.a11y.test.tsx`

**Interfaces:**
- Produces (`widgets/doc-detail`, публичный API):

```ts
type DetailSlotState = 'loading' | 'ready' | 'error'
type DetailSlot<D> = { slot: DrawerSlot; id: string; tab: string; state: DetailSlotState; data: D | null; error: string | null }
type DetailConfig<D> = { detailFx: Effect<string, D, ApiError>; lifecycle: PageLifecycle; firstTab?: string | undefined }
type Detail<D> = {
  stack: DrawerStackModel
  $slots: Store<{ a: DetailSlot<D> | null; b: DetailSlot<D> | null }>
  $marks: Store<Record<string, DrawerSlot>>           // id → слот, для DataGrid marked
  $focus: Store<Record<string, number>>               // id → счётчик «сфокусировать» (повторное открытие)
  open: EventCallable<{ id: string; secondary: boolean }>
  close: EventCallable<DrawerSlot>
  closeTop: EventCallable<void>
  setTab: EventCallable<{ slot: DrawerSlot; tab: string }>
  retry: EventCallable<DrawerSlot>
}
createDetail<D>(cfg: DetailConfig<D>): Detail<D>
type DocDetailProps<D, Row> = {
  detail: Detail<D>
  domain: DetailDomain<D, Row>
  rowOf?: ((id: string) => Row | null) | undefined          // строка реестра — шапка до загрузки и при ошибке
  returnFocus?: ((id: string) => HTMLElement | null) | undefined
}
DocDetail<D, Row>(props: DocDetailProps<D, Row>): JSX.Element | null
```

  Правила: кэш — по `id` на время открытого экрана (переключение A↔B, сдвиг B в A и повторное открытие не перезапрашивают); ответ, пришедший после `pageClosed`, в кэш не кладётся; `pageClosed` закрывает оба слота и очищает кэш, ошибки и счётчики фокуса. `$focus` считается по `id`, а не по слоту: при сдвиге B в A фокус не прыгает. Разметка для e2e: лейн — `[data-part="lane"]`, полоса вкладок — `[data-part="tabs"]`, скелетон — `[data-part="skeleton"]`, шапка — `[data-part="head"]` (Task 3).
- Consumes: `createDrawerStackModel`, `DrawerSlot`, `DrawerStackModel` (Task 2); `Drawer`, `DrawerStack`, `Tabs` (`overflow`, `variant="line"`), `TabPanel`, `ConfigForm`, `Menu`, `IconButton`, `LinkValue`, `Tag`, `StatusDot`, `Skeleton`, `ErrorState`, `useLoadingGate`, `useKatran` (кит); `DetailDomain`, `DetailAction`, `DetailSummary`, `ActionIcon` (Task 7); `PageLifecycle`; `ApiError`. Сущностей виджет не импортирует (зона eslint `widgets → entities` разрешена, но спека §4.3 запрещает — проверяется ревью и отсутствием импорта в файлах этой задачи).

- [ ] **Step 1: модель — тесты (падают).** Создать `apps/pi/src/widgets/doc-detail/lib/createDetail.test.ts`:

```ts
import { allSettled, createEffect, fork } from 'effector'
import { ApiError } from '../../../shared/api'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { createDetail } from './createDetail'

type Doc = { id: string; n: number }

function setup(opts: { fail?: (id: string, call: number) => boolean; hold?: boolean } = {}) {
  const calls: string[] = []
  let release: (() => void) | null = null
  const detailFx = createEffect<string, Doc, ApiError>(async (id) => {
    calls.push(id)
    if (opts.hold) await new Promise<void>((r) => { release = r })
    if (opts.fail?.(id, calls.length)) throw new ApiError(500, null, 'Сбой сервера')
    return { id, n: calls.length }
  })
  const lifecycle = createPageLifecycle()
  const d = createDetail({ detailFx, lifecycle })
  const scope = fork()
  const open = (id: string, secondary = false) => allSettled(d.open, { scope, params: { id, secondary } })
  return { d, lifecycle, scope, calls, open, release: () => release?.() }
}

describe('createDetail (спека 2a §4.3)', () => {
  it('загрузка по слоту: loading → ready', async () => {
    const { d, scope, lifecycle, calls, release } = setup({ hold: true })
    await allSettled(lifecycle.pageOpened, { scope })
    const p = allSettled(d.open, { scope, params: { id: 'd1', secondary: false } })
    expect(scope.getState(d.$slots).a).toMatchObject({ slot: 'a', id: 'd1', tab: 'main', state: 'loading', data: null, error: null })
    expect(scope.getState(d.$slots).b).toBeNull()
    release()
    await p
    expect(scope.getState(d.$slots).a).toMatchObject({ state: 'ready', data: { id: 'd1', n: 1 } })
    expect(calls).toEqual(['d1'])
  })

  it('кэш по id: сдвиг B в A и повторное открытие не перезапрашивают', async () => {
    const { d, scope, lifecycle, calls, open } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    await open('d2', true)
    await allSettled(d.close, { scope, params: 'a' })
    expect(scope.getState(d.$slots).a).toMatchObject({ id: 'd2', state: 'ready' })
    await open('d1')
    expect(scope.getState(d.$slots).a).toMatchObject({ id: 'd1', state: 'ready', data: { n: 1 } })
    expect(calls).toEqual(['d1', 'd2'])
  })

  it('ошибка — состояние слота с текстом; retry — загрузка заново', async () => {
    const { d, scope, lifecycle, calls, open } = setup({ fail: (_id, call) => call === 1 })
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    expect(scope.getState(d.$slots).a).toMatchObject({ state: 'error', error: 'Сбой сервера', data: null })
    await allSettled(d.retry, { scope, params: 'a' })
    expect(scope.getState(d.$slots).a).toMatchObject({ state: 'ready', error: null })
    expect(calls).toEqual(['d1', 'd1'])
  })

  it('retry пустого слота ничего не делает', async () => {
    const { d, scope, lifecycle, calls } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(d.retry, { scope, params: 'b' })
    expect(calls).toEqual([])
  })

  it('уже открытый документ: запроса нет, счётчик фокуса по id растёт', async () => {
    const { d, scope, lifecycle, calls, open } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    await open('d1', true)
    await open('d1')
    expect(scope.getState(d.$focus)).toEqual({ d1: 2 })
    expect(calls).toEqual(['d1'])
  })

  it('$marks: какая запись открыта в A и в B', async () => {
    const { d, scope, lifecycle, open } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    await open('d2', true)
    expect(scope.getState(d.$marks)).toEqual({ d1: 'a', d2: 'b' })
  })

  it('pageClosed закрывает оба и чистит кэш: при возврате — новый запрос', async () => {
    const { d, scope, lifecycle, calls, open } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    await open('d2', true)
    await allSettled(lifecycle.pageClosed, { scope })
    expect(scope.getState(d.$slots)).toEqual({ a: null, b: null })
    expect(scope.getState(d.$focus)).toEqual({})
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    expect(calls).toEqual(['d1', 'd2', 'd1'])
  })

  it('ответ после ухода с экрана в кэш не попадает', async () => {
    const { d, scope, lifecycle, calls, release } = setup({ hold: true })
    await allSettled(lifecycle.pageOpened, { scope })
    const opening = allSettled(d.open, { scope, params: { id: 'd1', secondary: false } })
    const closing = allSettled(lifecycle.pageClosed, { scope })
    release()
    await Promise.all([opening, closing])
    await allSettled(lifecycle.pageOpened, { scope })
    const again = allSettled(d.open, { scope, params: { id: 'd1', secondary: false } })
    expect(scope.getState(d.$slots).a?.state).toBe('loading')
    release()
    await again
    expect(calls).toEqual(['d1', 'd1'])
  })
})
```

  Run: `pnpm --filter pi test -- createDetail` — FAIL.
- [ ] **Step 2: модель — реализация.** Создать `apps/pi/src/widgets/doc-detail/lib/createDetail.ts`:

```ts
import { attach, combine, createEvent, createStore, sample, type Effect, type EventCallable, type Store } from 'effector'
import { createDrawerStackModel, type DrawerEntry, type DrawerSlot, type DrawerStackModel } from '@katran/effector'
import type { ApiError } from '../../../shared/api'
import type { PageLifecycle } from '../../../shared/lib/lifecycle'

export type DetailSlotState = 'loading' | 'ready' | 'error'
export type DetailSlot<D> = { slot: DrawerSlot; id: string; tab: string; state: DetailSlotState; data: D | null; error: string | null }
export type DetailConfig<D> = {
  detailFx: Effect<string, D, ApiError>
  lifecycle: PageLifecycle
  /** Вкладка только что открытого документа; по умолчанию 'main'. */
  firstTab?: string | undefined
}
export type Detail<D> = {
  stack: DrawerStackModel
  $slots: Store<{ a: DetailSlot<D> | null; b: DetailSlot<D> | null }>
  /** Метки записей реестра: id → слот (DataGrid marked). */
  $marks: Store<Record<string, DrawerSlot>>
  /** Запросы фокуса по id документа: растут при повторном открытии уже открытого (Drawer focusKey). */
  $focus: Store<Record<string, number>>
  open: EventCallable<{ id: string; secondary: boolean }>
  close: EventCallable<DrawerSlot>
  closeTop: EventCallable<void>
  setTab: EventCallable<{ slot: DrawerSlot; tab: string }>
  retry: EventCallable<DrawerSlot>
}

const without = <T,>(o: Record<string, T>, k: string): Record<string, T> => {
  const next = { ...o }
  delete next[k]
  return next
}

/**
 * Деталка экрана (спека 2a §4.3): стек A/B кита плюс загрузка документа по слоту и кэш по id на время открытого экрана.
 * Модель статична после импорта; реакции извне (ответы порта) принимаются только пока экран открыт.
 */
export function createDetail<D>(cfg: DetailConfig<D>): Detail<D> {
  const { lifecycle } = cfg
  const stack = createDrawerStackModel({ firstTab: cfg.firstTab ?? 'main' })
  // своя копия эффекта: pending и отказы этой деталки не смешиваются с другими потребителями порта
  const loadFx = attach({ effect: cfg.detailFx })
  const retry = createEvent<DrawerSlot>()

  const $cache = createStore<Record<string, D>>({})
  const $errors = createStore<Record<string, string>>({})
  const $loading = createStore<Record<string, true>>({})
  const $focus = createStore<Record<string, number>>({})

  sample({
    clock: stack.opened,
    source: { cache: $cache, loading: $loading },
    filter: ({ cache, loading }, { id }) => !(id in cache) && !(id in loading),
    fn: (_, { id }) => id,
    target: loadFx,
  })
  sample({
    clock: retry,
    source: { st: stack.$stack, loading: $loading },
    filter: ({ st, loading }, slot) => { const e = st[slot]; return e !== null && !(e.id in loading) },
    fn: ({ st }, slot) => st[slot]?.id ?? '',
    target: loadFx,
  })

  $loading.on(loadFx, (l, id) => ({ ...l, [id]: true })).on(loadFx.finally, (l, { params }) => without(l, params))
  $errors.on(loadFx, (e, id) => without(e, id))
  // ответ после ухода с экрана не кладётся в кэш: при возврате деталь запросится заново
  const done = sample({ clock: loadFx.done, filter: lifecycle.$opened })
  const failed = sample({ clock: loadFx.fail, filter: lifecycle.$opened })
  $cache.on(done, (c, { params, result }) => ({ ...c, [params]: result }))
  $errors.on(failed, (e, { params, error }) => ({ ...e, [params]: error.message }))
  $focus.on(stack.alreadyOpen, (f, { id }) => ({ ...f, [id]: (f[id] ?? 0) + 1 }))

  sample({ clock: lifecycle.pageClosed, target: stack.closeAll })
  $cache.reset(lifecycle.pageClosed)
  $errors.reset(lifecycle.pageClosed)
  $loading.reset(lifecycle.pageClosed)
  $focus.reset(lifecycle.pageClosed)

  const view = (slot: DrawerSlot, e: DrawerEntry | null, cache: Record<string, D>, errors: Record<string, string>): DetailSlot<D> | null => {
    if (!e) return null
    const has = e.id in cache
    const error = errors[e.id] ?? null
    return { slot, id: e.id, tab: e.tab, state: has ? 'ready' : error !== null ? 'error' : 'loading', data: has ? (cache[e.id] as D) : null, error }
  }
  const $slots = combine(stack.$a, stack.$b, $cache, $errors, (a, b, cache, errors) => ({ a: view('a', a, cache, errors), b: view('b', b, cache, errors) }))
  const $marks = combine(stack.$a, stack.$b, (a, b) => {
    const m: Record<string, DrawerSlot> = {}
    if (a) m[a.id] = 'a'
    if (b) m[b.id] = 'b'
    return m
  })

  return { stack, $slots, $marks, $focus, open: stack.open, close: stack.close, closeTop: stack.closeTop, setTab: stack.setTab, retry }
}
```

  Run: `pnpm --filter pi test -- createDetail` — PASS (8).
- [ ] **Step 3: компонент — тесты (падают).** Создать `apps/pi/src/widgets/doc-detail/ui/DocDetail.test.tsx`:

```tsx
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { createEffect } from 'effector'
import { ApiError } from '../../../shared/api'
import type { DetailDomain, DetailSummary } from '../../../shared/lib/detail'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { renderK } from '../../../shared/lib/test'
import { createDetail } from '../lib/createDetail'
import { DocDetail } from './DocDetail'

// Синтетический домен: виджет не знает сущностей — всё доменное приходит объектом DetailDomain
type Doc = { id: string; num: string; ref: string }
const rows: Doc[] = [{ id: 'd1', num: '417', ref: 'FX2609220000417' }, { id: 'd2', num: '418', ref: 'FX2609220000418' }]
const sum = (d: Doc, tabsOff: string[]): DetailSummary => ({
  label: `Платёжная инструкция № ${d.num}`, uuid: `uuid-${d.id}`, created: '22.09.2026 07:31:45', type: 'MT103',
  status: { tone: 'ok', label: 'Обработан' }, kind: 'Клиентский перевод · входящий', tabsOff,
})
const domain: DetailDomain<Doc, Doc> = {
  title: 'Платёжная инструкция',
  tabs: [{ id: 'main', label: 'Общие данные' }, { id: 'extra', label: 'Доп. поля' }, { id: 'audit', label: 'Аудит' }],
  actions: [
    { id: 'refresh', label: 'Обновить', icon: 'refresh', hotkey: 'F5' },
    { id: 'print', label: 'Печать', icon: 'print', menu: ['Платёжное поручение', 'Форма SWIFT'] },
    { id: 'ban', label: 'Аннулировать', icon: 'ban', danger: true },
  ],
  fields: { '20': { label: 'Референс отправителя', kind: 'ref' } },
  schemaOf: () => ({ hero: ['num'], blocks: ['b1'], fieldsTitle: 'Поля MT103', grid: [['20', null]] }),
  value: (d, tag) => (tag === '20' ? { lines: [d.ref] } : null),
  summary: (d) => sum(d, ['audit']),
  rowSummary: (d) => sum(d, []),
  renderHero: (d) => ({ label: 'Номер', value: d.num }),
  renderBlock: (_d, id) => <div>Блок {id}</div>,
}

function setup(handler: (id: string) => Promise<Doc> = async (id) => rows.find((r) => r.id === id)!) {
  const detailFx = createEffect<string, Doc, ApiError>(handler)
  const lifecycle = createPageLifecycle()
  const detail = createDetail({ detailFx, lifecycle })
  const utils = renderK(
    <>
      <button type="button">Кнопка открытия</button>
      <DocDetail detail={detail} domain={domain} rowOf={(id) => rows.find((r) => r.id === id) ?? null} returnFocus={() => screen.getByText('Кнопка открытия')} />
    </>,
  )
  act(() => { lifecycle.pageOpened() })
  const open = (id: string, secondary = false) => act(() => { detail.open({ id, secondary }) })
  return { ...utils, open }
}
const names = () => screen.queryAllByRole('dialog').map((d) => d.getAttribute('aria-label'))

describe('DocDetail (спека 2a §4.3, §5)', () => {
  it('открытие: имя и лейн из строки реестра сразу, после загрузки — «Общие данные» по схеме', async () => {
    const { open } = setup()
    open('d1')
    expect(names()).toEqual(['Платёжная инструкция № 417'])
    expect(screen.getByText('Обработан')).toBeInTheDocument()
    expect(await screen.findByText('Блок b1')).toBeInTheDocument()
    expect(document.querySelector('[data-field="20"]')).toHaveTextContent('FX2609220000417')
    expect(screen.getByRole('button', { name: 'uuid-d1' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Действия с документом' })).toBeInTheDocument()
  })

  it('медленная загрузка — скелетон формы, шапка — из строки реестра', async () => {
    const { open } = setup(() => new Promise<Doc>(() => {}))
    open('d1')
    await waitFor(() => expect(document.querySelector('[data-part="skeleton"]')).not.toBeNull())
    expect(names()).toEqual(['Платёжная инструкция № 417'])
    expect(screen.getByText('Клиентский перевод · входящий')).toBeInTheDocument()
  })

  it('ошибка — alert с текстом ApiError и «Повторить»; повтор загружает', async () => {
    let fail = true
    const { open } = setup(async (id) => {
      if (fail) throw new ApiError(500, null, 'Сбой сервера: Регулятор ?fail=detail')
      return rows.find((r) => r.id === id)!
    })
    open('d1')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Не удалось загрузить документ')
    expect(alert).toHaveTextContent('Сбой сервера: Регулятор ?fail=detail')
    expect(names()).toEqual(['Платёжная инструкция № 417'])
    fail = false
    await userEvent.click(within(alert).getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByText('Блок b1')).toBeInTheDocument()
  })

  it('вкладки: без данных — недоступна; другая — «будет в срезе 2b»', async () => {
    const { open } = setup()
    open('d1')
    await screen.findByText('Блок b1')
    expect(screen.getByRole('tab', { name: 'Аудит' })).toBeDisabled()
    await userEvent.click(screen.getByRole('tab', { name: 'Доп. поля' }))
    expect(screen.getByRole('tab', { name: 'Доп. поля' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Вкладка «Доп. поля» — будет в срезе 2b')).toBeInTheDocument()
  })

  it('действия — заглушки с объявлением; печать — меню форм', async () => {
    const { open } = setup()
    open('d1')
    await screen.findByText('Блок b1')
    const refresh = screen.getByRole('button', { name: 'Обновить' })
    expect(refresh).toHaveAttribute('data-k-tip', 'Обновить · F5')
    await userEvent.click(refresh)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Обновить · Платёжная инструкция № 417'))
    await userEvent.click(screen.getByRole('button', { name: 'Печать' }))
    await userEvent.click(within(screen.getByRole('menu', { name: 'Печать — печатная форма' })).getByRole('menuitem', { name: 'Форма SWIFT' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Печать: Форма SWIFT · Платёжная инструкция № 417'))
  })

  it('A и B рядом; Esc закрывает B, потом A; фокус возвращается', async () => {
    const { open } = setup()
    open('d1')
    open('d2', true)
    await waitFor(() => expect(screen.getAllByText('Блок b1')).toHaveLength(2))
    expect(names()).toEqual(['Платёжная инструкция № 418', 'Платёжная инструкция № 417'])
    expect(screen.getByText('B · сравнение')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(names()).toEqual(['Платёжная инструкция № 417'])
    await userEvent.keyboard('{Escape}')
    expect(names()).toEqual([])
    expect(screen.getByText('Кнопка открытия')).toHaveFocus()
  })

  it('повторное открытие открытого — фокус в заголовок его drawer', async () => {
    const { open } = setup()
    open('d1')
    await screen.findByText('Блок b1')
    screen.getByText('Кнопка открытия').focus()
    open('d1')
    expect(screen.getByRole('heading', { name: 'Платёжная инструкция' })).toHaveFocus()
  })

  it('«Закрыть» — drawer закрыт, фокус на кнопке открытия', async () => {
    const { open } = setup()
    open('d1')
    await screen.findByText('Блок b1')
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(names()).toEqual([])
    expect(screen.getByText('Кнопка открытия')).toHaveFocus()
  })

  it('без нарушений axe', async () => {
    const { container, open } = setup()
    open('d1')
    await screen.findByText('Блок b1')
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

- [ ] **Step 4: компонент — реализация.** Создать `apps/pi/src/widgets/doc-detail/ui/icons.tsx`:

```tsx
import type { ReactElement } from 'react'
import type { ActionIcon } from '../../../shared/lib/detail'

// Пиктограммы действий — символы стенда (grid.html, <symbol id="i-…">), viewBox 24
const PATHS: Record<ActionIcon, ReactElement> = {
  refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />,
  doc: <path d="M14 3H6v18h12V7l-4-4zM14 3v4h4M12 11v6M9 14h6" />,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  print: <path d="M7 9V4h10v5M7 17H4v-7h16v7h-3M7 14h10v6H7z" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  ban: <><circle cx="12" cy="12" r="8" /><path d="M6.5 6.5l11 11" /></>,
}

export function ActionGlyph({ icon }: { icon: ActionIcon }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{PATHS[icon]}</svg>
}
```

  Создать `apps/pi/src/widgets/doc-detail/ui/DocDetail.tsx`:

```tsx
import { useRef, useState } from 'react'
import { useUnit } from 'effector-react'
import {
  ConfigForm, Drawer, DrawerStack, ErrorState, IconButton, LinkValue, Menu, Skeleton, StatusDot, TabPanel, Tabs, Tag,
  useKatran, useLoadingGate, type DrawerStackItem,
} from '@katran/ui'
import type { DetailAction, DetailDomain, DetailSummary } from '../../../shared/lib/detail'
import type { Detail, DetailSlot } from '../lib/createDetail'
import { ActionGlyph } from './icons'
import s from './DocDetail.module.css'

export type DocDetailProps<D, Row> = {
  detail: Detail<D>
  /** Всё доменное — схема, поля, вкладки, действия, блоки (спека 2a §4.3): виджет не импортирует entities. */
  domain: DetailDomain<D, Row>
  /** Строка реестра по id — шапка и лейн до загрузки и при ошибке (номер, статус). */
  rowOf?: ((id: string) => Row | null) | undefined
  /** Куда вернуть фокус при закрытии: кнопка открытия записи, её нет — грид (gridFocusTarget кита). */
  returnFocus?: ((id: string) => HTMLElement | null) | undefined
}

type OnAction = (a: DetailAction, form?: string) => void

function ActionButton({ action, onAction }: { action: DetailAction; onAction: OnAction }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const menu = action.menu
  return (
    <>
      {action.danger && <span className={s.sep} aria-hidden="true" />}
      <IconButton
        ref={ref}
        label={action.label}
        data-k-tip={action.hotkey ? `${action.label} · ${action.hotkey}` : action.label}
        className={action.danger ? s.danger : undefined}
        aria-haspopup={menu ? 'menu' : undefined}
        aria-expanded={menu ? open : undefined}
        onClick={() => (menu ? setOpen(true) : onAction(action))}
      >
        <ActionGlyph icon={action.icon} />
      </IconButton>
      {menu && (
        <Menu open={open} anchor={ref} onClose={() => setOpen(false)} title={`${action.label} — печатная форма`}
          items={menu.map((f) => ({ id: f, label: f, onSelect: () => onAction(action, f) }))} />
      )}
    </>
  )
}

/** Лейн (эталон laneHtml, index.html:1034): тег типа, статус, «название · направление», действия; «Аннулировать» — за разделителем. */
function Lane({ summary, actions, onAction }: { summary: DetailSummary | null; actions: DetailAction[]; onAction: OnAction }) {
  return (
    <div className={s.lane} data-part="lane">
      {summary && (
        <>
          <Tag tone="mt">{summary.type}</Tag>
          <span className={s.status}><StatusDot tone={summary.status.tone} size="s" />{summary.status.label}</span>
          <span className={s.kind}>{summary.kind}</span>
        </>
      )}
      <div role="group" aria-label="Действия с документом" className={s.acts}>
        {actions.map((a) => <ActionButton key={a.id} action={a} onAction={onAction} />)}
      </div>
    </div>
  )
}

function FormSkeleton() {
  return (
    <div className={s.skeleton} data-part="skeleton" aria-busy="true">
      <span className={s.sr}>Загрузка документа</span>
      <Skeleton.Block height={44} />
      <Skeleton.Block height={60} />
      <Skeleton.Line lines={3} width="60%" />
      <Skeleton.Block height={120} />
    </div>
  )
}

type BodyProps<D, Row> = { view: DetailSlot<D>; domain: DetailDomain<D, Row>; skeleton: boolean; tabLabel: string; first: boolean; onRetry: () => void }

function Body<D, Row>({ view, domain, skeleton, tabLabel, first, onRetry }: BodyProps<D, Row>) {
  // ворота скелетона держат его минимум sk-min (400 мс, как у грида) — данные и ошибка до этого не показываются
  if (skeleton) return <FormSkeleton />
  if (view.state === 'error') return <ErrorState title="Не удалось загрузить документ" text={view.error ?? undefined} retry={onRetry} />
  const d = view.data
  if (d === null) return null
  if (!first) return <div className={s.stub}>Вкладка «{tabLabel}» — будет в срезе 2b</div>
  const renderSection = domain.renderSection
  return (
    <ConfigForm
      schema={domain.schemaOf(d)}
      fields={domain.fields}
      value={(tag) => domain.value(d, tag)}
      present={domain.present}
      optionLabels={domain.optionLabels}
      renderHero={(id) => domain.renderHero(d, id)}
      renderBlock={(id) => domain.renderBlock(d, id)}
      renderSection={renderSection ? (id) => renderSection(d, id) : undefined}
    />
  )
}

type PaneProps<D, Row> = Omit<DocDetailProps<D, Row>, 'detail'> & { detail: Detail<D>; view: DetailSlot<D>; focusKey: number }

function DetailPane<D, Row>({ view, detail, domain, rowOf, returnFocus, focusKey }: PaneProps<D, Row>) {
  const [close, setTab, retry] = useUnit([detail.close, detail.setTab, detail.retry])
  const { announce } = useKatran()
  const skeleton = useLoadingGate(view.state === 'loading')
  const row = view.data === null && rowOf ? rowOf(view.id) : null
  const summary = view.data !== null ? domain.summary(view.data) : row !== null ? domain.rowSummary(row) : null
  const label = summary?.label ?? domain.title
  const off = summary?.tabsOff ?? []
  const tabsId = `doc-detail-${view.slot}`
  const onAction: OnAction = (a, form) => announce(form ? `${a.label}: ${form} · ${label}` : `${a.label} · ${label}`)
  const tabLabel = domain.tabs.find((t) => t.id === view.tab)?.label ?? view.tab
  return (
    <Drawer
      label={label}
      title={domain.title}
      meta={summary ? <><LinkValue name={summary.uuid} value={summary.uuid} /><span>{summary.created}</span></> : undefined}
      badge={view.slot === 'b' ? { text: 'B · сравнение', tone: 'b' } : { text: 'A', tone: 'a' }}
      onClose={() => close(view.slot)}
      returnFocus={returnFocus ? () => returnFocus(view.id) : undefined}
      focusKey={focusKey}
    >
      <Lane summary={summary} actions={domain.actions} onAction={onAction} />
      <div className={s.tabs} data-part="tabs">
        <Tabs
          id={tabsId}
          label="Разделы документа"
          variant="line"
          overflow
          value={view.tab}
          onChange={(tab) => setTab({ slot: view.slot, tab })}
          items={domain.tabs.map((t) => ({ id: t.id, label: t.label, disabled: off.includes(t.id), hint: off.includes(t.id) ? 'Нет данных' : undefined }))}
        />
      </div>
      {domain.tabs.map((t) => (
        <TabPanel key={t.id} tabsId={tabsId} tabId={t.id} active={t.id === view.tab} className={s.body}>
          <Body view={view} domain={domain} skeleton={skeleton} tabLabel={tabLabel} first={t.id === domain.tabs[0]?.id} onRetry={() => retry(view.slot)} />
        </TabPanel>
      ))}
    </Drawer>
  )
}

/** Деталка документа (спека 2a §4.3): DrawerStack кита, в слоте — шапка, лейн, вкладки с переполнением, «Общие данные» по схеме. */
export function DocDetail<D, Row>({ detail, domain, rowOf, returnFocus }: DocDetailProps<D, Row>) {
  const [slots, focus, closeTop] = useUnit([detail.$slots, detail.$focus, detail.closeTop])
  const items: DrawerStackItem[] = []
  for (const slot of ['a', 'b'] as const) {
    const view = slots[slot]
    if (view) {
      items.push({
        key: view.id,
        slot,
        node: <DetailPane view={view} detail={detail} domain={domain} rowOf={rowOf} returnFocus={returnFocus} focusKey={focus[view.id] ?? 0} />,
      })
    }
  }
  return <DrawerStack items={items} onEscape={closeTop} />
}
```

  Создать `apps/pi/src/widgets/doc-detail/ui/DocDetail.module.css`:

```css
/* Лейн действий 36 (эталон .lane, index.html:103): border-box — высота с рамками, как на эталоне */
.lane {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: var(--k-sp-2);
  height: var(--k-lane);
  padding: 0 var(--k-sp-2) 0 var(--k-dw-pad);
  border-top: 1px solid var(--k-line);
  border-bottom: 1px solid var(--k-line);
  background: var(--k-sunk);
  white-space: nowrap;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: var(--k-sp-1);
  font: 600 var(--k-fs-3) / 1 var(--k-sans);
  color: var(--k-ink2);
}

.kind {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--k-fs-1);
  color: var(--k-ink2);
}

.acts {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.sep {
  height: var(--k-icon-m);
  margin: 0 var(--k-sp-1);
  border-left: 1px solid var(--k-line);
}

/* двойной класс — выше наведения ghost-кнопки кита независимо от порядка правил в бандле */
.danger.danger:hover {
  color: var(--k-bad);
}

/* полоса вкладок: нижняя рамка — здесь, подчёркивание выбранной вкладки ложится на неё (Tabs variant line) */
.tabs {
  padding: 0 var(--k-dw-pad);
  border-bottom: 1px solid var(--k-line);
}

/* содержимое вкладки (эталон .db: 10 14 14, зазор 8) */
.body {
  display: flex;
  flex-direction: column;
  gap: var(--k-sp-2);
  padding: var(--k-sp-2) var(--k-dw-pad) var(--k-dw-pad);
}

.body:focus-visible {
  outline: 2px solid var(--k-val);
  outline-offset: -2px;
}

.stub {
  padding: var(--k-sp-6) var(--k-sp-3);
  border: 1px dashed var(--k-line);
  border-radius: var(--k-r-s);
  text-align: center;
  color: var(--k-muted);
}

.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--k-sp-2);
}

.sr {
  position: absolute;
  inline-size: 0;
  block-size: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

  Создать `apps/pi/src/widgets/doc-detail/index.ts`:

```ts
export { createDetail, type Detail, type DetailConfig, type DetailSlot, type DetailSlotState } from './lib/createDetail'
export { DocDetail, type DocDetailProps } from './ui/DocDetail'
```

  Run: `pnpm --filter pi test -- doc-detail` — PASS.
- [ ] **Step 5: axe на реальных профилях.** Создать `apps/pi/src/app/details.a11y.test.tsx`:

```tsx
import { act, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { createEffect } from 'effector'
import { FX_TYPES, fxDocDetailDomain, parseFxDocDetail } from '../entities/fx-doc'
import { RUB_TYPES, parseRubDocDetail, rubDocDetailDomain } from '../entities/rub-doc'
import type { ApiError } from '../shared/api'
import type { DetailDomain } from '../shared/lib/detail'
import { createPageLifecycle } from '../shared/lib/lifecycle'
import { renderK } from '../shared/lib/test'
import { createDetail, DocDetail } from '../widgets/doc-detail'
import { makeFxDocs } from './fake/fx-docs.data'
import { makeFxDocDetail } from './fake/fx-docs.detail'
import { makeRubDocs } from './fake/rub-docs.data'
import { makeRubDocDetail } from './fake/rub-docs.detail'

/** Деталка с загруженным документом под axe (спека 2a §6): реальные домен, данные фейка и маппер. */
async function check<D extends { id: string }, Row>(domain: DetailDomain<D, Row>, doc: D, ready: RegExp) {
  const detailFx = createEffect<string, D, ApiError>(async () => doc)
  const lifecycle = createPageLifecycle()
  const detail = createDetail({ detailFx, lifecycle })
  const { container, unmount } = renderK(<DocDetail detail={detail} domain={domain} />)
  act(() => {
    lifecycle.pageOpened()
    detail.open({ id: doc.id, secondary: false })
  })
  await screen.findByRole('heading', { name: ready })
  expect(await axe(container)).toHaveNoViolations()
  unmount()
}

describe('a11y деталки на реальных профилях обоих реестров (спека 2a §6)', () => {
  it('валюта: каждый тип MT', async () => {
    const rows = makeFxDocs()
    for (const t of FX_TYPES) {
      const i = rows.findIndex((r) => r.type === t)
      if (i < 0) continue
      await check(fxDocDetailDomain, parseFxDocDetail(makeFxDocDetail(rows[i]!, i), 'ответ'), new RegExp(`^Поля ${t}$`))
    }
  }, 60_000)
  it('рубль: каждый вид документа', async () => {
    const rows = makeRubDocs()
    for (const t of RUB_TYPES) {
      const i = rows.findIndex((r) => r.type === t)
      await check(rubDocDetailDomain, parseRubDocDetail(makeRubDocDetail(rows[i]!, i), 'ответ'), /^Отправитель \/ Получатель$/)
    }
  }, 60_000)
})
```

- [ ] **Step 6: запуск.** `pnpm --filter pi test` — PASS. `pnpm check` — зелёный; `grep -rn "entities" apps/pi/src/widgets/doc-detail` — пусто (виджет сущностей не знает).
- [ ] **Step 7: commit.**

```bash
git add apps/pi/src/widgets/doc-detail/index.ts apps/pi/src/widgets/doc-detail/lib/createDetail.ts apps/pi/src/widgets/doc-detail/lib/createDetail.test.ts apps/pi/src/widgets/doc-detail/ui/DocDetail.tsx apps/pi/src/widgets/doc-detail/ui/DocDetail.module.css apps/pi/src/widgets/doc-detail/ui/icons.tsx apps/pi/src/widgets/doc-detail/ui/DocDetail.test.tsx apps/pi/src/app/details.a11y.test.tsx
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "apps/pi: виджет doc-detail — стек A/B с загрузкой по слоту и кэшем, шапка, лейн, вкладки, «Общие данные»"
```

---
### Task 11: Страницы — связка с реестром, метка открытых, e2e

**Стоп-точка:** перед Step 3 — ответ владельца на **В-Д4** (открывать ли первую запись при входе на экран). По умолчанию (ответ «нет» или «как в спеке») Step 3 выполняется без блока «В-Д4 = да».

**Files:**
- Create: `apps/pi/src/pages/fx-docs/model/registry.model.test.ts`, `apps/pi/src/pages/rub-docs/model/registry.model.test.ts`, `apps/pi/e2e/detail.spec.ts`
- Modify: `apps/pi/src/widgets/doc-registry/ui/DocRegistry.tsx`, `apps/pi/src/widgets/doc-registry/ui/DocRegistry.test.tsx`, `apps/pi/src/pages/fx-docs/model/registry.model.ts`, `apps/pi/src/pages/fx-docs/ui/FxDocsPage.tsx`, `apps/pi/src/pages/rub-docs/model/registry.model.ts`, `apps/pi/src/pages/rub-docs/ui/RubDocsPage.tsx`

**Interfaces:**
- Produces: `DocRegistryProps<Row>.marked?: ((row: Row) => 'a' | 'b' | null) | undefined` (пробрасывается в `DataGrid`); модели страниц экспортируют `detail: Detail<FxDocDetail>` / `Detail<RubDocDetail>` рядом с `lifecycle` и `registry`; связь `sample({ clock: registry.openRequested, target: detail.open })`.
- Consumes: `createDetail`, `DocDetail` (Task 10); `fxDocDetailDomain`, `rubDocDetailDomain`, `fxDocPorts.detailFx`, `rubDocPorts.detailFx` (Task 8, 9); `gridFocusTarget` (Task 6); числа `REF` (Task 1).

- [ ] **Step 1: тесты (падают).** В `apps/pi/src/widgets/doc-registry/ui/DocRegistry.test.tsx` в `describe` добавить:

```tsx
  it('marked — метка открытых в деталке на записи грида', async () => {
    const { registry, lifecycle } = make()
    renderK(<DocRegistry registry={registry} layout={layout} title="Реестр" describe={(r) => r.name} marked={(r) => (r.id === 'a' ? 'a' : null)} />)
    act(() => { lifecycle.pageOpened() })
    await screen.findByText('Альфа')
    expect(document.querySelector('tbody[data-key="a"]')).toHaveAttribute('data-mark', 'a')
  })
```

  Создать `apps/pi/src/pages/fx-docs/model/registry.model.test.ts`:

```ts
import { allSettled, fork } from 'effector'
import { FX_DETAIL_EXAMPLE, fxDocPorts, parseFxDocDetail } from '../../../entities/fx-doc'
import { detail, lifecycle, registry } from './registry.model'

describe('страница fx-docs: реестр → деталка (спека 2a §4.4)', () => {
  it('openRequested открывает деталку, secondary — рядом; уход с экрана закрывает оба', async () => {
    const doc = parseFxDocDetail(FX_DETAIL_EXAMPLE, 'ответ')
    const scope = fork({
      handlers: [
        [fxDocPorts.detailFx, async (id: string) => ({ ...doc, id })],
        [fxDocPorts.searchFx, async () => ({ rows: [], total: 0 })],
        [fxDocPorts.facetsFx, async () => []],
        [fxDocPorts.filterMetaFx, async () => ({ fields: [] })],
      ],
    })
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(registry.openRequested, { scope, params: { id: 'u1', secondary: false } })
    await allSettled(registry.openRequested, { scope, params: { id: 'u2', secondary: true } })
    expect(scope.getState(detail.$marks)).toEqual({ u1: 'a', u2: 'b' })
    expect(scope.getState(detail.$slots).a).toMatchObject({ id: 'u1', state: 'ready' })
    await allSettled(lifecycle.pageClosed, { scope })
    expect(scope.getState(detail.$slots)).toEqual({ a: null, b: null })
  })
})
```

  Создать `apps/pi/src/pages/rub-docs/model/registry.model.test.ts`:

```ts
import { allSettled, fork } from 'effector'
import { RUB_DETAIL_EXAMPLE, parseRubDocDetail, rubDocPorts } from '../../../entities/rub-doc'
import { detail, lifecycle, registry } from './registry.model'

describe('страница rub-docs: реестр → деталка (спека 2a §4.4)', () => {
  it('openRequested открывает деталку; уход с экрана закрывает', async () => {
    const doc = parseRubDocDetail(RUB_DETAIL_EXAMPLE, 'ответ')
    const scope = fork({
      handlers: [
        [rubDocPorts.detailFx, async (id: string) => ({ ...doc, id })],
        [rubDocPorts.searchFx, async () => ({ rows: [], total: 0 })],
        [rubDocPorts.facetsFx, async () => []],
        [rubDocPorts.filterMetaFx, async () => ({ fields: [] })],
      ],
    })
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(registry.openRequested, { scope, params: { id: 'r1', secondary: false } })
    expect(scope.getState(detail.$slots).a).toMatchObject({ id: 'r1', state: 'ready' })
    await allSettled(lifecycle.pageClosed, { scope })
    expect(scope.getState(detail.$marks)).toEqual({})
  })
})
```

  Run: `pnpm --filter pi test -- registry.model DocRegistry` — FAIL (нет `detail`, нет `marked`).
- [ ] **Step 2: `DocRegistry`.** В `apps/pi/src/widgets/doc-registry/ui/DocRegistry.tsx` в `DocRegistryProps` после `openHint` добавить

```ts
  /** Записи, открытые в деталке (спека 2a §3.1): 'a' — основная, 'b' — сравнение. Экран берёт из модели деталки. */
  marked?: ((row: Row) => 'a' | 'b' | null) | undefined
```

  в деструктуризацию пропсов — `marked`, в `<DataGrid …>` после `openHint={openHint}` — `marked={marked}`.
- [ ] **Step 3: модели страниц.** Заменить `apps/pi/src/pages/fx-docs/model/registry.model.ts`:

```ts
import { sample } from 'effector'
import { fxDocLayout, fxDocPorts } from '../../../entities/fx-doc'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { createDetail } from '../../../widgets/doc-detail'
import { createRegistry } from '../../../widgets/doc-registry'

export const lifecycle = createPageLifecycle()
export const registry = createRegistry({ id: 'fx-docs', layout: fxDocLayout, ports: fxDocPorts, lifecycle })
/** Деталка экрана — на том же жизненном цикле: уход с экрана закрывает оба drawer'а и чистит кэш (спека 2a §5). */
export const detail = createDetail({ detailFx: fxDocPorts.detailFx, lifecycle })
// реестр о деталке не знает: открытие — через шов openRequested (спека apps/pi §7, спека 2a §4.4)
sample({ clock: registry.openRequested, target: detail.open })
```

  Заменить `apps/pi/src/pages/rub-docs/model/registry.model.ts`:

```ts
import { sample } from 'effector'
import { rubDocLayout, rubDocPorts } from '../../../entities/rub-doc'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { createDetail } from '../../../widgets/doc-detail'
import { createRegistry } from '../../../widgets/doc-registry'

export const lifecycle = createPageLifecycle()
export const registry = createRegistry({ id: 'rub-docs', layout: rubDocLayout, ports: rubDocPorts, lifecycle })
/** Деталка экрана — на том же жизненном цикле (спека 2a §5). */
export const detail = createDetail({ detailFx: rubDocPorts.detailFx, lifecycle })
sample({ clock: registry.openRequested, target: detail.open })
```

  **Только если В-Д4 = «открывать первую запись»** — в конец обоих файлов (`fxDocLayout` → `rubDocLayout` во втором), импорт `createStore` из `effector`:

```ts
// В-Д4: при первом ответе реестра после входа на экран первая запись открывается в A (эталон grid.html:2192)
const $autoOpened = createStore(false).reset(lifecycle.pageClosed)
const firstRow = sample({
  clock: registry.grid.$rows.updates,
  source: { done: $autoOpened, opened: lifecycle.$opened },
  filter: ({ done, opened }, rows) => opened && !done && rows.length > 0,
  fn: (_, rows) => rows[0]!,
})
$autoOpened.on(firstRow, () => true)
sample({ clock: firstRow, fn: (row) => ({ id: fxDocLayout.rowKey(row), secondary: false }), target: detail.open })
```

  и в e2e Step 5 `AUTO_OPEN = true`.
- [ ] **Step 4: экраны.** Заменить `apps/pi/src/pages/fx-docs/ui/FxDocsPage.tsx`:

```tsx
import { useUnit } from 'effector-react'
import { gridFocusTarget, useKatran } from '@katran/ui'
import { fxDocDetailDomain, fxDocLayout } from '../../../entities/fx-doc'
import { DocDetail } from '../../../widgets/doc-detail'
import { DocRegistry } from '../../../widgets/doc-registry'
import { detail, registry } from '../model/registry.model'

const TITLE = 'Валютные документы'

/** note — пояснение над реестром; текст задаёт приложение (у стенда — про фейковый сервер), слайс его не знает. */
export function FxDocsPage({ note }: { note?: string | undefined }) {
  const { announce } = useKatran()
  const [rows, marks] = useUnit([registry.grid.$rows, detail.$marks])
  return (
    <>
      <DocRegistry
        registry={registry}
        layout={fxDocLayout}
        title={TITLE}
        describe={(d) => `документ ${d.docNumber}`}
        note={note}
        bulkActions={[
          { label: 'Экспортировать', onClick: (n) => announce(`Экспорт: выбрано ${n}`) },
          { label: 'Отложить', onClick: (n) => announce(`Отложить: выбрано ${n}`) },
        ]}
        rowState={(d) => (d.lock ? { kind: 'locked', ...d.lock } : d.inactive ? { kind: 'inactive', ...d.inactive } : null)}
        openHint="Открыть деталку · двойной клик или Shift — рядом для сравнения"
        marked={(d) => marks[fxDocLayout.rowKey(d)] ?? null}
      />
      <DocDetail
        detail={detail}
        domain={fxDocDetailDomain}
        rowOf={(id) => rows.find((r) => fxDocLayout.rowKey(r) === id) ?? null}
        returnFocus={(id) => gridFocusTarget(TITLE, id)}
      />
    </>
  )
}
```

  Заменить `apps/pi/src/pages/rub-docs/ui/RubDocsPage.tsx`:

```tsx
import { useUnit } from 'effector-react'
import { gridFocusTarget, useKatran } from '@katran/ui'
import { rubDocDetailDomain, rubDocLayout } from '../../../entities/rub-doc'
import { DocDetail } from '../../../widgets/doc-detail'
import { DocRegistry } from '../../../widgets/doc-registry'
import { detail, registry } from '../model/registry.model'

const TITLE = 'Рублёвые документы'

/** note — пояснение над реестром; текст задаёт приложение (у стенда — про фейковый сервер), слайс его не знает. */
export function RubDocsPage({ note }: { note?: string | undefined }) {
  const { announce } = useKatran()
  const [rows, marks] = useUnit([registry.grid.$rows, detail.$marks])
  return (
    <>
      <DocRegistry
        registry={registry}
        layout={rubDocLayout}
        title={TITLE}
        describe={(d) => `документ ${d.docNumber}`}
        note={note}
        bulkActions={[
          { label: 'Экспортировать', onClick: (n) => announce(`Экспорт: выбрано ${n}`) },
          { label: 'Отложить', onClick: (n) => announce(`Отложить: выбрано ${n}`) },
        ]}
        rowState={(d) => (d.lock ? { kind: 'locked', ...d.lock } : d.inactive ? { kind: 'inactive', ...d.inactive } : null)}
        openHint="Открыть деталку · двойной клик или Shift — рядом для сравнения"
        marked={(d) => marks[rubDocLayout.rowKey(d)] ?? null}
      />
      <DocDetail
        detail={detail}
        domain={rubDocDetailDomain}
        rowOf={(id) => rows.find((r) => rubDocLayout.rowKey(r) === id) ?? null}
        returnFocus={(id) => gridFocusTarget(TITLE, id)}
      />
    </>
  )
}
```

  Run: `pnpm --filter pi test` — PASS. `pnpm check` — зелёный.
- [ ] **Step 5: e2e.** Создать `apps/pi/e2e/detail.spec.ts` (числа `REF` — из Task 1, «Замер эталона» в `detail-drift.md`; если замер дал другие — подставить их):

```ts
import { expect, test, type Page } from '@playwright/test'

// Замер эталона (Task 1, detail-drift.md): Chromium 1600×1000, масштаб 100 %
const REF = { width: 800, head: 44, lane: 36, tabs: 32, field: 27, partyRow: 23 }
const TOL = 2
// В-Д4 (detail-drift.md): открывается ли первая запись при входе на экран
const AUTO_OPEN = false

test.use({ viewport: { width: 1600, height: 1000 } })
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.clear()) })

const dialogs = (page: Page) => page.getByRole('dialog', { name: /^Платёжная инструкция/ })
const openBtn = (page: Page, n: number) => page.getByRole('button', { name: new RegExp(`^Открыть запись ${n}(\\D|$)`) })
const ready = (page: Page, i = 0) => dialogs(page).nth(i).locator('[data-part="hero"]').waitFor()
const heightIn = async (page: Page, sel: string) => (await dialogs(page).first().locator(sel).first().boundingBox())!.height

/** Экран на 100 % без открытых деталок (при AUTO_OPEN первая запись открыта сразу — закрываем Esc). */
async function start(page: Page, route: 'fx-docs' | 'rub-docs', query = 'slow=0') {
  await page.goto(`/?${query}#/${route}`)
  await page.getByRole('button', { name: '100 %' }).click()
  await page.locator('tbody[data-key]').first().waitFor()
  while (await dialogs(page).count() > 0) await page.keyboard.press('Escape')
}
/** Открыть первую запись с текстом (тип документа) — у валюты строка SWIFT-поля есть не у MT199. */
async function openWith(page: Page, text: string) {
  await page.locator('tbody[data-key]', { hasText: text }).first().locator('[data-k-open]').click()
  await ready(page)
}

for (const route of ['fx-docs', 'rub-docs'] as const) {
  test(`геометрия деталки против эталона ± ${TOL} (${route})`, async ({ page }) => {
    await start(page, route)
    await openWith(page, route === 'fx-docs' ? 'MT103' : 'PAYDOCRU')
    const dw = dialogs(page).first()
    const box = (await dw.boundingBox())!
    const geo = {
      width: box.width, right: box.x + box.width,
      head: await heightIn(page, '[data-part="head"]'), lane: await heightIn(page, '[data-part="lane"]'), tabs: await heightIn(page, '[data-part="tabs"]'),
      row: route === 'fx-docs'
        // строка SWIFT-поля (не текстовое 70/72): кнопка раскрытия — прямой потомок строки, мерим её родителя
        ? (await dw.locator('[data-field]:not([data-empty]) > button').first().locator('..').boundingBox())!.height
        : await heightIn(page, 'tr[data-part="party-row"]'),
    }
    test.info().annotations.push({ type: 'geometry', description: `${route}: ${JSON.stringify(geo)}` })
    expect(Math.abs(geo.width - REF.width)).toBeLessThanOrEqual(TOL)
    expect(Math.abs(geo.right - 1600)).toBeLessThanOrEqual(1)
    expect(Math.abs(geo.head - REF.head)).toBeLessThanOrEqual(TOL)
    expect(Math.abs(geo.lane - REF.lane)).toBeLessThanOrEqual(TOL)
    expect(Math.abs(geo.tabs - REF.tabs)).toBeLessThanOrEqual(TOL)
    expect(Math.abs(geo.row - (route === 'fx-docs' ? REF.field : REF.partyRow))).toBeLessThanOrEqual(TOL)
    await expect(dw.getByRole('heading', { name: 'Платёжная инструкция' })).toBeFocused()
    // скриншот сверки — рядом со скриншотом эталона Task 1
    await page.screenshot({ path: test.info().outputPath(`detail-${route}.png`) })
  })
}

test('A и B рядом: двойной клик открывает B слева, A не заменяется; записи помечены', async ({ page }) => {
  await start(page, 'fx-docs')
  await openBtn(page, 1).click()
  await expect(dialogs(page)).toHaveCount(1)
  const nameA = await dialogs(page).first().getAttribute('aria-label')
  await openBtn(page, 2).dblclick()
  await expect(dialogs(page)).toHaveCount(2)
  const b = dialogs(page).nth(0)
  const a = dialogs(page).nth(1)
  expect(await a.getAttribute('aria-label')).toBe(nameA)
  expect(await b.getAttribute('aria-label')).not.toBe(nameA)
  const ab = (await a.boundingBox())!
  const bb = (await b.boundingBox())!
  expect(Math.abs(bb.x + bb.width - ab.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(ab.x + ab.width - 1600)).toBeLessThanOrEqual(1)
  await expect(b.getByText('B · сравнение')).toBeVisible()
  await expect(page.locator('tbody[data-key][data-mark="a"]')).toHaveCount(1)
  await expect(page.locator('tbody[data-key][data-mark="b"]')).toHaveCount(1)
})

test('Shift+клик — второй drawer сразу', async ({ page }) => {
  await start(page, 'fx-docs')
  await openBtn(page, 1).click()
  await expect(dialogs(page)).toHaveCount(1)
  await openBtn(page, 2).click({ modifiers: ['Shift'] })
  await expect(dialogs(page)).toHaveCount(2)
})

test('Esc закрывает сначала B, потом A; фокус — на кнопке открытия записи', async ({ page }) => {
  await start(page, 'fx-docs')
  await openBtn(page, 1).click()
  await expect(dialogs(page)).toHaveCount(1)
  const nameA = await dialogs(page).first().getAttribute('aria-label')
  await openBtn(page, 2).dblclick()
  await expect(dialogs(page)).toHaveCount(2)
  await page.keyboard.press('Escape')
  await expect(dialogs(page)).toHaveCount(1)
  expect(await dialogs(page).first().getAttribute('aria-label')).toBe(nameA)
  await page.keyboard.press('Escape')
  await expect(dialogs(page)).toHaveCount(0)
  await expect(openBtn(page, 1)).toBeFocused()
})

test('повторное открытие открытого — второго drawer нет, фокус в его заголовок', async ({ page }) => {
  await start(page, 'fx-docs')
  await openBtn(page, 1).click()
  await ready(page)
  await openBtn(page, 1).click()
  await page.waitForTimeout(400)
  await expect(dialogs(page)).toHaveCount(1)
  await expect(dialogs(page).first().getByRole('heading', { name: 'Платёжная инструкция' })).toBeFocused()
})

test('вкладки: в полосе 800 px не помещаются все — «••• N»; Esc закрывает меню, а не drawer', async ({ page }) => {
  await start(page, 'fx-docs')
  await openWith(page, 'MT103')
  const dw = dialogs(page).first()
  const more = dw.getByRole('button', { name: /^Ещё вкладки: \d+$/ })
  await expect(more).toBeVisible()
  const n = Number(((await more.getAttribute('aria-label')) ?? '').replace(/\D/g, ''))
  await more.click()
  const menu = page.getByRole('menu', { name: 'Вкладки' })
  await expect(menu.getByRole('menuitem')).toHaveCount(n)
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(dialogs(page)).toHaveCount(1)
  await dw.getByRole('tab', { name: 'Статусы' }).click()
  await expect(dw.getByText('Вкладка «Статусы» — будет в срезе 2b')).toBeVisible()
})

test('медленная загрузка — скелетон, затем форма', async ({ page }) => {
  await start(page, 'fx-docs', 'slow=1500')
  await openBtn(page, 1).click()
  await expect(dialogs(page).first().locator('[data-part="skeleton"]')).toBeVisible()
  await ready(page)
})

test('?fail=detail — ошибка внутри drawer с «Повторить», реестр живой', async ({ page }) => {
  await start(page, 'fx-docs', 'slow=0&fail=detail')
  await openBtn(page, 1).click()
  const alert = dialogs(page).first().getByRole('alert')
  await expect(alert).toContainText('Регулятор ?fail=detail')
  await expect(alert.getByRole('button', { name: 'Повторить' })).toBeVisible()
  await expect(dialogs(page).first()).toHaveAttribute('aria-label', /№ \d+/)
  await expect(page.locator('tbody[data-key]').first()).toBeVisible()
})

test('уход с экрана закрывает деталку; при возврате она не всплывает', async ({ page }) => {
  await start(page, 'fx-docs')
  await openBtn(page, 1).click()
  await ready(page)
  await page.getByRole('link', { name: 'Рублёвые документы' }).click()
  await page.locator('tbody[data-key]').first().waitFor()
  await expect(dialogs(page)).toHaveCount(AUTO_OPEN ? 1 : 0)
  while (await dialogs(page).count() > 0) await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Валютные документы' }).click()
  await page.locator('tbody[data-key]').first().waitFor()
  await expect(dialogs(page)).toHaveCount(AUTO_OPEN ? 1 : 0)
})

test('враждебный хост (?hostile): ширина drawer и строка поля те же', async ({ page }) => {
  await start(page, 'fx-docs', 'hostile&slow=0')
  await page.waitForFunction(() => getComputedStyle(document.body).fontFamily.includes('Georgia'))
  await openWith(page, 'MT103')
  const dw = dialogs(page).first()
  const width = (await dw.boundingBox())!.width
  const row = (await dw.locator('[data-field]:not([data-empty]) > button').first().locator('..').boundingBox())!.height
  test.info().annotations.push({ type: 'geometry', description: `hostile: width=${width} row=${row}` })
  expect(Math.abs(width - REF.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(row - REF.field)).toBeLessThanOrEqual(TOL)
})
```

  Run (передний план, дождаться): `pnpm --filter pi e2e`
  Expected: PASS — прежние 26 + 11 новых = 37. Геометрию из аннотаций (`--reporter=list` показывает их в отчёте, либо `playwright show-report`) записать в леджер: они идут в `detail-drift.md` (Task 12). Скриншоты `detail-fx-docs.png`, `detail-rub-docs.png` положить рядом со скриншотами эталона Task 1 и сравнить глазами; расхождения вида — пункты класса D в `detail-drift.md` (Task 12).
- [ ] **Step 6: проверка в браузере — делает контроллер.** `pnpm --filter pi dev` (5185): `#/fx-docs` — клик по кнопке открытия → A через ~0,2 с; двойной клик по другой записи → B слева, A на месте; Esc — B, потом A; `?fail=detail` — alert в drawer; `#/rub-docs` — стороны, секции, ED107; тёмная тема — контраст меток A/B и статусов; консоль без ошибок. Исполнитель этот шаг пропускает (правило контроллера из плана `apps/pi`, R14).
- [ ] **Step 7: commit.**

```bash
git add apps/pi/src/widgets/doc-registry/ui/DocRegistry.tsx apps/pi/src/widgets/doc-registry/ui/DocRegistry.test.tsx apps/pi/src/pages/fx-docs/model/registry.model.ts apps/pi/src/pages/fx-docs/model/registry.model.test.ts apps/pi/src/pages/fx-docs/ui/FxDocsPage.tsx apps/pi/src/pages/rub-docs/model/registry.model.ts apps/pi/src/pages/rub-docs/model/registry.model.test.ts apps/pi/src/pages/rub-docs/ui/RubDocsPage.tsx apps/pi/e2e/detail.spec.ts
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "apps/pi: деталка открывается из обоих реестров — A/B, метка открытых, возврат фокуса; e2e против замера эталона"
```

---
### Task 12: Документы — `pi-api`, `pi-usage`, `detail-drift`, STATE, CHANGELOG, спеки

**Files:**
- Modify: `docs/reference/pi-api.md`, `docs/guides/pi-usage.md`, `docs/reference/detail-drift.md`, `apps/pi/README.md`, `docs/STATE.md`, `CHANGELOG.md`, `docs/superpowers/specs/2026-09-23-katran-design.md` (§3, §10, §11), `docs/superpowers/specs/2026-09-28-katran-pi-app-design.md` (§4, §7, §9), `docs/superpowers/specs/2026-09-29-katran-detail-view-design.md` (статус, §3.1 — уточнённые имена)

**Interfaces:**
- Consumes: `FX_DETAIL_EXAMPLE`, `RUB_DETAIL_EXAMPLE` (Task 8, 9) — примеры в `pi-api.md` дословно из них; числа e2e Task 11 (аннотации `geometry`) — в `detail-drift.md`; ответы В-Д1…В-Д4 (Task 1).

- [ ] **Step 1: `docs/reference/pi-api.md`.**
  1. В §1 «Эндпоинты» — строка `GET /grids/{gridId}/documents/{id}` с пометкой **предложение** (как `/facets`): «документ целиком для деталки; `id` — `id` строки `content[]`, кодируется в пути; 200 — объект документа; 404 — Problem Details «Документ не найден»; ошибки транспорта — как у search».
  2. Новый раздел **«7. Деталь документа (предложение)»**: семантика (деталь = строка реестра + поля деталки; номер, сумма, статус обязаны совпадать со строкой); таблица «поле · тип · обязательно · пример» для `fx-docs` по `FxDocDetail` (`numDate`, `valueDates[4]`, `fields{тег → {opt?, acc?, lines[]}}` с правилом «тег `B.…` — последовательность B MT202COV», `inSender`/`inReceiver` (null — нет входящего), `accDt`, `accKt`, `routeDesc`, `routeText`, `txId`, `txAt`, `txs[]` — `{dir: DEBIT|CREDIT, st: EXECUTED|PENDING|CANCELED, acc, reg, time|null, amount, currency}`, `tabsOff[]` — ключи вкладок без данных) и для `rub-docs` по `RubDocDetail` (`numDate`, `opCode`, `opName`, `scenario`, `sysFrom`, `sysTo`, `party.s|r` — 11 реквизитов, пустой — `''`, `purposeExtra`, `agents[]`, `budget`, `ed107{relId, initId, relDate, execDate, v{узел/реквизит → значение}}`, `collect`, `txAt`, `txs[]`, `tabsOff[]`); ключи вкладок `tabsOff` — таблицей по `FX_TABS`/`RUB_TABS`. Примеры ответа — JSON из `FX_DETAIL_EXAMPLE` и `RUB_DETAIL_EXAMPLE` дословно (с пометкой «проверяется тестом `detail.mapper.test.ts`»), пример 404.
  3. В §6 «Что не проверяет фейковый сервер» — «деталь строится из строки реестра формулами по номеру строки; метод запроса не проверяется».
- [ ] **Step 2: `docs/guides/pi-usage.md`.** Новый раздел **«13. Деталка документа»** перед «Зависимости»:
  1. Состав: `widgets/doc-detail` (`createDetail` — стек A/B кита + загрузка по слоту и кэш по `id`; `DocDetail` — `DrawerStack` кита, шапка, лейн, вкладки, «Общие данные» по `ConfigForm`), домен — объект `DetailDomain` сущности (`fxDocDetailDomain`, `rubDocDetailDomain`), проводки — `entities/posting`, типы — `shared/lib/detail`.
  2. Сборка на странице — код из Task 11 (модель: `createDetail({ detailFx, lifecycle })` + `sample({ clock: registry.openRequested, target: detail.open })`; экран: `DocRegistry marked` + `DocDetail rowOf returnFocus={(id) => gridFocusTarget(title, id)}`).
  3. Бек отдаёт деталь иначе — правится только `entities/*/api/detail.mapper.ts`; новый тип MT — профиль в `FX_PROFILES` и поля в `FX_FIELDS` (`entities/fx-doc/model/swift.ts`); рублёвые секции — `RSECTIONS`-константы `entities/rub-doc/model/profiles.ts`.
  4. Жизненный цикл: `pageClosed` закрывает деталку и чистит кэш — адаптер роутера (§5) делать ничего дополнительно не должен.
  5. Жесты: клик — через 220 мс (`DataGrid`), двойной — рядом, Shift — рядом сразу, Esc — сначала B.
  6. В чек-лист §10 — «деталка открывается, `GET …/documents/{id}` своего бека проходит контрактный тест (`contract.test.ts`, блоки «контракт детали»)».
- [ ] **Step 3: `apps/pi/README.md`** — регулятор `?fail=detail`, раздел «Деталка» одной строкой со ссылкой на `pi-usage.md` §13.
- [ ] **Step 4: `docs/reference/detail-drift.md`.** Колонку «katran» перевести из «план 2a» в факт: для каждого пункта — «сделано в Task N (коммит)» или класс D с описанием; раздел «Замер эталона» дополнить колонкой «кит (e2e Task 11)» с числами из аннотаций; расхождения вида по скриншотам Task 11 Step 5 — новые строки класса D с предложением; раздел «Вопросы владельцу» — ответы В-Д1…В-Д4 с датой.
- [ ] **Step 5: STATE, CHANGELOG, спеки.**
  - `docs/STATE.md`: §1 — деталка на просмотр в `apps/pi` (срез 2a); §5 карта — `widgets/doc-detail`, `entities/posting`, `shared/lib/detail`, `packages/ui/src/{drawer,form}`, `docs/reference/detail-drift.md`; §6 — состояние (число тестов по `pnpm test`, e2e 37); §7 — техдолг: действия лейна — заглушки до 2d, вкладки кроме «Общих» — 2b, правка — 2c, страницы демо для `Drawer`/`ConfigForm`/`Disclosure` (демо — витрина компонентов, спека 2a их не требовала); §9 — следующий шаг: срез 2b (остальные вкладки), его спека-дельта и сверка против того же хеша стенда; §10 — ссылка на `detail-drift.md` с итогом сверки.
  - `CHANGELOG.md`: «- Срез 2a (`apps/pi`): деталка «Платёжная инструкция» на просмотр из обоих реестров — drawer A и B рядом для сравнения, шапка, лейн действий-заглушек, вкладки с переполнением, «Общие данные» валюты (MT103/MT202/MT202COV/MT199) и рубля (PAYDOCRU/REQDOCRU/PAYORDRU); порт `detailFx` (`GET /grids/{gridId}/documents/{id}` — предложение в контракт), фейк детали и `?fail=detail`; виджет `doc-detail`, сущность `posting`.»
  - Основная спека: §3 — в перечне компонентов `@katran/ui` — `Drawer`, `DrawerStack`, `FieldRow`, `ConfigForm`, `Disclosure`, `Tabs` с `overflow`/`variant`; в `@katran/effector` — `createDrawerStackModel`; §10 — деталка живёт в `apps/pi` (виджет `doc-detail`), демо — витрина компонентов; §11 — строка «2a — деталка на просмотр» со ссылкой на спеку 2a и этот план (статус «исполнен»).
  - Спека `apps/pi`: §4 — раскладка дополнена `widgets/doc-detail`, `entities/posting` (соседи через `@x/fx-doc.ts`, `@x/rub-doc.ts`), `shared/lib/detail`; §7 — шов `openRequested` подключён к деталке в модели страницы; §9 — `pi-usage.md` §13 и `pi-api.md` §7.
  - Спека 2a: в шапке статус «исполнено планом `docs/superpowers/plans/2026-09-29-katran-detail-view.md`»; в §3.1 после блока типов `ConfigForm` — абзац «Уточнено по профилям стенда (план 2a, Task 5): `FieldDef.label`, `FieldDef.show`, `FieldValue.acc`, `FormSchema.fieldsTitle`/`fieldsHint`/`seqB`/`sectionsTitle`, сводка — ключами `hero` с `renderHero`, вид значения — `present` приложения; высота строки SWIFT-поля — 27 (замер Task 1), 23 — строка таблицы сторон рубля».
- [ ] **Step 6: проверка `pi-usage.md` «с нуля» — делает контроллер.** Свежий субагент получает только `docs/guides/pi-usage.md` и репозиторий и отвечает: как подключить деталку к своему реестру, что правится, если бек отдаёт деталь иначе, как проверить. Неясности — фикс-раундом этой задачи. Исполнитель субагентов не запускает (правило контроллера плана `apps/pi`, R18).
- [ ] **Step 7: проверка и commit.** `pnpm check` — зелёный.

```bash
git add docs/reference/pi-api.md docs/guides/pi-usage.md docs/reference/detail-drift.md apps/pi/README.md docs/STATE.md CHANGELOG.md docs/superpowers/specs/2026-09-23-katran-design.md docs/superpowers/specs/2026-09-28-katran-pi-app-design.md docs/superpowers/specs/2026-09-29-katran-detail-view-design.md
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "Документы среза 2a: деталь в pi-api (предложение), деталка в pi-usage, итог сверки, состояние и спеки"
```

---

## Порядок и зависимости

Task 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12.

- **Стоп-точки по вопросам B (Task 1):** перед Task 8 — ответ В-Д1; перед Task 9 — В-Д2, В-Д3; перед Task 11 Step 3 — В-Д4. Кит (2–6), шов данных (7) и виджет (10) решений не ждут; пока владелец отвечает, можно идти дальше по киту.
- Task 3 зависит от Task 2 только порядком (в `DrawerStack` модели нет); Task 4 и 5 независимы от 2–3, но идут по порядку спеки §7 (общий `tokens.src.ts` — меньше конфликтов).
- Task 6 правит тест `apps/pi` (`DocRegistry.test.tsx`) — `pnpm check` после неё гоняет и `apps/pi`.
- Task 7 → 8 → 9: `createGridPorts` с `parseDetail`, `strArr`, `shared/lib/detail` нужны сущностям; `entities/posting` создаёт Task 8, `@x/rub-doc.ts` — Task 9.
- Task 10 зависит от 2 (стек), 3–5 (компоненты), 7 (типы домена); `app/details.a11y.test.tsx` — от 8 и 9.
- Task 11 — от 6 (`marked`, `gridFocusTarget`, `data-k-open`), 8–10; e2e — от чисел Task 1.
- Task 12 — после всех: примеры `pi-api` из Task 8–9, числа e2e из Task 11, ответы В-Д из Task 1.

## Сквозные имена (самопроверка плана)

| Имя | Вводит | Потребляют |
|---|---|---|
| `createDrawerStackModel`, `DrawerSlot`, `DrawerEntry`, `DrawerStackState`, `DrawerStackModel` (`opened`, `alreadyOpen`, `closeAll`) | Task 2 | Task 10 |
| `Drawer` (`label`, `title`, `meta`, `onClose`, `returnFocus`, `focusKey`, `badge`), `DrawerStack` (`items`, `onEscape`), `DrawerStackItem`, `data-k-drawer`, `data-part="head"` | Task 3 | Task 10, 11 |
| токены `drawer`, `drawer-shift`, `fs-h2`, `dw-pad`, `lane`, `t-drawer` | Task 3 | Task 3, 10 |
| `Tabs` `overflow`/`variant`, `TabItem.hint`, `fitTabs`, «Ещё вкладки: N», меню «Вкладки»; токены `tab-line`, `tab-px` | Task 4 | Task 10, 11 |
| `FieldDef`, `FieldRef`, `FieldValue`, `FormPart`, `FormSchema`, `FormSection`, `HeroCell`, `SectionContent`, `FieldView`, `FieldPresenter`, `defaultPresent`, `isEmptyValue`, `FieldRow`, `ConfigForm`, `Disclosure`; `data-field`, `data-empty`, `data-part="hero"`; токены `field-*`, `fs-pre`, `lh-pre`, `fs-hero`, `fs-sum`, `party-row`, `dt-*` | Task 5 | Task 7–11 |
| `DataGridProps.marked`, `GridRecordProps.mark`, `data-mark`, `data-k-open`, `gridFocusTarget`, токен `t-open-delay` | Task 6 | Task 11 |
| `createGridPorts(… parseDetail)`, `DetailParser`, `DetailPort`, `GridPortsConfig`, `strArr`; `FakeGrid.detail`, `FakeGridOptions<Row>.detail`, `?fail=detail` | Task 7 | Task 8, 9, 11 |
| `DetailTab`, `ActionIcon`, `DetailAction`, `DetailSummary`, `DetailDomain` (`shared/lib/detail`) | Task 7 | Task 8–10 |
| `Tx`, `parseTx`, `parseTxs`, `TxBlock` (`entities/posting`, `@x/fx-doc.ts`, `@x/rub-doc.ts`) | Task 8 (`@x/rub-doc.ts` — Task 9) | Task 8, 9 |
| `FxDocDetail`, `SwiftValue`, `FX_*`, `fxSchemaOf`, `swiftPresent`, `parseFxDocDetail`, `FX_DETAIL_EXAMPLE`, `fxDocDetailDomain`, `makeFxDocDetail` | Task 8 | Task 10–12 |
| `RubDocDetail`, `RFIELDS`, `RUB_*`, `ED107_GROUPS`, `rubSchemaOf`, `parseRubDocDetail`, `RUB_DETAIL_EXAMPLE`, `rubDocDetailDomain`, `makeRubDocDetail`, `tr[data-part="party-row"]` | Task 9 | Task 10–12 |
| `createDetail`, `Detail` (`$slots`, `$marks`, `$focus`, `retry`), `DetailSlot`, `DocDetail` (`domain`, `rowOf`, `returnFocus`), `data-part="lane"`, `"tabs"`, `"skeleton"` | Task 10 | Task 11 |
| модели страниц `detail`, `DocRegistryProps.marked` | Task 11 | Task 12 (документы) |

## Покрытие спеки

| Спека 2a | Задачи |
|---|---|
| §1.1 открытие A / двойной клик и Shift — B, Esc — верхний, реестр рабочий | 2, 3, 6, 10, 11 |
| §1.1 шапка (заголовок, uuid линк-кнопкой, дата, «×») | 3, 10 (`meta` — `LinkValue`) |
| §1.1 лейн (тег, статус, «название · направление», ACTIONS/ACTIONS_RUB, «Аннулировать» за разделителем, меню печати, заглушки с `announce`) | 8, 9 (данные), 10 (лейн) |
| §1.1 вкладки: фиксированный порядок, наборы валюты и рубля, неактивные второй группой, «••• N», остальные — «будет в 2b» | 4, 8, 9, 10 |
| §1.1 «Общие» валюты (hero, сообщения, маршрут, транзакции, пары 50–54 \| 55–59, текст, extra, `seqB`) и рубля (hero, стороны, пять секций, транзакции) | 5, 8, 9 |
| §1.1 порт детали и фейк, данные вымышленные | 7, 8, 9 |
| §2 заморозка целиком, замер, `detail-drift.md`, B владельцу, известные C | 1, 12 |
| §3.1 `Drawer` (800, не модальный, имя, фокус туда и обратно, Esc кроме полей/меню/поповеров, токены, reduced motion, без `inert`/`:has`/`showModal`) | 3 |
| §3.1 `DrawerStack` | 3 |
| §3.1 `Tabs` `overflow` | 4 |
| §3.1 `FieldRow` (тег, опция, значение, пустое «не заполнено», многострочные по `lines`) | 5 |
| §3.1 `ConfigForm` (схема, реестр полей, слоты) | 5 |
| §3.1 `Disclosure` | 5 |
| §3.1 `DataGrid` — разведение жестов, `marked` | 6 |
| §3.2 `createDrawerStackModel` — все правила | 2 |
| §4.1 `createGridPorts({ parseDetail })`, `detailFx`, гард `obj`, ошибки; эндпоинт — предложение в `pi-api.md` | 7, 12 |
| §4.2 сущности: деталь, профили, реестр полей, `schemaOf`, вкладки и действия, мапперы, порты, блоки | 8, 9 |
| §4.3 `createDetail` (`$slots`, `retry`, кэш, `pageClosed`), `DocDetail` (скелетон ≥ 400 мс, alert с «Повторить», шапка из строки, домен пропсами, без импорта entities) | 10 |
| §4.4 страницы (`sample`, `marked`), фейк (деталь из строки, 404, `?fail=detail`) | 7, 8, 9, 11 |
| §5 поведение (открытие, повторное открытие — фокус, метка, закрытие и возврат фокуса, жизненный цикл, ошибки, геометрия, a11y) | 3, 6, 10, 11 |
| §6 проверки: кит (модель, Drawer, Tabs, FieldRow, ConfigForm, Disclosure, DataGrid — таймеры), `apps/pi` (мапперы, порт → фейк 200/404/500, `createDetail`, axe на реальных профилях), e2e (геометрия ± 2, A+B, двойной клик, Esc, `?hostile`, скриншоты), совместимость (`check:target`, React 17) | 2–11 (`pnpm check` в каждой) |
| §7 порядок 0–12 | весь план |
| §8 открытые вопросы (эндпоинт бека, вкладки рубля, пути ED107) | 1 (В-Д2, В-Д3), 9, 12 |
