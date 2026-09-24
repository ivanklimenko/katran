# Katran — срез 1, план 2 из 3: DataGrid и модели effector

> **Статус:** исполнен 2026-09-24 (ветка `feat/slice1-grid`, последний коммит `1ca7663`); отклонения внесены в спеку. Текст плана поправлен только там, где решение исполнения заменило указание плана: роль ручки ресайза (`slider`, Task 8, 10), переменная клампа (`--k-lines`, Task 7).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать `DataGrid` по контракту спеки (многострочная запись со сквозными сегментами, сортировка, ресайз, состав колонок, выделение, состояния, клавиатура) и пакет `@katran/effector` с `createGridModel`, `createFiltersModel` и хуками; показать грид в демо на правдоподобных данных и закрепить геометрию замером.

**Architecture:** `packages/ui/src/grid/` — чистые функции (`resolveSpans`, `sortRows`, `selection`) отдельно от React-частей (`GridRecord`, `GridSkeleton`, `ColumnHeader`, `ColumnsMenu`, `DataGrid`, `useGridKeyboard`). `packages/effector/` — фабрики моделей без DOM и транспорта: приложение даёт `fetchFx`, модель собирает `GridQuery` и владеет состоянием вида. Демо — фейковый бэкенд в памяти на 87 документов.

**Tech Stack:** как в плане 1 (React 19, Vite 8, vitest 5, jsdom, Testing Library, jest-axe) + `effector ^23`, `effector-react ^23`, `@playwright/test` (только для замера геометрии, вне `pnpm check`).

**Spec:** `docs/superpowers/specs/2026-09-23-katran-design.md` — разделы 6 (DataGrid), 7.1 (модель фильтра), 8 (модели), 9 (Playwright-замеры). План 1 (примитивы, на которые опираемся): `docs/superpowers/plans/2026-09-23-katran-slice1-foundation.md`.

**Отклонения от спеки, принятые этим планом** (внесены в спеку 2026-09-24: 6.1, 6.2, 6.3, 8.2):
- `Selection`: `ids`/`except` — массивы строк, не `Set` (сериализуемость сторов effector, `persist`, сравнение props в React).
- Первая колонка грида (`__lead`: чекбокс, кнопка открытия, порядковый номер) — служебная, не входит в `layout.columns` и не участвует в `spans`/сортировке/составе.
- `GridQuery.page` — с нуля (как у бека, контракт фильтров §2), `$page` модели — с единицы.
- `persist.load` — синхронный (`localStorage`); серверный адаптер загружает настройки до создания модели.
- `ThemeSwitch`/`DensitySwitch` — по-прежнему не здесь (план 3 или позже).

## Global Constraints

- Всё из плана 1 (peer `react >=18`; `ui` без effector; CSS только токенами — голые `px` лишь в `border*`/`outline*`/`box-shadow`/`letter-spacing`; имена классов CSS Modules camelCase → `k-Component__part`; интерактив — настоящие `<button>`/`<input>` с именем; `axe` в тестах; русский язык; коммиты без трейлеров `Co-Authored-By`/«Generated with»).
- `packages/effector` импортирует из `@katran/ui` только типы (`import type`); DOM API и компоненты — запрещены (спека 3.2). `effector`/`effector-react` — peer-зависимости, в `ui` их нет.
- Все опциональные пропы публичных типов — `?: T | undefined` (ruling 23 плана 1).
- Тесты, рендерящие через `renderK`, ищут узлы по ролям/атрибутам, не через `container.firstElementChild` (ruling 12 плана 1).
- Новые размеры — только через `tokens.src.ts` + `pnpm gen` (коммитить регенерацию). Этот план добавляет: `'grid-min-col': 36`, `'grid-lead': 84`, `'grid-rz': 7`, `'menu-max-h': 320`.
- Запись грида ≤ 3 строк контента; граница `--k-line` по записи, внутри записи линий нет; заголовок липкий (`sticky`).
- Запись не кликабельна; деталку открывает только кнопка (спека 6.3).
- Playwright и его браузеры — вне `pnpm check` (сеть банка может не дать скачать браузер); отдельный скрипт `pnpm --filter demo e2e`.

---

## Карта файлов

```
packages/ui/src/grid/
  types.ts                 — ColumnDef, SortKey, SpanDef, RecordLayout, Sort, Selection, ColumnsState, GridState
  resolveSpans.ts  + .test.ts     — сегменты по id колонок → {colStart, colSpan}
  sortRows.ts      + .test.ts     — defaultDir, compareRows, sortRows (клиентская сортировка для демо/фейка)
  selection.ts     + .test.ts     — isSelected, toggle, togglePage, selectedCount, headerState
  Grid.module.css
  GridRecord.tsx           — <tbody> записи: строка колонок + сквозные строки
  GridSkeleton.tsx         — скелет той же геометрии
  ColumnHeader.tsx + .test.tsx   — th: сортировка (клик/меню), подпись ключа, ручка ресайза
  ColumnsMenu.tsx  + .test.tsx   — состав колонок: поиск, галочки, вверх/вниз
  useGridKeyboard.ts       — roving tabindex по ячейкам (WAI-ARIA grid)
  DataGrid.tsx     + .test.tsx   — композиция, состояния, выделение, открытие, пагинация
  index.ts
packages/effector/
  package.json  tsconfig.json  vitest.config.ts  vitest.setup.ts
  src/types.ts             — Scalar, Condition, Filter, FilterMeta, GridQuery, GridPage, Sort
  src/persist.ts   + .test.ts     — PersistAdapter, localStoragePersist, memoryPersist
  src/createFiltersModel.ts + .test.ts
  src/createGridModel.ts    + .test.ts
  src/useGrid.ts  src/useFilters.ts + hooks.test.tsx
  src/index.ts
apps/demo/
  src/data/docs.ts         — генератор 87 валютных документов (вымышленные, правдоподобные)
  src/data/fakeBackend.ts  — fetchFx в памяти: фильтр, сортировка, страница, задержка
  src/pages/GridPage.tsx   — «Реестр» на DataGrid + createGridModel
  e2e/geometry.spec.ts  playwright.config.ts   — замер высот записи/скелетона/шапки
```

---

### Task 1: Типы грида и `resolveSpans`

**Files:**
- Create: `packages/ui/src/grid/types.ts`, `packages/ui/src/grid/resolveSpans.ts`, `packages/ui/src/grid/resolveSpans.test.ts`, `packages/ui/src/grid/index.ts`
- Modify: `packages/ui/src/index.ts` (`export * from './grid'`)

**Interfaces:**
- Produces (`types.ts`): `ColumnDef<Row>`, `SortKey`, `SpanDef<Row>`, `RecordLayout<Row>`, `Sort`, `Selection`, `ColumnsState`, `GridViewState`, `ResolvedSpan`. Типы `Sort`/`Selection`/`ColumnsState`/`GridViewState` объявлены здесь (ui — источник для effector через `import type`).
- Produces (`resolveSpans.ts`): `resolveSpans(spans: SpanDef<unknown>[], visibleOrder: string[], fullOrder = visibleOrder): ResolvedSpan[]` где `ResolvedSpan = { id: string; colStart: number; colSpan: number }` (индексы — по видимым колонкам, без служебной колонки); `visibleColumns(order, hidden, columns) → ColumnDef[]`.

- [ ] **Step 1: Типы**

`packages/ui/src/grid/types.ts`:
```ts
import type { ReactNode } from 'react'

export type SortKey = {
  id: string
  /** Подписывается в шапке, когда ключ выбран. */
  label: string
  type?: 'text' | 'number' | 'date' | undefined
  /** Второй ключ, в том же направлении. */
  then?: string | undefined
  /** Фиксированный порядок значений: ['IN','OUT','TRANSIT','OTHER']. */
  order?: string[] | undefined
  /** Как достать значение из строки для клиентской сортировки (демо/фейк); на сервере не нужно. */
  get?: ((row: never) => unknown) | undefined
}

export type ColumnDef<Row> = {
  id: string
  /** Пустой допустим — у колонки статуса заголовка нет. */
  title?: string | undefined
  /** Имя в меню сортировки и состава, если title пуст. */
  menuTitle?: string | undefined
  subtitle?: string | undefined
  /** Начальная ширина в px при плотности 1. */
  width?: number | undefined
  /** По умолчанию 36. */
  minWidth?: number | undefined
  /** По умолчанию true. */
  resizable?: boolean | undefined
  /** Строк контента; по умолчанию 1. Задаёт скелетон и кламп. */
  lines?: 1 | 2 | 3 | undefined
  align?: 'left' | 'right' | undefined
  /** Пусто → колонка не сортируется. */
  sort?: SortKey[] | undefined
  render: (row: Row) => ReactNode
}

export type SpanDef<Row> = {
  id: string
  /** id колонки начала. */
  from: string
  /** id колонки конца, включительно. */
  to: string
  lines?: 1 | 2 | undefined
  /** null → бледная подложка, не закрашивается. */
  render: (row: Row) => ReactNode | null
}

export type RecordLayout<Row> = {
  columns: ColumnDef<Row>[]
  /** Дополнительные строки записи; в каждой — сегменты слева направо. */
  spans?: SpanDef<Row>[][] | undefined
  rowKey: (row: Row) => string
}

export type Sort = { key: string; dir: 'asc' | 'desc' } | null
export type Selection = { mode: 'ids'; ids: string[] } | { mode: 'all'; except: string[] }
export type ColumnsState = { order: string[]; hidden: string[] }
export type GridViewState = 'ready' | 'loading' | 'refreshing' | 'error'

export type ResolvedSpan = { id: string; colStart: number; colSpan: number }
```
`SortKey.get` типизирован через `never`, чтобы `SortKey` оставался ковариантным по строке (иначе `ColumnDef<Row>` не присвоить в `ColumnDef<unknown>`); клиентская сортировка приводит его к `(row: unknown) => unknown`.

- [ ] **Step 2: Тест (падает)**

`packages/ui/src/grid/resolveSpans.test.ts`:
```ts
import { resolveSpans, visibleColumns } from './resolveSpans'
import type { ColumnDef, SpanDef } from './types'

const span = (id: string, from: string, to: string): SpanDef<unknown> => ({ id, from, to, render: () => null })
const col = (id: string): ColumnDef<unknown> => ({ id, render: () => null })

describe('resolveSpans', () => {
  const order = ['status', 'id', 'date', 'type', 'dir', 'f50', 'f52', 'f57', 'f59']

  it('сегмент по id колонок → индекс и ширина по видимому порядку', () => {
    expect(resolveSpans([span('reason', 'status', 'id'), span('purpose', 'f50', 'f59')], order)).toEqual([
      { id: 'reason', colStart: 0, colSpan: 2 },
      { id: 'purpose', colStart: 5, colSpan: 4 },
    ])
  })
  it('часть колонок диапазона скрыта → сегмент сжимается', () => {
    const visible = order.filter((c) => c !== 'f52' && c !== 'f57')
    expect(resolveSpans([span('purpose', 'f50', 'f59')], visible, order)).toEqual([{ id: 'purpose', colStart: 5, colSpan: 2 }])
  })
  it('все колонки диапазона скрыты → сегмента нет', () => {
    const visible = order.filter((c) => !['f50', 'f52', 'f57', 'f59'].includes(c))
    expect(resolveSpans([span('purpose', 'f50', 'f59')], visible, order)).toEqual([])
  })
  it('крайняя колонка скрыта → ближайшая видимая внутри диапазона', () => {
    const visible = order.filter((c) => c !== 'f59')
    expect(resolveSpans([span('purpose', 'f50', 'f59')], visible, order)).toEqual([{ id: 'purpose', colStart: 5, colSpan: 3 }])
  })
  it('пользовательский порядок: to левее from → границы нормализуются, накрывается всё между', () => {
    const reordered = ['status', 'f59', 'type', 'f50', 'id']
    expect(resolveSpans([span('purpose', 'f50', 'f59')], reordered)).toEqual([{ id: 'purpose', colStart: 1, colSpan: 3 }])
  })
  it('сегменты одной строки отсортированы по colStart', () => {
    const r = resolveSpans([span('b', 'f50', 'f59'), span('a', 'status', 'id')], order)
    expect(r.map((x) => x.id)).toEqual(['a', 'b'])
  })
})

describe('visibleColumns', () => {
  it('порядок из order, скрытые исключены, неизвестные id в order игнорируются', () => {
    const cols = [col('a'), col('b'), col('c')]
    expect(visibleColumns(['c', 'zzz', 'a', 'b'], ['a'], cols).map((c) => c.id)).toEqual(['c', 'b'])
  })
  it('колонки, которых нет в order, идут в конец в исходном порядке', () => {
    const cols = [col('a'), col('b'), col('c')]
    expect(visibleColumns(['b'], [], cols).map((c) => c.id)).toEqual(['b', 'a', 'c'])
  })
})
```
Run: `pnpm --filter @katran/ui test resolveSpans` → FAIL.

- [ ] **Step 3: Реализация**

`packages/ui/src/grid/resolveSpans.ts`:
```ts
import type { ColumnDef, ResolvedSpan, SpanDef } from './types'

/**
 * Сквозные сегменты адресуются по id колонок, не числом colspan — состав колонок пользовательский (спека 6.3).
 * Диапазон берётся по ПОЛНОМУ порядку (между from и to включительно, границы нормализуются),
 * а индексы считаются по видимым колонкам: скрытые сжимают сегмент, полностью скрытый диапазон сегмента не даёт.
 */
export function resolveSpans(spans: SpanDef<unknown>[], visibleOrder: string[], fullOrder: string[] = visibleOrder): ResolvedSpan[] {
  const out: ResolvedSpan[] = []
  for (const s of spans) {
    const fa = fullOrder.indexOf(s.from), fb = fullOrder.indexOf(s.to)
    if (fa < 0 || fb < 0) continue
    const [lo, hi] = fa <= fb ? [fa, fb] : [fb, fa]
    const covered = new Set(fullOrder.slice(lo, hi + 1))
    const idx = visibleOrder.map((id, i) => (covered.has(id) ? i : -1)).filter((i) => i >= 0)
    if (idx.length === 0) continue
    const start = Math.min(...idx), end = Math.max(...idx)
    out.push({ id: s.id, colStart: start, colSpan: end - start + 1 })
  }
  return out.sort((x, y) => x.colStart - y.colStart)
}

/** Колонки в пользовательском порядке без скрытых; колонки вне order — в конец. */
export function visibleColumns<Row>(order: string[], hidden: string[], columns: ColumnDef<Row>[]): ColumnDef<Row>[] {
  const byId = new Map(columns.map((c) => [c.id, c]))
  const seen = new Set<string>()
  const out: ColumnDef<Row>[] = []
  for (const id of order) {
    const c = byId.get(id)
    if (c && !seen.has(id)) { seen.add(id); out.push(c) }
  }
  for (const c of columns) if (!seen.has(c.id)) out.push(c)
  const hiddenSet = new Set(hidden)
  return out.filter((c) => !hiddenSet.has(c.id))
}
```

`packages/ui/src/grid/index.ts`:
```ts
export * from './types'
export { resolveSpans, visibleColumns } from './resolveSpans'
```
В `packages/ui/src/index.ts` добавить `export * from './grid'`.

- [ ] **Step 4: Тесты проходят**

Run: `pnpm --filter @katran/ui test resolveSpans && pnpm lint` → PASS (8).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Грид: типы контракта и resolveSpans — сквозные сегменты по id колонок"
```

---

### Task 2: Клиентская сортировка `sortRows`

**Files:**
- Create: `packages/ui/src/grid/sortRows.ts`, `packages/ui/src/grid/sortRows.test.ts`
- Modify: `packages/ui/src/grid/index.ts`

**Interfaces:**
- Produces: `defaultDir(key: SortKey): 'asc' | 'desc'` (date/number → desc, text → asc); `findSortKey(columns, keyId) → SortKey | undefined`; `sortRows<Row>(rows, sort, columns, get: (row, keyId) => unknown): Row[]` — стабильная, учитывает `order` (фиксированный порядок значений), `then` (второй ключ в том же направлении), пустые значения в конец при любом направлении.
- Назначение: фейковый бэкенд демо и любые клиентские таблицы (справочники без сервера). Серверный грид эту функцию не вызывает.

- [ ] **Step 1: Тест (падает)**

`packages/ui/src/grid/sortRows.test.ts`:
```ts
import { defaultDir, findSortKey, sortRows } from './sortRows'
import type { ColumnDef } from './types'

type R = { id: string; amount: number | null; created: string; dir: string; name: string }
const rows: R[] = [
  { id: '1', amount: 300, created: '2026-09-22T10:00:00', dir: 'OUT', name: 'Б' },
  { id: '2', amount: null, created: '2026-09-23T10:00:00', dir: 'IN', name: 'А' },
  { id: '3', amount: 100, created: '2026-09-21T10:00:00', dir: 'TRANSIT', name: 'В' },
  { id: '4', amount: 300, created: '2026-09-20T10:00:00', dir: 'IN', name: 'Г' },
]
const columns: ColumnDef<R>[] = [
  { id: 'amt', sort: [{ id: 'amount', label: 'Сумма', type: 'number' }], render: () => null },
  { id: 'dt', sort: [{ id: 'created', label: 'Дата', type: 'date' }], render: () => null },
  { id: 'dir', sort: [{ id: 'dir', label: 'Направление', order: ['IN', 'OUT', 'TRANSIT', 'OTHER'], then: 'name' }, { id: 'name', label: 'Название' }], render: () => null },
]
const get = (r: R, k: string) => (r as unknown as Record<string, unknown>)[k]

describe('sortRows', () => {
  it('направление по умолчанию: число и дата — по убыванию, текст — по возрастанию', () => {
    expect(defaultDir({ id: 'a', label: 'a', type: 'number' })).toBe('desc')
    expect(defaultDir({ id: 'a', label: 'a', type: 'date' })).toBe('desc')
    expect(defaultDir({ id: 'a', label: 'a' })).toBe('asc')
  })
  it('findSortKey находит ключ в составной колонке', () => {
    expect(findSortKey(columns, 'name')?.label).toBe('Название')
    expect(findSortKey(columns, 'nope')).toBeUndefined()
  })
  it('число по убыванию, null — в конец; ничьи стабильны', () => {
    expect(sortRows(rows, { key: 'amount', dir: 'desc' }, columns, get).map((r) => r.id)).toEqual(['1', '4', '3', '2'])
  })
  it('число по возрастанию, null всё равно в конец', () => {
    expect(sortRows(rows, { key: 'amount', dir: 'asc' }, columns, get).map((r) => r.id)).toEqual(['3', '1', '4', '2'])
  })
  it('дата', () => {
    expect(sortRows(rows, { key: 'created', dir: 'desc' }, columns, get).map((r) => r.id)).toEqual(['2', '1', '3', '4'])
  })
  it('фиксированный порядок групп + второй ключ в том же направлении', () => {
    expect(sortRows(rows, { key: 'dir', dir: 'asc' }, columns, get).map((r) => r.id)).toEqual(['2', '4', '1', '3'])
    expect(sortRows(rows, { key: 'dir', dir: 'desc' }, columns, get).map((r) => r.id)).toEqual(['3', '1', '4', '2'])
  })
  it('sort === null → исходный порядок, новый массив', () => {
    const out = sortRows(rows, null, columns, get)
    expect(out).toEqual(rows)
    expect(out).not.toBe(rows)
  })
})
```
Run: `pnpm --filter @katran/ui test sortRows` → FAIL.

- [ ] **Step 2: Реализация**

`packages/ui/src/grid/sortRows.ts`:
```ts
import type { ColumnDef, Sort, SortKey } from './types'

