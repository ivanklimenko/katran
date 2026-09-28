# План 5a «Реестр по эталону: структура» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** механизмы кита для реестра по эталону — многоуровневая сортировка, ячейки на всю высоту записи, «вместе / раздельно» для составных колонок, сброс ширин, состояния записи и подсказка кнопки открытия.

**Architecture:** типы и чистые помощники — `@katran/ui` (`grid/types.ts`, `grid/sortRows.ts`, `grid/resolveSpans.ts`, `grid/GridRecord.tsx`); компоненты `DataGrid`, `ColumnHeader`, `ColumnsMenu`, новый `SortChips`; состояние пользователя (сортировка, `split`, ширины) — `createGridModel` в `@katran/effector` и `useGrid`. Демо показывает механизмы на экране «Валютные документы».

**Tech Stack:** pnpm-монорепо, React 17.0.2 в разработке (CI-задача `react19`), effector 23.4, Vitest + Testing Library + jest-axe, Playwright, eslint + stylelint, сборка под Chromium 88 (`pnpm check:target`).

**Spec:** `docs/superpowers/specs/2026-09-28-katran-registry-structure-design.md` (5a). Основная спека — `docs/superpowers/specs/2026-09-23-katran-design.md`. Сверка — `docs/reference/registry-drift.md`.

## Global Constraints

- `Sort = SortLevel[]`, `SortLevel = { key: string; dir: 'asc' | 'desc' }`, `[]` — без сортировки; `MAX_SORT_LEVELS = 5`.
- Совместимость: React 17–19 (без `useId`, `useSyncExternalStore` из react напрямую, `useInsertionEffect`, `useTransition`, `startTransition`, `createRoot` в пакетах кита — линт это ловит), Chromium 88 (без `.at`, `Object.hasOwn`, `findLast`, `toSorted`, `structuredClone`, `:has`, `inert`); `pnpm check` включает `check:target`.
- CSS компонентов: только `var(--k-*)`, без голых `px` (кроме `border*`/`outline*`/`box-shadow`/`letter-spacing`), без hex/rgba. Новые размеры — только в `packages/tokens/src/tokens.src.ts` + `pnpm gen`, регенерация коммитится.
- Опциональные поля публичных типов — `?: T | undefined`. Никаких `eslint-disable`/`stylelint-disable`.
- Интерактив — настоящие `<button>`/`<input>` с доступным именем; интерактив внутри ячеек и шапки — `tabIndex={-1}`; axe без нарушений.
- Тесты под `renderK` ищут по ролям и атрибутам. Модели тестируются через `fork`/`allSettled`.
- Русский язык интерфейса, комментариев, коммитов. Коммиты без трейлеров `Co-Authored-By` и «Generated with»; автор `Ivan Klimenko <ivan.klimenko@gmail.com>`; коммитить свои файлы поимённо.
- e2e демо: `pnpm --filter demo e2e` (вне `pnpm check`), коридоры: запись 64–72 (цель 68), шапка 40–56, скелетон = запись ± 2, 125 % = ×1.25 ± 2.
- `pnpm check` зелёный после каждой задачи.

---

## Карта файлов

```txt
packages/ui/src/grid/
  types.ts            — SortLevel, Sort[], MAX_SORT_LEVELS, ColumnDef.fullHeight/.split, RowState      (T1, T3, T5, T8)
  sortRows.ts(+test)  — soleSort/addSortLevel/flipSortLevel/removeSortLevel, sortRows по уровням,
                        findSortKey видит части split                                                   (T1, T5)
  resolveSpans.ts(+test) — tall-колонки, expandColumns, gridColumns                                     (T3, T5)
  GridRecord.tsx(+test)  — rowSpan, fillSegments по маске высоких колонок, состояние записи             (T3, T8)
  GridSkeleton.tsx    — rowSpan как у записи                                                            (T3)
  useGridKeyboard.ts  — Shift+Enter, навигация по rowSpan                                               (T2, T4)
  ColumnHeader.tsx(+test) — soleSort/Shift, меню с «+»/«↕», номер уровня, сброс ширин                   (T1, T2, T7)
  SortChips.tsx(+test) — новый                                                                          (T2)
  ColumnsMenu.tsx(+test) — переключатель «раздельно»                                                    (T5)
  DataGrid.tsx(+tests) — чипы, split, сброс ширин, rowState, openHint                                   (T2, T3, T5, T7, T8)
  Grid.module.css     — чипы, состояния записи                                                          (T2, T8)
  index.ts            — экспорт новых сущностей                                                         (T1–T8)
packages/ui/src/filters/BulkBar.tsx(+test) — allNote                                                    (T8)
packages/tokens/src/tokens.src.ts (+gen) — 'hatch'                                                      (T8)
packages/effector/src/createGridModel.ts(+test), useGrid.ts, hooks.test.tsx — $sort [], $split, resetWidths (T1, T6, T7)
apps/demo/src/data/{docs.ts,fakeBackend.ts}, pages/GridPage.tsx, e2e/*.spec.ts                         (T1–T8)
docs/…                                                                                                  (T9)
```

---

### Task 1: `Sort` — массив уровней

**Files:**
- Modify: `packages/ui/src/grid/types.ts`, `packages/ui/src/grid/sortRows.ts`, `packages/ui/src/grid/index.ts`, `packages/ui/src/grid/ColumnHeader.tsx`
- Modify: `packages/effector/src/createGridModel.ts`
- Modify: `apps/demo/src/data/fakeBackend.ts`
- Test: `packages/ui/src/grid/sortRows.test.ts`, `ColumnHeader.test.tsx`, `DataGrid.test.tsx`, `packages/effector/src/createGridModel.test.ts`, `hooks.test.tsx` (привести к массиву)

**Interfaces:**
- Produces: `SortLevel`, `Sort = SortLevel[]`, `MAX_SORT_LEVELS`; `soleSort(sort: Sort, key: SortKey): Sort`, `addSortLevel(sort: Sort, key: SortKey): Sort`, `flipSortLevel(sort: Sort, keyId: string): Sort`, `removeSortLevel(sort: Sort, keyId: string): Sort`; `sortRows(rows, sort: Sort, columns, get)` по уровням; `createGridModel`: `$sort` начальное `[]`.

- [ ] **Step 1: тесты помощников (падают).** В `sortRows.test.ts` добавить:

```ts
import { addSortLevel, flipSortLevel, MAX_SORT_LEVELS, removeSortLevel, soleSort, sortRows } from './sortRows'
import type { ColumnDef, SortKey } from './types'

const kType: SortKey = { id: 'type', label: 'Тип' }
const kAmount: SortKey = { id: 'amount', label: 'Сумма', type: 'number' }

describe('уровни сортировки', () => {
  it('soleSort: ключ единственным; повтор единственного — смена направления; направление по умолчанию по типу', () => {
    expect(soleSort([], kAmount)).toEqual([{ key: 'amount', dir: 'desc' }])
    expect(soleSort([{ key: 'amount', dir: 'desc' }], kAmount)).toEqual([{ key: 'amount', dir: 'asc' }])
    expect(soleSort([{ key: 'amount', dir: 'desc' }, { key: 'type', dir: 'asc' }], kAmount)).toEqual([{ key: 'amount', dir: 'desc' }])
    expect(soleSort([{ key: 'type', dir: 'asc' }], kAmount)).toEqual([{ key: 'amount', dir: 'desc' }])
  })
  it('addSortLevel: в конец; повтор — смена направления уровня; не больше MAX_SORT_LEVELS', () => {
    expect(addSortLevel([{ key: 'type', dir: 'asc' }], kAmount)).toEqual([{ key: 'type', dir: 'asc' }, { key: 'amount', dir: 'desc' }])
    expect(addSortLevel([{ key: 'type', dir: 'asc' }, { key: 'amount', dir: 'desc' }], kType)).toEqual([{ key: 'type', dir: 'desc' }, { key: 'amount', dir: 'desc' }])
    const full = Array.from({ length: MAX_SORT_LEVELS }, (_, i) => ({ key: `k${i}`, dir: 'asc' as const }))
    expect(addSortLevel(full, kAmount)).toBe(full)
  })
  it('flipSortLevel и removeSortLevel', () => {
    const s = [{ key: 'type', dir: 'asc' as const }, { key: 'amount', dir: 'desc' as const }]
    expect(flipSortLevel(s, 'amount')).toEqual([{ key: 'type', dir: 'asc' }, { key: 'amount', dir: 'asc' }])
    expect(removeSortLevel(s, 'type')).toEqual([{ key: 'amount', dir: 'desc' }])
  })
  it('sortRows по уровням: второй уровень решает при равенстве первого; пустые в конце', () => {
    type R = { type: string; amount: number | null }
    const cols: ColumnDef<R>[] = [
      { id: 't', sort: [kType], render: () => null },
      { id: 'a', sort: [kAmount], render: () => null },
    ]
    const rows: R[] = [{ type: 'B', amount: 1 }, { type: 'A', amount: 5 }, { type: 'A', amount: 9 }, { type: 'A', amount: null }]
    const got = sortRows(rows, [{ key: 'type', dir: 'asc' }, { key: 'amount', dir: 'desc' }], cols, (r, k) => r[k as keyof R])
    expect(got).toEqual([{ type: 'A', amount: 9 }, { type: 'A', amount: 5 }, { type: 'A', amount: null }, { type: 'B', amount: 1 }])
    expect(sortRows(rows, [], cols, (r, k) => r[k as keyof R])).toEqual(rows)
  })
})
```

