# План 3 (срез 1e): лейн статусов, панель фильтров simple, массовые действия, экран реестра

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Экран «Валютные документы» в демо: лейн статусов со счётчиками, сворачиваемая панель фильтров simple с чипами условий, полоса массовых действий над пагинацией — на одном сторе условий и двух расширенных моделях effector.

**Architecture:** Типы фильтра переезжают из `@katran/effector` в `@katran/ui` (`ui/filters/types.ts`), effector их реэкспортирует. `createFiltersModel` получает `laneField`, `setLane`, `$lane`, `revert`; `createGridModel` — `facets` (`attach`-копия эффекта, запрос по фильтру без условия поля лейна, отсечение устаревших ответов). Три чистых компонента `StatusLane`, `FilterPanel`, `BulkBar` получают всё пропами; `DataGrid` получает слот `toolbar` в футере. Демо: фейковый бэкенд отдаёт `searchFx`, `facetsFx`, `filterMeta`.

**Tech Stack:** React 19, effector 23 / effector-react 23, TypeScript strict (`exactOptionalPropertyTypes`), CSS Modules, vitest + jsdom + Testing Library + jest-axe, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-24-katran-slice1e-registry-design.md` (дельта среза 1e) и `docs/superpowers/specs/2026-09-23-katran-design.md` §3.2, 6.3, 6.4, 7.1, 8.2–8.4 (основная спека, контракты синхронизированы).

## Global Constraints

- `ui` не импортирует из `effector`/`packages/effector`; `effector` берёт из `@katran/ui` только `import type` и не трогает `document`/`window` (линт `eslint.config.js`, спека 3.2). Типы `Scalar`, `Condition`, `Filter`, `FilterFieldType`, `FilterField`, `FilterMeta` с этого плана объявлены в `packages/ui/src/filters/types.ts`, effector реэкспортирует их из `@katran/ui`.
- CSS только токенами `var(--k-…)`: голые `px` лишь в `border*`/`outline*`/`box-shadow`/`letter-spacing`; никаких hex/rgba; локальные имена классов camelCase (сборка даёт `k-Component__part`). Новые размеры — только через `tokens.src.ts` + `pnpm gen`, регенерация коммитится (план добавляет `filter-field: 220`).
- Никаких `eslint-disable`/`stylelint-disable`.
- Интерактив — настоящие `<button>`/`<input>`/`<select>` с доступным именем; `jsx-a11y` в линте, `axe` в тестах. Тесты через `renderK` ищут по ролям/атрибутам, не `container.firstElementChild`. Интерактив внутри ячеек грида — `tabIndex={-1}`.
- Опциональные пропы публичных типов — `?: T | undefined`.
- Публичные события моделей — `EventCallable<T>`; `.reset(ev)` откатывает к initial, для «пусто» — `.on(ev, () => [])`; редьюсеры `.on` объявлять раньше `sample`, читающего тот же стор; побочные эффекты в scope — только через эффекты как target; в тестах — `fork`/`allSettled`.
- Оператор панели simple фиксирован типом поля: STRING `CONTAINS`; NUMBER, DATE, ENUM, BOOLEAN `EQ`; DATETIME `BETWEEN` (начало и конец дня, ISO со смещением). Модификатора оператора, «Добавить фильтр», наборов фильтров — нет (спека 7.2).
- Лейн ставит условие `EQ` по `laneField` сразу в применённые и черновик; `$lane` — производный от `$conditions`; счётчики лейна — фасеты по фильтру без условий по полю лейна.
- Русский язык интерфейса, комментариев, JSDoc и коммитов. Коммиты без трейлеров `Co-Authored-By` и подписей «Generated with».
- Перед каждым коммитом `pnpm check` (gen:check + lint + test + build) зелёный. Playwright (`pnpm --filter demo e2e`) вне `pnpm check`; коридоры в `apps/demo/e2e/geometry.spec.ts` не трогать.

## Карта файлов

```
packages/tokens/src/tokens.src.ts               + 'filter-field': 220 (Task 1)
packages/ui/src/filters/types.ts                 типы фильтра (перенос из effector)           Task 1
packages/ui/src/filters/opLabels.ts              OP_LABEL, describeCondition                    Task 1
packages/ui/src/filters/opLabels.test.ts
packages/ui/src/filters/fieldOps.ts              fieldOp, draftOf, conditionFrom, isoDay*       Task 5
packages/ui/src/filters/fieldOps.test.ts
packages/ui/src/filters/StatusLane.tsx / .module.css / .test.tsx                                Task 4
packages/ui/src/filters/FilterField.tsx          контрол одного поля по типу                    Task 5
packages/ui/src/filters/FilterPanel.tsx / Filters.module.css / FilterPanel.test.tsx             Task 5
packages/ui/src/filters/BulkBar.tsx / BulkBar.module.css / BulkBar.test.tsx                     Task 6
packages/ui/src/filters/index.ts                 экспорт папки                                  Task 1, дополняется
packages/ui/src/index.ts                         + export * from './filters'                    Task 1
packages/ui/src/grid/DataGrid.tsx, Grid.module.css, DataGrid.test.tsx   слот toolbar            Task 6
packages/effector/src/types.ts                   реэкспорт типов фильтра + Facet, FacetsQuery   Task 1
packages/effector/src/createFiltersModel.ts / .test.ts   laneField, setLane, $lane, revert      Task 2
packages/effector/src/useFilters.ts, hooks.test.tsx                                             Task 2, 3
packages/effector/src/createGridModel.ts / .test.ts      facets                                 Task 3
packages/effector/src/useGrid.ts                 facets, onSelectAll, onClearSelection          Task 3
apps/demo/src/data/fakeBackend.ts                searchFx, facetsFx, filterMeta                 Task 7
apps/demo/src/pages/GridPage.tsx, Page.module.css        экран «Валютные документы»             Task 7
README.md, CHANGELOG.md, docs/STATE.md                                                          Task 8
```

---

### Task 1: Типы фильтра в `@katran/ui`, словарь операторов, токен

**Files:**
- Create: `packages/ui/src/filters/types.ts`, `packages/ui/src/filters/opLabels.ts`, `packages/ui/src/filters/opLabels.test.ts`, `packages/ui/src/filters/index.ts`
- Modify: `packages/ui/src/index.ts`, `packages/effector/src/types.ts`, `packages/tokens/src/tokens.src.ts` (+ регенерация `tokens.css`, `tokens.ts`)

**Interfaces:**
- Produces: `Scalar`, `Condition`, `Filter`, `FilterFieldType`, `FilterField`, `FilterMeta` из `@katran/ui`; `OP_LABEL: Record<Condition['op'], string>`; `describeCondition(c: Condition, meta?: FilterMeta | null): string`; из `@katran/effector` дополнительно `Facet = { value: Scalar; count: number }`, `FacetsQuery = { filter: Filter; field: string }`; токен `--k-filter-field`.

- [ ] **Step 1: Перенести типы.** Создать `packages/ui/src/filters/types.ts` — содержимое дословно из `packages/effector/src/types.ts` (блок от `export type Scalar` до `FilterMeta` включительно):

```ts
/** Модель фильтра — спека 7.1, контракт vtb-filters/docs/filter-contract.md. Живёт в ui: панели нужны эти типы, а ui не импортирует effector (спека 3.2). */
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
  /** Допустимые операторы; пустой список — все операторы типа. */
  ops: Condition['op'][]
  /** Встроенный справочник для ENUM. */
  values?: { value: Scalar; label: string }[] | undefined
  group?: string | undefined
}
/** Ответ GET /grids/{gridId}/filter-meta. */
export type FilterMeta = { fields: FilterField[] }
```

В `packages/effector/src/types.ts` удалить этот блок и в начало файла добавить:

```ts
export type { Scalar, Condition, Filter, FilterFieldType, FilterField, FilterMeta } from '@katran/ui'
import type { Filter, Scalar } from '@katran/ui'

/** Счётчик значений поля по фильтру — для лейна статусов (спека 1e, §4). */
export type Facet = { value: Scalar; count: number }
/** Тело POST /grids/{gridId}/facets: фильтр без условий по field. */
export type FacetsQuery = { filter: Filter; field: string }
```

(`import type { Sort } from '@katran/ui'` там уже есть — объединить в один `import type`.) Внутри effector все `import type { Condition, Filter, FilterMeta } from './types'` продолжают работать через реэкспорт.

- [ ] **Step 2: Токен.** В `packages/tokens/src/tokens.src.ts`, в `sizes`, после `'grid-lead': 84, 'grid-rz': 7, 'menu-max-h': 320,` добавить `'filter-field': 220,` с комментарием `// минимальная ширина поля панели фильтров`. Run: `pnpm gen && pnpm gen:check` — регенерированные `tokens.css`/`tokens.ts` в коммит.

- [ ] **Step 3: Тест словаря операторов.** `packages/ui/src/filters/opLabels.test.ts`:

```ts
import { OP_LABEL, describeCondition } from './opLabels'
import type { FilterMeta } from './types'

const meta: FilterMeta = { fields: [
  { id: 'status', label: 'Статус', type: 'ENUM', ops: [], values: [{ value: 'TO_EXPORT', label: 'К экспорту' }] },
  { id: 'amount', label: 'Сумма', type: 'NUMBER', ops: [] },
  { id: 'created', label: 'Дата', type: 'DATE', ops: [] },
  { id: 'f50name', label: 'Приказодатель', type: 'STRING', ops: [] },
  { id: 'urgent', label: 'Срочный', type: 'BOOLEAN', ops: [] },
  { id: 'ts', label: 'Время', type: 'DATETIME', ops: [] },
] }

describe('describeCondition', () => {
  it('словарь покрывает все 14 операторов', () => {
    expect(Object.keys(OP_LABEL)).toHaveLength(14)
  })
  it('ENUM — подпись из справочника, число как есть, дата дд.мм.гггг, строка в кавычках', () => {
    expect(describeCondition({ field: 'status', op: 'EQ', value: 'TO_EXPORT' }, meta)).toBe('Статус = К экспорту')
    expect(describeCondition({ field: 'amount', op: 'GT', value: 100000 }, meta)).toBe('Сумма > 100000')
    expect(describeCondition({ field: 'created', op: 'EQ', value: '2026-09-01' }, meta)).toBe('Дата = 01.09.2026')
    expect(describeCondition({ field: 'f50name', op: 'CONTAINS', value: 'Василёк' }, meta)).toBe('Приказодатель содержит „Василёк“')
    expect(describeCondition({ field: 'urgent', op: 'EQ', value: true }, meta)).toBe('Срочный = да')
  })
  it('списки, диапазон, пустота; DATETIME — дд.мм.гггг чч:мм', () => {
    expect(describeCondition({ field: 'status', op: 'IN', values: ['TO_EXPORT', 'X'] }, meta)).toBe('Статус в списке К экспорту, X')
    expect(describeCondition({ field: 'created', op: 'BETWEEN', from: '2026-09-01', to: '2026-09-13' }, meta)).toBe('Дата от 01.09.2026 до 13.09.2026')
    expect(describeCondition({ field: 'ts', op: 'BETWEEN', from: '2026-09-01T00:00:00+03:00', to: '2026-09-01T23:59:59+03:00' }, meta)).toBe('Время от 01.09.2026 00:00 до 01.09.2026 23:59')
    expect(describeCondition({ field: 'amount', op: 'IS_EMPTY' }, meta)).toBe('Сумма пусто')
  })
  it('без меты — id поля и значение как есть', () => {
    expect(describeCondition({ field: 'x', op: 'NE', value: 5 })).toBe('x ≠ 5')
  })
})
```

Run: `pnpm --filter @katran/ui exec vitest run src/filters/opLabels.test.ts` → FAIL (модуль не найден).

- [ ] **Step 4: Реализация.** `packages/ui/src/filters/opLabels.ts`:

```ts
import { formatDate } from '../format'
import type { Condition, FilterField, FilterMeta, Scalar } from './types'

/** Подписи операторов для чипов панели (спека 1e, 6.2). */
export const OP_LABEL: Record<Condition['op'], string> = {
  EQ: '=', NE: '≠', CONTAINS: 'содержит', STARTS_WITH: 'начинается с', ENDS_WITH: 'заканчивается на',
  GT: '>', GTE: '≥', LT: '<', LTE: '≤', BETWEEN: 'от … до', IN: 'в списке', NOT_IN: 'не в списке',
  IS_EMPTY: 'пусто', IS_NOT_EMPTY: 'не пусто',
}

const p2 = (n: number) => String(n).padStart(2, '0')
const dateTime = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? iso : `${formatDate(iso)} ${p2(d.getHours())}:${p2(d.getMinutes())}` }

/** Значение для чипа: ENUM — подпись справочника, DATE/DATETIME — по-русски, BOOLEAN — да/нет, STRING — в кавычках. */
function showValue(v: Scalar, field: FilterField | undefined): string {
  switch (field?.type) {
    case 'ENUM': return field.values?.find((x) => String(x.value) === String(v))?.label ?? String(v)
    case 'DATE': return formatDate(String(v)) || String(v)
    case 'DATETIME': return dateTime(String(v))
    case 'BOOLEAN': return v === true || v === 'true' ? 'да' : 'нет'
    case 'STRING': return `„${String(v)}“`
    default: return String(v)
  }
}

/** Текст чипа: «Статус = К экспорту», «Сумма > 100000», «Дата от 01.09.2026 до 13.09.2026». */
export function describeCondition(c: Condition, meta?: FilterMeta | null): string {
  const field = meta?.fields.find((f) => f.id === c.field)
  const name = field?.label ?? c.field
  switch (c.op) {
    case 'IN': case 'NOT_IN': return `${name} ${OP_LABEL[c.op]} ${c.values.map((v) => showValue(v, field)).join(', ')}`
    case 'BETWEEN': return `${name} от ${showValue(c.from, field)} до ${showValue(c.to, field)}`
    case 'IS_EMPTY': case 'IS_NOT_EMPTY': return `${name} ${OP_LABEL[c.op]}`
    default: return `${name} ${OP_LABEL[c.op]} ${showValue(c.value, field)}`
  }
}
```

`packages/ui/src/filters/index.ts`:

```ts
export * from './types'
export { OP_LABEL, describeCondition } from './opLabels'
```

В `packages/ui/src/index.ts` после `export * from './grid'` добавить `export * from './filters'`.

Run: тест из шага 3 → PASS. `pnpm check` → зелёный (effector и demo собираются через реэкспорт).

- [ ] **Step 5: Commit** — `Фильтры: типы контракта в @katran/ui, словарь операторов и текст условия для чипов, токен ширины поля`.

---

### Task 2: Модель фильтров — лейн, `$lane`, `revert`

**Files:**
- Modify: `packages/effector/src/createFiltersModel.ts`, `packages/effector/src/createFiltersModel.test.ts`, `packages/effector/src/useFilters.ts`, `packages/effector/src/hooks.test.tsx`

**Interfaces:**
- Consumes: типы из Task 1.
- Produces: `FiltersModelConfig.laneField?: string | undefined`; `FiltersModel.$lane: Store<Scalar | null>`, `setLane: EventCallable<Scalar | null>`, `revert: EventCallable<void>`, `laneField: string | null`; `FiltersBinding` += `lane: Scalar | null`, `setLane`, `revert`, `meta: FilterMeta | null`.

- [ ] **Step 1: Тесты.** Добавить в `createFiltersModel.test.ts`:

```ts
describe('лейн и revert', () => {
  it('setLane ставит EQ по laneField сразу в применённые и черновик; null снимает; $lane следует', async () => {
    const m = createFiltersModel({ laneField: 'status' })
    const scope = fork()
    await allSettled(m.setLane, { scope, params: 'ERROR' })
    expect(scope.getState(m.$conditions)).toEqual([{ field: 'status', op: 'EQ', value: 'ERROR' }])
    expect(scope.getState(m.$draft)).toEqual([{ field: 'status', op: 'EQ', value: 'ERROR' }])
    expect(scope.getState(m.$lane)).toBe('ERROR')
    expect(scope.getState(m.$dirty)).toBe(false)
    await allSettled(m.setLane, { scope, params: null })
    expect(scope.getState(m.$conditions)).toEqual([])
    expect(scope.getState(m.$lane)).toBeNull()
  })
  it('setLane не трогает неприменённую правку другого поля', async () => {
    const m = createFiltersModel({ laneField: 'status' })
    const scope = fork()
    await allSettled(m.edit, { scope, params: { field: 'amount', op: 'GT', value: 1 } })
    await allSettled(m.setLane, { scope, params: 'DONE' })
    expect(scope.getState(m.$draft)).toEqual([{ field: 'amount', op: 'GT', value: 1 }, { field: 'status', op: 'EQ', value: 'DONE' }])
    expect(scope.getState(m.$conditions)).toEqual([{ field: 'status', op: 'EQ', value: 'DONE' }])
    expect(scope.getState(m.$dirty)).toBe(true)
  })
  it('$lane: снятие чипа и reset дают null; IN по полю лейна — тоже null', async () => {
    const m = createFiltersModel({ laneField: 'status', initial: [{ field: 'status', op: 'EQ', value: 'DONE' }] })
    const scope = fork()
    expect(scope.getState(m.$lane)).toBe('DONE')
    await allSettled(m.remove, { scope, params: 'status' })
    expect(scope.getState(m.$lane)).toBeNull()
    await allSettled(m.edit, { scope, params: { field: 'status', op: 'IN', values: ['A', 'B'] } })
    await allSettled(m.apply, { scope })
    expect(scope.getState(m.$lane)).toBeNull()
    await allSettled(m.reset, { scope })
    expect(scope.getState(m.$conditions)).toEqual([])
  })
  it('без laneField setLane — no-op, $lane всегда null', async () => {
    const m = createFiltersModel()
    const scope = fork()
    await allSettled(m.setLane, { scope, params: 'X' })
    expect(scope.getState(m.$conditions)).toEqual([])
    expect(scope.getState(m.$lane)).toBeNull()
    expect(m.laneField).toBeNull()
  })
  it('revert: черновик ← применённые', async () => {
    const m = createFiltersModel({ initial: [{ field: 'a', op: 'EQ', value: 1 }] })
    const scope = fork()
    await allSettled(m.edit, { scope, params: { field: 'b', op: 'EQ', value: 2 } })
    await allSettled(m.edit, { scope, params: { field: 'a', op: 'EQ', value: 9 } })
    expect(scope.getState(m.$dirty)).toBe(true)
    await allSettled(m.revert, { scope })
    expect(scope.getState(m.$draft)).toEqual([{ field: 'a', op: 'EQ', value: 1 }])
    expect(scope.getState(m.$dirty)).toBe(false)
  })
})
```

В `hooks.test.tsx`, в `describe('useFilters')`, добавить:

```ts
  it('lane/setLane/revert/meta через хук', () => {
    const meta = { fields: [{ id: 'status', label: 'Статус', type: 'ENUM' as const, ops: [] }] }
    const model = createFiltersModel({ meta, laneField: 'status' })
    const { result } = renderHook(() => useFilters(model))
    expect(result.current.meta).toBe(meta)
    act(() => { result.current.setLane('DONE') })
    expect(result.current.lane).toBe('DONE')
    expect(result.current.conditions).toEqual([{ field: 'status', op: 'EQ', value: 'DONE' }])
    act(() => { result.current.edit({ field: 'amount', op: 'GT', value: 1 }) })
    act(() => { result.current.revert() })
    expect(result.current.dirty).toBe(false)
  })
```

Run: `pnpm --filter @katran/effector exec vitest run` → FAIL (нет `setLane`).

- [ ] **Step 2: Реализация.** `createFiltersModel.ts` — конфиг, тип модели и тело:

```ts
import { combine, createEvent, createStore, sample, type EventCallable, type Store } from 'effector'
import type { Condition, Filter, FilterMeta, Scalar } from './types'

export type FiltersModelConfig = {
  meta?: FilterMeta | undefined
  initial?: Filter | undefined
  /** Поле, которым управляет лейн статусов (спека 1e, §3). Без него setLane — no-op. */
  laneField?: string | undefined
}

export type FiltersModel = {
  $conditions: Store<Filter>
  $draft: Store<Filter>
  $dirty: Store<boolean>
  /** Значение условия EQ по laneField в применённых, иначе null (условие IN по тому же полю — тоже null). */
  $lane: Store<Scalar | null>
  edit: EventCallable<Condition>
  discard: EventCallable<string>
  apply: EventCallable<void>
  /** Черновик ← применённые: «Отменить» панели. */
  revert: EventCallable<void>
  reset: EventCallable<void>
  remove: EventCallable<string>
  /** Лейн: EQ по laneField сразу в применённые и черновик (без «Применить»); null — снять. */
  setLane: EventCallable<Scalar | null>
  meta: FilterMeta | null
  laneField: string | null
}
```

В теле фабрики (после существующих событий и сторов, до `sample({ clock: apply … })`):

```ts
  const revert = createEvent<void>()
  const setLane = createEvent<Scalar | null>()
  const lane = laneField ?? null
  // лейн пишет в оба стора одинаково: условие EQ по полю лейна ставится или снимается, остальное не трогается
  const applyLane = (list: Filter, v: Scalar | null): Filter =>
    lane === null ? list : v === null ? without(list, lane) : upsert(list, { field: lane, op: 'EQ', value: v })
  $draft.on(setLane, applyLane)
  $conditions.on(setLane, applyLane)
  sample({ clock: revert, source: $conditions, target: $draft })
  const $lane = $conditions.map((list): Scalar | null => {
    if (lane === null) return null
    const c = list.find((x) => x.field === lane)
    return c && c.op === 'EQ' ? c.value : null
  })
```

Сигнатура: `createFiltersModel({ meta, initial = [], laneField }: FiltersModelConfig = {})`; `return { …, $lane, revert, setLane, meta: meta ?? null, laneField: lane }`. Порядок: `.on(setLane …)` объявлены до `sample({ clock: apply })` и до `combine` для `$dirty`.

`useFilters.ts`:

```ts
export type FiltersBinding = {
  conditions: Filter
  draft: Filter
  dirty: boolean
  lane: Scalar | null
  meta: FilterMeta | null
  edit: (c: Condition) => void
  discard: (field: string) => void
  apply: () => void
  revert: () => void
  reset: () => void
  remove: (field: string) => void
  setLane: (v: Scalar | null) => void
}
export function useFilters(m: FiltersModel): FiltersBinding {
  const [conditions, draft, dirty, lane] = useUnit([m.$conditions, m.$draft, m.$dirty, m.$lane])
  const [edit, discard, apply, revert, reset, remove, setLane] = useUnit([m.edit, m.discard, m.apply, m.revert, m.reset, m.remove, m.setLane])
  return { conditions, draft, dirty, lane, meta: m.meta, edit, discard, apply, revert, reset, remove, setLane }
}
```

Run: `pnpm --filter @katran/effector exec vitest run` → PASS. `pnpm check` зелёный.

- [ ] **Step 3: Commit** — `Модель фильтров: лейн статусов через setLane и $lane, revert черновика`.

---

### Task 3: Модель грида — фасеты; `useGrid`

**Files:**
- Modify: `packages/effector/src/createGridModel.ts`, `packages/effector/src/createGridModel.test.ts`, `packages/effector/src/useGrid.ts`, `packages/effector/src/hooks.test.tsx`

**Interfaces:**
- Consumes: `Facet`, `FacetsQuery` (Task 1).
- Produces: `GridModelConfig.facets?: { field: string; fetchFx: Effect<FacetsQuery, Facet[]> } | undefined`; `GridModel.$facets: Store<Facet[]>`; `GridBinding` += `facets: Facet[]`, `onSelectAll: () => void`, `onClearSelection: () => void`.

- [ ] **Step 1: Тесты.** В `createGridModel.test.ts` расширить `mk`: параметр `over` уже позволяет передать `facets`. Добавить:

```ts
describe('фасеты', () => {
  const mkFacets = (results: Array<{ value: string; count: number }[]> = [[{ value: 'A', count: 2 }]]) => {
    const calls: FacetsQuery[] = []
    let release: Array<() => void> = []
    const facetsFetchFx = createEffect<FacetsQuery, Facet[]>((q) => {
      calls.push(q)
      const r = results[Math.min(calls.length - 1, results.length - 1)]!
      return new Promise<Facet[]>((res) => { release.push(() => res(r)) })
    })
    const releaseAll = async () => { const r = release; release = []; r.forEach((f) => f()); await flush() }
    return { facetsFetchFx, calls, releaseAll }
  }

  it('без конфигурации фасетов: $facets пуст, запросов нет', async () => {
    const { model } = mk()
    const scope = fork()
    await allSettled(model.refresh, { scope })
    expect(scope.getState(model.$facets)).toEqual([])
  })
  it('смена фильтра и refresh → запрос фасетов по фильтру без условия поля лейна; страница — нет', async () => {
    const f = mkFacets()
    const { model, $filter } = mk({ facets: { field: 'status', fetchFx: f.facetsFetchFx } })
    const scope = fork()
    const p = allSettled($filter, { scope, params: [{ field: 'status', op: 'EQ', value: 'A' }, { field: 'amount', op: 'GT', value: 1 }] })
    await f.releaseAll(); await p
    expect(f.calls).toEqual([{ filter: [{ field: 'amount', op: 'GT', value: 1 }], field: 'status' }])
    expect(scope.getState(model.$facets)).toEqual([{ value: 'A', count: 2 }])
    const p2 = allSettled(model.setPage, { scope, params: 2 })
    await f.releaseAll(); await p2
    expect(f.calls).toHaveLength(1)
    const p3 = allSettled(model.refresh, { scope })
    await f.releaseAll(); await p3
    expect(f.calls).toHaveLength(2)
  })
  it('устаревший ответ фасетов отбрасывается; отказ не трогает $facets и $state', async () => {
    const f = mkFacets([[{ value: 'A', count: 1 }], [{ value: 'A', count: 5 }]])
    const { model, $filter } = mk({ facets: { field: 'status', fetchFx: f.facetsFetchFx } })
    const scope = fork()
    const p1 = allSettled($filter, { scope, params: [{ field: 'amount', op: 'GT', value: 1 }] })
    const p2 = allSettled($filter, { scope, params: [{ field: 'amount', op: 'GT', value: 2 }] })
    // второй запрос отпускаем первым, потом первый (устаревший)
    await f.releaseAll(); await Promise.all([p1, p2])
    expect(scope.getState(model.$facets)).toEqual([{ value: 'A', count: 5 }])
    const failing = createEffect<FacetsQuery, Facet[]>(async () => { throw new Error('нет') })
    const { model: m2, $filter: $f2 } = mk({ facets: { field: 'status', fetchFx: failing } })
    const scope2 = fork()
    await allSettled($f2, { scope: scope2, params: [{ field: 'amount', op: 'GT', value: 1 }] })
    expect(scope2.getState(m2.$facets)).toEqual([])
    expect(scope2.getState(m2.$state)).toBe('ready')
  })
})
```

(В шапке теста дополнить импорт типов: `import type { Facet, FacetsQuery, Filter, GridPage, GridQuery } from './types'`.) В `hooks.test.tsx` в тест `useGrid` добавить в конец: `expect(result.current.facets).toEqual([]); act(() => { result.current.onSelectAll() }); expect(result.current.selection).toEqual({ mode: 'all', except: [] }); act(() => { result.current.onClearSelection() }); expect(result.current.selection).toEqual({ mode: 'ids', ids: [] })`.

Run: `pnpm --filter @katran/effector exec vitest run` → FAIL.

- [ ] **Step 2: Реализация.** В `createGridModel.ts`: импорт `type Facet, type FacetsQuery` из `./types`; в `GridModelConfig<Row>` — `facets?: { field: string; fetchFx: Effect<FacetsQuery, Facet[]> } | undefined`; в `GridModel<Row>` — `$facets: Store<Facet[]>`. В теле, после блока приёма ответа (`$state`) и до persist:

```ts
  // --- фасеты лейна (спека 1e, §4): по фильтру без условий по полю лейна, своя attach-копия, устаревшие ответы отбрасываются ---
  const $facets = createStore<Facet[]>([])
  if (cfg.facets) {
    const { field } = cfg.facets
    const facetsFx = attach({ effect: cfg.facets.fetchFx })
    const toQuery = (filter: Filter): FacetsQuery => ({ filter: filter.filter((c) => c.field !== field), field })
    const $facetsQuery = cfg.$filter.map(toQuery)
    // смена фильтра — запрос из значения clock, не из производного стора (тот же нюанс, что у $query выше)
    sample({ clock: cfg.$filter, fn: toQuery, target: facetsFx })
    sample({ clock: [refresh, retry], source: $facetsQuery, target: facetsFx })
    const facetsDone = sample({
      clock: facetsFx.done,
      source: $facetsQuery,
      filter: (q, { params }) => JSON.stringify(q) === JSON.stringify(params),
      fn: (_, { result }) => result,
    })
    $facets.on(facetsDone, (_, r) => r)
  }
```

В `return` добавить `$facets`. `useGrid.ts`: `GridBinding` += `facets: Facet[]`, `onSelectAll: () => void`, `onClearSelection: () => void`; в `useUnit` — `m.$facets`, `m.selectAll`, `m.clearSelection`; импорт `type Facet` из `./types`. Проверка типов `_Check` остаётся (новые поля не конфликтуют с `DataGridProps`).

Run: тесты → PASS; `pnpm check` зелёный.

- [ ] **Step 3: Commit** — `Модель грида: фасеты для лейна — запрос без условия поля лейна, отсечение устаревших ответов; useGrid отдаёт facets и выделение всего`.

---

### Task 4: `StatusLane`

**Files:**
- Create: `packages/ui/src/filters/StatusLane.tsx`, `packages/ui/src/filters/StatusLane.module.css`, `packages/ui/src/filters/StatusLane.test.tsx`
- Modify: `packages/ui/src/filters/index.ts`

**Interfaces:**
- Consumes: `Button` (`pressed`), `StatusDot`, `Counter`, `Scalar`, `StatusTone`.
- Produces: `LaneItem`, `StatusLaneProps`, `StatusLane`.

- [ ] **Step 1: Тест.** `StatusLane.test.tsx`:

```tsx
import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { StatusLane, type LaneItem } from './StatusLane'
import type { Scalar } from './types'

const items: LaneItem[] = [
  { value: 'IN_PROGRESS', label: 'В работе', tone: 'flow', count: 15 },
  { value: 'ERROR', label: 'Ошибка', tone: 'bad', count: 6 },
  { value: 'REJECTED', label: 'Отказ', tone: 'grey', count: 0 },
]
function Host({ initial = null }: { initial?: Scalar | null }) {
  const [v, setV] = useState<Scalar | null>(initial)
  return <StatusLane label="Статусы" items={items} value={v} onChange={setV} />
}

describe('StatusLane', () => {
  it('группа с именем, «Все» с суммой, aria-pressed у активной кнопки', async () => {
    const { container } = renderK(<Host />)
    const group = screen.getByRole('group', { name: 'Статусы' })
    const all = screen.getByRole('button', { name: /Все/ })
    expect(all).toHaveAttribute('aria-pressed', 'true')
    expect(all).toHaveTextContent('21')
    expect(screen.getByRole('button', { name: /Ошибка/ })).toHaveAttribute('aria-pressed', 'false')
    expect(group.querySelectorAll('button')).toHaveLength(4)
    expect(await axe(container)).toHaveNoViolations()
  })
  it('клик выбирает статус, повторный клик и «Все» снимают', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    await u.click(screen.getByRole('button', { name: /Ошибка/ }))
    expect(screen.getByRole('button', { name: /Ошибка/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Все/ })).toHaveAttribute('aria-pressed', 'false')
    await u.click(screen.getByRole('button', { name: /Ошибка/ }))
    expect(screen.getByRole('button', { name: /Все/ })).toHaveAttribute('aria-pressed', 'true')
    await u.click(screen.getByRole('button', { name: /В работе/ }))
    await u.click(screen.getByRole('button', { name: /Все/ }))
    expect(screen.getByRole('button', { name: /В работе/ })).toHaveAttribute('aria-pressed', 'false')
  })
  it('без счётчиков — без чисел', () => {
    renderK(<StatusLane label="Статусы" items={items.map(({ count: _c, ...it }) => it)} value={null} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /Все/ })).toHaveTextContent(/^Все$/)
  })
})
```

Run: `pnpm --filter @katran/ui exec vitest run src/filters/StatusLane.test.tsx` → FAIL.

- [ ] **Step 2: Реализация.** `StatusLane.tsx`:

```tsx
import { Button } from '../button'
import { Counter, StatusDot, type StatusTone } from '../value'
import type { Scalar } from './types'
import s from './StatusLane.module.css'

export type LaneItem = { value: Scalar; label: string; tone: StatusTone; count?: number | undefined }
export type StatusLaneProps = {
  /** Доступное имя группы: «Статусы». */
  label: string
  items: LaneItem[]
  /** Активный статус; null — «Все». */
  value: Scalar | null
  onChange: (value: Scalar | null) => void
  allLabel?: string | undefined
}

/** Лейн статусов: кнопки-переключатели, первая — «Все» с суммой счётчиков; клик по активной снимает (спека 1e, 6.1). */
export function StatusLane({ label, items, value, onChange, allLabel = 'Все' }: StatusLaneProps) {
  const hasCounts = items.some((it) => it.count !== undefined)
  const total = items.reduce((n, it) => n + (it.count ?? 0), 0)
  const isOn = (it: LaneItem) => value !== null && String(it.value) === String(value)
  return (
    <div role="group" aria-label={label} className={s.lane}>
      <Button size="s" pressed={value === null} className={s.item} onClick={() => onChange(null)}>
        <span>{allLabel}</span>
        {hasCounts && <Counter value={total} active={value === null} />}
      </Button>
      {items.map((it) => (
        <Button key={String(it.value)} size="s" pressed={isOn(it)} className={s.item} onClick={() => onChange(isOn(it) ? null : it.value)}>
          <StatusDot tone={it.tone} size="s" />
          <span>{it.label}</span>
          {it.count !== undefined && <Counter value={it.count} active={isOn(it)} />}
        </Button>
      ))}
    </div>
  )
}
```

`StatusLane.module.css`:

```css
.lane {
  display: flex;
  gap: var(--k-sp-1);
  overflow-x: auto;
  white-space: nowrap;
  padding-bottom: var(--k-sp-1);
}

.item {
  display: inline-flex;
  align-items: center;
  gap: var(--k-sp-2);
  flex: none;
}

.item[aria-pressed="true"] {
  background: var(--k-val-soft);
  color: var(--k-val);
}
```

Перед добавлением последнего правила проверить `packages/ui/src/button/Button.module.css`: если стиль `[aria-pressed="true"]` там уже есть (его используют кнопки темы в демо), правило в `StatusLane.module.css` не дублировать. `index.ts`: `export { StatusLane, type StatusLaneProps, type LaneItem } from './StatusLane'`.

Run: тест → PASS; `pnpm check` зелёный.

- [ ] **Step 3: Commit** — `StatusLane: лейн статусов — переключатели с точкой, подписью и счётчиком, «Все» с суммой`.

---

### Task 5: `FilterPanel` (simple) с чипами и полями по типам

**Files:**
- Create: `packages/ui/src/filters/fieldOps.ts`, `packages/ui/src/filters/fieldOps.test.ts`, `packages/ui/src/filters/FilterField.tsx`, `packages/ui/src/filters/FilterPanel.tsx`, `packages/ui/src/filters/Filters.module.css`, `packages/ui/src/filters/FilterPanel.test.tsx`
- Modify: `packages/ui/src/filters/index.ts`

**Interfaces:**
- Consumes: `Input`, `Select`, `Button`, `IconButton`, `Counter`, `describeCondition`, типы Task 1, токен `--k-filter-field`.
- Produces: `FilterPanelProps`, `FilterPanel`; помощники `fieldOp(f)`, `draftOf(draft, f)`, `conditionFrom(f, raw)`, `isoDayStart(d)`, `isoDayEnd(d)`.

- [ ] **Step 1: Тесты помощников.** `fieldOps.test.ts`:

```ts
import { conditionFrom, draftOf, fieldOp, isoDayEnd, isoDayStart } from './fieldOps'
import type { FilterField } from './types'

const f = (type: FilterField['type'], ops: FilterField['ops'] = []): FilterField => ({ id: 'x', label: 'X', type, ops, values: [{ value: 5, label: 'пять' }] })

describe('fieldOp', () => {
  it('оператор по типу; ops сужают; поле без скалярного оператора не показывается', () => {
    expect(fieldOp(f('STRING'))).toBe('CONTAINS')
    expect(fieldOp(f('NUMBER'))).toBe('EQ')
    expect(fieldOp(f('DATETIME'))).toBe('BETWEEN')
    expect(fieldOp(f('STRING', ['EQ', 'NE']))).toBe('EQ')
    expect(fieldOp(f('STRING', ['IN', 'IS_EMPTY']))).toBeNull()
    expect(fieldOp(f('DATETIME', ['GT']))).toBeNull()
  })
})
describe('conditionFrom / draftOf', () => {
  it('STRING обрезает пробелы; пусто — null', () => {
    expect(conditionFrom(f('STRING'), '  Вас ')).toEqual({ field: 'x', op: 'CONTAINS', value: 'Вас' })
    expect(conditionFrom(f('STRING'), '   ')).toBeNull()
  })
  it('NUMBER: запятая как точка, не число — null', () => {
    expect(conditionFrom(f('NUMBER'), '1,5')).toEqual({ field: 'x', op: 'EQ', value: 1.5 })
    expect(conditionFrom(f('NUMBER'), 'abc')).toBeNull()
  })
  it('ENUM возвращает исходный скаляр справочника, BOOLEAN — boolean, DATE — строку', () => {
    expect(conditionFrom(f('ENUM'), '5')).toEqual({ field: 'x', op: 'EQ', value: 5 })
    expect(conditionFrom(f('BOOLEAN'), 'true')).toEqual({ field: 'x', op: 'EQ', value: true })
    expect(conditionFrom(f('DATE'), '2026-09-01')).toEqual({ field: 'x', op: 'EQ', value: '2026-09-01' })
  })
  it('DATETIME: два дня → BETWEEN за сутки; одна граница пустая — берётся другая; обе пустые — null', () => {
    const c = conditionFrom(f('DATETIME'), { from: '2026-09-01', to: '2026-09-02' })
    expect(c).toEqual({ field: 'x', op: 'BETWEEN', from: isoDayStart('2026-09-01'), to: isoDayEnd('2026-09-02') })
    expect(isoDayStart('2026-09-01')).toMatch(/^2026-09-01T00:00:00[+-]\d\d:\d\d$/)
    expect(isoDayEnd('2026-09-01')).toMatch(/^2026-09-01T23:59:59[+-]\d\d:\d\d$/)
    expect(conditionFrom(f('DATETIME'), { from: '2026-09-01', to: '' })).toEqual({ field: 'x', op: 'BETWEEN', from: isoDayStart('2026-09-01'), to: isoDayEnd('2026-09-01') })
    expect(conditionFrom(f('DATETIME'), { from: '', to: '' })).toBeNull()
  })
  it('draftOf читает значение поля из черновика в форму контрола', () => {
    expect(draftOf([{ field: 'x', op: 'EQ', value: 5 }], f('ENUM'))).toBe('5')
    expect(draftOf([], f('STRING'))).toBe('')
    expect(draftOf([{ field: 'x', op: 'BETWEEN', from: '2026-09-01T00:00:00+03:00', to: '2026-09-02T23:59:59+03:00' }], f('DATETIME'))).toEqual({ from: '2026-09-01', to: '2026-09-02' })
  })
})
```

Run → FAIL.

- [ ] **Step 2: Помощники.** `fieldOps.ts`:

```ts
import type { Condition, Filter, FilterField, FilterFieldType } from './types'

type ScalarOp = Extract<Condition, { value: unknown }>['op']
const SCALAR_OPS: ReadonlySet<Condition['op']> = new Set<Condition['op']>(['EQ', 'NE', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'GT', 'GTE', 'LT', 'LTE'])
const BY_TYPE: Record<FilterFieldType, Condition['op']> = { STRING: 'CONTAINS', NUMBER: 'EQ', DATE: 'EQ', DATETIME: 'BETWEEN', ENUM: 'EQ', BOOLEAN: 'EQ' }

/** Оператор поля в simple-режиме: по типу; если ops сужают — первый допустимый той же формы; null — поле в simple не показывается. */
export function fieldOp(f: FilterField): Condition['op'] | null {
  const want = BY_TYPE[f.type]
  if (f.ops.length === 0 || f.ops.includes(want)) return want
  if (f.type === 'DATETIME') return null
  return f.ops.find((op) => SCALAR_OPS.has(op)) ?? null
}

const p2 = (n: number) => String(n).padStart(2, '0')
/** Смещение локальной зоны для даты YYYY-MM-DD в виде ±hh:mm. */
function offsetOf(day: string): string {
  const m = -new Date(`${day}T00:00:00`).getTimezoneOffset()
  const sign = m < 0 ? '-' : '+'
  const a = Math.abs(m)
  return `${sign}${p2(Math.floor(a / 60))}:${p2(a % 60)}`
}
export const isoDayStart = (day: string) => `${day}T00:00:00${offsetOf(day)}`
export const isoDayEnd = (day: string) => `${day}T23:59:59${offsetOf(day)}`

export type RawValue = string | { from: string; to: string }

/** Значение контрола из черновика: строка, для DATETIME — пара дней. */
export function draftOf(draft: Filter, f: FilterField): RawValue {
  const c = draft.find((x) => x.field === f.id)
  if (f.type === 'DATETIME') return c && c.op === 'BETWEEN' ? { from: String(c.from).slice(0, 10), to: String(c.to).slice(0, 10) } : { from: '', to: '' }
  if (!c || !('value' in c)) return ''
  return String(c.value)
}

/** Условие из сырого значения контрола; null — поле пусто, условие снимается. */
export function conditionFrom(f: FilterField, raw: RawValue): Condition | null {
  const op = fieldOp(f)
  if (op === null) return null
  if (typeof raw !== 'string') {
    const from = raw.from || raw.to
    const to = raw.to || raw.from
    return from ? { field: f.id, op: 'BETWEEN', from: isoDayStart(from), to: isoDayEnd(to) } : null
  }
  const text = raw.trim()
  if (text === '') return null
  const scalarOp = op as ScalarOp
  switch (f.type) {
    case 'NUMBER': { const n = Number(text.replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? null : { field: f.id, op: scalarOp, value: n } }
    case 'ENUM': { const v = f.values?.find((x) => String(x.value) === text); return { field: f.id, op: scalarOp, value: v ? v.value : text } }
    case 'BOOLEAN': return { field: f.id, op: scalarOp, value: text === 'true' }
    default: return { field: f.id, op: scalarOp, value: text }
  }
}
```

Run: `fieldOps.test.ts` → PASS.

- [ ] **Step 3: Тесты панели.** `FilterPanel.test.tsx`:

```tsx
import { useState } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { FilterPanel, type FilterPanelProps } from './FilterPanel'
import type { Filter, FilterMeta } from './types'

const meta: FilterMeta = { fields: [
  { id: 'status', label: 'Статус', type: 'ENUM', ops: [], values: [{ value: 'DONE', label: 'Обработан' }, { value: 'ERROR', label: 'Ошибка' }] },
  { id: 'amount', label: 'Сумма', type: 'NUMBER', ops: [] },
  { id: 'f50name', label: 'Приказодатель', type: 'STRING', ops: [] },
  { id: 'created', label: 'Дата', type: 'DATE', ops: [] },
] }

type Over = Partial<FilterPanelProps>
function Host({ initial = [], ...over }: { initial?: Filter } & Over) {
  const [conditions, setConditions] = useState<Filter>(initial)
  const [draft, setDraft] = useState<Filter>(initial)
  const [open, setOpen] = useState(true)
  const same = JSON.stringify(conditions) === JSON.stringify(draft)
  return (
    <FilterPanel
      meta={meta} conditions={conditions} draft={draft} dirty={!same} open={open} onOpenChange={setOpen}
      onEdit={(c) => setDraft((d) => [...d.filter((x) => x.field !== c.field), c])}
      onDiscard={(f) => setDraft((d) => d.filter((x) => x.field !== f))}
      onApply={() => setConditions(draft)}
      onRevert={() => setDraft(conditions)}
      onReset={() => { setConditions([]); setDraft([]) }}
      onRemove={(f) => { setConditions((c) => c.filter((x) => x.field !== f)); setDraft((d) => d.filter((x) => x.field !== f)) }}
      {...over}
    />
  )
}

describe('FilterPanel', () => {
  it('строка состояния: кнопка с aria-expanded и счётчиком, чипы, «Сбросить»; без условий — «условия не заданы»', async () => {
    const u = userEvent.setup()
    const { container } = renderK(<Host initial={[{ field: 'status', op: 'EQ', value: 'DONE' }, { field: 'amount', op: 'GT', value: 10 }]} />)
    const toggle = screen.getByRole('button', { name: /Фильтры/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveTextContent('2')
    const list = screen.getByRole('list', { name: 'Применённые условия' })
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Статус = Обработан', 'Сумма > 10'])
    expect(await axe(container)).toHaveNoViolations()
    await u.click(within(list).getByRole('button', { name: 'Убрать условие: Статус = Обработан' }))
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
    await u.click(screen.getByRole('button', { name: 'Сбросить' }))
    expect(screen.queryByRole('list', { name: 'Применённые условия' })).toBeNull()
    expect(screen.getByText('условия не заданы')).toBeInTheDocument()
    await u.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('textbox', { name: 'Приказодатель' })).toBeNull()
  })
  it('поля по типам: строка → CONTAINS, число → EQ, ENUM → исходный скаляр; пустое поле снимает условие; Enter применяет; Отменить откатывает', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    const apply = screen.getByRole('button', { name: 'Применить' })
    const revert = screen.getByRole('button', { name: 'Отменить' })
    expect(apply).toBeDisabled(); expect(revert).toBeDisabled()
    await u.type(screen.getByRole('textbox', { name: 'Приказодатель' }), 'Вас')
    await u.selectOptions(screen.getByRole('combobox', { name: 'Статус' }), 'ERROR')
    await u.type(screen.getByRole('textbox', { name: 'Сумма' }), '100')
    expect(apply).toBeEnabled()
    await u.type(screen.getByRole('textbox', { name: 'Сумма' }), '{Enter}')
    const list = screen.getByRole('list', { name: 'Применённые условия' })
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Приказодатель содержит „Вас“', 'Статус = Ошибка', 'Сумма = 100'])
    await u.clear(screen.getByRole('textbox', { name: 'Сумма' }))
    expect(revert).toBeEnabled()
    await u.click(revert)
    expect(screen.getByRole('textbox', { name: 'Сумма' })).toHaveValue('100')
    await u.clear(screen.getByRole('textbox', { name: 'Сумма' }))
    await u.click(apply)
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  })
  it('DATE — поле даты с EQ', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    const date = screen.getByLabelText('Дата')
    await u.type(date, '2026-09-01')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(screen.getByRole('list', { name: 'Применённые условия' })).toHaveTextContent('Дата = 01.09.2026')
  })
})
```