export const defaultDir = (key: SortKey): 'asc' | 'desc' => (key.type === 'number' || key.type === 'date' ? 'desc' : 'asc')

export function findSortKey<Row>(columns: ColumnDef<Row>[], keyId: string): SortKey | undefined {
  for (const c of columns) for (const k of c.sort ?? []) if (k.id === keyId) return k
  return undefined
}

const isEmpty = (v: unknown) => v === null || v === undefined || v === ''

function compareValues(a: unknown, b: unknown, key: SortKey): number {
  if (key.order) {
    const ia = key.order.indexOf(String(a)), ib = key.order.indexOf(String(b))
    return (ia < 0 ? key.order.length : ia) - (ib < 0 ? key.order.length : ib)
  }
  if (key.type === 'number') return Number(a) - Number(b)
  if (key.type === 'date') return new Date(String(a)).getTime() - new Date(String(b)).getTime()
  return String(a).localeCompare(String(b), 'ru')
}

/**
 * Стабильная сортировка с одним активным ключом: пустые значения всегда в конце,
 * `order` задаёт фиксированный порядок значений, `then` — второй ключ в том же направлении.
 * Для серверного грида не используется — там сортирует бек.
 */
export function sortRows<Row>(rows: Row[], sort: Sort, columns: ColumnDef<Row>[], get: (row: Row, keyId: string) => unknown): Row[] {
  const out = rows.slice()
  if (!sort) return out
  const key = findSortKey(columns, sort.key)
  if (!key) return out
  const then = key.then ? (findSortKey(columns, key.then) ?? { id: key.then, label: key.then }) : undefined
  const sign = sort.dir === 'asc' ? 1 : -1
  const cmp = (a: Row, b: Row, k: SortKey): number => {
    const va = get(a, k.id), vb = get(b, k.id)
    const ea = isEmpty(va), eb = isEmpty(vb)
    if (ea || eb) return ea && eb ? 0 : ea ? 1 : -1  // пустые в конец независимо от направления
    return compareValues(va, vb, k) * sign
  }
  return out
    .map((row, i) => ({ row, i }))
    .sort((x, y) => cmp(x.row, y.row, key) || (then ? cmp(x.row, y.row, then) : 0) || x.i - y.i)
    .map((x) => x.row)
}
```
Пустые: тест «asc, null в конец» ожидает `['3','1','4','2']` — `cmp` возвращает 1 для пустого `a` без умножения на `sign`, так и есть. В `index.ts` добавить `export { defaultDir, findSortKey, sortRows } from './sortRows'`.

- [ ] **Step 3: Тесты проходят**

Run: `pnpm --filter @katran/ui test sortRows` → PASS (7).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Грид: клиентская сортировка — направление по типу, фиксированный порядок, второй ключ, пустые в конец"
```

---

### Task 3: Помощники выделения

**Files:**
- Create: `packages/ui/src/grid/selection.ts`, `packages/ui/src/grid/selection.test.ts`
- Modify: `packages/ui/src/grid/index.ts`

**Interfaces:**
- Produces: `isSelected(sel: Selection, id: string): boolean`; `selectedCount(sel, total): number`; `pageState(sel, pageIds): 'none' | 'some' | 'all'` (для трёхпозиционного чекбокса шапки); `EMPTY_SELECTION`.
- Мутации выделения живут в модели (Task 3); здесь — только чтение, чтобы компонент не дублировал логику.

- [ ] **Step 1: Тест (падает)**

`packages/ui/src/grid/selection.test.ts`:
```ts
import { EMPTY_SELECTION, isSelected, pageState, selectedCount } from './selection'

describe('selection helpers', () => {
  it('ids: выбран, если в списке', () => {
    const s = { mode: 'ids' as const, ids: ['a', 'b'] }
    expect(isSelected(s, 'a')).toBe(true)
    expect(isSelected(s, 'z')).toBe(false)
    expect(selectedCount(s, 87)).toBe(2)
  })
  it('all: выбран, если не в исключениях; счётчик = total − except', () => {
    const s = { mode: 'all' as const, except: ['b'] }
    expect(isSelected(s, 'a')).toBe(true)
    expect(isSelected(s, 'b')).toBe(false)
    expect(selectedCount(s, 87)).toBe(86)
  })
  it('состояние чекбокса шапки по странице', () => {
    expect(pageState(EMPTY_SELECTION, ['a', 'b'])).toBe('none')
    expect(pageState({ mode: 'ids', ids: ['a'] }, ['a', 'b'])).toBe('some')
    expect(pageState({ mode: 'ids', ids: ['a', 'b', 'c'] }, ['a', 'b'])).toBe('all')
    expect(pageState({ mode: 'all', except: [] }, ['a', 'b'])).toBe('all')
    expect(pageState({ mode: 'all', except: ['a'] }, ['a', 'b'])).toBe('some')
    expect(pageState({ mode: 'all', except: ['a', 'b'] }, ['a', 'b'])).toBe('none')
    expect(pageState(EMPTY_SELECTION, [])).toBe('none')
  })
})
```

- [ ] **Step 2: Реализация**

`packages/ui/src/grid/selection.ts`:
```ts
import type { Selection } from './types'

export const EMPTY_SELECTION: Selection = { mode: 'ids', ids: [] }

export const isSelected = (sel: Selection, id: string): boolean =>
  sel.mode === 'ids' ? sel.ids.includes(id) : !sel.except.includes(id)

/** «Выбрано N» для BulkBar: в режиме all — всё по фильтру минус исключения. */
export const selectedCount = (sel: Selection, total: number): number =>
  sel.mode === 'ids' ? sel.ids.length : Math.max(0, total - sel.except.length)

/** Трёхпозиционный чекбокс шапки — по записям текущей страницы. */
export function pageState(sel: Selection, pageIds: string[]): 'none' | 'some' | 'all' {
  if (pageIds.length === 0) return 'none'
  const n = pageIds.filter((id) => isSelected(sel, id)).length
  return n === 0 ? 'none' : n === pageIds.length ? 'all' : 'some'
}
```
В `index.ts` добавить `export { EMPTY_SELECTION, isSelected, selectedCount, pageState } from './selection'`.

- [ ] **Step 3: Тесты проходят, commit**

Run: `pnpm --filter @katran/ui test selection` → PASS (3).
```bash
git add -A && git commit -m "Грид: помощники выделения — isSelected, selectedCount, pageState"
```

---

### Task 4: Пакет `@katran/effector`: зависимости, тесты, типы, persist

**Files:**
- Modify: `packages/effector/package.json`, `packages/effector/tsconfig.json`
- Create: `packages/effector/vitest.config.ts`, `packages/effector/vitest.setup.ts`, `packages/effector/src/types.ts`, `packages/effector/src/persist.ts`, `packages/effector/src/persist.test.ts`, `packages/effector/src/index.ts`

**Interfaces:**
- Consumes: `Sort`, `Selection`, `ColumnsState`, `GridViewState` из `@katran/ui` (Task 1 этого плана) — только `import type`.
- Produces: типы `Scalar`, `Condition`, `Filter`, `FilterFieldType`, `FilterField`, `FilterMeta`, `GridQuery`, `GridPage<Row>`, `PersistAdapter<T>` (+ реэкспорт типов вида из ui); функции `localStoragePersist(prefix?)`, `memoryPersist()`.

- [ ] **Step 1: Зависимости и конфиги**

`packages/effector/package.json`:
```json
{
  "name": "@katran/effector",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "build": "tsc -p tsconfig.json --noEmit" },
  "dependencies": { "@katran/ui": "workspace:*" },
  "peerDependencies": { "effector": ">=23", "effector-react": ">=23", "react": ">=18" }
}
```
`@katran/ui` в `dependencies` нужен только ради `import type` (типы `ColumnDef`/`Sort` для хуков); линтер зоны `packages/effector/src` пропускает импорт из `@katran/ui` только по имени пакета (не по пути) — это уже настроено в `eslint.config.js`.

Run:
```bash
cd /Users/shaman/_CODE/VTB/katran && pnpm --filter @katran/effector add -D effector@^23 effector-react@^23 react@^19 react-dom@^19 @types/react@^19 vitest@^5 jsdom@^30 @testing-library/react@^16
```

`packages/effector/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "types": ["vitest/globals"] }, "include": ["src", "vitest.setup.ts"] }
```
`packages/effector/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'jsdom', globals: true, setupFiles: ['./vitest.setup.ts'] } })
```
`packages/effector/vitest.setup.ts`:
```ts
// Модели тестируются без DOM; jsdom нужен только тестам хуков (renderHook).
```

- [ ] **Step 2: Типы**

`packages/effector/src/types.ts`:
```ts
/** Модель фильтра — спека 7.1, контракт vtb-filters/docs/filter-contract.md. */
export type Scalar = string | number | boolean

export type Condition =
  | { field: string; op: 'EQ' | 'NE' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'GT' | 'GTE' | 'LT' | 'LTE'; value: Scalar }
  | { field: string; op: 'IN' | 'NOT_IN'; values: Scalar[] }
  | { field: string; op: 'BETWEEN'; from: Scalar; to: Scalar }
  | { field: string; op: 'IS_EMPTY' | 'IS_NOT_EMPTY' }

/** v1 — только AND. */
export type Filter = Condition[]

export type FilterFieldType = 'STRING' | 'NUMBER' | 'DATE' | 'DATETIME' | 'ENUM' | 'BOOLEAN'
export type FilterField = {
  id: string
  label: string
  type: FilterFieldType
  ops: Condition['op'][]
  /** Встроенный справочник для ENUM. */
  values?: { value: Scalar; label: string }[] | undefined
  group?: string | undefined
}
/** Ответ GET /grids/{gridId}/filter-meta. */
export type FilterMeta = { fields: FilterField[] }

/** Типы состояния вида объявлены в @katran/ui (grid/types.ts) — здесь только реэкспорт, чтобы у контракта был один источник. */
export type { Sort, Selection, ColumnsState, GridViewState } from '@katran/ui'
import type { Sort } from '@katran/ui'

/** То, что уходит в POST /grids/{gridId}/search. page — с нуля, как у бека. */
export type GridQuery = { filter: Filter; sort: Sort; page: number; size: number }
export type GridPage<Row> = { rows: Row[]; total: number }

export type PersistAdapter<T> = {
  load: (key: string) => T | undefined
  save: (key: string, value: T) => void
}
```

- [ ] **Step 3: Тест persist (падает)**

`packages/effector/src/persist.test.ts`:
```ts
import { localStoragePersist, memoryPersist } from './persist'

describe('persist', () => {
  beforeEach(() => localStorage.clear())

  it('localStorage: сохраняет и читает JSON под префиксом', () => {
    const p = localStoragePersist<{ a: number }>('katran')
    p.save('grid', { a: 1 })
    expect(localStorage.getItem('katran:grid')).toBe('{"a":1}')
    expect(p.load('grid')).toEqual({ a: 1 })
  })
  it('localStorage: испорченный JSON и отсутствие ключа → undefined', () => {
    const p = localStoragePersist('katran')
    localStorage.setItem('katran:bad', '{oops')
    expect(p.load('bad')).toBeUndefined()
    expect(p.load('none')).toBeUndefined()
  })
  it('memory: изолированное хранилище', () => {
    const a = memoryPersist<number>(), b = memoryPersist<number>()
    a.save('k', 1)
    expect(a.load('k')).toBe(1)
    expect(b.load('k')).toBeUndefined()
  })
})
```
Run: `pnpm --filter @katran/effector test` → FAIL (модуль не найден).

- [ ] **Step 4: Реализация**

`packages/effector/src/persist.ts`:
```ts
import type { PersistAdapter } from './types'

/** Настройки вида (ширины, порядок, скрытые колонки, размер страницы) — в localStorage. Приватный режим — молча. */
export function localStoragePersist<T>(prefix = 'katran'): PersistAdapter<T> {
  const k = (key: string) => `${prefix}:${key}`
  return {
    load: (key) => {
      try {
        const raw = localStorage.getItem(k(key))
        return raw == null ? undefined : (JSON.parse(raw) as T)
      } catch { return undefined }
    },
    save: (key, value) => {
      try { localStorage.setItem(k(key), JSON.stringify(value)) } catch { /* приватный режим */ }
    },
  }
}

/** Для тестов и SSR. */
export function memoryPersist<T>(): PersistAdapter<T> {
  const m = new Map<string, T>()
  return { load: (key) => m.get(key), save: (key, value) => { m.set(key, value) } }
}
```
`packages/effector/src/index.ts`:
```ts
export * from './types'
export { localStoragePersist, memoryPersist } from './persist'
```

- [ ] **Step 5: Тесты проходят, корневая проверка**

Run: `pnpm --filter @katran/effector test && pnpm check`
Expected: PASS 3 теста; `pnpm check` зелёный (пакет теперь участвует в `-r test`/`build`).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Пакет effector: типы фильтра и запроса, persist-адаптеры, тест-инфра"
```

---

### Task 5: `createFiltersModel`

**Files:**
- Create: `packages/effector/src/createFiltersModel.ts`, `packages/effector/src/createFiltersModel.test.ts`
- Modify: `packages/effector/src/index.ts`

**Interfaces:**
- Produces: `createFiltersModel({ meta?, initial? }) → FiltersModel` где
  `FiltersModel = { $conditions: Store<Filter>; $draft: Store<Filter>; $dirty: Store<boolean>; edit: Event<Condition>; discard: Event<string>; apply: Event<void>; reset: Event<void>; remove: Event<string>; meta: FilterMeta | null }`.
  Семантика: `edit` — upsert условия в черновике по `field`; `discard(field)` — убрать из черновика; `apply` — черновик становится применённым; `remove(field)` — снять применённое условие (и из черновика); `reset` — очистить оба. `$dirty` — черновик отличается от применённого.

- [ ] **Step 1: Тест (падает)**

`packages/effector/src/createFiltersModel.test.ts`:
```ts
import { allSettled, fork } from 'effector'
import { createFiltersModel } from './createFiltersModel'

describe('createFiltersModel', () => {
  it('edit → черновик; apply → применённые; $dirty отражает разницу', async () => {
    const m = createFiltersModel()
    const scope = fork()
    await allSettled(m.edit, { scope, params: { field: 'status', op: 'IN', values: ['ERROR'] } })
    expect(scope.getState(m.$draft)).toEqual([{ field: 'status', op: 'IN', values: ['ERROR'] }])
    expect(scope.getState(m.$conditions)).toEqual([])
    expect(scope.getState(m.$dirty)).toBe(true)
    await allSettled(m.apply, { scope })
    expect(scope.getState(m.$conditions)).toEqual([{ field: 'status', op: 'IN', values: ['ERROR'] }])
    expect(scope.getState(m.$dirty)).toBe(false)
  })

  it('edit по тому же полю заменяет условие, discard убирает из черновика', async () => {
    const m = createFiltersModel()
    const scope = fork()
    await allSettled(m.edit, { scope, params: { field: 'amount', op: 'GT', value: 100 } })
    await allSettled(m.edit, { scope, params: { field: 'amount', op: 'BETWEEN', from: 1, to: 2 } })
    expect(scope.getState(m.$draft)).toEqual([{ field: 'amount', op: 'BETWEEN', from: 1, to: 2 }])
    await allSettled(m.discard, { scope, params: 'amount' })
    expect(scope.getState(m.$draft)).toEqual([])
  })

  it('remove снимает применённое условие и из черновика; reset чистит всё', async () => {
    const m = createFiltersModel({ initial: [{ field: 'a', op: 'EQ', value: 1 }, { field: 'b', op: 'IS_EMPTY' }] })
    const scope = fork()
    expect(scope.getState(m.$conditions)).toHaveLength(2)
    await allSettled(m.remove, { scope, params: 'a' })
    expect(scope.getState(m.$conditions)).toEqual([{ field: 'b', op: 'IS_EMPTY' }])
    expect(scope.getState(m.$draft)).toEqual([{ field: 'b', op: 'IS_EMPTY' }])
    await allSettled(m.reset, { scope })
    expect(scope.getState(m.$conditions)).toEqual([])
    expect(scope.getState(m.$draft)).toEqual([])
  })

  it('две модели независимы (фабрика, не синглтон)', async () => {
    const a = createFiltersModel(), b = createFiltersModel()
    const scope = fork()
    await allSettled(a.edit, { scope, params: { field: 'x', op: 'EQ', value: 1 } })
    expect(scope.getState(b.$draft)).toEqual([])
  })
})
```
Run: `pnpm --filter @katran/effector test filters` → FAIL.

- [ ] **Step 2: Реализация**

`packages/effector/src/createFiltersModel.ts`:
```ts
import { combine, createEvent, createStore, sample, type Event, type Store } from 'effector'
import type { Condition, Filter, FilterMeta } from './types'

export type FiltersModelConfig = {
  meta?: FilterMeta | undefined
  initial?: Filter | undefined
}

export type FiltersModel = {
  /** Применённые условия — это и есть $filter для грида. */
  $conditions: Store<Filter>
  /** Черновик панели до нажатия «Применить». */
  $draft: Store<Filter>
  $dirty: Store<boolean>
  edit: Event<Condition>
  discard: Event<string>
  apply: Event<void>
  reset: Event<void>
  remove: Event<string>
  meta: FilterMeta | null
}

const upsert = (list: Filter, c: Condition): Filter => {
  const i = list.findIndex((x) => x.field === c.field)
  return i < 0 ? [...list, c] : list.map((x, j) => (j === i ? c : x))
}
const without = (list: Filter, field: string): Filter => list.filter((x) => x.field !== field)
const same = (a: Filter, b: Filter) => JSON.stringify(a) === JSON.stringify(b)

export function createFiltersModel({ meta, initial = [] }: FiltersModelConfig = {}): FiltersModel {
  const edit = createEvent<Condition>()
  const discard = createEvent<string>()
  const apply = createEvent<void>()
  const reset = createEvent<void>()
  const remove = createEvent<string>()

  const $conditions = createStore<Filter>(initial)
  const $draft = createStore<Filter>(initial)

  $draft.on(edit, upsert).on(discard, without).reset(reset)
  $conditions.on(remove, without).reset(reset)
  // apply: черновик → применённые; remove: применённые → черновик (чтобы панель не показывала снятое)
  sample({ clock: apply, source: $draft, target: $conditions })
  sample({ clock: remove, source: $conditions, target: $draft })

  const $dirty = combine($conditions, $draft, (c, d) => !same(c, d))

  return { $conditions, $draft, $dirty, edit, discard, apply, reset, remove, meta: meta ?? null }
}
```
В `index.ts` добавить `export { createFiltersModel, type FiltersModel, type FiltersModelConfig } from './createFiltersModel'`.

- [ ] **Step 3: Тесты проходят**

Run: `pnpm --filter @katran/effector test` → PASS (7). `pnpm lint` чистый (в зоне effector импорты `effector` разрешены).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "createFiltersModel: черновик и применённые условия, apply/remove/reset, fork-безопасно"
```

---

### Task 6: `createGridModel`

**Files:**
- Create: `packages/effector/src/createGridModel.ts`, `packages/effector/src/createGridModel.test.ts`
- Modify: `packages/effector/src/index.ts`

