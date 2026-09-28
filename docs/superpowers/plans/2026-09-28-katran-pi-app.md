# `apps/pi` — реестры ПИ на FSD с переносимым швом данных: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** новое приложение `apps/pi` в монорепо katran с экранами «Валютные документы» и «Рублёвые документы», разложенное по FSD так, чтобы внутри его код переносился слайсами или целиком, а менялся только обработчик транспорта.

**Architecture:** FSD-слои `app → pages → widgets → entities → shared`. Шов данных — один эффект `requestFx` в `shared/api`; контракт грида (`vtb-filters`) маппится в `shared/api`, строки — парсерами сущностей; порты сущностей строятся фабрикой `createGridPorts`. Фейковый сервер в `app/fake` — обработчик `requestFx`, говорящий JSON на контракте. Общая сборка реестра — виджет `doc-registry` поверх моделей `@katran/effector`.

**Tech Stack:** pnpm-монорепо, React (17–19 после плана 4), effector 23.4, effector-react, Vite 8, Vitest 5 + jsdom + Testing Library + jest-axe, Playwright, eslint (`import-x`).

**Spec:** `docs/superpowers/specs/2026-09-28-katran-pi-app-design.md`. Рекомендации потребителям — `docs/guides/effector-fsd.md`. Контракт бека — `/Users/shaman/_CODE/VTB/vtb-filters/docs/filter-contract.md`.

## Global Constraints

- Предусловия: планы 4 «Совместимость» и 5 «Реестр по эталону» слиты в `main` (Task 0).
- Среда внутри: React 17.0.2 (shared singleton хоста), effector 23.4, Chromium 88. В коде `apps/pi` не использовать `.at`, `Object.hasOwn`, `findLast`, `toSorted`, `structuredClone`, CSS `:has`, `inert`, `useId`.
- Импорты между слоями — только вниз; чужой слайс — только через его `index.ts`; соседние слайсы одного слоя — только через `@x` (Task 6 проверяет линтом). Импорты относительные, без алиасов (переносимость).
- Никаких `eslint-disable` / `stylelint-disable`. В CSS — только `var(--k-*)`, без голых `px` (кроме `border*`/`outline*`/`box-shadow`/`letter-spacing`), без hex/rgba.
- Опциональные поля публичных типов — `?: T | undefined` (`exactOptionalPropertyTypes`).
- Данные — только вымышленные; с фото прода ничего. Словари рублёвого реестра берутся с замороженного стенда (он обезличен).
- Русский язык интерфейса, комментариев, коммитов. Коммиты без трейлеров `Co-Authored-By` и подписей «Generated with»; автор `Ivan Klimenko <ivan.klimenko@gmail.com>`. Коммитить свои файлы поимённо.
- Порты: `apps/pi` dev — 5185, e2e preview — 5186 (5180–5184 заняты).
- `pnpm check` зелёный после каждой задачи.

---

## Карта файлов

```txt
apps/pi/
  package.json · vite.config.ts · vitest.config.ts · vitest.setup.ts · tsconfig.json · index.html
  playwright.config.ts · e2e/geometry.spec.ts · README.md
  src/
    app/
      entry.tsx · App.tsx · Shell.tsx · Shell.module.css · routes.ts · transport.ts
      fake/ filter.ts · meta.ts · grid.ts · server.ts · params.ts · grids.ts
            fx-docs.data.ts · rub-docs.data.ts · server.test.ts · contract.test.ts
    pages/
      fx-docs/  index.ts · model/registry.model.ts · ui/FxDocsPage.tsx
      rub-docs/ index.ts · model/registry.model.ts · ui/RubDocsPage.tsx
    widgets/doc-registry/
      index.ts · lib/createRegistry.ts · lib/createRegistry.test.ts
      ui/DocRegistry.tsx · ui/DocRegistry.module.css · ui/DocRegistry.test.tsx
    entities/
      doc-status/ index.ts · @x/fx-doc.ts · @x/rub-doc.ts · model/status.ts · model/status.test.ts
      fx-doc/  index.ts · model/fxDoc.ts · api/fxDoc.mapper.ts · api/fxDoc.mapper.test.ts · api/ports.ts · ui/layout.tsx · ui/cells.module.css
      rub-doc/ index.ts · model/rubDoc.ts · api/rubDoc.mapper.ts · api/rubDoc.mapper.test.ts · api/ports.ts · ui/layout.tsx · ui/cells.module.css
    shared/
      api/ index.ts · problem.ts · problem.test.ts · request.ts · request.test.ts · guards.ts
           grid-contract.ts · grid-contract.test.ts · ports.ts · ports.test.ts
      lib/lifecycle/ index.ts · createPageLifecycle.ts · createPageLifecycle.test.ts
      lib/test/ index.ts · renderK.tsx
packages/effector/src/createFiltersModel.ts · useFilters.ts (+ тесты)   — Task 2
packages/ui/src/format/account.ts · value/AccountValue.tsx (+ тесты)    — Task 3
apps/demo/…  — экран реестра, data/, e2e уходят (Task 11)
eslint.config.js · package.json (корень) · .github/workflows/pages.yml
docs/…  — Task 1, Task 14
```

---

### Task 0: Проверка предусловий

**Files:** только чтение.

- [ ] **Step 1: планы 4 и 5 слиты.** `git log --oneline main | head -40` — есть коммиты планов «Совместимость» и «Реестр по эталону»; `docs/STATE.md` §6 называет их исполненными. Если нет — **остановиться** и сообщить владельцу: этот план идёт после них.
- [ ] **Step 2: форма `Sort`.** Открыть `packages/ui/src/grid/types.ts`. План предполагает после S1:

```ts
export type SortLevel = { key: string; dir: 'asc' | 'desc' }
export type Sort = SortLevel[]          // [] — без сортировки
```

Если план 5 ввёл другую форму — записать её в леджер и в Task 5 (`toSearchBody`) и Task 7 (`fromSortDto`) использовать фактические имена полей; больше форма `Sort` нигде в плане не читается.
- [ ] **Step 3: `shortAccount`.** Открыть `packages/ui/src/format/account.ts`. Если у функции уже есть параметр длины хвоста — Task 3 пропускается (отметить в леджере, в Task 12 использовать фактическое имя пропа `AccountValue`).
- [ ] **Step 4: конфиги демо.** Прочитать `apps/demo/package.json`, `vite.config.ts`, `tsconfig.json` после плана 4 (версия React, classic JSX runtime, таргет сборки). Task 4 копирует их — все отличия от текста Task 4 переносить как в демо.
- [ ] **Step 5: `pnpm install && pnpm check`** — зелёный. Иначе остановиться.

---

### Task 1: Заморозка рублёвого реестра и сверка

**Files:**
- Modify: `docs/STATE.md` (§10, таблица эталонов)
- Modify: `docs/reference/registry-drift.md` (раздел «Рублёвый реестр»)
- Create (временно, удаляется в этой же задаче): `apps/demo/e2e-stand/stand.spec.ts`, `apps/demo/e2e-stand/playwright.config.ts`

- [ ] **Step 1: зафиксировать эталон.** `git -C /Users/shaman/_CODE/VTB/pi-constructor log --oneline -1` — хеш и дата. В `docs/STATE.md` §10 в строке «Рублёвый реестр (`rub-grid.html`)» заменить «не заморожен» на `<хеш>, <дата время>`, срез — «`apps/pi`», расхождения — «`docs/reference/registry-drift.md`, раздел «Рублёвый реестр»».
- [ ] **Step 2: замер эталона.** Создать `apps/demo/e2e-stand/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '.',
  use: { baseURL: 'http://localhost:5187', viewport: { width: 1600, height: 1000 } },
  webServer: { command: 'python3 -m http.server 5187 --directory ../../../../pi-constructor', url: 'http://localhost:5187/rub-grid.html', reuseExistingServer: false },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
```

и `apps/demo/e2e-stand/stand.spec.ts`:

```ts
import { test } from '@playwright/test'
test('замер рублёвого реестра стенда', async ({ page }) => {
  await page.goto('/rub-grid.html')
  await page.locator('.grid tbody.row').first().waitFor()
  const rec = (await page.locator('.grid tbody.row').first().boundingBox())!.height
  const head = (await page.locator('.grid thead').first().boundingBox())!.height
  console.log(`STAND rub: record=${rec} head=${head}`)
})
```

Run: `cd apps/demo && pnpm exec playwright test -c e2e-stand/playwright.config.ts --reporter=line`
Expected: строка `STAND rub: record=… head=…`. Записать числа в `registry-drift.md` (Step 3) и в STATE §10 рядом с хешем. Удалить каталог `apps/demo/e2e-stand/`.
- [ ] **Step 3: сверка.** Раздел «Рублёвый реестр» в `docs/reference/registry-drift.md` превратить в таблицу того же формата, что у валютного (`| № | Эталон | Кит | Класс | Решение | Где | Размер |`), по колонкам, сквозным строкам, лейну, фильтрам, сортировке, счёту, статусной точке, данным. Эталон — `rub-grid.tpl.html` на хеше Step 1; «кит» — то, что даст этот план по спеке §8.2 (кит рубля ещё не написан — сравнивается с планируемым). Классы C, известные заранее (записать с решением «Сознательно»): многоуровневая сортировка (В1); один стор условий лейна и панели; плоский каталог simple из 10 полей вместо групп; подпись статуса `INVALID` → «Невалидный» из общего словаря кита.
- [ ] **Step 4: вопросы владельцу.** Все пункты класса B собрать списком «вопросы владельцу» в конце раздела. **Остановиться и передать список контроллеру** — продолжать Task 12 можно только после решений; Task 2–11 от них не зависят.
- [ ] **Step 5: commit.**

```bash
git add docs/STATE.md docs/reference/registry-drift.md
git commit -m "Рублёвый реестр: эталон заморожен, замер и сверка с планом apps/pi"
```

---

### Task 2: Кит — загружаемый каталог фильтров

**Files:**
- Modify: `packages/effector/src/createFiltersModel.ts`
- Modify: `packages/effector/src/useFilters.ts`
- Test: `packages/effector/src/createFiltersModel.test.ts`, `packages/effector/src/hooks.test.tsx`

**Interfaces:**
- Produces: `FiltersModelConfig.meta?: FilterMeta | Store<FilterMeta | null> | undefined`; `FiltersModel.$meta: Store<FilterMeta | null>`; `FiltersBinding.meta` — текущее значение `$meta`. Поле `FiltersModel.meta` остаётся (`@deprecated`).

- [ ] **Step 1: тесты (падают).** В `createFiltersModel.test.ts` добавить в `describe`:

```ts
  it('meta значением: $meta отдаёт его; meta стором: $meta следует за стором', async () => {
    const fixed = { fields: [{ id: 'a', label: 'А', type: 'STRING' as const, ops: [] }] }
    expect(fork().getState(createFiltersModel({ meta: fixed }).$meta)).toEqual(fixed)
    expect(fork().getState(createFiltersModel().$meta)).toBeNull()
    const loaded = createEvent<FilterMeta>()
    const $src = createStore<FilterMeta | null>(null).on(loaded, (_, m) => m)
    const m = createFiltersModel({ meta: $src })
    const scope = fork()
    expect(scope.getState(m.$meta)).toBeNull()
    await allSettled(loaded, { scope, params: fixed })
    expect(scope.getState(m.$meta)).toEqual(fixed)
  })
```

Импорты файла дополнить: `import { allSettled, createEvent, createStore, fork } from 'effector'` и `import type { FilterMeta } from './types'`.

В `hooks.test.tsx`, в `describe('useFilters' …)` (если блока нет — создать рядом с `useGrid`):

```ts
  it('meta — текущее значение стора каталога', () => {
    const loaded = createEvent<FilterMeta>()
    const $src = createStore<FilterMeta | null>(null).on(loaded, (_, m) => m)
    const model = createFiltersModel({ meta: $src })
    const { result } = renderHook(() => useFilters(model))
    expect(result.current.meta).toBeNull()
    act(() => { loaded({ fields: [] }) })
    expect(result.current.meta).toEqual({ fields: [] })
  })
```

(дополнить импорты `createEvent` и `type FilterMeta`).
- [ ] **Step 2: запуск.** `pnpm --filter @katran/effector test` — FAIL: `$meta` не существует / `meta` не меняется.
- [ ] **Step 3: реализация.** В `createFiltersModel.ts`:

```ts
import { combine, createEvent, createStore, is, sample, type EventCallable, type Store } from 'effector'
```

тип конфига:

```ts
export type FiltersModelConfig = {
  /** Каталог полей: значением или стором (каталог, загружаемый с бека, — спека apps/pi §6.1). */
  meta?: FilterMeta | Store<FilterMeta | null> | undefined
  initial?: Filter | undefined
  /** Поле, которым управляет лейн статусов (спека 1e, §3). Без него setLane — no-op. */
  laneField?: string | undefined
}
```

в `FiltersModel` добавить перед `meta`:

```ts
  /** Каталог полей; null — ещё не загружен. */
  $meta: Store<FilterMeta | null>
  /** @deprecated Начальное значение каталога; читать $meta. */
  meta: FilterMeta | null
```

в начале функции:

```ts
const isMetaStore = (m: FiltersModelConfig['meta']): m is Store<FilterMeta | null> => is.store(m)
```

(объявить на уровне модуля, над `createFiltersModel`), а в теле:

```ts
  const $meta: Store<FilterMeta | null> = isMetaStore(meta) ? meta : createStore<FilterMeta | null>(meta ?? null)
```

и в `return` заменить `meta: meta ?? null` на `$meta, meta: isMetaStore(meta) ? null : (meta ?? null)`.

В `useFilters.ts`:

```ts
  const [conditions, draft, dirty, lane, meta] = useUnit([m.$conditions, m.$draft, m.$dirty, m.$lane, m.$meta])
```

и в `return` — `meta` вместо `meta: m.meta`.
- [ ] **Step 4: запуск.** `pnpm --filter @katran/effector test` — PASS; `pnpm check` — зелёный (демо передаёт каталог значением — работает).
- [ ] **Step 5: CHANGELOG.** В `CHANGELOG.md` под «Не выпущено» → «Добавлено»: «`createFiltersModel({ meta })` принимает стор каталога; модель отдаёт `$meta`, `useFilters` — текущее значение. Поле `meta` модели устарело».
- [ ] **Step 6: commit.**

```bash
git add packages/effector/src/createFiltersModel.ts packages/effector/src/useFilters.ts packages/effector/src/createFiltersModel.test.ts packages/effector/src/hooks.test.tsx CHANGELOG.md
git commit -m "effector: каталог фильтров стором — \$meta в модели и в useFilters"
```

---

### Task 3: Кит — длина хвоста сокращённого счёта

Пропускается, если Task 0 Step 3 нашёл параметр.

**Files:**
- Modify: `packages/ui/src/format/account.ts`, `packages/ui/src/value/AccountValue.tsx`
- Test: `packages/ui/src/format/account.test.ts` (создать, если нет), `packages/ui/src/value/Value.test.tsx`

**Interfaces:**
- Produces: `shortAccount(acc: string, tail?: 3 | 4): ShortAccount` (по умолчанию 4 — поведение F3); `AccountValueProps.tail?: 3 | 4 | undefined`.

- [ ] **Step 1: тесты (падают).** `account.test.ts`:

```ts
import { shortAccount } from './account'

describe('shortAccount', () => {
  const acc = '40702810999377318571'
  it('по умолчанию 8…4', () => {
    expect(shortAccount(acc)).toEqual({ head: '40702810', ccy: '810', tail: '8571', short: true })
  })
  it('tail 3 — 8…3 (рублёвый реестр)', () => {
    expect(shortAccount(acc, 3)).toEqual({ head: '40702810', ccy: '810', tail: '571', short: true })
  })
  it('короткий счёт не сокращается', () => {
    expect(shortAccount('40702810123', 4)).toEqual({ head: '40702810123', ccy: '810', tail: '', short: false })
  })
})
```

В `Value.test.tsx` добавить:

```ts
  it('AccountValue tail=3 показывает три последних знака', () => {
    renderK(<AccountValue value="40702810999377318571" tail={3} />)
    expect(screen.getByText((_, el) => el?.textContent === '40702810…571')).toBeInTheDocument()
  })
```

- [ ] **Step 2: запуск.** `pnpm --filter @katran/ui test` — FAIL.
- [ ] **Step 3: реализация.** `account.ts` (сохранить JSDoc, обновив текст):

```ts
export type ShortAccount = { head: string; ccy: string; tail: string; short: boolean }
/** Счёт в гриде: первые 8 знаков … последние tail (4 по умолчанию, 3 — рублёвый реестр); знаки 6–8 — код валюты. */
export function shortAccount(acc: string, tail: 3 | 4 = 4): ShortAccount {
  const ccy = acc.slice(5, 8)
  if (acc.length <= 8 + tail) return { head: acc, ccy, tail: '', short: false }
  return { head: acc.slice(0, 8), ccy, tail: acc.slice(-tail), short: true }
}
```