Существующие тесты `sortRows` в файле перевести с `{ key, dir }` / `null` на `[{ key, dir }]` / `[]`.
- [ ] **Step 2: запуск.** `pnpm --filter @katran/ui test -- sortRows` — FAIL.
- [ ] **Step 3: типы.** В `types.ts` заменить `Sort`:

```ts
/** Уровень сортировки: ключ из ColumnDef.sort[].id и направление. */
export type SortLevel = { key: string; dir: 'asc' | 'desc' }
/** Многоуровневая сортировка (решение владельца В1): порядок уровней — порядок сравнения; [] — без сортировки. */
export type Sort = SortLevel[]
/** Контракт vtb-filters §5.1: sort — массив до 5 элементов. */
export const MAX_SORT_LEVELS = 5
```

- [ ] **Step 4: помощники и `sortRows`.** В `sortRows.ts` (импорт `MAX_SORT_LEVELS`, `SortLevel` из `./types`):

```ts
const flip = (d: SortLevel['dir']): SortLevel['dir'] => (d === 'asc' ? 'desc' : 'asc')

/** Сделать ключ единственным; если он уже единственный — сменить направление. */
export function soleSort(sort: Sort, key: SortKey): Sort {
  const only = sort.length === 1 && sort[0]!.key === key.id
  return [{ key: key.id, dir: only ? flip(sort[0]!.dir) : defaultDir(key) }]
}
/** Добавить уровень в конец; если ключ уже есть — сменить направление его уровня. Сверх MAX_SORT_LEVELS — без изменений. */
export function addSortLevel(sort: Sort, key: SortKey): Sort {
  if (sort.some((l) => l.key === key.id)) return flipSortLevel(sort, key.id)
  if (sort.length >= MAX_SORT_LEVELS) return sort
  return [...sort, { key: key.id, dir: defaultDir(key) }]
}
export const flipSortLevel = (sort: Sort, keyId: string): Sort => sort.map((l) => (l.key === keyId ? { ...l, dir: flip(l.dir) } : l))
export const removeSortLevel = (sort: Sort, keyId: string): Sort => sort.filter((l) => l.key !== keyId)
```

`sortRows` — по уровням (JSDoc обновить: «по уровням, пока равенство; у каждого уровня — `order`, `then`, пустые в конце»):

```ts
export function sortRows<Row>(rows: Row[], sort: Sort, columns: ColumnDef<Row>[], get: (row: Row, keyId: string) => unknown): Row[] {
  const levels = sort.flatMap((l) => {
    const key = findSortKey(columns, l.key)
    if (!key) return []
    const then = key.then ? (findSortKey(columns, key.then) ?? { id: key.then, label: key.then }) : undefined
    return [{ key, then, sign: l.dir === 'asc' ? 1 : -1 }]
  })
  if (levels.length === 0) return rows.slice()
  const cmp = (a: Row, b: Row, k: SortKey, sign: number): number => {
    const va = get(a, k.id), vb = get(b, k.id)
    const ea = isEmpty(va), eb = isEmpty(vb)
    if (ea || eb) return ea && eb ? 0 : ea ? 1 : -1  // пустые в конец независимо от направления
    return compareValues(va, vb, k) * sign
  }
  return rows
    .map((row, i) => ({ row, i }))
    .sort((x, y) => {
      for (const l of levels) {
        const c = cmp(x.row, y.row, l.key, l.sign) || (l.then ? cmp(x.row, y.row, l.then, l.sign) : 0)
        if (c) return c
      }
      return x.i - y.i
    })
    .map((x) => x.row)
}
```

`index.ts`: `export { addSortLevel, defaultDir, findSortKey, flipSortLevel, removeSortLevel, soleSort, sortRows } from './sortRows'` (типы и `MAX_SORT_LEVELS` уже идут через `export * from './types'`).
- [ ] **Step 5: `ColumnHeader` на одном уровне.** Поведение прежнее, через помощники: активный ключ — ключ колонки, который есть в `sort` (первый по порядку уровней):

```ts
  const level = sort.find((l) => keys.some((k) => k.id === l.key))
  const active = level ? keys.find((k) => k.id === level.key) : undefined
  const pick = (keyId: string) => {
    const key = findSortKey([column], keyId)
    if (key) onSort(soleSort(sort, key))
  }
```

`items` — `checked: active?.id === k.id`, `hint: active?.id === k.id ? (level!.dir === 'asc' ? '↑' : '↓') : undefined`, сброс — `onSort([])`; `arrow`/`ariaSort` читают `level.dir`. Импорт `soleSort` вместо `defaultDir`.
- [ ] **Step 6: модель.** `createGridModel.ts`: `const $sort = createStore<Sort>([])`. Остальное без изменений (тип `Sort` уже массив).
- [ ] **Step 7: фейковый бэкенд, S3.** `apps/demo/src/data/fakeBackend.ts` — `createFakeBackend` принимает опцию подписей для ключей, чтобы статус сортировался по подписи:

```ts
export type FakeBackendOptions = {
  delay?: number | undefined
  /** Сортировать эти ключи по подписи, а не по коду: { status: STATUS_LABEL } (сверка S3). */
  sortLabels?: Record<string, Record<string, string>> | undefined
}
```

и в `searchFx`: `const get = (row: Row, key: string) => { const v = row[key]; const labels = opts.sortLabels?.[key]; return labels && typeof v === 'string' ? (labels[v] ?? v) : v }`. В `GridPage.tsx`: `createFakeBackend(docs, docsLayout, { sortLabels: { status: STATUS_LABEL } })`.
- [ ] **Step 8: остальные тесты — на массив.** Во всех тестах `packages/ui`, `packages/effector` и в демо `sort: null` → `sort: []`, `{ key, dir }` → `[{ key, dir }]`, ожидания `$sort`/`GridQuery.sort` — массивом. Найти: `rg -n "sort: null|sort: \{|toEqual\(\{ key:|onSort\(\{|\$sort" packages apps --glob '*.{ts,tsx}'`. В `ColumnHeader.test.tsx` добавить: при `sort=[{ key: 'amount', dir: 'desc' }, { key: 'type', dir: 'asc' }]` клик по колонке «Тип» с одним ключом → `onSort([{ key: 'type', dir: 'asc' }])` (единственным).
- [ ] **Step 9: запуск.** `pnpm check` — зелёный; `pnpm --filter demo e2e` — зелёный.
- [ ] **Step 10: CHANGELOG.** «Изменено (breaking): `Sort` — массив уровней `SortLevel[]` (`[]` — без сортировки), `GridQuery.sort` — массивом, как в контракте `vtb-filters`. Добавлено: `soleSort`, `addSortLevel`, `flipSortLevel`, `removeSortLevel`, `MAX_SORT_LEVELS`; `sortRows` — по уровням».
- [ ] **Step 11: commit.**

```bash
git add packages/ui/src/grid packages/effector/src apps/demo/src CHANGELOG.md
git commit -m "Сортировка: Sort — массив уровней, помощники уровней, sortRows по уровням; статус в демо по подписи"
```

---

### Task 2: Многоуровневая сортировка в интерфейсе, `SortChips`