**Interfaces:**
- Consumes: `Filter`, `GridQuery`, `GridPage`, `PersistAdapter` (Task 4); `Sort`, `Selection`, `ColumnsState`, `GridViewState` из `@katran/ui` (Task 1).
- Consumes: `Selection`, `ColumnsState`, `GridViewState`, `Sort` — `import type` из `@katran/ui`.
- Produces:
```ts
type GridPersisted = { widths: Record<string, number>; order: string[]; hidden: string[]; pageSize: number }

createGridModel<Row>({
  id: string
  columns: { id: string; width?: number }[]
  pageSize?: number            // 20
  $filter: Store<Filter>
  fetchFx: Effect<GridQuery, GridPage<Row>>
  persist?: PersistAdapter<Partial<GridPersisted>>
  rowKey: (row: Row) => string
}) → GridModel<Row>
```
  Сторы: `$rows $total $page $pageSize $sort $widths $order $hidden $selection $state $error $query`.
  События: `sortBy(Sort) resize({id,width}) setColumns(ColumnsState) toggleColumn(id) moveColumn({id, dir:-1|1}) setPage(n) setPageSize(n) select({id,on}) selectPage({ids,on}) selectAll() clearSelection() retry() refresh()`. Эффект `fetchFx` — из конфига.
  Правила: `$filter` изменился → `$page=1`, выделение сброшено, запрос; `sortBy` → страница 1, запрос; `setPage`/`setPageSize` → запрос; `resize`/`setColumns`/`toggleColumn`/`moveColumn` → без запроса, `persist.save`; `retry`/`refresh` → запрос с текущими параметрами. `$state`: `loading` — pending и данных ещё не было; `refreshing` — pending и данные есть; `error` — последний запрос упал; иначе `ready`. `$query.page` — с нуля.

- [ ] **Step 1: Тест (падает)**

`packages/effector/src/createGridModel.test.ts`:
```ts
import { allSettled, createEffect, createStore, fork } from 'effector'
import { createGridModel } from './createGridModel'
import { memoryPersist } from './persist'
import type { Filter, GridPage, GridQuery } from './types'

type Row = { id: string; n: number }
const mk = (over: Partial<Parameters<typeof createGridModel<Row>>[0]> = {}) => {
  const calls: GridQuery[] = []
  const fetchFx = createEffect<GridQuery, GridPage<Row>>(async (q) => {
    calls.push(q)
    return { rows: [{ id: 'a', n: 1 }, { id: 'b', n: 2 }], total: 87 }
  })
  const $filter = createStore<Filter>([])
  const model = createGridModel<Row>({
    id: 'g', columns: [{ id: 'c1', width: 100 }, { id: 'c2' }, { id: 'c3' }], $filter, fetchFx, rowKey: (r) => r.id, ...over,
  })
  return { model, calls, fetchFx, $filter }
}

describe('createGridModel', () => {
  it('стартовое состояние: страница 1, размер 20, порядок из колонок, запроса ещё нет', () => {
    const { model } = mk()
    const scope = fork()
    expect(scope.getState(model.$page)).toBe(1)
    expect(scope.getState(model.$pageSize)).toBe(20)
    expect(scope.getState(model.$order)).toEqual(['c1', 'c2', 'c3'])
    expect(scope.getState(model.$hidden)).toEqual([])
    expect(scope.getState(model.$widths)).toEqual({ c1: 100 })
    expect(scope.getState(model.$state)).toBe('loading')
    expect(scope.getState(model.$selection)).toEqual({ mode: 'ids', ids: [] })
  })

  it('refresh → запрос с page 0; данные и total; state ready', async () => {
    const { model, calls } = mk()
    const scope = fork()
    await allSettled(model.refresh, { scope })
    expect(calls).toEqual([{ filter: [], sort: null, page: 0, size: 20 }])
    expect(scope.getState(model.$rows)).toHaveLength(2)
    expect(scope.getState(model.$total)).toBe(87)
    expect(scope.getState(model.$state)).toBe('ready')
  })

  it('смена фильтра → страница 1, выделение сброшено, запрос с фильтром', async () => {
    const { model, calls, $filter } = mk()
    const scope = fork()
    await allSettled(model.refresh, { scope })
    await allSettled(model.setPage, { scope, params: 3 })
    await allSettled(model.select, { scope, params: { id: 'a', on: true } })
    expect(scope.getState(model.$page)).toBe(3)
    const f: Filter = [{ field: 'status', op: 'EQ', value: 'ERROR' }]
    await allSettled($filter, { scope, params: f })
    expect(scope.getState(model.$page)).toBe(1)
    expect(scope.getState(model.$selection)).toEqual({ mode: 'ids', ids: [] })
    expect(calls.at(-1)).toEqual({ filter: f, sort: null, page: 0, size: 20 })
  })

  it('sortBy → страница 1 и запрос с sort; setPage → запрос с page-1', async () => {
    const { model, calls } = mk()
    const scope = fork()
    await allSettled(model.setPage, { scope, params: 4 })
    expect(calls.at(-1)?.page).toBe(3)
    await allSettled(model.sortBy, { scope, params: { key: 'amount', dir: 'desc' } })
    expect(scope.getState(model.$page)).toBe(1)
    expect(calls.at(-1)).toMatchObject({ sort: { key: 'amount', dir: 'desc' }, page: 0 })
  })

  it('resize/toggleColumn/moveColumn — без запроса, но с persist', async () => {
    const persist = memoryPersist<Partial<{ widths: Record<string, number>; order: string[]; hidden: string[]; pageSize: number }>>()
    const { model, calls } = mk({ persist })
    const scope = fork()
    await allSettled(model.resize, { scope, params: { id: 'c2', width: 150 } })
    await allSettled(model.toggleColumn, { scope, params: 'c3' })
    await allSettled(model.moveColumn, { scope, params: { id: 'c2', dir: -1 } })
    expect(calls).toEqual([])
    expect(scope.getState(model.$widths)).toEqual({ c1: 100, c2: 150 })
    expect(scope.getState(model.$hidden)).toEqual(['c3'])
    expect(scope.getState(model.$order)).toEqual(['c2', 'c1', 'c3'])
    expect(persist.load('g')).toEqual({ widths: { c1: 100, c2: 150 }, order: ['c2', 'c1', 'c3'], hidden: ['c3'], pageSize: 20 })
  })

  it('persist.load восстанавливает вид при создании', () => {
    const persist = memoryPersist<Partial<{ widths: Record<string, number>; order: string[]; hidden: string[]; pageSize: number }>>()
    persist.save('g', { order: ['c3', 'c1', 'c2'], hidden: ['c1'], pageSize: 50, widths: { c3: 77 } })
    const { model } = mk({ persist })
    const scope = fork()
    expect(scope.getState(model.$order)).toEqual(['c3', 'c1', 'c2'])
    expect(scope.getState(model.$hidden)).toEqual(['c1'])
    expect(scope.getState(model.$pageSize)).toBe(50)
    expect(scope.getState(model.$widths)).toEqual({ c1: 100, c3: 77 })
  })

  it('persist: неизвестные id колонок отбрасываются, новые — дописываются в конец', () => {
    const persist = memoryPersist<Partial<{ order: string[]; hidden: string[] }>>()
    persist.save('g', { order: ['zzz', 'c2'], hidden: ['zzz'] })
    const { model } = mk({ persist })
    const scope = fork()
    expect(scope.getState(model.$order)).toEqual(['c2', 'c1', 'c3'])
    expect(scope.getState(model.$hidden)).toEqual([])
  })

  it('выделение: select/selectPage/selectAll/clearSelection; сортировка и страница не сбрасывают', async () => {
    const { model } = mk()
    const scope = fork()
    await allSettled(model.select, { scope, params: { id: 'a', on: true } })
    await allSettled(model.selectPage, { scope, params: { ids: ['b', 'c'], on: true } })
    expect(scope.getState(model.$selection)).toEqual({ mode: 'ids', ids: ['a', 'b', 'c'] })
    await allSettled(model.select, { scope, params: { id: 'b', on: false } })
    expect(scope.getState(model.$selection)).toEqual({ mode: 'ids', ids: ['a', 'c'] })
    await allSettled(model.setPage, { scope, params: 2 })
    await allSettled(model.sortBy, { scope, params: { key: 'n', dir: 'asc' } })
    expect(scope.getState(model.$selection)).toEqual({ mode: 'ids', ids: ['a', 'c'] })
    await allSettled(model.selectAll, { scope })
    expect(scope.getState(model.$selection)).toEqual({ mode: 'all', except: [] })
    await allSettled(model.select, { scope, params: { id: 'a', on: false } })
    expect(scope.getState(model.$selection)).toEqual({ mode: 'all', except: ['a'] })
    await allSettled(model.clearSelection, { scope })
    expect(scope.getState(model.$selection)).toEqual({ mode: 'ids', ids: [] })
  })

  it('состояния: loading → ready → refreshing → error → retry', async () => {
    let fail = false
    const fetchFx = createEffect<GridQuery, GridPage<Row>>(async () => {
      if (fail) throw new Error('сервис не ответил')
      return { rows: [{ id: 'a', n: 1 }], total: 1 }
    })
    const { model } = mk({ fetchFx })
    const scope = fork()
    expect(scope.getState(model.$state)).toBe('loading')
    await allSettled(model.refresh, { scope })
    expect(scope.getState(model.$state)).toBe('ready')
    fail = true
    await allSettled(model.refresh, { scope })
    expect(scope.getState(model.$state)).toBe('error')
    expect(scope.getState(model.$error)).toBe('сервис не ответил')
    expect(scope.getState(model.$rows)).toHaveLength(1)
    fail = false
    await allSettled(model.retry, { scope })
    expect(scope.getState(model.$state)).toBe('ready')
    expect(scope.getState(model.$error)).toBeNull()
  })

  it('refreshing: пока идёт повторный запрос при наличии данных', async () => {
    let release: () => void = () => {}
    const fetchFx = createEffect<GridQuery, GridPage<Row>>(() => new Promise((r) => { release = () => r({ rows: [{ id: 'a', n: 1 }], total: 1 }) }))
    const { model } = mk({ fetchFx })
    const scope = fork()
    const first = allSettled(model.refresh, { scope })
    expect(scope.getState(model.$state)).toBe('loading')
    release(); await first
    const second = allSettled(model.refresh, { scope })
    expect(scope.getState(model.$state)).toBe('refreshing')
    release(); await second
    expect(scope.getState(model.$state)).toBe('ready')
  })
})
```
Run: `pnpm --filter @katran/effector test grid` → FAIL.

- [ ] **Step 2: Реализация**

`packages/effector/src/createGridModel.ts`:
```ts
import { combine, createEvent, createStore, sample, type Effect, type Event, type Store } from 'effector'
import type { ColumnsState, GridViewState, Selection, Sort } from '@katran/ui'
import type { Filter, GridPage, GridQuery, PersistAdapter } from './types'

export type GridPersisted = { widths: Record<string, number>; order: string[]; hidden: string[]; pageSize: number }

export type GridModelConfig<Row> = {
  id: string
  columns: { id: string; width?: number | undefined }[]
  pageSize?: number | undefined
  $filter: Store<Filter>
  fetchFx: Effect<GridQuery, GridPage<Row>>
  persist?: PersistAdapter<Partial<GridPersisted>> | undefined
  rowKey: (row: Row) => string
}

export type GridModel<Row> = {
  $rows: Store<Row[]>
  $total: Store<number>
  $page: Store<number>
  $pageSize: Store<number>
  $sort: Store<Sort>
  $widths: Store<Record<string, number>>
  $order: Store<string[]>
  $hidden: Store<string[]>
  $selection: Store<Selection>
  $state: Store<GridViewState>
  $error: Store<string | null>
  $query: Store<GridQuery>
  sortBy: Event<Sort>
  resize: Event<{ id: string; width: number }>
  setColumns: Event<ColumnsState>
  toggleColumn: Event<string>
  moveColumn: Event<{ id: string; dir: -1 | 1 }>
  setPage: Event<number>
  setPageSize: Event<number>
  select: Event<{ id: string; on: boolean }>
  selectPage: Event<{ ids: string[]; on: boolean }>
  selectAll: Event<void>
  clearSelection: Event<void>
  retry: Event<void>
  refresh: Event<void>
  fetchFx: Effect<GridQuery, GridPage<Row>>
  rowKey: (row: Row) => string
}

const EMPTY_SELECTION: Selection = { mode: 'ids', ids: [] }

/** Сохранённый порядок сверяется с реальными колонками: чужие id выбрасываются, новые дописываются в конец. */
function reconcileOrder(saved: string[] | undefined, ids: string[]): string[] {
  const known = new Set(ids)
  const kept = (saved ?? []).filter((id) => known.has(id))
  const seen = new Set(kept)
  return [...kept, ...ids.filter((id) => !seen.has(id))]
}

export function createGridModel<Row>(cfg: GridModelConfig<Row>): GridModel<Row> {
  const ids = cfg.columns.map((c) => c.id)
  const saved = cfg.persist?.load(cfg.id) ?? {}
  const initialWidths: Record<string, number> = {}
  for (const c of cfg.columns) if (c.width !== undefined) initialWidths[c.id] = c.width
  Object.assign(initialWidths, Object.fromEntries(Object.entries(saved.widths ?? {}).filter(([id]) => ids.includes(id))))

  const sortBy = createEvent<Sort>()
  const resize = createEvent<{ id: string; width: number }>()
  const setColumns = createEvent<ColumnsState>()
  const toggleColumn = createEvent<string>()
  const moveColumn = createEvent<{ id: string; dir: -1 | 1 }>()
  const setPage = createEvent<number>()
  const setPageSize = createEvent<number>()
  const select = createEvent<{ id: string; on: boolean }>()
  const selectPage = createEvent<{ ids: string[]; on: boolean }>()
  const selectAll = createEvent<void>()
  const clearSelection = createEvent<void>()
  const retry = createEvent<void>()
  const refresh = createEvent<void>()

  const $rows = createStore<Row[]>([])
  const $total = createStore(0)
  const $page = createStore(1)
  const $pageSize = createStore(saved.pageSize ?? cfg.pageSize ?? 20)
  const $sort = createStore<Sort>(null)
  const $widths = createStore<Record<string, number>>(initialWidths)
  const $order = createStore<string[]>(reconcileOrder(saved.order, ids))
  const $hidden = createStore<string[]>((saved.hidden ?? []).filter((id) => ids.includes(id)))
  const $selection = createStore<Selection>(EMPTY_SELECTION)
  const $error = createStore<string | null>(null)
  const $hasData = createStore(false)

  // --- вид ---
  $widths.on(resize, (w, { id, width }) => ({ ...w, [id]: Math.max(36, Math.round(width)) }))
  $order.on(setColumns, (_, { order }) => reconcileOrder(order, ids))
  $hidden.on(setColumns, (_, { hidden }) => hidden.filter((id) => ids.includes(id)))
  $hidden.on(toggleColumn, (h, id) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]))
  $order.on(moveColumn, (o, { id, dir }) => {
    const i = o.indexOf(id), j = i + dir
    if (i < 0 || j < 0 || j >= o.length) return o
    const next = o.slice(); next.splice(i, 1); next.splice(j, 0, id)
    return next
  })
  $pageSize.on(setPageSize, (_, n) => n)

  // --- выделение ---
  $selection
    .on(select, (s, { id, on }) => {
      if (s.mode === 'ids') return { mode: 'ids', ids: on ? (s.ids.includes(id) ? s.ids : [...s.ids, id]) : s.ids.filter((x) => x !== id) }
      return { mode: 'all', except: on ? s.except.filter((x) => x !== id) : (s.except.includes(id) ? s.except : [...s.except, id]) }
    })
    .on(selectPage, (s, { ids: page, on }) => {
      if (s.mode === 'ids') return { mode: 'ids', ids: on ? [...new Set([...s.ids, ...page])] : s.ids.filter((x) => !page.includes(x)) }
      return { mode: 'all', except: on ? s.except.filter((x) => !page.includes(x)) : [...new Set([...s.except, ...page])] }
    })
    .on(selectAll, () => ({ mode: 'all', except: [] }))
    .reset(clearSelection)

  // --- сортировка и страницы ---
  $sort.on(sortBy, (_, s) => s)
  $page.on(setPage, (_, n) => Math.max(1, n))
  // смена сортировки, фильтра или размера страницы → на первую страницу
  $page.reset(sortBy, setPageSize)
  sample({ clock: cfg.$filter, fn: () => 1, target: $page })
  sample({ clock: cfg.$filter, fn: () => EMPTY_SELECTION, target: $selection })

  const $query = combine(cfg.$filter, $sort, $page, $pageSize, (filter, sort, page, size): GridQuery => ({ filter, sort, page: page - 1, size }))

  // запрос: любое изменение запроса, refresh, retry
  sample({ clock: [cfg.$filter, sortBy, setPage, setPageSize, refresh, retry], source: $query, target: cfg.fetchFx })

  $rows.on(cfg.fetchFx.doneData, (_, p) => p.rows)
  $total.on(cfg.fetchFx.doneData, (_, p) => p.total)
  $hasData.on(cfg.fetchFx.doneData, () => true)
  $error.on(cfg.fetchFx.failData, (_, e) => (e instanceof Error ? e.message : String(e))).reset(cfg.fetchFx.done, retry)

  const $state = combine(cfg.fetchFx.pending, $hasData, $error, (pending, has, err): GridViewState =>
    pending ? (has ? 'refreshing' : 'loading') : err ? 'error' : has ? 'ready' : 'loading')

  // --- persist: вид без запроса ---
  if (cfg.persist) {
    const $persisted = combine($widths, $order, $hidden, $pageSize, (widths, order, hidden, pageSize): GridPersisted => ({ widths, order, hidden, pageSize }))
    const persist = cfg.persist
    sample({ clock: [resize, setColumns, toggleColumn, moveColumn, setPageSize], source: $persisted }).watch((v) => persist.save(cfg.id, v))
  }

  return {
    $rows, $total, $page, $pageSize, $sort, $widths, $order, $hidden, $selection, $state, $error, $query,
    sortBy, resize, setColumns, toggleColumn, moveColumn, setPage, setPageSize,
    select, selectPage, selectAll, clearSelection, retry, refresh,
    fetchFx: cfg.fetchFx, rowKey: cfg.rowKey,
  }
}
```
Примечание про `$state` до первого запроса: данных нет и запрос не идёт → `loading` (грид покажет скелетон; первый запрос приложение запускает `refresh`-ом при монтировании — так модель не стреляет в бек при создании, и её можно создать заранее). `.watch` для persist — побочный эффект вне scope: в тестах с `fork` `watch` на сэмпле срабатывает (вызов persist — не стор), это проверяет тест «resize/toggleColumn/moveColumn».

В `index.ts` добавить:
```ts
export { createGridModel, type GridModel, type GridModelConfig, type GridPersisted } from './createGridModel'
```

- [ ] **Step 3: Тесты проходят**

