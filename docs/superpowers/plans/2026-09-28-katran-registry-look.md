# План 5b «Реестр по эталону: вид» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** экран «Валютные документы» в демо и компоненты кита выглядят как эталон `pi-constructor` (`887b37f`): типографика, колонки и ячейки SWIFT-полей, глиф статуса, лейн, строка фильтров, подвал, скелетон.

**Architecture:** вид — токены (`packages/tokens/src/tokens.src.ts` + `pnpm gen`) и CSS-модули компонентов `@katran/ui`; новые компоненты и функции — `SwiftField` (`ui/value`), `conditionParts` (`ui/filters/opLabels.ts`); раскладка и данные экрана — `apps/demo/src/pages/GridPage.tsx`, `apps/demo/src/data/docs.ts`. Механизмы плана 5a (fullHeight, split, сортировка уровнями, состояния записи) не меняются.

**Tech Stack:** pnpm-монорепо, React 17.0.2 (CI-задача `react19`), effector 23.4, Vitest + Testing Library + jest-axe, Playwright, eslint + stylelint, Chromium 88 (`check:target`).

**Spec:** `docs/superpowers/specs/2026-09-28-katran-registry-look-design.md` (5b). Сверка и эталон: `docs/reference/registry-drift.md` (Г1–Г5, таблицы R/T/L/P/W/Z), стенд `/Users/shaman/_CODE/VTB/pi-constructor`, файл `grid.tpl.html` на коммите `887b37f` (`git -C /Users/shaman/_CODE/VTB/pi-constructor show 887b37f:grid.tpl.html`).

## Global Constraints

- Совместимость: React 17–19 (без API React 18+ в пакетах кита), Chromium 88 (без `.at`, `Object.hasOwn`, `findLast`, `toSorted`, `structuredClone`, `:has`, `inert`); `pnpm check` включает `check:target`.
- CSS компонентов: только `var(--k-*)`, без голых `px` (кроме `border*`/`outline*`/`box-shadow`/`letter-spacing`), без hex/rgba; новые размеры и цвета — только `tokens.src.ts` + `pnpm gen`, регенерация коммитится; классы других компонентов не адресуются.
- Контраст новых пар «текст / фон» — правилом в `packages/tokens/src/contrast.rules.ts` (порог текста 4.5).
- Опциональные поля публичных типов — `?: T | undefined`. Никаких `eslint-disable`/`stylelint-disable`.
- Интерактив — настоящие `<button>`/`<input>`/`<select>` с доступным именем; внутри ячеек — `tabIndex={-1}`; axe без нарушений.
- Данные демо — вымышленные; новые вызовы ГПСЧ — в конце объекта записи (прежние значения не сдвигаются).
- Русский язык интерфейса, комментариев, коммитов; коммиты без `Co-Authored-By` и «Generated with»; автор `Ivan Klimenko <ivan.klimenko@gmail.com>`; файлы — поимённо.
- e2e демо (`pnpm --filter demo e2e`): запись 64–72 (цель 68), шапка 40–56, скелетон = запись ± 2, 125 % = ×1.25 ± 2.
- `pnpm check` зелёный после каждой задачи.

---

### Task 1: Токены, вертикаль записи, кегли и тоны значений, шапка

**Files:**
- Modify: `packages/tokens/src/tokens.src.ts` (+ `pnpm gen`: `tokens.css`, `tokens.ts`), `packages/tokens/src/contrast.rules.ts`
- Modify: `packages/ui/src/value/CopyValue.tsx`, `packages/ui/src/value/Tag.tsx`, `packages/ui/src/value/Value.module.css`
- Modify: `packages/ui/src/grid/Grid.module.css` (шапка, вертикаль записи)
- Test: `packages/ui/src/value/Value.test.tsx`, `packages/ui/src/grid/DataGrid.test.tsx`, `packages/tokens/src/*.test.ts`

**Interfaces:**
- Produces: токены `grid-pad` 8, `grid-gap` 3, `dot-l` 16; `CopyValueProps.size?: 's' | undefined`, `tone` + `'muted'`; `TagProps.tone`: `'neutral' | 'opt' | 'mt' | 'warn' | 'ok'`.