`AccountValue.tsx`:

```tsx
export type AccountValueProps = Omit<CopyValueProps, 'display' | 'short' | 'tone'> & { full?: boolean | undefined; tail?: 3 | 4 | undefined }

/** Счёт: в гриде 8…tail с выделенным кодом валюты; full — целиком (деталка). */
export function AccountValue({ value, full, tail, ...rest }: AccountValueProps) {
  const a = shortAccount(value, tail)
```

(остальное без изменений).
- [ ] **Step 4: запуск.** `pnpm --filter @katran/ui test` — PASS; `pnpm check` — зелёный.
- [ ] **Step 5: commit.**

```bash
git add packages/ui/src/format/account.ts packages/ui/src/format/account.test.ts packages/ui/src/value/AccountValue.tsx packages/ui/src/value/Value.test.tsx
git commit -m "ui: длина хвоста сокращённого счёта — tail 3 | 4"
```

---

### Task 4: Каркас `apps/pi`, жизненный цикл экрана, транспорт

**Files:**
- Create: `apps/pi/package.json`, `vite.config.ts`, `vitest.config.ts`, `vitest.setup.ts`, `tsconfig.json`, `index.html`
- Create: `apps/pi/src/app/entry.tsx`
- Create: `apps/pi/src/shared/lib/lifecycle/{createPageLifecycle.ts,createPageLifecycle.test.ts,index.ts}`
- Create: `apps/pi/src/shared/api/{problem.ts,problem.test.ts,request.ts,request.test.ts,index.ts}`
- Create: `apps/pi/src/shared/lib/test/{renderK.tsx,index.ts}`
- Modify: `eslint.config.js` (effector разрешён в `apps/pi`), `package.json` (корень: stylelint по `apps/pi`)

**Interfaces:**
- Produces:
  - `createPageLifecycle(): PageLifecycle`, `PageLifecycle = { pageOpened: EventCallable<void>; pageClosed: EventCallable<void>; $opened: Store<boolean> }`
  - `class ApiError extends Error { status: number; problem: Problem | null }`; `toApiError(status: number, body: unknown): ApiError`; `contractError(detail: string): ApiError`
  - `Problem = { type: string; title: string; status?: number | undefined; detail?: string | undefined; errors?: ProblemError[] | undefined }`, `ProblemError = { path: string; code: string; message: string }`
  - `HttpRequest = { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; url: string; query?: Record<string, string> | undefined; body?: unknown }`; `requestFx: Effect<HttpRequest, unknown, ApiError>`
  - `renderK(ui)` — рендер под `KatranProvider` для тестов `apps/pi`

- [ ] **Step 1: пакет.** `apps/pi/package.json` (версии зависимостей — как в `apps/demo/package.json` после плана 4; тестовые — как в `packages/ui/package.json`):

```json
{
  "name": "pi",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port 5185 --strictPort",
    "build": "tsc -p tsconfig.json --noEmit && vite build",
    "preview": "vite preview --port 5185",
    "test": "vitest run",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@katran/effector": "workspace:*",
    "@katran/tokens": "workspace:*",
    "@katran/ui": "workspace:*",
    "effector": "^23.4.4",
    "effector-react": "^23.3.0",
    "react": "^19",
    "react-dom": "^19"
  },
  "devDependencies": {
    "@playwright/test": "^1.63.0",
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.7",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^6",
    "jest-axe": "^11.0.0",
    "jsdom": "^30.1.1",
    "vite": "^8",
    "vitest": "^5.0.1"
  }
}
```

`vite.config.ts` — копия `apps/demo/vite.config.ts` (комментарий про Pages: «Pages отдаёт приложение из /katran/pi/»). `vitest.config.ts`:

```ts
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: { environment: 'jsdom', globals: true, setupFiles: ['./vitest.setup.ts'], include: ['src/**/*.test.{ts,tsx}'], css: { modules: { classNameStrategy: 'non-scoped' } } },
}))
```

`vitest.setup.ts` — копия `packages/ui/vitest.setup.ts`. `tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "noEmit": true, "types": ["vitest/globals"] }, "include": ["src", "vitest.setup.ts", "../../packages/ui/src/css-modules.d.ts", "../../packages/ui/src/test/jest-axe.d.ts", "../../packages/ui/src/test/vitest-matchers.d.ts"] }
```

`index.html` — копия демо с `<title>Реестры ПИ — katran</title>` и `src="/src/app/entry.tsx"`. `src/app/entry.tsx` (временная заглушка до Task 11):

```tsx
import { createRoot } from 'react-dom/client'
import '@katran/tokens/fonts.css'
import { KatranProvider } from '@katran/ui'

createRoot(document.getElementById('root')!).render(<KatranProvider storageKey="katran-pi"><p>Реестры ПИ</p></KatranProvider>)
```

Run: `pnpm install && pnpm --filter pi build` — PASS.
- [ ] **Step 2: eslint и stylelint.** В `eslint.config.js` в блоке, выключающем `no-restricted-imports`, добавить `'apps/pi/src/**/*.{ts,tsx}'` в `files`. В корневом `package.json` в `lint` добавить `"apps/pi/src/**/*.css"` к списку stylelint.
- [ ] **Step 3: тесты жизненного цикла (падают).** `shared/lib/lifecycle/createPageLifecycle.test.ts`:

```ts
import { allSettled, fork } from 'effector'
import { createPageLifecycle } from './createPageLifecycle'

describe('createPageLifecycle', () => {
  it('$opened: false → pageOpened → true → pageClosed → false', async () => {
    const l = createPageLifecycle()
    const scope = fork()
    expect(scope.getState(l.$opened)).toBe(false)
    await allSettled(l.pageOpened, { scope })
    expect(scope.getState(l.$opened)).toBe(true)
    await allSettled(l.pageClosed, { scope })
    expect(scope.getState(l.$opened)).toBe(false)
  })
})
```

- [ ] **Step 4: реализация.** `createPageLifecycle.ts`:

```ts
import { createEvent, createStore, type EventCallable, type Store } from 'effector'

/** Жизненный цикл экрана: роутер вызывает pageOpened/pageClosed, модели читают $opened. Модели о роутере не знают. */
export type PageLifecycle = { pageOpened: EventCallable<void>; pageClosed: EventCallable<void>; $opened: Store<boolean> }

export function createPageLifecycle(): PageLifecycle {
  const pageOpened = createEvent<void>()
  const pageClosed = createEvent<void>()
  const $opened = createStore(false).on(pageOpened, () => true).on(pageClosed, () => false)
  return { pageOpened, pageClosed, $opened }
}
```

`index.ts`: `export { createPageLifecycle, type PageLifecycle } from './createPageLifecycle'`.
- [ ] **Step 5: тесты транспорта (падают).** `shared/api/problem.test.ts`:

```ts
import { ApiError, contractError, toApiError } from './problem'

describe('toApiError', () => {
  it('Problem Details: title и detail в message, problem сохраняется', () => {
    const body = { type: 'urn:vtb:grid:filter-validation', title: 'Некорректный фильтр', status: 400, detail: '1 условие не прошло проверку',
      errors: [{ path: 'filter.conditions[0].op', code: 'OPERATOR_NOT_ALLOWED', message: 'Оператор CONTAINS недопустим' }] }
    const e = toApiError(400, body)
    expect(e).toBeInstanceOf(ApiError)
    expect(e).toBeInstanceOf(Error)
    expect(e.status).toBe(400)
    expect(e.problem?.errors?.[0]?.code).toBe('OPERATOR_NOT_ALLOWED')
    expect(e.message).toBe('Некорректный фильтр: 1 условие не прошло проверку')
  })
  it('тело не Problem Details — общий текст со статусом', () => {
    expect(toApiError(502, '<html>').message).toBe('Ошибка запроса (статус 502)')
    expect(toApiError(500, null).problem).toBeNull()
  })
  it('contractError — статус 0 и тип urn:katran:contract', () => {
    const e = contractError('content[0].id: ожидалась строка')
    expect(e.status).toBe(0)
    expect(e.problem?.type).toBe('urn:katran:contract')
    expect(e.message).toBe('Ответ не по контракту: content[0].id: ожидалась строка')
  })
})
```

`shared/api/request.test.ts`:

```ts
import { allSettled, fork } from 'effector'
import { ApiError } from './problem'
import { requestFx } from './request'

describe('requestFx', () => {
  it('без подключённого обработчика отказывает понятной ApiError', async () => {
    const r = await allSettled(requestFx, { scope: fork(), params: { method: 'GET', url: '/x' } })
    expect(r.status).toBe('fail')
    expect(r.value).toBeInstanceOf(ApiError)
    expect((r.value as ApiError).message).toMatch(/Транспорт не подключён/)
  })
  it('обработчик подключается через fork handlers', async () => {
    const scope = fork({ handlers: [[requestFx, async () => ({ ok: true })]] })
    const r = await allSettled(requestFx, { scope, params: { method: 'GET', url: '/x' } })
    expect(r).toEqual({ status: 'done', value: { ok: true } })
  })
})
```

Run: `pnpm --filter pi test` — FAIL (модулей нет).
- [ ] **Step 6: реализация.** `shared/api/problem.ts`:

```ts
/** Ошибка бека в формате RFC 9457 (контракт vtb-filters §8). */
export type ProblemError = { path: string; code: string; message: string }
export type Problem = { type: string; title: string; status?: number | undefined; detail?: string | undefined; errors?: ProblemError[] | undefined }

/** Ошибка транспорта и контракта. Наследник Error: модель грида пишет в $error e.message только для Error. */
export class ApiError extends Error {
  readonly status: number
  readonly problem: Problem | null
  constructor(status: number, problem: Problem | null, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}

const isProblem = (b: unknown): b is Problem =>
  typeof b === 'object' && b !== null && typeof (b as { type?: unknown }).type === 'string' && typeof (b as { title?: unknown }).title === 'string'

/** Для обработчика requestFx: ответ не 2xx → отказ с этим значением. */
export function toApiError(status: number, body: unknown): ApiError {
  const problem = isProblem(body) ? body : null
  const message = problem ? (problem.detail ? `${problem.title}: ${problem.detail}` : problem.title) : `Ошибка запроса (статус ${status})`
  return new ApiError(status, problem, message)
}

/** Ответ пришёл, но не по контракту: грид покажет ошибку, приложение не упадёт. */
export const contractError = (detail: string): ApiError =>
  new ApiError(0, { type: 'urn:katran:contract', title: 'Ответ не по контракту', detail }, `Ответ не по контракту: ${detail}`)
```

`shared/api/request.ts`:

```ts
import { createEffect } from 'effector'
import { ApiError } from './problem'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
export type HttpRequest = { method: HttpMethod; url: string; query?: Record<string, string> | undefined; body?: unknown }

/**
 * Единственный транспорт приложения. Обработчик подключает слой app: requestFx.use(handler).
 * Правило обработчика: 2xx → разобранный JSON; иначе — отказ с toApiError(status, body).
 */
export const requestFx = createEffect<HttpRequest, unknown, ApiError>(() => {
  throw new ApiError(0, null, 'Транспорт не подключён: вызовите requestFx.use(…) в слое app')
})
```

`shared/api/index.ts`:

```ts
export { ApiError, contractError, toApiError, type Problem, type ProblemError } from './problem'
export { requestFx, type HttpMethod, type HttpRequest } from './request'
```

`shared/lib/test/renderK.tsx` (и `shared/lib/test/index.ts`: `export { renderK } from './renderK'` — у каждого сегмента `shared/lib/*` свой публичный API, Task 6):

```tsx
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { KatranProvider } from '@katran/ui'

/** Рендер под провайдером кита — как renderK в packages/ui. Корень контейнера — провайдер, искать по ролям. */
export const renderK = (ui: ReactElement, o?: RenderOptions): RenderResult =>
  render(ui, { wrapper: ({ children }) => <KatranProvider>{children}</KatranProvider>, ...o })
```

- [ ] **Step 7: запуск.** `pnpm --filter pi test` — PASS; `pnpm check` — зелёный.
- [ ] **Step 8: commit.**

```bash
git add apps/pi eslint.config.js package.json pnpm-lock.yaml
git commit -m "apps/pi: каркас, жизненный цикл экрана, транспорт requestFx и ApiError"
```

---

### Task 5: Контракт грида и порты

**Files:**
- Create: `apps/pi/src/shared/api/{guards.ts,grid-contract.ts,grid-contract.test.ts,ports.ts,ports.test.ts}`
- Modify: `apps/pi/src/shared/api/index.ts`

**Interfaces:**
- Consumes: `requestFx`, `contractError`, `ApiError` (Task 4); `GridQuery`, `GridPage`, `FacetsQuery`, `Facet`, `FilterMeta`, `FilterField`, `Filter`, `Condition`, `Scalar`, `FilterFieldType` из `@katran/effector`; `Sort` после плана 5 (Task 0 Step 2).
- Produces:
  - гарды `obj(v, path): Obj`, `arr(v, path): unknown[]`, `str(o, k, path): string`, `strOrNull(o, k, path): string | null`, `num(o, k, path): number`, `oneOf<T extends string>(o, k, values: readonly T[], path): T`, `scalar(v, path): Scalar`, тип `Obj = Record<string, unknown>`
  - `SortDto = { field: string; direction: 'ASC' | 'DESC' }`, `SearchBody`, `FacetsBody`, `FieldDto`, `FilterMetaDto`, `RowParser<Row> = (raw: unknown, path: string) => Row`
  - `toSearchBody(q: GridQuery): SearchBody`, `toFacetsBody(q: FacetsQuery): FacetsBody`, `fromSearchResponse<Row>(body, parseRow): GridPage<Row>`, `fromFacetsResponse(body): Facet[]`, `fromFilterMetaResponse(body): FilterMeta`, `OPERATORS`, `FIELD_TYPES`
  - `createGridPorts<Row>({ gridId, parseRow }): GridPorts<Row>`, `GridPorts<Row> = { searchFx: Effect<GridQuery, GridPage<Row>, ApiError>; facetsFx: Effect<FacetsQuery, Facet[], ApiError>; filterMetaFx: Effect<void, FilterMeta, ApiError> }`

- [ ] **Step 1: тесты маппинга (падают).** `grid-contract.test.ts`:

```ts
import { ApiError } from './problem'
import { fromFacetsResponse, fromFilterMetaResponse, fromSearchResponse, toFacetsBody, toSearchBody } from './grid-contract'
import { obj, str } from './guards'

const parseRow = (raw: unknown, path: string) => { const o = obj(raw, path); return { id: str(o, 'id', path) } }

describe('контракт грида', () => {
  it('toSearchBody: фильтр, уровни сортировки, страница, includeTotal (§5.1)', () => {
    expect(toSearchBody({ filter: [{ field: 'status', op: 'IN', values: ['ERROR'] }], sort: [{ key: 'created', dir: 'desc' }, { key: 'amount', dir: 'asc' }], page: 2, size: 20 })).toEqual({
      filter: { conditions: [{ field: 'status', op: 'IN', values: ['ERROR'] }] },
      sort: [{ field: 'created', direction: 'DESC' }, { field: 'amount', direction: 'ASC' }],
      page: { number: 2, size: 20 },
      includeTotal: true,
    })
  })
  it('toFacetsBody', () => {
    expect(toFacetsBody({ filter: [], field: 'status' })).toEqual({ filter: { conditions: [] }, field: 'status' })
  })
  it('fromSearchResponse: content → строки, totalElements → total (§5.2)', () => {
    const body = { content: [{ id: 'DOC-1' }, { id: 'DOC-2' }], page: { number: 0, size: 50, totalElements: 651, totalPages: 14, hasNext: true } }
    expect(fromSearchResponse(body, parseRow)).toEqual({ rows: [{ id: 'DOC-1' }, { id: 'DOC-2' }], total: 651 })
    expect(fromSearchResponse({ content: [], page: { number: 0, size: 20, totalElements: 0 } }, parseRow)).toEqual({ rows: [], total: 0 })
  })
  it('битая форма → ApiError urn:katran:contract с путём поля', () => {
    const run = () => fromSearchResponse({ content: [{ id: 7 }], page: { totalElements: 1 } }, parseRow)
    expect(run).toThrow(ApiError)
    expect(run).toThrow('content[0].id: ожидалась строка')
    expect(() => fromSearchResponse({ page: { totalElements: 1 } }, parseRow)).toThrow('content: ожидался массив')
  })
  it('fromFacetsResponse', () => {
    expect(fromFacetsResponse([{ value: 'ERROR', count: 3 }])).toEqual([{ value: 'ERROR', count: 3 }])
    expect(() => fromFacetsResponse([{ value: 'ERROR' }])).toThrow(ApiError)
  })
  it('fromFilterMetaResponse: операторы, INLINE-справочник, группа (§6)', () => {
    const body = {
      gridId: 'documents',
      groups: [{ id: 'main', title: 'Основные', fields: ['status', 'docNumber'] }],
      fields: [
        { id: 'status', label: 'Статус', type: 'ENUM', dictionary: 'docStatus', operators: ['EQ', 'IN'] },
        { id: 'docNumber', label: 'Номер документа', type: 'STRING', operators: ['EQ', 'CONTAINS'] },
        { id: 'bic', label: 'БИК', type: 'STRING', dictionary: 'bic', operators: ['EQ'] },
      ],
      dictionaries: { docStatus: { mode: 'INLINE', items: [{ value: 'ERROR', label: 'Ошибка' }] }, bic: { mode: 'LOOKUP' } },
    }
    expect(fromFilterMetaResponse(body)).toEqual({ fields: [
      { id: 'status', label: 'Статус', type: 'ENUM', ops: ['EQ', 'IN'], values: [{ value: 'ERROR', label: 'Ошибка' }], group: 'Основные' },
      { id: 'docNumber', label: 'Номер документа', type: 'STRING', ops: ['EQ', 'CONTAINS'], values: undefined, group: 'Основные' },
      { id: 'bic', label: 'БИК', type: 'STRING', ops: ['EQ'], values: undefined, group: undefined },
    ] })
    expect(() => fromFilterMetaResponse({ fields: [{ id: 'a', label: 'А', type: 'STRING', operators: ['LIKE'] }] })).toThrow('fields[0].operators[0]: неизвестный оператор')
  })
})
```