Run: `pnpm --filter @katran/effector test` → PASS (17). Если тест «refreshing» ловит `loading` вместо `refreshing` — проверить порядок: `$hasData` должен стать `true` после первого `doneData` до второго вызова; `expect` до `release()` второго запроса. Если `.watch` в scope не вызывается — заменить на `createEffect((v) => persist.save(...))` как target сэмпла (эффект исполняется в scope) и указать в отчёте. Если в тесте «смена фильтра» последний запрос уходит со старой страницей (сэмпл запроса прочитал `$query` до сброса `$page`) — заменить общий сэмпл на два: для `cfg.$filter` — `sample({ clock: cfg.$filter, source: { sort: $sort, size: $pageSize }, fn: ({ sort, size }, filter) => ({ filter, sort, page: 0, size }), target: cfg.fetchFx })`, для остальных клоков — прежний с `source: $query`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "createGridModel: состояние вида, запрос, выделение, состояния загрузки, persist"
```

---

### Task 7: Стили грида, `GridRecord`, `GridSkeleton`

**Files:**
- Create: `packages/ui/src/grid/Grid.module.css`, `packages/ui/src/grid/GridRecord.tsx`, `packages/ui/src/grid/GridSkeleton.tsx`, `packages/ui/src/grid/GridRecord.test.tsx`
- Modify: `packages/tokens/src/tokens.src.ts` (+ `pnpm gen`), `packages/ui/src/grid/index.ts`

**Interfaces:**
- Consumes: `ColumnDef`, `SpanDef`, `ResolvedSpan` (Task 1); `Skeleton.Line` из `../state`.
- Produces:
```ts
type SpanCell<Row> = { def: SpanDef<Row>; colStart: number; colSpan: number }
type CellProps = (r: number, c: number) => HTMLAttributes<HTMLTableCellElement>   // r — строка внутри записи (0 — основная), c — колонка (0 — служебная)
<GridRecord row rowKey visible spanRows lead selected? rowIndex cellProps? />      // <tbody> записи
<GridSkeleton visible spanRows rows rowIndexStart />                              // <tbody> × rows той же геометрии
fillSegments(segs: SpanCell[], colCount): Array<SpanCell | { filler: true; colSpan: number }>  // заполняет пропуски между сегментами
```
- Геометрия (спека 6.1): граница `--k-line` по нижнему краю записи (`tbody > tr:last-child > td`), внутри линий нет; ритм 8/3/8 px через токены `sp-2`/`sp-1`; контент ячейки клампится по `--k-lines` (1–3) × `--k-lh-1`; выделенная запись — фон `val-soft` на всех строках.

- [ ] **Step 1: Токены**

В `packages/tokens/src/tokens.src.ts` в `sizes` после `'swatch': 150` добавить `'grid-min-col': 36, 'grid-lead': 84, 'grid-rz': 7, 'menu-max-h': 320`. `pnpm gen`.

- [ ] **Step 2: Тест (падает)**

`packages/ui/src/grid/GridRecord.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { fillSegments, GridRecord } from './GridRecord'
import { GridSkeleton } from './GridSkeleton'
import type { ColumnDef, SpanDef } from './types'

type R = { id: string; st: string; num: string; purpose: string | null }
const row: R = { id: 'r1', st: 'ERROR', num: '800', purpose: 'Оплата по договору' }
const columns: ColumnDef<R>[] = [
  { id: 'st', render: (r) => r.st },
  { id: 'num', title: 'Номер', lines: 2, render: (r) => r.num },
  { id: 'f50', title: '50', render: () => 'ООО Ромашка' },
  { id: 'f59', title: '59', align: 'right', render: () => 'ЗАО Василёк' },
]
const purpose: SpanDef<R> = { id: 'purpose', from: 'f50', to: 'f59', render: (r) => r.purpose }
const reason: SpanDef<R> = { id: 'reason', from: 'st', to: 'num', render: () => null }
const spanRows = [[{ def: reason, colStart: 0, colSpan: 2 }, { def: purpose, colStart: 2, colSpan: 2 }]]

const Table = ({ children }: { children: React.ReactNode }) => <table role="grid">{children}</table>

describe('GridRecord', () => {
  it('запись = tbody из основной строки и строк сегментов; сегменты с colspan; пустой сегмент не закрашен', () => {
    renderK(<Table><GridRecord row={row} rowKey="r1" visible={columns} spanRows={spanRows} lead={<button>Открыть</button>} rowIndex={2} /></Table>)
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveAttribute('aria-rowindex', '2')
    expect(rows[1]).toHaveAttribute('aria-rowindex', '3')
    expect(within(rows[0]!).getAllByRole('gridcell')).toHaveLength(5) // служебная + 4
    const segCells = within(rows[1]!).getAllByRole('gridcell')
    expect(segCells).toHaveLength(3) // служебная + 2 сегмента
    expect(segCells[1]).toHaveAttribute('colspan', '2')
    expect(segCells[1]).toHaveAttribute('data-empty', 'true')
    expect(segCells[2]).toHaveTextContent('Оплата по договору')
  })
  it('кламп по lines и выравнивание вправо', () => {
    renderK(<Table><GridRecord row={row} rowKey="r1" visible={columns} spanRows={[]} lead={null} rowIndex={1} /></Table>)
    const cells = screen.getAllByRole('gridcell')
    expect(cells[2]!.firstElementChild).toHaveStyle({ '--k-lines': '2' })
    expect(cells[4]).toHaveAttribute('data-align', 'right')
  })
  it('выделение помечает обе строки', () => {
    renderK(<Table><GridRecord row={row} rowKey="r1" visible={columns} spanRows={spanRows} lead={null} rowIndex={1} selected /></Table>)
    screen.getAllByRole('row').forEach((r) => expect(r).toHaveAttribute('aria-selected', 'true'))
  })
  it('fillSegments закрывает пропуски заглушками', () => {
    const segs = [{ def: purpose, colStart: 2, colSpan: 1 }]
    expect(fillSegments(segs, 4)).toEqual([{ filler: true, colSpan: 2 }, segs[0], { filler: true, colSpan: 1 }])
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<Table><thead><tr><th></th>{columns.map((c) => <th key={c.id}>{c.title}</th>)}</tr></thead><GridRecord row={row} rowKey="r1" visible={columns} spanRows={spanRows} lead={<button>Открыть</button>} rowIndex={2} /></Table>)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('GridSkeleton', () => {
  it('столько же tbody и строк, сколько у записей; плашки скрыты от скринридера', () => {
    const { container } = renderK(<Table><GridSkeleton visible={columns} spanRows={spanRows} rows={3} rowIndexStart={1} /></Table>)
    expect(container.querySelectorAll('tbody')).toHaveLength(3)
    expect(screen.getAllByRole('row')).toHaveLength(6)
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
  })
})
```
Run: `pnpm --filter @katran/ui test GridRecord` → FAIL.

- [ ] **Step 3: CSS**

`packages/ui/src/grid/Grid.module.css`:
```css
.wrap {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.table {
  width: max-content;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-size: var(--k-fs-1);
  line-height: var(--k-lh-1);
  color: var(--k-ink);
}

/* --- шапка --- */
.th {
  position: sticky;
  top: 0;
  z-index: var(--k-z-sticky);
  padding: var(--k-sp-2) var(--k-sp-2) var(--k-sp-2);
  overflow: hidden;
  text-align: left;
  font: 600 var(--k-fs-1) / var(--k-lh-1) var(--k-sans);
  color: var(--k-ink);
  background: var(--k-paper);
  border-bottom: 1px solid var(--k-line);
  white-space: nowrap;
}

.thBtn {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  border-radius: var(--k-r-s);
}

.thBtn:hover { background: var(--k-hover); }
.thBtn:focus-visible { outline: 2px solid var(--k-val); outline-offset: 0; }
.sorted { color: var(--k-val); }

.thSub {
  display: block;
  min-height: var(--k-lh-2);
  overflow: hidden;
  font: 400 var(--k-fs-2) / var(--k-lh-2) var(--k-sans);
  color: var(--k-muted);
  text-overflow: ellipsis;
}

.arrow {
  margin-left: var(--k-sp-1);
  font-size: var(--k-fs-2);
  color: var(--k-faint);
}

/* ручка ресайза — настоящая кнопка: с клавиатуры стрелками */
.rz {
  position: absolute;
  top: 0;
  right: 0;
  width: var(--k-grid-rz);
  height: 100%;
  padding: 0;
  border: 0;
  background: none;
  cursor: col-resize;
  z-index: var(--k-z-sticky);
}

.rz::after {
  content: '';
  position: absolute;
  top: var(--k-sp-2);
  bottom: var(--k-sp-2);
  left: 50%;
  border-left: 1px solid var(--k-line);
}

.rz:hover::after,
.rz:focus-visible::after,
.rz[data-active="true"]::after {
  border-left: 2px solid var(--k-val);
}

.rz:focus-visible { outline: 0; }
.resizing { cursor: col-resize; user-select: none; }

/* --- запись --- */
.record > tr > td {
  padding: var(--k-sp-1) var(--k-sp-2) 0;
  vertical-align: top;
  overflow: hidden;
  white-space: nowrap;
}

.record > tr:first-child > td { padding-top: var(--k-sp-2); }
.record > tr:last-child > td { padding-bottom: var(--k-sp-2); border-bottom: 1px solid var(--k-line); }
.record > tr:hover > td { background: var(--k-hover); }
.selected > tr > td,
.selected > tr:hover > td { background: var(--k-val-soft); }

.clamp {
  max-height: calc(var(--k-lh-1) * var(--k-lines, 1));
  overflow: hidden;
}

.cell[data-align="right"] { text-align: right; }

.lead {
  display: flex;
  align-items: center;
  gap: var(--k-sp-1);
  width: var(--k-grid-lead);
  min-width: var(--k-grid-lead);
}

.ord {
  min-width: var(--k-sp-5);
  font: 400 var(--k-fs-3) / var(--k-lh-3) var(--k-mono);
  color: var(--k-faint);
  text-align: right;
}

.spanEmpty { min-height: var(--k-lh-2); }
.filler { padding: 0; }

td[tabindex]:focus-visible,
th[tabindex]:focus-visible { outline: 2px solid var(--k-val); outline-offset: -2px; }

/* --- состояния --- */
.dim { opacity: 0.55; pointer-events: none; transition: opacity var(--k-t-base); }
.stateRow > td { padding: 0; }
.progress { position: sticky; top: 0; z-index: var(--k-z-sticky); }
.foot { flex: none; }
```
`.lead` как `display: flex` на `<td>` ломает таблицу — поэтому `lead`-класс вешается на внутренний `div` внутри ячейки, а не на `td` (см. компонент). Если stylelint потребует `no-descending-specificity` — переставить правила без изменения каскада и указать в отчёте.

- [ ] **Step 4: Компоненты**

`packages/ui/src/grid/GridRecord.tsx`:
```tsx
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import s from './Grid.module.css'
import type { ColumnDef, SpanDef } from './types'

export type SpanCell<Row> = { def: SpanDef<Row>; colStart: number; colSpan: number }
export type Filler = { filler: true; colSpan: number }
/** Атрибуты ячейки от клавиатурного слоя: r — строка внутри записи (0 — основная), c — колонка (0 — служебная). */
export type CellProps = (r: number, c: number) => HTMLAttributes<HTMLTableCellElement>

export type GridRecordProps<Row> = {
  row: Row
  rowKey: string
  /** Видимые колонки в пользовательском порядке. */
  visible: ColumnDef<Row>[]
  /** Строки сегментов, уже разрешённые по видимому составу. */
  spanRows: SpanCell<Row>[][]
  /** Содержимое служебной ячейки: чекбокс, кнопка открытия, номер. */
  lead: ReactNode
  selected?: boolean | undefined
  /** aria-rowindex первой строки записи. */
  rowIndex: number
  cellProps?: CellProps | undefined
}

/** Между сегментами и по краям — заглушки, чтобы строка занимала всю ширину таблицы. */
export function fillSegments<Row>(segs: SpanCell<Row>[], colCount: number): Array<SpanCell<Row> | Filler> {
  const out: Array<SpanCell<Row> | Filler> = []
  let cursor = 0
  for (const seg of segs) {
    if (seg.colStart > cursor) out.push({ filler: true, colSpan: seg.colStart - cursor })
    out.push(seg)
    cursor = seg.colStart + seg.colSpan
  }
  if (cursor < colCount) out.push({ filler: true, colSpan: colCount - cursor })
  return out
}

export function GridRecord<Row>({ row, rowKey, visible, spanRows, lead, selected, rowIndex, cellProps }: GridRecordProps<Row>) {
  const cp = cellProps ?? (() => ({}))
  return (
    <tbody className={[s.record, selected ? s.selected : ''].filter(Boolean).join(' ')} data-key={rowKey}>
      <tr role="row" aria-rowindex={rowIndex} aria-selected={selected}>
        <td role="gridcell" className={s.cell} {...cp(0, 0)}><div className={s.lead}>{lead}</div></td>
        {visible.map((c, i) => (
          <td key={c.id} role="gridcell" className={s.cell} data-align={c.align} {...cp(0, i + 1)}>
            <div className={s.clamp} style={{ '--k-lines': String(c.lines ?? 1) } as CSSProperties}>{c.render(row)}</div>
          </td>
        ))}
      </tr>
      {spanRows.map((segs, si) => (
        <tr key={si} role="row" aria-rowindex={rowIndex + 1 + si} aria-selected={selected}>
          <td role="gridcell" className={s.cell} {...cp(si + 1, 0)} />
          {fillSegments(segs, visible.length).map((seg, k) => {
            if ('filler' in seg) return <td key={`f${k}`} className={s.filler} colSpan={seg.colSpan} aria-hidden="true" />
            const content = seg.def.render(row)
            return (
              <td key={seg.def.id} role="gridcell" className={s.cell} colSpan={seg.colSpan} data-empty={content == null ? 'true' : undefined} {...cp(si + 1, seg.colStart + 1)}>
                <div className={content == null ? s.spanEmpty : s.clamp} style={{ '--k-lines': String(seg.def.lines ?? 1) } as CSSProperties}>{content}</div>
              </td>
            )
          })}
        </tr>
      ))}
    </tbody>
  )
}
```
Заглушки-`td` без `role="gridcell"` и с `aria-hidden` — они не часть данных; счётчик `aria-colcount` в `DataGrid` считается по колонкам.

`packages/ui/src/grid/GridSkeleton.tsx`:
```tsx
import type { CSSProperties } from 'react'
import { Skeleton } from '../state'
import { fillSegments, type SpanCell } from './GridRecord'
import s from './Grid.module.css'
import type { ColumnDef } from './types'

export type GridSkeletonProps<Row> = {
  visible: ColumnDef<Row>[]
  spanRows: SpanCell<Row>[][]
  rows: number
  rowIndexStart: number
}

/** Скелетон повторяет геометрию записи по построению: те же строки, те же lines. */
export function GridSkeleton<Row>({ visible, spanRows, rows, rowIndexStart }: GridSkeletonProps<Row>) {
  const perRecord = 1 + spanRows.length
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tbody key={i} className={s.record}>
          <tr role="row" aria-rowindex={rowIndexStart + i * perRecord}>
            <td role="gridcell" className={s.cell}><div className={s.lead}><Skeleton.Line width={48} /></div></td>
            {visible.map((c) => (
              <td key={c.id} role="gridcell" className={s.cell}>
                <div className={s.clamp} style={{ '--k-lines': String(c.lines ?? 1) } as CSSProperties}><Skeleton.Line lines={c.lines ?? 1} width="70%" /></div>
              </td>
            ))}
          </tr>
          {spanRows.map((segs, si) => (
            <tr key={si} role="row" aria-rowindex={rowIndexStart + i * perRecord + 1 + si}>
              <td role="gridcell" className={s.cell} />
              {fillSegments(segs, visible.length).map((seg, k) =>
                'filler' in seg
                  ? <td key={`f${k}`} className={s.filler} colSpan={seg.colSpan} aria-hidden="true" />
                  : <td key={seg.def.id} role="gridcell" className={s.cell} colSpan={seg.colSpan}><div className={s.clamp}><Skeleton.Line lines={(seg.def.lines ?? 1) as 1 | 2} width="58%" /></div></td>,
              )}
            </tr>
          ))}
        </tbody>
      ))}
    </>
  )
}
```
В `index.ts` добавить `export { GridRecord, fillSegments, type GridRecordProps, type SpanCell, type CellProps } from './GridRecord'` и `export { GridSkeleton, type GridSkeletonProps } from './GridSkeleton'`.

- [ ] **Step 5: Тесты проходят, линт**

Run: `pnpm --filter @katran/ui test GridRecord && pnpm lint` → PASS (6). Возможные замечания: `jsx-a11y` может потребовать `scope` у `<th>` в тестовой таблице — добавить `scope="col"` в тест; `toHaveStyle({'--k-lines': '2'})` в jsdom работает через inline style — если нет, проверять `cells[2]!.firstElementChild?.getAttribute('style')` на `--k-lines: 2`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Грид: стили, запись из строки колонок и сквозных строк, скелетон той же геометрии"
```

---

### Task 8: `ColumnHeader` — сортировка и ресайз

**Files:**
- Create: `packages/ui/src/grid/ColumnHeader.tsx`, `packages/ui/src/grid/ColumnHeader.test.tsx`
- Modify: `packages/ui/src/grid/index.ts`

**Interfaces:**
- Consumes: `ColumnDef`, `Sort`, `SortKey` (Task 1); `defaultDir`, `findSortKey` (Task 2); `Menu` из `../overlay`.
- Produces:
```tsx
<ColumnHeader column sort onSort width onResize? cellProps? />
```
  `width` — px при плотности 1, применяется как `calc(Wpx * var(--k-density))`. Простая колонка (один ключ): клик → тот же ключ переключает направление, другой ключ — `defaultDir`. Составная: клик открывает `Menu` с ключами (`checked` у активного, `hint` — стрелка), пункт «Сбросить сортировку» при активном ключе этой колонки; выбранный ключ подписывается вместо `subtitle`. Ручка ресайза — `<button role="slider" aria-orientation="horizontal" aria-valuenow={width}>`: pointer-drag (`setPointerCapture`), с клавиатуры `←/→` шаг 8, `Shift` — 32; `minWidth` (по умолчанию 36) соблюдается. Заголовок без `sort` — обычный текст.

- [ ] **Step 1: Тест (падает)**