**Files:**
- Modify: `packages/ui/src/grid/ColumnHeader.tsx`, `packages/ui/src/grid/useGridKeyboard.ts`, `packages/ui/src/grid/DataGrid.tsx`, `packages/ui/src/grid/Grid.module.css`, `packages/ui/src/grid/index.ts`
- Create: `packages/ui/src/grid/SortChips.tsx`, `packages/ui/src/grid/SortChips.test.tsx`
- Test: `ColumnHeader.test.tsx`, `DataGrid.keyboard.test.tsx`, `DataGrid.test.tsx`; e2e `apps/demo/e2e/registry.spec.ts`

**Interfaces:**
- Consumes: помощники Task 1.
- Produces: `SortChips<Row>({ sort, columns, onSort }: { sort: Sort; columns: ColumnDef<Row>[]; onSort: (s: Sort) => void })`; `DataGrid` рендерит чипы над таблицей при `sort.length > 0`.

- [ ] **Step 1: тесты шапки (падают).** `ColumnHeader.test.tsx`:

```tsx
  it('Shift+клик по колонке с одним ключом добавляет уровень; номер уровня у стрелки при двух уровнях', async () => {
    const onSort = vi.fn()
    const col: ColumnDef<unknown> = { id: 'a', title: 'Сумма', sort: [{ id: 'amount', label: 'Сумма', type: 'number' }], render: () => null }
    renderK(<table><thead><tr><ColumnHeader column={col} sort={[{ key: 'type', dir: 'asc' }]} onSort={onSort} width={100} /></tr></thead></table>)
    await userEvent.keyboard('{Shift>}')
    await userEvent.click(screen.getByRole('button', { name: /Сумма/ }))
    await userEvent.keyboard('{/Shift}')
    expect(onSort).toHaveBeenLastCalledWith([{ key: 'type', dir: 'asc' }, { key: 'amount', dir: 'desc' }])
  })
  it('номер уровня верхним индексом и aria-sort только у первого уровня', () => {
    const col = (id: string, key: string): ColumnDef<unknown> => ({ id, title: id, sort: [{ id: key, label: key }], render: () => null })
    const sort = [{ key: 'k1', dir: 'asc' as const }, { key: 'k2', dir: 'desc' as const }]
    renderK(<table><thead><tr><ColumnHeader column={col('c1', 'k1')} sort={sort} onSort={() => {}} width={100} /><ColumnHeader column={col('c2', 'k2')} sort={sort} onSort={() => {}} width={100} /></tr></thead></table>)
    const [h1, h2] = screen.getAllByRole('columnheader')
    expect(h1).toHaveAttribute('aria-sort', 'ascending')
    expect(h2).toHaveAttribute('aria-sort', 'none')
    expect(h1).toHaveTextContent('↑1')
    expect(h2).toHaveTextContent('↓2')
  })
  it('меню составной колонки: «+» добавляет уровень, у выбранного — «↕» меняет направление; подсказка', async () => {
    const onSort = vi.fn()
    const col: ColumnDef<unknown> = { id: 'c', title: '32', sort: [{ id: 'amount', label: 'Сумма', type: 'number' }, { id: 'currency', label: 'Валюта' }], render: () => null }
    renderK(<table><thead><tr><ColumnHeader column={col} sort={[{ key: 'type', dir: 'asc' }, { key: 'amount', dir: 'desc' }]} onSort={onSort} width={100} /></tr></thead></table>)
    await userEvent.click(screen.getByRole('button', { name: /32/ }))
    expect(screen.getByText('клик — единственный ключ · «+» или Shift+клик — добавить уровнем')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Валюта — добавить уровнем' }))
    expect(onSort).toHaveBeenLastCalledWith([{ key: 'type', dir: 'asc' }, { key: 'amount', dir: 'desc' }, { key: 'currency', dir: 'asc' }])
  })
```

Точная роль и имена пунктов меню зависят от `Menu` (`packages/ui/src/overlay/Menu.tsx`); если `Menu` не поддерживает вторую кнопку в строке — см. Step 3.
- [ ] **Step 2: тесты чипов (падают).** `SortChips.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { SortChips } from './SortChips'
import type { ColumnDef } from './types'

const columns: ColumnDef<unknown>[] = [
  { id: 't', title: 'Тип', sort: [{ id: 'type', label: 'Тип сообщения' }], render: () => null },
  { id: 'b', title: '52', sort: [{ id: 'f52', label: 'BIC 52' }], render: () => null },
]

describe('SortChips', () => {
  it('пусто — ничего; уровни — «Сортировка: 1 … › 2 …», подсказка при двух и более', async () => {
    const { container, rerender } = renderK(<SortChips sort={[]} columns={columns} onSort={() => {}} />)
    expect(screen.queryByText('Сортировка:')).toBeNull()
    const onSort = vi.fn()
    rerender(<SortChips sort={[{ key: 'type', dir: 'asc' }, { key: 'f52', dir: 'desc' }]} columns={columns} onSort={onSort} />)
    expect(screen.getByText('Сортировка:')).toBeInTheDocument()
    expect(screen.getByText('Shift+клик по заголовку — ещё уровень')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Тип сообщения, по возрастанию — сменить направление' }))
    expect(onSort).toHaveBeenLastCalledWith([{ key: 'type', dir: 'desc' }, { key: 'f52', dir: 'desc' }])
    await userEvent.click(screen.getByRole('button', { name: 'Убрать уровень BIC 52' }))
    expect(onSort).toHaveBeenLastCalledWith([{ key: 'type', dir: 'asc' }])
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

Run: `pnpm --filter @katran/ui test -- ColumnHeader SortChips` — FAIL.
- [ ] **Step 3: `ColumnHeader`.**
  - Клик по колонке с одним ключом: `e.shiftKey ? onSort(addSortLevel(sort, key)) : onSort(soleSort(sort, key))`.
  - Номер уровня: `const n = level ? sort.indexOf(level) + 1 : 0`; стрелка — `{arrow}{sort.length > 1 && n > 0 && <sup>{n}</sup>}` внутри `span.arrow`.
  - `aria-sort` — только если `level === sort[0]`, иначе `'none'` (при наличии ключей).
  - Меню составной колонки. Пункты для каждого ключа — два: «сделать единственным» (подпись ключа, `checked`, `hint` — стрелка и номер уровня) и отдельный пункт «<ключ> — добавить уровнем» (подпись «+») или «<ключ> — сменить направление уровня» (подпись «↕»), если ключ уже в `sort`; Shift при выборе первого пункта — тоже добавить уровнем (обработчик `onSelect` получает событие или читает `shiftKey` из последнего `pointerdown`/`keydown` — выбрать способ, который поддерживает `Menu`; если `Menu` не передаёт событие, расширить `MenuItem.onSelect` до `(e?: { shiftKey: boolean }) => void` совместимо назад). Отдельной строкой в конце меню — неинтерактивная подсказка «клик — единственный ключ · «+» или Shift+клик — добавить уровнем» (если у `Menu` нет неинтерактивных строк — добавить `MenuItem` вида `{ id, label, note: true }` с ролью `presentation`, совместимо назад); «Сбросить сортировку» → `onSort(removeSortLevel …)` для ключей этой колонки при нескольких уровнях или `onSort([])`, если уровни только этой колонки.
- [ ] **Step 4: Shift+Enter.** `useGridKeyboard.ts`, ветка `Enter`: вместо `items[0]!.click()` —

```ts
        if (items.length === 1) items[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: e.shiftKey }))
```

Тест в `DataGrid.keyboard.test.tsx`: фокус на ячейке шапки колонки с одним ключом, `{Shift>}{Enter}{/Shift}` → `onSort` получает два уровня (при заданном первом).
- [ ] **Step 5: `SortChips`.** `SortChips.tsx`:

```tsx
import { findSortKey, flipSortLevel, removeSortLevel } from './sortRows'
import s from './Grid.module.css'
import type { ColumnDef, Sort } from './types'

export type SortChipsProps<Row> = { sort: Sort; columns: ColumnDef<Row>[]; onSort: (s: Sort) => void }

