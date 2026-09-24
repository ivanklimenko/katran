# katran

Дизайн-система для интерфейсов проекта: React + effector. Спецификация — `docs/superpowers/specs/2026-09-23-katran-design.md`.

Пакеты: `@katran/tokens` (токены, шрифты), `@katran/ui` (компоненты), `@katran/effector` (модели). Демо — `apps/demo`.

    corepack enable && pnpm install
    pnpm check        # генерация токенов, линт, тесты, сборка
    pnpm --filter demo dev

## Подключение

В монорепозитории пакеты подключаются исходниками через workspace — сборка не нужна:

    "@katran/ui": "workspace:*"

Вне монорепозитория пакет собирается и подключается сборкой:

    pnpm --filter @katran/ui build

```ts
import '@katran/tokens/fonts.css'
import '@katran/ui/styles.css'
import { KatranProvider, Button } from '@katran/ui'
```

Peer-зависимости: `react` ≥ 18, `react-dom` ≥ 18.

## DataGrid

Грид контролируемый: данные и состояние вида приходят пропами, изменения уходят колбэками. Запись — `<tbody>` из строки колонок и сквозных строк (`spans`), сегменты адресуются по `id` колонок. Контракт и правила — спека, раздел 6.

```tsx
import { useState } from 'react'
import { DataGrid, type ColumnsState, type RecordLayout, type Sort } from '@katran/ui'

type Doc = { id: string; num: number; amount: string; purpose: string | null; status: string }

export const layout: RecordLayout<Doc> = {
  rowKey: (d) => d.id,
  columns: [
    { id: 'num', title: '№', width: 90, sort: [{ id: 'num', label: 'Номер', type: 'number' }], render: (d) => d.num },
    { id: 'amount', title: 'Сумма', width: 120, align: 'right', render: (d) => d.amount },
  ],
  // вторая строка записи: назначение платежа сквозь обе колонки; null — бледная подложка
  spans: [[{ id: 'purpose', from: 'num', to: 'amount', render: (d) => d.purpose }]],
}

export function Docs({ rows, total }: { rows: Doc[]; total: number }) {
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<Sort>(null)
  const [widths, setWidths] = useState<Record<string, number>>({})
  const [cols, setCols] = useState<ColumnsState>({ order: [], hidden: [] })
  return (
    <DataGrid
      label="Документы"
      layout={layout}
      rows={rows} total={total} state="ready"
      page={page} pageSize={20} onPage={setPage}
      sort={sort} onSort={setSort}
      widths={widths} onResize={({ id, width }) => setWidths((w) => ({ ...w, [id]: width }))}
      order={cols.order} hidden={cols.hidden} onColumns={setCols}
    />
  )
}
```

`label` обязателен — это доступное имя сетки. Выделение включается пропами `selection` + `onSelect`/`onSelectPage`, кнопка открытия записи — `onOpen`, состояния загрузки — `state` (`loading`, `refreshing`, `error` с `onRetry`).

## Модели effector

В приложении состояние грида держит модель из `@katran/effector`, а хук `useGrid` превращает её в пропы `DataGrid`. Транспорт — эффект приложения: модель собирает `GridQuery` (`page` с нуля, как у бека) и ждёт `GridPage` (`rows`, `total`).

```tsx
import { useEffect } from 'react'
import { createEffect } from 'effector'
import { createFiltersModel, createGridModel, localStoragePersist, useGrid, type GridPage, type GridQuery } from '@katran/effector'
import { DataGrid } from '@katran/ui'

const fetchFx = createEffect(async (q: GridQuery): Promise<GridPage<Doc>> => {
  const r = await fetch('/grids/docs/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
})

const filters = createFiltersModel()
const grid = createGridModel<Doc>({
  id: 'docs',                                // ключ сохранённых настроек вида
  columns: layout.columns.map((c) => ({ id: c.id, width: c.width })),
  rowKey: layout.rowKey,
  $filter: filters.$conditions,
  fetchFx,
  persist: localStoragePersist(),            // ширины, порядок, скрытые колонки, размер страницы
})

export function DocsPage() {
  const g = useGrid(grid)
  useEffect(() => { grid.refresh() }, [])    // первый запрос — за приложением
  return <DataGrid {...g} label="Документы" layout={layout} pageSizes={[20, 50]} />
}
```

Модель при создании в бек не ходит: первую загрузку запускает приложение вызовом `grid.refresh()`. Дальше запросы идут сами — при смене фильтра, сортировки, страницы и размера страницы; ответ на устаревший запрос отбрасывается. Правила связывания — спека 8.2. Рабочий экран — `apps/demo/src/pages/GridPage.tsx`.