`packages/ui/src/grid/ColumnHeader.test.tsx`:
```tsx
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { ColumnHeader } from './ColumnHeader'
import type { ColumnDef, Sort } from './types'

type R = { a: number }
const simple: ColumnDef<R> = { id: 'amt', title: '32', subtitle: 'сумма', sort: [{ id: 'amount', label: 'Сумма', type: 'number' }], render: () => null }
const composite: ColumnDef<R> = {
  id: 'id', title: 'ID', subtitle: '№ · 20 вх / исх',
  sort: [{ id: 'docNumber', label: 'Номер документа', type: 'number' }, { id: 'refIn', label: '20 вх' }, { id: 'refOut', label: '20 исх' }],
  render: () => null,
}
const plain: ColumnDef<R> = { id: 'x', title: 'Тип', render: () => null }
const Table = ({ children }: { children: React.ReactNode }) => <table role="grid"><thead><tr role="row">{children}</tr></thead></table>

describe('ColumnHeader', () => {
  it('простая колонка: первый клик — направление по типу, второй — переключение', async () => {
    const onSort = vi.fn()
    const { rerender } = renderK(<Table><ColumnHeader column={simple} sort={null} onSort={onSort} width={120} /></Table>)
    await userEvent.click(screen.getByRole('button', { name: /32/ }))
    expect(onSort).toHaveBeenLastCalledWith({ key: 'amount', dir: 'desc' })
    rerender(<Table><ColumnHeader column={simple} sort={{ key: 'amount', dir: 'desc' }} onSort={onSort} width={120} /></Table>)
    await userEvent.click(screen.getByRole('button', { name: /32/ }))
    expect(onSort).toHaveBeenLastCalledWith({ key: 'amount', dir: 'asc' })
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending')
  })

  it('составная колонка: меню ключей, выбранный подписан вместо subtitle, сброс', async () => {
    const onSort = vi.fn()
    const sort: Sort = { key: 'refIn', dir: 'asc' }
    renderK(<Table><ColumnHeader column={composite} sort={sort} onSort={onSort} width={160} /></Table>)
    expect(screen.getByRole('columnheader')).toHaveTextContent('20 вх')
    expect(screen.getByRole('columnheader')).not.toHaveTextContent('№ · 20 вх / исх')
    await userEvent.click(screen.getByRole('button', { name: /ID/ }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitemcheckbox', { name: /20 вх/ })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(within(menu).getByRole('menuitemcheckbox', { name: /Номер документа/ }))
    expect(onSort).toHaveBeenLastCalledWith({ key: 'docNumber', dir: 'desc' })
    await userEvent.click(screen.getByRole('button', { name: /ID/ }))
    await userEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Сбросить сортировку' }))
    expect(onSort).toHaveBeenLastCalledWith(null)
  })

  it('без sort — не кнопка', () => {
    renderK(<Table><ColumnHeader column={plain} sort={null} onSort={() => {}} width={80} /></Table>)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('columnheader')).toHaveTextContent('Тип')
  })

  it('ресайз: перетаскивание и клавиатура с минимумом', async () => {
    const onResize = vi.fn()
    renderK(<Table><ColumnHeader column={plain} sort={null} onSort={() => {}} width={80} onResize={onResize} /></Table>)
    const h = screen.getByRole('slider', { name: 'Ширина колонки Тип' })
    expect(h).toHaveAttribute('aria-valuenow', '80')
    fireEvent.pointerDown(h, { clientX: 100, pointerId: 1 })
    fireEvent.pointerMove(h, { clientX: 130, pointerId: 1 })
    expect(onResize).toHaveBeenLastCalledWith(110)
    fireEvent.pointerMove(h, { clientX: 0, pointerId: 1 })
    expect(onResize).toHaveBeenLastCalledWith(36)
    fireEvent.pointerUp(h, { pointerId: 1 })
    h.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onResize).toHaveBeenLastCalledWith(88)
    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}')
    expect(onResize).toHaveBeenLastCalledWith(48)
  })

  it('без нарушений axe', async () => {
    const { container } = renderK(<Table><ColumnHeader column={simple} sort={null} onSort={() => {}} width={120} onResize={() => {}} /><ColumnHeader column={composite} sort={null} onSort={() => {}} width={160} /></Table>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```
Run: `pnpm --filter @katran/ui test ColumnHeader` → FAIL.

- [ ] **Step 2: Реализация**

`packages/ui/src/grid/ColumnHeader.tsx`:
```tsx
import { useRef, useState, type CSSProperties, type HTMLAttributes, type KeyboardEvent, type PointerEvent } from 'react'
import { Menu, type MenuItem } from '../overlay'
import { defaultDir, findSortKey } from './sortRows'
import s from './Grid.module.css'
import type { ColumnDef, Sort } from './types'

export type ColumnHeaderProps<Row> = {
  column: ColumnDef<Row>
  sort: Sort
  onSort: (sort: Sort) => void
  /** Ширина в px при плотности 1. */
  width: number
  onResize?: ((width: number) => void) | undefined
  cellProps?: HTMLAttributes<HTMLTableCellElement> | undefined
}

const MIN_DEFAULT = 36
const STEP = 8
const STEP_SHIFT = 32

export function ColumnHeader<Row>({ column, sort, onSort, width, onResize, cellProps }: ColumnHeaderProps<Row>) {
  const keys = column.sort ?? []
  const active = sort && keys.find((k) => k.id === sort.key)
  const [menuOpen, setMenuOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const drag = useRef<{ x: number; w: number } | null>(null)
  const min = column.minWidth ?? MIN_DEFAULT
  const title = column.title ?? ''
  const name = column.menuTitle ?? title

  const pick = (keyId: string) => {
    const key = findSortKey([column], keyId)
    if (!key) return
    onSort(sort && sort.key === keyId ? { key: keyId, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key: keyId, dir: defaultDir(key) })
  }
  const onHeadClick = () => {
    if (keys.length === 1) pick(keys[0]!.id)
    else if (keys.length > 1) setMenuOpen(true)
  }

  const items: MenuItem[] = [
    ...keys.map((k) => ({ id: k.id, label: k.label, checked: active?.id === k.id, hint: active?.id === k.id ? (sort!.dir === 'asc' ? '↑' : '↓') : undefined, onSelect: () => pick(k.id) })),
    ...(active ? [{ id: '__reset', label: 'Сбросить сортировку', onSelect: () => onSort(null) }] : []),
  ]

  const clamp = (w: number) => Math.max(min, Math.round(w))
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    drag.current = { x: e.clientX, w: width }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    e.currentTarget.dataset.active = 'true'
  }
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current || !onResize) return
    onResize(clamp(drag.current.w + e.clientX - drag.current.x))
  }
  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    drag.current = null
    delete e.currentTarget.dataset.active
  }
  const onHandleKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!onResize) return
    const step = e.shiftKey ? STEP_SHIFT : STEP
    if (e.key === 'ArrowRight') { e.preventDefault(); onResize(clamp(width + step)) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); onResize(clamp(width - step)) }
  }

  const arrow = active ? (sort!.dir === 'asc' ? '↑' : '↓') : '↕'
  const ariaSort = active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : keys.length ? 'none' : undefined
  const sub = active && keys.length > 1 ? active.label : column.subtitle

  return (
    <th
      role="columnheader"
      scope="col"
      aria-sort={ariaSort}
      className={[s.th, active ? s.sorted : ''].filter(Boolean).join(' ')}
      style={{ width: `calc(${width}px * var(--k-density))` } as CSSProperties}
      {...cellProps}
    >
      {keys.length > 0 ? (
        <button ref={btn} type="button" className={s.thBtn} onClick={onHeadClick} aria-haspopup={keys.length > 1 ? 'menu' : undefined} aria-expanded={keys.length > 1 ? menuOpen : undefined}>
          {title}<span className={s.arrow} aria-hidden="true">{arrow}</span>
          <span className={s.thSub}>{sub}</span>
        </button>
      ) : (
        <>
          {title}
          <span className={s.thSub}>{column.subtitle}</span>
        </>
      )}
      {keys.length > 1 && <Menu open={menuOpen} anchor={btn} onClose={() => setMenuOpen(false)} items={items} title={`Сортировать «${name}» по`} />}
      {(column.resizable ?? true) && onResize && (
        <button
          type="button"
          role="slider"
          aria-orientation="horizontal"
          aria-label={`Ширина колонки ${name}`}
          aria-valuenow={width}
          aria-valuemin={min}
          className={s.rz}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onHandleKey}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </th>
  )
}
```
`role="slider"` на `<button>`: у ручки есть значение (`aria-valuenow`), и оно меняется стрелками; `separator` не годится — `jsx-a11y` не моделирует фокусируемый separator и потребовал бы отключения правила. Ориентация `horizontal` — значение меняется стрелками влево/вправо (спека 6.3). `hint: undefined` при `exactOptionalPropertyTypes` допустим — `MenuItem.hint?: string | undefined`.

В `index.ts` добавить `export { ColumnHeader, type ColumnHeaderProps } from './ColumnHeader'`.

- [ ] **Step 3: Тесты проходят**

Run: `pnpm --filter @katran/ui test ColumnHeader && pnpm lint` → PASS (5). Если `fireEvent.pointerMove` в jsdom не несёт `clientX` — использовать `fireEvent(h, new MouseEvent('pointermove', { clientX: 130, bubbles: true }))`; `setPointerCapture` в jsdom отсутствует — поэтому вызов с `?.`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Грид: заголовок колонки — сортировка кликом и меню ключей, ручка ресайза с клавиатурой"
```

---

### Task 9: `ColumnsMenu` — состав колонок

**Files:**
- Create: `packages/ui/src/grid/ColumnsMenu.tsx`, `packages/ui/src/grid/ColumnsMenu.test.tsx`
- Modify: `packages/ui/src/grid/index.ts`

**Interfaces:**
- Consumes: `Popover` из `../overlay`, `Input`, `Checkbox` из `../input`, `IconButton` из `../button`.
- Produces:
```tsx
<ColumnsMenu open anchor onClose columns order hidden onChange({ order, hidden }) />
```
  Список всех колонок в порядке `order` (колонки вне `order` — в конец), с поиском по `title`/`menuTitle`, галочкой «показать» и кнопками «вверх»/«вниз» (крайние недоступны). Последнюю видимую колонку скрыть нельзя (галочка недоступна). Каждое действие сразу вызывает `onChange`.

- [ ] **Step 1: Тест (падает)**

`packages/ui/src/grid/ColumnsMenu.test.tsx`:
```tsx
import { useRef, useState } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { ColumnsMenu } from './ColumnsMenu'
import type { ColumnDef, ColumnsState } from './types'

type R = { a: number }
const columns: ColumnDef<R>[] = [
  { id: 'st', menuTitle: 'Статус', render: () => null },
  { id: 'id', title: 'ID', render: () => null },
  { id: 'dt', title: 'Дата', render: () => null },
]

function Host({ onChange }: { onChange: (s: ColumnsState) => void }) {
  const [open, setOpen] = useState(true)
  const [st, setSt] = useState<ColumnsState>({ order: ['st', 'id', 'dt'], hidden: [] })
  const a = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={a} onClick={() => setOpen(true)}>Колонки</button>
      <ColumnsMenu open={open} anchor={a} onClose={() => setOpen(false)} columns={columns} order={st.order} hidden={st.hidden} onChange={(s) => { setSt(s); onChange(s) }} />
    </>
  )
}

describe('ColumnsMenu', () => {
  it('список в порядке order, галочки, скрытие и показ', async () => {
    const onChange = vi.fn()
    renderK(<Host onChange={onChange} />)
    const dialog = screen.getByRole('dialog', { name: 'Состав колонок' })
    const boxes = within(dialog).getAllByRole('checkbox')
    expect(boxes.map((b) => b.getAttribute('aria-label'))).toEqual(['Статус', 'ID', 'Дата'])
    await userEvent.click(boxes[1]!)
    expect(onChange).toHaveBeenLastCalledWith({ order: ['st', 'id', 'dt'], hidden: ['id'] })
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'ID' }))
    expect(onChange).toHaveBeenLastCalledWith({ order: ['st', 'id', 'dt'], hidden: [] })
  })
  it('перенос вверх/вниз; крайние кнопки недоступны', async () => {
    const onChange = vi.fn()
    renderK(<Host onChange={onChange} />)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Статус — выше' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Дата — ниже' })).toBeDisabled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Дата — выше' }))
    expect(onChange).toHaveBeenLastCalledWith({ order: ['st', 'dt', 'id'], hidden: [] })
  })
  it('поиск фильтрует список; последнюю видимую скрыть нельзя', async () => {
    const onChange = vi.fn()
    renderK(<Host onChange={onChange} />)
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Поиск колонки' }), 'дат')
    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(1)
    await userEvent.clear(within(dialog).getByRole('textbox', { name: 'Поиск колонки' }))
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Статус' }))
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'ID' }))
    expect(within(dialog).getByRole('checkbox', { name: 'Дата' })).toBeDisabled()
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<Host onChange={() => {}} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```
Run: `pnpm --filter @katran/ui test ColumnsMenu` → FAIL.

- [ ] **Step 2: Реализация**

`packages/ui/src/grid/ColumnsMenu.tsx`:
```tsx
import { useState, type RefObject } from 'react'
import { IconButton } from '../button'
import { Checkbox, Input } from '../input'
import { Popover } from '../overlay'
import s from './Grid.module.css'
import type { ColumnDef, ColumnsState } from './types'

export type ColumnsMenuProps<Row> = {
  open: boolean
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  columns: ColumnDef<Row>[]
  order: string[]
  hidden: string[]
  onChange: (state: ColumnsState) => void
}

const Up = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 10l4-4 4 4" /></svg>
const Down = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6l4 4 4-4" /></svg>

const nameOf = <Row,>(c: ColumnDef<Row>) => c.menuTitle ?? c.title ?? c.id