- [ ] **Step 2: запуск.** `pnpm --filter pi test` — FAIL.
- [ ] **Step 3: гарды.** `guards.ts`:

```ts
import type { Scalar } from '@katran/effector'
import { contractError } from './problem'

/** Проверка формы ответа без зависимостей: каждый гард бросает contractError с путём поля. */
export type Obj = Record<string, unknown>

export function obj(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw contractError(`${path}: ожидался объект`)
  return v as Obj
}
export function arr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) throw contractError(`${path}: ожидался массив`)
  return v
}
export function str(o: Obj, k: string, path: string): string {
  const v = o[k]
  if (typeof v !== 'string') throw contractError(`${path}.${k}: ожидалась строка`)
  return v
}
export function strOrNull(o: Obj, k: string, path: string): string | null {
  const v = o[k]
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') throw contractError(`${path}.${k}: ожидалась строка или null`)
  return v
}
export function num(o: Obj, k: string, path: string): number {
  const v = o[k]
  if (typeof v !== 'number' || Number.isNaN(v)) throw contractError(`${path}.${k}: ожидалось число`)
  return v
}
export function oneOf<T extends string>(o: Obj, k: string, values: readonly T[], path: string): T {
  const v = str(o, k, path)
  if (!(values as readonly string[]).includes(v)) throw contractError(`${path}.${k}: недопустимое значение «${v}»`)
  return v as T
}
export function scalar(v: unknown, path: string): Scalar {
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  throw contractError(`${path}: ожидалось скалярное значение`)
}
```

Путь в `obj`/`arr` пишется целиком (`content`, `content[0]`), в `str`/`num` — родитель плюс ключ: `str(o, 'id', 'content[0]')` → «content[0].id: …».
- [ ] **Step 4: маппинг.** `grid-contract.ts`:

```ts
import type { Condition, Facet, FacetsQuery, Filter, FilterField, FilterFieldType, FilterMeta, GridPage, GridQuery, Scalar } from '@katran/effector'
import { contractError } from './problem'
import { arr, num, obj, oneOf, scalar, str } from './guards'

/** Тела и ответы POST /grids/{gridId}/search|facets и GET /grids/{gridId}/filter-meta — контракт vtb-filters §5–6. */
export type SortDto = { field: string; direction: 'ASC' | 'DESC' }
export type SearchBody = { filter: { conditions: Filter }; sort: SortDto[]; page: { number: number; size: number }; includeTotal: boolean }
export type FacetsBody = { filter: { conditions: Filter }; field: string }
export type FieldDto = { id: string; label: string; type: FilterFieldType; operators: Condition['op'][]; dictionary?: string | undefined }
export type FilterMetaDto = {
  gridId?: string | undefined
  groups?: { id: string; title: string; fields: string[] }[] | undefined
  fields: FieldDto[]
  dictionaries?: Record<string, { mode: 'INLINE' | 'LOOKUP'; items?: { value: Scalar; label: string }[] | undefined }> | undefined
}
/** Строка грида: сущность проверяет форму и переименовывает поля бека. Бросает contractError. */
export type RowParser<Row> = (raw: unknown, path: string) => Row

export const OPERATORS = ['EQ', 'NE', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IN', 'NOT_IN', 'IS_EMPTY', 'IS_NOT_EMPTY'] as const
export const FIELD_TYPES = ['STRING', 'NUMBER', 'DATE', 'DATETIME', 'ENUM', 'BOOLEAN'] as const

export const toSearchBody = (q: GridQuery): SearchBody => ({
  filter: { conditions: q.filter },
  sort: q.sort.map((l) => ({ field: l.key, direction: l.dir === 'asc' ? 'ASC' : 'DESC' })),
  page: { number: q.page, size: q.size },
  includeTotal: true,
})

export const toFacetsBody = (q: FacetsQuery): FacetsBody => ({ filter: { conditions: q.filter }, field: q.field })

export function fromSearchResponse<Row>(body: unknown, parseRow: RowParser<Row>): GridPage<Row> {
  const o = obj(body, 'ответ')
  const rows = arr(o.content, 'content').map((r, i) => parseRow(r, `content[${i}]`))
  return { rows, total: num(obj(o.page, 'page'), 'totalElements', 'page') }
}

export function fromFacetsResponse(body: unknown): Facet[] {
  return arr(body, 'ответ').map((x, i) => {
    const o = obj(x, `[${i}]`)
    return { value: scalar(o.value, `[${i}].value`), count: num(o, 'count', `[${i}]`) }
  })
}

export function fromFilterMetaResponse(body: unknown): FilterMeta {
  const o = obj(body, 'ответ')
  const dicts = o.dictionaries === undefined || o.dictionaries === null ? {} : obj(o.dictionaries, 'dictionaries')
  const groupOf = new Map<string, string>()
  if (o.groups !== undefined && o.groups !== null) {
    arr(o.groups, 'groups').forEach((g, i) => {
      const go = obj(g, `groups[${i}]`)
      const title = str(go, 'title', `groups[${i}]`)
      for (const f of arr(go.fields, `groups[${i}].fields`)) if (typeof f === 'string') groupOf.set(f, title)
    })
  }
  const fields = arr(o.fields, 'fields').map((f, i): FilterField => {
    const p = `fields[${i}]`
    const fo = obj(f, p)
    const id = str(fo, 'id', p)
    const ops = arr(fo.operators, `${p}.operators`).map((op, j) => {
      if (typeof op !== 'string' || !(OPERATORS as readonly string[]).includes(op)) throw contractError(`${p}.operators[${j}]: неизвестный оператор`)
      return op as Condition['op']
    })
    const dictId = typeof fo.dictionary === 'string' ? fo.dictionary : null
    const d = dictId !== null && dicts[dictId] !== undefined ? obj(dicts[dictId], `dictionaries.${dictId}`) : null
    const values = d !== null && d.mode === 'INLINE'
      ? arr(d.items, `dictionaries.${dictId}.items`).map((it, k) => {
        const ip = `dictionaries.${dictId}.items[${k}]`
        const io = obj(it, ip)
        return { value: scalar(io.value, `${ip}.value`), label: str(io, 'label', ip) }
      })
      : undefined
    return { id, label: str(fo, 'label', p), type: oneOf(fo, 'type', FIELD_TYPES, p), ops, values, group: groupOf.get(id) }
  })
  return { fields }
}
```

- [ ] **Step 5: запуск.** `pnpm --filter pi test` — тесты маппинга PASS.
- [ ] **Step 6: тесты портов (падают).** `ports.test.ts`:

```ts
import { allSettled, fork } from 'effector'
import { obj, str } from './guards'
import { ApiError, toApiError } from './problem'
import { createGridPorts } from './ports'
import { requestFx, type HttpRequest } from './request'

const ports = createGridPorts({ gridId: 'docs', parseRow: (raw, path) => ({ id: str(obj(raw, path), 'id', path) }) })

describe('createGridPorts', () => {
  it('searchFx: POST /grids/docs/search с телом контракта, ответ маппится', async () => {
    const seen: HttpRequest[] = []
    const scope = fork({ handlers: [[requestFx, async (r: HttpRequest) => { seen.push(r); return { content: [{ id: 'a' }], page: { totalElements: 1 } } }]] })
    const r = await allSettled(ports.searchFx, { scope, params: { filter: [], sort: [], page: 0, size: 20 } })
    expect(r).toEqual({ status: 'done', value: { rows: [{ id: 'a' }], total: 1 } })
    expect(seen).toEqual([{ method: 'POST', url: '/grids/docs/search', body: { filter: { conditions: [] }, sort: [], page: { number: 0, size: 20 }, includeTotal: true } }])
  })
  it('facetsFx и filterMetaFx ходят по своим адресам', async () => {
    const seen: string[] = []
    const scope = fork({ handlers: [[requestFx, async (r: HttpRequest) => { seen.push(`${r.method} ${r.url}`); return r.url.endsWith('facets') ? [] : { fields: [] } }]] })
    await allSettled(ports.facetsFx, { scope, params: { filter: [], field: 'status' } })
    await allSettled(ports.filterMetaFx, { scope })
    expect(seen).toEqual(['POST /grids/docs/facets', 'GET /grids/docs/filter-meta'])
  })
  it('отказ транспорта доходит до порта как ApiError', async () => {
    const scope = fork({ handlers: [[requestFx, async () => { throw toApiError(400, { type: 't', title: 'Некорректный фильтр' }) }]] })
    const r = await allSettled(ports.searchFx, { scope, params: { filter: [], sort: [], page: 0, size: 20 } })
    expect(r.status).toBe('fail')
    expect((r.value as ApiError).status).toBe(400)
  })
})
```

- [ ] **Step 7: реализация.** `ports.ts`:

```ts
import { createEffect, type Effect } from 'effector'
import type { Facet, FacetsQuery, FilterMeta, GridPage, GridQuery } from '@katran/effector'
import { fromFacetsResponse, fromFilterMetaResponse, fromSearchResponse, toFacetsBody, toSearchBody, type RowParser } from './grid-contract'
import type { ApiError } from './problem'
import { requestFx } from './request'

/** Порты грида: доменные типы снаружи, контракт и транспорт внутри. Farfetched оборачивает их как есть: createQuery({ effect: searchFx }). */
export type GridPorts<Row> = {
  searchFx: Effect<GridQuery, GridPage<Row>, ApiError>
  facetsFx: Effect<FacetsQuery, Facet[], ApiError>
  filterMetaFx: Effect<void, FilterMeta, ApiError>
}

export function createGridPorts<Row>({ gridId, parseRow }: { gridId: string; parseRow: RowParser<Row> }): GridPorts<Row> {
  const base = `/grids/${gridId}`
  // вызов requestFx внутри обработчика сохраняет scope (effector 23)
  const searchFx = createEffect<GridQuery, GridPage<Row>, ApiError>(async (q) =>
    fromSearchResponse(await requestFx({ method: 'POST', url: `${base}/search`, body: toSearchBody(q) }), parseRow))
  const facetsFx = createEffect<FacetsQuery, Facet[], ApiError>(async (q) =>
    fromFacetsResponse(await requestFx({ method: 'POST', url: `${base}/facets`, body: toFacetsBody(q) })))
  const filterMetaFx = createEffect<void, FilterMeta, ApiError>(async () =>
    fromFilterMetaResponse(await requestFx({ method: 'GET', url: `${base}/filter-meta` })))
  return { searchFx, facetsFx, filterMetaFx }
}
```

`index.ts` дополнить:

```ts
export { arr, num, obj, oneOf, scalar, str, strOrNull, type Obj } from './guards'
export {
  FIELD_TYPES, OPERATORS, fromFacetsResponse, fromFilterMetaResponse, fromSearchResponse, toFacetsBody, toSearchBody,
  type FacetsBody, type FieldDto, type FilterMetaDto, type RowParser, type SearchBody, type SortDto,
} from './grid-contract'
export { createGridPorts, type GridPorts } from './ports'
```

- [ ] **Step 8: запуск.** `pnpm --filter pi test` — PASS; `pnpm check` — зелёный.
- [ ] **Step 9: commit.**

```bash
git add apps/pi/src/shared/api
git commit -m "apps/pi: контракт грида vtb-filters и порты createGridPorts поверх requestFx"
```

---

### Task 6: FSD-границы в eslint

**Files:**
- Modify: `eslint.config.js`

**Interfaces:**
- Produces: правило `import-x/no-restricted-paths` для `apps/pi/src`: импорт только вниз по слоям; чужой слайс нижнего слоя — только `index.ts`; сегмент `shared` — только его `index.ts`; соседний слайс того же слоя — только `@x` (у `entities`), иначе запрещён.

- [ ] **Step 1: генератор зон.** В начало `eslint.config.js`:

```js
import { existsSync, readdirSync } from 'node:fs'

// FSD-границы apps/pi (docs/guides/effector-fsd.md, спека apps/pi §4): слои только вниз, чужой слайс — только публичный API
const PI = './apps/pi/src'
const LAYERS = ['app', 'pages', 'widgets', 'entities', 'shared']
const dirsOf = (path) => (existsSync(path) ? readdirSync(path, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [])
const slicesOf = (layer) => dirsOf(`${PI}/${layer}`)
// у shared единица с публичным API — сегмент (api), а в lib — каждый подкаталог (lib/lifecycle, lib/test)
const unitsOf = (layer) => (layer === 'shared' ? slicesOf('shared').flatMap((seg) => (seg === 'lib' ? dirsOf(`${PI}/shared/lib`).map((x) => `lib/${x}`) : [seg])) : slicesOf(layer))
const fsdZones = LAYERS.flatMap((layer, i) => {
  const zones = []
  // вверх — никогда
  for (const upper of LAYERS.slice(0, i)) zones.push({ target: `${PI}/${layer}`, from: `${PI}/${upper}`, message: `FSD: ${layer} не импортирует ${upper}` })
  // вниз — только index.ts слайса или сегмента shared
  if (layer !== 'shared') {
    for (const lower of LAYERS.slice(i + 1)) {
      for (const s of unitsOf(lower)) zones.push({ target: `${PI}/${layer}`, from: `${PI}/${lower}/${s}`, except: ['./index.ts'], message: `FSD: ${lower}/${s} — только через публичный API (index.ts)` })
    }
  }
  // соседи по слою — только @x у entities
  if (layer !== 'app' && layer !== 'shared') {
    for (const t of slicesOf(layer)) {
      for (const f of slicesOf(layer).filter((x) => x !== t)) {
        zones.push({ target: `${PI}/${layer}/${t}`, from: `${PI}/${layer}/${f}`, ...(layer === 'entities' ? { except: ['./@x'] } : {}), message: `FSD: ${layer}/${t} не импортирует соседа ${f}${layer === 'entities' ? ' (только через @x)' : ''}` })
      }
    }
  }
  return zones
})
```

и в существующее правило `'import-x/no-restricted-paths'` добавить `...fsdZones` в конец массива `zones`.
- [ ] **Step 2: проверка на нарушениях (должна упасть).** Сейчас есть слои `app` и `shared` — на них и проверяем. Временный `apps/pi/src/app/__violation.ts`:

```ts
export { requestFx } from '../shared/api/request'
export { createPageLifecycle } from '../shared/lib/lifecycle'
```

Временный `apps/pi/src/shared/api/__violation.ts`:

```ts
import '../../app/entry'
```

Run: `pnpm exec eslint apps/pi/src/app/__violation.ts apps/pi/src/shared/api/__violation.ts`
Expected: ровно две ошибки — «FSD: shared/api — только через публичный API (index.ts)» на первой строке первого файла (вторая строка — импорт через `index.ts` сегмента `lib/lifecycle` — без ошибки) и «FSD: shared не импортирует app» во втором файле. Удалить оба `__violation.ts`. Сиблинги и `@x` проверяются в Task 8 Step 8.
- [ ] **Step 3: запуск.** `pnpm lint` — зелёный.
- [ ] **Step 4: commit.**