Peer-зависимости `@katran/effector`: `effector` ≥ 23, `effector-react` ≥ 23, `react` ≥ 18.

## Экран реестра: лейн, фильтры, массовые действия

`StatusLane`, `FilterPanel` и `BulkBar` — чистые компоненты `@katran/ui` поверх тех же двух моделей: **лейн и панель — один стор условий** (`createFiltersModel({ laneField })`): клик по лейну ставит условие `EQ` по полю лейна сразу в применённые и черновик панели, без «Применить»; снятие того же условия в панели переключает лейн обратно на «Все». **Счётчики лейна — это фасеты грида** (`createGridModel({ facets })`) по фильтру без условия самого поля лейна — они отвечают на вопрос «сколько будет», а не «сколько сейчас». Типы фильтра (`Condition`, `Filter`, `FilterMeta`, `FilterField`) экспортирует `@katran/ui`, `@katran/effector` их только реэкспортирует.

```tsx
import { useEffect, useState } from 'react'
import { createFiltersModel, createGridModel, useFilters, useGrid } from '@katran/effector'
import { BulkBar, Button, DataGrid, FilterPanel, StatusLane, type LaneItem } from '@katran/ui'
import { docsFilterMeta, makeDocs, STATUS_LABEL, STATUS_TONE, type Status } from './data/docs'
import { createFakeBackend } from './data/fakeBackend'

// Doc и layout — запись и раскладка, как в разделе «DataGrid» выше (поле `status` у `Doc` — поле лейна).
// Эффекты приложения: в демо — фейковый бэкенд, в бою — POST /grids/{id}/search и /grids/{id}/facets.
const { searchFx, facetsFx } = createFakeBackend(makeDocs(), layout)

const filters = createFiltersModel({ meta: docsFilterMeta, laneField: 'status' })
const grid = createGridModel<Doc>({
  id: 'currency-docs',
  columns: layout.columns.map((c) => ({ id: c.id, width: c.width })),
  rowKey: layout.rowKey,
  $filter: filters.$conditions,
  fetchFx: searchFx,
  facets: { field: 'status', fetchFx: facetsFx },   // счётчики лейна; без конфигурации useGrid().facets всегда []
})

const STATUSES = Object.keys(STATUS_LABEL) as Status[]

export function DocsPage() {
  const g = useGrid(grid)
  const f = useFilters(filters)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // до первого ответа фасетов лейн без чисел, а не с нулями
  const [counted, setCounted] = useState(false)
  if (!counted && g.facets.length > 0) setCounted(true)
  useEffect(() => { grid.refresh() }, [])
  const lane: LaneItem[] = STATUSES.map((st) => ({
    value: st, label: STATUS_LABEL[st], tone: STATUS_TONE[st],
    count: counted ? (g.facets.find((x) => String(x.value) === st)?.count ?? 0) : undefined,
  }))
  return (
    <>
      <StatusLane label="Статусы" items={lane} value={f.lane} onChange={f.setLane} />
      <FilterPanel meta={docsFilterMeta} conditions={f.conditions} draft={f.draft} dirty={f.dirty}
        open={filtersOpen} onOpenChange={setFiltersOpen}
        onEdit={f.edit} onDiscard={f.discard} onApply={f.apply} onRevert={f.revert} onReset={f.reset} onRemove={f.remove} />
      <DataGrid {...g} label="Валютные документы" layout={layout} pageSizes={[20, 50]}
        toolbar={
          <BulkBar selection={g.selection} total={g.total} onClear={g.onClearSelection} onSelectAll={g.onSelectAll}>
            {/* полоса не знает действий — приложение само шлёт { filter: f.conditions, selection: g.selection } на бек */}
            <Button size="s" onClick={() => {}}>Экспортировать</Button>
          </BulkBar>
        }
      />
    </>
  )
}
```

Рабочий экран — `apps/demo/src/pages/GridPage.tsx` («Валютные документы» на фейковом бэкенде, 87 документов).

## Границы слоёв

`@katran/ui` не знает об effector, `@katran/effector` берёт из `@katran/ui` только типы (`import type`) и не трогает DOM — это проверяет `pnpm lint`, а не договорённость (спека 3.2).

## Замер геометрии

Playwright-спека `apps/demo/e2e/geometry.spec.ts` замеряет реальную высоту записи, шапки и скелетона грида против production-сборки демо (`vite build` + `vite preview`). В `pnpm check` не входит — гоняется отдельно.

Установка браузера (один раз):

    pnpm --filter demo exec playwright install chromium

Запуск:

    pnpm --filter demo e2e