/** Состав и порядок колонок: галочки + перенос кнопками — работает с клавиатуры из коробки (спека 6.3). */
export function ColumnsMenu<Row>({ open, anchor, onClose, columns, order, hidden, onChange }: ColumnsMenuProps<Row>) {
  const [q, setQ] = useState('')
  const byId = new Map(columns.map((c) => [c.id, c]))
  const full = [...order.filter((id) => byId.has(id)), ...columns.map((c) => c.id).filter((id) => !order.includes(id))]
  const visibleCount = full.filter((id) => !hidden.includes(id)).length
  const shown = full.filter((id) => nameOf(byId.get(id)!).toLowerCase().includes(q.trim().toLowerCase()))

  const toggle = (id: string) => onChange({ order: full, hidden: hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id] })
  const move = (id: string, dir: -1 | 1) => {
    const i = full.indexOf(id), j = i + dir
    if (j < 0 || j >= full.length) return
    const next = full.slice(); next.splice(i, 1); next.splice(j, 0, id)
    onChange({ order: next, hidden })
  }

  return (
    <Popover open={open} anchor={anchor} onClose={onClose} label="Состав колонок" className={s.colsMenu}>
      <Input size="s" aria-label="Поиск колонки" placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className={s.colsList}>
        {shown.map((id) => {
          const c = byId.get(id)!
          const name = nameOf(c)
          const isHidden = hidden.includes(id)
          const i = full.indexOf(id)
          return (
            <li key={id} className={s.colsItem}>
              <Checkbox aria-label={name} checked={!isHidden} disabled={!isHidden && visibleCount === 1} onChange={() => toggle(id)} />
              <span className={s.colsName}>{name}</span>
              <IconButton size="s" label={`${name} — выше`} disabled={i === 0} onClick={() => move(id, -1)}><Up /></IconButton>
              <IconButton size="s" label={`${name} — ниже`} disabled={i === full.length - 1} onClick={() => move(id, 1)}><Down /></IconButton>
            </li>
          )
        })}
      </ul>
    </Popover>
  )
}
```
В `Grid.module.css` добавить:
```css
.colsMenu { display: grid; gap: var(--k-sp-2); padding: var(--k-sp-2); min-width: var(--k-side); }
.colsList { max-height: var(--k-menu-max-h); margin: 0; padding: 0; overflow: auto; list-style: none; }
.colsItem { display: flex; align-items: center; gap: var(--k-sp-2); height: var(--k-h-ctl-m); }
.colsName { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```
В `index.ts` добавить `export { ColumnsMenu, type ColumnsMenuProps } from './ColumnsMenu'`.

- [ ] **Step 3: Тесты проходят**

Run: `pnpm --filter @katran/ui test ColumnsMenu && pnpm lint` → PASS (4). `Popover` с `label` даёт `role="dialog"` с именем — `getByRole('dialog', { name: 'Состав колонок' })`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Грид: меню состава колонок — поиск, показ/скрытие, перенос вверх/вниз"
```

---

### Task 10: `DataGrid` — композиция, состояния, выделение, открытие, пагинация

**Files:**
- Create: `packages/ui/src/grid/DataGrid.tsx`, `packages/ui/src/grid/DataGrid.test.tsx`
- Modify: `packages/ui/src/grid/Grid.module.css`, `packages/ui/src/grid/index.ts`

**Interfaces:**
- Consumes: всё из Tasks 1–3, 7–9; `Checkbox`, `IconButton`, `Pagination`, `ProgressBar`, `EmptyState`, `ErrorState`, `useLoadingGate`.
- Produces:
```tsx
export type DataGridProps<Row> = {
  label: string                                   // aria-label грида
  layout: RecordLayout<Row>
  rows: Row[]
  total: number
  page: number; pageSize: number; onPage: (n: number) => void
  pageSizes?: number[]; onPageSize?: (n: number) => void
  sort: Sort; onSort: (s: Sort) => void
  widths: Record<string, number>; onResize: (p: { id: string; width: number }) => void
  order: string[]; hidden: string[]; onColumns: (s: ColumnsState) => void
  selection?: Selection; onSelect?: (p: { id: string; on: boolean }) => void; onSelectPage?: (p: { ids: string[]; on: boolean }) => void
  state: GridViewState; error?: string | null; onRetry?: () => void
  emptyTitle?: string; emptyAction?: { label: string; onClick: () => void }
  onOpen?: (row: Row, opts: { secondary: boolean }) => void
  skeletonRows?: number                           // 8
}
```
  Служебная колонка `__lead`: чекбокс записи (если передан `selection`), кнопка «Открыть» (если `onOpen`; клик с `e.detail >= 2` — `secondary: true`), порядковый номер на странице. Шапка служебной колонки: трёхпозиционный чекбокс страницы и кнопка «Состав колонок» (открывает `ColumnsMenu`). Ширина колонки = `widths[id] ?? column.width ?? 120`; ширина таблицы — сумма (+ `grid-lead`). `aria-rowcount = 1 + total × (1 + spans.length)`, `aria-colcount = 1 + visible.length`. Состояния: `loading` → скелетон после `useLoadingGate`; `refreshing` → `ProgressBar` над таблицей и класс `dim` на данных; `ready` без строк → `EmptyState`; `error` → `ErrorState` с «Повторить».

- [ ] **Step 1: Тест (падает)**

`packages/ui/src/grid/DataGrid.test.tsx`:
```tsx
import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { DataGrid, type DataGridProps } from './DataGrid'
import type { RecordLayout } from './types'

type Doc = { id: string; status: string; num: string; amount: number; purpose: string | null }
const docs: Doc[] = [
  { id: 'd1', status: 'ERROR', num: '800', amount: 12.5, purpose: 'Оплата' },
  { id: 'd2', status: 'DONE', num: '801', amount: 1000, purpose: null },
]
const layout: RecordLayout<Doc> = {
  rowKey: (d) => d.id,
  columns: [
    { id: 'status', menuTitle: 'Статус', width: 60, sort: [{ id: 'status', label: 'Статус' }, { id: 'reason', label: 'Причина' }], render: (d) => d.status },
    { id: 'num', title: 'Номер', width: 90, sort: [{ id: 'num', label: 'Номер', type: 'number' }], render: (d) => d.num },
    { id: 'amount', title: '32', subtitle: 'сумма', align: 'right', width: 100, render: (d) => String(d.amount) },
  ],
  spans: [[{ id: 'purpose', from: 'num', to: 'amount', render: (d) => d.purpose }]],
}
const base = (over: Partial<DataGridProps<Doc>> = {}): DataGridProps<Doc> => ({
  label: 'Документы', layout, rows: docs, total: 87, page: 1, pageSize: 20, onPage: vi.fn(),
  sort: null, onSort: vi.fn(), widths: {}, onResize: vi.fn(), order: ['status', 'num', 'amount'], hidden: [], onColumns: vi.fn(),
  state: 'ready', ...over,
})

describe('DataGrid', () => {
  it('сетка с именем, шапка в порядке колонок, записи с номерами, счётчики строк/колонок', () => {
    renderK(<DataGrid {...base()} />)
    const grid = screen.getByRole('grid', { name: 'Документы' })
    expect(grid).toHaveAttribute('aria-colcount', '4')
    expect(grid).toHaveAttribute('aria-rowcount', String(1 + 87 * 2))
    const heads = screen.getAllByRole('columnheader')
    expect(heads.map((h) => h.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Номер'), expect.stringContaining('32')]))
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(1 + 2 * 2)
    expect(rows[1]).toHaveTextContent('1')
    expect(rows[3]).toHaveTextContent('2')
    expect(within(rows[2]!).getAllByRole('gridcell')[1]).toHaveTextContent('Оплата')
    expect(screen.getByRole('navigation', { name: 'Страницы' })).toHaveTextContent('1–20 из 87')
  })

  it('скрытая колонка не рендерится, сегмент сжимается; ширины из widths', () => {
    renderK(<DataGrid {...base({ hidden: ['amount'], widths: { num: 150 } })} />)
    expect(screen.queryByRole('columnheader', { name: /32/ })).toBeNull()
    const seg = within(screen.getAllByRole('row')[2]!).getAllByRole('gridcell')[1]
    expect(seg).toHaveAttribute('colspan', '1')
    expect(screen.getByRole('columnheader', { name: /Номер/ })).toHaveStyle({ width: 'calc(150px * var(--k-density))' })
  })

  it('сортировка и ресайз пробрасываются наружу', async () => {
    const p = base()
    renderK(<DataGrid {...p} />)
    await userEvent.click(screen.getByRole('button', { name: /Номер/ }))
    expect(p.onSort).toHaveBeenCalledWith({ key: 'num', dir: 'desc' })
    const h = screen.getByRole('slider', { name: 'Ширина колонки Номер' })
    h.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(p.onResize).toHaveBeenCalledWith({ id: 'num', width: 98 })
  })

  it('состав колонок через меню в шапке', async () => {
    const p = base()
    renderK(<DataGrid {...p} />)
    await userEvent.click(screen.getByRole('button', { name: 'Состав колонок' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('checkbox', { name: '32' }))
    expect(p.onColumns).toHaveBeenCalledWith({ order: ['status', 'num', 'amount'], hidden: ['amount'] })
  })

  it('выделение: чекбокс записи, трёхпозиционный чекбокс страницы, подсветка', async () => {
    const p = base({ selection: { mode: 'ids', ids: ['d1'] }, onSelect: vi.fn(), onSelectPage: vi.fn() })
    renderK(<DataGrid {...p} />)
    const head = screen.getByRole('checkbox', { name: 'Выбрать все на странице' }) as HTMLInputElement
    expect(head.indeterminate).toBe(true)
    expect(screen.getAllByRole('row')[1]).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Выбрать запись 2' }))
    expect(p.onSelect).toHaveBeenCalledWith({ id: 'd2', on: true })
    await userEvent.click(head)
    expect(p.onSelectPage).toHaveBeenCalledWith({ ids: ['d1', 'd2'], on: true })
  })

  it('открытие: кнопка, запись не кликабельна; второй клик — secondary', async () => {
    const p = base({ onOpen: vi.fn() })
    renderK(<DataGrid {...p} />)
    await userEvent.click(screen.getAllByRole('row')[1]!)
    expect(p.onOpen).not.toHaveBeenCalled()
    const btn = screen.getByRole('button', { name: 'Открыть запись 1' })
    fireEvent.click(btn, { detail: 1 })
    expect(p.onOpen).toHaveBeenLastCalledWith(docs[0], { secondary: false })
    fireEvent.click(btn, { detail: 2 })
    expect(p.onOpen).toHaveBeenLastCalledWith(docs[0], { secondary: true })
  })

  it('состояния: loading → скелетон после порога; refreshing → прогресс и приглушение; empty; error', async () => {
    vi.useFakeTimers()
    const { rerender } = renderK(<DataGrid {...base({ rows: [], state: 'loading' })} />)
    expect(document.querySelectorAll('tbody')).toHaveLength(0)   // до порога 200 мс — только шапка
    act(() => { vi.advanceTimersByTime(250) })
    expect(document.querySelectorAll('tbody').length).toBe(8)
    vi.useRealTimers()
    rerender(<DataGrid {...base({ state: 'refreshing' })} />)
    expect(screen.getByRole('progressbar', { name: 'Обновление данных' })).toBeInTheDocument()
    expect(screen.getByRole('grid')).toHaveAttribute('data-dim', 'true')
    rerender(<DataGrid {...base({ rows: [], total: 0, emptyAction: { label: 'Сбросить фильтр', onClick: () => {} } })} />)
    expect(screen.getByText('По заданным условиям записей нет')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Сбросить фильтр' })).toBeInTheDocument()
    const onRetry = vi.fn()
    rerender(<DataGrid {...base({ state: 'error', error: 'сервис не ответил', onRetry })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('сервис не ответил')
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('без нарушений axe', async () => {
    const { container } = renderK(<DataGrid {...base({ selection: { mode: 'ids', ids: [] }, onSelect: () => {}, onSelectPage: () => {}, onOpen: () => {} })} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```
Run: `pnpm --filter @katran/ui test DataGrid` → FAIL.

- [ ] **Step 2: Реализация**

`packages/ui/src/grid/DataGrid.tsx`:
```tsx
import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { IconButton } from '../button'
import { Checkbox } from '../input'
import { Pagination } from '../pagination'
import { EmptyState, ErrorState, ProgressBar, useLoadingGate } from '../state'
import { ColumnHeader } from './ColumnHeader'
import { ColumnsMenu } from './ColumnsMenu'
import { GridRecord, type CellProps, type SpanCell } from './GridRecord'
import { GridSkeleton } from './GridSkeleton'
import { resolveSpans, visibleColumns } from './resolveSpans'
import { isSelected, pageState } from './selection'
import s from './Grid.module.css'
import type { ColumnsState, GridViewState, RecordLayout, Selection, Sort } from './types'

export type DataGridProps<Row> = {
  /** Доступное имя сетки. */
  label: string
  layout: RecordLayout<Row>
  rows: Row[]
  total: number
  page: number
  pageSize: number
  onPage: (n: number) => void
  pageSizes?: number[] | undefined
  onPageSize?: ((n: number) => void) | undefined
  sort: Sort
  onSort: (s: Sort) => void
  widths: Record<string, number>
  onResize: (p: { id: string; width: number }) => void
  order: string[]
  hidden: string[]
  onColumns: (s: ColumnsState) => void
  selection?: Selection | undefined
  onSelect?: ((p: { id: string; on: boolean }) => void) | undefined
  onSelectPage?: ((p: { ids: string[]; on: boolean }) => void) | undefined
  state: GridViewState
  error?: string | null | undefined
  onRetry?: (() => void) | undefined
  emptyTitle?: string | undefined
  emptyAction?: { label: string; onClick: () => void } | undefined
  /** Второй клик по кнопке (e.detail ≥ 2) — secondary: второй drawer рядом. */
  onOpen?: ((row: Row, opts: { secondary: boolean }) => void) | undefined
  skeletonRows?: number | undefined
  /** Клавиатурный слой (Task 11). */
  cellProps?: ((rowIndex: number, r: number, c: number) => React.HTMLAttributes<HTMLTableCellElement>) | undefined
}

const DEFAULT_WIDTH = 120
const LEAD_WIDTH = 84

const Cols = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="1" /><path d="M6 3v10M10 3v10" /></svg>
const Open = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" /><path d="M6 8h4M8 6v4" /></svg>

export function DataGrid<Row>(p: DataGridProps<Row>) {
  const { layout, rows, page, pageSize, selection, state } = p
  const visible = useMemo(() => visibleColumns(p.order, p.hidden, layout.columns), [p.order, p.hidden, layout.columns])
  const fullOrder = useMemo(() => visibleColumns(p.order, [], layout.columns).map((c) => c.id), [p.order, layout.columns])
  const visibleIds = useMemo(() => visible.map((c) => c.id), [visible])
  const spanRows = useMemo<SpanCell<Row>[][]>(
    () => (layout.spans ?? []).map((line) => {
      const resolved = resolveSpans(line as never, visibleIds, fullOrder)
      return resolved.map((r) => ({ def: line.find((d) => d.id === r.id)!, colStart: r.colStart, colSpan: r.colSpan }))
    }),
    [layout.spans, visibleIds, fullOrder],
  )
  const perRecord = 1 + spanRows.length
  const widthOf = (id: string, fallback: number | undefined) => p.widths[id] ?? fallback ?? DEFAULT_WIDTH
  const tableWidth = LEAD_WIDTH + visible.reduce((sum, c) => sum + widthOf(c.id, c.width), 0)

  const [colsOpen, setColsOpen] = useState(false)
  const colsBtn = useRef<HTMLButtonElement>(null)

  const ids = rows.map(layout.rowKey)
  const pageSel = selection ? pageState(selection, ids) : 'none'
  const showSkeleton = useLoadingGate(state === 'loading')
  const dim = state === 'refreshing'
  const empty = state === 'ready' && rows.length === 0
  const cp = (rowIndex: number): CellProps | undefined => (p.cellProps ? (r, c) => p.cellProps!(rowIndex, r, c) : undefined)

  return (
    <div className={s.root}>
      <div className={s.wrap}>
        {dim && <div className={s.progress}><ProgressBar label="Обновление данных" /></div>}
        <table
          role="grid"
          aria-label={p.label}
          aria-rowcount={1 + p.total * perRecord}
          aria-colcount={1 + visible.length}
          data-dim={dim || undefined}
          className={[s.table, dim ? s.dim : ''].filter(Boolean).join(' ')}
          style={{ width: `calc(${tableWidth}px * var(--k-density))` } as CSSProperties}
        >
          <thead>
            <tr role="row" aria-rowindex={1}>
              <th role="columnheader" scope="col" className={s.th} style={{ width: `calc(${LEAD_WIDTH}px * var(--k-density))` } as CSSProperties} {...cp(1)?.(0, 0)}>
                <div className={s.leadHead}>
                  {selection && p.onSelectPage && (
                    <Checkbox aria-label="Выбрать все на странице" checked={pageSel === 'all'} indeterminate={pageSel === 'some'} disabled={ids.length === 0}
                      onChange={() => p.onSelectPage!({ ids, on: pageSel !== 'all' })} />
                  )}
                  <IconButton ref={colsBtn} size="s" label="Состав колонок" pressed={colsOpen} onClick={() => setColsOpen(true)}><Cols /></IconButton>
                </div>
                <ColumnsMenu open={colsOpen} anchor={colsBtn} onClose={() => setColsOpen(false)} columns={layout.columns} order={p.order} hidden={p.hidden} onChange={p.onColumns} />
              </th>
              {visible.map((c, i) => (
                <ColumnHeader key={c.id} column={c} sort={p.sort} onSort={p.onSort} width={widthOf(c.id, c.width)}
                  onResize={(c.resizable ?? true) ? (w) => p.onResize({ id: c.id, width: w }) : undefined} cellProps={cp(1)?.(0, i + 1)} />
              ))}
            </tr>
          </thead>

          {state === 'loading' && showSkeleton && <GridSkeleton visible={visible} spanRows={spanRows} rows={p.skeletonRows ?? 8} rowIndexStart={2} />}

          {state !== 'loading' && state !== 'error' && rows.map((row, i) => {
            const id = layout.rowKey(row)
            const ord = (page - 1) * pageSize + i + 1
            const rowIndex = 2 + i * perRecord
            const lead = (
              <>
                {selection && p.onSelect && (
                  <Checkbox aria-label={`Выбрать запись ${ord}`} checked={isSelected(selection, id)} onChange={(e) => p.onSelect!({ id, on: e.target.checked })} />
                )}
                {p.onOpen && (
                  <IconButton size="s" label={`Открыть запись ${ord}`} onClick={(e) => p.onOpen!(row, { secondary: e.detail >= 2 })}><Open /></IconButton>
                )}
                <span className={s.ord}>{ord}</span>
              </>
            )
            return (
              <GridRecord key={id} row={row} rowKey={id} visible={visible} spanRows={spanRows} lead={lead}
                selected={selection ? isSelected(selection, id) : undefined} rowIndex={rowIndex} cellProps={cp(rowIndex)} />
            )
          })}

          {empty && (
            <tbody><tr role="row" className={s.stateRow}><td role="gridcell" colSpan={1 + visible.length}>
              <EmptyState title={p.emptyTitle ?? 'По заданным условиям записей нет'} action={p.emptyAction} />
            </td></tr></tbody>
          )}
          {state === 'error' && (
            <tbody><tr role="row" className={s.stateRow}><td role="gridcell" colSpan={1 + visible.length}>
              <ErrorState title="Не удалось загрузить данные" text={p.error ?? undefined} retry={p.onRetry} />
            </td></tr></tbody>
          )}
        </table>
      </div>
      <div className={s.foot}>
        <Pagination page={page} pageSize={pageSize} total={p.total} onPage={p.onPage} pageSizes={p.pageSizes} onPageSize={p.onPageSize} />
      </div>
    </div>
  )
}
```
`resolveSpans(line as never, …)` — `SpanDef<Row>[]` в параметр `SpanDef<unknown>[]`: из-за контравариантности `render` прямое присвоение не проходит; `as never` локально и с комментарием «типы сегментов инвариантны по строке; функции нужен только id/from/to». Если линтер запретит `as never` — использовать `as unknown as SpanDef<unknown>[]`.

В `Grid.module.css` добавить:
```css
.root { display: flex; flex-direction: column; min-height: 0; height: 100%; }
.leadHead { display: flex; align-items: center; gap: var(--k-sp-1); }
```
В `index.ts` добавить `export { DataGrid, type DataGridProps } from './DataGrid'`.

- [ ] **Step 3: Тесты проходят, линт**

Run: `pnpm --filter @katran/ui test DataGrid && pnpm lint && pnpm --filter @katran/ui build` → PASS (8). Ожидаемые правки по ходу: `IconButton` должен принимать `ref` — он `forwardRef` (план 1), проверить; `Checkbox` без `label` берёт имя из `aria-label` — так и задумано. Тест loading: до срабатывания гейта в таблице только шапка (ни одного `tbody`); после 250 мс — 8 `tbody` скелетона.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "DataGrid: шапка, записи, состояния, выделение, открытие кнопкой, состав колонок, пагинация"
```

---

### Task 11: Клавиатура — паттерн WAI-ARIA grid

**Files:**
- Create: `packages/ui/src/grid/useGridKeyboard.ts`, `packages/ui/src/grid/DataGrid.keyboard.test.tsx`
- Modify: `packages/ui/src/grid/DataGrid.tsx`, `packages/ui/src/grid/index.ts`

**Interfaces:**
- Produces: `useGridKeyboard({ resetToken, fallback }) → { cellProps(rowIndex, r, c), active }`.
  Один таб-стоп на грид: активная ячейка имеет `tabIndex=0`, остальные `-1`. Стрелки ходят по ячейкам (`←/→` в строке, `↑/↓` между строками с сохранением колонки — в строке сегментов берётся ближайшая ячейка слева), `Home`/`End` — начало/конец строки. `Enter` на ячейке: один интерактивный элемент внутри — клик (копировать/открыть/сортировать), несколько — фокус на первый. `Escape` внутри интерактивного элемента — фокус обратно на ячейку. Смена `resetToken` (страница/число строк/состав колонок) возвращает активную ячейку в `fallback`.
- `DataGrid` подключает хук и передаёт `cellProps` в шапку и записи; внешний проп `cellProps` из Task 10 убирается (был заглушкой под этот слой).

- [ ] **Step 1: Тест (падает)**

`packages/ui/src/grid/DataGrid.keyboard.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderK } from '../test/renderK'
import { CopyValue } from '../value'
import { DataGrid, type DataGridProps } from './DataGrid'
import type { RecordLayout } from './types'

type Doc = { id: string; num: string; name: string; purpose: string }
const docs: Doc[] = [{ id: 'a', num: '800', name: 'Ромашка', purpose: 'Оплата' }, { id: 'b', num: '801', name: 'Василёк', purpose: 'Возврат' }]
const layout: RecordLayout<Doc> = {
  rowKey: (d) => d.id,
  columns: [
    { id: 'num', title: 'Номер', sort: [{ id: 'num', label: 'Номер' }], render: (d) => <CopyValue value={d.num} /> },
    { id: 'name', title: 'Имя', render: (d) => d.name },
  ],
  spans: [[{ id: 'purpose', from: 'num', to: 'name', render: (d) => d.purpose }]],
}
const props = (over: Partial<DataGridProps<Doc>> = {}): DataGridProps<Doc> => ({
  label: 'Тест', layout, rows: docs, total: 2, page: 1, pageSize: 20, onPage: vi.fn(), sort: null, onSort: vi.fn(),
  widths: {}, onResize: vi.fn(), order: ['num', 'name'], hidden: [], onColumns: vi.fn(), state: 'ready', onOpen: vi.fn(), ...over,
})
const cellOf = (el: Element | null) => el?.closest('[data-cell]')?.getAttribute('data-cell')

describe('DataGrid: клавиатура', () => {
  it('один таб-стоп: Tab попадает в первую ячейку первой записи', async () => {
    renderK(<><button>до</button><DataGrid {...props()} /></>)
    await userEvent.tab()
    await userEvent.tab()
    expect(cellOf(document.activeElement)).toBe('2:0')
    expect(document.querySelectorAll('[data-cell][tabindex="0"]')).toHaveLength(1)
  })

  it('стрелки: вправо по колонкам, вниз в строку сегментов и на следующую запись, вверх в шапку; Home/End', async () => {
    renderK(<DataGrid {...props()} />)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}')
    expect(cellOf(document.activeElement)).toBe('2:1')
    await userEvent.keyboard('{ArrowRight}')
    expect(cellOf(document.activeElement)).toBe('2:2')
    await userEvent.keyboard('{ArrowDown}')
    expect(cellOf(document.activeElement)).toBe('3:1')   // сегмент начинается с колонки 1 — ближайшая слева
    await userEvent.keyboard('{ArrowDown}')
    expect(cellOf(document.activeElement)).toBe('4:1')
    await userEvent.keyboard('{End}')
    expect(cellOf(document.activeElement)).toBe('4:2')
    await userEvent.keyboard('{Home}')
    expect(cellOf(document.activeElement)).toBe('4:0')
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}')
    expect(cellOf(document.activeElement)).toBe('1:0')
    await userEvent.keyboard('{ArrowUp}')
    expect(cellOf(document.activeElement)).toBe('1:0')   // выше шапки не уходит
  })

  it('Enter на ячейке с одной кнопкой — клик (открытие); с несколькими — фокус на первый; Escape возвращает в ячейку', async () => {
    const p = props()
    renderK(<DataGrid {...p} />)
    await userEvent.tab()
    expect(cellOf(document.activeElement)).toBe('2:0')
    await userEvent.keyboard('{Enter}')
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Открыть запись 1')   // в служебной ячейке один интерактив (номер — текст) → фокус + клик
    expect(p.onOpen).toHaveBeenCalledWith(docs[0], { secondary: false })
    await userEvent.keyboard('{Escape}')
    expect(cellOf(document.activeElement)).toBe('2:0')
    expect(document.activeElement?.hasAttribute('data-cell')).toBe(true)
  })

  it('Enter на заголовке сортирует', async () => {
    const p = props()
    renderK(<DataGrid {...p} />)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowUp}{ArrowRight}{Enter}')
    expect(p.onSort).toHaveBeenCalledWith({ key: 'num', dir: 'asc' })
  })

  it('смена страницы возвращает активную ячейку в начало', async () => {
    const p = props()
    const { rerender } = renderK(<DataGrid {...p} />)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowDown}{ArrowRight}')
    expect(cellOf(document.activeElement)).toBe('3:1')
    rerender(<DataGrid {...p} page={2} />)
    expect(document.querySelector('[data-cell][tabindex="0"]')?.getAttribute('data-cell')).toBe('2:0')
  })
})
```
В третьем тесте служебная ячейка первой записи содержит один интерактивный элемент — кнопку «Открыть» (без `selection` чекбокса нет, номер — текст): `Enter` переводит на неё фокус и кликает, поэтому `Escape` возвращает в ячейку.

Run: `pnpm --filter @katran/ui test keyboard` → FAIL.

- [ ] **Step 2: Реализация хука**

`packages/ui/src/grid/useGridKeyboard.ts`:
```ts
import { useState, type HTMLAttributes, type KeyboardEvent } from 'react'

