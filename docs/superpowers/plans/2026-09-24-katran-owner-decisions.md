# План 2.1: решения владельца от 24.09.2026

**Цель.** Исполнить три решения владельца после плана 2: (1B) запись 68 px как на стенде, белый фон грида и подсветка всей записи по наведению; (3C) буква в `StatusDot` на светлых тонах тёмным цветом; демо «Реестр» показывает и объясняет сквозные строки с примером кода. (2A — репо публичный и Pages — сделано вне кода.)

**Спека:** `docs/superpowers/specs/2026-09-23-katran-design.md` — §4.2, 6.1, 6.3, 9, 12. Спека — binding authority; каждая задача правит её в своей части, чтобы после слияния она совпадала с кодом.

**Global Constraints (дословно из планов 1–2):**
- CSS только токенами `var(--k-…)`: голые `px` лишь в `border*`/`outline*`/`box-shadow`/`letter-spacing`; никаких hex/rgba; локальные имена CSS Modules camelCase.
- Никаких `eslint-disable`/`stylelint-disable`.
- Новые размеры и цвета — только через `tokens.src.ts` + `pnpm gen`, регенерация (`tokens.css`, `tokens.ts`) коммитится; `gen:check` в CI.
- Контраст палитры проверяется правилами `packages/tokens/src/contrast.rules.ts`; новая пара «цвет на цвете» в CSS = новое правило.
- Интерактив — настоящие `<button>`/`<input>` с именем; `jsx-a11y` в линте, `axe` в тестах. Тесты через `renderK` ищут по ролям/атрибутам.
- Русский язык интерфейса, комментариев и коммитов. Коммиты без трейлеров `Co-Authored-By` и подписей «Generated with».
- Playwright (`pnpm --filter demo e2e`) вне `pnpm check`; перед коммитом `pnpm check` зелёный.
- Замеры 24.09.2026 (Chromium 1600×1000, плотность 1): стенд `pi-constructor` — запись 68 (строки 45 + 23), шапка 48; katran — запись 72 (42 + 30), шапка 49.

---

### Task 1: Запись 68 px, фон грида `paper`, подсветка всей записи

**Files:** `packages/tokens/src/tokens.src.ts` (+ регенерация `tokens.css`, `tokens.ts`), `packages/ui/src/grid/Grid.module.css`, `apps/demo/e2e/geometry.spec.ts`, спека §6.1/§6.3/§12, `docs/STATE.md` §6–7, `CHANGELOG.md`.

- [ ] **Step 1: токен.** В `sizes` добавить `'grid-pad': 6` с комментарием «вертикальный отступ записи грида: 6 + 2×17 + 4 + 17 + 6 + 1 = 68, как на стенде». `pnpm gen`, регенерацию закоммитить.
- [ ] **Step 2: CSS записи.** В `Grid.module.css`: `.record > tr:first-child > td { padding-top: var(--k-grid-pad) }`, `.record > tr:last-child > td { padding-bottom: var(--k-grid-pad) }` (вместо `sp-2`); межстрочный `sp-1` и горизонтальные `sp-2` не трогать; шапку не трогать.
- [ ] **Step 3: фон и подсветка.** `.root { background: var(--k-paper) }` — грид сам белый, где бы ни лежал (сейчас сквозь него просвечивает `ground` оболочки демо). Подсветка по наведению — на всю запись: `.record:hover > tr > td { background: var(--k-hover) }` вместо `.record > tr:hover > td`; для `.selected` — аналогично (`.selected:hover > tr > td`), цвет `val-soft` сохраняется. Проверить, что `.stateRow`/скелетон не получили лишнего фона.
- [ ] **Step 4: e2e.** Коридор записи в `geometry.spec.ts` → 64–72 (остальные коридоры без изменений). `pnpm --filter demo e2e` → 3/3, числа в отчёт (ожидание: запись 68, шапка 49, скелетон 68, 125 % → 85).
- [ ] **Step 5: документы.** Спека §6.1: высота 68 = 6 + 2×17 + 4 + 17 + 6 + 1 (отступ `grid-pad`), «эталон стенда 68 px по замеру 24.09.2026 — совпадает»; убрать абзац про нерешённое расхождение. §6.3: фон грида `paper`, подсветка по наведению — вся запись (`tbody`), записи без собственного фона (как на стенде). §12: удалить строку про эталон высоты. `docs/STATE.md`: §6 числа e2e (68/49/68/85), §7 убрать пункт про hover на `tr`. `CHANGELOG.md`: строка.
- [ ] **Step 6: Commit** — `Грид: запись 68 px как на стенде, фон paper, подсветка всей записи по наведению`.

### Task 2: Буква `StatusDot` на светлых тонах — тёмная (решение 3C)

**Files:** `packages/tokens/src/tokens.src.ts` (+ регенерация), `packages/tokens/src/contrast.rules.ts`, `packages/ui/src/value/Value.module.css`, `packages/ui/src/value/StatusDot.tsx`, `packages/ui/src/value/Value.test.tsx`, `apps/demo/src/pages/ValuesPage.tsx`, спека §9 (абзац «Палитра») и §12, `CHANGELOG.md`.