```bash
git add eslint.config.js
git commit -m "eslint: FSD-границы apps/pi — слои вниз, слайсы через index.ts, соседи через @x"
```

---

### Task 7: Фейковый сервер

**Files:**
- Create: `apps/pi/src/app/fake/{filter.ts,meta.ts,grid.ts,server.ts,params.ts,server.test.ts}`

**Interfaces:**
- Consumes: `HttpRequest`, `toApiError`, `Problem`, `ProblemError`, `SearchBody`, `FacetsBody`, `FilterMetaDto`, `FieldDto`, `SortDto` (`shared/api`); `sortRows`, `ColumnDef` (`@katran/ui`); `Filter`, `Condition`, `FilterFieldType`, `Sort` (`@katran/effector`).
- Produces:
  - `applyFilter<Row extends Record<string, unknown>>(rows: Row[], f: Filter): Row[]`
  - `OPS_BY_TYPE: Record<FilterFieldType, Condition['op'][]>`, `field(id, label, type, dictionary?): FieldDto`, `inline(labels: Record<string, string>)`
  - `FakeGrid = { meta: FilterMetaDto; search(b: SearchBody): unknown; facets(b: FacetsBody): unknown }`, `fakeGrid<Row>(rows, columns, meta): FakeGrid`
  - `createFakeServer(grids: Record<string, FakeGrid>, opts?: FakeServerOptions): (req: HttpRequest) => Promise<unknown>`, `FakeServerOptions = { delayMs?: (() => number) | undefined; failing?: (() => string | null) | undefined }`
  - `browserFakeOptions: FakeServerOptions` (`?slow=N`, `?fail=search|facets|meta`)

- [ ] **Step 1: тесты (падают).** `server.test.ts`:

```ts
import type { ColumnDef } from '@katran/ui'
import { ApiError, type HttpRequest } from '../../shared/api'
import { fakeGrid } from './grid'
import { field, inline } from './meta'
import { createFakeServer } from './server'

type Row = { id: string; status: string; amount: number; name: string }
const rows: Row[] = [
  { id: '1', status: 'ERROR', amount: 10, name: 'Альфа' },
  { id: '2', status: 'DONE', amount: 30, name: 'Бета' },
  { id: '3', status: 'ERROR', amount: 20, name: 'Гамма' },
]
const columns: ColumnDef<Row>[] = [
  { id: 'status', sort: [{ id: 'status', label: 'Статус' }], render: (r) => r.status },
  { id: 'amount', sort: [{ id: 'amount', label: 'Сумма', type: 'number' }], render: (r) => r.amount },
]
const meta = { fields: [field('status', 'Статус', 'ENUM', 'st'), field('amount', 'Сумма', 'NUMBER'), field('name', 'Имя', 'STRING')], dictionaries: { st: inline({ ERROR: 'Ошибка', DONE: 'Обработан' }) } }
const server = createFakeServer({ docs: fakeGrid(rows, columns, meta) })
const post = (url: string, body: unknown): HttpRequest => ({ method: 'POST', url, body })
const search = (over: object = {}) => ({ filter: { conditions: [] }, sort: [], page: { number: 0, size: 20 }, includeTotal: true, ...over })

describe('фейковый сервер', () => {
  it('search: фильтр, сортировка по уровню, страница — ответ по контракту §5.2', async () => {
    const body = await server(post('/grids/docs/search', search({ filter: { conditions: [{ field: 'status', op: 'EQ', value: 'ERROR' }] }, sort: [{ field: 'amount', direction: 'DESC' }], page: { number: 0, size: 1 } })))
    expect(body).toEqual({ content: [rows[2]], page: { number: 0, size: 1, totalElements: 2, totalPages: 2, hasNext: true } })
  })
  it('facets: счётчики по полю', async () => {
    expect(await server(post('/grids/docs/facets', { filter: { conditions: [] }, field: 'status' }))).toEqual([{ value: 'ERROR', count: 2 }, { value: 'DONE', count: 1 }])
  })
  it('filter-meta: DTO как есть', async () => {
    expect(await server({ method: 'GET', url: '/grids/docs/filter-meta' })).toEqual(meta)
  })
  it('400 Problem Details: неизвестное поле, оператор не по типу, размер страницы (§8)', async () => {
    const run = server(post('/grids/docs/search', search({ filter: { conditions: [{ field: 'nope', op: 'EQ', value: 1 }, { field: 'amount', op: 'CONTAINS', value: '1' }] }, page: { number: 0, size: 900 } })))
    await expect(run).rejects.toBeInstanceOf(ApiError)
    const e = await run.catch((x: ApiError) => x)
    expect(e.status).toBe(400)
    expect(e.problem?.type).toBe('urn:vtb:grid:filter-validation')
    expect(e.problem?.errors?.map((x) => x.code)).toEqual(['UNKNOWN_FIELD', 'OPERATOR_NOT_ALLOWED', 'PAGE_SIZE_OUT_OF_RANGE'])
  })
  it('404 на неизвестный грид и маршрут', async () => {
    await expect(server(post('/grids/nope/search', search()))).rejects.toMatchObject({ status: 404 })
    await expect(server({ method: 'GET', url: '/other' })).rejects.toMatchObject({ status: 404 })
  })
  it('регулятор failing: 500 только у названного запроса', async () => {
    const s = createFakeServer({ docs: fakeGrid(rows, columns, meta) }, { failing: () => 'facets' })
    await expect(s(post('/grids/docs/facets', { filter: { conditions: [] }, field: 'status' }))).rejects.toMatchObject({ status: 500 })
    await expect(s(post('/grids/docs/search', search()))).resolves.toBeDefined()
  })
})
```

Run: `pnpm --filter pi test` — FAIL.
- [ ] **Step 2: фильтр.** `filter.ts` — перенос из `apps/demo/src/data/fakeBackend.ts` без изменения семантики:

```ts
import type { Condition, Filter } from '@katran/effector'

const raw = (v: unknown) => (v == null ? '' : String(v))
const str = (v: unknown) => raw(v).toLowerCase()
const isDay = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
/** Дата в условии — день YYYY-MM-DD: сравниваем с первыми 10 знаками ISO-значения записи. */
const dayOf = (v: unknown) => str(v).slice(0, 10)
const num = (v: unknown) => Number(String(v).replace(/\s/g, '').replace(',', '.'))
const cmp = (v: unknown, c: unknown) => (typeof c === 'number' ? num(v) - c : str(v) < str(c) ? -1 : str(v) > str(c) ? 1 : 0)

/** Подмножество семантики контракта (§4.2), достаточное для стенда: EQ/NE для строк — точно, с учётом регистра;
 * CONTAINS/STARTS_WITH/ENDS_WITH — без учёта регистра; числа как числа, даты по дню/ISO-строкой. */
function matches(row: Record<string, unknown>, c: Condition): boolean {
  const v = row[c.field]
  switch (c.op) {
    case 'EQ': return isDay(c.value) ? dayOf(v) === c.value : typeof c.value === 'number' ? num(v) === c.value : raw(v) === raw(c.value)
    case 'NE': return !matches(row, { ...c, op: 'EQ' })
    case 'CONTAINS': return str(v).includes(str(c.value))
    case 'STARTS_WITH': return str(v).startsWith(str(c.value))
    case 'ENDS_WITH': return str(v).endsWith(str(c.value))
    case 'IN': return c.values.map(str).includes(str(v))
    case 'NOT_IN': return !c.values.map(str).includes(str(v))
    case 'IS_EMPTY': return v == null || v === ''
    case 'IS_NOT_EMPTY': return !(v == null || v === '')
    case 'GT': return cmp(v, c.value) > 0
    case 'GTE': return cmp(v, c.value) >= 0
    case 'LT': return cmp(v, c.value) < 0
    case 'LTE': return cmp(v, c.value) <= 0
    case 'BETWEEN': return cmp(v, c.from) >= 0 && cmp(v, c.to) <= 0
  }
}

export const applyFilter = <Row extends Record<string, unknown>>(rows: Row[], f: Filter): Row[] => rows.filter((r) => f.every((c) => matches(r, c)))
```

- [ ] **Step 3: каталог.** `meta.ts`:

```ts
import type { Condition, FilterFieldType } from '@katran/effector'
import type { FieldDto } from '../../shared/api'

/** Операторы по типу поля — таблица 4.3 контракта. */
export const OPS_BY_TYPE: Record<FilterFieldType, Condition['op'][]> = {
  STRING: ['EQ', 'NE', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'IN', 'NOT_IN', 'IS_EMPTY', 'IS_NOT_EMPTY'],
  NUMBER: ['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IN', 'NOT_IN', 'IS_EMPTY', 'IS_NOT_EMPTY'],
  DATE: ['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IS_EMPTY', 'IS_NOT_EMPTY'],
  DATETIME: ['GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IS_EMPTY', 'IS_NOT_EMPTY'],
  ENUM: ['EQ', 'NE', 'IN', 'NOT_IN', 'IS_EMPTY', 'IS_NOT_EMPTY'],
  BOOLEAN: ['EQ', 'IS_EMPTY', 'IS_NOT_EMPTY'],
}

export const field = (id: string, label: string, type: FilterFieldType, dictionary?: string): FieldDto =>
  ({ id, label, type, operators: OPS_BY_TYPE[type], dictionary })

/** Встроенный справочник из словаря подписей: порядок — порядок ключей. */
export const inline = (labels: Record<string, string>) =>
  ({ mode: 'INLINE' as const, items: Object.keys(labels).map((value) => ({ value, label: labels[value]! })) })
```

- [ ] **Step 4: грид.** `grid.ts`:

```ts
import type { Sort } from '@katran/effector'
import { sortRows, type ColumnDef } from '@katran/ui'
import type { FacetsBody, FilterMetaDto, SearchBody, SortDto } from '../../shared/api'
import { applyFilter } from './filter'

/** Один грид фейкового сервера: данные, колонки (ключи сортировки) и каталог. Наружу — только JSON контракта. */
export type FakeGrid = { meta: FilterMetaDto; search: (b: SearchBody) => unknown; facets: (b: FacetsBody) => unknown }

const fromSortDto = (dto: SortDto[]): Sort => dto.map((s) => ({ key: s.field, dir: s.direction === 'ASC' ? 'asc' : 'desc' }))

export function fakeGrid<Row extends Record<string, unknown>>(rows: Row[], columns: ColumnDef<Row>[], meta: FilterMetaDto): FakeGrid {
  const get = (row: Row, key: string) => row[key]
  return {
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
}
```

- [ ] **Step 5: сервер.** `server.ts`:

```ts
import type { Filter } from '@katran/effector'
import { toApiError, type FacetsBody, type FilterMetaDto, type HttpRequest, type Problem, type ProblemError, type SearchBody } from '../../shared/api'
import type { FakeGrid } from './grid'

export type FakeServerOptions = { delayMs?: (() => number) | undefined; failing?: (() => string | null) | undefined }

const ROUTE = /^\/grids\/([^/]+)\/(search|facets|filter-meta)$/
const fail = (status: number, title: string, detail: string): never => {
  const p: Problem = { type: 'urn:katran:fake', title, status, detail }
  throw toApiError(status, p)
}

/** Проверка тела по каталогу — подмножество §8 контракта. */
function validate(meta: FilterMetaDto, conditions: Filter, size: number | null): ProblemError[] {
  const errors: ProblemError[] = []
  conditions.forEach((c, i) => {
    const f = meta.fields.find((x) => x.id === c.field)
    if (!f) errors.push({ path: `filter.conditions[${i}].field`, code: 'UNKNOWN_FIELD', message: `Поле ${c.field} неизвестно` })
    else if (!f.operators.includes(c.op)) errors.push({ path: `filter.conditions[${i}].op`, code: 'OPERATOR_NOT_ALLOWED', message: `Оператор ${c.op} недопустим для поля ${c.field} типа ${f.type}` })
  })
  if (size !== null && (size < 1 || size > 500)) errors.push({ path: 'page.size', code: 'PAGE_SIZE_OUT_OF_RANGE', message: 'Размер страницы — от 1 до 500' })
  return errors
}

/** Обработчик requestFx на контракте vtb-filters: JSON на входе и выходе, ошибки — Problem Details через toApiError, как у настоящего клиента. */
export function createFakeServer(grids: Record<string, FakeGrid>, opts: FakeServerOptions = {}) {
  return async (req: HttpRequest): Promise<unknown> => {
    const delay = opts.delayMs?.() ?? 0
    if (delay > 0) await new Promise((r) => setTimeout(r, delay))
    const m = ROUTE.exec(req.url)
    if (!m) return fail(404, 'Не найдено', `Нет маршрута ${req.method} ${req.url}`)
    const [, gridId = '', op = ''] = m
    const grid = grids[gridId]
    if (!grid) return fail(404, 'Неизвестный грид', gridId)
    if (opts.failing?.() === (op === 'filter-meta' ? 'meta' : op)) return fail(500, 'Сбой сервера', `Регулятор ?fail=${op === 'filter-meta' ? 'meta' : op}`)
    if (op === 'filter-meta') return grid.meta
    const body = req.body as SearchBody | FacetsBody
    const errors = validate(grid.meta, body.filter.conditions, 'page' in body ? body.page.size : null)
    if (errors.length > 0) {
      const p: Problem = { type: 'urn:vtb:grid:filter-validation', title: 'Некорректный фильтр', status: 400, detail: `Ошибок: ${errors.length}`, errors }
      throw toApiError(400, p)
    }
    return op === 'search' ? grid.search(body as SearchBody) : grid.facets(body as FacetsBody)
  }
}
```

`params.ts`:

```ts
import type { FakeServerOptions } from './server'

/** Регуляторы стенда в адресе: ?slow=N — задержка ровно N мс (иначе 0,25–0,65 с); ?fail=search|facets|meta — отказ 500. */
export const browserFakeOptions: FakeServerOptions = {
  delayMs: () => { const slow = new URLSearchParams(location.search).get('slow'); return slow ? Number(slow) : 250 + Math.random() * 400 },
  failing: () => new URLSearchParams(location.search).get('fail'),
}
```

- [ ] **Step 6: запуск.** `pnpm --filter pi test` — PASS; `pnpm check` — зелёный.
- [ ] **Step 7: commit.**

```bash
git add apps/pi/src/app/fake
git commit -m "apps/pi: фейковый сервер на контракте — search, facets, filter-meta, Problem Details, регуляторы"
```

---

### Task 8: Сущности `doc-status` и `fx-doc`, данные и контрактная цепочка

**Files:**
- Create: `apps/pi/src/entities/doc-status/{index.ts,@x/fx-doc.ts,@x/rub-doc.ts,model/status.ts,model/status.test.ts}`
- Create: `apps/pi/src/entities/fx-doc/{index.ts,model/fxDoc.ts,api/fxDoc.mapper.ts,api/fxDoc.mapper.test.ts,api/ports.ts,ui/layout.tsx,ui/cells.module.css}`
- Create: `apps/pi/src/app/fake/{fx-docs.data.ts,grids.ts,contract.test.ts}`, `apps/pi/src/app/transport.ts`

**Interfaces:**
- Consumes: `createGridPorts`, гарды, `requestFx` (`shared/api`); `fakeGrid`, `field`, `inline`, `createFakeServer`, `browserFakeOptions` (Task 7).
- Produces:
  - `entities/doc-status`: `Status`, `STATUSES: readonly Status[]`, `STATUS_LABEL`, `STATUS_TONE`, `laneItems(facets: Facet[], counted: boolean): LaneItem[]`; `@x/fx-doc` и `@x/rub-doc` — `Status`, `STATUSES`, `STATUS_LABEL`, `STATUS_TONE`
  - `entities/fx-doc`: `FxDoc`, `Direction`, `DIRECTIONS`, `DIRECTION_LABEL`, `FX_TYPES`, `CURRENCIES`, `fxDocLayout: RecordLayout<FxDoc>`, `fxDocPorts: GridPorts<FxDoc>`
  - `app/fake/grids.ts`: `fakeGrids: Record<string, FakeGrid>` (`'fx-docs'`; `'rub-docs'` — Task 12)

- [ ] **Step 1: тесты статусов (падают).** `model/status.test.ts`:

```ts
import { laneItems, STATUSES } from './status'

describe('laneItems', () => {
  it('до первого ответа фасетов — без чисел; после — пропущенный статус 0; порядок словаря', () => {
    expect(laneItems([], false).map((x) => x.count)).toEqual(STATUSES.map(() => undefined))
    const items = laneItems([{ value: 'ERROR', count: 3 }], true)
    expect(items.map((x) => x.value)).toEqual([...STATUSES])
    expect(items.find((x) => x.value === 'ERROR')?.count).toBe(3)
    expect(items.find((x) => x.value === 'DONE')?.count).toBe(0)
    expect(items[0]).toMatchObject({ value: 'IN_PROGRESS', label: 'В работе', tone: 'flow' })
  })
})
```