- [ ] **Step 1: тесты (падают).** `Value.test.tsx`:

```tsx
  it('CopyValue size="s" и tone="muted" — классы второго кегля и приглушённого тона', () => {
    renderK(<CopyValue value="x" size="s" tone="muted" />)
    const btn = screen.getByRole('button', { name: /x/ })
    expect(btn.className).toMatch(/small/)
    expect(btn.className).toMatch(/muted/)
  })
  it('Tag тоны mt/warn/ok — data-tone', () => {
    renderK(<><Tag tone="mt">MT103</Tag><Tag tone="warn">ЕРС</Tag><Tag tone="ok">VTO</Tag></>)
    expect(screen.getByText('MT103')).toHaveAttribute('data-tone', 'mt')
    expect(screen.getByText('ЕРС')).toHaveAttribute('data-tone', 'warn')
    expect(screen.getByText('VTO')).toHaveAttribute('data-tone', 'ok')
  })
```

(имя класса под `vitest` — `non-scoped`, т. е. локальное имя; подобрать фактические имена классов, которые вы введёте: `small`, `muted`.) В тесте токенов — наличие `grid-gap`, `dot-l`, значение `grid-pad` = 8 (по образцу существующих тестов `tokens`).
- [ ] **Step 2: токены.** `sizes`: `'dot-l': 16` рядом с `dot-m`; `'grid-pad': 8` (комментарий: «вертикальный отступ записи: 8 + 2×17 + 3 + 14 + 8 + 1 = 68, как на стенде»); `'grid-gap': 3` (комментарий: «промежуток между строкой колонок и сквозной строкой, эталон»). `pnpm gen`.
- [ ] **Step 3: вертикаль записи.** `Grid.module.css`: у первой сквозной строки записи — отступ сверху `var(--k-grid-gap)` (сейчас между строками стоит `sp-1` 4 — заменить на `grid-gap`); сквозные строки — кегль `fs-2` / `lh-2` (сегменты — `.record > tr:not(:first-child) .clamp` или существующий класс сегмента — выбрать по коду). Проверить: высота записи в демо — 68 (e2e `geometry`).
- [ ] **Step 4: `CopyValue`.** `size?: 's' | undefined` → класс `small` (`font-size: var(--k-fs-2); line-height: var(--k-lh-2)`); `tone` + `'muted'` → класс `muted` (`color: var(--k-muted)`).
- [ ] **Step 5: `Tag`.** `tone?: 'neutral' | 'opt' | 'mt' | 'warn' | 'ok' | undefined`. CSS: `mt` — mono 600 `fs-2` `ink2`, рамка `1px solid var(--k-line)`, фон `paper`; `warn` — текст `warn`, фон `warn-soft`; `ok` — текст `ok`, фон `ok-soft`; кегль ролей — sans 500 `fs-3` (эталон `.tag.snd/.rcv`). Контраст: в `contrast.rules.ts` правила уже покрывают `warn`/`warn-soft` и `ok`/`ok-soft` (4.0 — подсветка); теги — читаемый текст, поэтому добавить отдельные правила `{ fg: 'warn', bg: ['warn-soft'], min: 4.5, note: 'тег роли' }` и для `ok` — если не проходят 4.5, выбрать для тегов тон текста, который проходит (например `ink2` на `warn-soft`), и записать решение в отчёт. Не понижать порог.
- [ ] **Step 6: шапка.** `Grid.module.css`: `.th` и `.thSub` — `text-transform: uppercase; letter-spacing: 0.5px` (подзаголовок — тоже); наведение на сортируемый заголовок — фон `hover` у всей ячейки `th` (сейчас — у `.thBtn`): правило на `th` с кнопкой сортировки, без адресации чужих классов (например `.th[aria-sort]:hover`). Тест `DataGrid.test.tsx`: у `columnheader` вычисленный `text-transform` = `uppercase` (jsdom видит стили модуля при `css.modules` в vitest? если нет — проверить в e2e Task 7 и указать в отчёте).
- [ ] **Step 7: запуск.** `pnpm check`; `pnpm --filter demo e2e` — `geometry` зелёный, записать высоты.
- [ ] **Step 8: commit.** `git add packages/tokens/src packages/ui/src/value packages/ui/src/grid` — «Вид: вертикаль записи 8/3/8, второй кегль и тон muted у значений, тоны тегов, шапка прописными».