- [ ] **Step 1: токен цвета.** В `colorsLight` и `colorsDark` добавить `'st-letter-soft'`: light `#141A29` (= `ink`), dark `#161B26` (= `paper`) — комментарий: «буква в статусной точке на светлых тонах flowl/okl/grey: в светлой теме тёмная, в тёмной — белая». `pnpm gen`.
- [ ] **Step 2: правило контраста.** В `contrast.rules.ts`: `{ fg: 'st-letter-soft', bg: ['st-flowl', 'st-okl', 'st-grey'], min: 4.5, note: 'буква в статусной точке на светлых тонах' }`. Ожидаемые значения: light 5.73/5.36/5.63, dark 9.60/10.62/7.90. Существующее правило `paper` на шести насыщенных тонах остаётся. Тесты tokens зелёные.
- [ ] **Step 3: CSS и компонент.** `Value.module.css`: `.dot[data-tone="flowl"], .dot[data-tone="okl"], .dot[data-tone="grey"] { color: var(--k-st-letter-soft) }`. `StatusDot.tsx`: JSDoc `letter` — «допустима на всех тонах; на flowl/okl/grey цвет `st-letter-soft` (контраст ≥ 4.5 в обеих темах)».
- [ ] **Step 4: тест.** В `Value.test.tsx`: буква выводится на светлом тоне (`tone="okl" letter="З"` → текст «З» в элементе с `data-tone="okl"`); axe на наборе всех девяти тонов с буквами.
- [ ] **Step 5: демо.** `ValuesPage.tsx`: ряд из девяти точек с буквами на всех тонах (например `{flow:'О', flowl:'К', flowd:'П', bad:'О', badd:'Н', warn:'В', ok:'И', okl:'Э', grey:'О'}` — по статусам демо: обработка, к экспорту, процессинг, ошибка, невалидна, внимание, исполнен, экспортирован, отклонён), подпись «буква читаема на всех тонах».
- [ ] **Step 6: документы.** Спека §9 «Палитра»: `paper` на `flow/flowd/bad/badd/warn/ok` ≥ 4.5, `st-letter-soft` на `flowl/okl/grey` ≥ 4.5 — буква применяется на всех тонах; §12: удалить строку про букву. `CHANGELOG.md`: строка.
- [ ] **Step 7: Commit** — `StatusDot: буква на светлых тонах тёмным цветом — контраст не ниже 4.5 в обеих темах`.

### Task 3: Демо «Реестр» — сквозные строки наглядно и с кодом

**Files:** `apps/demo/src/pages/GridPage.tsx`, `apps/demo/src/pages/Page.module.css`, `CHANGELOG.md`.

- [ ] **Step 1: раздел.** Над гридом (в `.gridHead` рядом с заголовком/примечанием) — `<details>` с `<summary>` «Сквозные строки записи: как это управляется». Внутри: 3–4 предложения (запись = `tbody` из строки колонок и сквозных строк; сегмент задаётся `from`/`to` по `id` колонок и `render`; скрытые колонки сжимают сегмент, `resolveSpans` пересчитывает `colSpan`; `null` из `render` — бледная подложка; `lines` задаёт кламп) и `<pre className={s.code}>` с фрагментом **ровно из этого файла** — блок `spans:` из `docsLayout` (константа-строка `SPANS_SNIPPET` рядом с `docsLayout`, с комментарием «держать в синхроне с docsLayout.spans»). Ссылка на спеку §6.1–6.3 текстом.
- [ ] **Step 2: подсветка.** Чекбокс (настоящий `<input type="checkbox">` с `<label>`) «Подсветить сквозные сегменты» в том же `<details>`; включён → на `.gridPage` класс `hlSpans`; в `Page.module.css`: `.hlSpans [role="gridcell"][colspan] > div { outline: 1px dashed var(--k-val); outline-offset: -1px }` и для пустых `[data-empty="true"] > div` — `outline-style: dotted`. Демо адресует ячейки грида через ARIA/data-атрибуты, не через классы `k-Grid__*`.
- [ ] **Step 3: раскладка.** `.gridPage` — flex-колонка с высотой от вьюпорта; раскрытый `<details>` уменьшает область грида, грид остаётся прокручиваемым (`min-height: 0` уже есть). `.code` — `font: var(--k-fs-2)/var(--k-lh-2) var(--k-mono)`, фон `sunk`, отступ `sp-2`, `overflow: auto`, `max-height` через токен (`menu-max-h` подойдёт).
- [ ] **Step 4: проверка.** `pnpm check` зелёный; `pnpm --filter demo e2e` 3/3 (в `<details>` по умолчанию свёрнуто — геометрия не меняется). Скриншот раскрытого блока с включённой подсветкой снять Playwright-скриптом в отчёт (папка отчётов, не репо).
- [ ] **Step 5: Commit** — `Демо: сквозные строки записи — пояснение, фрагмент раскладки и подсветка сегментов`.