Run → FAIL.

- [ ] **Step 4: Поле.** `FilterField.tsx`:

```tsx
import { useId } from 'react'
import { Input, Select } from '../input'
import { conditionFrom, draftOf, fieldOp, type RawValue } from './fieldOps'
import type { Condition, Filter, FilterField as Field } from './types'
import s from './Filters.module.css'

export type FilterFieldProps = {
  field: Field
  draft: Filter
  onEdit: (c: Condition) => void
  onDiscard: (field: string) => void
}

/** Один контрол панели simple: оператор фиксирован типом поля; пустое значение снимает условие из черновика. */
export function FilterField({ field, draft, onEdit, onDiscard }: FilterFieldProps) {
  const id = useId()
  const raw = draftOf(draft, field)
  const set = (next: RawValue) => { const c = conditionFrom(field, next); if (c) onEdit(c); else onDiscard(field.id) }
  if (fieldOp(field) === null) return null
  const label = <label htmlFor={id} className={s.fieldLabel}>{field.label}</label>
  switch (field.type) {
    case 'ENUM':
      return <div className={s.fieldBox}>{label}<Select id={id} size="s" placeholder="—" value={typeof raw === 'string' ? raw : ''} onChange={(e) => set(e.target.value)} options={(field.values ?? []).map((v) => ({ value: String(v.value), label: v.label }))} /></div>
    case 'BOOLEAN':
      return <div className={s.fieldBox}>{label}<Select id={id} size="s" placeholder="—" value={typeof raw === 'string' ? raw : ''} onChange={(e) => set(e.target.value)} options={[{ value: 'true', label: 'да' }, { value: 'false', label: 'нет' }]} /></div>
    case 'DATETIME': {
      const v = typeof raw === 'string' ? { from: '', to: '' } : raw
      return (
        <fieldset className={s.fieldBox}>
          <legend className={s.fieldLabel}>{field.label}</legend>
          <div className={s.range}>
            <Input type="date" size="s" aria-label={`${field.label}, с`} value={v.from} onChange={(e) => set({ ...v, from: e.target.value })} />
            <Input type="date" size="s" aria-label={`${field.label}, по`} value={v.to} onChange={(e) => set({ ...v, to: e.target.value })} />
          </div>
        </fieldset>
      )
    }
    case 'DATE':
      return <div className={s.fieldBox}>{label}<Input id={id} type="date" size="s" value={typeof raw === 'string' ? raw : ''} onChange={(e) => set(e.target.value)} /></div>
    case 'NUMBER':
      return <div className={s.fieldBox}>{label}<Input id={id} size="s" inputMode="decimal" value={typeof raw === 'string' ? raw : ''} onChange={(e) => set(e.target.value)} /></div>
    default:
      return <div className={s.fieldBox}>{label}<Input id={id} size="s" value={typeof raw === 'string' ? raw : ''} onChange={(e) => set(e.target.value)} /></div>
  }
}
```

Нюанс: `Input`/`Select` — `forwardRef` с `...rest`, поэтому `id`, `value`, `onChange`, `type`, `inputMode`, `aria-label` доходят до нативного элемента. Значение контрола контролируемое: при наборе `set` → `onEdit`, черновик обновляется, `raw` пересчитывается.

- [ ] **Step 5: Панель.** `FilterPanel.tsx`:

```tsx
import { useId, type FormEvent } from 'react'
import { Button, IconButton } from '../button'
import { Counter } from '../value'
import { FilterField } from './FilterField'
import { describeCondition } from './opLabels'
import type { Condition, Filter, FilterMeta } from './types'
import s from './Filters.module.css'

export type FilterPanelProps = {
  label?: string | undefined
  meta: FilterMeta
  conditions: Filter
  draft: Filter
  dirty: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (c: Condition) => void
  onDiscard: (field: string) => void
  onApply: () => void
  onRevert: () => void
  onReset: () => void
  onRemove: (field: string) => void
}

/** Панель фильтров simple (спека 1e, 6.2): строка «Фильтры N» с чипами видна всегда, тело с полями сворачивается. */
export function FilterPanel({ label = 'Фильтры', meta, conditions, draft, dirty, open, onOpenChange, onEdit, onDiscard, onApply, onRevert, onReset, onRemove }: FilterPanelProps) {
  const bodyId = useId()
  const submit = (e: FormEvent) => { e.preventDefault(); if (dirty) onApply() }
  return (
    <div className={s.panel}>
      <div className={s.bar}>
        <Button size="s" aria-expanded={open} aria-controls={bodyId} className={s.toggle} onClick={() => onOpenChange(!open)}>
          <span>{label}</span>
          <Counter value={conditions.length} active={open} />
        </Button>
        {conditions.length === 0
          ? <span className={s.none}>условия не заданы</span>
          : (
            <ul className={s.chips} aria-label="Применённые условия">
              {conditions.map((c) => {
                const text = describeCondition(c, meta)
                return (
                  <li key={c.field} className={s.chip}>
                    <span>{text}</span>
                    <IconButton size="s" label={`Убрать условие: ${text}`} className={s.chipX} onClick={() => onRemove(c.field)}>✕</IconButton>
                  </li>
                )
              })}
            </ul>
          )}
        {conditions.length > 0 && <Button size="s" onClick={onReset}>Сбросить</Button>}
      </div>
      <form id={bodyId} hidden={!open} className={s.body} onSubmit={submit}>
        <div className={s.fields}>
          {meta.fields.map((f) => <FilterField key={f.id} field={f} draft={draft} onEdit={onEdit} onDiscard={onDiscard} />)}
        </div>
        <div className={s.actions}>
          <Button type="submit" variant="primary" size="s" disabled={!dirty}>Применить</Button>
          <Button size="s" disabled={!dirty} onClick={onRevert}>Отменить</Button>
        </div>
      </form>
    </div>
  )
}
```

`Filters.module.css`:

```css
.panel {
  display: grid;
  gap: var(--k-sp-2);
}

.bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--k-sp-2);
  min-height: var(--k-h-ctl-s);
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--k-sp-2);
}

.none {
  color: var(--k-muted);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--k-sp-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--k-sp-1);
  height: var(--k-h-ctl-s);
  padding: 0 var(--k-sp-1) 0 var(--k-sp-2);
  border: 1px solid var(--k-line);
  border-radius: var(--k-r-m);
  background: var(--k-sunk);
  color: var(--k-ink2);
  white-space: nowrap;
}

.chipX {
  color: var(--k-muted);
}

.body {
  display: grid;
  gap: var(--k-sp-3);
  padding: var(--k-sp-3);
  border: 1px solid var(--k-line);
  border-radius: var(--k-r-m);
  background: var(--k-paper);
}

.fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--k-filter-field), 1fr));
  gap: var(--k-sp-2) var(--k-sp-3);
}

.fieldBox {
  display: grid;
  gap: var(--k-sp-1);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.fieldLabel {
  padding: 0;
  font: 400 var(--k-fs-2) / var(--k-lh-2) var(--k-sans);
  color: var(--k-muted);
}

.range {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--k-sp-1);
}

.actions {
  display: flex;
  gap: var(--k-sp-2);
}
```

`index.ts`: `export { FilterPanel, type FilterPanelProps } from './FilterPanel'` и `export { fieldOp, conditionFrom, draftOf, isoDayStart, isoDayEnd, type RawValue } from './fieldOps'`.

Run: `pnpm --filter @katran/ui exec vitest run src/filters` → PASS; `pnpm check` зелёный (stylelint: в `.fields` нет голых px — ширина через токен).

- [ ] **Step 6: Commit** — `FilterPanel: панель фильтров simple — строка с чипами условий, сворачиваемое тело с полями по типам, применить и отменить`.

---

### Task 6: `BulkBar` и слот `toolbar` в `DataGrid`

**Files:**
- Create: `packages/ui/src/filters/BulkBar.tsx`, `packages/ui/src/filters/BulkBar.module.css`, `packages/ui/src/filters/BulkBar.test.tsx`
- Modify: `packages/ui/src/filters/index.ts`, `packages/ui/src/grid/DataGrid.tsx`, `packages/ui/src/grid/Grid.module.css`, `packages/ui/src/grid/DataGrid.test.tsx`

**Interfaces:**
- Consumes: `Selection` (`grid/types`), `Button`, `useKatran().announce`.
- Produces: `BulkBarProps`, `BulkBar`; `DataGridProps.toolbar?: ReactNode | undefined`.

- [ ] **Step 1: Тесты.** `BulkBar.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Button } from '../button'
import { BulkBar } from './BulkBar'

describe('BulkBar', () => {
  it('при нуле не рендерится', () => {
    renderK(<BulkBar selection={{ mode: 'ids', ids: [] }} total={87} onClear={() => {}} />)
    expect(screen.queryByRole('region')).toBeNull()
  })
  it('режим ids: «Выбрано N», «Выбрать все total по фильтру», «Снять выделение», слот действий, объявление', async () => {
    const u = userEvent.setup()
    const onClear = vi.fn(); const onSelectAll = vi.fn(); const onExport = vi.fn()
    const { container } = renderK(
      <BulkBar selection={{ mode: 'ids', ids: ['a', 'b'] }} total={87} onClear={onClear} onSelectAll={onSelectAll}>
        <Button size="s" onClick={onExport}>Экспортировать</Button>
      </BulkBar>,
    )
    const region = screen.getByRole('region', { name: 'Массовые действия' })
    expect(region).toHaveTextContent('Выбрано 2')
    expect(screen.getByRole('status')).toHaveTextContent('Выбрано 2')
    await u.click(screen.getByRole('button', { name: 'Выбрать все 87 по фильтру' }))
    expect(onSelectAll).toHaveBeenCalled()
    await u.click(screen.getByRole('button', { name: 'Снять выделение' }))
    expect(onClear).toHaveBeenCalled()
    await u.click(screen.getByRole('button', { name: 'Экспортировать' }))
    expect(onExport).toHaveBeenCalled()
    expect(await axe(container)).toHaveNoViolations()
  })
  it('режим all: «Все N по фильтру» с учётом except; без onSelectAll кнопки нет', () => {
    renderK(<BulkBar selection={{ mode: 'all', except: ['x'] }} total={87} onClear={() => {}} />)
    expect(screen.getByRole('region')).toHaveTextContent('Все 86 по фильтру')
    expect(screen.queryByRole('button', { name: /Выбрать все/ })).toBeNull()
  })
})
```