export type UseGridKeyboardOptions = {
  /** Меняется → активная ячейка возвращается в fallback (страница, число строк, состав колонок). */
  resetToken: string
  /** '2:0' при наличии строк, '1:0' — только шапка. */
  fallback: string
}

const INTERACTIVE = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])'

const key = (rowIndex: number, c: number) => `${rowIndex}:${c}`
const parse = (k: string) => k.split(':').map(Number) as [number, number]

function cellsOf(row: Element): HTMLElement[] {
  return Array.from(row.children).filter((el): el is HTMLElement => el.hasAttribute('data-cell'))
}

/** Ближайшая ячейка строки с колонкой ≤ c (в строке сегментов колонок меньше). */
function pickCell(row: Element, c: number): HTMLElement | undefined {
  const cells = cellsOf(row)
  let best: HTMLElement | undefined
  for (const cell of cells) {
    const [, cc] = parse(cell.dataset.cell!)
    if (cc <= c && (!best || cc > parse(best.dataset.cell!)[1])) best = cell
  }
  return best ?? cells[0]
}

/**
 * WAI-ARIA grid: один таб-стоп, стрелки по ячейкам (спека 6.3). Навигация считается по DOM
 * (строки — все <tr> таблицы, ячейки — элементы с data-cell), поэтому сквозные строки участвуют естественно.
 */
export function useGridKeyboard({ resetToken, fallback }: UseGridKeyboardOptions) {
  const [active, setActive] = useState(fallback)
  const [prevToken, setPrevToken] = useState(resetToken)
  if (resetToken !== prevToken) {
    setPrevToken(resetToken)
    setActive(fallback)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTableCellElement>) => {
    const cell = e.currentTarget
    const inside = e.target !== cell
    if (inside) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cell.focus() }
      return
    }
    const table = cell.closest('table')
    if (!table) return
    const row = cell.parentElement!
    const rows = Array.from(table.querySelectorAll('tr'))
    const ri = rows.indexOf(row as HTMLTableRowElement)
    const cells = cellsOf(row)
    const ci = cells.indexOf(cell)
    const [, c] = parse(cell.dataset.cell!)
    let target: HTMLElement | undefined
    switch (e.key) {
      case 'ArrowRight': target = cells[ci + 1]; break
      case 'ArrowLeft': target = cells[ci - 1]; break
      case 'Home': target = cells[0]; break
      case 'End': target = cells[cells.length - 1]; break
      case 'ArrowDown': target = rows[ri + 1] ? pickCell(rows[ri + 1]!, c) : undefined; break
      case 'ArrowUp': target = rows[ri - 1] ? pickCell(rows[ri - 1]!, c) : undefined; break
      case 'Enter': {
        const items = Array.from(cell.querySelectorAll<HTMLElement>(INTERACTIVE))
        if (items.length === 0) return
        e.preventDefault()
        items[0]!.focus()
        if (items.length === 1) items[0]!.click()
        return
      }
      default: return
    }
    e.preventDefault()
    if (target) { target.focus(); setActive(target.dataset.cell!) }
  }

  const cellProps = (rowIndex: number, r: number, c: number): HTMLAttributes<HTMLTableCellElement> => {
    const k = key(rowIndex + r, c)
    return {
      tabIndex: k === active ? 0 : -1,
      'data-cell': k,
      onFocus: (e) => { if (e.target === e.currentTarget) setActive(k) },
      onKeyDown,
    } as HTMLAttributes<HTMLTableCellElement>
  }

  return { active, cellProps }
}
```
`'data-cell'` в объекте `HTMLAttributes` — TS не знает data-атрибутов в типе, поэтому объект собирается и приводится `as HTMLAttributes<…>`.

- [ ] **Step 3: Подключить в `DataGrid`**

В `DataGrid.tsx`: убрать проп `cellProps` из `DataGridProps` и локальный `cp`; добавить
```tsx
import { useGridKeyboard } from './useGridKeyboard'
…
const kb = useGridKeyboard({
  resetToken: `${page}:${rows.length}:${visibleIds.join(',')}`,
  fallback: rows.length > 0 && state !== 'loading' && state !== 'error' ? '2:0' : '1:0',
})
const cp = (rowIndex: number): CellProps => (r, c) => kb.cellProps(rowIndex, r, c)
```
и использовать `cp(1)(0, 0)` для служебной шапки, `cellProps={cp(1)(0, i + 1)}` для `ColumnHeader`, `cellProps={cp(rowIndex)}` для `GridRecord`. Ячейки состояний (`EmptyState`/`ErrorState`) и скелетона в навигации не участвуют. В `index.ts` добавить `export { useGridKeyboard } from './useGridKeyboard'`.

- [ ] **Step 4: Тесты проходят**

Run: `pnpm --filter @katran/ui test grid && pnpm lint` → PASS (все тесты грида, включая DataGrid.test из Task 10 — там `cellProps` больше нет, проверить, что тест его не использовал). Возможные правки: `userEvent.tab()` в jsdom учитывает `tabindex` — первая проверка ожидает, что после кнопки «до» второй Tab попадает в ячейку `2:0` (кнопка «Состав колонок» в шапке имеет `tabIndex` по умолчанию 0 — она перехватит Tab!). Решение: у интерактивных элементов внутри грида (кнопки шапки, чекбоксы, `CopyValue`, кнопка открытия) выставлять `tabIndex={-1}` — они достижимы через `Enter` на ячейке. Для этого: в `DataGrid` передавать `tabIndex={-1}` в `Checkbox`/`IconButton`; в `ColumnHeader` — `tabIndex={-1}` у кнопки заголовка и ручки; `CopyValue`/`LinkValue` принимают `tabIndex` — в демо-layout передавать `tabIndex={-1}`; для произвольного `render` это ответственность вызывающего (записать в JSDoc `ColumnDef.render`: «интерактивные элементы внутри ячейки — с `tabIndex={-1}`, до них доходят через Enter»). Тесты Task 8/10 не проверяют `tabIndex` кнопок — не сломаются.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "DataGrid: клавиатура по паттерну grid — один таб-стоп, стрелки по ячейкам, Enter/Escape"
```

---

### Task 12: Хуки `useGrid`, `useFilters`

**Files:**
- Create: `packages/effector/src/useGrid.ts`, `packages/effector/src/useFilters.ts`, `packages/effector/src/hooks.test.tsx`
- Modify: `packages/effector/src/index.ts`

**Interfaces:**
- Produces: `useGrid(model: GridModel<Row>) → GridBinding<Row>` — пропы `DataGrid` из сторов и событий модели: `rows total page pageSize sort widths order hidden selection state error onPage onPageSize onSort onResize onColumns onSelect onSelectPage onRetry`; приложение добавляет `label`, `layout`, `onOpen`, `emptyAction`. `useFilters(model: FiltersModel) → { conditions, draft, dirty, edit, discard, apply, reset, remove }`.
- Единственное место встречи модели и компонента (спека 8.4). Реализация — `useUnit` из `effector-react`.

- [ ] **Step 1: Тест (падает)**

`packages/effector/src/hooks.test.tsx`:
```tsx
import { act, renderHook } from '@testing-library/react'
import { createEffect, createStore } from 'effector'
import { createFiltersModel } from './createFiltersModel'
import { createGridModel } from './createGridModel'
import type { Filter, GridPage, GridQuery } from './types'
import { useFilters } from './useFilters'
import { useGrid } from './useGrid'

type Row = { id: string }

describe('useGrid', () => {
  it('отдаёт состояние и обработчики; обработчики двигают модель', async () => {
    const fetchFx = createEffect<GridQuery, GridPage<Row>>(async () => ({ rows: [{ id: 'a' }], total: 1 }))
    const model = createGridModel<Row>({ id: 'g', columns: [{ id: 'c1' }], $filter: createStore<Filter>([]), fetchFx, rowKey: (r) => r.id })
    const { result } = renderHook(() => useGrid(model))
    expect(result.current.page).toBe(1)
    expect(result.current.state).toBe('loading')
    await act(async () => { result.current.onPage(3) })
    expect(result.current.page).toBe(3)
    expect(result.current.rows).toEqual([{ id: 'a' }])
    expect(result.current.state).toBe('ready')
    act(() => { result.current.onSort({ key: 'c1', dir: 'asc' }) })
    expect(result.current.sort).toEqual({ key: 'c1', dir: 'asc' })
    expect(result.current.page).toBe(1)
    act(() => { result.current.onSelect({ id: 'a', on: true }) })
    expect(result.current.selection).toEqual({ mode: 'ids', ids: ['a'] })
    act(() => { result.current.onColumns({ order: ['c1'], hidden: ['c1'] }) })
    expect(result.current.hidden).toEqual(['c1'])
  })
})

describe('useFilters', () => {
  it('edit/apply через хук', () => {
    const model = createFiltersModel()
    const { result } = renderHook(() => useFilters(model))
    act(() => { result.current.edit({ field: 'status', op: 'EQ', value: 'DONE' }) })
    expect(result.current.dirty).toBe(true)
    act(() => { result.current.apply() })
    expect(result.current.conditions).toEqual([{ field: 'status', op: 'EQ', value: 'DONE' }])
    expect(result.current.dirty).toBe(false)
  })
})
```
Run: `pnpm --filter @katran/effector test hooks` → FAIL.

- [ ] **Step 2: Реализация**

`packages/effector/src/useGrid.ts`:
```ts
import { useUnit } from 'effector-react'
import type { ColumnsState, GridViewState, Selection, Sort } from '@katran/ui'
import type { GridModel } from './createGridModel'

export type GridBinding<Row> = {
  rows: Row[]; total: number; page: number; pageSize: number; sort: Sort
  widths: Record<string, number>; order: string[]; hidden: string[]
  selection: Selection; state: GridViewState; error: string | null
  onPage: (n: number) => void; onPageSize: (n: number) => void
  onSort: (s: Sort) => void
  onResize: (p: { id: string; width: number }) => void
  onColumns: (s: ColumnsState) => void
  onSelect: (p: { id: string; on: boolean }) => void
  onSelectPage: (p: { ids: string[]; on: boolean }) => void
  onRetry: () => void
}

/** Единственное место, где модель встречается с компонентом: <DataGrid {...useGrid(model)} label=… layout=… />. */
export function useGrid<Row>(m: GridModel<Row>): GridBinding<Row> {
  const [rows, total, page, pageSize, sort, widths, order, hidden, selection, state, error] = useUnit([
    m.$rows, m.$total, m.$page, m.$pageSize, m.$sort, m.$widths, m.$order, m.$hidden, m.$selection, m.$state, m.$error,
  ])
  const [onPage, onPageSize, onSort, onResize, onColumns, onSelect, onSelectPage, onRetry] = useUnit([
    m.setPage, m.setPageSize, m.sortBy, m.resize, m.setColumns, m.select, m.selectPage, m.retry,
  ])
  return { rows, total, page, pageSize, sort, widths, order, hidden, selection, state, error, onPage, onPageSize, onSort, onResize, onColumns, onSelect, onSelectPage, onRetry }
}
```
`packages/effector/src/useFilters.ts`:
```ts
import { useUnit } from 'effector-react'
import type { FiltersModel } from './createFiltersModel'
import type { Condition, Filter } from './types'

export type FiltersBinding = {
  conditions: Filter; draft: Filter; dirty: boolean
  edit: (c: Condition) => void; discard: (field: string) => void
  apply: () => void; reset: () => void; remove: (field: string) => void
}

export function useFilters(m: FiltersModel): FiltersBinding {
  const [conditions, draft, dirty] = useUnit([m.$conditions, m.$draft, m.$dirty])
  const [edit, discard, apply, reset, remove] = useUnit([m.edit, m.discard, m.apply, m.reset, m.remove])
  return { conditions, draft, dirty, edit, discard, apply, reset, remove }
}
```
В `index.ts` добавить `export { useGrid, type GridBinding } from './useGrid'` и `export { useFilters, type FiltersBinding } from './useFilters'`.

- [ ] **Step 3: Тесты проходят**

Run: `pnpm --filter @katran/effector test && pnpm lint && pnpm check` → PASS. Тест `useGrid` ждёт `onPage(3)` в `act(async)` — эффект `fetchFx` асинхронный; если `rows` не успевают — обернуть в `await act(async () => { …; await new Promise((r) => setTimeout(r, 0)) })`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Хуки useGrid и useFilters: сторы и события модели как пропы компонентов"
```

---

### Task 13: Демо — данные, фейковый бэкенд, страница «Реестр»

**Files:**
- Create: `apps/demo/src/data/docs.ts`, `apps/demo/src/data/fakeBackend.ts`, `apps/demo/src/pages/GridPage.tsx`
- Modify: `apps/demo/package.json` (+ `@katran/effector`, `effector`, `effector-react`), `apps/demo/src/router.ts`, `apps/demo/src/App.tsx`, `apps/demo/src/pages/Page.module.css`

**Interfaces:**
- Produces: `Doc` (тип документа демо), `makeDocs(n = 87): Doc[]` (детерминированный генератор — сид фиксирован, чтобы замеры и скриншоты были воспроизводимы), `createFakeBackend(docs, opts?: { delay?: number }) → Effect<GridQuery, GridPage<Doc>>` (фильтр `EQ`/`IN`/`CONTAINS`/`IS_EMPTY` по строковым полям, сортировка через `sortRows`, страница), `docsLayout: RecordLayout<Doc>` (экспортируется из `GridPage.tsx` для фейкового бэкенда и e2e).
- Данные вымышленные, но правдоподобные (показ Заказчику): 9 продовых статусов, направления IN/OUT/TRANSIT/OTHER, MT103/MT202/MT202COV/MT199, счета со знаками 6–8 = код валюты документа.

- [ ] **Step 1: Зависимости и маршрут**

Run: `cd /Users/shaman/_CODE/VTB/katran && pnpm --filter demo add @katran/effector@workspace:* effector@^23 effector-react@^23`
В `apps/demo/src/router.ts`: `'grid'` в тип `Route` и `{ id: 'grid', title: 'Реестр' }` первым элементом `routes` (после `tokens`). В `App.tsx`: `grid: GridPage`.

- [ ] **Step 2: Данные**

`apps/demo/src/data/docs.ts`:
```ts
export type Status = 'IN_PROGRESS' | 'TO_EXPORT' | 'PROCESSING' | 'ERROR' | 'DEFERRED' | 'EXPORTED' | 'INVALID' | 'REJECTED' | 'DONE'
export type Direction = 'IN' | 'OUT' | 'TRANSIT' | 'OTHER'
export type Doc = {
  id: string; docNumber: number; refIn: string | null; refOut: string | null; uetr: string
  created: string; valueDate: string
  type: 'MT103' | 'MT202' | 'MT202COV' | 'MT199'
  direction: Direction; dirTxt: string
  amount: number; currency: 'USD' | 'EUR' | 'CNY' | 'RUB'
  f50name: string; f50acc: string; purpose: string | null
  f52: string; f57: string; f59name: string; f59acc: string
  status: Status; reason: string | null
  sender: string; receiver: string; provS: string; provR: string
}

export const STATUS_LABEL: Record<Status, string> = {
  IN_PROGRESS: 'В работе', TO_EXPORT: 'К экспорту', PROCESSING: 'В обработке', ERROR: 'Ошибка', DEFERRED: 'Отложенный',
  EXPORTED: 'Экспортирован', INVALID: 'Невалидный', REJECTED: 'Отказ', DONE: 'Обработан',
}
/** Тон статусной точки — 4 семейства (спека 4.2). */
export const STATUS_TONE: Record<Status, 'flow' | 'flowl' | 'flowd' | 'bad' | 'badd' | 'warn' | 'ok' | 'okl' | 'grey'> = {
  IN_PROGRESS: 'flow', TO_EXPORT: 'flowl', PROCESSING: 'flowd', ERROR: 'bad', INVALID: 'badd', DEFERRED: 'warn',
  DONE: 'ok', EXPORTED: 'okl', REJECTED: 'grey',
}
const REASONS = ['Не найден счёт получателя', 'Превышен лимит', 'Санкционный стоп-лист', 'Ошибка формата 59', 'Нет покрытия', 'Дубликат 20', 'Отказ комплаенса', 'Просрочена дата валютирования', 'Неизвестный BIC']
const CCY = { USD: '840', EUR: '978', CNY: '156', RUB: '643' } as const
const NAMES = ['ООО «Северный ветер»', 'АО «Прибой»', 'ЗАО «Василёк»', 'ООО «Ромашка»', 'ПАО «Титан»', 'ООО «Меридиан»', 'АО «Глобус»', 'ООО «Кедр»', 'ИП Иванов А. А.', 'ООО «Лотос»']
const BICS = ['VKRBRU8KXXX', 'NRDIRUMMXXX', 'MRDNGB2LXXX', 'HSTBDEHHXXX', 'BCLHLV22XXX', 'CESEDEFFXXX', 'QWRTUS3NXXX', 'PLKZHKHHXXX']
const PROV = ['ЕРС', 'LORO', 'NOSTRO', 'SUBOUL', 'VTO']

/** Детерминированный ГПСЧ (mulberry32): одни и те же данные при каждом запуске. */
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const pick = <T,>(r: () => number, a: readonly T[]) => a[Math.floor(r() * a.length)]!
const pad = (n: number, w: number) => String(n).padStart(w, '0')
const acc = (r: () => number, ccy: keyof typeof CCY) => `40702${CCY[ccy]}${pad(Math.floor(r() * 1e11), 11)}`