- [ ] **Step 2: статусы.** `model/status.ts` (словари — перенос из `apps/demo/src/data/docs.ts`):

```ts
import type { Facet } from '@katran/effector'
import type { LaneItem, StatusTone } from '@katran/ui'

/** Порядок — порядок лейна (как на эталоне). */
export const STATUSES = ['IN_PROGRESS', 'TO_EXPORT', 'PROCESSING', 'ERROR', 'DEFERRED', 'EXPORTED', 'INVALID', 'REJECTED', 'DONE'] as const
export type Status = (typeof STATUSES)[number]

export const STATUS_LABEL: Record<Status, string> = {
  IN_PROGRESS: 'В работе', TO_EXPORT: 'К экспорту', PROCESSING: 'В обработке', ERROR: 'Ошибка', DEFERRED: 'Отложенный',
  EXPORTED: 'Экспортирован', INVALID: 'Невалидный', REJECTED: 'Отказ', DONE: 'Обработан',
}
/** Тон статусной точки — 4 семейства (основная спека 4.2). */
export const STATUS_TONE: Record<Status, StatusTone> = {
  IN_PROGRESS: 'flow', TO_EXPORT: 'flowl', PROCESSING: 'flowd', ERROR: 'bad', INVALID: 'badd', DEFERRED: 'warn',
  DONE: 'ok', EXPORTED: 'okl', REJECTED: 'grey',
}

/** Лейн из словаря и фасетов: до первого ответа (counted = false) чисел нет, потом отсутствующий статус — 0. */
export const laneItems = (facets: Facet[], counted: boolean): LaneItem[] =>
  STATUSES.map((st) => ({ value: st, label: STATUS_LABEL[st], tone: STATUS_TONE[st], count: counted ? (facets.find((x) => String(x.value) === st)?.count ?? 0) : undefined }))
```

`index.ts`: `export { laneItems, STATUS_LABEL, STATUS_TONE, STATUSES, type Status } from './model/status'`. `@x/fx-doc.ts` и `@x/rub-doc.ts` (одинаковые):

```ts
/** Публичный API doc-status для соседней сущности (FSD @x). */
export { STATUS_LABEL, STATUS_TONE, STATUSES, type Status } from '../model/status'
```

- [ ] **Step 3: тесты маппера (падают).** `api/fxDoc.mapper.test.ts`:

```ts
import { ApiError } from '../../../shared/api'
import { parseFxDoc } from './fxDoc.mapper'

const row = {
  id: 'u1', docNumber: 812345, refIn: 'REF1', refOut: null, uetr: 'x-1', created: '2026-09-23T10:52:11', valueDate: '2026-09-23',
  type: 'MT103', direction: 'IN', dirTxt: 'Входящий от ЦБ', amount: 1500.5, currency: 'USD',
  f50name: 'ООО «Ромашка»', f50acc: '40702840000000000001', purpose: null, f52: 'VKRBRU8KXXX', f57: 'NRDIRUMMXXX',
  f59name: 'АО «Прибой»', f59acc: '40702840000000000002', status: 'ERROR', reason: 'Превышен лимит',
  sender: 'VKRBRU8KXXX', receiver: 'NRDIRUMMXXX', provS: 'LORO', provR: 'NOSTRO',
}

describe('parseFxDoc', () => {
  it('строка контракта → FxDoc', () => { expect(parseFxDoc(row, 'content[0]')).toEqual(row) })
  it('недопустимый статус и не та форма — contractError с путём', () => {
    expect(() => parseFxDoc({ ...row, status: 'NEW' }, 'content[3]')).toThrow('content[3].status: недопустимое значение «NEW»')
    expect(() => parseFxDoc({ ...row, amount: '1 500' }, 'content[0]')).toThrow(ApiError)
  })
})
```

- [ ] **Step 4: модель и маппер.** `model/fxDoc.ts`:

```ts
import type { Status } from '../../doc-status/@x/fx-doc'

export const FX_TYPES = ['MT103', 'MT202', 'MT202COV', 'MT199'] as const
export const CURRENCIES = ['USD', 'EUR', 'CNY', 'RUB'] as const
export const DIRECTIONS = ['IN', 'OUT', 'TRANSIT', 'OTHER'] as const
export type Direction = (typeof DIRECTIONS)[number]
export const DIRECTION_LABEL: Record<Direction, string> = { IN: 'Входящий', OUT: 'Исходящий', TRANSIT: 'Транзит', OTHER: 'Прочее' }

/** Валютный документ в реестре. Имена полей — наш вариант строки content[] (docs/reference/pi-api.md). */
export type FxDoc = {
  id: string; docNumber: number; refIn: string | null; refOut: string | null; uetr: string
  created: string; valueDate: string
  type: (typeof FX_TYPES)[number]
  direction: Direction; dirTxt: string
  amount: number; currency: (typeof CURRENCIES)[number]
  f50name: string; f50acc: string; purpose: string | null
  f52: string; f57: string; f59name: string; f59acc: string
  status: Status; reason: string | null
  sender: string; receiver: string; provS: string; provR: string
}
```

`api/fxDoc.mapper.ts`:

```ts
import { num, obj, oneOf, str, strOrNull } from '../../../shared/api'
import { STATUSES } from '../../doc-status/@x/fx-doc'
import { CURRENCIES, DIRECTIONS, FX_TYPES, type FxDoc } from '../model/fxDoc'

/** Строка бека → FxDoc. Если бек называет поля иначе — правится только этот файл. */
export function parseFxDoc(raw: unknown, path: string): FxDoc {
  const o = obj(raw, path)
  return {
    id: str(o, 'id', path), docNumber: num(o, 'docNumber', path), refIn: strOrNull(o, 'refIn', path), refOut: strOrNull(o, 'refOut', path), uetr: str(o, 'uetr', path),
    created: str(o, 'created', path), valueDate: str(o, 'valueDate', path),
    type: oneOf(o, 'type', FX_TYPES, path),
    direction: oneOf(o, 'direction', DIRECTIONS, path), dirTxt: str(o, 'dirTxt', path),
    amount: num(o, 'amount', path), currency: oneOf(o, 'currency', CURRENCIES, path),
    f50name: str(o, 'f50name', path), f50acc: str(o, 'f50acc', path), purpose: strOrNull(o, 'purpose', path),
    f52: str(o, 'f52', path), f57: str(o, 'f57', path), f59name: str(o, 'f59name', path), f59acc: str(o, 'f59acc', path),
    status: oneOf(o, 'status', STATUSES, path), reason: strOrNull(o, 'reason', path),
    sender: str(o, 'sender', path), receiver: str(o, 'receiver', path), provS: str(o, 'provS', path), provR: str(o, 'provR', path),
  }
}
```

`api/ports.ts`:

```ts
import { createGridPorts } from '../../../shared/api'
import { parseFxDoc } from './fxDoc.mapper'

export const fxDocPorts = createGridPorts({ gridId: 'fx-docs', parseRow: parseFxDoc })
```

- [ ] **Step 5: раскладка.** `ui/layout.tsx` — перенос `docsLayout` из `apps/demo/src/pages/GridPage.tsx` дословно, с заменами: `Doc` → `FxDoc`; `STATUS_TONE`/`STATUS_LABEL` — из `../../doc-status/@x/fx-doc`; `s.srTag` — из `./cells.module.css`; имя — `fxDocLayout`; константа `T = -1` с её комментарием переезжает сюда. После плана 5 брать раскладку из демо в её текущем виде (колонки R1–R16, сквозные строки), а не из этого описания. `ui/cells.module.css`:

```css
.srTag {
  color: var(--k-faint);
  font: 500 var(--k-fs-3) / 1 var(--k-mono);
}
```

`index.ts`:

```ts
export { CURRENCIES, DIRECTION_LABEL, DIRECTIONS, FX_TYPES, type Direction, type FxDoc } from './model/fxDoc'
export { fxDocPorts } from './api/ports'
export { fxDocLayout } from './ui/layout'
```

- [ ] **Step 6: данные и транспорт.** `app/fake/fx-docs.data.ts` — перенос `makeDocs` и словарей `REASONS`, `CCY`, `NAMES`, `BICS`, `PROV`, `rng`, `pick`, `pad`, `acc` из `apps/demo/src/data/docs.ts` дословно (имя — `makeFxDocs`, тип — `FxDoc`, статусы — `Status` из `../../entities/doc-status`), плюс каталог в форме DTO:

```ts
import { DIRECTION_LABEL, CURRENCIES, FX_TYPES } from '../../entities/fx-doc'
import { STATUS_LABEL } from '../../entities/doc-status'
import type { FilterMetaDto } from '../../shared/api'
import { field, inline } from './meta'

const labelsOf = (xs: readonly string[]) => Object.fromEntries(xs.map((x) => [x, x]))
/** То, что бек отдаст в GET /grids/fx-docs/filter-meta (девять полей режима simple). */
export const fxDocsMeta: FilterMetaDto = {
  gridId: 'fx-docs',
  fields: [
    field('docNumber', 'Номер документа', 'NUMBER'),
    field('status', 'Статус', 'ENUM', 'docStatus'),
    field('type', 'Тип сообщения', 'ENUM', 'fxType'),
    field('direction', 'Направление', 'ENUM', 'direction'),
    field('currency', 'Валюта', 'ENUM', 'currency'),
    field('amount', 'Сумма', 'NUMBER'),
    field('created', 'Дата документа', 'DATE'),
    field('f50name', 'Приказодатель', 'STRING'),
    field('f59name', 'Бенефициар', 'STRING'),
  ],
  dictionaries: { docStatus: inline(STATUS_LABEL), fxType: inline(labelsOf(FX_TYPES)), direction: inline(DIRECTION_LABEL), currency: inline(labelsOf(CURRENCIES)) },
}
```

`app/fake/grids.ts`:

```ts
import { fxDocLayout } from '../../entities/fx-doc'
import { fakeGrid, type FakeGrid } from './grid'
import { fxDocsMeta, makeFxDocs } from './fx-docs.data'

export const fakeGrids: Record<string, FakeGrid> = {
  'fx-docs': fakeGrid(makeFxDocs(), fxDocLayout.columns, fxDocsMeta),
}
```

`app/transport.ts`:

```ts
import { requestFx } from '../shared/api'
import { browserFakeOptions } from './fake/params'
import { createFakeServer } from './fake/server'
import { fakeGrids } from './fake/grids'

/** Единственная точка подключения транспорта. Внутри здесь — свой клиент: docs/guides/pi-usage.md. */
requestFx.use(createFakeServer(fakeGrids, browserFakeOptions))
```

- [ ] **Step 7: контрактная цепочка.** `app/fake/contract.test.ts`:

```ts
import { allSettled, fork } from 'effector'
import { fxDocPorts } from '../../entities/fx-doc'
import { ApiError, createGridPorts, requestFx } from '../../shared/api'
import { fakeGrids } from './grids'
import { createFakeServer } from './server'

/** Цепочка «порт → requestFx → сервер». Внутри тот же тест гоняется против своего бека: подставить свой обработчик в handlers. */
const scope = () => fork({ handlers: [[requestFx, createFakeServer(fakeGrids)]] })

describe('контракт fx-docs', () => {
  it('search: фильтр по статусу, сортировка по сумме, страница', async () => {
    const r = await allSettled(fxDocPorts.searchFx, { scope: scope(), params: { filter: [{ field: 'status', op: 'EQ', value: 'ERROR' }], sort: [{ key: 'amount', dir: 'desc' }], page: 0, size: 5 } })
    expect(r.status).toBe('done')
    if (r.status !== 'done') return
    expect(r.value.rows.length).toBeLessThanOrEqual(5)
    expect(r.value.rows.every((d) => d.status === 'ERROR')).toBe(true)
    const amounts = r.value.rows.map((d) => d.amount)
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a))
    expect(r.value.total).toBeGreaterThanOrEqual(r.value.rows.length)
  })
  it('facets и filter-meta', async () => {
    const s = scope()
    const f = await allSettled(fxDocPorts.facetsFx, { scope: s, params: { filter: [], field: 'status' } })
    expect(f.status === 'done' && f.value.reduce((n, x) => n + x.count, 0)).toBe(87)
    const m = await allSettled(fxDocPorts.filterMetaFx, { scope: s })
    expect(m.status === 'done' && m.value.fields.map((x) => x.id)).toEqual(['docNumber', 'status', 'type', 'direction', 'currency', 'amount', 'created', 'f50name', 'f59name'])
  })
  it('400 на недопустимый оператор, 404 на неизвестный грид', async () => {
    const bad = await allSettled(fxDocPorts.searchFx, { scope: scope(), params: { filter: [{ field: 'amount', op: 'CONTAINS', value: '1' }], sort: [], page: 0, size: 20 } })
    expect(bad.status).toBe('fail')
    expect((bad.value as ApiError).problem?.errors?.[0]?.code).toBe('OPERATOR_NOT_ALLOWED')
    const nope = createGridPorts({ gridId: 'nope', parseRow: (x) => x })
    const r = await allSettled(nope.searchFx, { scope: scope(), params: { filter: [], sort: [], page: 0, size: 20 } })
    expect((r.value as ApiError).status).toBe(404)
  })
})
```

- [ ] **Step 8: запуск и проверка границ.** `pnpm --filter pi test` — PASS. Проверка линта на нарушении: временно добавить в `apps/pi/src/entities/fx-doc/api/ports.ts` строку `import '../../doc-status/model/status'` → `pnpm exec eslint apps/pi/src/entities/fx-doc/api/ports.ts` — ошибка «FSD: entities/fx-doc не импортирует соседа doc-status (только через @x)». Убрать строку, повторить — чисто. `pnpm check` — зелёный.
- [ ] **Step 9: commit.**

```bash
git add apps/pi/src/entities apps/pi/src/app/fake apps/pi/src/app/transport.ts
git commit -m "apps/pi: сущности doc-status и fx-doc — порты, маппер, раскладка; данные и контрактные тесты"
```

---

### Task 9: `createRegistry`

**Files:**
- Create: `apps/pi/src/widgets/doc-registry/{index.ts,lib/createRegistry.ts,lib/createRegistry.test.ts}`

**Interfaces:**
- Consumes: `createFiltersModel` со стором `meta` (Task 2), `createGridModel`, `localStoragePersist`, `memoryPersist` (`@katran/effector`); `GridPorts` (Task 5); `PageLifecycle` (Task 4); `RecordLayout` (`@katran/ui`).
- Produces:

```ts
type RegistryConfig<Row> = { id: string; layout: RecordLayout<Row>; ports: GridPorts<Row>; lifecycle: PageLifecycle; pageSize?: number | undefined; persist?: PersistAdapter<Partial<GridPersisted>> | undefined }
type Registry<Row> = {
  filters: FiltersModel; grid: GridModel<Row>; lifecycle: PageLifecycle
  $metaReady: Store<boolean>
  /** Шов деталки (срез 2). */
  openRequested: EventCallable<{ id: string; secondary: boolean }>
  /** Шов внешних действий: перезапросить реестр, если он открыт. */
  refreshRequested: EventCallable<void>
}
createRegistry<Row>(cfg: RegistryConfig<Row>): Registry<Row>
```

- [ ] **Step 1: тесты (падают).** `lib/createRegistry.test.ts`:

```ts
import { allSettled, createEffect, fork } from 'effector'
import { memoryPersist, type Facet, type FacetsQuery, type FilterMeta, type GridPage, type GridQuery } from '@katran/effector'
import type { RecordLayout } from '@katran/ui'
import { ApiError } from '../../../shared/api'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { createRegistry } from './createRegistry'

type Row = { id: string; status: string }
const layout: RecordLayout<Row> = { rowKey: (r) => r.id, columns: [{ id: 'status', render: (r) => r.status }] }

function setup(metaFails = false) {
  const calls = { search: 0, meta: 0 }
  const ports = {
    searchFx: createEffect<GridQuery, GridPage<Row>, ApiError>(async () => { calls.search += 1; return { rows: [{ id: 'a', status: 'DONE' }], total: 1 } }),
    facetsFx: createEffect<FacetsQuery, Facet[], ApiError>(async () => []),
    filterMetaFx: createEffect<void, FilterMeta, ApiError>(async () => { calls.meta += 1; if (metaFails) throw new ApiError(500, null, 'сбой'); return { fields: [] } }),
  }
  const lifecycle = createPageLifecycle()
  const r = createRegistry({ id: 'docs', layout, ports, lifecycle, persist: memoryPersist() })
  return { r, calls, lifecycle, scope: fork() }
}

describe('createRegistry', () => {
  it('pageOpened: запрос реестра и один раз каталог за несколько открытий', async () => {
    const { r, calls, lifecycle, scope } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    expect(calls).toEqual({ search: 1, meta: 1 })
    expect(scope.getState(r.$metaReady)).toBe(true)
    expect(scope.getState(r.filters.$meta)).toEqual({ fields: [] })
    await allSettled(lifecycle.pageClosed, { scope })
    await allSettled(lifecycle.pageOpened, { scope })
    expect(calls).toEqual({ search: 2, meta: 1 })
  })
  it('pageClosed снимает выделение, фильтры и страница остаются', async () => {
    const { r, lifecycle, scope } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(r.filters.setLane, { scope, params: 'ERROR' })
    await allSettled(r.grid.setPage, { scope, params: 2 })
    await allSettled(r.grid.select, { scope, params: { id: 'a', on: true } })
    await allSettled(lifecycle.pageClosed, { scope })
    expect(scope.getState(r.grid.$selection)).toEqual({ mode: 'ids', ids: [] })
    expect(scope.getState(r.filters.$lane)).toBe('ERROR')
    expect(scope.getState(r.grid.$page)).toBe(2)
  })
  it('отказ каталога не трогает грид; повтор при следующем открытии', async () => {
    const { r, calls, lifecycle, scope } = setup(true)
    await allSettled(lifecycle.pageOpened, { scope })
    expect(scope.getState(r.$metaReady)).toBe(false)
    expect(scope.getState(r.grid.$state)).toBe('ready')
    await allSettled(lifecycle.pageOpened, { scope })
    expect(calls.meta).toBe(2)
  })
  it('refreshRequested перезапрашивает только открытый реестр', async () => {
    const { r, calls, lifecycle, scope } = setup()
    await allSettled(r.refreshRequested, { scope })
    expect(calls.search).toBe(0)
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(r.refreshRequested, { scope })
    expect(calls.search).toBe(2)
    await allSettled(lifecycle.pageClosed, { scope })
    await allSettled(r.refreshRequested, { scope })
    expect(calls.search).toBe(2)
  })
})
```

Run: `pnpm --filter pi test` — FAIL.
- [ ] **Step 2: реализация.** `lib/createRegistry.ts`:

```ts
import { combine, createEvent, createStore, sample, type EventCallable, type Store } from 'effector'
import {
  createFiltersModel, createGridModel, localStoragePersist,
  type FilterMeta, type FiltersModel, type GridModel, type GridPersisted, type PersistAdapter,
} from '@katran/effector'
import type { RecordLayout } from '@katran/ui'
import type { GridPorts } from '../../../shared/api'
import type { PageLifecycle } from '../../../shared/lib/lifecycle'

export type RegistryConfig<Row> = {
  /** gridId и ключ настроек грида. */
  id: string
  layout: RecordLayout<Row>
  ports: GridPorts<Row>
  lifecycle: PageLifecycle
  pageSize?: number | undefined
  persist?: PersistAdapter<Partial<GridPersisted>> | undefined
}

export type Registry<Row> = {
  filters: FiltersModel
  grid: GridModel<Row>
  lifecycle: PageLifecycle
  $metaReady: Store<boolean>
  /** Шов деталки (срез 2): страница решает, что открыть. */
  openRequested: EventCallable<{ id: string; secondary: boolean }>
  /** Шов внешних действий (например, аннулирование в деталке): перезапросить реестр, если он открыт. */
  refreshRequested: EventCallable<void>
}

/** Реестр документов: фильтры + грид + фасеты лейна + жизненный цикл экрана. Вызывать на верхнем уровне модуля модели страницы. */
export function createRegistry<Row>(cfg: RegistryConfig<Row>): Registry<Row> {
  const { ports, lifecycle } = cfg
  const $meta = createStore<FilterMeta | null>(null).on(ports.filterMetaFx.doneData, (_, m) => m)
  const $metaReady = $meta.map((m) => m !== null)
  const filters = createFiltersModel({ meta: $meta, laneField: 'status' })
  const grid = createGridModel<Row>({
    id: cfg.id,
    columns: cfg.layout.columns.map((c) => ({ id: c.id, width: c.width })),
    pageSize: cfg.pageSize ?? 20,
    $filter: filters.$conditions,
    fetchFx: ports.searchFx,
    facets: { field: 'status', fetchFx: ports.facetsFx },
    persist: cfg.persist ?? localStoragePersist('katran-pi'),
    rowKey: cfg.layout.rowKey,
  })
  const openRequested = createEvent<{ id: string; secondary: boolean }>()
  const refreshRequested = createEvent<void>()

  // экран открыт: свежие данные; каталог за сессию не меняется — только если его ещё нет и он не грузится
  sample({ clock: lifecycle.pageOpened, target: grid.refresh })
  sample({
    clock: lifecycle.pageOpened,
    source: combine($metaReady, ports.filterMetaFx.pending, (ready, pending) => !ready && !pending),
    filter: Boolean,
    fn: () => undefined,
    target: ports.filterMetaFx,
  })
  // экран закрыт: выделение снимается (массовое действие над невидимыми записями опасно), срез реестра остаётся
  sample({ clock: lifecycle.pageClosed, target: grid.clearSelection })
  // модели статичны после импорта: реакции извне — только пока экран открыт (docs/guides/effector-fsd.md, раздел 4)
  sample({ clock: refreshRequested, filter: lifecycle.$opened, target: grid.refresh })

  return { filters, grid, lifecycle, $metaReady, openRequested, refreshRequested }
}
```

`index.ts`: `export { createRegistry, type Registry, type RegistryConfig } from './lib/createRegistry'`.
- [ ] **Step 3: запуск.** `pnpm --filter pi test` — PASS. Если тест «pageOpened» видит `search: 1` до `pageOpened` — модель грида не должна ходить при создании (основная спека 8.2); разбирать, не подгонять тест.
- [ ] **Step 4: commit.**

```bash
git add apps/pi/src/widgets/doc-registry
git commit -m "apps/pi: createRegistry — фильтры, грид, фасеты, каталог и жизненный цикл экрана"
```

---

### Task 10: `DocRegistry`

**Files:**
- Create: `apps/pi/src/widgets/doc-registry/ui/{DocRegistry.tsx,DocRegistry.module.css,DocRegistry.test.tsx}`
- Modify: `apps/pi/src/widgets/doc-registry/index.ts`

**Interfaces:**
- Consumes: `Registry<Row>` (Task 9), `laneItems` (`entities/doc-status`), `useGrid`, `useFilters`, компоненты `@katran/ui`.
- Produces:

```ts
type BulkAction = { label: string; onClick: (count: number) => void }
type DocRegistryProps<Row> = {
  registry: Registry<Row>; layout: RecordLayout<Row>; title: string
  /** Для объявления открытия: «документ 812345». */
  describe: (row: Row) => string
  note?: string | undefined
  bulkActions?: BulkAction[] | undefined
}
function DocRegistry<Row>(p: DocRegistryProps<Row>): ReactElement
```

- [ ] **Step 1: тесты (падают).** `ui/DocRegistry.test.tsx`:

```tsx
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { createEffect } from 'effector'
import { memoryPersist, type Facet, type FacetsQuery, type FilterMeta, type GridPage, type GridQuery } from '@katran/effector'
import type { RecordLayout } from '@katran/ui'
import { ApiError } from '../../../shared/api'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { renderK } from '../../../shared/lib/test'
import { createRegistry } from '../lib/createRegistry'
import { DocRegistry } from './DocRegistry'

type Row = { id: string; status: string; name: string }
const layout: RecordLayout<Row> = { rowKey: (r) => r.id, columns: [{ id: 'name', title: 'Имя', render: (r) => r.name }] }

function make(opts: { failSearch?: boolean; meta?: FilterMeta | null } = {}) {
  let fail = opts.failSearch ?? false
  const ports = {
    searchFx: createEffect<GridQuery, GridPage<Row>, ApiError>(async () => {
      if (fail) throw new ApiError(500, null, 'Сбой сервера')
      return { rows: [{ id: 'a', status: 'ERROR', name: 'Альфа' }], total: 1 }
    }),
    facetsFx: createEffect<FacetsQuery, Facet[], ApiError>(async () => [{ value: 'ERROR', count: 1 }]),
    filterMetaFx: createEffect<void, FilterMeta, ApiError>(async () => {
      if (opts.meta === null) return new Promise<FilterMeta>(() => {})   // каталог не приходит
      return opts.meta ?? { fields: [{ id: 'name', label: 'Имя', type: 'STRING', ops: [] }] }
    }),
  }
  const lifecycle = createPageLifecycle()
  const registry = createRegistry({ id: `t-${Math.random()}`, layout, ports, lifecycle, persist: memoryPersist() })
  return { registry, lifecycle, heal: () => { fail = false } }
}

describe('DocRegistry', () => {
  it('после pageOpened: заголовок со счётчиком, лейн с фасетами, запись; без нарушений axe', async () => {
    const { registry, lifecycle } = make()
    const { container } = renderK(<DocRegistry registry={registry} layout={layout} title="Валютные документы" describe={(r) => `документ ${r.name}`} />)
    act(() => { lifecycle.pageOpened() })
    expect(await screen.findByText('Альфа')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Валютные документы/ })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Статусы' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: /Ошибка/ })).toHaveTextContent('1'))
    expect(await axe(container)).toHaveNoViolations()
  })
  it('пока каталога нет — кнопка «Фильтры» недоступна, лейн работает', async () => {
    const { registry, lifecycle } = make({ meta: null })
    renderK(<DocRegistry registry={registry} layout={layout} title="Реестр" describe={(r) => r.name} />)
    act(() => { lifecycle.pageOpened() })
    await screen.findByText('Альфа')
    expect(screen.getByRole('button', { name: 'Фильтры' })).toBeDisabled()
  })
  it('ошибка запроса — alert с текстом ApiError; «Повторить» снимает', async () => {
    const { registry, lifecycle, heal } = make({ failSearch: true })
    renderK(<DocRegistry registry={registry} layout={layout} title="Реестр" describe={(r) => r.name} />)
    act(() => { lifecycle.pageOpened() })
    expect(await screen.findByRole('alert')).toHaveTextContent('Сбой сервера')
    heal()
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByText('Альфа')).toBeInTheDocument()
  })
})
```

Run: `pnpm --filter pi test` — FAIL.
- [ ] **Step 2: реализация.** `ui/DocRegistry.tsx` — перенос разметки `GridPage` из демо (без блока «Сквозные строки записи: как это управляется» и подсветки сегментов — это обучающая часть демо, не продукта):

```tsx
import { useState } from 'react'
import { useFilters, useGrid } from '@katran/effector'
import { BulkBar, Button, Counter, DataGrid, FilterPanel, StatusLane, useKatran, type RecordLayout } from '@katran/ui'
import { useUnit } from 'effector-react'
import { laneItems } from '../../../entities/doc-status'
import type { Registry } from '../lib/createRegistry'
import s from './DocRegistry.module.css'

export type BulkAction = { label: string; onClick: (count: number) => void }
export type DocRegistryProps<Row> = {
  registry: Registry<Row>
  layout: RecordLayout<Row>
  title: string
  /** Для объявления открытия: «документ 812345». */
  describe: (row: Row) => string
  note?: string | undefined
  bulkActions?: BulkAction[] | undefined
}

/** Экран реестра документов: заголовок, лейн статусов, панель фильтров, грид, полоса массовых действий. */
export function DocRegistry<Row>({ registry, layout, title, describe, note, bulkActions = [] }: DocRegistryProps<Row>) {
  const g = useGrid(registry.grid)
  const f = useFilters(registry.filters)
  const openRequested = useUnit(registry.openRequested)
  const { announce } = useKatran()
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Фасеты ещё не приходили — лейн без чисел, а не с нулями; флаг не сбрасывается, дальше пустой ответ — это нули.
  const [counted, setCounted] = useState(false)
  if (!counted && g.facets.length > 0) setCounted(true)
  const selected = g.selection.mode === 'all' ? g.total - g.selection.except.length : g.selection.ids.length
  return (
    <div className={s.page}>
      <div className={s.head}>
        <h1 className={s.h1}>{title}{' '}<span className={s.h1Counter}><Counter value={g.total} /></span></h1>
        {note && <p className={s.note}>{note}</p>}
        <div className={s.lane}><StatusLane label="Статусы" items={laneItems(g.facets, counted)} value={f.lane} onChange={f.setLane} /></div>
        <div className={s.filters}>
          {f.meta
            ? <FilterPanel meta={f.meta} conditions={f.conditions} draft={f.draft} dirty={f.dirty} open={filtersOpen} onOpenChange={setFiltersOpen}
                onEdit={f.edit} onDiscard={f.discard} onApply={f.apply} onRevert={f.revert} onReset={f.reset} onRemove={f.remove} />
            : <Button size="s" disabled>Фильтры</Button>}
        </div>
      </div>
      <DataGrid
        {...g}
        label={title}
        layout={layout}
        pageSizes={[20, 50]}
        emptyAction={{ label: 'Сбросить фильтр', onClick: () => f.reset() }}
        onOpen={(row, { secondary }) => {
          openRequested({ id: layout.rowKey(row), secondary })
          announce(`Открыт ${describe(row)}${secondary ? ' — второй drawer рядом' : ''}`)
        }}
        toolbar={
          <BulkBar selection={g.selection} total={g.total} onClear={g.onClearSelection} onSelectAll={g.onSelectAll}>
            {bulkActions.map((a) => <Button key={a.label} size="s" onClick={() => a.onClick(selected)}>{a.label}</Button>)}
          </BulkBar>
        }
      />
    </div>
  )
}
```

(eslint запрещает `effector-react` вне разрешённых мест — `apps/pi` разрешён в Task 4 Step 2.) `ui/DocRegistry.module.css` — перенос `.h1`, `.h1Counter`, `.note`, `.gridPage` → `.page`, `.gridHead` → `.head`, `.lane`, `.filters` из `apps/demo/src/pages/Page.module.css` дословно (с комментариями). `index.ts` дополнить: `export { DocRegistry, type BulkAction, type DocRegistryProps } from './ui/DocRegistry'`.
- [ ] **Step 3: запуск.** `pnpm --filter pi test` — PASS. Если `findByRole('alert')` не дожидается — скелетон держится минимум 400 мс (STATE §3): поднять таймаут `findByRole(…, {}, { timeout: 2000 })`, не фейковые таймеры.
- [ ] **Step 4: commit.**

```bash
git add apps/pi/src/widgets/doc-registry
git commit -m "apps/pi: DocRegistry — экран реестра из демо поверх createRegistry"
```

---

### Task 11: Страница «Валютные документы», приложение, перенос из демо

**Files:**
- Create: `apps/pi/src/pages/fx-docs/{index.ts,model/registry.model.ts,ui/FxDocsPage.tsx}`
- Create: `apps/pi/src/app/{App.tsx,Shell.tsx,Shell.module.css,routes.ts}`; Modify: `apps/pi/src/app/entry.tsx`
- Create: `apps/pi/playwright.config.ts`, `apps/pi/e2e/geometry.spec.ts`
- Delete: `apps/demo/src/pages/GridPage.tsx`, `apps/demo/src/data/`, `apps/demo/e2e/`, `apps/demo/playwright.config.ts`
- Modify: `apps/demo/src/App.tsx`, `apps/demo/src/router.ts`, `apps/demo/src/Shell.tsx`, `apps/demo/src/pages/Page.module.css`, `apps/demo/package.json`, `.github/workflows/pages.yml` (переменная `VITE_PI_URL`)

**Interfaces:**
- Consumes: `createRegistry`, `DocRegistry` (Task 9–10); `fxDocLayout`, `fxDocPorts`, `FxDoc` (Task 8); `createPageLifecycle` (Task 4).
- Produces: `pages/fx-docs` → `FxDocsPage`, `lifecycle`; `app/routes.ts` → `Route`, `routes`, `startRouting(onRoute): () => void`.

- [ ] **Step 1: модель и страница.** `pages/fx-docs/model/registry.model.ts`:

```ts
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { createRegistry } from '../../../widgets/doc-registry'
import { fxDocLayout, fxDocPorts } from '../../../entities/fx-doc'

export const lifecycle = createPageLifecycle()
export const registry = createRegistry({ id: 'fx-docs', layout: fxDocLayout, ports: fxDocPorts, lifecycle })
```

`pages/fx-docs/ui/FxDocsPage.tsx`:

```tsx
import { useKatran } from '@katran/ui'
import { fxDocLayout } from '../../../entities/fx-doc'
import { DocRegistry } from '../../../widgets/doc-registry'
import { registry } from '../model/registry.model'

export function FxDocsPage() {
  const { announce } = useKatran()
  return (
    <DocRegistry
      registry={registry}
      layout={fxDocLayout}
      title="Валютные документы"
      describe={(d) => `документ ${d.docNumber}`}
      note="87 валютных документов на фейковом сервере с задержкой 0,25–0,65 с. Запись не кликабельна — деталку открывает кнопка; двойной клик — второй документ рядом. Tab попадает в сетку один раз, дальше — стрелки; Enter на ячейке — копировать/открыть."
      bulkActions={[
        { label: 'Экспортировать', onClick: (n) => announce(`Экспорт: выбрано ${n}`) },
        { label: 'Отложить', onClick: (n) => announce(`Отложить: выбрано ${n}`) },
      ]}
    />
  )
}
```

`pages/fx-docs/index.ts`: `export { FxDocsPage } from './ui/FxDocsPage'` и `export { lifecycle } from './model/registry.model'`.
- [ ] **Step 2: роутинг.** `app/routes.ts`:

```ts
import type { PageLifecycle } from '../shared/lib/lifecycle'
import { lifecycle as fxDocs } from '../pages/fx-docs'

/** Hash-роутер стенда. Внутри вместо него — адаптер к роутеру хоста: на вход экрана pageOpened, на уход pageClosed. */
export type Route = 'fx-docs'
export const routes: { id: Route; title: string }[] = [{ id: 'fx-docs', title: 'Валютные документы' }]
const lifecycles: Record<Route, PageLifecycle> = { 'fx-docs': fxDocs }

export const parseRoute = (): Route => {
  const h = location.hash.replace(/^#\/?/, '')
  return routes.find((r) => r.id === h)?.id ?? 'fx-docs'
}

export function startRouting(onRoute: (r: Route) => void): () => void {
  let current: Route | null = null
  const go = () => {
    const next = parseRoute()
    if (next === current) return
    if (current) lifecycles[current].pageClosed()
    current = next
    lifecycles[next].pageOpened()
    onRoute(next)
  }
  window.addEventListener('hashchange', go)
  go()
  return () => {
    window.removeEventListener('hashchange', go)
    if (current) lifecycles[current].pageClosed()
    current = null
  }
}
```

`app/Shell.tsx` и `Shell.module.css` — копии демо, с заменами: `brand` — «katran · ПИ», импорт `routes`/`Route` из `./routes`. `app/App.tsx`:

```tsx
import { useEffect, useState, type ComponentType } from 'react'
import { KatranProvider } from '@katran/ui'
import { FxDocsPage } from '../pages/fx-docs'
import { Shell } from './Shell'
import { parseRoute, startRouting, type Route } from './routes'

const pages: Record<Route, ComponentType> = { 'fx-docs': FxDocsPage }

export function App() {
  const [route, setRoute] = useState<Route>(parseRoute)
  useEffect(() => startRouting(setRoute), [])
  const Page = pages[route]
  return (
    <KatranProvider storageKey="katran-pi">
      <Shell route={route}><Page /></Shell>
    </KatranProvider>
  )
}
```

`app/entry.tsx`:

```tsx
import { createRoot } from 'react-dom/client'
import '@katran/tokens/fonts.css'
import './transport'
import { App } from './App'

createRoot(document.getElementById('root')!).render(<App />)
```

- [ ] **Step 3: e2e.** `apps/pi/playwright.config.ts` — копия демо с портом `5186`. `apps/pi/e2e/geometry.spec.ts` — перенос `apps/demo/e2e/geometry.spec.ts` с заменой `'/#/grid'` → `'/#/fx-docs'` и `'/?slow=3000#/grid'` → `'/?slow=3000#/fx-docs'`.

Run: `pnpm --filter pi e2e` — 3/3 PASS, те же числа, что у демо до переноса (STATE §6: запись 68, шапка 49, скелетон 68, 125 % → 84.75 — или числа после плана 5).
- [ ] **Step 4: убрать экран из демо.** Удалить `apps/demo/src/pages/GridPage.tsx`, `apps/demo/src/data/`, `apps/demo/e2e/`, `apps/demo/playwright.config.ts`; из `apps/demo/package.json` — скрипт `e2e` и `@playwright/test`. В `router.ts` убрать маршрут `grid`; в `App.tsx` — импорт и запись `grid`. В `Shell.tsx` после `<nav>` добавить:

```tsx
        <a className={s.link} href={import.meta.env.VITE_PI_URL ?? 'http://localhost:5185/'}>Реестры ПИ →</a>
```

В `Page.module.css` удалить правила `.gridPage`, `.gridHead`, `.lane`, `.filters`, `.explain*`, `.code`, `.hlSpans …`, `.srTag`, `.h1Counter` (перенесены или больше не нужны; `rg -n "gridPage|h1Counter|srTag|explain|hlSpans" apps/demo/src` — пусто). В `.github/workflows/pages.yml` у шага сборки демо: `run: PAGES_BASE=/katran/ VITE_PI_URL=/katran/pi/ pnpm --filter demo build`.
- [ ] **Step 5: запуск.** `pnpm check` — зелёный; `pnpm --filter pi e2e` — зелёный. Проверка в браузере: preview-конфигурация `pi` в `/Users/shaman/_CODE/VTB/.claude/launch.json` (`pnpm --dir katran --filter pi dev`, порт 5185; файл откатывается из `.bak` — добавить запись и в `.bak`, свои временные записи удалять точечно) → реестр грузится, лейн с числами, «Фильтры» открываются после каталога, `?fail=search` — ошибка и «Повторить», `?fail=meta` — кнопка «Фильтры» недоступна, консоль чистая.
- [ ] **Step 6: commit.**

```bash
git add apps/pi apps/demo .github/workflows/pages.yml
git commit -m "apps/pi: экран «Валютные документы» переехал из демо; роутер вызывает жизненный цикл страниц"
```

---

### Task 12: Рублёвый реестр

Начинать после решений владельца по Task 1 Step 4. Решения класса B, принятые «перенести», входят в эту задачу: дополнить раскладку и тип по таблице сверки.

**Files:**
- Create: `apps/pi/src/entities/rub-doc/{index.ts,model/rubDoc.ts,api/rubDoc.mapper.ts,api/rubDoc.mapper.test.ts,api/ports.ts,ui/layout.tsx,ui/cells.module.css}`
- Create: `apps/pi/src/app/fake/rub-docs.data.ts`; Modify: `apps/pi/src/app/fake/grids.ts`, `apps/pi/src/app/fake/contract.test.ts`
- Create: `apps/pi/src/pages/rub-docs/{index.ts,model/registry.model.ts,ui/RubDocsPage.tsx}`
- Modify: `apps/pi/src/app/routes.ts`, `apps/pi/src/app/App.tsx`, `apps/pi/e2e/geometry.spec.ts`

**Interfaces:**
- Consumes: всё из Task 4–11; `AccountValue` с `tail` (Task 3).
- Produces: `entities/rub-doc` → `RubDoc`, `RUB_TYPES`, `ED_BY_TYPE`, `TYPE_NAME`, `rubDocLayout`, `rubDocPorts`; `pages/rub-docs` → `RubDocsPage`, `lifecycle`; маршрут `rub-docs`.

- [ ] **Step 1: тесты маппера и данных (падают).** `api/rubDoc.mapper.test.ts`:

```ts
import { parseRubDoc } from './rubDoc.mapper'

const row = {
  id: 'r1', docNumber: '2900', uuid: '00e-1', txId: 'TX1', docRef: 'DR1', created: '2026-09-22T07:00:00', changed: '2026-09-22T08:13:00',
  type: 'PAYDOCRU', edCode: 'ED101', direction: 'IN', dirTxt: 'входящий от ЦБ на клиента', amount: 54.05, queue: 5, prio: 0,
  fromName: 'АО «МЕФЯ ФОТЕ»', fromAcc: '40702810547442693048', fromInn: '1265428092', fromKpp: '409490573', fromBic: '049757384', fromBank: 'АО «МУЛАПЯ БАНК»',
  toName: 'АО «ЗАГЕЛУ МЯТА»', toAcc: '40702810296328313510', toInn: '8298199680', toKpp: '464601040', toBic: '042242532', toBank: 'ФИЛИАЛ № 8771 БАНКА «ТЯПЯ» (ПАО)',
  initiator: 'NCB.NCB_IN', source: 'UFX', destination: 'RTL', purpose: 'Оплата по счёту', status: 'DONE', reason: null,
}

describe('parseRubDoc', () => {
  it('строка контракта → RubDoc', () => { expect(parseRubDoc(row, 'content[0]')).toEqual(row) })
  it('код ЭС вне ED101/ED104/ED105 — ошибка контракта', () => {
    expect(() => parseRubDoc({ ...row, edCode: 'ED999' }, 'content[0]')).toThrow('content[0].edCode: недопустимое значение «ED999»')
  })
})
```

В `app/fake/contract.test.ts` добавить:

```ts
import { rubDocPorts } from '../../entities/rub-doc'
import { makeRubDocs } from './rub-docs.data'

describe('контракт rub-docs', () => {
  it('search и filter-meta (10 полей)', async () => {
    const s = scope()
    const r = await allSettled(rubDocPorts.searchFx, { scope: s, params: { filter: [{ field: 'queue', op: 'EQ', value: '5' }], sort: [], page: 0, size: 20 } })
    expect(r.status === 'done' && r.value.rows.every((d) => d.queue === 5)).toBe(true)
    const m = await allSettled(rubDocPorts.filterMetaFx, { scope: s })
    expect(m.status === 'done' && m.value.fields).toHaveLength(10)
  })
  it('данные валидны: счёт 20 цифр, у клиентских 810 в знаках 6–8; БИК 9; ИНН 10/12; КПП 9 или пусто', () => {
    for (const d of makeRubDocs()) {
      for (const acc of [d.fromAcc, d.toAcc]) {
        expect(acc).toMatch(/^\d{20}$/)
        if (/^40[5-8]/.test(acc)) expect(acc.slice(5, 8)).toBe('810')
      }
      for (const bic of [d.fromBic, d.toBic]) expect(bic).toMatch(/^\d{9}$/)
      for (const inn of [d.fromInn, d.toInn]) expect(inn).toMatch(/^(\d{10}|\d{12})$/)
      for (const kpp of [d.fromKpp, d.toKpp]) expect(kpp).toMatch(/^(\d{9}|0?)$/)
    }
  })
})
```

- [ ] **Step 2: модель, маппер, порты.** `model/rubDoc.ts`:

```ts
import type { Status } from '../../doc-status/@x/rub-doc'

export const RUB_TYPES = ['PAYDOCRU', 'REQDOCRU', 'PAYORDRU'] as const
export type RubType = (typeof RUB_TYPES)[number]
export const ED_CODES = ['ED101', 'ED104', 'ED105'] as const
export const ED_BY_TYPE: Record<RubType, (typeof ED_CODES)[number]> = { PAYDOCRU: 'ED101', REQDOCRU: 'ED104', PAYORDRU: 'ED105' }
export const TYPE_NAME: Record<RubType, string> = { PAYDOCRU: 'Платёжное поручение', REQDOCRU: 'Инкассовое поручение', PAYORDRU: 'Платёжный ордер' }
export const RUB_DIRECTIONS = ['IN', 'OUT', 'TRANSIT', 'OTHER'] as const

/** Рублёвый документ в реестре. Имена полей — наш вариант строки content[] (docs/reference/pi-api.md). */
export type RubDoc = {
  id: string; docNumber: string; uuid: string; txId: string; docRef: string
  created: string; changed: string
  type: RubType; edCode: (typeof ED_CODES)[number]
  direction: (typeof RUB_DIRECTIONS)[number]; dirTxt: string
  amount: number; queue: number; prio: 0 | 1
  fromName: string; fromAcc: string; fromInn: string; fromKpp: string; fromBic: string; fromBank: string
  toName: string; toAcc: string; toInn: string; toKpp: string; toBic: string; toBank: string
  initiator: string; source: string; destination: string
  purpose: string; status: Status; reason: string | null
}
```

`api/rubDoc.mapper.ts`:

```ts
import { contractError, num, obj, oneOf, str, strOrNull } from '../../../shared/api'
import { STATUSES } from '../../doc-status/@x/rub-doc'
import { ED_CODES, RUB_DIRECTIONS, RUB_TYPES, type RubDoc } from '../model/rubDoc'

/** Строка бека → RubDoc. Если бек называет поля иначе — правится только этот файл. */
export function parseRubDoc(raw: unknown, path: string): RubDoc {
  const o = obj(raw, path)
  const s = (k: string) => str(o, k, path)
  const prio = num(o, 'prio', path)
  if (prio !== 0 && prio !== 1) throw contractError(`${path}.prio: ожидалось 0 или 1`)
  return {
    id: s('id'), docNumber: s('docNumber'), uuid: s('uuid'), txId: s('txId'), docRef: s('docRef'),
    created: s('created'), changed: s('changed'),
    type: oneOf(o, 'type', RUB_TYPES, path), edCode: oneOf(o, 'edCode', ED_CODES, path),
    direction: oneOf(o, 'direction', RUB_DIRECTIONS, path), dirTxt: s('dirTxt'),
    amount: num(o, 'amount', path), queue: num(o, 'queue', path), prio,
    fromName: s('fromName'), fromAcc: s('fromAcc'), fromInn: s('fromInn'), fromKpp: s('fromKpp'), fromBic: s('fromBic'), fromBank: s('fromBank'),
    toName: s('toName'), toAcc: s('toAcc'), toInn: s('toInn'), toKpp: s('toKpp'), toBic: s('toBic'), toBank: s('toBank'),
    initiator: s('initiator'), source: s('source'), destination: s('destination'),
    purpose: s('purpose'), status: oneOf(o, 'status', STATUSES, path), reason: strOrNull(o, 'reason', path),
  }
}
```

`api/ports.ts`: `export const rubDocPorts = createGridPorts({ gridId: 'rub-docs', parseRow: parseRubDoc })` (импорты — как у `fx-doc`).
- [ ] **Step 3: данные.** `app/fake/rub-docs.data.ts`: словари `RNAMES`, `RBANKS`, `RPURP`, `RTYPES`, `STS`, `REASONS`, `REASON_BY_ST`, `DIRS`, `SYS` — дословно из `/Users/shaman/_CODE/VTB/pi-constructor/rub-grid.tpl.html` на хеше эталона (Task 1; на 28.09 — строки 250–289), переведённые в `const` с типами. Генератор:

```ts
import type { RubDoc } from '../../entities/rub-doc'
import { ED_BY_TYPE } from '../../entities/rub-doc'
import type { Status } from '../../entities/doc-status'

const pad = (n: number, w: number) => String(n).padStart(w, '0')
/** 87 рублёвых документов по схеме генератора стенда (rub-grid.tpl.html): индексы словарей — те же, данные вымышленные. */
export function makeRubDocs(n = 87): RubDoc[] {
  return Array.from({ length: n }, (_, i) => {
    const [fromName, fromAcc, fromInn, fromKpp] = RNAMES[i % 8]!
    const [toName, toAcc, toInn, toKpp] = RNAMES[(i + 3) % 8]!
    const [fromBank, fromBic] = RBANKS[i % 6]!
    const [toBank, toBic] = RBANKS[(i + 1) % 6]!
    const k = i % 12
    const type = RTYPES[k]!
    const status: Status = i % 29 === 5 ? 'INVALID' : STS[k]!
    const rs = REASON_BY_ST[status]
    const [direction, dirTxt] = DIRS[k]!
    const [initiator, source, destination] = SYS[i % 6]!
    const day = 22 + (k > 7 ? 1 : 0)
    const hh = 7 + (i * 3) % 11
    return {
      id: `rub-${pad(i, 4)}`, docNumber: String(2900 + i * 3), uuid: `${pad(i, 2)}e0c7a2-5b1d-4c8e-9f0a-${pad(i * 7919, 12)}`,
      txId: `TX${pad(i * 131, 8)}`, docRef: `DR2026${pad(i, 5)}`,
      created: `2026-09-${day}T${pad(hh, 2)}:${pad((i * 17) % 60, 2)}:${pad((i * 7) % 60, 2)}`,
      changed: `2026-09-${day + (i % 9 === 4 ? 1 : 0)}T${pad(Math.min(23, hh + (i % 3)), 2)}:${pad((i * 29) % 60, 2)}:00`,
      type, edCode: ED_BY_TYPE[type], direction, dirTxt,
      amount: Math.round(((i * 7919) % 250_000_000) + 5405) / 100, queue: 1 + (i * 5) % 5, prio: i % 7 === 3 ? 1 : 0,
      fromName, fromAcc, fromInn, fromKpp, fromBic, fromBank, toName, toAcc, toInn, toKpp, toBic, toBank,
      initiator, source, destination, purpose: RPURP[i % RPURP.length]!,
      status, reason: rs ? REASONS[rs[i % rs.length]!]! : null,
    }
  })
}
```