/** Уровни сортировки над гридом (эталон, 4c9bf49): клик — сменить направление, ✕ — убрать уровень. */
export function SortChips<Row>({ sort, columns, onSort }: SortChipsProps<Row>) {
  if (sort.length === 0) return null
  return (
    <div className={s.sortChips} role="group" aria-label="Сортировка">
      <span className={s.sortLbl}>Сортировка:</span>
      {sort.map((l, i) => {
        const label = findSortKey(columns, l.key)?.label ?? l.key
        const dirText = l.dir === 'asc' ? 'по возрастанию' : 'по убыванию'
        return (
          <span key={l.key} className={s.sortChipWrap}>
            {i > 0 && <span className={s.sortSep} aria-hidden="true">›</span>}
            <span className={s.sortChip}>
              <span className={s.sortOrd} aria-hidden="true">{i + 1}</span>
              <button type="button" className={s.sortChipBtn} aria-label={`${label}, ${dirText} — сменить направление`} onClick={() => onSort(flipSortLevel(sort, l.key))}>
                {label} {l.dir === 'asc' ? '↑' : '↓'}
              </button>
              <button type="button" className={s.sortChipX} aria-label={`Убрать уровень ${label}`} onClick={() => onSort(removeSortLevel(sort, l.key))}>✕</button>
            </span>
          </span>
        )
      })}
      {sort.length > 1 && <span className={s.sortLbl}>Shift+клик по заголовку — ещё уровень</span>}
    </div>
  )
}
```

CSS в `Grid.module.css` — строка над таблицей на `paper`, отступ `var(--k-sp-2)`, чип `val-soft` с рамкой `line`, номер — mono 600 `fs-3` `muted`, ✕ — `faint`, при наведении `ink`; кегли/цвета — токены (`--k-fs-2`, `--k-fs-3`, `--k-val-soft`, `--k-line`, `--k-muted`, `--k-faint`, `--k-ink`, `--k-r-s`, `--k-sp-1`, `--k-sp-2`). Экспорт в `index.ts`: `export { SortChips, type SortChipsProps } from './SortChips'`.
- [ ] **Step 6: `DataGrid`.** Внутри `.root` перед `.wrap`: `<SortChips sort={p.sort} columns={layout.columns} onSort={p.onSort} />`. Тест в `DataGrid.test.tsx`: при `sort` из двух уровней группа «Сортировка» видна, при `[]` — нет.
- [ ] **Step 7: e2e.** `apps/demo/e2e/registry.spec.ts` — новый тест:

```ts
test('многоуровневая сортировка: Shift+клик по второму заголовку даёт два чипа', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/#/grid')
  await page.locator('tbody[data-key]').first().waitFor()
  await page.getByRole('columnheader', { name: /Тип/ }).getByRole('button').first().click()
  await page.getByRole('columnheader', { name: /^52/ }).getByRole('button').first().click({ modifiers: ['Shift'] })
  const chips = page.getByRole('group', { name: 'Сортировка' })
  await expect(chips).toContainText('1')
  await expect(chips).toContainText('Тип сообщения ↑')
  await expect(chips).toContainText('BIC 52 ↑')
})
```

- [ ] **Step 8: запуск.** `pnpm check` — зелёный; `pnpm --filter demo e2e` — зелёный.
- [ ] **Step 9: commit.**

```bash
git add packages/ui/src apps/demo/e2e/registry.spec.ts
git commit -m "Сортировка: Shift+клик и меню с «+» добавляют уровень, номер уровня у стрелки, чипы уровней над гридом"
```

---

### Task 3: Ячейки на всю высоту записи — раскладка и отрисовка

**Files:**
- Modify: `packages/ui/src/grid/types.ts`, `resolveSpans.ts`, `GridRecord.tsx`, `GridSkeleton.tsx`, `DataGrid.tsx`
- Test: `resolveSpans.test.ts`, `GridRecord.test.tsx`, `DataGrid.test.tsx`

**Interfaces:**
- Produces: `ColumnDef.fullHeight?: boolean | undefined`; `resolveSpans(spans, visibleOrder, fullOrder?, tall?: ReadonlySet<string>)`; `fillSegments(segs, tall: number | boolean[])` (число — прежний вызов, все колонки первой строки); `GridRecord` рисует служебную и высокие колонки с `rowSpan`.

- [ ] **Step 1: тесты `resolveSpans` (падают).**

```ts
  it('сегмент не заходит на высокие колонки: обрезка до непрерывного участка от первой покрытой', () => {
    const spans = [{ id: 'p', from: 'a', to: 'd', render: () => null }]
    // видимый порядок: a b T c d, T — на всю высоту
    expect(resolveSpans(spans, ['a', 'b', 'T', 'c', 'd'], ['a', 'b', 'T', 'c', 'd'], new Set(['T']))).toEqual([{ id: 'p', colStart: 0, colSpan: 2 }])
    // первая покрытая — высокая: участок начинается со следующей колонки первой строки
    expect(resolveSpans([{ id: 'q', from: 'T', to: 'd', render: () => null }], ['a', 'T', 'c', 'd'], ['a', 'T', 'c', 'd'], new Set(['T']))).toEqual([{ id: 'q', colStart: 2, colSpan: 2 }])
    // без высоких — как раньше
    expect(resolveSpans(spans, ['a', 'b', 'c', 'd'])).toEqual([{ id: 'p', colStart: 0, colSpan: 4 }])
  })
```

и `fillSegments` (в `GridRecord.test.tsx`):

```ts
  it('fillSegments: заполнители только по колонкам первой строки, не через высокие', () => {
    const seg = { def: { id: 's', from: 'a', to: 'a', render: () => null }, colStart: 0, colSpan: 1 }
    // колонки: a(0) T(1, высокая) b(2) c(3)
    expect(fillSegments([seg], [false, true, false, false])).toEqual([seg, { filler: true, colSpan: 2 }])
    expect(fillSegments([], [false, true, false])).toEqual([{ filler: true, colSpan: 1 }, { filler: true, colSpan: 1 }])
    expect(fillSegments([seg], 3)).toEqual([seg, { filler: true, colSpan: 2 }])
  })
  it('высокая колонка и служебная — rowSpan на всю запись, во сквозной строке под ними ячеек нет', () => {
    type R = { a: string; t: string }
    const visible: ColumnDef<R>[] = [{ id: 'a', render: (r) => r.a }, { id: 't', fullHeight: true, render: (r) => r.t }]
    const spanRows = [[{ def: { id: 's', from: 'a', to: 'a', render: () => 'сегмент' }, colStart: 0, colSpan: 1 }]]
    renderK(<table><GridRecord row={{ a: 'A', t: 'T' }} rowKey="k" visible={visible} spanRows={spanRows} lead="L" rowIndex={2} /></table>)
    const rows = screen.getAllByRole('row')
    const [lead, a, t] = within(rows[0]!).getAllByRole('gridcell')
    expect(lead).toHaveAttribute('rowspan', '2')
    expect(a).not.toHaveAttribute('rowspan')
    expect(t).toHaveAttribute('rowspan', '2')
    expect(within(rows[1]!).getAllByRole('gridcell')).toHaveLength(1)
    expect(within(rows[1]!).getByRole('gridcell')).toHaveTextContent('сегмент')
  })
```

Run: `pnpm --filter @katran/ui test -- resolveSpans GridRecord` — FAIL.
- [ ] **Step 2: тип.** `ColumnDef`:

```ts
  /** Ячейка на всю высоту записи (rowSpan): сквозные строки проходят только под колонками без fullHeight (спека 5a §2). */
  fullHeight?: boolean | undefined
```

- [ ] **Step 3: `resolveSpans`.** Новый необязательный параметр `tall: ReadonlySet<string> = new Set()`:

```ts
    const covered = new Set(fullOrder.slice(lo, hi + 1))
    // участок: первая покрытая колонка первой строки и дальше подряд, пока колонки покрыты и не высокие
    const first = visibleOrder.findIndex((id) => covered.has(id) && !tall.has(id))
    if (first < 0) continue
    let end = first
    while (end + 1 < visibleOrder.length && covered.has(visibleOrder[end + 1]!) && !tall.has(visibleOrder[end + 1]!)) end += 1
    out.push({ id: s.id, colStart: first, colSpan: end - first + 1 })