Перед написанием проверить, как `LiveRegion` провайдера выводит объявления (`packages/ui/src/provider/LiveRegion.tsx`): если элемент — `role="status"`, проверка `getByRole('status')` верна; если `aria-live` без роли — заменить на `screen.getByText('Выбрано 2', { selector: '[aria-live]' })`.

В `DataGrid.test.tsx` добавить:

```tsx
  it('слот toolbar рендерится в футере над пагинацией', () => {
    renderK(<DataGrid {...base} toolbar={<div data-testid="tb">полоса</div>} />)
    const tb = screen.getByTestId('tb')
    const nav = screen.getByRole('navigation', { name: /Страницы/ })
    expect(tb.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
```

(`base` — набор минимальных пропов, уже используемый в этом файле; имя навигации пагинации взять из `Pagination.tsx` — если там другое `aria-label`, подставить его.)

Run → FAIL.

- [ ] **Step 2: Реализация.** `BulkBar.tsx`:

```tsx
import { useEffect, type ReactNode } from 'react'
import { Button } from '../button'
import type { Selection } from '../grid/types'
import { useKatran } from '../provider'
import s from './BulkBar.module.css'

export type BulkBarProps = {
  label?: string | undefined
  selection: Selection
  total: number
  onClear: () => void
  /** Нет — нет перехода в режим «всё по фильтру». */
  onSelectAll?: (() => void) | undefined
  /** Действия приложения; полоса их не знает (спека 6.3: действия получают { filter, selection } на стороне приложения). */
  children?: ReactNode | undefined
}

/** Полоса массовых действий над пагинацией: «Выбрано N» или «Все N по фильтру»; при нуле не рендерится (спека 1e, 6.3). */
export function BulkBar({ label = 'Массовые действия', selection, total, onClear, onSelectAll, children }: BulkBarProps) {
  const all = selection.mode === 'all'
  const n = all ? Math.max(0, total - selection.except.length) : selection.ids.length
  const text = all ? `Все ${n} по фильтру` : `Выбрано ${n}`
  const { announce } = useKatran()
  useEffect(() => { if (n > 0) announce(text) }, [n, text, announce])
  if (n === 0) return null
  return (
    <div role="region" aria-label={label} className={s.bar}>
      <span className={s.count}>{text}</span>
      {!all && onSelectAll && n < total && <Button size="s" onClick={onSelectAll}>Выбрать все {total} по фильтру</Button>}
      <Button size="s" onClick={onClear}>Снять выделение</Button>
      {children && <span className={s.actions}>{children}</span>}
    </div>
  )
}
```

`BulkBar.module.css`:

```css
.bar {
  display: flex;
  align-items: center;
  gap: var(--k-sp-2);
  min-height: var(--k-h-ctl-m);
  padding: var(--k-sp-1) var(--k-sp-2);
  border-radius: var(--k-r-m);
  background: var(--k-val-soft);
  color: var(--k-ink);
}

.count {
  font-weight: 600;
}

.actions {
  display: inline-flex;
  gap: var(--k-sp-2);
  margin-left: auto;
}
```

`DataGrid.tsx`: в `DataGridProps` добавить `/** Слот над пагинацией в футере — полоса массовых действий экрана. */ toolbar?: ReactNode | undefined` (импорт `type ReactNode` из react); в JSX футера:

```tsx
      <div className={s.foot}>
        {p.toolbar && <div className={s.toolbar}>{p.toolbar}</div>}
        <Pagination … />
      </div>
```

`Grid.module.css` после `.foot`:

```css
.toolbar {
  padding: var(--k-sp-2) 0 0;
}
```

`index.ts`: `export { BulkBar, type BulkBarProps } from './BulkBar'`.

Run: тесты → PASS; `pnpm check` зелёный.

- [ ] **Step 3: Commit** — `BulkBar: полоса массовых действий — счёт выделения, «всё по фильтру», слот действий; у DataGrid слот toolbar над пагинацией`.

---

### Task 7: Экран «Валютные документы» в демо

**Files:**
- Modify: `apps/demo/src/data/fakeBackend.ts`, `apps/demo/src/pages/GridPage.tsx`, `apps/demo/src/pages/Page.module.css`

**Interfaces:**
- Consumes: всё из Tasks 1–6.
- Produces: `createFakeBackend(all, layout, opts)` → `{ searchFx: Effect<GridQuery, GridPage<Row>>; facetsFx: Effect<FacetsQuery, Facet[]> }`; `docsFilterMeta: FilterMeta` (в `fakeBackend.ts` — нет: в `docs.ts`, рядом со словарями статусов).

- [ ] **Step 1: Фейковый бэкенд.** В `fakeBackend.ts` заменить `matches` и фабрику:

```ts
import { createEffect } from 'effector'
import type { Condition, Facet, FacetsQuery, Filter, GridPage, GridQuery } from '@katran/effector'
import { sortRows, type RecordLayout } from '@katran/ui'

const str = (v: unknown) => (v == null ? '' : String(v)).toLowerCase()
const isDay = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
/** Дата в условии — день YYYY-MM-DD: сравниваем с первыми 10 знаками ISO-значения записи. */
const dayOf = (v: unknown) => str(v).slice(0, 10)
const num = (v: unknown) => Number(String(v).replace(/\s/g, '').replace(',', '.'))
const cmp = (v: unknown, c: unknown) => (typeof c === 'number' ? num(v) - c : str(v) < str(c) ? -1 : str(v) > str(c) ? 1 : 0)

/** Подмножество семантики контракта, достаточное для демо: строки регистронезависимо, числа как числа, даты по дню/ISO-строкой. */
function matches(row: Record<string, unknown>, c: Condition): boolean {
  const v = row[c.field]
  switch (c.op) {
    case 'EQ': return isDay(c.value) ? dayOf(v) === c.value : typeof c.value === 'number' ? num(v) === c.value : str(v) === str(c.value)
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
const applyFilter = <Row extends Record<string, unknown>>(rows: Row[], f: Filter) => rows.filter((r) => f.every((c) => matches(r, c)))

export type FakeBackendOptions = { delay?: number | undefined }
const wait = (delay: number | undefined) => {
  const slow = new URLSearchParams(location.search).get('slow')
  return new Promise((r) => setTimeout(r, delay ?? (slow ? Number(slow) : 250 + Math.random() * 400)))
}

/** Бэкенд в памяти: search — та же форма, что у POST /grids/{id}/search; facets — предложение POST /grids/{id}/facets. Задержка 0,25–0,65 с (?slow=N — ровно N мс). */
export function createFakeBackend<Row extends Record<string, unknown>>(all: Row[], layout: RecordLayout<Row>, opts: FakeBackendOptions = {}) {
  const get = (row: Row, key: string) => row[key]
  const searchFx = createEffect<GridQuery, GridPage<Row>>(async (q) => {
    await wait(opts.delay)
    const sorted = sortRows(applyFilter(all, q.filter), q.sort, layout.columns, get)
    return { rows: sorted.slice(q.page * q.size, (q.page + 1) * q.size), total: sorted.length }
  })
  const facetsFx = createEffect<FacetsQuery, Facet[]>(async ({ filter, field }) => {
    await wait(opts.delay)
    const counts = new Map<string, number>()
    for (const r of applyFilter(all, filter)) { const k = String(r[field]); counts.set(k, (counts.get(k) ?? 0) + 1) }
    return [...counts].map(([value, count]) => ({ value, count }))
  })
  return { searchFx, facetsFx }
}
```

В `docs.ts` после `STATUS_TONE` добавить:

```ts
export const DIRECTION_LABEL: Record<Direction, string> = { IN: 'Входящий', OUT: 'Исходящий', TRANSIT: 'Транзит', OTHER: 'Прочее' }
const enumValues = <K extends string>(labels: Record<K, string>) => (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }))
/** Каталог полей панели фильтров — то, что бек отдаст в GET /grids/documents/filter-meta. */
export const docsFilterMeta: FilterMeta = { fields: [
  { id: 'docNumber', label: 'Номер документа', type: 'NUMBER', ops: [] },
  { id: 'status', label: 'Статус', type: 'ENUM', ops: [], values: enumValues(STATUS_LABEL) },
  { id: 'type', label: 'Тип сообщения', type: 'ENUM', ops: [], values: ['MT103', 'MT202', 'MT202COV', 'MT199'].map((v) => ({ value: v, label: v })) },
  { id: 'direction', label: 'Направление', type: 'ENUM', ops: [], values: enumValues(DIRECTION_LABEL) },
  { id: 'currency', label: 'Валюта', type: 'ENUM', ops: [], values: ['USD', 'EUR', 'CNY', 'RUB'].map((v) => ({ value: v, label: v })) },
  { id: 'amount', label: 'Сумма', type: 'NUMBER', ops: [] },
  { id: 'created', label: 'Дата документа', type: 'DATE', ops: [] },
  { id: 'f50name', label: 'Приказодатель', type: 'STRING', ops: [] },
  { id: 'f59name', label: 'Бенефициар', type: 'STRING', ops: [] },
] }
```