Проверить по стенду: порядок полей в `RNAMES` — `[наименование, счёт, ИНН, КПП]`, в `RBANKS` — `[наименование, БИК, корсчёт]`; если на хеше эталона иначе — поправить деструктуризацию. Каталог DTO (10 полей, спека §8.2):

```ts
export const rubDocsMeta: FilterMetaDto = {
  gridId: 'rub-docs',
  fields: [
    field('docNumber', 'Номер документа', 'STRING'),
    field('status', 'Статус', 'ENUM', 'docStatus'),
    field('type', 'Тип документа', 'ENUM', 'rubType'),
    field('direction', 'Группа направления', 'ENUM', 'direction'),
    field('amount', 'Сумма', 'NUMBER'),
    field('queue', 'Очерёдность', 'ENUM', 'queue'),
    field('created', 'Дата создания', 'DATE'),
    field('fromName', 'Наименование отправителя', 'STRING'),
    field('toName', 'Наименование получателя', 'STRING'),
    field('toInn', 'ИНН получателя', 'STRING'),
  ],
  dictionaries: {
    docStatus: inline(STATUS_LABEL), rubType: inline(TYPE_NAME),
    direction: inline({ IN: 'IN', OUT: 'OUT', TRANSIT: 'TRANSIT', OTHER: 'OTHER' }),
    queue: inline({ 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' }),
  },
}
```

(`queue` в строке — число, в справочнике — строка: фейковый `EQ` сравнивает строкой `raw(v) === raw(c.value)` — совпадает. В `grids.ts` добавить `'rub-docs': fakeGrid(makeRubDocs(), rubDocLayout.columns, rubDocsMeta)`.)
- [ ] **Step 4: раскладка.** `ui/layout.tsx` — колонки и сквозные строки по спеке §8.2 и таблице сверки Task 1; ячейки собираются из тех же компонентов, что у `fx-doc` (`StatusDot` без `letter`, `CopyValue`, `LinkValue`, `Tag`, `AccountValue`). Каркас:

```tsx
import { AccountValue, CopyValue, LinkValue, StatusDot, Tag, formatAmount, formatDateTimeShort, type RecordLayout } from '@katran/ui'
import { STATUS_LABEL, STATUS_TONE } from '../../doc-status/@x/rub-doc'
import type { RubDoc } from '../model/rubDoc'
import s from './cells.module.css'

const T = -1 // интерактив внутри ячеек — вне таб-порядка, до него доходят через Enter на ячейке
const party = (acc: string, name: string) => <><AccountValue value={acc} tail={3} tabIndex={T} /><div><CopyValue value={name} tone="ink2" tabIndex={T} /></div></>
const bank = (bic: string, name: string) => <><CopyValue value={bic} tone="mono" tabIndex={T} /><div><CopyValue value={name} tone="ink2" tabIndex={T} /></div></>

export const rubDocLayout: RecordLayout<RubDoc> = {
  rowKey: (d) => d.id,
  columns: [
    { id: 'status', menuTitle: 'Статус', width: 44, sort: [{ id: 'status', label: 'Статус' }, { id: 'reason', label: 'Причина статуса' }],
      render: (d) => <StatusDot tone={STATUS_TONE[d.status]} label={STATUS_LABEL[d.status]} /> },
    { id: 'id', title: 'ID', subtitle: '№ · uuid / txId / docRef', width: 130, lines: 2, sort: [{ id: 'docNumber', label: 'Номер документа' }],
      render: (d) => <><CopyValue value={d.docNumber} tabIndex={T} /><div><LinkValue name="uuid" value={d.uuid} tabIndex={T} /> <LinkValue name="txId" value={d.txId} tabIndex={T} /> <LinkValue name="docRef" value={d.docRef} tabIndex={T} /></div></> },
    { id: 'created', title: 'Дата / Время', width: 110, lines: 2, sort: [{ id: 'created', label: 'Дата создания', type: 'date' }, { id: 'changed', label: 'Дата изменения', type: 'date' }],
      render: (d) => <><CopyValue value={formatDateTimeShort(d.created)} tone="ink" tabIndex={T} /><div><span className={s.srTag}>Изм.</span> <CopyValue value={formatDateTimeShort(d.changed)} tone="ink2" tabIndex={T} /></div></> },
    { id: 'type', title: 'Тип', width: 100, lines: 2, sort: [{ id: 'type', label: 'Тип документа' }, { id: 'edCode', label: 'Код ЭС' }],
      render: (d) => <><Tag>{d.type}</Tag><div><CopyValue value={d.edCode} tone="mono" tabIndex={T} /></div></> },
    { id: 'direction', title: 'Направление', width: 150, lines: 2, sort: [{ id: 'direction', label: 'Группа → название', order: ['IN', 'OUT', 'TRANSIT', 'OTHER'], then: 'dirTxt' }, { id: 'dirTxt', label: 'Название' }],
      render: (d) => <><CopyValue value={d.direction} tone="mono" tabIndex={T} /><div><CopyValue value={d.dirTxt} tone="ink2" tabIndex={T} /></div></> },
    { id: 'amount', title: 'Сумма', subtitle: 'RUB', width: 120, align: 'right', sort: [{ id: 'amount', label: 'Сумма', type: 'number' }],
      render: (d) => <CopyValue value={formatAmount(d.amount)} tone="ink" tabIndex={T} /> },
    { id: 'from', title: 'Отправитель', width: 170, lines: 2, sort: [{ id: 'fromName', label: 'Наименование' }, { id: 'fromAcc', label: 'Счёт' }], render: (d) => party(d.fromAcc, d.fromName) },
    { id: 'to', title: 'Получатель', width: 170, lines: 2, sort: [{ id: 'toName', label: 'Наименование' }, { id: 'toAcc', label: 'Счёт' }], render: (d) => party(d.toAcc, d.toName) },
    { id: 'fromBank', title: 'Банк отправителя', width: 150, lines: 2, sort: [{ id: 'fromBic', label: 'БИК' }, { id: 'fromBank', label: 'Банк' }], render: (d) => bank(d.fromBic, d.fromBank) },
    { id: 'toBank', title: 'Банк получателя', width: 150, lines: 2, sort: [{ id: 'toBic', label: 'БИК' }, { id: 'toBank', label: 'Банк' }], render: (d) => bank(d.toBic, d.toBank) },
    { id: 'systems', title: 'Системы', subtitle: 'I · S · D', width: 120, lines: 3, sort: [{ id: 'initiator', label: 'Initiator' }, { id: 'source', label: 'Source' }, { id: 'destination', label: 'Destination' }],
      render: (d) => <>{([['I', d.initiator], ['S', d.source], ['D', d.destination]] as const).map(([k, v]) => <div key={k}><span className={s.srTag}>{k}:</span> <CopyValue value={v} tone="mono" tabIndex={T} /></div>)}</> },
    { id: 'queue', title: 'Очерёдн.', width: 80, lines: 2, sort: [{ id: 'queue', label: 'Очерёдность', type: 'number' }, { id: 'prio', label: 'Приоритет', type: 'number' }],
      render: (d) => <><CopyValue value={String(d.queue)} tone="mono" tabIndex={T} />{d.prio === 1 && <div><Tag tone="bad">СРОЧНО</Tag></div>}</> },
  ],
  spans: [[
    { id: 'reason', from: 'status', to: 'created', render: (d) => (d.reason ? <CopyValue value={d.reason} tone="ink2" tabIndex={T} /> : null) },
    { id: 'purpose', from: 'from', to: 'toBank', render: (d) => <><span className={s.srTag} title="Назначение платежа">НАЗН.</span> <CopyValue value={d.purpose} tone="ink2" tabIndex={T} /></> },
  ]],
}
```

Ширины, `lines` и вид ячеек сверить с эталоном в браузере и с таблицей сверки; `Tag tone` — проверить допустимые тона в `packages/ui/src/value/Tag.tsx` и взять ближайший к «СРОЧНО» на эталоне. `cells.module.css` — как у `fx-doc`. `index.ts`:

```ts
export { ED_BY_TYPE, ED_CODES, RUB_TYPES, TYPE_NAME, type RubDoc, type RubType } from './model/rubDoc'
export { rubDocPorts } from './api/ports'
export { rubDocLayout } from './ui/layout'
```

- [ ] **Step 5: страница и маршрут.** `pages/rub-docs` — как `fx-docs` (Task 11 Step 1) с заменами: `rubDocLayout`, `rubDocPorts`, `id: 'rub-docs'`, заголовок «Рублёвые документы», `describe={(d) => \`документ ${d.docNumber}\`}`, `note` — «87 рублёвых документов на фейковом сервере…» (текст как у валютного). `routes.ts`: `Route = 'fx-docs' | 'rub-docs'`, запись `{ id: 'rub-docs', title: 'Рублёвые документы' }`, `lifecycles['rub-docs']`. `App.tsx`: `pages['rub-docs'] = RubDocsPage`.
- [ ] **Step 6: e2e.** В `e2e/geometry.spec.ts` обернуть три теста в `for (const route of ['fx-docs', 'rub-docs'])` (имя теста — с маршрутом) и добавить для рублёвого сравнение с замером эталона Task 1: `expect(Math.abs(record - <запись эталона>)).toBeLessThanOrEqual(4)`.

Run: `pnpm --filter pi test && pnpm --filter pi e2e` — PASS; `pnpm check` — зелёный.
- [ ] **Step 7: проверка в браузере.** Как в Task 11 Step 5, для `#/rub-docs`; переключение экранов туда-обратно сохраняет фильтр и страницу, снимает выделение. Скриншот обоих экранов — в леджер.
- [ ] **Step 8: commit.**

```bash
git add apps/pi
git commit -m "apps/pi: рублёвый реестр — сущность rub-doc, данные по эталону, экран и e2e"
```

---

### Task 13: Витрина на Pages

**Files:**
- Modify: `.github/workflows/pages.yml`

- [ ] **Step 1: сборка обоих приложений в один артефакт.** Шаги сборки:

```yaml
      - run: PAGES_BASE=/katran/ VITE_PI_URL=/katran/pi/ pnpm --filter demo build
      - run: PAGES_BASE=/katran/pi/ pnpm --filter pi build
      - run: cp -r apps/pi/dist apps/demo/dist/pi
      - uses: actions/upload-pages-artifact@v3
        with:
          path: apps/demo/dist
```

(Блочный стиль YAML — STATE §8: `${{ … }}` во flow-словаре GitHub не разбирает.)
- [ ] **Step 2: локальная проверка.** `PAGES_BASE=/katran/pi/ pnpm --filter pi build` — в `apps/pi/dist/index.html` пути ассетов начинаются с `/katran/pi/`.
- [ ] **Step 3: commit.** `git add .github/workflows/pages.yml && git commit -m "Pages: apps/pi публикуется по /katran/pi/ рядом с демо"`. После push в `main` (делает владелец или контроллер по его слову) — открыть `https://ivanklimenko.github.io/katran/pi/?c=1`: оба реестра, консоль чистая.

---

### Task 14: Документы

**Files:**
- Create: `docs/guides/pi-usage.md`, `docs/reference/pi-api.md`, `apps/pi/README.md`
- Modify: `docs/guides/effector-fsd.md`, `docs/STATE.md`, `CHANGELOG.md`, `docs/superpowers/specs/2026-09-23-katran-design.md` (§3, §10, §11)

- [ ] **Step 1: `docs/reference/pi-api.md`** (для бекенда). Разделы:
  1. Эндпоинты фронта: `POST /grids/{gridId}/search`, `GET /grids/{gridId}/filter-meta` — ссылкой на контракт `vtb-filters` §5–6; `POST /grids/{gridId}/facets` — **предложение**: тело `{ filter: { conditions }, field }`, ответ `[{ value, count }]`, семантика фильтра как у search, счёт без условий по `field`.
  2. `gridId`: `fx-docs`, `rub-docs`.
  3. Состав строки `content[]` для каждого грида — таблица «поле · тип · обязательно · пример» по `FxDoc` и `RubDoc` (Task 8, 12).
  4. Примеры запросов и ответов — взять из `grid-contract.test.ts` и `contract.test.ts` (по одному search, facets, filter-meta и одна ошибка 400 для каждого грида).
  5. Каталоги полей обоих гридов (`fxDocsMeta`, `rubDocsMeta`) — как пример ответа filter-meta.
- [ ] **Step 2: `docs/guides/pi-usage.md`** (для команды внутри). Разделы:
  1. Что это: схема слоёв `app → pages → widgets → entities → shared`, где шов (`requestFx`), что наше и выбрасывается (`app/`).
  2. Путь «слайсы»: скопировать `pages`, `widgets`, `entities`, `shared` в свой `src`; в своём `app` — обработчик транспорта и адаптер роутера; смонтировать `FxDocsPage`/`RubDocsPage`; если в проекте алиас `@/` — импорты можно оставить относительными.
  3. Путь «remote»: `apps/pi` как remote webpack 5 MF — `bootstrap`-вход, `exposes` страниц, shared из спеки совместимости §2.4 (ссылкой), CORS шрифтов, ErrorBoundary хоста.
  4. Обработчик `requestFx` — два готовых примера:

```ts
// fetch
requestFx.use(async ({ method, url, query, body }) => {
  const qs = query ? `?${new URLSearchParams(query)}` : ''
  const res = await fetch(`${API_BASE}${url}${qs}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'include' })
  const data: unknown = res.headers.get('content-type')?.includes('json') ? await res.json() : null
  if (!res.ok) throw toApiError(res.status, data)
  return data
})
```

```ts
// axios
requestFx.use(async ({ method, url, query, body }) => {
  try {
    return (await api.request({ method, url, params: query, data: body })).data as unknown
  } catch (e) {
    if (axios.isAxiosError(e)) throw toApiError(e.response?.status ?? 0, e.response?.data)
    throw e
  }
})
```

  5. Адаптер роутера: на вход экрана — `lifecycle.pageOpened()`, на уход — `lifecycle.pageClosed()`; пример на `useEffect` с очисткой (как `startRouting` в `app/routes.ts`).
  6. Строка бека отличается — правится только `entities/*/api/*.mapper.ts`; каталог и тело поиска — `shared/api/grid-contract.ts`, если бек отошёл от контракта `vtb-filters`.
  7. Контрактные тесты против своего бека: `contract.test.ts` с обработчиком из п. 4 в `fork({ handlers })`.
  8. Farfetched: `createQuery({ effect: fxDocPorts.searchFx })` — порты оборачиваются без переписывания.
  9. Чек-лист «перенос завершён»: транспорт подключён (нет ошибки «Транспорт не подключён»), оба экрана грузятся, `?`-регуляторы не нужны, контрактные тесты зелёные против своего бека, eslint-границы перенесены.
- [ ] **Step 3: `apps/pi/README.md`** — запуск (`pnpm --filter pi dev`, порт 5185), тесты и e2e, регуляторы `?slow=N`, `?fail=search|facets|meta`, ссылки на `pi-usage.md` и `pi-api.md`.
- [ ] **Step 4: `docs/guides/effector-fsd.md`** — примеры в разделах 2–4 привести к реальным именам (`entities/fx-doc`, `widgets/doc-registry`, `createPageLifecycle`, `refreshRequested`), в начале — строка «Живой образец — `apps/pi`».
- [ ] **Step 5: STATE, CHANGELOG, основная спека.** STATE: §1–2 — `apps/pi`; §5 карта — `apps/pi` и `docs/guides`, `docs/reference/pi-api.md`; §6 — состояние после плана (число тестов, e2e); §7 — снятый техдолг «демо без регуляторов empty/error»; §9 — следующий шаг (срез 2 — деталка в `apps/pi`); §10 — эталон рубля (Task 1). CHANGELOG — «Добавлено: приложение `apps/pi`…». Основная спека: §3 — `apps/pi` в перечне приложений; §10 — боевые экраны живут в `apps/pi`, демо — витрина компонентов; §11 — строка среза «apps/pi».
- [ ] **Step 6: проверка документа использования «с нуля».** Свежий субагент (Sonnet) получает только `docs/guides/pi-usage.md` и репозиторий и отвечает: какие файлы скопировать, что написать в своём `app`, как проверить перенос. Ответ сверить с разделами; неясности — править документ.
- [ ] **Step 7: commit.**

```bash
git add docs apps/pi/README.md CHANGELOG.md
git commit -m "Документы apps/pi: использование для команды, API для бекенда, README; состояние и спека"
```

---

## Порядок и зависимости

Task 0 → 1 (стоп на решения владельца) → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 (после решений Task 1) → 13 → 14. Task 2–11 не ждут решений по Task 1.