```

(JSDoc дополнить правилом обрезки.)
- [ ] **Step 4: `fillSegments` и `GridRecord`.** `GridRecord.tsx`:

```ts
/** Между сегментами и по краям — заглушки по колонкам первой строки; высокие колонки (tall[i]) заняты rowSpan, заглушка их не пересекает. */
export function fillSegments<Row>(segs: SpanCell<Row>[], tall: number | boolean[]): Array<SpanCell<Row> | Filler> {
  const mask = typeof tall === 'number' ? Array.from({ length: tall }, () => false) : tall
  const out: Array<SpanCell<Row> | Filler> = []
  const gap = (from: number, to: number) => {
    let i = from
    while (i < to) {
      if (mask[i]) { i += 1; continue }
      let j = i
      while (j < to && !mask[j]) j += 1
      out.push({ filler: true, colSpan: j - i })
      i = j
    }
  }
  let cursor = 0
  for (const seg of segs) {
    gap(cursor, seg.colStart)
    out.push(seg)
    cursor = seg.colStart + seg.colSpan
  }
  gap(cursor, mask.length)
  return out
}
```

В `GridRecord`: `const perRecord = 1 + spanRows.length`, `const span = perRecord > 1 ? perRecord : undefined`, `const tall = visible.map((c) => c.fullHeight === true)`. Служебная ячейка первой строки — `rowSpan={span}`; ячейка колонки — `rowSpan={c.fullHeight ? span : undefined}`. Во сквозных строках служебной ячейки больше нет; `fillSegments(segs, tall)`.
- [ ] **Step 5: `GridSkeleton`** — та же структура: служебная и высокие — `rowSpan`, сквозные строки без служебной ячейки, `fillSegments(segs, tall)`.
- [ ] **Step 6: `DataGrid`.** `const tallIds = useMemo(() => new Set(visible.filter((c) => c.fullHeight).map((c) => c.id)), [visible])`; в `resolveSpans(…, visibleIds, fullOrder, tallIds)`.
- [ ] **Step 7: запуск.** `pnpm --filter @katran/ui test` — PASS; `pnpm check` — зелёный (демо пока без `fullHeight` — поведение прежнее, кроме служебной ячейки на всю высоту: e2e геометрии — зелёный).
- [ ] **Step 8: commit.**

```bash
git add packages/ui/src/grid
git commit -m "Грид: колонки на всю высоту записи — rowSpan, сегменты не заходят на высокие колонки, служебная колонка на всю высоту"
```

---

### Task 4: Ячейки на всю высоту — клавиатура и демо

**Files:**
- Modify: `packages/ui/src/grid/useGridKeyboard.ts`
- Test: `packages/ui/src/grid/DataGrid.keyboard.test.tsx`
- Modify: `apps/demo/src/pages/GridPage.tsx`, `apps/demo/src/data/docs.ts` (не требуется, если данные не меняются)
- Test: `apps/demo/e2e/geometry.spec.ts` (без правок — прогон)

- [ ] **Step 1: тесты клавиатуры (падают).** В `DataGrid.keyboard.test.tsx` грид из двух записей, раскладка: `a` (первая строка), `t` (`fullHeight`), сквозная строка `from:'a', to:'a'`:

```tsx
  it('↓ из высокой ячейки — в ту же колонку следующей записи; ↑ из следующей записи на высокую колонку — в высокую ячейку', async () => {
    renderGrid()   // помощник файла: layout с a, t(fullHeight), spans [[a..a]], rows r1, r2
    const t1 = cellOf('r1', 't')   // помощник: ячейка колонки t записи r1 (по data-key и индексу колонки)
    t1.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(cellOf('r2', 't'))
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(t1)
  })
  it('↓ из сквозной строки на колонку высокой ячейки следующей записи; ↑ из сквозной строки на высокую колонку — в высокую ячейку своей записи', async () => {
    renderGrid()
    const seg1 = spanCellOf('r1', 's')
    seg1.focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(cellOf('r1', 'a'))
  })
```

Помощники `renderGrid`, `cellOf`, `spanCellOf` описать в файле теста (по `tbody[data-key="…"]`, строкам `tr` и `data-cell`).
- [ ] **Step 2: реализация.** `useGridKeyboard.ts`: у ячейки есть `rowSpan` (DOM). Вспомогательные функции:

```ts
/** Ячейка колонки c в строке row; если колонку занимает высокая ячейка из строки выше той же записи — она. */
function cellAt(row: HTMLTableRowElement, c: number): HTMLElement | undefined {
  const exact = cellsOf(row).find((el) => parse(el.dataset.cell!)[1] === c)
  if (exact) return exact
  const body = row.parentElement
  if (body && body.tagName === 'TBODY') {
    for (const r of Array.from(body.children) as HTMLTableRowElement[]) {
      if (r === row) break
      const tall = cellsOf(r).find((el) => parse(el.dataset.cell!)[1] === c && (el as HTMLTableCellElement).rowSpan > 1)
      if (tall) return tall
    }
  }
  return pickCell(row, c)
}
```

В `switch`: `ArrowDown` — `const next = rows[ri + Math.max(1, (cell as HTMLTableCellElement).rowSpan)]; target = next ? cellAt(next, c) : undefined`; `ArrowUp` — `target = rows[ri - 1] ? cellAt(rows[ri - 1]!, c) : undefined`.
- [ ] **Step 3: демо.** `GridPage.tsx`, `docsLayout`: `fullHeight: true` у `created`, `type`, `direction`, `amount`, `sr`, `prov`; `lines: 3` у `created` не ставить до 5b (данных Дт/Кт нет до Task 6). Сегмент причины — `{ id: 'reason', from: 'status', to: 'id', … }`; `SPANS_SNIPPET` — синхронно (текст блока `spans` дословно).
- [ ] **Step 4: запуск.** `pnpm check` — зелёный; `pnpm --filter demo e2e` — `geometry` зелёный, записать числа (запись/шапка/скелетон/125 %) в отчёт задачи.
- [ ] **Step 5: commit.**

```bash
git add packages/ui/src/grid/useGridKeyboard.ts packages/ui/src/grid/DataGrid.keyboard.test.tsx apps/demo/src/pages/GridPage.tsx
git commit -m "Грид: стрелки по записям с высокими ячейками; демо — колонки на всю высоту, причина под статусом и ID"
```

---

### Task 5: «Вместе / раздельно» в `@katran/ui`

**Files:**
- Modify: `packages/ui/src/grid/types.ts`, `resolveSpans.ts`, `sortRows.ts` (`findSortKey`), `ColumnsMenu.tsx`, `DataGrid.tsx`, `Grid.module.css`, `index.ts`
- Test: `resolveSpans.test.ts`, `sortRows.test.ts`, `ColumnsMenu.test.tsx`, `DataGrid.test.tsx`

**Interfaces:**
- Produces:

```ts
// ColumnDef<Row>
split?: {
  label: string
  render: (row: Row) => ReactNode
  sort?: SortKey[] | undefined
  parts: ColumnDef<Row>[]
} | undefined

export function expandColumns<Row>(columns: ColumnDef<Row>[], split: string[]): ColumnDef<Row>[]
/** id и ширины всех колонок раскладки, включая части split — для GridModelConfig.columns. */
export function gridColumns<Row>(columns: ColumnDef<Row>[]): { id: string; width?: number | undefined }[]
// DataGridProps: split?: string[] | undefined; onSplit?: ((p: { id: string; on: boolean }) => void) | undefined
// ColumnsMenuProps: split?: string[] | undefined; onSplit?: …
```

- [ ] **Step 1: тесты (падают).** `resolveSpans.test.ts`:

```ts
describe('expandColumns', () => {
  type R = { a: number; c: string }
  const cur: ColumnDef<R> = { id: 'ccy', title: 'Валюта', sort: [{ id: 'currency', label: 'Валюта' }], render: (r) => r.c }
  const host: ColumnDef<R> = {
    id: 'amount', title: '32', sort: [{ id: 'amount', label: 'Сумма' }, { id: 'currency', label: 'Валюта' }], render: (r) => `${r.a} ${r.c}`,
    split: { label: 'Валюта отдельной колонкой', render: (r) => String(r.a), parts: [cur] },
  }
  it('«вместе» — как есть; «раздельно» — хост без части и части сразу за ним, ключи частей уходят из хоста', () => {
    expect(expandColumns([host], []).map((c) => c.id)).toEqual(['amount'])
    const out = expandColumns([host, { id: 'x', render: () => null }], ['amount'])
    expect(out.map((c) => c.id)).toEqual(['amount', 'ccy', 'x'])
    expect(out[0]!.sort).toEqual([{ id: 'amount', label: 'Сумма' }])
    expect(out[0]!.render({ a: 1, c: 'USD' })).toBe('1')
  })
  it('gridColumns включает части', () => {
    expect(gridColumns([host])).toEqual([{ id: 'amount', width: undefined }, { id: 'ccy', width: undefined }])
  })
})
```

`sortRows.test.ts`: `findSortKey` находит ключ части (`findSortKey([host], 'currency')` — ключ из хоста или части — определён). `ColumnsMenu.test.tsx`:

```tsx
  it('у составной колонки — переключатель «раздельно»; части отдельными пунктами не показываются', async () => {
    const onSplit = vi.fn()
    renderK(<ColumnsMenu open anchor={{ current: document.body }} onClose={() => {}} columns={[host]} order={['amount']} hidden={[]} onChange={() => {}} split={[]} onSplit={onSplit} />)
    expect(screen.queryByRole('checkbox', { name: 'Валюта' })).toBeNull()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Валюта отдельной колонкой' }))
    expect(onSplit).toHaveBeenCalledWith({ id: 'amount', on: true })
  })