---

### Task 2: `SwiftField`, счёт 8…4

**Files:**
- Create: `packages/ui/src/value/SwiftField.tsx`; Modify: `packages/ui/src/value/index.ts`, `Value.module.css`
- Modify: `packages/ui/src/format/account.ts`
- Test: `packages/ui/src/value/Value.test.tsx`, `packages/ui/src/format/account.test.ts` (создать, если нет)

**Interfaces:**
- Produces: `SwiftField(props: SwiftFieldProps)` (спека §3), `shortAccount` по умолчанию 8…4.

- [ ] **Step 1: тесты (падают).**

```tsx
describe('SwiftField', () => {
  it('опция, главное значение, подпись прописными; пусто — «—»', () => {
    const { rerender } = renderK(<SwiftField opt="A" main="VKRBRU8KXXX" caption="АО «Прибой»" />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /VKRBRU8KXXX/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /АО «Прибой»/ })).toBeInTheDocument()
    rerender(<SwiftField main="" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<SwiftField opt="F" main="40702840000000000001" caption="ООО «Ромашка»" maxWidth={130} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

`account.test.ts`: `shortAccount('40702840999377318571')` → `{ head: '40702840', ccy: '840', tail: '8571', short: true }`; `shortAccount('40702840123')` → `short: false`. Существующие ожидания `…3` в `Value.test.tsx` — на `…4`.
- [ ] **Step 2: `SwiftField`.**

```tsx
import { CopyValue } from './CopyValue'
import s from './Value.module.css'

export type SwiftFieldProps = {
  /** Буква опции (A, F, K…); нет — не показывается. */
  opt?: string | undefined
  /** Главное значение: счёт или BIC; пусто — «—». */
  main: string
  /** Подпись ниже: наименование банка или стороны, прописными. */
  caption?: string | undefined
  /** Обрезка главного значения, px при плотности 1; полное — в тултипе. */
  maxWidth?: number | undefined
  tabIndex?: number | undefined
}