export function makeDocs(n = 87): Doc[] {
  const r = rng(20260923)
  const statuses: Status[] = ['IN_PROGRESS', 'TO_EXPORT', 'TO_EXPORT', 'PROCESSING', 'ERROR', 'DEFERRED', 'EXPORTED', 'EXPORTED', 'INVALID', 'REJECTED', 'DONE', 'DONE', 'DONE']
  const dirs: [Direction, string][] = [['IN', 'Входящий от ЦБ'], ['OUT', 'Исходящий на ЦБ'], ['OUT', 'Исходящий на Лоро'], ['TRANSIT', 'Транзит'], ['OTHER', 'Прочее']]
  return Array.from({ length: n }, (_, i) => {
    const status = pick(r, statuses)
    const currency = pick(r, ['USD', 'EUR', 'CNY', 'RUB'] as const)
    const [direction, dirTxt] = pick(r, dirs)
    const minute = 10 * 60 + 52 - i * 3
    const created = `2026-09-23T${pad(Math.floor(minute / 60), 2)}:${pad(minute % 60, 2)}:${pad(Math.floor(r() * 60), 2)}`
    const hasIn = r() > 0.3, hasOut = r() > 0.4
    return {
      id: `0f3c${pad(i, 4)}-7b1d-4c8e-9f0a-${pad(Math.floor(r() * 1e12), 12)}`,
      docNumber: 800 + Math.floor(r() * 900000),
      refIn: hasIn ? `REF2026092${pad(i, 4)}` : null,
      refOut: hasOut ? `OUT${pad(Math.floor(r() * 1e7), 7)}` : null,
      uetr: `${pad(Math.floor(r() * 1e8), 8)}-1c2d-4e5f-8a9b-${pad(Math.floor(r() * 1e12), 12)}`,
      created, valueDate: '2026-09-23',
      type: pick(r, ['MT103', 'MT103', 'MT202', 'MT202COV', 'MT199'] as const),
      direction, dirTxt,
      amount: Math.round(r() * 5_000_000 * 100) / 100, currency,
      f50name: pick(r, NAMES), f50acc: acc(r, currency),
      purpose: r() > 0.15 ? `Оплата по договору № ${Math.floor(r() * 9000) + 100} от 0${Math.floor(r() * 9) + 1}.09.2026, ${pick(r, ['без НДС', 'в т.ч. НДС 20 %', 'НДС не облагается'])}` : null,
      f52: pick(r, BICS), f57: pick(r, BICS), f59name: pick(r, NAMES), f59acc: acc(r, currency),
      status, reason: status === 'ERROR' || status === 'DEFERRED' || status === 'REJECTED' ? pick(r, REASONS) : null,
      sender: pick(r, BICS), receiver: pick(r, BICS), provS: pick(r, PROV), provR: pick(r, PROV),
    }
  })
}
```

- [ ] **Step 3: Фейковый бэкенд**

`apps/demo/src/data/fakeBackend.ts`:
```ts
import { createEffect } from 'effector'
import type { Condition, Filter, GridPage, GridQuery } from '@katran/effector'
import { sortRows, type RecordLayout } from '@katran/ui'

const str = (v: unknown) => (v == null ? '' : String(v)).toLowerCase()

/** Подмножество операторов контракта, достаточное для демо (лейн статусов и простые фильтры плана 3). */
function matches(row: Record<string, unknown>, c: Condition): boolean {
  const v = row[c.field]
  switch (c.op) {
    case 'EQ': return str(v) === str(c.value)
    case 'NE': return str(v) !== str(c.value)
    case 'CONTAINS': return str(v).includes(str(c.value))
    case 'STARTS_WITH': return str(v).startsWith(str(c.value))
    case 'ENDS_WITH': return str(v).endsWith(str(c.value))
    case 'IN': return c.values.map(str).includes(str(v))
    case 'NOT_IN': return !c.values.map(str).includes(str(v))
    case 'IS_EMPTY': return v == null || v === ''
    case 'IS_NOT_EMPTY': return !(v == null || v === '')
    case 'GT': return Number(v) > Number(c.value)
    case 'GTE': return Number(v) >= Number(c.value)
    case 'LT': return Number(v) < Number(c.value)
    case 'LTE': return Number(v) <= Number(c.value)
    case 'BETWEEN': return Number(v) >= Number(c.from) && Number(v) <= Number(c.to)
  }
}
const applyFilter = <Row extends Record<string, unknown>>(rows: Row[], f: Filter) => rows.filter((r) => f.every((c) => matches(r, c)))

export type FakeBackendOptions = { delay?: number | undefined }

/** Бэкенд в памяти: та же форма запроса, что у POST /grids/{id}/search; задержка — как у прода (0.3–1 с). */
export function createFakeBackend<Row extends Record<string, unknown>>(all: Row[], layout: RecordLayout<Row>, opts: FakeBackendOptions = {}) {
  const get = (row: Row, key: string) => row[key]
  return createEffect<GridQuery, GridPage<Row>>(async (q) => {
    const slow = new URLSearchParams(location.search).get('slow')
    await new Promise((r) => setTimeout(r, opts.delay ?? (slow ? Number(slow) : 250 + Math.random() * 400)))
    const filtered = applyFilter(all, q.filter)
    const sorted = sortRows(filtered, q.sort, layout.columns, get)
    return { rows: sorted.slice(q.page * q.size, (q.page + 1) * q.size), total: sorted.length }
  })
}
```
Параметр `?slow=2000` в адресе демо делает запрос долгим — нужен e2e-замеру скелетона (Task 14).

- [ ] **Step 4: Страница**

`apps/demo/src/pages/GridPage.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { createEvent, createStore } from 'effector'
import { createGridModel, localStoragePersist, useGrid, type Filter } from '@katran/effector'
import { AccountValue, CopyValue, DataGrid, LinkValue, StatusDot, Tag, formatAmount, formatDateTimeShort, useKatran, type RecordLayout } from '@katran/ui'
import { makeDocs, STATUS_LABEL, STATUS_TONE, type Doc } from '../data/docs'
import { createFakeBackend } from '../data/fakeBackend'
import s from './Page.module.css'

const T = -1 // интерактив внутри ячеек — вне таб-порядка, до него доходят через Enter на ячейке

export const docsLayout: RecordLayout<Doc> = {
  rowKey: (d) => d.id,
  columns: [
    { id: 'status', menuTitle: 'Статус', width: 44, sort: [{ id: 'status', label: 'Статус' }, { id: 'reason', label: 'Причина статуса' }],
      render: (d) => <StatusDot tone={STATUS_TONE[d.status]} label={STATUS_LABEL[d.status]} /> },
    { id: 'id', title: 'ID', subtitle: '№ · 20 вх / исх', width: 120, lines: 2,
      sort: [{ id: 'docNumber', label: 'Номер документа', type: 'number' }, { id: 'refIn', label: '20 вх' }, { id: 'refOut', label: '20 исх' }],
      render: (d) => <><CopyValue value={String(d.docNumber)} tabIndex={T} /><div><LinkValue name="uuid" value={d.id} tabIndex={T} /> <LinkValue name="refIn" value={d.refIn ?? undefined} tabIndex={T} /> <LinkValue name="refOut" value={d.refOut ?? undefined} tabIndex={T} /></div></> },
    { id: 'created', title: 'Дата / Время', width: 110, lines: 2, sort: [{ id: 'created', label: 'Дата документа', type: 'date' }, { id: 'valueDate', label: 'Валютирование', type: 'date' }],
      render: (d) => <><CopyValue value={formatDateTimeShort(d.created)} tone="ink" tabIndex={T} /><div><CopyValue value={d.valueDate} tone="ink2" tabIndex={T} /></div></> },
    { id: 'type', title: 'Тип', width: 90, sort: [{ id: 'type', label: 'Тип сообщения' }], render: (d) => <CopyValue value={d.type} tone="mono" tabIndex={T} /> },
    { id: 'direction', title: 'Направление', width: 150, lines: 2, sort: [{ id: 'direction', label: 'Группа → название', order: ['IN', 'OUT', 'TRANSIT', 'OTHER'], then: 'dirTxt' }, { id: 'dirTxt', label: 'Название' }],
      render: (d) => <><CopyValue value={d.direction} tone="mono" tabIndex={T} /><div><CopyValue value={d.dirTxt} tone="ink2" tabIndex={T} /></div></> },
    { id: 'amount', title: '32', subtitle: 'сумма', width: 120, lines: 2, align: 'right', sort: [{ id: 'amount', label: 'Сумма', type: 'number' }, { id: 'currency', label: 'Валюта' }],
      render: (d) => <><CopyValue value={formatAmount(d.amount)} tone="ink" tabIndex={T} /><div><CopyValue value={d.currency} tone="ink2" tabIndex={T} /></div></> },
    { id: 'f50', title: '50', subtitle: 'приказодатель', width: 170, lines: 2, sort: [{ id: 'f50name', label: 'Наименование' }, { id: 'f50acc', label: 'Счёт' }],
      render: (d) => <><CopyValue value={d.f50name} tabIndex={T} /><div><AccountValue value={d.f50acc} tabIndex={T} /></div></> },
    { id: 'f52', title: '52', width: 110, sort: [{ id: 'f52', label: 'BIC 52' }], render: (d) => <CopyValue value={d.f52} tone="mono" tabIndex={T} /> },
    { id: 'f57', title: '57', width: 110, sort: [{ id: 'f57', label: 'BIC 57' }], render: (d) => <CopyValue value={d.f57} tone="mono" tabIndex={T} /> },
    { id: 'f59', title: '59', subtitle: 'бенефициар', width: 170, lines: 2, sort: [{ id: 'f59name', label: 'Наименование' }, { id: 'f59acc', label: 'Счёт' }],
      render: (d) => <><CopyValue value={d.f59name} tabIndex={T} /><div><AccountValue value={d.f59acc} tabIndex={T} /></div></> },
    { id: 'sr', title: 'S / R in', width: 120, lines: 2, sort: [{ id: 'sender', label: 'S in' }, { id: 'receiver', label: 'R in' }],
      render: (d) => <><span className={s.srTag}>S:</span> <CopyValue value={d.sender} tone="mono" tabIndex={T} /><div><span className={s.srTag}>R:</span> <CopyValue value={d.receiver} tone="mono" tabIndex={T} /></div></> },
    { id: 'prov', title: 'Провайдеры', width: 110, sort: [{ id: 'provS', label: 'Провайдер отправителя' }, { id: 'provR', label: 'Провайдер получателя' }],
      render: (d) => <><Tag>{d.provS}</Tag> <Tag>{d.provR}</Tag></> },
  ],
  spans: [[
    { id: 'reason', from: 'status', to: 'created', render: (d) => (d.reason ? <CopyValue value={d.reason} tone="ink2" tabIndex={T} /> : null) },
    { id: 'purpose', from: 'f50', to: 'f59', render: (d) => (d.purpose ? <><span className={s.srTag}>70</span> <CopyValue value={d.purpose} tone="ink2" tabIndex={T} /></> : null) },
  ]],
}

const docs = makeDocs()
const fetchFx = createFakeBackend(docs, docsLayout)
export const resetFilter = createEvent()
export const $filter = createStore<Filter>([]).reset(resetFilter)
const grid = createGridModel<Doc>({
  id: 'demo-docs',
  columns: docsLayout.columns.map((c) => ({ id: c.id, width: c.width })),
  pageSize: 20,
  $filter,
  fetchFx,
  persist: localStoragePersist('katran-demo'),
  rowKey: docsLayout.rowKey,
})

export function GridPage() {
  const g = useGrid(grid)
  const { announce } = useKatran()
  const [opened, setOpened] = useState<string | null>(null)
  useEffect(() => { grid.refresh() }, [])
  return (
    <div className={s.gridPage}>
      <div className={s.gridHead}>
        <h1 className={s.h1}>Реестр</h1>
        <p className={s.note}>87 валютных документов на фейковом бэкенде с задержкой 0,3–0,7 с. Запись не кликабельна — деталку открывает кнопка; двойной клик — второй документ рядом. Tab попадает в сетку один раз, дальше — стрелки; Enter на ячейке — копировать/открыть.</p>
        {opened && <p className={s.note} role="status">{opened}</p>}
      </div>
      <DataGrid
        {...g}
        label="Валютные документы"
        layout={docsLayout}
        pageSizes={[20, 50]}
        emptyAction={{ label: 'Сбросить фильтр', onClick: () => resetFilter() }}
        onOpen={(d, { secondary }) => { const msg = `Открыт документ ${d.docNumber}${secondary ? ' — второй drawer рядом' : ''}`; setOpened(msg); announce(msg) }}
      />
    </div>
  )
}
```
`resetFilter` — событие сброса фильтра (у сторов effector нет `setState`); в плане 3 его заменит `reset` модели фильтров.
`useEffect(() => { grid.refresh() }, [])` — вызов события effector, не React-состояния: правило `set-state-in-effect` не срабатывает; `react-hooks/exhaustive-deps` — `grid` модульная константа, зависимостей нет.

В `Page.module.css` добавить:
```css
.gridPage { display: flex; flex-direction: column; height: calc(100vh - var(--k-h-ctl-l) - var(--k-sp-6)); min-height: 0; }
.gridHead { flex: none; }
.srTag { color: var(--k-faint); font: 500 var(--k-fs-3) / 1 var(--k-mono); }
```
Высота страницы: оболочка демо (`Shell`) даёт `main.content` с паддингом; грид должен занимать остаток высоты, чтобы скроллилось тело таблицы, а шапка была липкой. Если `100vh − …` не сходится с реальной шапкой демо — подобрать в браузере и записать в отчёт.

- [ ] **Step 5: Проверка**

Run: `pnpm check` (tsc демо, линт, тесты, сборки) → зелёный. Браузер (контроллер после ревью): `/#/grid` — записи ≤ 3 строк, сквозные строки причины (только у ERROR/DEFERRED/REJECTED) и назначения, сортировка по «Сумма» через меню, ресайз, скрытие колонки через «Состав колонок» → сегмент сжимается, выделение, кнопка открытия, Tab → стрелки → Enter копирует, тултип на обрезанном назначении, 125 % — всё пропорционально.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Демо: реестр валютных документов на DataGrid и createGridModel с фейковым бэкендом"
```

---

### Task 14: Замер геометрии Playwright

**Files:**
- Create: `apps/demo/playwright.config.ts`, `apps/demo/e2e/geometry.spec.ts`
- Modify: `apps/demo/package.json` (скрипт `e2e`, devDep `@playwright/test`), `README.md`

**Interfaces:**
- Produces: `pnpm --filter demo e2e` — поднимает `vite preview` на 5182, открывает `/#/grid`, замеряет: высота записи (первый `tbody[data-key]`) при 100 % — в коридоре 60–74 px; скелетон (`?slow=3000`) — равен записи ±2 px; шапка `thead` — 40–56 px; при 125 % запись — ×1.25 ± 2 px. Вне `pnpm check` (Global Constraints).

- [ ] **Step 1: Установка**

Run:
```bash
cd /Users/shaman/_CODE/VTB/katran && pnpm --filter demo add -D @playwright/test && pnpm --filter demo exec playwright install chromium
```
Если загрузка браузера недоступна (сеть) — записать в отчёт и выполнить остальные шаги; спека тесты не запускать.

В `apps/demo/package.json` → `"e2e": "playwright test"`. `apps/demo/playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:5182', viewport: { width: 1600, height: 900 } },
  webServer: { command: 'pnpm build && pnpm exec vite preview --port 5182 --strictPort', url: 'http://localhost:5182', reuseExistingServer: true, timeout: 120_000 },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
```

- [ ] **Step 2: Спека замера**

`apps/demo/e2e/geometry.spec.ts`:
```ts
import { expect, test, type Page } from '@playwright/test'

const h = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!.height

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.clear()) })

test('запись и шапка при 100 %', async ({ page }) => {
  await page.goto('/#/grid')
  await page.getByRole('button', { name: '100 %' }).click()
  await page.locator('tbody[data-key]').first().waitFor()
  const record = await h(page, 'tbody[data-key]')
  const head = await h(page, 'table[role=grid] thead')
  expect(record).toBeGreaterThanOrEqual(60)
  expect(record).toBeLessThanOrEqual(74)
  expect(head).toBeGreaterThanOrEqual(40)
  expect(head).toBeLessThanOrEqual(56)
  test.info().annotations.push({ type: 'geometry', description: `record=${record} head=${head}` })
})

test('скелетон повторяет высоту записи', async ({ page }) => {
  await page.goto('/?slow=3000#/grid')
  await page.getByRole('button', { name: '100 %' }).click()
  await page.locator('table[role=grid] tbody').first().waitFor()
  const skeleton = await h(page, 'table[role=grid] tbody')
  await page.locator('tbody[data-key]').first().waitFor({ timeout: 10_000 })
  const record = await h(page, 'tbody[data-key]')
  expect(Math.abs(skeleton - record)).toBeLessThanOrEqual(2)
})

test('плотность 125 % масштабирует запись', async ({ page }) => {
  await page.goto('/#/grid')
  await page.locator('tbody[data-key]').first().waitFor()
  await page.getByRole('button', { name: '100 %' }).click()
  const base = await h(page, 'tbody[data-key]')
  await page.getByRole('button', { name: '125 %' }).click()
  const big = await h(page, 'tbody[data-key]')
  expect(Math.abs(big - base * 1.25)).toBeLessThanOrEqual(2)
})
```
Если запись первой страницы содержит документ без причины и без назначения — вторая строка всё равно есть (пустые сегменты держат `min-height`), высота стабильна. Если фактическая высота выходит за коридор — это сигнал о ритме записи (спека 6.1: ≈ 65 px): сначала проверить паддинги `sp-2`/`sp-1` и `--k-lines`, а не двигать коридор; зафиксировать реальные числа в отчёте.

- [ ] **Step 3: Прогон, README**

Run: `pnpm --filter demo e2e` → 3 passed (числа — в отчёт). В `README.md` добавить раздел «Замер геометрии»: команда установки браузера и запуска; e2e не входит в `pnpm check`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Замер геометрии грида Playwright: запись, скелетон, шапка, плотность"
```

---

## Самопроверка плана (выполнена при написании)

**Покрытие спеки.** 6.1 (модель записи) → Task 7; 6.2 (контракт типов) → Task 1; 6.3: сегменты → 1, 7; сортировка → 2, 8; ресайз → 8; состав колонок → 9; пагинация → 10; состояния → 10; выделение → 3, 6, 10; открытие кнопкой → 10; клавиатура → 11. 6.4 (компонент) → 10, 11. 7.1 (типы фильтра, одна модель) → 4, 5. 8.1–8.4 (модели, транспорт вне кита, persist, хуки) → 4, 5, 6, 12. 9 (Playwright-замеры) → 14. 10 (демо) → 13. Не покрыто намеренно: `StatusLane`, `FilterPanel`, `BulkBar`, боевой экран с фильтрами — план 3; `ThemeSwitch`/`DensitySwitch` — позже.

**Согласованность имён.** `Sort`/`Selection`/`ColumnsState`/`GridViewState` объявлены в `ui/grid/types.ts` (Task 1), effector их импортирует типами (Tasks 4, 6, 12). `resolveSpans(spans, visibleOrder, fullOrder)` — Task 1, вызов в Task 10 передаёт три аргумента. `SpanCell`/`CellProps`/`fillSegments` — Task 7, используются в 10, 11. `useGrid` возвращает ровно те пропы, что принимает `DataGrid` (без `label`, `layout`, `onOpen`, `emptyAction`, `pageSizes`) — Task 12 ↔ 10. `GridQuery.page` с нуля — Task 4 тип, Task 6 (`page - 1`), Task 13 (`q.page * q.size`). `createFakeBackend(all, layout, opts)` — Task 13. `Checkbox`/`IconButton`/`CopyValue` принимают `tabIndex` — план 1.

**Заглушек нет.** Каждый шаг с кодом содержит код; в трёх местах даны запасные варианты на случай поведения jsdom (`pointerMove`, `toHaveStyle`, `act` с асинхронным эффектом) — с конкретной заменой, не «разобраться».