```

`DataGrid.test.tsx`: при `split={['amount']}` в шапке есть колонка «Валюта» сразу за «32»; при `[]` — нет.
Run: `pnpm --filter @katran/ui test` — FAIL.
- [ ] **Step 2: тип `split`** — в `ColumnDef` (как в Interfaces, с JSDoc из спеки §4).
- [ ] **Step 3: `expandColumns`, `gridColumns`** — в `resolveSpans.ts`:

```ts
/** «Раздельно» (спека 5a §4): хост рисует split.render, части — сразу за ним; ключи частей уходят из хоста, если split.sort не задан. */
export function expandColumns<Row>(columns: ColumnDef<Row>[], split: string[]): ColumnDef<Row>[] {
  const on = new Set(split)
  return columns.flatMap((c) => {
    if (!c.split || !on.has(c.id)) return [c]
    const partKeys = new Set(c.split.parts.flatMap((p) => (p.sort ?? []).map((k) => k.id)))
    const host: ColumnDef<Row> = { ...c, render: c.split.render, sort: c.split.sort ?? (c.sort ?? []).filter((k) => !partKeys.has(k.id)) }
    return [host, ...c.split.parts]
  })
}
export const gridColumns = <Row,>(columns: ColumnDef<Row>[]): { id: string; width?: number | undefined }[] =>
  columns.flatMap((c) => [{ id: c.id, width: c.width }, ...(c.split?.parts ?? []).map((p) => ({ id: p.id, width: p.width }))])
```

Раскрытие идёт **после** `visibleColumns` (части следуют за хостом и скрываются вместе с ним — Ruling плана: спека §4 говорит «до visibleColumns», но тогда части жили бы в порядке и скрытии отдельно, что противоречит той же спеке; правится текст спеки в Task 9).
- [ ] **Step 4: `findSortKey`** ищет и в частях: `for (const c of columns) { for (const k of c.sort ?? []) if (k.id === keyId) return k; for (const p of c.split?.parts ?? []) for (const k of p.sort ?? []) if (k.id === keyId) return k }`.
- [ ] **Step 5: `DataGrid`.** Пропы `split`, `onSplit`. `const split = p.split ?? []`; `visible = expandColumns(visibleColumns(p.order, p.hidden, layout.columns), split)`; `fullOrder = expandColumns(visibleColumns(p.order, [], layout.columns), split).map((c) => c.id)`; `SortChips` получает развёрнутые `layout.columns` с частями — `findSortKey` и так находит части. `ColumnsMenu` — `split`, `onSplit`.
- [ ] **Step 6: `ColumnsMenu`.** Под пунктом колонки с `split` и при заданном `onSplit` — строка `<li className={s.colsSplit}><Checkbox label={c.split.label} checked={split.includes(id)} onChange={(e) => onSplit({ id, on: e.target.checked })} /></li>`; отступ слева `var(--k-sp-6)`.
- [ ] **Step 7: запуск.** `pnpm check` — зелёный.
- [ ] **Step 8: commit.**

```bash
git add packages/ui/src/grid
git commit -m "Грид: «вместе / раздельно» для составных колонок — ColumnDef.split, expandColumns, переключатель в меню состава"
```

---

### Task 6: «Вместе / раздельно» в модели и демо

**Files:**
- Modify: `packages/effector/src/createGridModel.ts`, `packages/effector/src/useGrid.ts`
- Test: `packages/effector/src/createGridModel.test.ts`, `hooks.test.tsx`
- Modify: `apps/demo/src/data/docs.ts`, `apps/demo/src/pages/GridPage.tsx`, `apps/demo/src/data/fakeBackend.ts` (если нужно для новых ключей — нет)
- Test: `apps/demo/e2e/registry.spec.ts`

**Interfaces:**
- Produces: `GridModel.$split: Store<string[]>`, `setSplit: EventCallable<{ id: string; on: boolean }>`; `GridPersisted.split: string[]`; `GridBinding.split`, `onSplit`.

- [ ] **Step 1: тесты модели (падают).** `createGridModel.test.ts`:

```ts
  it('setSplit меняет $split и сохраняется; чужие id из сохранённого отбрасываются', async () => {
    const persist = memoryPersist<Partial<GridPersisted>>()
    persist.save('g', { split: ['amount', 'gone'] })
    const m = createGridModel<Row>({ id: 'g', columns: [{ id: 'amount' }, { id: 'ccy' }, { id: 'created' }], $filter: createStore<Filter>([]), fetchFx: okFx(), persist, rowKey: (r) => r.id })
    const scope = fork()
    expect(scope.getState(m.$split)).toEqual(['amount'])
    await allSettled(m.setSplit, { scope, params: { id: 'created', on: true } })
    expect(scope.getState(m.$split)).toEqual(['amount', 'created'])
    await allSettled(m.setSplit, { scope, params: { id: 'amount', on: false } })
    expect(scope.getState(m.$split)).toEqual(['created'])
    expect(persist.load('g')?.split).toEqual(['created'])
  })
```

(`okFx` — существующий в файле помощник эффекта или `createEffect(async () => ({ rows: [], total: 0 }))`.) `hooks.test.tsx`: `useGrid` отдаёт `split` и `onSplit`, вызов `onSplit({ id: 'amount', on: true })` меняет `split`.
- [ ] **Step 2: реализация.** `GridPersisted` + `split: string[]`. В модели:

```ts
  const setSplit = createEvent<{ id: string; on: boolean }>()
  const $split = createStore<string[]>((saved.split ?? []).filter((id) => ids.includes(id)))
  $split.on(setSplit, (list, { id, on }) => (on ? (list.includes(id) || !ids.includes(id) ? list : [...list, id]) : list.filter((x) => x !== id)))