(импорт `type FilterMeta` из `@katran/ui`).

- [ ] **Step 2: Экран.** В `GridPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { createFiltersModel, createGridModel, localStoragePersist, useFilters, useGrid } from '@katran/effector'
import { AccountValue, BulkBar, Button, Checkbox, CopyValue, Counter, DataGrid, FilterPanel, LinkValue, StatusDot, StatusLane, Tag, formatAmount, formatDateTimeShort, useKatran, type LaneItem, type RecordLayout } from '@katran/ui'
import { docsFilterMeta, makeDocs, STATUS_LABEL, STATUS_TONE, type Doc, type Status } from '../data/docs'
import { createFakeBackend } from '../data/fakeBackend'
```

Модели (модульный уровень, вместо `resetFilter`/`$filter`; экспорт `$filter`/`resetFilter` убрать — сначала `grep -rn "resetFilter\|\$filter" apps/demo/src`, других потребителей быть не должно):

```tsx
const docs = makeDocs()
const { searchFx, facetsFx } = createFakeBackend(docs, docsLayout)
const filters = createFiltersModel({ meta: docsFilterMeta, laneField: 'status' })
const grid = createGridModel<Doc>({
  id: 'demo-docs',
  columns: docsLayout.columns.map((c) => ({ id: c.id, width: c.width })),
  pageSize: 20,
  $filter: filters.$conditions,
  fetchFx: searchFx,
  facets: { field: 'status', fetchFx: facetsFx },
  persist: localStoragePersist('katran-demo'),
  rowKey: docsLayout.rowKey,
})
const STATUSES = Object.keys(STATUS_LABEL) as Status[]
```

Компонент:

```tsx
export function GridPage() {
  const g = useGrid(grid)
  const f = useFilters(filters)
  const { announce } = useKatran()
  const [opened, setOpened] = useState<string | null>(null)
  const [hlSpans, setHlSpans] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  useEffect(() => { grid.refresh() }, [])
  const lane: LaneItem[] = STATUSES.map((st) => ({ value: st, label: STATUS_LABEL[st], tone: STATUS_TONE[st], count: g.facets.find((x) => String(x.value) === st)?.count ?? 0 }))
  const bulk = (what: string) => { const n = g.selection.mode === 'all' ? g.total - g.selection.except.length : g.selection.ids.length; announce(`${what}: выбрано ${n}`) }
  return (
    <div className={[s.gridPage, hlSpans ? s.hlSpans : ''].filter(Boolean).join(' ')}>
      <div className={s.gridHead}>
        <h1 className={s.h1}>Валютные документы <Counter value={g.total} /></h1>
        <p className={s.note}>… (прежний текст) …</p>
        <details className={s.explain}>…(прежний блок сквозных строк)…</details>
        {opened && <p className={s.note} role="status">{opened}</p>}
        <div className={s.lane}><StatusLane label="Статусы" items={lane} value={f.lane} onChange={f.setLane} /></div>
        <div className={s.filters}>
          <FilterPanel meta={docsFilterMeta} conditions={f.conditions} draft={f.draft} dirty={f.dirty} open={filtersOpen} onOpenChange={setFiltersOpen}
            onEdit={f.edit} onDiscard={f.discard} onApply={f.apply} onRevert={f.revert} onReset={f.reset} onRemove={f.remove} />
        </div>
      </div>
      <DataGrid
        {...g}
        label="Валютные документы"
        layout={docsLayout}
        pageSizes={[20, 50]}
        emptyAction={{ label: 'Сбросить фильтр', onClick: () => f.reset() }}
        onOpen={(d, { secondary }) => { const msg = `Открыт документ ${d.docNumber}${secondary ? ' — второй drawer рядом' : ''}`; setOpened(msg); announce(msg) }}
        toolbar={
          <BulkBar selection={g.selection} total={g.total} onClear={g.onClearSelection} onSelectAll={g.onSelectAll}>
            <Button size="s" onClick={() => bulk('Экспорт')}>Экспортировать</Button>
            <Button size="s" onClick={() => bulk('Отложить')}>Отложить</Button>
          </BulkBar>
        }
      />
    </div>
  )
}
```

`{...g}` теперь несёт и `facets`, `onSelectAll`, `onClearSelection` — `DataGrid` их не принимает: передавать явно нужные поля или снять лишние: `const { facets: _f, onSelectAll: _a, onClearSelection: _c, ...gridProps } = g` и `<DataGrid {...gridProps} …/>` (в `exactOptionalPropertyTypes` лишние пропы объекта в spread не ошибка, но линт `no-unused-vars` на `_f` — использовать `void` или назвать с подчёркиванием согласно правилу проекта; проверить `eslint.config.js`). В `Page.module.css` добавить:

```css
.lane {
  margin: var(--k-sp-3) 0 var(--k-sp-2);
}

.filters {
  margin: 0 0 var(--k-sp-3);
}

.h1 :global(.k-Value__counter) {
  vertical-align: middle;
  margin-left: var(--k-sp-2);
}
```

Если `:global` в CSS Modules демо не поддержан stylelint-конфигом — обернуть `Counter` в `<span className={s.h1Counter}>` и стилизовать его.

- [ ] **Step 3: Проверка.** `pnpm check` зелёный; `pnpm --filter demo e2e` → 3/3 (панель по умолчанию свёрнута, лейн — над гридом, высота записи не меняется). Playwright-скрипт в папку отчётов (не в репо): открыть `/#/grid`, дождаться записей, кликнуть «Ошибка» в лейне → в чипах «Статус = Ошибка», счётчик «Все» не изменился; раскрыть «Фильтры», ввести «Вас» в «Приказодатель», Enter → второй чип, число записей уменьшилось; отметить две записи → полоса «Выбрано 2»; скриншот в отчёт. Реальные числа (сколько документов по статусу «Ошибка», сколько после «Вас») — в отчёт.

- [ ] **Step 4: Commit** — `Демо: экран «Валютные документы» — лейн статусов, панель фильтров, массовые действия на одном сторе условий`.

---

### Task 8: Документы

**Files:**
- Modify: `README.md`, `CHANGELOG.md`, `docs/STATE.md`

- [ ] **Step 1: README.** После раздела «Модели effector» добавить раздел «Экран реестра: лейн, фильтры, массовые действия» с рабочим примером (сверить с `GridPage.tsx`): `createFiltersModel({ meta, laneField: 'status' })`, `createGridModel({ …, $filter: filters.$conditions, facets: { field: 'status', fetchFx } })`, `useFilters`/`useGrid`, JSX `StatusLane` + `FilterPanel` + `DataGrid toolbar={<BulkBar …/>}`; две фразы про правила: лейн и панель — один стор условий; счётчики — фасеты без условия поля лейна; типы фильтра экспортирует `@katran/ui`.
- [ ] **Step 2: CHANGELOG.** Строка «Срез 1, план 3 (1e): …» с перечислением: типы фильтра в `@katran/ui` (breaking для импортов из `@katran/effector` — остаются через реэкспорт), `setLane`/`$lane`/`revert`, фасеты, `StatusLane`, `FilterPanel` simple, `BulkBar`, слот `toolbar`, экран «Валютные документы».
- [ ] **Step 3: STATE.md.** §3: решения (один стор условий, фасеты без условия лейна, типы фильтра в ui); §5 карта: `packages/ui/src/filters/`; §6: план 3 исполнен, тесты (числа из прогона), e2e; §7 техдолг — что осталось (например, `?raw` для сниппета); §9 «Следующий шаг»: план 4 — advanced-фильтры через отдельный дизайн-заход (спека 7.2) либо срез 2 (деталка) — по решению владельца.
- [ ] **Step 4: Commit** — `Документы: README про экран реестра, CHANGELOG, состояние проекта после плана 3`.

---

## Самопроверка плана

**Покрытие спеки 1e.** §2 принципы → Tasks 1–3, 7; §3 модель фильтров → Task 2; §4 фасеты → Task 3; §5 хуки → Tasks 2, 3; §6.1 StatusLane → Task 4; §6.2 FilterPanel → Task 5; §6.3 BulkBar и §6.4 слот → Task 6; §7 экран и фейковый бэкенд → Task 7; §8 проверки → тесты в каждой задаче + Task 7 Step 3; §9 открытое — не входит.

**Согласованность имён.** `setLane`/`$lane`/`revert`/`laneField` — Task 2 ↔ `useFilters` ↔ Task 5 (`onRevert`) ↔ Task 7. `facets: { field, fetchFx }`, `$facets`, `Facet`, `FacetsQuery` — Task 1 ↔ Task 3 ↔ Task 7 (`createFakeBackend` отдаёт `facetsFx: Effect<FacetsQuery, Facet[]>`). `GridBinding.onSelectAll`/`onClearSelection` — Task 3 ↔ Task 7. `toolbar` — Task 6 ↔ Task 7. `describeCondition(c, meta)` — Task 1 ↔ Task 5. `LaneItem` — Task 4 ↔ Task 7. `FilterField.ops: []` = все операторы типа — Task 1 ↔ Task 5 (`fieldOp`) ↔ Task 7 (`docsFilterMeta`).

**Заглушек нет.** Каждый шаг с кодом содержит код; места, где исполнителю нужно свериться с существующим файлом (стиль `aria-pressed` в `Button.module.css`, роль `LiveRegion`, имя навигации пагинации, `:global` в stylelint), названы с конкретной заменой.