/** Ячейка SWIFT-поля (эталон fld()): буква опции, главное значение mono, подпись прописными (спека 5b §3). */
export function SwiftField({ opt, main, caption, maxWidth, tabIndex }: SwiftFieldProps) {
  if (!main) return <span className={s.none}>—</span>
  return (
    <>
      <span className={s.field}>
        {opt && <span className={s.opt}>{opt}</span>}
        <CopyValue value={main} tone="ink" className={s.fieldMain} maxWidth={maxWidth} tabIndex={tabIndex} />
      </span>
      {caption && <div><CopyValue value={caption} tone="muted" className={s.caption} tabIndex={tabIndex} /></div>}
    </>
  )
}
```

CSS: `.opt` — mono 700 `fs-1` `opt`, отступ справа `sp-1`; `.fieldMain` — mono `fs-1`; `.caption` — `fs-3` / `lh-3` прописными; `.none` — `faint`. Экспорт в `index.ts`.
- [ ] **Step 3: счёт.** `account.ts`: `shortAccount(acc)` — `tail: acc.slice(-4)`, короткий при `acc.length <= 12`; JSDoc «первые 8 знаков … последние 4 (эталон 9e98754)».
- [ ] **Step 4: запуск и commit.** `pnpm check` — «Вид: ячейка SWIFT-поля SwiftField, счёт в гриде 8…4».

---

### Task 3: Демо — колонки и ячейки по эталону

**Files:**
- Modify: `apps/demo/src/data/docs.ts`, `apps/demo/src/pages/GridPage.tsx`, `apps/demo/src/pages/Page.module.css`, `apps/demo/src/data/fakeBackend.ts` (если нужно новым ключам)
- Test: `apps/demo/e2e/geometry.spec.ts`, `apps/demo/e2e/registry.spec.ts` (прогон; правка локаторов, если заголовки стали прописными)

**Interfaces:**
- Consumes: `SwiftField`, `Tag` тоны, `CopyValue size/tone`, `AccountValue`, `FieldTag`, `StatusDot size="s"`.

- [ ] **Step 1: данные.** `Doc` — поля: `f50opt: string`, `f59opt: string`, `f52name: string`, `f57name: string`, `f58: string | null`, `f58name: string | null`, `outSender: string`, `outReceiver: string`, `routeType: 'LORO' | 'NOSTRO' | 'INTERNAL'`, `routeRecv: string`, `routeAcc: string`. Генерация — в конце объекта записи (после `vdKt`, `lock`, `inactive`): опции 50/59 — `'F'`/`'K'` по эталону (`base.f['50']` в `grid.tpl.html` — посмотреть на `887b37f`), банки — наименования из того же словаря эталона (`BANKS`/`b1`/`b2` генератора стенда, обезличены), `f58` — только у `MT202`/`MT202COV` (BIC и наименование), иначе `null`; маршрут — `RT`/`ACC_PFX` эталона: счёт `ACC_PFX + код валюты + …` (20 знаков, код валюты в 6–8). S/R out — как на эталоне (`outS = b2`, `outR = b1`).
- [ ] **Step 2: раскладка** (`docsLayout`, спека §3; ширины — Г3, спека §3):
  - `status` 60 — `StatusDot` (глиф — Task 4);
  - `id` 106 — номер `CopyValue tone="ink"` с `fontWeight` 600 (класс демо `s.num`), ниже линк-кнопки;
  - `created` 121, `fullHeight`, `lines: 3` — дата `ink` + время `muted` `size="s"`, ниже «Дт …» и «Кт …» `size="s" tone="muted"`, Кт — класс `s.warn` (цвет `warn`), если `vdKt !== vdDt`; часть `valueDates` — те же строки;
  - `type` 71, `fullHeight` — `Tag tone="mt"`;
  - `direction` 127, `fullHeight` — иконка группы (svg в демо: ↓ IN, ↗ OUT; ⇄ и ◦ — текстом) + код mono 600 `fs-3`, ниже `dirTxt` `size="s" tone="muted" maxWidth={105}`;
  - `amount` 96, `fullHeight` — сумма `ink`, ниже валюта `size="s" tone="muted"`; split — как в 5a;
  - `f50` 157 — `SwiftField opt={d.f50opt} main={d.f50acc} caption={d.f50name} maxWidth={130}`, подзаголовок «приказодатель · 70», ключи + `{ id: 'purpose', label: 'Назначение (70)' }`;
  - `f52`, `f57` 137 — `SwiftField opt="A" main={BIC} caption={name}`; `f58` 137 (между 57 и 59) — то же или `SwiftField main=""`;
  - `f59` 157 — `SwiftField opt={d.f59opt} main={d.f59acc} caption={d.f59name} maxWidth={130}`, без подзаголовка;
  - `route` 110, `fullHeight`, `lines: 3` — `Tag` типа, BIC получателя `tone="ink2"` mono, `AccountValue value={d.routeAcc}`; ключи `routeType` «Тип маршрута», `routeRecv` «Receiver»;
  - `sr` 113 и `srOut` 113, `fullHeight` — «S:»/«R:» (класс демо, sans `fs-2` `faint`, ширина `sp-4`) + BIC `tone="ink"` mono;
  - `prov` 122, `fullHeight`, `lines: 2` — `Tag tone="warn"` отправителя и `Tag tone="ok"` получателя столбиком;
  - сегменты: причина — `from: 'status', to: 'id'`, `StatusDot size="s"` + текст `size="s" tone="ink2"`; назначение — `from: 'f50', to: 'f59'`, `FieldTag tag="70" title="70 · Детали платежа"` + текст `size="s" tone="ink2"` прописными с разрядкой 0.02em (класс демо);
  - `SPANS_SNIPPET` — дословно по `spans`.
- [ ] **Step 3: проверка в браузере.** Сборка демо, preview (`/Users/shaman/_CODE/VTB/.claude/launch.json`, запись `katran-demo`; файл откатывается из `.bak` — восстановить `cp .bak launch.json` при необходимости), экран «Реестр»: запись 68, строки не переносятся, тултипы у обрезанных, консоль чистая. Скриншот — в отчёт.
- [ ] **Step 4: запуск и commit.** `pnpm check`, `pnpm --filter demo e2e` (правка локаторов, если нужны) — «Демо: реестр по эталону — колонки 58, «Маршрут», «S / R out», ячейки SWIFT-полей, дата, направление, провайдеры, ширины».

---

### Task 4: Статусная точка с глифом, лейн

**Files:**
- Modify: `packages/ui/src/value/StatusDot.tsx`, `Value.module.css`; `packages/ui/src/filters/StatusLane.tsx`, `StatusLane.module.css`
- Modify: `apps/demo/src/data/docs.ts` (`STATUS_GLYPH`), `apps/demo/src/pages/GridPage.tsx`
- Test: `packages/ui/src/value/Value.test.tsx`, `packages/ui/src/filters/StatusLane.test.tsx`, `packages/tokens` (контраст)

**Interfaces:**
- Produces: `StatusDotProps.size`: `'s' | 'm' | 'l'`; `LaneItem.glyph?: string | undefined`.

- [ ] **Step 1: тесты (падают).** `StatusDot size="l" letter="✓"` — класс `dotL`, текст ✓. `StatusLane`: `items` с `glyph` — у точки кнопки текст глифа; активная кнопка — `aria-pressed="true"` и атрибут/класс активной (подчёркивание); кнопки — не `Button` (нет класса кнопки кита — проверять по роли и `aria-pressed`, а не по классу); axe.
- [ ] **Step 2: `StatusDot`** — размер `l` (`--k-dot-l`), глиф `font: 700 var(--k-fs-3) / 1 var(--k-sans)`, по центру. Правила контраста глифа уже есть (буква в точке) — проверить, что они применимы к `l`.
- [ ] **Step 3: `StatusLane`.** Своя кнопка `<button type="button" aria-pressed …>` (класс `.tab`): высота `h-ctl-l` (32), без рамки и фона, у активной — `box-shadow: inset 0 -2px 0 var(--k-val)`; полоса лейна — `min-height` 36 (токен: `h-ctl-l` + `sp-1`), `border-bottom: 1px solid var(--k-line)`, на всю ширину; точка — `StatusDot size="m" letter={it.glyph}`; счётчик — `Counter`. Фокус — `outline` `val`. «Все» — без точки.
- [ ] **Step 4: демо.** `STATUS_GLYPH: Record<Status, string>` (спека §4): DONE/EXPORTED ✓, ERROR/INVALID ✕, REJECTED ⊘, DEFERRED !, остальные ·. Запись: `StatusDot size="l" letter={STATUS_GLYPH[d.status]}`; лейн: `glyph: STATUS_GLYPH[st]`.
- [ ] **Step 5: запуск и commit.** `pnpm check`, e2e — «Вид: глиф статуса в записи и лейне, лейн вкладками-фильтрами как на эталоне».

---

### Task 5: Строка фильтров

**Files:**
- Modify: `packages/ui/src/filters/opLabels.ts`, `FilterPanel.tsx`, `Filters.module.css`, `packages/ui/src/filters/index.ts`
- Test: `packages/ui/src/filters/opLabels.test.ts` (создать или дополнить), `FilterPanel.test.tsx`

**Interfaces:**
- Produces: `conditionParts(c: Condition, meta?: FilterMeta | null): { field: string; op: string; value: string }`.

- [ ] **Step 1: тесты (падают).**

```ts
describe('conditionParts', () => {
  const meta: FilterMeta = { fields: [
    { id: 'status', label: 'Статус', type: 'ENUM', ops: [], values: [{ value: 'TO_EXPORT', label: 'К экспорту' }] },
    { id: 'amount', label: 'Сумма', type: 'NUMBER', ops: [] },
    { id: 'created', label: 'Дата документа', type: 'DATE', ops: [] },
  ] }
  it('EQ, IN, BETWEEN, IS_EMPTY — поле, оператор словами, значение', () => {
    expect(conditionParts({ field: 'status', op: 'EQ', value: 'TO_EXPORT' }, meta)).toEqual({ field: 'Статус', op: '=', value: 'К экспорту' })
    expect(conditionParts({ field: 'status', op: 'IN', values: ['TO_EXPORT', 'X'] }, meta)).toEqual({ field: 'Статус', op: 'в списке', value: 'К экспорту, X' })
    expect(conditionParts({ field: 'created', op: 'BETWEEN', from: '2026-09-01', to: '2026-09-13' }, meta)).toEqual({ field: 'Дата документа', op: 'от … до', value: '01.09.2026 – 13.09.2026' })
    expect(conditionParts({ field: 'amount', op: 'IS_EMPTY' }, meta)).toEqual({ field: 'Сумма', op: 'пусто', value: '' })
  })
})
```

`FilterPanel.test.tsx`: чип содержит три части (поле, оператор, значение) в отдельных элементах; кнопка «Фильтры» с бейджем числа условий; «Сбросить» — кнопка в строке чипов; доступное имя ✕ прежнее («Убрать условие: …» из `describeCondition`); axe.
- [ ] **Step 2: `conditionParts`** в `opLabels.ts` (рядом с `describeCondition`, использует `showValue`); экспорт в `filters/index.ts`.
- [ ] **Step 3: `FilterPanel`.** Строка `.bar` — полоса `sunk` (`min-height` 45: токен `h-ctl-l` + `sp-3`), на всю ширину, паддинг `sp-2` `sp-5`. Кнопка «Фильтры» — `variant="primary"` с иконкой воронки (svg) и `Counter` бейджем. Чип — фон `val-soft`, скругление `r-s`: `<span className={s.cf}>{field}</span> <span className={s.co}>{op}</span> <span className={s.cv}>{value}</span>` (поле `ink2`, оператор mono `fs-3` `muted`, значение 600 `ink`) + ✕ (прежний `IconButton`). «Сбросить» — кнопка вида чипа (`.chipBtn`). Строка «условия не заданы» — как было. Тело панели не менять.
- [ ] **Step 4: запуск и commit.** `pnpm check`, e2e (`registry.spec.ts` про панель) — «Вид: строка фильтров как на эталоне — полоса, основная кнопка с бейджем, чипы из частей».

---

### Task 6: Подвал и скелетон

**Files:**
- Modify: `packages/ui/src/pagination/Pagination.tsx`, `Pagination.module.css`; `packages/ui/src/grid/GridSkeleton.tsx`, `Grid.module.css`; `apps/demo/src/pages/GridPage.tsx` (`pageSizes`)
- Test: `packages/ui/src/pagination/Pagination.test.tsx`, `packages/ui/src/grid/DataGrid.test.tsx` (скелетон)

- [ ] **Step 1: тесты (падают).** `Pagination`: кнопки «Назад»/«Вперёд» — доступные имена прежние, видимый текст ‹ ›; `Select` «На странице» — последним элементом полосы (после номеров); многоточие — прежняя `pageWindow` (тест на 1 … 4 5 6 … 20 уже есть — оставить); axe. Скелетон: служебная ячейка каждой строки скелетона содержит номер `(page − 1) × pageSize + i + 1` — `GridSkeleton` получает `firstOrd: number`; у колонки `align: 'right'` обёртка плашки с атрибутом `data-align="right"`.
- [ ] **Step 2: `Pagination`.** Полоса: `min-height` 37 (`h-ctl-s` + `sp-3` − 1 → ближайшая сумма токенов; допуск ± 2), фон `sunk`, `border-top` `line`, `fs-2` `muted`; порядок: диапазон — номера (центр) — «На странице» `Select` (справа, подпись «На странице» видимым текстом + `aria-label`); кнопки номеров — компактные 22 (`h-field` 23 − 1 → использовать `h-field`), текущая — фон `val`, текст `paper` (правило контраста `paper`/`val` уже есть); ‹ › — `IconButton`-подобные с `aria-label` «Назад» / «Вперёд».
- [ ] **Step 3: скелетон.** `GridSkeleton` — проп `firstOrd`; в служебной ячейке — номер (класс `s.ord`, как у записи); плашка колонки `align: 'right'` — `justify-content: flex-end` через `data-align`. `DataGrid` передаёт `firstOrd={(page - 1) * pageSize + 1}`.
- [ ] **Step 4: демо.** `pageSizes={[10, 20, 50, 100]}`.
- [ ] **Step 5: запуск и commit.** `pnpm check`, e2e — «Вид: подвал с компактной пагинацией как на эталоне, номера в скелетоне».

---

### Task 7: e2e и сверка с эталоном

**Files:**
- Modify: `apps/demo/e2e/geometry.spec.ts`, `apps/demo/e2e/isolation.spec.ts`
- Create: `docs/reference/img/registry-kit-records-5b.png`, `registry-kit-lane-filters-5b.png`, `registry-kit-footer-5b.png` (+ стенд `registry-stand-footer.png`, если нет)

- [ ] **Step 1: замеры.** `geometry.spec.ts` — новый тест: высоты лейна (`role=group[name=Статусы]`), строки фильтров (полоса с кнопкой «Фильтры»), подвала (`nav[aria-label=Страницы]`) — цели 36 / 45 / 37 ± 2; шапка — прописными (`getComputedStyle(th).textTransform === 'uppercase'`). Прежние тесты — зелёные.
- [ ] **Step 2: изоляция.** `isolation.spec.ts` — в `?hostile` кнопки лейна и номера пагинации сохраняют высоту (как на чистой странице ± 1).
- [ ] **Step 3: скриншоты.** Playwright, 1600 × 1000, плотность 100 %, светлая тема: кит — записи, лейн и строка фильтров, подвал; стенд (`python3 -m http.server` из `pi-constructor` на свободном порту, `grid.html`) — подвал, если скриншота нет. В `docs/reference/img/`.
- [ ] **Step 4: запуск и commit.** `pnpm --filter demo e2e` — все зелёные, числа в отчёт — «e2e: замеры лейна, строки фильтров, подвала; скриншоты сверки 5b».

---

### Task 8: Документы

**Files:** `docs/superpowers/specs/2026-09-23-katran-design.md` (§4.2, §5.1, §6, §7), `docs/superpowers/specs/2026-09-24-katran-slice1e-registry-design.md` (§6.1), `CHANGELOG.md`, `docs/reference/registry-drift.md`, `docs/STATE.md`, `docs/superpowers/plans/2026-09-28-katran-pi-app.md`, `README.md` (если описывает затронутое)

- [ ] **Step 1:** основная спека — по спеке 5b §7; спека 1e §6.1 — пометка «отменено спекой 5b §4 (глиф в точке лейна)».
- [ ] **Step 2:** CHANGELOG — «Изменено» (счёт 8…4, `grid-pad` 8, вид лейна, строки фильтров, подвала, шапка прописными) и «Добавлено» (`SwiftField`, `conditionParts`, `CopyValue.size`/`muted`, тоны `Tag`, `StatusDot size="l"`, `LaneItem.glyph`, токены `grid-gap`, `dot-l`, `GridSkeleton.firstOrd`).
- [ ] **Step 3:** `registry-drift.md` — пункты 5b (T1, T2, T3, T5, T6, R1–R4, R8–R17, F3, L1, P3, W4, Z1): «**Исправлено** планом 5b (`<коммит>`)», сводка; ссылки на скриншоты `-5b`.
- [ ] **Step 4:** STATE — §6 (план 5b, проверки, замеры), §7 (техдолг из ревью), §9 (дальше — план `apps/pi`, затем выбор: advanced-фильтры или срез 2).
- [ ] **Step 5:** план `apps/pi` — Task 3: `shortAccount(acc, tail: 3 | 4 = 4)` добавляет только `tail: 3` для рубля (по умолчанию уже 8…4 после 5b); Task 8 Step 5: раскладка `fx-doc` — из демо после 5b.
- [ ] **Step 6: commit** — «Документы: план 5b исполнен — спеки, CHANGELOG, сверка, состояние, план apps/pi».