```

`$persisted` — плюс `split`, `sample({ clock: [..., setSplit], … })`. Вернуть `$split`, `setSplit`. `GridModel` — типы. `useGrid`: `split` из `m.$split`, `onSplit` — `m.setSplit`; `GridBinding` — поля `split: string[]`, `onSplit: (p: { id: string; on: boolean }) => void`.
- [ ] **Step 3: демо-данные.** `docs.ts`: в `Doc` — `vdDt: string; vdKt: string` (ISO-день); в `makeDocs` — `vdDt: '2026-09-23'`, `vdKt: r() > 0.85 ? '2026-09-24' : '2026-09-23'` (детерминированно тем же `rng`; вызов `r()` добавить в конец объекта, чтобы не сдвигать остальные значения ГПСЧ). `valueDate` оставить (фильтр и ключи сортировки его используют) или заменить на `vdDt` во всех местах — выбрать замену: `valueDate` удалить, ключ сортировки «Валютирование» → два ключа `vdDt` «Валютирование Дт», `vdKt` «Валютирование Кт» (как на эталоне).
- [ ] **Step 4: раскладка.** `GridPage.tsx`:
  - `amount` — `split: { label: 'Валюта отдельной колонкой', render: (d) => <CopyValue value={formatAmount(d.amount)} tone="ink" tabIndex={T} />, parts: [{ id: 'currency', title: 'Валюта', width: 76, fullHeight: true, sort: [{ id: 'currency', label: 'Валюта' }], render: (d) => <Tag>{d.currency}</Tag> }] }`;
  - `created` — `lines: 3`, `render` — дата документа (`formatDateTimeFull`), ниже «Дт …», «Кт …» (`formatDate`, `tone="ink2"`); ключи: `created`, `vdDt`, `vdKt`; `split: { label: 'Валютирование отдельной колонкой', render: (d) => <CopyValue value={formatDateTimeFull(d.created)} tone="ink" tabIndex={T} />, parts: [{ id: 'valueDates', title: 'Валютирование', width: 110, lines: 2, fullHeight: true, sort: [{ id: 'vdDt', label: 'Валютирование Дт', type: 'date' }, { id: 'vdKt', label: 'Валютирование Кт', type: 'date' }], render: (d) => <>Дт <CopyValue value={formatDate(d.vdDt)} tone="ink2" tabIndex={T} /><div>Кт <CopyValue value={formatDate(d.vdKt)} tone="ink2" tabIndex={T} /></div></> }] }`;
  - модель: `columns: gridColumns(docsLayout.columns)`;
  - `DataGrid` получает `split`/`onSplit` через `{...g}`.
- [ ] **Step 5: e2e.** `registry.spec.ts`:

```ts
test('«Валюта отдельной колонкой» добавляет колонку и переживает перезагрузку', async ({ page }) => {
  await page.goto('/#/grid')
  await page.locator('tbody[data-key]').first().waitFor()
  await page.getByRole('button', { name: 'Состав колонок' }).click()
  await page.getByRole('checkbox', { name: 'Валюта отдельной колонкой' }).check()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('columnheader', { name: /^Валюта/ })).toBeVisible()
  await page.reload()
  await page.locator('tbody[data-key]').first().waitFor()
  await expect(page.getByRole('columnheader', { name: /^Валюта/ })).toBeVisible()
})
```

(Тест не очищает `localStorage` после `goto` — только `beforeEach` файла, если он есть; если `beforeEach` чистит `localStorage` в `addInitScript`, перезагрузка тоже очистит — тогда в этом тесте перезагрузку сделать через `page.goto` без init-скрипта: создать отдельный `test.describe` без `beforeEach`.) `geometry.spec.ts` — прогнать: запись с трёхстрочной датой в коридоре 64–72.
- [ ] **Step 6: запуск.** `pnpm check` — зелёный; `pnpm --filter demo e2e` — зелёный; числа геометрии — в отчёт.
- [ ] **Step 7: commit.**

```bash
git add packages/effector/src apps/demo/src apps/demo/e2e
git commit -m "Модель: «вместе / раздельно» в раскладке пользователя; демо — валюта и валютирование отдельными колонками, дата тремя строками"
```

---

### Task 7: Сброс ширин (W1)

**Files:**
- Modify: `packages/effector/src/createGridModel.ts`, `useGrid.ts`; `packages/ui/src/grid/ColumnHeader.tsx`, `DataGrid.tsx`
- Test: `createGridModel.test.ts`, `ColumnHeader.test.tsx`, `apps/demo/e2e/registry.spec.ts`

**Interfaces:**
- Produces: `GridModel.resetWidths: EventCallable<void>`, `resetWidth: EventCallable<string>`; `GridBinding.onResetWidths`, `onResetWidth`; `DataGridProps.onResetWidths?`, `onResetWidth?`; `ColumnHeaderProps.onResetWidth?`, `onResetWidths?`.

- [ ] **Step 1: тесты (падают).** Модель:

```ts
  it('resetWidth — ширина колонки из конфига; resetWidths — все; сохраняется', async () => {
    const persist = memoryPersist<Partial<GridPersisted>>()
    const m = createGridModel<Row>({ id: 'g', columns: [{ id: 'a', width: 100 }, { id: 'b', width: 80 }], $filter: createStore<Filter>([]), fetchFx: okFx(), persist, rowKey: (r) => r.id })
    const scope = fork()
    await allSettled(m.resize, { scope, params: { id: 'a', width: 200 } })
    await allSettled(m.resize, { scope, params: { id: 'b', width: 200 } })
    await allSettled(m.resetWidth, { scope, params: 'a' })
    expect(scope.getState(m.$widths)).toEqual({ a: 100, b: 200 })
    await allSettled(m.resetWidths, { scope })
    expect(scope.getState(m.$widths)).toEqual({ a: 100, b: 80 })
    expect(persist.load('g')?.widths).toEqual({ a: 100, b: 80 })
  })
```

`ColumnHeader`: двойной клик по ползунку → `onResetWidths`; Home на ползунке → `onResetWidth`; Shift+Home → `onResetWidths`.
- [ ] **Step 2: модель.** `const defaultWidths: Record<string, number> = {}` из `cfg.columns` (заполняется до `Object.assign` с сохранёнными); `$widths.on(resetWidths, () => ({ ...defaultWidths })).on(resetWidth, (w, id) => { const next = { ...w }; if (defaultWidths[id] === undefined) delete next[id]; else next[id] = defaultWidths[id]!; return next })`; persist-сэмпл — плюс `resetWidths`, `resetWidth`. `useGrid` — `onResetWidths`, `onResetWidth`.
- [ ] **Step 3: шапка и грид.** `ColumnHeader`: на кнопке-ползунке `onDoubleClick={() => onResetWidths?.()}`; в `onHandleKey` — `if (e.key === 'Home') { e.preventDefault(); if (e.shiftKey) onResetWidths?.(); else onResetWidth?.() }`; `aria-keyshortcuts="Home Shift+Home"`. `DataGrid` передаёт `onResetWidths={p.onResetWidths}` и `onResetWidth={() => p.onResetWidth?.(c.id)}`.
- [ ] **Step 4: e2e.** Двойной клик по ручке после ресайза возвращает ширину заголовка к исходной (`boundingBox().width` до и после, допуск 1).
- [ ] **Step 5: запуск и commit.** `pnpm check`, `pnpm --filter demo e2e` — зелёные.

```bash
git add packages/effector/src packages/ui/src/grid apps/demo/e2e
git commit -m "Грид: сброс ширин — двойной клик по ручке, Home / Shift+Home на ползунке"
```

---

### Task 8: Состояния записи (B1) и подсказка открытия (B7)

**Files:**
- Modify: `packages/tokens/src/tokens.src.ts` (+ `pnpm gen`, сгенерированные `tokens.css`/`tokens.ts`)
- Modify: `packages/ui/src/grid/types.ts`, `GridRecord.tsx`, `DataGrid.tsx`, `Grid.module.css`; `packages/ui/src/filters/BulkBar.tsx`
- Test: `GridRecord.test.tsx`, `DataGrid.test.tsx`, `packages/ui/src/filters/BulkBar.test.tsx`
- Modify: `apps/demo/src/data/docs.ts`, `apps/demo/src/pages/GridPage.tsx`; Test: `apps/demo/e2e/registry.spec.ts`

**Interfaces:**
- Produces: `RowState`; `DataGridProps.rowState?: ((row: Row) => RowState) | undefined`, `openHint?: string | undefined`, `onOpen(row, { secondary, state })`; `GridRecordProps.state?: RowState | undefined`; `BulkBarProps.allNote?: string | undefined`.

- [ ] **Step 1: токен.** `sizes`: `'hatch': 10, // шаг штриховки неактивной записи (эталон: 9 + 1)`; `pnpm gen`.
- [ ] **Step 2: тесты (падают).** `DataGrid.test.tsx`:

```tsx
  it('B1: заблокированная — замок и подсказка, выделять можно; неактивная — чекбокс disabled, страница выделяет только доступные', async () => {
    const onSelectPage = vi.fn()
    const onOpen = vi.fn()
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const rowState = (r: { id: string }): RowState =>
      r.id === 'a' ? { kind: 'locked', who: 'Иванова М. П.', since: '2026-09-23T09:13:00' } : r.id === 'b' ? { kind: 'inactive', why: 'Документ в архиве' } : null
    renderK(<DataGrid {...base({ rows, total: 3, selection: { mode: 'ids', ids: [] }, onSelect: () => {}, onSelectPage, onOpen, rowState, openHint: 'Открыть деталку' })} />)
    const lock = screen.getByRole('button', { name: 'Заблокирована: Иванова М. П., с 23.09.2026 09:13 · открыть только для просмотра' })
    await userEvent.click(lock)
    expect(onOpen).toHaveBeenCalledWith(rows[0], { secondary: false, state: rowState(rows[0]!) })
    expect(screen.getByRole('checkbox', { name: 'Выбрать запись 2' })).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Выбрать все на странице' }))
    expect(onSelectPage).toHaveBeenCalledWith({ ids: ['a', 'c'], on: true })
    expect(document.querySelector('tbody[data-key="a"]')).toHaveAttribute('data-state', 'locked')
    expect(document.querySelector('tbody[data-key="b"]')).toHaveAttribute('data-state', 'inactive')
    expect(screen.getByRole('button', { name: 'Открыть запись 3' })).toHaveAttribute('data-k-tip', 'Открыть деталку')
  })
```

(`base` — помощник файла; `rowKey` в его раскладке — `r.id`; если `layout` помощника другой — поправить.) Плюс axe для той же разметки. `BulkBar.test.tsx`: `allNote="без неактивных"` при `mode: 'all'` — текст «Все 5 по фильтру, без неактивных»; при `mode: 'ids'` — без приписки.
- [ ] **Step 3: тип.** `types.ts`:

```ts
/** Состояние записи с бека (спека 5a §6): заблокирована другим пользователем или неактивна. */
export type RowState = { kind: 'locked'; who: string; since: string } | { kind: 'inactive'; why: string } | null
```

- [ ] **Step 4: грид.** `DataGrid`:
  - `const stateOf = (row: Row): RowState => p.rowState?.(row) ?? null`.
  - Выделяемые на странице: `const selectable = rows.filter((r) => stateOf(r)?.kind !== 'inactive').map(layout.rowKey)`; `pageState(selection, selectable)`; `onSelectPage({ ids: selectable, on: … })`; чекбокс шапки `disabled={selectable.length === 0}`.
  - Служебная ячейка: чекбокс записи — `disabled` при `inactive`, `data-k-tip={`${st.why} · выбрать нельзя`}`; кнопка открытия — у `locked` иконка замка (`Lock` svg рядом с `Open`, тон `warn` классом `s.openLocked`), `label` — «Заблокирована: <who>, с <дд.мм.гггг чч:мм> · открыть только для просмотра» (дата — `formatDateTimeShort`-подобно, без секунд: взять из `../format` подходящий или собрать `formatDate(since) + ' ' + since.slice(11, 16)`), `data-k-tip` — тот же текст; у `inactive` — `data-k-tip={`${why} · открыть`}`; иначе `data-k-tip={p.openHint}` (атрибут не ставить, если `openHint` не задан). `onClick` → `p.onOpen!(row, { secondary: e.detail >= 2 || e.shiftKey, state: stateOf(row) })`; тип `onOpen` — `(row: Row, opts: { secondary: boolean; state: RowState }) => void`.
  - `GridRecord` получает `state`; `<tbody … data-state={state?.kind}>`.
- [ ] **Step 5: стили** (`Grid.module.css`, только токены):

```css
/* состояния записи (эталон 1d57ded): значения приглушены переопределением тонов внутри записи — классы значений не адресуются */
.record[data-state] {
  --k-ink: var(--k-muted);
  --k-ink2: var(--k-muted);
  --k-val: var(--k-faint);
}

.record[data-state] [data-tone] {
  filter: grayscale(1);
  opacity: 0.55;
}

.record[data-state='locked'] > tr:first-child > td:first-child {
  box-shadow: inset 3px 0 0 var(--k-warn-soft);
}

.record[data-state='inactive'] .cell {
  background: repeating-linear-gradient(135deg, transparent 0 calc(var(--k-hatch) * 0.9), var(--k-sunk) calc(var(--k-hatch) * 0.9) var(--k-hatch));
}

.record[data-state='inactive']:hover .cell {
  background: var(--k-hover);
}

.openLocked {
  color: var(--k-warn);
}
```

Проверить в браузере, что переопределение `--k-ink` внутри записи действует (STATE §8: `var()` резолвится там, где объявлено — здесь объявление на записи, `--k-muted` корня уже вычислен; если тон значения задан не через `var(--k-ink)`, а литералом токена в другом свойстве — описать в отчёте и выбрать другой способ без адресации классов значений).
- [ ] **Step 6: `BulkBar`.** Проп `allNote?: string | undefined`; при `all` текст — `` `Все ${n} по фильтру${allNote ? `, ${allNote}` : ''}` ``.
- [ ] **Step 7: демо.** `docs.ts`: в `Doc` — `lock: { who: string; since: string } | null; inactive: { why: string } | null`; в `makeDocs` — `lock: i % 11 === 2 ? { who: ['Иванова М. П.', 'Кузнецов Д. А.', 'Смирнова Е. В.'][i % 3]!, since: `2026-09-23T${pad(9 + (i % 8), 2)}:${pad((i * 13) % 60, 2)}:00` } : null`, `inactive: i % 13 === 7 ? { why: ['Документ в архиве', 'Запись отозвана инициатором', 'Снят с обработки администратором'][i % 3]! } : null` (без вызовов `r()` — не сдвигать ГПСЧ). `GridPage.tsx`: `rowState={(d) => (d.lock ? { kind: 'locked', ...d.lock } : d.inactive ? { kind: 'inactive', ...d.inactive } : null)}`, `openHint="Открыть деталку · двойной клик или Shift — рядом для сравнения"`, `BulkBar allNote={g.rows.some((d) => d.inactive) ? 'без неактивных' : undefined}`; сообщение открытия — с «(только просмотр)» для `locked`.
- [ ] **Step 8: e2e.** `registry.spec.ts`: у записи с `data-state="inactive"` чекбокс `disabled`; у `data-state="locked"` кнопка открытия с именем, начинающимся на «Заблокирована:». `isolation.spec.ts` и `geometry.spec.ts` — прогон.
- [ ] **Step 9: запуск и commit.** `pnpm check`, `pnpm --filter demo e2e` — зелёные.

```bash
git add packages/tokens/src packages/ui/src apps/demo/src apps/demo/e2e
git commit -m "Грид: состояния записи — заблокирована и неактивна, выделение без неактивных; подсказка кнопки открытия"
```

---

### Task 9: Документы

**Files:**
- Modify: `docs/superpowers/specs/2026-09-23-katran-design.md` (§1.2, §6.1–6.3, §8.2), `docs/superpowers/specs/2026-09-28-katran-registry-structure-design.md` (§4 — раскрытие после `visibleColumns`), `CHANGELOG.md`, `docs/consuming.md`, `docs/reference/registry-drift.md`, `docs/STATE.md`, `docs/superpowers/plans/2026-09-28-katran-pi-app.md`, `README.md` (если описывает API грида)

- [ ] **Step 1: основная спека.** §1.2 — строку «Мульти-сортировка — не делаем» убрать, в §6 — многоуровневая сортировка (ссылка на В1 и спеку 5a §3). §6.1 — колонки на всю высоту и правило обрезки сегмента. §6.2 — `fullHeight`, `split`, `rowState`, `openHint`, `Sort`, `SortChips`, `onResetWidth(s)`. §6.3 — клавиатура (↓/↑ по высоким ячейкам, Shift+Enter, Home/Shift+Home на ползунке), выделение без неактивных. §8.2 — `$sort` массивом, `$split`/`setSplit`, `resetWidths`/`resetWidth`, `GridPersisted.split`.
- [ ] **Step 2: спека 5a §4** — «Раскрытие — `expandColumns` после `visibleColumns`: части следуют за хостом и скрываются вместе с ним».
- [ ] **Step 3: CHANGELOG** — всё добавленное в Task 2–8 (Task 1 уже записан). **`docs/consuming.md`** — раздел «Сортировка — массив уровней»: было `Sort = { key, dir } | null`, стало `SortLevel[]`; `sort: null` → `[]`; бек `vtb-filters` получает `sort` массивом, как в контракте; плюс новые необязательные пропы грида.
- [ ] **Step 4: `registry-drift.md`** — R6, S1, S3, R5, W1, B1, B7: «**Исправлено** планом 5a (`<коммит>`)», сводка «План 5a закрыл …».
- [ ] **Step 5: STATE** — §3 (решения: сегменты не заходят на высокие колонки; раскрытие `split` после `visibleColumns`; состояния записи — данные с бека, без модели), §6 (план 5a, проверки: число тестов, e2e, геометрия), §7 (техдолг из ревью), §9 — дальше 5b «Реестр по эталону: вид» (спека-дельта), затем `apps/pi`.
- [ ] **Step 6: план `apps/pi`.** Task 0 Step 2 — «`Sort = SortLevel[]` — подтверждено планом 5a»; Task 8: `STATUS_LABEL.INVALID = 'INVALID'`, каталог `direction` — кодами (`inline({ IN: 'IN', OUT: 'OUT', TRANSIT: 'TRANSIT', OTHER: 'OTHER' })`); Task 1 Step 3 — убрать класс C «INVALID → Невалидный»; Task 10 `DocRegistry` — пропы `rowState`, `openHint`, `split`/`onSplit` идут из `useGrid`, `columns: gridColumns(layout.columns)` в `createRegistry` (Task 9).
- [ ] **Step 7: commit.**

```bash
git add docs CHANGELOG.md README.md
git commit -m "Документы: план 5a исполнен — спеки, CHANGELOG, consuming, сверка, состояние, план apps/pi"
```
