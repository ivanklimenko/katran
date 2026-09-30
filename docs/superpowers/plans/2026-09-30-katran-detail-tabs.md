# Срез 2b «Остальные вкладки деталки» в `apps/pi`: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** все вкладки деталки «Платёжная инструкция» валюты и рубля показывают содержимое: «Доп. поля» (валюта), Статусы, Комплаенс, Связанные документы, Задачи, Нотификации, Исходный текст / ED244, Стриминг, MPU, Аудит — по замороженному эталону `e065bfb`, с ленивой загрузкой каждой вкладки отдельным запросом, своим скелетоном, ошибкой и «Повторить»; связанный документ открывается в drawer B.

**Architecture:** механизмы — в ките `@katran/ui`: `MiniTable` (новый модуль `table`), `StatusBadge`, `Timestamp`, `CodeView` (модуль `code`: подсветка JSON, SWIFT, XML), `KeyValueList`, форматтеры `formatTimestamp` / `formatDuration`, управляемое раскрытие `ConfigForm`. Домен — в `apps/pi` по FSD: порт `tabFx` в `shared/api` (`GET /grids/{gridId}/documents/{id}/tabs/{tab}` — предложение в контракт `vtb-filters`), новая сущность `entities/doc-trail` (типы, мапперы и виды восьми общих вкладок), `ExtraTab` в `entities/fx-doc`; виджет `widgets/doc-detail` грузит нелокальную вкладку лениво (кэш `id:tab`, счётчик визитов), держит раскрытие по документу и рендерит вкладку через `DetailDomain.tabViews`; страницы собирают `tabViews` и открывают связанный документ в B. Фейк отдаёт данные вкладок детерминированно по `id`, рубль — со своими данными, `tabsOff` согласован с пустотой данных.

**Tech Stack:** pnpm-монорепо, React 17.0.2, effector 23.4, effector-react, Vite 8, Vitest 5 + jsdom + Testing Library 12 + jest-axe, Playwright 1.63, eslint (`import-x`, `jsx-a11y`, `react-hooks`), stylelint.

**Spec:** `docs/superpowers/specs/2026-09-30-katran-detail-tabs-design.md` (§7 — порядок задач 0–13). Спека 2a — `docs/superpowers/specs/2026-09-29-katran-detail-view-design.md`; основная — `docs/superpowers/specs/2026-09-23-katran-design.md` (§5.2); спека `apps/pi` — `docs/superpowers/specs/2026-09-28-katran-pi-app-design.md`. Эталон — стенд `/Users/shaman/_CODE/VTB/pi-constructor`, коммит `e065bfb` (`index.html`: вкладки 1066–1299, CSS 257–364, моки 767–920; `skeleton.js`).

## Global Constraints

- Предусловие: срез 2a слит в `main` (коммит слияния `fda9f91`), спека 2b — `f08e522`; `pnpm check` зелёный (Task 0). Работа — в worktree `katran/.worktrees/detail-tabs`, ветка `feat/detail-tabs` от `main`.
- Среда внутри: **React 17.0.2** (shared singleton хоста), effector 23.4, **Chromium 88**. Во всём коде (кит и `apps/pi`): legacy `render` из `react-dom`, без `createRoot`, `useId`, `useSyncExternalStore` и прочих API React 18+ (замена `useId` — `useStableId`, `packages/ui/src/compat/useStableId.ts`); без `.at`, `Object.hasOwn`, `findLast`, `toSorted`, `structuredClone`, `String.prototype.replaceAll`, CSS `:has`, `inert`, `dialog.showModal`. `DOMParser` в Chromium 88 и jsdom есть.
- Подсветка кода — только React-элементы из токенов; **никакого `dangerouslySetInnerHTML` / `innerHTML`** (данные бека — недоверенный текст).
- Тесты: `@testing-library/react` 12 + `@testing-library/dom` 8, `@testing-library/user-event` 14, `jest-axe`; `renderHook` — локальный (`packages/ui/src/test/renderHook.tsx`). Фейковые таймеры — `vi.useFakeTimers()` / `vi.advanceTimersByTime()` внутри `act`.
- jsdom не видит каскад CSS-модулей, раскладку и контраст: геометрия, высоты и цвета — только e2e в Chromium.
- CSS — только `var(--k-*)`; голые `px` только в `border*`/`outline*`/`box-shadow`/`letter-spacing`; без hex/rgba/named-цветов. Новые размеры — токенами в `packages/tokens/src/tokens.src.ts` (генератор оборачивает в `calc(Npx * var(--k-density))`), затем `pnpm gen` (коммитить `tokens.src.ts`, `tokens.css`, `tokens.ts`). Ширины из пропсов (колонки `MiniTable`, подпись `KeyValueList`) — числом px при плотности 1, в стиль — `calc(${n}px * var(--k-density))`, как `ColumnHeader`. Блоки, чья высота сверяется с эталоном, задают `box-sizing: border-box` явно.
- Опциональные поля публичных типов — `?: T | undefined` (`exactOptionalPropertyTypes`).
- Импорты относительные, без алиасов. FSD-зоны eslint: слои только вниз; чужой слайс — только через `index.ts`; соседние сущности — только через `@x/<потребитель>.ts`; виджеты между собой не импортируются; `widgets/doc-detail` не импортирует `entities`. Никаких `eslint-disable` / `stylelint-disable`.
- Данные — только вымышленные; словари — с замороженного стенда (он обезличен). Никаких данных с фото прода. Рубль — со своими данными (RUB, рублёвые счета `40702810…`/`30102810…`, сценарии `SC_NCB_*`, события `rub_evt_*`), без артефактов валюты.
- Тексты интерфейса — дословно с эталона (подписи колонок, пустые состояния, счётчики), если спека не говорит иначе; заглушки кнопок — `announce('Действие будет в 2d')`.
- Русский язык интерфейса, комментариев, коммитов. Коммиты: `git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "…"`, **без** трейлеров `Co-Authored-By` и подписей «Generated with»; файлы добавлять поимённо (`git add <файлы>`, не `-A`).
- Порты: `apps/pi` dev — 5185, e2e preview — 5186, временный сервер стенда (Task 1) — 5187.
- e2e (`pnpm --filter pi e2e`) — только на переднем плане, дождаться результата; в фоне не запускать.
- `pnpm check` зелёный после каждой задачи. `gen:check` сравнивает `tokens.css`/`tokens.ts` с индексом git: после `pnpm gen` сначала `git add` сгенерированных файлов, потом `pnpm check`.

---

## Сквозной контракт имён (все задачи пользуются только им)

### Кит `@katran/ui`

```ts
// packages/ui/src/format/time.ts (Task 2), экспорт из format/index.ts
export type TimestampParts = { date: string /* 'ДД.ММ' */; time: string /* 'ЧЧ:ММ:СС' */; ms: string /* '123' или '' */; full: string /* 'ДД.ММ.ГГГГ ЧЧ:ММ:СС.ммм' */ }
export function formatTimestamp(iso: string): TimestampParts | null   // null — не ISO-дата; ISO без зоны (2026-09-22T07:31:45.241) — настенное время, без new Date и сдвига зоны
export function timestampDiff(from: string, to: string): number | null   // мс между настенными временами; null — не ISO
export function formatDuration(ms: number): string                   // '850 мс' | '4,2 с' | '3 мин 5 с' | '2 ч 10 мин'

// packages/ui/src/value/Timestamp.tsx (Task 2)
export type TimestampProps = { iso: string }
export function Timestamp(props: TimestampProps): JSX.Element        // «ДД.ММ ЧЧ:ММ:СС» + ms приглушённо, full — тултипом; не ISO — текст как есть

// packages/ui/src/value/StatusBadge.tsx (Task 2)
export type BadgeTone = 'ok' | 'bad' | 'wait' | 'neutral'
export type StatusBadgeProps = { tone: BadgeTone; children: ReactNode }
export function StatusBadge(props: StatusBadgeProps): JSX.Element

// packages/ui/src/table/MiniTable.tsx (Task 3), новый модуль table/index.ts, экспорт из src/index.ts
export type MiniColumn<T> = {
  id: string
  header: string                           // '' — колонка без заголовка (служебная)
  width?: number | undefined               // px при плотности 1; нет — minmax(0, 1fr)
  render: (row: T, index: number) => ReactNode
  mono?: boolean | undefined
  align?: 'start' | 'end' | undefined
}
export type MiniTableProps<T> = {
  label: string                            // доступное имя таблицы
  columns: MiniColumn<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string
  empty: string                            // текст пустого состояния
  numbered?: boolean | undefined           // первая колонка «№» (22 px, моно, приглушённо)
  renderExpanded?: ((row: T) => ReactNode) | undefined
  expanded?: string[] | undefined          // управляемый режим (ключи rowKey)
  defaultExpanded?: string[] | undefined
  onExpandedChange?: ((keys: string[]) => void) | undefined
  toolbar?: ReactNode | undefined          // полоса над таблицей (.tbar): счётчик и кнопка
  rowLabel?: ((row: T, index: number) => string) | undefined // имя переключателя: «Раскрыть {rowLabel}» / «Свернуть {rowLabel}»; без него — «Раскрыть строку N»
}
// раскрываемая строка — не кнопка: переключатель — отдельная кнопка-шеврон в последней ячейке (aria-expanded, aria-controls);
// клик по свободному месту строки тоже переключает, по a/button внутри — нет; шапка не рисуется, если у всех колонок header === ''
// разметка — CSS grid с ролями table/row/columnheader/cell (не <table>), шаблон колонок — в --k-cols; header '' — пустая role="cell" в шапке (axe empty-table-header)
export function MiniTable<T>(props: MiniTableProps<T>): JSX.Element

// packages/ui/src/form/KeyValueList.tsx (Task 4), экспорт из form/index.ts
export type KeyValueItem = {
  key: string
  label: ReactNode
  value: ReactNode | null                  // null / '' — «—», для скринридера «не заполнено»
  mono?: boolean | undefined
  aside?: ReactNode | undefined            // справа: «16 симв.»
  hint?: string | undefined                // тултип подписи (название SWIFT-поля)
}
export type KeyValueListProps = {
  items: KeyValueItem[]
  title?: string | undefined               // полоса-заголовок группы (h6 эталона)
  labelWidth?: number | undefined          // px при плотности 1; по умолчанию 150
  columns?: 1 | 2 | undefined              // 2 — сетка .kvs (подпись, значение, подпись, значение)
}
export function KeyValueList(props: KeyValueListProps): JSX.Element

// packages/ui/src/form/ConfigForm.tsx (Task 4) — управляемое раскрытие (техдолг M-g)
// ConfigFormProps += { expanded?: string[] | undefined; onExpandedChange?: ((keys: string[]) => void) | undefined }
// ключи — id секций/групп, которые ConfigForm уже раскрывает; без пропсов — поведение 2a

// packages/ui/src/form/Disclosure.tsx (Task 4)
// DisclosureProps += { mono?: boolean | undefined /* заголовок моно 500 12, строка 25 (.ah) */; emptyText?: string | undefined /* вместо «нет данных» */ }

// packages/ui/src/code/CodeView.tsx (Task 5), новый модуль code/index.ts, экспорт из src/index.ts
export type CodeLanguage = 'json' | 'xml' | 'swift' | 'text'
export type CodeViewProps = { code: string; language: CodeLanguage; label: string }
export function CodeView(props: CodeViewProps): JSX.Element
// внутренние (экспорт только для тестов модуля): code/json.ts tokenizeJson, code/swift.ts tokenizeSwift, code/xml.ts layoutXml
export type CodeToken = { kind: string; text: string }
export type CodeLine = { depth: number; tokens: CodeToken[]; align?: number | undefined }
```

Уже есть и используется как есть: `Tag` (`tone: 'neutral' | 'opt' | 'mt' | 'warn' | 'ok'` — `mt` и есть `.tag.mt` эталона), `Disclosure`, `CopyValue`, `LinkValue`, `FieldTag`, `EmptyState`, `ErrorState`, `Skeleton`, `useLoadingGate`, `Button`, `Tooltip`.

### `apps/pi`

```ts
// shared/api/ports.ts (Task 6)
export type TabQuery = { id: string; tab: string }
export type TabParser = (raw: unknown, path: string) => unknown
export type TabPort = { tabFx: Effect<TabQuery, unknown, ApiError> }
export function createGridPorts<Row, D>(cfg: GridPortsConfig<Row> & { parseDetail: DetailParser<D>; parseTab: Record<string, TabParser> }): GridPorts<Row> & DetailPort<D> & TabPort
// GET `${base}/documents/${encodeURIComponent(id)}/tabs/${encodeURIComponent(tab)}`; вкладка без парсера → contractError до запроса

// shared/lib/detail/types.ts (Task 6)
export type TabContext = {
  docId: string                            // id открытого документа
  openDocument: (id: string) => void       // открыть в B (DrawerOpen { id, secondary: true })
  announce: (message: string) => void
  expanded: string[] | null                // null — пользователь не трогал: вид берёт свои умолчания
  setExpanded: (keys: string[]) => void
}
export type LocalTabView<D> = { kind: 'local'; render: (detail: D, ctx: TabContext) => ReactNode }
export type RemoteTabView = {
  kind: 'remote'
  render: (data: unknown, ctx: TabContext) => ReactNode
  skeletonRows?: number | undefined        // по умолчанию 4, у «Задач» 5
}
export type TabView<D> = LocalTabView<D> | RemoteTabView
export function remoteTab<T>(v: { render: (data: T, ctx: TabContext) => ReactNode; skeletonRows?: number | undefined }): RemoteTabView
// инвариант: data вкладки пришли через parseTab того же id — сущность держит парсеры и виды одной таблицей ключей (контрактный тест)
// DetailDomain<D, Row> += tabViews?: Record<string, TabView<D>> | undefined

// entities/doc-trail (Task 7 — model/api, Task 8–9 — ui), index.ts
export type StatusEvent = { at: string; route: string | null; code: string; reason: string | null }
export type Compliance = {
  record: { id: string; start: string | null; end: string | null; nzr: boolean | null }
  negative: { decision: string | null; direction: string | null; comment: string | null }
  monitoring: { start: string | null; end: string | null; decision: string | null; txId: string | null; requestAt: string | null; clientId: string | null }
  department: { start: string | null; end: string | null; decision: string | null }
  history: { at: string; system: string; department: string }[]
}
export type LinkedParty = { name: string | null; account: string | null; extra: string | null }
export type LinkedPosting = { account: string | null; amount: string | null; currency: string | null; register: string | null }
export type LinkedDoc = {
  docId: string; date: string; type: string; relation: string; purpose: string | null
  status: string; processed: string | null; posted: string | null; kind: string | null
  debit: LinkedPosting; credit: LinkedPosting; from: LinkedParty; to: LinkedParty
}
export type DocTask = { id: string; state: 'open' | 'done'; tone: 'ok' | 'info' | 'warn'; type: string; at: string; text: string; who: string | null; history: { at: string; text: string }[] }
export type DocNotification = { at: string; attempts: number; status: string; code: string }
export type StreamEvent = { at: string; system: string; destination: string; event: string; status: string; tries: number }
export type MpuMessage = { id: string; type: string; created: string; exportStatus: string; exported: string | null; receiver: string; docReference: string; docId: string; swift: string }
export type AuditSections = Record<string, Record<string, unknown>>
export type SourceTexts = Record<string, string>              // ключ → текст; '' — нет
export type TrailTabId = 'statuses' | 'compliance' | 'linked' | 'tasks' | 'notif' | 'source' | 'ed244' | 'stream' | 'mpu' | 'audit'
export function toneOf(code: string): BadgeTone                // ALLOW/OK/SENT/DONE/EXPORTED/PASSED → ok; REVIEW → wait; TIMEOUT/DENY/BLOCK/ERROR/FAILED/REJECTED/INVALID → bad; прочее → wait
export const TRAIL_PARSERS: Record<TrailTabId, TabParser>      // api/trail.mapper.ts
export const TRAIL_EXAMPLES: Record<TrailTabId, unknown>       // api/trail.example.ts — форма ответа бека, как в pi-api.md
export const TRAIL_VIEWS: Record<TrailTabId, RemoteTabView>    // ui/views.ts (Task 8–9)
// doc-trail/@x/fx-doc.ts, @x/rub-doc.ts (Task 7): TRAIL_PARSERS и TrailTabId для портов сущностей (подключает Task 10)
// tabsOff детали — id вкладок; «Комплаенс» всегда непуст
// виды: StatusesTab, ComplianceTab, TasksTab, NotificationsTab, StreamTab (Task 8); LinkedTab, MpuTab, AuditTab, SourceTab (Task 9)

// entities/fx-doc (Task 10)
export function ExtraTab(props: { detail: FxDocDetail }): JSX.Element
export const fxExtraView: LocalTabView<FxDocDetail>

// widgets/doc-detail/lib/createDetail.ts (Task 11)
// DetailConfig<D> += { tabFx?: Effect<TabQuery, unknown, ApiError> | undefined; localTabs?: string[] | undefined /* по умолчанию ['main'] */ }
export type TabSlot = { state: DetailSlotState; data: unknown; error: string | null }
// DetailSlot<D> += { tabView: TabSlot | null }   // null — активная вкладка локальная
// Detail<D> += {
//   retryTab: EventCallable<DrawerSlot>
//   $expanded: Store<Record<string, string[]>>   // ключ `${id}:${tab}`
//   setExpanded: EventCallable<{ id: string; tab: string; keys: string[] }>
// }
```

Фейк (`apps/pi/src/app/fake`, Task 6–7): маршрут `/grids/{gridId}/documents/{id}/tabs/{tab}`; данные — `trail.data.ts` (общие словари и генераторы), `fx-docs.trail.ts`, `rub-docs.trail.ts`; `?fail=tab` — 500 на любой вкладке, `?fail=tab:<id>` — только на вкладке `<id>`; `tabsOff` детали (`fx-docs.detail.ts`, `rub-docs.detail.ts`) считается по тем же генераторам: вкладка в `tabsOff` ⇔ её данные пусты.

---

## Карта файлов

```txt
packages/tokens/src/tokens.src.ts · tokens.css · tokens.ts                        — Task 3, 4, 5 (высоты строк 24/22/26, шрифты кода)
packages/ui/src/
  format/  time.ts · time.test.ts · index.ts                                       — Task 2
  value/   Timestamp.tsx · StatusBadge.tsx · Value.module.css · Timestamp.test.tsx · StatusBadge.test.tsx · index.ts — Task 2
  table/   MiniTable.tsx · MiniTable.module.css · MiniTable.test.tsx · index.ts    — Task 3
  form/    KeyValueList.tsx · Form.module.css · KeyValueList.test.tsx · ConfigForm.tsx · ConfigForm.test.tsx · index.ts — Task 4
  code/    CodeView.tsx · CodeView.module.css · json.ts · swift.ts · xml.ts · *.test.ts(x) · index.ts — Task 5
  grid/    Grid.module.css                                                         — Task 12 (Д28)
  index.ts                                                                         — Task 3, 5
CHANGELOG.md (корень)                                                              — Task 13
apps/pi/src/
  shared/api/  ports.ts · ports.test.ts · index.ts                                 — Task 6
  shared/lib/detail/  types.ts · remoteTab.ts · index.ts                           — Task 6
  app/fake/    server.ts · server.test.ts · params.ts · trail.data.ts · fx-docs.trail.ts · rub-docs.trail.ts
               fx-docs.detail.ts · rub-docs.detail.ts · contract.test.ts          — Task 6, 7
  entities/doc-trail/  model/types.ts · model/tone.ts · model/tone.test.ts
                       api/trail.mapper.ts · api/trail.mapper.test.ts · api/trail.example.ts   — Task 7
                       ui/StatusesTab.tsx · ComplianceTab.tsx · TasksTab.tsx · NotificationsTab.tsx · StreamTab.tsx
                       ui/trail.module.css · ui/tabs1.test.tsx                     — Task 8
                       ui/LinkedTab.tsx · MpuTab.tsx · AuditTab.tsx · SourceTab.tsx · ui/views.ts · ui/tabs2.test.tsx — Task 9
                       index.ts                                                    — Task 7–9
  entities/fx-doc/     model/extra.ts · ui/ExtraTab.tsx · ui/ExtraTab.test.tsx · model/detail.ts · api/detail.mapper.ts · api/ports.ts · index.ts — Task 10
  entities/rub-doc/    api/ports.ts                                                — Task 10
  widgets/doc-detail/  lib/createDetail.ts · lib/createDetail.test.ts · ui/DocDetail.tsx · ui/DocDetail.module.css · ui/DocDetail.test.tsx · index.ts — Task 11
  pages/fx-docs · pages/rub-docs  model/*.ts · ui/*.tsx                            — Task 12
  app/details.a11y.test.tsx                                                        — Task 12
apps/pi/e2e/  detail-tabs.spec.ts                                                  — Task 12
docs/reference/  detail-drift.md (раздел «2b») · pi-api.md                        — Task 1, 13
docs/guides/pi-usage.md                                                            — Task 13
docs/STATE.md · docs/superpowers/specs/*                                           — Task 1, 13
```

---

### Task 0: Проверка предусловий, worktree `detail-tabs`

**Files:** только чтение; создаётся worktree `katran/.worktrees/detail-tabs` (каталог `.worktrees/` в `.gitignore`).

**Interfaces:**
- Consumes: `main` со слиянием 2a (`fda9f91`) и спекой 2b (`f08e522`).
- Produces: ветка `feat/detail-tabs`, базовые числа тестов в леджере (на `f08e522`: `tokens` 16, `ui` 295, `effector` 49, `apps/pi` 135 — всего 495; e2e `apps/pi` 40/40).

- [ ] **Step 1: `main` содержит 2a и спеку 2b.**

```bash
cd /Users/shaman/_CODE/VTB/katran
git merge-base --is-ancestor fda9f91 main && git merge-base --is-ancestor f08e522 main && echo OK
git status --short
```

Expected: `OK`. `git status --short` пуст, кроме этого плана, если контроллер ещё не закоммитил его в `main` (план коммитит контроллер до Step 2; иначе план не попадёт в ветку). Если `fda9f91` или `f08e522` не предки `main` — **остановиться**: план идёт после 2a и спеки 2b.

- [ ] **Step 2: worktree и ветка.**

```bash
cd /Users/shaman/_CODE/VTB/katran
git worktree add .worktrees/detail-tabs -b feat/detail-tabs main
cd .worktrees/detail-tabs
git log --oneline -1
```

Expected: `Preparing worktree (new branch 'feat/detail-tabs')`, последний коммит — вершина `main`. Дальше все задачи — в `/Users/shaman/_CODE/VTB/katran/.worktrees/detail-tabs`; в основной checkout не коммитить.

- [ ] **Step 3: зависимости и проверка.**

```bash
cd /Users/shaman/_CODE/VTB/katran/.worktrees/detail-tabs
pnpm install
pnpm check
```

Expected: `pnpm install` без ошибок (lockfile не меняется: `git status --short` пуст); `pnpm check` зелёный — в выводе `packages/tokens test: Tests 16 passed`, `packages/ui test: Tests 295 passed`, `packages/effector test: Tests 49 passed`, `apps/pi test: Tests 135 passed`, `ES-Check passed`, `CSS: синтаксиса новее chrome >= 88 нет`. Числа — в леджер как базу. Если числа другие (в `main` успело попасть что-то ещё) — записать фактические и считать от них; если `check` красный — остановиться.

- [ ] **Step 4: e2e на переднем плане.** `pnpm --filter pi e2e` (в фоне не запускать, дождаться) — `40 passed`. Число — в леджер.

- [ ] **Step 5: сверка имён, на которые опираются Task 1–3.** Открыть и убедиться, что совпадает (если нет — записать в леджер фактическое имя и использовать его во всех задачах):
  - `packages/ui/src/compat/useStableId.ts` — `export const useStableId: () => string`;
  - `packages/ui/src/tooltip/TooltipLayer.tsx` — тултип кита по атрибуту `data-k-tip` (делегирование `pointerover`/`focusin` с корня провайдера), `data-k-tip-if="truncated"` — только при обрезке;
  - `packages/ui/src/value/Tag.tsx` — `tone: 'neutral' | 'opt' | 'mt' | 'warn' | 'ok'` (`mt` — это «`Tag mono`» спеки §2: моно 600, как `.tag.mt` эталона; нового варианта план не вводит);
  - `packages/ui/src/value/Value.module.css` — последнее правило файла `.none`; `packages/ui/src/form/Form.module.css` — класс `.sr` (скрытый текст);
  - `packages/tokens/src/tokens.src.ts` — в `sizes` последняя строка `'dt-dir': 62, … 'dt-label-l': 250,`; есть `fs-1` 12.5, `fs-2` 11, `fs-3` 10.5, `lh-1` 17, `lh-2` 14, `lh-3` 13, `fs-pre` 11.5, `r-s` 4, `sp-2` 8; цвета `ok-soft`, `bad-soft`, `warn-soft`, `chip`, `st-ok`, `st-bad`, `st-warn`, `st-grey`;
  - `packages/tokens/src/contrast.rules.ts` — правило `{ fg: 'ink2', bg: ['warn-soft', 'ok-soft'], min: 4.5, note: 'тег роли на подсветке' }`;
  - `packages/tokens/src/generate.test.ts` — тест «`«Общие данные» деталки: строка поля 27, …`»;
  - корневой `package.json` — `gen:check` = `pnpm gen && git diff --exit-code -- packages/tokens/src/tokens.css packages/tokens/src/tokens.ts` (сравнение с **индексом**: сгенерированные токены добавлять в индекс до `pnpm check`, см. Task 2–3);
  - CHANGELOG кита — корневой `CHANGELOG.md` (файла `packages/ui/CHANGELOG.md` нет; карта файлов плана называет его для Task 13 — писать в корневой).
- [ ] **Step 6: стенд.** `git -C /Users/shaman/_CODE/VTB/pi-constructor log --oneline -1` — `e065bfb Стенд: новый пароль заглушки`; `git -C /Users/shaman/_CODE/VTB/pi-constructor status --short` — пусто (рабочая копия равна эталону). Иначе — остановиться: замер Task 1 идёт только по `e065bfb`.

---

### Task 1: Замер вкладок эталона, раздел «2b» в `detail-drift.md`, решения В-Д6 и R13

**Files:**
- Modify: `docs/reference/detail-drift.md` (сводка, строки Д26 и Д29, «Вопросы владельцу», «Не проверено», раздел «2b–2d» → «2b» + «2c–2d»)
- Modify: `docs/STATE.md` (§6 «Открытые решения владельца», §7 «Сверка, класс D» и «Esc и наложения», §9, §10 строка деталки)
- Create (временно, удаляются в этой же задаче): `apps/pi/e2e-stand/playwright.config.ts`, `apps/pi/e2e-stand/stand.spec.ts`

**Interfaces:**
- Produces: числа эталона `REF` для e2e Task 12 и токенов Task 2–5. Значения, полученные прогоном этого же скрипта при написании плана (Chromium headless 1600×1000, `pi-zoom=1`, `e065bfb`; Task 1 их подтверждает или заменяет): **шапка таблицы `.tt .th` 22**, **строка `.tt .tr` 24** (Статусы, Нотификации, история Комплаенса, мини-таблицы «Связанных»), **строка Стриминга 33.4** (не 24: колонка «ИС куда» 90 px переносит «Шина сообщений» на две строки — высота по содержимому, минимум 24), **строка «ключ–значение» `.xr` 24** (Доп. поля, Комплаенс), **заголовок группы `h6` 24**, **раскрываемые строки `.ld` 26 и `.tk` 26**, **полоса `.tbar` 26**, **заголовок аккордеона `.au .ah` 25** (Аудит, Исходный текст, MPU, ED244), **код `pre` / `pre.sw` 11.5 / 16.675** (строка XML `.sw.xml .xl` 16.7), **бейдж `.st` 18** (10.5 px, `padding` 2 / 7, радиус 10, точка `::before` 6 × 6, отступ точки 5; в Комплаенсе `.xr .kv .st` — 10 px, высота 17), **№ `.tt .n`** — моно 11, `faint`; шапка — 600 10.5, `letter-spacing` 0.525 px (0.05em), прописные.
- Produces: решения владельца 30.09 — В-Д6 «а» (Д29 → класс C), R13 «закрывает деталку» — записаны в `detail-drift.md` и STATE; раздел «2b» сверки — пункты Д31–Д42 (все класса C, известны заранее по спеке §6 и решениям Task 2–3).
- Consumes: стенд `/Users/shaman/_CODE/VTB/pi-constructor` на `e065bfb` (Task 0 Step 6); `@playwright/test` из `apps/pi`.

- [ ] **Step 1: хеши.** `git -C /Users/shaman/_CODE/VTB/pi-constructor log -1 --format='%h %ci'` — `e065bfb 2026-09-28 18:38:28 +0300`; `git log -1 --format='%h %ci'` в worktree — хеш `feat/detail-tabs` до кода 2b (в леджер, идёт в шапку раздела «2b»).
- [ ] **Step 2: замер эталона.** Создать `apps/pi/e2e-stand/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

// Временный конфиг Task 1 плана 2b: замер вкладок деталки стенда. Удаляется в этой же задаче.
export default defineConfig({
  testDir: '.',
  timeout: 90_000,
  use: { baseURL: 'http://localhost:5187', viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 },
  webServer: {
    command: 'python3 -m http.server 5187 --directory /Users/shaman/_CODE/VTB/pi-constructor',
    url: 'http://localhost:5187/index.html',
    reuseExistingServer: false,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
```

и `apps/pi/e2e-stand/stand.spec.ts` (конструктор `index.html`: `#dw0` — первый документ семейства, у валютного `tabsOff` пуст и все вкладки с данными; сегмент «Вкладка» `[data-tabs]` переключает вкладку у всех drawer'ов, index.html:555–568, 1523; заглушка доступа `gate.js` на `localhost` не включается):

```ts
import { test, type Page } from '@playwright/test'

// скелетон вкладки держится 700 мс (tabLoad, index.html:1275) — ждём 1000
const r1 = (n: number) => Math.round(n * 10) / 10
async function h(page: Page, sel: string): Promise<number | null> {
  const loc = page.locator(sel)
  if ((await loc.count()) === 0) return null
  const b = await loc.first().boundingBox()
  return b ? r1(b.height) : null
}
async function css(page: Page, sel: string, props: string[], pseudo?: string): Promise<Record<string, string> | null> {
  const loc = page.locator(sel)
  if ((await loc.count()) === 0) return null
  return loc.first().evaluate((el, [ps, pe]) => {
    const cs = getComputedStyle(el, (pe as string | undefined) ?? null)
    return Object.fromEntries((ps as string[]).map((p) => [p, cs.getPropertyValue(p)]))
  }, [props, pseudo] as const)
}
async function tab(page: Page, id: string) {
  await page.click(`[data-tabs="${id}"]`)
  await page.waitForTimeout(1000)
}
const D = '#dw0'

test('замер вкладок деталки стенда (2b)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pi-zoom', '1'))
  await page.goto('/index.html')
  await page.locator(`${D} .tabs`).waitFor()
  const out: Record<string, unknown> = {}

  await tab(page, 'statuses')
  out.statuses = {
    th: await h(page, `${D} .tt .th`), tr: await h(page, `${D} .tt .tr`),
    n: await css(page, `${D} .tt .n`, ['font-size', 'font-family', 'color']),
    tm: await css(page, `${D} .tt .tm`, ['font-size', 'line-height']),
    thFont: await css(page, `${D} .tt .th`, ['font-size', 'font-weight', 'letter-spacing', 'text-transform']),
  }
  await page.screenshot({ path: test.info().outputPath('stand-statuses.png') })
  await tab(page, 'extra')
  out.extra = { xr: await h(page, `${D} .xg .xr`), h6: await h(page, `${D} .xg h6`) }
  await tab(page, 'compliance')
  out.compliance = {
    xr: await h(page, `${D} .xg.cp-kv .xr`), h6: await h(page, `${D} .xg.cp-kv h6`),
    histTr: await h(page, `${D} .xg.cp-kv .tt .tr`),
    st: await h(page, `${D} .xg.cp-kv .st`),
    stCss: await css(page, `${D} .xg.cp-kv .st`, ['font-size', 'font-weight', 'padding-top', 'padding-left', 'border-top-left-radius', 'line-height']),
  }
  await tab(page, 'tasks')
  out.tasks = { tbar: await h(page, `${D} .tbar`), tk: await h(page, `${D} .tk`) }
  await page.screenshot({ path: test.info().outputPath('stand-tasks.png') })
  await tab(page, 'stream')
  out.stream = {
    tr: await h(page, `${D} .tt .tr`), st: await h(page, `${D} .tt .st`),
    stCss: await css(page, `${D} .tt .st`, ['font-size', 'font-weight', 'padding-top', 'padding-left', 'border-top-left-radius', 'line-height', 'letter-spacing']),
    stDot: await css(page, `${D} .tt .st`, ['width', 'height', 'margin-right'], '::before'),
  }
  await tab(page, 'notif')
  out.notif = { tbar: await h(page, `${D} .tbar`), tr: await h(page, `${D} .tt .tr`) }
  await tab(page, 'linked')
  out.linked = {
    ld: await h(page, `${D} .ld`), ldOpen: await h(page, `${D} .ld.open`),
    ldbTr: await h(page, `${D} .ldb .tt .tr`), ldbTh: await h(page, `${D} .ldb .tt .th`),
  }
  await page.screenshot({ path: test.info().outputPath('stand-linked.png') })
  await tab(page, 'audit')
  out.audit = { ah: await h(page, `${D} .au .ah`), pre: await css(page, `${D} .au pre`, ['font-size', 'line-height']) }
  await tab(page, 'source')
  out.source = { ah: await h(page, `${D} .au .ah`), sw: await css(page, `${D} pre.sw`, ['font-size', 'line-height']) }
  await tab(page, 'mpu')
  out.mpu = { ah: await h(page, `${D} .au .ah`) }
  console.log(`STAND fx: ${JSON.stringify(out)}`)

  // рубль: #dw0 становится первым рублёвым документом (setFamily, index.html:1509)
  await page.click('[data-family="rub"]')
  await page.waitForTimeout(300)
  const rub: Record<string, unknown> = {}
  await tab(page, 'ed244')
  rub.ed244 = { ah: await h(page, `${D} .au .ah`), xl: await h(page, `${D} .sw.xml .xl`), xlCss: await css(page, `${D} .sw.xml .xl`, ['font-size', 'line-height']) }
  await page.screenshot({ path: test.info().outputPath('stand-ed244.png') })
  await tab(page, 'statuses')
  rub.statuses = { tr: await h(page, `${D} .tt .tr`) }
  console.log(`STAND rub: ${JSON.stringify(rub)}`)
})
```

Run: `cd apps/pi && pnpm exec playwright test -c e2e-stand/playwright.config.ts --reporter=line`
Expected: `1 passed`, две строки (значения — как при написании плана):

```txt
STAND fx: {"statuses":{"th":22,"tr":24,"n":{"font-size":"11px","font-family":"\"IBM Plex Mono\", ui-monospace, Menlo, Consolas, monospace","color":"rgb(124, 132, 150)"},"tm":{"font-size":"11.5px","line-height":"normal"},"thFont":{"font-size":"10.5px","font-weight":"600","letter-spacing":"0.525px","text-transform":"uppercase"}},"extra":{"xr":24,"h6":24},"compliance":{"xr":24,"h6":24,"histTr":24,"st":17,"stCss":{"font-size":"10px","font-weight":"600","padding-top":"2px","padding-left":"7px","border-top-left-radius":"10px","line-height":"normal"}},"tasks":{"tbar":26,"tk":26},"stream":{"tr":33.4,"st":18,"stCss":{"font-size":"10.5px","font-weight":"600","padding-top":"2px","padding-left":"7px","border-top-left-radius":"10px","line-height":"normal","letter-spacing":"0.21px"},"stDot":{"width":"6px","height":"6px","margin-right":"5px"}},"notif":{"tbar":26,"tr":24},"linked":{"ld":26,"ldOpen":26,"ldbTr":24,"ldbTh":22},"audit":{"ah":25,"pre":{"font-size":"11.5px","line-height":"16.675px"}},"source":{"ah":25,"sw":{"font-size":"11.5px","line-height":"16.675px"}},"mpu":{"ah":25}}
STAND rub: {"ed244":{"ah":25,"xl":16.7,"xlCss":{"font-size":"11.5px","line-height":"16.675px"}},"statuses":{"tr":24}}
```

Скриншоты `stand-statuses.png`, `stand-tasks.png`, `stand-linked.png`, `stand-ed244.png` — в `apps/pi/test-results/…/` (для сверки вида в Task 12; каталог в `.gitignore`, скопировать в леджер). Если число расходится с «Interfaces» больше чем на 0.5 px — в документ записать фактическое, в леджер — пометку для задачи, которая вводит токен (Task 3 — `tt-*`, Task 2 — `badge-*`, Task 4 — `kv-row`, `ah-row`, Task 5 — строка кода) и для e2e Task 12.
- [ ] **Step 3: убрать временное.** `rm -r apps/pi/e2e-stand`; `git status --short` не показывает `apps/pi/e2e-stand` (результаты — в `apps/pi/test-results`, git-ignored).
- [ ] **Step 4: решения владельца в `docs/reference/detail-drift.md`.** Точечные правки (старый текст → новый):
  1. В «Сводке» строку класса C

     `` | C | 25 | разведение жестов в `DataGrid`, стек без дублей, плотность вместо zoom, действия-заглушки, контраст меток и статусов, фокус при открытии и закрытии, Esc из ячейки грида, пункты по решениям владельца В-Д1…В-Д4 (Д7, Д18, Д19, Д14); решение В-Д5 (токены `dt-*`) — о раскладке кита, пункта сверки у него нет | ``

     заменить на

     `` | C | 26 | разведение жестов в `DataGrid`, стек без дублей, плотность вместо zoom, действия-заглушки, контраст меток и статусов, фокус при открытии и закрытии, Esc из ячейки грида (R13), пункты по решениям владельца В-Д1…В-Д4 и В-Д6 (Д7, Д18, Д19, Д14, Д29); решение В-Д5 (токены `dt-*`) — о раскладке кита, пункта сверки у него нет | ``
  2. Строку `| вопрос | 1 | Д29 — ширина drawer растёт с плотностью, при 125 % B уходит за левый край окна уже 2000 px: вопрос владельцу В-Д6, класс до ответа не присвоен |` заменить на `| вопрос | 0 | — (В-Д6 и R13 решены 30.09) |`.
  3. В строке **Д26** последнюю ячейку `Спека 2a §3.1 («Esc закрывает верхний drawer, кроме полей ввода, меню и поповеров»); поведение совпадает с эталоном` дополнить: `; решено 30.09 (R13): Esc в ячейке грида при открытой деталке закрывает верхний drawer по стеку наложений — как сейчас`.
  4. В строке **Д29** колонку «Кл.» `В-Д6` заменить на `C`, последнюю ячейку — на `Решено 30.09: «а» — как сейчас (В-Д6): ширина drawer растёт с плотностью; при 125 % на окне уже 2000 px B уходит за левый край — принято`.
  5. Пункт `- **В-Д6.** Открыт (Д29). …` заменить целиком на: `` - **В-Д6.** Решено 2026-09-30: вариант «а» — как сейчас. Ширина drawer масштабируется вместе с плотностью (при 125 % — 1000 px, A и B вместе — 2000 px; на окне уже 2000 px B уходит за левый край) — так же по коду и на эталоне с `zoom`. Токен `drawer` и `DrawerStack` не меняются. Д29 — класс C. `` и сразу после него добавить пункт: `- **R13** (журнал исполнения 2a, финальное ревью M-a). Решено 2026-09-30: «закрывает деталку». Esc в ячейке грида при открытой деталке (а после В-Д4 она открыта почти всегда) закрывает верхний drawer по стеку наложений, а не возвращает фокус в ячейку — как сейчас; без деталки Esc, как прежде, возвращает фокус в ячейку (Д26). Пункт уходит из техдолга STATE §7 в решения.`
  6. В «Не проверено» пункт `` - Экраны 2b–2d — сверяются в начале своих подсрезов против того же коммита `e065bfb`. `` заменить на `` - Экраны 2c–2d — сверяются в начале своих подсрезов против того же коммита `e065bfb`; 2b — раздел «2b» ниже. ``
- [ ] **Step 5: раздел «2b» в `docs/reference/detail-drift.md`.** Последний раздел документа — заголовок `## 2b–2d — сверяются в начале своих подсрезов против того же коммита` и абзац под ним — заменить целиком на текст ниже (числа замера — фактические из Step 2; `<хеш>` и `<дата>` — из Step 1):

```md
## 2b — остальные вкладки

Сверка вкладок деталки (спека `docs/superpowers/specs/2026-09-30-katran-detail-tabs-design.md`) с тем же замороженным эталоном. Составлена до кода (Task 1 плана 2b); колонка «katran (план 2b)» — что даст план, в факт переводится Task 13.

| | |
|---|---|
| Эталон | `pi-constructor`, `index.html`, коммит **`e065bfb`**, 2026-09-28 18:38:28 +0300 (тот же, что у 2a) |
| katran | Сверка до кода — `feat/detail-tabs` = **`<хеш>`**, `<дата>` (план 2b принят, кода вкладок нет) |
| Дата сверки | 2026-09-30 (до кода) |
| Метод | 1) код стенда: `index.html` — моки вкладок (767–920; рублёвые — `rubDoc`, 874–886), `mkui` (925, раскрытое по умолчанию), `tmHtml`/`ms`/`dur`/`codeHtml` (1157–1160), `statusesHtml`, `tasksHtml`, `streamHtml`, `notifHtml`, `jsonHtml`, `auditHtml`, `linkedHtml`, `swiftHtml`, `xmlHtml` (`XML_LINE=92`), `sourceHtml`, `mpuHtml`, `complianceHtml` (1161–1272), `TAB_LOCAL`/`tabLoad`/`viewHtml` (1273–1299), `xtabHtml` + `XTAB` (1073–1081, 652–667); CSS `.st` (105–107), `.xg`/`.xr` (281–291), `.tt`/`.tbar`/`.tk`/`.au`/`.ld`/`.ldb`/`.kvs`/`.sw` (299–363); `skeleton.js` (`tabBody`, 37–46); 2) спека 2b §1–§6; 3) замер: Playwright 1.63, Chromium headless, 1600 × 1000, `deviceScaleFactor` 1, `pi-zoom=1`, `python3 -m http.server 5187` на `e065bfb`, конструктор `index.html` (`#dw0`, сегмент «Вкладка»), временный `apps/pi/e2e-stand/` удалён после замера |

**Классы** — как в 2a (раздел выше).

### Сводка 2b

| Класс | Пунктов | Что это |
|---|---|---|
| A | 0 | стенд после `e065bfb` не менялся |
| B | 0 | — |
| C | 12 | чистые данные рубля, `tabsOff` по данным, настоящий запрос вкладки с воротами скелетона, ошибка вкладки, «Связанный» в B, недоступная вкладка не рисуется, бейдж на контрасте, формат времени и Δ, кегль 12 → 12.5, раскрытие строк с клавиатуры, тултипы кита |
| D | 0 | кода ещё нет |

### Замер эталона 2b

| Величина | Селектор эталона | Эталон | Токен кита (план) |
|---|---|---|---|
| Шапка таблицы | `.tt .th` | 22 | `tt-head` 22 (Task 3) |
| Строка таблицы | `.tt .tr` (Статусы, Нотификации, история Комплаенса, рубль — Статусы) | 24 | `tt-row` 24 (Task 3) |
| Строка Стриминга | `.tt .tr` | 33.4 — «Шина сообщений» в колонке «ИС куда» 90 px переносится на две строки | высота по содержимому, минимум `tt-row` |
| Мини-таблицы «Связанных» | `.ldb .tt .th` / `.ldb .tt .tr` | 22 / 24 | `tt-head` / `tt-row` |
| Раскрываемая строка | `.ld` (свёрнутая и раскрытая), `.tk` | 26 / 26 | `tt-row-x` 26 (Task 3) |
| Полоса над таблицей | `.tbar` (Задачи, Нотификации) | 26 | `tt-row-x` (Task 3) |
| Строка «ключ–значение» | `.xg .xr` (Доп. поля), `.xg.cp-kv .xr` (Комплаенс) | 24 | `kv-row` 24 (Task 4) |
| Заголовок группы | `.xg h6` | 24 | Task 4 |
| Заголовок аккордеона | `.au .ah` (Аудит, Исходный текст, MPU, ED244) | 25 | `ah-row` 25 (Task 4) |
| Код | `.au pre`, `pre.sw` | 11.5 / 16.675 | Task 5 |
| Строка XML | `.sw.xml .xl` (рубль, ED244) | 16.7 | Task 5 |
| Бейдж | `.tt .st` (Стриминг) | 18: 600 10.5, `padding` 2 / 7, радиус 10, точка 6, отступ точки 5, `letter-spacing` 0.02em | `badge-*`, `r-badge`; 600 `fs-3` / `lh-2` → 18 (Task 2) |
| Бейдж в «ключ–значение» | `.xr .kv .st` (Комплаенс) | 17 (10 px) | один кегль 10.5 → 18 (Д37) |
| № строки | `.tt .n` | моно 11, `faint` | `tt-num` 22, `fs-2`, `faint` (Task 3) |
| Время | `.tt .tm` | моно 11.5, `line-height: normal` | `fs-pre` / `lh-1` (Task 2) |

### Таблица сверки 2b

| № | Эталон | katran (план 2b) | Кл. | Решение |
|---|---|---|---|---|
| Д31 | Рубль: Статусы, Задачи, Стриминг, Нотификации, Аудит, Комплаенс — копия валютного документа с заменой кодов (`rubDoc`, 874–886: `fx-` → `fx-rub-`, `RT_FX_IN` → сценарий); «Связанные» и MPU рубля всегда пусты | Свои данные рубля в фейке: RUB, счета `40702810…`/`30102810…`, сценарии `SC_NCB_*`, события `rub_evt_*`; «Связанные» и MPU бывают непустыми (Task 7) | C | Спека 2b §3.5, решение владельца 30.09 |
| Д32 | `tabsOff` — ручной массив в моке (`tabsOff:['Нотификации','Стриминг','MPU']`), с данными не связан | `tabsOff` детали считается фейком по тем же генераторам: вкладка в `tabsOff` ⇔ её данные пусты (Task 7) | C | Спека 2b §3.5 |
| Д33 | Вкладка — скелетон ровно 700 мс на каждое переключение, данные уже в памяти (`tabLoad`, 1275–1281) | Настоящий запрос `tabFx` на вкладку, скелетон — ворота кита 200 / 400 мс (`useLoadingGate`), кэш `id:tab` до ухода с экрана — повторное открытие не перезапрашивает (Task 11) | C | Спека 2b §3.3, §6 |
| Д34 | Состояния ошибки вкладки нет | `ErrorState` с текстом `ApiError` и «Повторить» (`retryTab`); ошибка вкладки не трогает шапку, лейн и другие вкладки (Task 11) | C | Спека 2b §3.3, §6 |
| Д35 | ID связанного документа — `a.lnk mono` без действия и кнопка «⧉» (`linkedHtml`) | Ссылка-кнопка «Открыть … в соседней панели» открывает документ в B, `CopyValue` рядом (Task 9, 12) | C | Спека 2b §4, решение владельца 30.09 |
| Д36 | Сегмент «Вкладка» конструктора (`index.html:555–568`) рисует и вкладку из `tabsOff` | Вкладка из `tabsOff` не рендерится ни при каких условиях (в деталке — только в группе недоступных, как 2a) | C | Спека 2b §6 |
| Д37 | Бейдж `.st` — текст цветом тона на мягкой подложке (`ok`/`warn` на своих `-soft` — 4.17 / 4.26, ниже 4.5); в «ключ–значение» Комплаенса — 10 px вместо 10.5 | `StatusBadge`: текст `ink2` на всех тонах, тон несут подложка и точка (`st-ok`/`st-bad`/`st-warn`, у `neutral` — `st-grey` на `chip`); один кегль 10.5, высота 18 (Task 2) | C | Контраст (основная спека §9), как Д11/Д13 |
| Д38 | Время `tmHtml`: цифры строки регуляркой, тултип — исходная строка бека (`data-tip="2026-09-22 07:31:45.241"`), доли секунды — сколько есть (до 3 знаков) | `formatTimestamp`/`Timestamp`: так же цифры строки без пересчёта зоны (хвост `Z`/смещение допускается и игнорируется); тултип — «ДД.ММ.ГГГГ ЧЧ:ММ:СС.ммм»; доли — ровно 3 знака (`.5` → `.500`); не ISO — текст как есть, пусто — «—» (Task 2) | C | Спека 2b §2 |
| Д39 | Δ статусов `dur()`: «1.2 с» (точка, `toFixed(1)` — 59 960 мс даёт «60.0 с»), «3 мин» (округление), «1.5 ч»; порог «медленно» 30 с зашит в `statusesHtml` | `formatDuration`: «850 мс», «4,2 с» (запятая, без округления вверх: 59 999 → «59,9 с»), «3 мин 5 с», «2 ч 10 мин»; разница меток — `timestampDiff`; порог «медленно» задаёт вид вкладки (Task 2, 8) | C | Контракт 2b (сквозной контракт плана) |
| Д40 | Кегль пустого состояния, причины статуса, кода, подписей `.kvs` — 12 px | Токен `fs-1` 12.5 (пустое состояние `MiniTable`, ячейки таблицы) | C | Типографика токенами, как Д21 |
| Д41 | Раскрываемые строки `.ld`/`.tk` — `div` с обработчиком клика, без фокуса и `aria-expanded`; клик по ссылке «История» внутри строки тоже раскрывает её | `MiniTable`: кнопка-шеврон в последней ячейке с `aria-expanded`/`aria-controls`, имя «Раскрыть/Свернуть {строка}», Enter/Space; клик по свободному месту строки переключает, по ссылке или кнопке внутри — нет (Task 3) | C | Спека 2b §4, a11y кита |
| Д42 | Подсказки — CSS-псевдоэлемент `[data-tip]::after` и атрибут `title` (причина статуса, назначение) | Тултип кита `data-k-tip` (один слой на провайдер, Esc прячет, клавиатура — по фокусу) | C | Механизм кита, спека 2a §3.1 |

### Не проверено (2b)

- Содержимое вкладок числом, кроме высот строк: ширины колонок таблиц берутся из `grid-template-columns` эталона (Task 8–9) и замером не подтверждаются.
- Раскрытая строка «Задач» (`.tk.open`) и панели «Связанных» (`.ldb`) по высоте — зависят от содержимого.
- Тёмная тема — эталон её не проверяет.

## 2c–2d — сверяются в начале своих подсрезов против того же коммита

Части деталки, не входящие в 2a и 2b (спека 2a §1.2: правка, аудит, саджест, `Prompt`, `DateInput`, перезапрос реестра — 2c; настоящие действия лейна и кнопок вкладок вместе с эндпоинтами — 2d), сверяются с эталоном отдельно, каждая в начале своего подсреза, против того же замороженного коммита `e065bfb` (деталка заморожена целиком, решение владельца 29.09 — STATE §10). Этот документ их не описывает.
```

  Если замер Step 2 дал другие числа — поправить столбец «Эталон» в «Замере эталона 2b» и (при расхождении больше 0.5 px) — пометку в «Токен кита (план)».
- [ ] **Step 6: STATE.** В `docs/STATE.md`:
  1. §6 — пункт `- **Открытые решения владельца (30.09):** В-Д6 — … Работу не блокируют; нужны к 2b.` заменить целиком на: `` - **Решения владельца (30.09):** В-Д6 — «а»: ширина drawer растёт с плотностью, как сейчас (Д29 — класс C, `docs/reference/detail-drift.md`); R13 — «закрывает деталку»: Esc в ячейке грида при открытой деталке закрывает верхний drawer по стеку наложений, как сейчас (пункт снят из §7 «Esc и наложения»). Открытых решений владельца нет. ``
  2. §7, пункт «**Сверка, класс D**»: предложение `Открытый вопрос владельцу — В-Д6 (Д29): ширина drawer растёт с плотностью, при 125 % B уходит за левый край окна уже 2000 px.` заменить на `В-Д6 решён 30.09 («а», Д29 — класс C).`
  3. §7, пункт «**Esc и наложения:**»: хвост `; Esc в гриде при постоянно открытой деталке (В-Д4) закрывает её, а не возвращает фокус в ячейку — вопрос владельцу (R13, финальное ревью M-a).` заменить на `. Esc в гриде при открытой деталке закрывает её — решение владельца R13 от 30.09 (§6), не долг.`
  4. §9, пункт 1: `` (`detail-drift.md`, раздел «2b–2d») `` → `` (`detail-drift.md`, раздел «2b») ``; предложение `До начала — спросить владельца про В-Д6 и R13 (§6).` заменить на `` Решения В-Д6 («а») и R13 («закрывает деталку») приняты 30.09 (§6). Спека — `docs/superpowers/specs/2026-09-30-katran-detail-tabs-design.md`, план — `docs/superpowers/plans/2026-09-30-katran-detail-tabs.md` (ветка `feat/detail-tabs`, worktree `katran/.worktrees/detail-tabs`); замер вкладок эталона — `detail-drift.md`, раздел «2b» (Task 1). ``
  5. §10, строка «Деталка валюты и рубля (`index.html`)»: `Д29 — открытый вопрос В-Д6; 2b–2d сверяются в начале своих подсрезов против того же коммита` заменить на `Д29 — C по решению В-Д6 «а» (30.09); 2b — раздел «2b» (замер вкладок: таблица 24, шапка 22, «ключ–значение» 24, раскрываемая строка 26, аккордеон 25, бейдж 18; C 12, Task 1 плана 2b); 2c–2d сверяются в начале своих подсрезов против того же коммита`.

  Проверка: `grep -n "В-Д6\|R13" docs/STATE.md docs/reference/detail-drift.md` — ни одного «открыт»/«вопрос владельцу» у В-Д6 и R13; `grep -c "^| Д3[1-9]\|^| Д4[0-2]" docs/reference/detail-drift.md` — `12`.
- [ ] **Step 7: проверка и commit.** `pnpm lint` — зелёный (после удаления `e2e-stand`; документы линт не трогает). `git status --short` — только два документа.

```bash
git add docs/reference/detail-drift.md docs/STATE.md
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "Сверка 2b: замер вкладок эталона e065bfb, раздел «2b» в detail-drift (Д31–Д42, класс C); решения владельца В-Д6 «а» и R13 «закрывает деталку»"
```

---

### Task 2: Кит — `formatTimestamp`, `formatDuration`, `Timestamp`, `StatusBadge`

**Files:**
- Create: `packages/ui/src/format/time.ts`, `packages/ui/src/value/Timestamp.tsx`, `packages/ui/src/value/StatusBadge.tsx`
- Test: `packages/ui/src/format/time.test.ts`, `packages/ui/src/value/Timestamp.test.tsx`, `packages/ui/src/value/StatusBadge.test.tsx`, `packages/tokens/src/generate.test.ts` (одна проверка)
- Modify: `packages/ui/src/format/index.ts`, `packages/ui/src/value/index.ts`, `packages/ui/src/value/Value.module.css` (дописать в конец), `packages/tokens/src/tokens.src.ts` (+ `pnpm gen`: `tokens.css`, `tokens.ts`), `packages/tokens/src/contrast.rules.ts`

**Interfaces:**
- Consumes: тултип кита — атрибут `data-k-tip` (`tooltip/TooltipLayer.tsx`: делегирование `pointerover`/`focusin` с корня провайдера, Esc прячет); токены `fs-pre`, `lh-1`, `lh-2`, `fs-3`, цвета `ink`, `ink2`, `faint`, `ok-soft`, `bad-soft`, `warn-soft`, `chip`, `st-ok`, `st-bad`, `st-warn`, `st-grey`; `renderK` (`test/renderK.tsx`).
- Produces (экспорт `@katran/ui`), ровно по сквозному контракту плюс одна функция:

```ts
type TimestampParts = { date: string; time: string; ms: string; full: string }
formatTimestamp(iso: string): TimestampParts | null
formatDuration(ms: number): string
timestampDiff(from: string, to: string): number | null     // сверх контракта: разница меток для Δ статусов (Task 8)
type TimestampProps = { iso: string }
Timestamp(props: TimestampProps): JSX.Element
type BadgeTone = 'ok' | 'bad' | 'wait' | 'neutral'
type StatusBadgeProps = { tone: BadgeTone; children: ReactNode }
StatusBadge(props: StatusBadgeProps): JSX.Element
```

  Правила (фиксируются тестами):
  - **`formatTimestamp`** — настенное время: бек отдаёт время вкладок ISO без зоны с миллисекундами (`2026-09-22T07:31:45.241`, иногда без долей). Разбор регуляркой, **без `new Date()` и без пересчёта зоны** — берутся цифры строки (как `tmHtml` эталона). Разделитель — `T` или пробел; хвост зоны (`Z`, `±ЧЧ:ММ`, `±ЧЧММ`) допускается и **не пересчитывается**. Месяц 1–12, день 1–31, час 0–23, минуты и секунды 0–59, иначе `null`. Доли — ровно три знака (`.5` → `500`, `.051765` → `051`, без округления). `full` — `ДД.ММ.ГГГГ ЧЧ:ММ:СС.ммм`, без `.ммм`, если долей нет. Не ISO (пусто, «—», только дата, `22.09.2026 07:31:45`, мусор вокруг) — `null`.
  - **`timestampDiff(from, to)`** — `to − from` в мс по тем же цифрам строк (`Date.UTC` из частей, зона не учитывается); `null`, если одна из меток не разобралась. Нужна Task 8 для Δ статусов (эталон `ms()`/`dur()`, index.html:1158–1159) — без неё вид вкладки разбирал бы время второй раз. Добавление к контракту, имён контракта не меняет.
  - **`formatDuration(ms)`** (эталон `dur()`, index.html:1159; формат — по контракту плана, расхождения с эталоном — Д39): вход округляется до целых мс; `< 1000` — `'N мс'` (`0 мс`, `999 мс`); `< 60 000` — секунды с одним знаком через запятую, **отбрасыванием** (`1000` → `1,0 с`, `4249` → `4,2 с`, `59 999` → `59,9 с`, не «60,0 с»); `< 3 600 000` — `'M мин S с'`, ноль секунд не пишется (`60 000` → `1 мин`, `185 000` → `3 мин 5 с`, `3 599 999` → `59 мин 59 с`); дальше — `'H ч M мин'`, ноль минут не пишется (`3 600 000` → `1 ч`, `7 800 000` → `2 ч 10 мин`; сутки не выделяются: `26 ч 3 мин`). Отрицательное, `NaN`, `±Infinity` — `''` (эталон Δ не показывает). Порог «медленно» (`.slow`) — у вызывающего.
  - **`Timestamp`** — `<time dateTime={iso}>` с классом `tm`: `ДД.ММ ` + `<b>ЧЧ:ММ:СС</b>` + `<span>.ммм</span>` (доли — `faint`), `data-k-tip` — `full`; моно 11.5 (`fs-pre`), дата `ink2`, время 500 `ink`. Не ISO — `<span class="tm">` с исходным текстом без тултипа; пусто — «—».
  - **`StatusBadge`** — `<span data-badge={tone}>` с декоративной точкой (`aria-hidden`) и текстом; пилюля 600 10.5 / 14, отступы 2 / 7, радиус 10, точка 6, зазор 5 — высота 18, как замер эталона (Task 1). Текст — `ink2` на всех тонах (Д37): `ok`/`warn` на своих `-soft` дают 4.17 / 4.26 < 4.5; тон несут подложка (`ok-soft`/`bad-soft`/`warn-soft`/`chip`) и точка (`st-ok`/`st-bad`/`st-warn`/`st-grey`). Правило контраста `ink2` на `bad-soft` ≥ 4.5 добавляется в `contrast.rules.ts` (на `ok-soft`/`warn-soft` оно уже есть).
  - «`Tag mono`» спеки §2 — существующий `Tag tone="mt"` (моно 600, как `.tag.mt`); новых вариантов `Tag` задача не вводит.
- Produces (токены): `badge-dot` 6, `badge-py` 2, `badge-px` 7, `badge-gap` 5, `r-badge` 10.

- [ ] **Step 1: токены.** В `packages/tokens/src/tokens.src.ts` в конец объекта `sizes`, после строки `'dt-dir': 62, … 'dt-label-l': 250,`, добавить:

```ts
  // бейдж статуса вкладок деталки (эталон .st, index.html:105–107): точка 6, отступы 2 × 7, зазор точки 5, радиус пилюли 10
  'badge-dot': 6, 'badge-py': 2, 'badge-px': 7, 'badge-gap': 5, 'r-badge': 10,
```

  В `packages/tokens/src/contrast.rules.ts` после правила `{ fg: 'ink2', bg: ['warn-soft', 'ok-soft'], min: 4.5, note: 'тег роли на подсветке' },` добавить:

```ts
  /* Бейдж статуса вкладок деталки (StatusBadge, срез 2b): текст ink2 на подложке тона — ok/warn/bad-soft; тон несут подложка и точка */
  { fg: 'ink2', bg: ['bad-soft'], min: 4.5, note: 'бейдж статуса на подложке ошибки' },
```

  В `packages/tokens/src/generate.test.ts` сразу после теста `'«Общие данные» деталки: строка поля 27, строка сторон рубля 23, сетки блоков dt-* (спека 2a)'` добавить:

```ts
  it('бейдж статуса вкладок деталки: точка 6, радиус 10 (спека 2b)', () => {
    expect(css).toMatch(/--k-badge-dot: calc\(6px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-r-badge: calc\(10px \* var\(--k-density\)\)/)
  })
```

  Run: `pnpm gen && pnpm --filter @katran/tokens test` — `pnpm gen` пишет «tokens.css и tokens.ts обновлены»; тесты PASS: `Tests 17 passed` (16 + 1; контраст `ink2`/`bad-soft` — 8.3 в светлой, 9.3 в тёмной теме).
- [ ] **Step 2: тесты форматтеров (падают).** Создать `packages/ui/src/format/time.test.ts`:

```ts
import { formatDuration, formatTimestamp, timestampDiff } from './time'

describe('formatTimestamp', () => {
  it('ISO без зоны с миллисекундами (форма бека) — дата без года, время, доли отдельно, полная форма с годом', () => {
    expect(formatTimestamp('2026-09-22T07:31:45.241')).toEqual({ date: '22.09', time: '07:31:45', ms: '241', full: '22.09.2026 07:31:45.241' })
  })
  it('ISO без зоны без миллисекунд — ms пустой, full без хвоста', () => {
    expect(formatTimestamp('2026-09-22T07:33:21')).toEqual({ date: '22.09', time: '07:33:21', ms: '', full: '22.09.2026 07:33:21' })
  })
  it('разделитель — пробел (как в моках эталона)', () => {
    expect(formatTimestamp('2026-09-22 07:31:45.241')?.full).toBe('22.09.2026 07:31:45.241')
  })
  it('доли секунды — ровно три знака: короче — дополняются нулями, длиннее — отбрасываются', () => {
    expect(formatTimestamp('2026-09-22T07:31:45.5')?.ms).toBe('500')
    expect(formatTimestamp('2026-09-22T07:31:45.051765')?.ms).toBe('051')
  })
  it('настенное время: часовой пояс браузера цифры не сдвигает', () => {
    vi.stubEnv('TZ', 'America/New_York')
    try {
      expect(formatTimestamp('2026-09-22T00:10:00.000')?.full).toBe('22.09.2026 00:10:00.000')
    } finally {
      vi.unstubAllEnvs()
    }
  })
  it('хвост зоны допускается и не пересчитывается — берутся цифры строки', () => {
    vi.stubEnv('TZ', 'Europe/Moscow')
    try {
      expect(formatTimestamp('2026-09-22T04:35:02.121Z')).toEqual({ date: '22.09', time: '04:35:02', ms: '121', full: '22.09.2026 04:35:02.121' })
      expect(formatTimestamp('2026-09-22T22:00:00+03:00')?.full).toBe('22.09.2026 22:00:00')
      expect(formatTimestamp('2026-09-22T22:00:00-0500')?.full).toBe('22.09.2026 22:00:00')
    } finally {
      vi.unstubAllEnvs()
    }
  })
  it('не ISO — null: пусто, прочерк, только дата, русская запись, месяц/час/минута вне диапазона, мусор вокруг', () => {
    for (const s of ['', '—', '2026-09-22', '22.09.2026 07:31:45', '2026-13-01T10:00:00', '2026-09-22T24:00:00', '2026-09-22T07:60:00', 'x2026-09-22T07:31:45', '2026-09-22T07:31:45.241 МСК']) {
      expect(formatTimestamp(s)).toBeNull()
    }
  })
})

describe('timestampDiff', () => {
  it('разница в миллисекундах между метками без зоны', () => {
    expect(timestampDiff('2026-09-22T07:31:45.241', '2026-09-22T07:31:45.642')).toBe(401)
    expect(timestampDiff('2026-09-22T07:31:48.141', '2026-09-22T07:33:20.383')).toBe(92_242)
    expect(timestampDiff('2026-09-22T07:31:59', '2026-09-22T07:32:00.250')).toBe(1250)
  })
  it('через полночь; с хвостом зоны — по цифрам строк, как formatTimestamp', () => {
    expect(timestampDiff('2026-09-22T23:59:59.500', '2026-09-23T00:00:00.500')).toBe(1000)
    expect(timestampDiff('2026-09-22T04:35:02.121Z', '2026-09-22T04:35:47.308Z')).toBe(45_187)
    expect(timestampDiff('2026-09-22T07:00:00+03:00', '2026-09-22T07:00:01Z')).toBe(1000)
  })
  it('обратный порядок — отрицательное; неразобранная метка — null', () => {
    expect(timestampDiff('2026-09-22T07:31:46', '2026-09-22T07:31:45')).toBe(-1000)
    expect(timestampDiff('', '2026-09-22T07:31:45')).toBeNull()
    expect(timestampDiff('2026-09-22T07:31:45', 'нет')).toBeNull()
  })
})

describe('formatDuration', () => {
  it('до секунды — миллисекунды целым', () => {
    expect(formatDuration(0)).toBe('0 мс')
    expect(formatDuration(401)).toBe('401 мс')
    expect(formatDuration(999)).toBe('999 мс')
    expect(formatDuration(999.4)).toBe('999 мс')
  })
  it('до минуты — секунды с одним знаком через запятую, без округления вверх', () => {
    expect(formatDuration(999.6)).toBe('1,0 с')
    expect(formatDuration(1000)).toBe('1,0 с')
    expect(formatDuration(4249)).toBe('4,2 с')
    expect(formatDuration(59_900)).toBe('59,9 с')
    expect(formatDuration(59_999)).toBe('59,9 с')
  })
  it('до часа — минуты и секунды, ноль секунд не пишется', () => {
    expect(formatDuration(60_000)).toBe('1 мин')
    expect(formatDuration(92_242)).toBe('1 мин 32 с')
    expect(formatDuration(185_000)).toBe('3 мин 5 с')
    expect(formatDuration(3_599_000)).toBe('59 мин 59 с')
    expect(formatDuration(3_599_999)).toBe('59 мин 59 с')
  })
  it('от часа — часы и минуты, ноль минут не пишется; сутки не выделяются', () => {
    expect(formatDuration(3_600_000)).toBe('1 ч')
    expect(formatDuration(7_800_000)).toBe('2 ч 10 мин')
    expect(formatDuration(93_780_000)).toBe('26 ч 3 мин')
  })
  it('отрицательное, NaN, бесконечность — пусто', () => {
    expect(formatDuration(-1)).toBe('')
    expect(formatDuration(Number.NaN)).toBe('')
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('')
  })
})
```

  Run: `pnpm --filter @katran/ui test -- src/format/time.test.ts` — FAIL: `Failed to resolve import "./time"`.
- [ ] **Step 3: форматтеры.** Создать `packages/ui/src/format/time.ts`:

```ts
const p2 = (n: number) => String(n).padStart(2, '0')

/** Метка времени события по частям: дата без года, время, миллисекунды отдельно (приглушаются), полная форма — для тултипа. */
export type TimestampParts = {
  /** 'ДД.ММ' */
  date: string
  /** 'ЧЧ:ММ:СС' */
  time: string
  /** '123' — три цифры; '' — у метки нет долей секунды */
  ms: string
  /** 'ДД.ММ.ГГГГ ЧЧ:ММ:СС.ммм' (без '.ммм', если долей нет) */
  full: string
}

// Время вкладок бек отдаёт ISO без зоны: '2026-09-22T07:31:45.241', иногда без долей секунды. Разбор — настенное время:
// берутся цифры строки, без new Date() и без пересчёта в зону браузера (как эталон tmHtml, index.html:1157).
// Разделитель — «T» или пробел; хвост зоны («Z», ±ЧЧ:ММ, ±ЧЧММ) допускается и тоже не пересчитывается — показываются цифры строки.
const ISO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:Z|[+-]\d{2}:?\d{2})?$/

type Wall = { y: number; mo: number; d: number; h: number; mi: number; s: number; ms: string }

function wall(iso: string): Wall | null {
  const m = ISO.exec(iso.trim())
  if (!m) return null
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6]].map(Number) as [number, number, number, number, number, number]
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null
  // доли секунды — ровно три знака: '5' → '500', '051765' → '051' (лишние отбрасываются, не округляются)
  return { y, mo, d, h, mi, s, ms: m[7] === undefined ? '' : m[7].slice(0, 3).padEnd(3, '0') }
}

/** Разбор метки времени бека; null — строка не дата-время ISO (показывается как есть). */
export function formatTimestamp(iso: string): TimestampParts | null {
  const w = wall(iso)
  if (!w) return null
  const date = `${p2(w.d)}.${p2(w.mo)}`
  const time = `${p2(w.h)}:${p2(w.mi)}:${p2(w.s)}`
  return { date, time, ms: w.ms, full: `${date}.${w.y} ${time}${w.ms ? `.${w.ms}` : ''}` }
}

/**
 * Миллисекунды между двумя метками времени бека (to − from) по цифрам строк, как formatTimestamp (зона не учитывается);
 * null — одна из меток не разобралась. Для Δ статусов (эталон dur(), index.html:1159).
 */
export function timestampDiff(from: string, to: string): number | null {
  const a = wall(from), b = wall(to)
  if (!a || !b) return null
  const t = (w: Wall) => Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s, w.ms ? Number(w.ms) : 0)
  return t(b) - t(a)
}

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN

/**
 * Длительность для людей (Δ статусов, эталон dur(), index.html:1159):
 * до секунды — «850 мс»; до минуты — секунды с одним знаком через запятую, без округления вверх («59,9 с», не «60,0 с»);
 * до часа — «3 мин 5 с» (ноль секунд не пишется: «1 мин»); дальше — «2 ч 10 мин» («1 ч»).
 * Дробные миллисекунды округляются до целых. Отрицательное, NaN и бесконечность — '' (как эталон: Δ не показывается).
 * Порог «медленно» задаёт вызывающий.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return ''
  const n = Math.round(ms)
  if (n < SEC) return `${n} мс`
  if (n < MIN) {
    const tenths = Math.floor(n / 100)
    return `${Math.floor(tenths / 10)},${tenths % 10} с`
  }
  if (n < HOUR) {
    const m = Math.floor(n / MIN), s = Math.floor((n % MIN) / SEC)
    return s ? `${m} мин ${s} с` : `${m} мин`
  }
  const h = Math.floor(n / HOUR), m = Math.floor((n % HOUR) / MIN)
  return m ? `${h} ч ${m} мин` : `${h} ч`
}
```

  Заменить `packages/ui/src/format/index.ts` целиком:

```ts
export * from './date'
export * from './time'
export * from './amount'
export * from './account'
export * from './clipboard'
```

  Run: `pnpm --filter @katran/ui test -- src/format/time.test.ts` — PASS: `Tests 15 passed`.
- [ ] **Step 4: тесты компонентов (падают).** Создать `packages/ui/src/value/Timestamp.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Timestamp } from './Timestamp'

describe('Timestamp', () => {
  it('дата, время и доли секунды раздельно; полная форма — тултипом; машинное значение — в dateTime', () => {
    const { container } = renderK(<Timestamp iso="2026-09-22T07:31:45.241" />)
    const t = container.querySelector('time')!
    expect(t).toHaveTextContent('22.09 07:31:45.241')
    expect(t).toHaveAttribute('datetime', '2026-09-22T07:31:45.241')
    expect(t).toHaveAttribute('data-k-tip', '22.09.2026 07:31:45.241')
    expect(screen.getByText('07:31:45').tagName).toBe('B')
    expect(screen.getByText('.241')).toBeInTheDocument()
  })
  it('без долей секунды — хвоста нет', () => {
    const { container } = renderK(<Timestamp iso="2026-09-22T07:31:59" />)
    expect(container.querySelector('time')).toHaveTextContent(/^22\.09 07:31:59$/)
    expect(container.querySelector('time')).toHaveAttribute('data-k-tip', '22.09.2026 07:31:59')
  })
  it('не дата-время — текст как есть, без тултипа; пусто — «—»', () => {
    const { container, rerender } = renderK(<Timestamp iso="22.09.2026 07:31:51" />)
    expect(container.querySelector('time')).toBeNull()
    expect(screen.getByText('22.09.2026 07:31:51')).not.toHaveAttribute('data-k-tip')
    rerender(<Timestamp iso="" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<><Timestamp iso="2026-09-22T07:31:45.241" /><Timestamp iso="нет" /></>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

  и `packages/ui/src/value/StatusBadge.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { StatusBadge, type BadgeTone } from './StatusBadge'

describe('StatusBadge', () => {
  it('текст — содержимое, тон — атрибутом data-badge, точка скрыта от скринридера', () => {
    renderK(<StatusBadge tone="ok">ALLOW</StatusBadge>)
    const b = screen.getByText('ALLOW')
    expect(b).toHaveAttribute('data-badge', 'ok')
    expect(b.querySelector('[aria-hidden="true"]')).not.toBeNull()
    expect(b).toHaveTextContent(/^ALLOW$/)
  })
  it('четыре тона без нарушений axe', async () => {
    const tones: BadgeTone[] = ['ok', 'bad', 'wait', 'neutral']
    const { container } = renderK(<>{tones.map((t) => <StatusBadge key={t} tone={t}>{t.toUpperCase()}</StatusBadge>)}</>)
    expect(tones.map((t) => screen.getByText(t.toUpperCase()).getAttribute('data-badge'))).toEqual(tones)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

  Run: `pnpm --filter @katran/ui test -- src/value/Timestamp.test.tsx src/value/StatusBadge.test.tsx` — FAIL: модули `./Timestamp`, `./StatusBadge` не найдены.
- [ ] **Step 5: компоненты.** Создать `packages/ui/src/value/Timestamp.tsx`:

```tsx
import { formatTimestamp } from '../format/time'
import s from './Value.module.css'

export type TimestampProps = { iso: string }

/**
 * Метка времени события (эталон tmHtml, index.html:1157): «ДД.ММ ЧЧ:ММ:СС», время полужирнее, доли секунды приглушённо,
 * полная дата с годом — тултипом кита. Не дата-время — текст как есть, пусто — «—».
 */
export function Timestamp({ iso }: TimestampProps) {
  const t = formatTimestamp(iso)
  if (!t) return <span className={s.tm}>{iso.trim() || '—'}</span>
  return (
    <time className={s.tm} dateTime={iso.trim()} data-k-tip={t.full}>
      {t.date} <b className={s.tmTime}>{t.time}</b>{t.ms && <span className={s.tmMs}>.{t.ms}</span>}
    </time>
  )
}
```

  Создать `packages/ui/src/value/StatusBadge.tsx`:

```tsx
import type { ReactNode } from 'react'
import s from './Value.module.css'

/** ok — успех, bad — ошибка/отказ, wait — в ожидании/на проверке, neutral — без оценки. */
export type BadgeTone = 'ok' | 'bad' | 'wait' | 'neutral'
export type StatusBadgeProps = { tone: BadgeTone; children: ReactNode }

/**
 * Бейдж решения или статуса (эталон .st, index.html:105–107): пилюля на мягкой подложке тона с точкой.
 * Текст — ink2 на всех тонах (ok/warn на своих -soft не дают 4.5, правило контраста), тон несут подложка и точка.
 * Точка декоративная: смысл — в тексте.
 */
export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return (
    <span className={s.badge} data-badge={tone}>
      <span className={s.badgeDot} aria-hidden="true" />
      {children}
    </span>
  )
}
```

  В конец `packages/ui/src/value/Value.module.css` (после правила `.none`, через пустую строку) дописать:

```css
/* метка времени события (эталон .tt .tm, index.html:305–306): моно 11.5, дата ink2, время ink, доли секунды faint */
.tm {
  font: var(--k-fs-pre) / var(--k-lh-1) var(--k-mono);
  color: var(--k-ink2);
  white-space: nowrap;
}

.tmTime {
  font-weight: 500;
  color: var(--k-ink);
}

.tmMs {
  color: var(--k-faint);
}

/* бейдж статуса (эталон .st, index.html:105–107): 600 10.5 / 14 + 2 × 2 — высота 18, как замер эталона; пилюля, точка 6;
   текст ink2 на всех тонах — ok/warn на своих -soft ниже 4.5 (правило контраста; класс C в detail-drift) */
.badge {
  display: inline-flex;
  box-sizing: border-box;
  align-items: center;
  gap: var(--k-badge-gap);
  padding: var(--k-badge-py) var(--k-badge-px);
  border-radius: var(--k-r-badge);
  font: 600 var(--k-fs-3) / var(--k-lh-2) var(--k-sans);
  letter-spacing: 0.02em;
  color: var(--k-ink2);
  white-space: nowrap;
  vertical-align: middle;
}

.badgeDot {
  flex: none;
  width: var(--k-badge-dot);
  height: var(--k-badge-dot);
  border-radius: 50%;
}

.badge[data-badge="ok"] {
  background: var(--k-ok-soft);
}

.badge[data-badge="ok"] .badgeDot {
  background: var(--k-st-ok);
}

.badge[data-badge="bad"] {
  background: var(--k-bad-soft);
}

.badge[data-badge="bad"] .badgeDot {
  background: var(--k-st-bad);
}

.badge[data-badge="wait"] {
  background: var(--k-warn-soft);
}

.badge[data-badge="wait"] .badgeDot {
  background: var(--k-st-warn);
}

.badge[data-badge="neutral"] {
  background: var(--k-chip);
}

.badge[data-badge="neutral"] .badgeDot {
  background: var(--k-st-grey);
}
```

  Заменить `packages/ui/src/value/index.ts` целиком:

```ts
export { CopyValue, type CopyValueProps } from './CopyValue'
export { LinkValue, type LinkValueProps } from './LinkValue'
export { AccountValue, type AccountValueProps } from './AccountValue'
export { FieldTag, type FieldTagProps } from './FieldTag'
export { StatusDot, type StatusDotProps, type StatusTone } from './StatusDot'
export { SwiftField, type SwiftFieldProps } from './SwiftField'
export { Tag, type TagProps } from './Tag'
export { Counter, type CounterProps } from './Counter'
export { Timestamp, type TimestampProps } from './Timestamp'
export { StatusBadge, type StatusBadgeProps, type BadgeTone } from './StatusBadge'
```

  (`src/index.ts` уже экспортирует `./format` и `./value` — правки не нужно.)
- [ ] **Step 6: запуск.** `pnpm --filter @katran/ui test -- src/format/time.test.ts src/value` — PASS (15 + 4 + 2 новых и прежние `Value.test.tsx`). `pnpm --filter @katran/ui test` — `Tests 316 passed` (295 + 21).
- [ ] **Step 7: проверка.** Сгенерированные токены сравниваются `gen:check` с индексом — сначала добавить файлы задачи в индекс, потом проверка:

```bash
git add packages/tokens/src/tokens.src.ts packages/tokens/src/tokens.css packages/tokens/src/tokens.ts packages/tokens/src/contrast.rules.ts packages/tokens/src/generate.test.ts packages/ui/src/format/time.ts packages/ui/src/format/time.test.ts packages/ui/src/format/index.ts packages/ui/src/value/Timestamp.tsx packages/ui/src/value/Timestamp.test.tsx packages/ui/src/value/StatusBadge.tsx packages/ui/src/value/StatusBadge.test.tsx packages/ui/src/value/Value.module.css packages/ui/src/value/index.ts
pnpm check
```

  Expected: зелёный; `tokens` 17, `ui` 316, `effector` 49, `apps/pi` 135; `ES-Check passed`, `CSS: синтаксиса новее chrome >= 88 нет` (`inline-flex` с `gap` — Chromium 84+).
- [ ] **Step 8: commit.** CHANGELOG — в Task 13 (карта файлов плана).

```bash
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "ui: formatTimestamp, formatDuration, timestampDiff, Timestamp, StatusBadge — время и бейджи вкладок деталки"
```

---

### Task 3: Кит — `MiniTable`

**Files:**
- Create: `packages/ui/src/table/MiniTable.tsx`, `packages/ui/src/table/MiniTable.module.css`, `packages/ui/src/table/index.ts`
- Test: `packages/ui/src/table/MiniTable.test.tsx`, `packages/tokens/src/generate.test.ts` (одна проверка)
- Modify: `packages/ui/src/index.ts`, `packages/tokens/src/tokens.src.ts` (+ `pnpm gen`: `tokens.css`, `tokens.ts`)

**Interfaces:**
- Consumes: `useStableId` (`compat/useStableId.ts`); `--k-density` (ширины колонок — как `ColumnHeader`: `calc(${n}px * var(--k-density))`); токены `fs-1`, `lh-1`, `fs-2`, `lh-2`, `fs-3`, `lh-3`, `r-s`, `sp-2`, цвета `line`, `line2`, `paper`, `sunk`, `hover`, `ink`, `muted`, `faint`, `val`. От Task 2 не зависит.
- Produces (экспорт `@katran/ui`, новый модуль `table`) — сквозной контракт плюс `rowLabel` (уточнение потребителей Task 8–9: у «Задач» первая колонка — точка без текста):

```ts
type MiniColumn<T> = { id: string; header: string; width?: number | undefined; render: (row: T, index: number) => ReactNode; mono?: boolean | undefined; align?: 'start' | 'end' | undefined }
type MiniTableProps<T> = {
  label: string; columns: MiniColumn<T>[]; rows: T[]; rowKey: (row: T, index: number) => string; empty: string
  numbered?: boolean | undefined
  renderExpanded?: ((row: T) => ReactNode) | undefined
  rowLabel?: ((row: T, index: number) => string) | undefined   // сверх контракта: имя переключателя «Раскрыть {rowLabel}» / «Свернуть {rowLabel}»; без него — «Раскрыть строку N»
  expanded?: string[] | undefined; defaultExpanded?: string[] | undefined; onExpandedChange?: ((keys: string[]) => void) | undefined
  toolbar?: ReactNode | undefined
}
MiniTable<T>(props: MiniTableProps<T>): JSX.Element
```

  **Разметка — CSS grid с ролями, не `<table>`.** Эталон — строки-гриды (`.tt .th/.tr`, `.ld`, `.tk`); одна сетка `grid-template-columns` из `--k-cols` на шапку и тело держит ширины колонок из пропсов, умноженные на плотность, без `table-layout` и `colgroup`; панель раскрытой строки — отдельная строка на всю ширину (`grid-column` не нужен — строка панели не грид), чего нативная таблица без `colSpan` по числу колонок не даёт. Семантика таблицы — ролями: `div[role=table][aria-label=label]` → `div[role=rowgroup]` (шапка) → `div[role=row]` → `div[role=columnheader]`; тело — `div[role=rowgroup]` → `div[role=row]` → `div[role=cell]`.
  Поведение (фиксируется тестами):
  - Шапка рисуется, если хотя бы у одной колонки `header !== ''`; колонка с `header === ''` в шапке — пустая `role="cell"` (не `columnheader`: пустой заголовок — нарушение axe `empty-table-header`). `numbered` — первая колонка шириной `tt-num` (22), в шапке `columnheader` с текстом «№» только для скринридера, в теле — номер строки с единицы (моно 11, `faint`, вправо).
  - Ширина колонки: `width` → `calc(${width}px * var(--k-density))`, без `width` → `minmax(0, 1fr)`; шаблон — в стиль таблицы `--k-cols` (`[№] колонки… [шеврон]`).
  - Пусто (`rows.length === 0`) — рамка с текстом `empty` (без роли таблицы), `toolbar` остаётся.
  - `toolbar` — полоса над таблицей (`.tbar` эталона: высота 26, первый элемент прижат влево, остальное вправо).
  - Раскрываемые строки (`renderExpanded` задан): строка — **не кнопка** (внутри свои ссылки и кнопки — axe `nested-interactive`); переключатель — кнопка-шеврон `▼` в последней ячейке (ширина `tt-chev` 14) с `aria-expanded`, `aria-controls` → `id` ячейки панели и именем «Раскрыть {rowLabel}» / «Свернуть {rowLabel}» (без `rowLabel` — «Раскрыть строку N»); Enter/Space — нативно у кнопки. Клик мышью по свободному месту строки тоже переключает (делегированием с тела таблицы, не `onClick` на `role="row"`: иначе строка — интерактивный элемент без фокуса, правило `jsx-a11y`); клик по `a[href]`, `button`, полю, `[role=button|link]`, фокусируемому внутри строки — не переключает; выделение текста мышью — не переключает; строки вложенной таблицы в панели — только свои. Панель — строка `role="row"` > `role="cell"` с `id` сразу под строкой, `hidden`, пока строка свёрнута; содержимое `renderExpanded(row)` рендерится только у раскрытой. Раскрытая строка — шеврон повёрнут.
  - Состояние: `expanded` задан — управляемый режим (показывается `expanded`, клик только зовёт `onExpandedChange`); иначе — своё от `defaultExpanded`. `onExpandedChange` зовётся в обоих режимах с **полным** новым набором: новый ключ — в конец, снятый — удаляется.
- Produces (токены, эталон `.tt/.tbar/.ld/.tk`, index.html:299–342, замер Task 1): `tt-row` 24, `tt-head` 22, `tt-row-x` 26 (раскрываемая строка и полоса `toolbar`), `tt-num` 22, `tt-chev` 14, `tt-gap` 10 (зазор колонок и боковой отступ строки), `tt-empty` 14, `tt-panel-pt` 6. Строки — `box-sizing: border-box` (нижняя граница входит в высоту, как у эталона). Проверено при написании плана статической разметкой на собранном `ui.css` в Chromium: шапка 22, строка 24, раскрываемая 26, бейдж 18, полоса 26; e2e на `apps/pi` — Task 12.
- Разметка для e2e Task 12 и тестов приложения: таблица — `[role="table"]` с именем `label`; строка тела — `[role="rowgroup"]:last-child > [role="row"]`; раскрываемая — атрибут `data-k-xrow="<rowKey>"`.

- [ ] **Step 1: токены.** В `packages/tokens/src/tokens.src.ts` в конец объекта `sizes`, после строки `'badge-dot': 6, …` (Task 2), добавить:

```ts
  // таблица вкладок деталки MiniTable (эталон .tt/.ld/.tk, index.html:299–342): строка 24, шапка 22, раскрываемая строка 26,
  // колонка «№» 22, шеврон 14, зазор и боковой отступ 10, отступ пустого состояния 14, верхний отступ панели раскрытой строки 6
  'tt-row': 24, 'tt-head': 22, 'tt-row-x': 26, 'tt-num': 22, 'tt-chev': 14, 'tt-gap': 10, 'tt-empty': 14, 'tt-panel-pt': 6,
```

  В `packages/tokens/src/generate.test.ts` после теста `'бейдж статуса вкладок деталки: точка 6, радиус 10 (спека 2b)'` (Task 2) добавить:

```ts
  it('таблица вкладок деталки MiniTable: строка 24, шапка 22, раскрываемая строка 26 (спека 2b)', () => {
    expect(css).toMatch(/--k-tt-row: calc\(24px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-tt-head: calc\(22px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-tt-row-x: calc\(26px \* var\(--k-density\)\)/)
  })
```

  Run: `pnpm gen && pnpm --filter @katran/tokens test` — PASS: `Tests 18 passed`. Если замер Task 1 дал другие высоты (больше 0.5 px) — числа токенов взять из замера и поправить ожидания в тесте.
- [ ] **Step 2: тесты (падают).** Создать `packages/ui/src/table/MiniTable.test.tsx`:

```tsx
import { useState } from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { MiniTable, type MiniColumn } from './MiniTable'

type Ev = { at: string; route: string; code: string }
const EVENTS: Ev[] = [
  { at: '07:31:45', route: '—', code: 'fx-dup-check.end' },
  { at: '07:31:46', route: 'RT_FX_IN', code: 'fx-in-checks.start' },
]
const COLS: MiniColumn<Ev>[] = [
  { id: 'at', header: 'Дата/время', width: 118, mono: true, render: (r) => r.at },
  { id: 'route', header: 'Маршрут', width: 150, render: (r) => r.route },
  { id: 'code', header: 'Статус', render: (r) => r.code },
  { id: 'n', header: 'Δ', width: 50, align: 'end', render: (_, i) => `#${i}` },
]
const byCode = (r: Ev) => r.code

type Task = { id: string; text: string; history: string }
const TASKS: Task[] = [
  { id: 't1', text: 'Подтвердить маршрут', history: 'Назначена · Иванова' },
  { id: 't2', text: 'Проверить тариф', history: 'Создана · система' },
]
const TASK_COLS: MiniColumn<Task>[] = [
  { id: 'text', header: '', render: (r) => r.text },
  { id: 'hist', header: '', width: 60, render: () => <a href="#hist">История</a> },
  { id: 'act', header: '', width: 60, render: () => <button type="button">Действие</button> },
]
const byId = (r: Task) => r.id
const rowOf = (text: string) => screen.getByText(text).closest('[role="row"]') as HTMLElement
const toggleOf = (text: string) => within(rowOf(text)).getByRole('button', { name: /^(Раскрыть|Свернуть) строку \d+$/ })

describe('MiniTable', () => {
  it('таблица с именем, шапка, ячейки из render(row, index), моно и выравнивание', () => {
    renderK(<MiniTable label="Статусы" columns={COLS} rows={EVENTS} rowKey={byCode} empty="Статусов нет" />)
    const table = screen.getByRole('table', { name: 'Статусы' })
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Дата/время', 'Маршрут', 'Статус', 'Δ'])
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(screen.getByText('fx-in-checks.start')).toHaveAttribute('role', 'cell')
    expect(screen.getByText('07:31:45').className).toMatch(/mono/)
    expect(screen.getByText('#1')).toHaveAttribute('data-align', 'end')
  })

  it('ширины колонок — px при плотности 1, умножаются на плотность; без ширины — minmax(0, 1fr)', () => {
    renderK(<MiniTable label="Статусы" columns={COLS} rows={EVENTS} rowKey={byCode} empty="Статусов нет" numbered />)
    expect(screen.getByRole('table').style.getPropertyValue('--k-cols'))
      .toBe('var(--k-tt-num) calc(118px * var(--k-density)) calc(150px * var(--k-density)) minmax(0, 1fr) calc(50px * var(--k-density))')
  })

  it('numbered — колонка «№» (для скринридера) с номерами строк с единицы', () => {
    renderK(<MiniTable label="Статусы" columns={COLS} rows={EVENTS} rowKey={byCode} empty="Статусов нет" numbered />)
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('№')
    const [, first, second] = screen.getAllByRole('row')
    expect(within(first!).getAllByRole('cell')[0]).toHaveTextContent('1')
    expect(within(second!).getAllByRole('cell')[0]).toHaveTextContent('2')
  })

  it('пустой заголовок — пустая ячейка шапки, не columnheader; все пустые — шапки нет', () => {
    const cols: MiniColumn<Ev>[] = [...COLS.slice(0, 2), { id: 'link', header: '', width: 120, render: () => 'Исходное сообщение' }]
    const { unmount } = renderK(<MiniTable label="Нотификации" columns={cols} rows={EVENTS} rowKey={byCode} empty="Нотификаций нет" />)
    expect(screen.getAllByRole('columnheader')).toHaveLength(2)
    expect(screen.getAllByRole('row')).toHaveLength(3)
    unmount()
    renderK(<MiniTable label="Задачи" columns={TASK_COLS} rows={TASKS} rowKey={byId} empty="Задач нет" />)
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0)
    expect(screen.getAllByRole('row')).toHaveLength(2)
  })

  it('пусто — текст эталона вместо таблицы, полоса над таблицей остаётся', () => {
    renderK(<MiniTable label="Задачи" columns={TASK_COLS} rows={[]} rowKey={byId} empty="Задач нет" toolbar={<><span>0 задач</span><button type="button">Перейти</button></>} />)
    expect(screen.getByText('Задач нет')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText('0 задач')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Перейти' })).toBeInTheDocument()
  })

  it('раскрытие без управления: defaultExpanded, кнопка-шеврон с aria-expanded/aria-controls, панель под строкой', async () => {
    renderK(<MiniTable label="Задачи" columns={TASK_COLS} rows={TASKS} rowKey={byId} empty="Задач нет" defaultExpanded={['t2']} renderExpanded={(r) => <p>{r.history}</p>} />)
    const b1 = toggleOf('Подтвердить маршрут')
    const b2 = toggleOf('Проверить тариф')
    expect(b1).toHaveAttribute('aria-expanded', 'false')
    expect(b2).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(b2.getAttribute('aria-controls')!)).toHaveTextContent('Создана · система')
    expect(screen.queryByText('Назначена · Иванова')).toBeNull()
    await userEvent.click(b1)
    expect(b1).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(b1.getAttribute('aria-controls')!)).toHaveTextContent('Назначена · Иванова')
    await userEvent.click(b2)
    expect(b2).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById(b2.getAttribute('aria-controls')!)).not.toBeVisible()
  })

  it('имя переключателя — «Раскрыть»/«Свернуть» и rowLabel строки', async () => {
    renderK(<MiniTable label="Задачи" columns={TASK_COLS} rows={TASKS} rowKey={byId} empty="Задач нет" renderExpanded={(r) => r.history} rowLabel={(r) => r.text} />)
    await userEvent.click(screen.getByRole('button', { name: 'Раскрыть Подтвердить маршрут' }))
    expect(screen.getByRole('button', { name: 'Свернуть Подтвердить маршрут' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Раскрыть Проверить тариф' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('без rowLabel — «Раскрыть строку N» с номером строки с единицы', async () => {
    renderK(<MiniTable label="Задачи" columns={TASK_COLS} rows={TASKS} rowKey={byId} empty="Задач нет" renderExpanded={(r) => r.history} />)
    expect(screen.getByRole('button', { name: 'Раскрыть строку 1' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Раскрыть строку 2' }))
    expect(screen.getByRole('button', { name: 'Свернуть строку 2' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('клик по строке раскрывает и сворачивает её; по ссылке и кнопке внутри строки — нет', async () => {
    renderK(<MiniTable label="Задачи" columns={TASK_COLS} rows={TASKS} rowKey={byId} empty="Задач нет" renderExpanded={(r) => r.history} />)
    await userEvent.click(screen.getByText('Подтвердить маршрут'))
    expect(toggleOf('Подтвердить маршрут')).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(screen.getByText('Подтвердить маршрут'))
    expect(toggleOf('Подтвердить маршрут')).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(within(rowOf('Проверить тариф')).getByRole('link', { name: 'История' }))
    expect(toggleOf('Проверить тариф')).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(within(rowOf('Проверить тариф')).getByRole('button', { name: 'Действие' }))
    expect(toggleOf('Проверить тариф')).toHaveAttribute('aria-expanded', 'false')
  })

  it('выделение текста мышью строку не раскрывает', () => {
    renderK(<MiniTable label="Задачи" columns={TASK_COLS} rows={TASKS} rowKey={byId} empty="Задач нет" renderExpanded={(r) => r.history} />)
    const cell = screen.getByText('Подтвердить маршрут')
    window.getSelection()!.selectAllChildren(cell)
    fireEvent.click(cell)
    expect(toggleOf('Подтвердить маршрут')).toHaveAttribute('aria-expanded', 'false')
    window.getSelection()!.removeAllRanges()
  })

  it('клавиатура: Tab до шеврона, Enter и Space переключают', async () => {
    renderK(<MiniTable label="Задачи" columns={TASK_COLS.slice(0, 1)} rows={TASKS} rowKey={byId} empty="Задач нет" renderExpanded={(r) => r.history} />)
    await userEvent.tab()
    const b1 = toggleOf('Подтвердить маршрут')
    expect(b1).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(b1).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard(' ')
    expect(b1).toHaveAttribute('aria-expanded', 'false')
  })

  it('управляемый режим: состояние — из expanded, клик только сообщает новый набор', async () => {
    const onChange = vi.fn()
    const { rerender } = renderK(<MiniTable label="Задачи" columns={TASK_COLS} rows={TASKS} rowKey={byId} empty="Задач нет" renderExpanded={(r) => r.history}
      expanded={['t1']} onExpandedChange={onChange} />)
    await userEvent.click(toggleOf('Проверить тариф'))
    // новый ключ — в конец набора, снятый — удаляется
    expect(onChange).toHaveBeenLastCalledWith(['t1', 't2'])
    expect(toggleOf('Проверить тариф')).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggleOf('Подтвердить маршрут'))
    expect(onChange).toHaveBeenLastCalledWith([])
    expect(toggleOf('Подтвердить маршрут')).toHaveAttribute('aria-expanded', 'true')
    rerender(<MiniTable label="Задачи" columns={TASK_COLS} rows={TASKS} rowKey={byId} empty="Задач нет" renderExpanded={(r) => r.history}
      expanded={['t2']} onExpandedChange={onChange} />)
    expect(toggleOf('Подтвердить маршрут')).toHaveAttribute('aria-expanded', 'false')
    expect(toggleOf('Проверить тариф')).toHaveAttribute('aria-expanded', 'true')
  })

  it('управляемый режим с хозяином состояния — раскрытие переживает перемонтирование таблицы', async () => {
    function Host() {
      const [keys, setKeys] = useState<string[]>([])
      const [shown, setShown] = useState(true)
      return (
        <>
          <button type="button" onClick={() => setShown((v) => !v)}>Вкладка</button>
          {shown && <MiniTable label="Задачи" columns={TASK_COLS} rows={TASKS} rowKey={byId} empty="Задач нет" renderExpanded={(r) => r.history} expanded={keys} onExpandedChange={setKeys} />}
        </>
      )
    }
    renderK(<Host />)
    await userEvent.click(toggleOf('Проверить тариф'))
    await userEvent.click(screen.getByRole('button', { name: 'Вкладка' }))
    await userEvent.click(screen.getByRole('button', { name: 'Вкладка' }))
    expect(toggleOf('Проверить тариф')).toHaveAttribute('aria-expanded', 'true')
  })

  it('клик по строке вложенной раскрываемой таблицы раскрывает её строку, внешнюю не трогает', async () => {
    const inner = (r: Task) => (
      <MiniTable label={`История ${r.id}`} columns={[{ id: 'h', header: '', render: (x: Task) => x.history }]} rows={[r]} rowKey={byId} empty="—"
        renderExpanded={() => 'подробности'} />
    )
    renderK(<MiniTable label="Связанные" columns={TASK_COLS.slice(0, 1)} rows={TASKS} rowKey={byId} empty="—" defaultExpanded={['t1']} renderExpanded={inner} />)
    const nested = screen.getByRole('table', { name: 'История t1' })
    await userEvent.click(within(nested).getByText('Назначена · Иванова'))
    expect(within(nested).getByRole('button', { name: 'Свернуть строку 1' })).toHaveAttribute('aria-expanded', 'true')
    expect(toggleOf('Подтвердить маршрут')).toHaveAttribute('aria-expanded', 'true')
  })

  it('без нарушений axe: простая, с номерами и пустым заголовком, раскрываемая с открытой строкой, пустая', async () => {
    const cols: MiniColumn<Ev>[] = [...COLS, { id: 'link', header: '', width: 120, render: () => <a href="#src">Исходное сообщение</a> }]
    const { container } = renderK(<>
      <MiniTable label="Статусы" columns={cols} rows={EVENTS} rowKey={byCode} empty="Статусов нет" numbered />
      <MiniTable label="Задачи" columns={TASK_COLS} rows={TASKS} rowKey={byId} empty="Задач нет" defaultExpanded={['t1']} renderExpanded={(r) => r.history}
        toolbar={<><span>2 задачи</span><button type="button">Перейти</button></>} />
      <MiniTable label="Стриминг" columns={COLS} rows={[]} rowKey={byCode} empty="Событий стриминга нет" />
    </>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

  Run: `pnpm --filter @katran/ui test -- src/table` — FAIL: `Failed to resolve import "./MiniTable"`.
- [ ] **Step 3: компонент.** Создать `packages/ui/src/table/MiniTable.tsx`:

```tsx
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useStableId } from '../compat/useStableId'
import s from './MiniTable.module.css'

export type MiniColumn<T> = {
  id: string
  /** '' — колонка без заголовка (служебная): в строке шапки — пустая ячейка, не columnheader. */
  header: string
  /** Ширина в px при плотности 1; нет — minmax(0, 1fr). */
  width?: number | undefined
  render: (row: T, index: number) => ReactNode
  mono?: boolean | undefined
  align?: 'start' | 'end' | undefined
}

export type MiniTableProps<T> = {
  /** Доступное имя таблицы. */
  label: string
  columns: MiniColumn<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string
  /** Текст пустого состояния (эталон .tt .empty). */
  empty: string
  /** Первая колонка «№» (22 px, моно, приглушённо). */
  numbered?: boolean | undefined
  /** Раскрываемые строки (эталон .ld / .tk): кнопка-шеврон с aria-expanded, клик по строке, панель под строкой. */
  renderExpanded?: ((row: T) => ReactNode) | undefined
  /** Текст строки для имени переключателя: «Раскрыть {rowLabel}» / «Свернуть {rowLabel}»; без него — «Раскрыть строку N». */
  rowLabel?: ((row: T, index: number) => string) | undefined
  /** Управляемый режим — ключи rowKey раскрытых строк. */
  expanded?: string[] | undefined
  defaultExpanded?: string[] | undefined
  onExpandedChange?: ((keys: string[]) => void) | undefined
  /** Полоса над таблицей (эталон .tbar): счётчик слева, кнопки справа. */
  toolbar?: ReactNode | undefined
}

const track = (width: number | undefined) => (width === undefined ? 'minmax(0, 1fr)' : `calc(${width}px * var(--k-density))`)

// Клик по интерактивному внутри строки (ссылка, кнопка, поле) строку не раскрывает — у него своё действие
const INTERACTIVE = 'a[href], button, input, select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])'

/**
 * Компактная таблица вкладок деталки (эталон .tt, index.html:299–342): строка 24, шапка 22, раскрываемая строка 26.
 * Разметка — CSS grid с ролями table/row/columnheader/cell: у раскрываемой строки панель — отдельная строка на всю ширину,
 * а ширины колонок одни для шапки и тела (шаблон в --k-cols, ширины умножаются на плотность, как у ColumnHeader).
 * Раскрываемая строка — не кнопка целиком (внутри свои ссылки и кнопки, axe nested-interactive): переключатель — кнопка-шеврон
 * в последней ячейке; клик мышью по свободному месту строки — тоже переключает. Новый ключ дописывается в конец набора.
 */
export function MiniTable<T>(props: MiniTableProps<T>) {
  const { label, columns, rows, rowKey, empty, numbered, renderExpanded, rowLabel, expanded, defaultExpanded, onExpandedChange, toolbar } = props
  const base = useStableId()
  const [inner, setInner] = useState<string[]>(() => defaultExpanded ?? [])
  const open = expanded ?? inner
  const toggle = (key: string) => {
    const next = open.includes(key) ? open.filter((k) => k !== key) : [...open, key]
    if (expanded === undefined) setInner(next)
    onExpandedChange?.(next)
  }

  // Клик по строке (мышь) — делегированием с тела таблицы: строка — role="row", обработчик на ней самой
  // сделал бы её интерактивным элементом без фокуса; клавиатура и скринридер работают с кнопкой-шевроном
  const body = useRef<HTMLDivElement>(null)
  const toggleRef = useRef(toggle)
  useEffect(() => { toggleRef.current = toggle })
  const expandable = renderExpanded !== undefined
  useEffect(() => {
    const el = body.current
    if (!el || !expandable) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null
      const row = target?.closest<HTMLElement>('[data-k-xrow]')
      // только свои строки: во вложенной таблице панели строки — её собственные
      if (!row || row.parentElement !== el) return
      const hit = target?.closest(INTERACTIVE)
      if (hit && row.contains(hit)) return
      // выделение текста мышью — не раскрытие
      if (String(window.getSelection() ?? '') !== '') return
      toggleRef.current(row.dataset.kXrow ?? '')
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [expandable])

  const bar = toolbar !== undefined ? <div className={s.bar}>{toolbar}</div> : null
  if (rows.length === 0) {
    return (
      <div className={s.root}>
        {bar}
        <div className={s.frame}><p className={s.empty}>{empty}</p></div>
      </div>
    )
  }

  const template = [numbered ? 'var(--k-tt-num)' : null, ...columns.map((c) => track(c.width)), expandable ? 'var(--k-tt-chev)' : null]
    .filter((x): x is string => x !== null)
    .join(' ')
  const cellClass = (c: MiniColumn<T>) => [s.cell, c.mono ? s.mono : ''].filter(Boolean).join(' ')
  const hasHead = columns.some((c) => c.header !== '')

  return (
    <div className={s.root}>
      {bar}
      <div role="table" aria-label={label} className={[s.frame, s.table].join(' ')} style={{ '--k-cols': template } as CSSProperties}>
        {hasHead && (
          <div role="rowgroup">
            <div role="row" className={[s.row, s.head].join(' ')}>
              {numbered && <div role="columnheader" className={s.num}><span className={s.sr}>№</span></div>}
              {columns.map((c) => c.header === ''
                ? <div key={c.id} role="cell" className={s.cell} />
                : <div key={c.id} role="columnheader" className={s.cell} data-align={c.align}>{c.header}</div>)}
              {expandable && <div role="cell" className={s.cell} />}
            </div>
          </div>
        )}
        <div role="rowgroup" ref={body} className={s.body}>
          {rows.map((row, i) => {
            const key = rowKey(row, i)
            const isOpen = expandable && open.includes(key)
            const id = `${base}-${i}`
            return (
              <Fragment key={key}>
                <div role="row" className={[s.row, expandable ? s.xrow : '', isOpen ? s.open : ''].filter(Boolean).join(' ')} data-k-xrow={expandable ? key : undefined}>
                  {numbered && <div role="cell" className={s.num}>{i + 1}</div>}
                  {columns.map((c) => (
                    <div key={c.id} role="cell" className={cellClass(c)} data-align={c.align}>{c.render(row, i)}</div>
                  ))}
                  {expandable && (
                    <div role="cell" className={s.cell}>
                      {/* имя — действие и строка: кнопок в таблице столько же, сколько строк, и имена различимы */}
                      <button type="button" className={s.toggle} aria-expanded={isOpen} aria-controls={`${id}-p`} onClick={() => toggle(key)}>
                        <span className={s.sr}>{`${isOpen ? 'Свернуть' : 'Раскрыть'} ${rowLabel ? rowLabel(row, i) : `строку ${i + 1}`}`}</span>
                        <span className={s.chev} aria-hidden="true">▼</span>
                      </button>
                    </div>
                  )}
                </div>
                {expandable && (
                  <div role="row" className={s.panelRow} hidden={!isOpen}>
                    <div role="cell" id={`${id}-p`} className={s.panel}>{isOpen ? renderExpanded(row) : null}</div>
                  </div>
                )}
              </Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

  Создать `packages/ui/src/table/index.ts`:

```ts
export { MiniTable, type MiniColumn, type MiniTableProps } from './MiniTable'
```

  В `packages/ui/src/index.ts` после строки `export * from './form'` добавить `export * from './table'`.
- [ ] **Step 4: стили.** Создать `packages/ui/src/table/MiniTable.module.css` (правило «последняя строка без нижней границы» стоит после `.xrow` и `.panel` — иначе stylelint `no-descending-specificity`; отрицательный `margin` для этого не годится — голые `px` вне `border*` запрещены):

```css
/* компактная таблица вкладок деталки (эталон .tt/.tbar/.ld/.tk, index.html:299–342) */
.root {
  display: flex;
  flex-direction: column;
  gap: var(--k-sp-2);
  min-width: 0;
}

/* полоса над таблицей (.tbar): первый элемент — подпись-счётчик, остальное прижато вправо */
.bar {
  display: flex;
  align-items: center;
  gap: var(--k-tt-gap);
  min-height: var(--k-tt-row-x);
}

.bar > :first-child {
  margin-right: auto;
}

.frame {
  border: 1px solid var(--k-line);
  border-radius: var(--k-r-s);
  background: var(--k-paper);
  overflow: hidden;
}

.table {
  font: var(--k-fs-1) / var(--k-lh-1) var(--k-sans);
  color: var(--k-ink);
}

.row {
  display: grid;
  box-sizing: border-box;
  grid-template-columns: var(--k-cols);
  gap: 0 var(--k-tt-gap);
  align-items: center;
  min-height: var(--k-tt-row);
  padding: 0 var(--k-tt-gap);
  border-bottom: 1px solid var(--k-line2);
}

.head {
  min-height: var(--k-tt-head);
  background: var(--k-sunk);
  font: 600 var(--k-fs-3) / var(--k-lh-3) var(--k-sans);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--k-muted);
}

.body > .row:hover {
  background: var(--k-hover);
}

.xrow {
  min-height: var(--k-tt-row-x);
  cursor: pointer;
}

.cell {
  min-width: 0;
}

.cell[data-align="end"] {
  text-align: end;
}

.mono {
  font-family: var(--k-mono);
}

.num {
  min-width: 0;
  font: var(--k-fs-2) / var(--k-lh-2) var(--k-mono);
  color: var(--k-faint);
  text-align: end;
}

.toggle {
  display: grid;
  place-items: center;
  width: 100%;
  padding: 0;
  border: 0;
  border-radius: var(--k-r-s);
  background: none;
  color: var(--k-faint);
  font: var(--k-fs-3) / var(--k-lh-3) var(--k-sans);
  cursor: pointer;
}

.toggle:focus-visible {
  outline: 2px solid var(--k-val);
  outline-offset: 0;
}

.chev {
  display: inline-block;
}

.open .chev {
  transform: rotate(180deg);
}

/* панель раскрытой строки (эталон .ldb): на всю ширину, подложка sunk */
.panel {
  padding: var(--k-tt-panel-pt) var(--k-tt-gap) var(--k-sp-2);
  border-bottom: 1px solid var(--k-line2);
  background: var(--k-sunk);
}

/* у последней строки нижней границы нет — её даёт рамка таблицы (эталон .tt .tr:last-child, .au>*:last-child);
   у раскрываемых последний элемент тела — строка панели: свёрнутая строка перед ней — последняя видимая */
.body > .row:last-child,
.body > .xrow:nth-last-child(2):not(.open),
.body > :last-child > .panel {
  border-bottom: 0;
}

.empty {
  margin: 0;
  padding: var(--k-tt-empty) var(--k-tt-gap);
  font: var(--k-fs-1) / var(--k-lh-1) var(--k-sans);
  color: var(--k-muted);
  text-align: center;
}

/* только для скринридера — как .sr форм */
.sr {
  position: absolute;
  inline-size: 0;
  block-size: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

- [ ] **Step 5: запуск.** `pnpm --filter @katran/ui test -- src/table` — PASS: `Tests 15 passed`. `pnpm --filter @katran/ui test` — `Tests 331 passed` (316 + 15).
- [ ] **Step 6: проверка.**

```bash
git add packages/tokens/src/tokens.src.ts packages/tokens/src/tokens.css packages/tokens/src/tokens.ts packages/tokens/src/generate.test.ts packages/ui/src/table/MiniTable.tsx packages/ui/src/table/MiniTable.module.css packages/ui/src/table/MiniTable.test.tsx packages/ui/src/table/index.ts packages/ui/src/index.ts
pnpm check
```

  Expected: зелёный; `tokens` 18, `ui` 331, `effector` 49, `apps/pi` 135; eslint без замечаний `jsx-a11y` (обработчик клика строки — `addEventListener` в эффекте, как слой тултипов), stylelint без замечаний, `ES-Check passed`, `CSS: синтаксиса новее chrome >= 88 нет` (`:not(.open)` с одним простым селектором и `:nth-last-child` — Chromium 88 есть).
- [ ] **Step 7: commit.** CHANGELOG — в Task 13.

```bash
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "ui: MiniTable — компактная таблица вкладок деталки: колонки с шириной по плотности, «№», пустое состояние, раскрываемые строки с клавиатуры и мышью"
```

---

### Task 4: Кит — `KeyValueList`, управляемое раскрытие `ConfigForm`, `Disclosure` mono / emptyText

**Files:**
- Create: `packages/ui/src/form/KeyValueList.tsx`
- Test: `packages/ui/src/form/KeyValueList.test.tsx` (новый), `packages/ui/src/form/ConfigForm.test.tsx` (новый `describe`), `packages/ui/src/form/Disclosure.test.tsx` (три теста, axe дополнен), `packages/tokens/src/generate.test.ts` (одна проверка)
- Modify: `packages/ui/src/form/ConfigForm.tsx`, `packages/ui/src/form/Disclosure.tsx`, `packages/ui/src/form/Form.module.css` (дописать в конец), `packages/ui/src/form/index.ts`, `packages/tokens/src/tokens.src.ts` (+ `pnpm gen`: `tokens.css`, `tokens.ts`)

**Interfaces:**
- Consumes: `.sr` из `Form.module.css` (скрытый текст, как у `FieldRow`); механизм тултипов кита — атрибуты `data-k-tip` / `data-k-tip-if="truncated"` (`tooltip/TooltipLayer.tsx`); `--k-density` (ширина подписи из пропса — как у `ColumnHeader`, `calc(${n}px * var(--k-density))`). От задач 2–3 не зависит.
- Produces (экспорт `@katran/ui` через `form/index.ts`), ровно по сквозному контракту:

```ts
type KeyValueItem = { key: string; label: ReactNode; value: ReactNode | null; mono?: boolean | undefined; aside?: ReactNode | undefined; hint?: string | undefined }
type KeyValueListProps = { items: KeyValueItem[]; title?: string | undefined; labelWidth?: number | undefined; columns?: 1 | 2 | undefined }
KeyValueList(props: KeyValueListProps): JSX.Element
// ConfigFormProps += { expanded?: string[] | undefined; onExpandedChange?: ((keys: string[]) => void) | undefined }
// DisclosureProps += { mono?: boolean | undefined; emptyText?: string | undefined }   // для вкладок «Аудит» и «Исходный текст / ED244» (Task 9)
```

  Уточнения контракта (не меняют имён и типов): пустое значение — `null`, `undefined` и `''`; `labelWidth` по умолчанию 150 в одну колонку, в две — по содержимому (`auto`, как `.kvs` эталона), заданная ширина действует в обоих режимах; `title` — `h3` (уровень `Disclosure` кита: во вкладке после `h2` заголовка drawer не рвёт порядок заголовков под axe). Ключи `expanded` у `ConfigForm` — теги полей из схемы (`'50'`, `'B.50'`; раскрываются группами row-mates, как в 2a) и `id` секций; `id` секций не должны совпадать с тегами. `onExpandedChange` зовётся в обоих режимах и получает **полный** новый набор; без `expanded` форма хранит состояние сама (поведение 2a), поэтому вид вкладки передаёт `expanded={ctx.expanded ?? undefined}` — до первого действия пользователя работают умолчания схемы.
- Produces (`Disclosure`, эталон `.au .ah`, `index.html:329–333`): `mono` — заголовок моноширинным 500 12, без капители и разрядки, цвет `ink`, строка заголовка 25 (у обычного блока — 27, `field-row`); корень блока получает класс `mono` и в пустом состоянии. `emptyText` — текст справа у пустого блока вместо «нет данных» (исходники эталона пишут «нет»); `aside` и `count` у пустого блока по-прежнему не показываются. Без новых пропсов — поведение 2a.
- Produces (разметка для e2e и тестов приложения): строка списка в одну колонку — `div[data-kv="<key>"]` c `dt`/`dd`; пустое значение — `dd[data-empty]`.
- Produces (токены, эталон `.xg/.xr/.kvs`, `index.html:281–291, 343–345`, и `.au .ah`, 329): `kv-row` 24, `kv-px` 10, `kv-gap` 14, `kvs-gap` 1, `fs-kv` 11.5, `fs-kvs` 12 (им же — кегль моно-заголовка `Disclosure`), `ah-row` 25.

- [ ] **Step 1: токены.** В `packages/tokens/src/tokens.src.ts` в конец объекта `sizes` (после строк Task 3) добавить:

```ts
  // список «ключ–значение» вкладок деталки (спека 2b §2, эталон .xg/.xr/.kvs, index.html:281–291, 343–345): строка 24,
  // горизонтальный отступ и зазор колонок 10, зазор значений в строке 14, зазор строк сетки .kvs 1; кегли подписи/заголовка 11.5 и .kvs 12
  'kv-row': 24, 'kv-px': 10, 'kv-gap': 14, 'kvs-gap': 1, 'fs-kv': 11.5, 'fs-kvs': 12,
  // моноширинный заголовок сворачиваемого блока (эталон .au .ah, index.html:329): строка 25
  'ah-row': 25,
```

  В `packages/tokens/src/generate.test.ts` в `describe` с проверкой «Общие данные» деталки (после неё) добавить:

```ts
  it('«ключ–значение» вкладок деталки: строка 24, отступ 10, кегли 11.5 и 12 (спека 2b)', () => {
    expect(css).toMatch(/--k-kv-row: calc\(24px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-kv-px: calc\(10px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-fs-kv: calc\(11\.5px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-fs-kvs: calc\(12px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-ah-row: calc\(25px \* var\(--k-density\)\)/)
  })
```

  Run: `pnpm gen && pnpm --filter @katran/tokens test`
  Expected: `tokens.css` и `tokens.ts` перегенерированы (в `git diff` — семь новых: `--k-kv-*`, `--k-kvs-gap`, `--k-fs-kv*`, `--k-ah-row`); тесты токенов PASS, включая «каждый размерный токен объявлен ровно один раз».

- [ ] **Step 2: тесты `KeyValueList` (падают).** Создать `packages/ui/src/form/KeyValueList.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { KeyValueList, type KeyValueItem } from './KeyValueList'

// Данные — вымышленные, по форме групп «Доп. поля» и «Комплаенс» эталона (XTAB, index.html:650–667; compHtml, 1263–1270)
const refs: KeyValueItem[] = [
  { key: '20', label: '20', hint: 'Референс отправителя', value: 'FX2609220000417', mono: true, aside: '15 симв.' },
  { key: '21', label: '21', hint: 'Связанный референс', value: null },
  { key: 'uetr', label: 'UETR', value: '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b', mono: true },
  { key: 'ext', label: 'Внешний референс', value: '' },
]
const row = (key: string) => document.querySelector(`[data-kv="${key}"]`) as HTMLElement

describe('KeyValueList (спека 2b §2)', () => {
  it('заголовок группы — h3; пары — dt/dd в строках списка', () => {
    renderK(<KeyValueList title="Референсы" items={refs} />)
    expect(screen.getByRole('heading', { level: 3, name: 'Референсы' })).toBeInTheDocument()
    const dl = document.querySelector('dl')!
    expect(dl.querySelectorAll('dt')).toHaveLength(4)
    expect(dl.querySelectorAll('dd')).toHaveLength(4)
    expect(within(row('uetr')).getByText('UETR').tagName).toBe('DT')
    expect(within(row('uetr')).getByText('3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b').closest('dd')).not.toBeNull()
  })

  it('без заголовка — без полосы', () => {
    renderK(<KeyValueList items={refs} />)
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('пустое значение (null и пустая строка) — «—» только для глаз, скринридеру «не заполнено»', () => {
    renderK(<KeyValueList items={refs} />)
    for (const key of ['21', 'ext']) {
      const dd = row(key).querySelector('dd')!
      expect(dd).toHaveAttribute('data-empty')
      expect(within(dd).getByText('—')).toHaveAttribute('aria-hidden', 'true')
      expect(within(dd).getByText('не заполнено')).toHaveClass('sr')
    }
    expect(row('20').querySelector('dd')).not.toHaveAttribute('data-empty')
  })

  it('подсказка подписи: тултипом и скрытым текстом; без подсказки строковая подпись — тултип при обрезке', () => {
    renderK(<KeyValueList items={refs} />)
    const dt20 = row('20').querySelector('dt')!
    expect(dt20).toHaveAttribute('data-k-tip', 'Референс отправителя')
    expect(dt20).not.toHaveAttribute('data-k-tip-if')
    expect(dt20).toHaveTextContent('20 · Референс отправителя')
    const dtExt = row('ext').querySelector('dt')!
    expect(dtExt).toHaveAttribute('data-k-tip', 'Внешний референс')
    expect(dtExt).toHaveAttribute('data-k-tip-if', 'truncated')
  })

  it('моноширинное значение и приписка справа', () => {
    renderK(<KeyValueList items={refs} />)
    expect(screen.getByText('FX2609220000417')).toHaveClass('kvMono')
    expect(screen.getByText('15 симв.')).toHaveClass('kvAside')
    expect(screen.getByText('15 симв.').closest('dd')).toBe(row('20').querySelector('dd'))
  })

  it('ширина подписи — px при плотности 1 в calc с --k-density; по умолчанию 150', () => {
    const { unmount } = renderK(<KeyValueList items={refs} />)
    expect(document.querySelector('dl')).toHaveStyle({ '--k-kv-label': 'calc(150px * var(--k-density))' })
    unmount()
    renderK(<KeyValueList items={refs} labelWidth={40} />)
    expect(document.querySelector('dl')).toHaveStyle({ '--k-kv-label': 'calc(40px * var(--k-density))' })
  })

  it('две колонки: dt/dd прямо в сетке .kvs, без рамки; ширина подписи — только заданная', () => {
    const { container } = renderK(<KeyValueList columns={2} items={refs} />)
    const dl = container.querySelector('dl')!
    expect(dl).toHaveClass('kvs')
    expect(Array.from(dl.children).map((el) => el.tagName)).toEqual(['DT', 'DD', 'DT', 'DD', 'DT', 'DD', 'DT', 'DD'])
    expect(dl.getAttribute('style')).toBeNull()
    expect(dl.parentElement).toHaveClass('kvPlain')
  })

  it('подпись — ReactNode (номер поля элементом)', () => {
    renderK(<KeyValueList labelWidth={40} items={[{ key: '32A', label: <b>32A</b>, value: '260922' }]} />)
    expect(screen.getByText('32A').closest('dt')).not.toBeNull()
    expect(screen.getByText('32A').closest('dt')).not.toHaveAttribute('data-k-tip')
  })

  it('без нарушений axe — одна и две колонки', async () => {
    const { container } = renderK(
      <>
        <KeyValueList title="Референсы" items={refs} />
        <KeyValueList columns={2} items={refs} />
      </>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

  Run: `pnpm --filter @katran/ui test -- src/form/KeyValueList`
  Expected: FAIL — `Failed to resolve import "./KeyValueList"`.

- [ ] **Step 3: `KeyValueList`.** Создать `packages/ui/src/form/KeyValueList.tsx`:

```tsx
import { Fragment, type CSSProperties, type ReactNode } from 'react'
import s from './Form.module.css'

export type KeyValueItem = {
  key: string
  label: ReactNode
  /** null / '' — «—», для скринридера «не заполнено» (как FieldRow). */
  value: ReactNode | null
  mono?: boolean | undefined
  /** Справа в строке значения: «16 симв.» (эталон .len). */
  aside?: ReactNode | undefined
  /** Тултип подписи (название SWIFT-поля); дублируется скрытым текстом — тултип не видят клавиатура и скринридер. */
  hint?: string | undefined
}

export type KeyValueListProps = {
  items: KeyValueItem[]
  /** Полоса-заголовок группы (эталон .xg h6). */
  title?: string | undefined
  /** Ширина колонки подписи, px при плотности 1: 40 — номер поля, 150 — по названию, 230 — комплаенс. По умолчанию 150; в 2 колонках — по содержимому. */
  labelWidth?: number | undefined
  /** 2 — сетка «подпись, значение, подпись, значение» (эталон .kvs), без рамок строк. */
  columns?: 1 | 2 | undefined
}

const isEmpty = (v: ReactNode | null): boolean => v === null || v === undefined || v === ''

/**
 * Список «ключ–значение» вкладок деталки (спека 2b §2, эталон .xg/.xr и .kvs, index.html:281–291, 343–345).
 * Разметка — dl: в одну колонку пара dt/dd в строке-div (рамка строки), в две — dt/dd прямо в сетке.
 */
export function KeyValueList({ items, title, labelWidth, columns = 1 }: KeyValueListProps) {
  const width = labelWidth ?? (columns === 1 ? 150 : undefined)
  const style = width === undefined ? undefined : ({ '--k-kv-label': `calc(${width}px * var(--k-density))` } as CSSProperties)
  const pair = (it: KeyValueItem) => {
    const empty = isEmpty(it.value)
    // подсказка — название поля; без неё обрезанная подпись показывает себя целиком тултипом
    const tip = it.hint ?? (typeof it.label === 'string' ? it.label : undefined)
    return (
      <>
        <dt className={s.kvLabel} data-k-tip={tip} data-k-tip-if={it.hint === undefined && tip !== undefined ? 'truncated' : undefined}>
          {it.label}
          {it.hint !== undefined && <span className={s.sr}>{` · ${it.hint}`}</span>}
        </dt>
        <dd className={s.kvValue} data-empty={empty ? '' : undefined}>
          {empty
            ? <><span className={s.kvNone} aria-hidden="true">—</span><span className={s.sr}>не заполнено</span></>
            : <span className={it.mono ? s.kvMono : undefined}>{it.value}</span>}
          {it.aside !== undefined && <span className={s.kvAside}>{it.aside}</span>}
        </dd>
      </>
    )
  }
  return (
    <div className={[s.kv, columns === 2 ? s.kvPlain : ''].filter(Boolean).join(' ')}>
      {title !== undefined && <h3 className={s.kvTitle}>{title}</h3>}
      {columns === 2
        ? <dl className={s.kvs} style={style}>{items.map((it) => <Fragment key={it.key}>{pair(it)}</Fragment>)}</dl>
        : (
          <dl className={s.kvList} style={style}>
            {items.map((it) => <div key={it.key} className={s.kvRow} data-kv={it.key}>{pair(it)}</div>)}
          </dl>
        )}
    </div>
  )
}
```

  В `packages/ui/src/form/index.ts` дописать последней строкой:

```ts
export { KeyValueList, type KeyValueItem, type KeyValueListProps } from './KeyValueList'
```

- [ ] **Step 4: стили.** Дописать в конец `packages/ui/src/form/Form.module.css`:

```css
/* список «ключ–значение» вкладок деталки (спека 2b §2, эталон .xg/.xr/.kvs, index.html:281–291, 343–345) */
.kv {
  border: 1px solid var(--k-line);
  border-radius: var(--k-r-s);
}

.kvPlain {
  border: 0;
  border-radius: 0;
}

.kvTitle {
  margin: 0;
  padding: var(--k-sp-1) var(--k-kv-px);
  border-bottom: 1px solid var(--k-line2);
  background: var(--k-sunk);
  font: 600 var(--k-fs-kv) / var(--k-lh-1) var(--k-sans);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--k-ink2);
}

.kvList,
.kvs {
  margin: 0;
}

/* строка 24 с рамкой снизу (эталон .xr, border-box) */
.kvRow {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: var(--k-kv-label) minmax(0, 1fr);
  gap: 0 var(--k-kv-px);
  align-items: center;
  min-height: var(--k-kv-row);
  padding: 0 var(--k-kv-px);
  border-bottom: 1px solid var(--k-line2);
}

.kvRow:last-child {
  border-bottom: 0;
}

/* две пары в строке (эталон .kvs): подпись — по содержимому, если ширину не задали */
.kvs {
  display: grid;
  grid-template-columns: var(--k-kv-label, auto) minmax(0, 1fr) var(--k-kv-label, auto) minmax(0, 1fr);
  gap: var(--k-kvs-gap) var(--k-kv-px);
  align-items: baseline;
  font-size: var(--k-fs-kvs);
}

.kvLabel {
  min-width: 0;
  overflow: hidden;
  font-size: var(--k-fs-kv);
  color: var(--k-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kvValue {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--k-kv-gap);
  align-items: baseline;
  min-width: 0;
  margin: 0;
  color: var(--k-val);
}

.kvMono {
  font-family: var(--k-mono);
  font-size: var(--k-fs-kvs);
  letter-spacing: -0.01em;
}

.kvNone {
  color: var(--k-faint);
}

.kvAside {
  margin-left: auto;
  font-size: var(--k-fs-3);
  color: var(--k-faint);
}
```

  Run: `pnpm --filter @katran/ui test -- src/form/KeyValueList`
  Expected: PASS (9).

- [ ] **Step 5: тесты управляемого раскрытия `ConfigForm` (падают).** В `packages/ui/src/form/ConfigForm.test.tsx` первой строкой добавить `import { useState } from 'react'`, в конец файла дописать:

```tsx
describe('ConfigForm — управляемое раскрытие (спека 2b §3.3, техдолг M-g)', () => {
  const btn = (tag: string) => within(row(tag) as HTMLElement).getByRole('button')
  const form = (p: { expanded?: string[] | undefined; onExpandedChange?: ((keys: string[]) => void) | undefined; schema?: FormSchema | undefined }) => (
    <ConfigForm schema={p.schema ?? schema} fields={fields} value={(t) => values[t] ?? null} renderSection={section}
      expanded={p.expanded} onExpandedChange={p.onExpandedChange} />
  )

  // хозяин держит набор вне формы — как модель деталки держит $expanded по документу
  function Host({ controlled }: { controlled: boolean }) {
    const [keys, setKeys] = useState<string[] | null>(null)
    const [shown, setShown] = useState(true)
    return (
      <>
        <button type="button" onClick={() => setShown((v) => !v)}>Вкладка</button>
        {shown && (controlled ? form({ expanded: keys ?? undefined, onExpandedChange: setKeys }) : form({}))}
      </>
    )
  }

  it('expanded задаёт раскрытые поля и секции', () => {
    renderK(form({ expanded: ['50', 'budget'] }))
    expect(btn('50')).toHaveAttribute('aria-expanded', 'true')
    expect(btn('52')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Бюджетные реквизиты' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Свернуть все' })).toBeInTheDocument()
  })

  it('управляемый режим: действие отдаёт полный новый набор, а показ меняет только хозяин', async () => {
    const onExpandedChange = vi.fn()
    renderK(form({ expanded: ['50', 'budget'], onExpandedChange }))
    await userEvent.click(btn('52'))
    expect(onExpandedChange).toHaveBeenLastCalledWith(['50', 'budget', '52', '57'])
    expect(btn('52')).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Бюджетные реквизиты' }))
    expect(onExpandedChange).toHaveBeenLastCalledWith(['50'])
    await userEvent.click(screen.getByRole('button', { name: 'Развернуть поля' }))
    expect(onExpandedChange).toHaveBeenLastCalledWith(['budget', '50', '52', '57', '59', '70', '72', 'B.50'])
    await userEvent.click(screen.getByRole('button', { name: 'Свернуть все' }))
    expect(onExpandedChange).toHaveBeenLastCalledWith(['50'])
  })

  it('без expanded форма раскрывает сама, onExpandedChange получает набор с умолчаниями секций', async () => {
    const onExpandedChange = vi.fn()
    const open: FormSchema = { ...schema, sections: [{ id: 'budget', title: 'Бюджетные реквизиты', collapsed: false }] }
    renderK(form({ schema: open, onExpandedChange }))
    expect(screen.getByRole('button', { name: 'Бюджетные реквизиты' })).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(btn('52'))
    expect(btn('52')).toHaveAttribute('aria-expanded', 'true')
    expect(onExpandedChange).toHaveBeenLastCalledWith(['budget', '52', '57'])
  })

  it('раскрытое, хранимое снаружи, переживает размонтирование формы', async () => {
    renderK(<Host controlled />)
    await userEvent.click(btn('52'))
    await userEvent.click(screen.getByRole('button', { name: 'Развернуть все' }))
    await userEvent.click(screen.getByRole('button', { name: 'Вкладка' }))
    expect(row('52')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Вкладка' }))
    expect(btn('52')).toHaveAttribute('aria-expanded', 'true')
    expect(btn('57')).toHaveAttribute('aria-expanded', 'true')
    expect(btn('50')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Бюджетные реквизиты' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('без хозяина раскрытое теряется при размонтировании — поведение 2a, ради которого и нужен управляемый режим', async () => {
    renderK(<Host controlled={false} />)
    await userEvent.click(btn('52'))
    await userEvent.click(screen.getByRole('button', { name: 'Вкладка' }))
    await userEvent.click(screen.getByRole('button', { name: 'Вкладка' }))
    expect(btn('52')).toHaveAttribute('aria-expanded', 'false')
  })

  it('без нарушений axe в управляемом режиме', async () => {
    const { container } = renderK(form({ expanded: ['50', '59', 'budget'] }))
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

  Run: `pnpm --filter @katran/ui test -- src/form/ConfigForm`
  Expected: FAIL — 4 из 6 новых («expanded задаёт…», «управляемый режим…», «без expanded…», «…переживает размонтирование…»); «без хозяина…» и axe проходят, прежние 10 тестов 2a — PASS.

- [ ] **Step 6: `ConfigForm`.** Заменить `packages/ui/src/form/ConfigForm.tsx` целиком (изменения против 2a: два пропса, набор `keys` вместо прямого чтения `open`/`sections`, `commit` — своё состояние только без `expanded`, колбэк — всегда; разметка не меняется):

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
  /**
   * Раскрытые поля (теги из схемы) и секции (id) одним набором; id секций не совпадают с тегами полей.
   * Задан — управляемый режим: форма показывает ровно этот набор, и раскрытие переживает размонтирование
   * (TabPanel размонтирует неактивную вкладку — техдолг M-g). Не задан — своё состояние, как в 2a.
   */
  expanded?: string[] | undefined
  /** Полный новый набор раскрытых после действия пользователя; зовётся в обоих режимах. */
  onExpandedChange?: ((keys: string[]) => void) | undefined
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
export function ConfigForm({ schema, fields, value, present, optionLabels, renderHero, renderBlock, renderSection, expanded, onExpandedChange }: ConfigFormProps) {
  const [open, setOpen] = useState<string[]>([])
  const [sections, setSections] = useState<Record<string, boolean>>({})
  const parts: FormPart[] = [schema, ...(schema.seqB ? [schema.seqB] : [])]
  const filled = (tag: string) => !isEmptyValue(value(tag))
  const groups = mateGroups(parts)
  const allTags = parts.flatMap((p) => [...(p.grid ?? []).flatMap((row) => refsOfRow(row).map(tagOf)), ...(p.text ?? []).map(tagOf)]).filter(filled)
  const hasGrid = (schema.grid?.length ?? 0) > 0 || schema.seqB !== undefined
  const hasFields = hasGrid || (schema.text?.length ?? 0) > 0 || (schema.extra?.length ?? 0) > 0
  const secs = (schema.sections ?? []).map((sec) => ({ sec, content: renderSection ? renderSection(sec.id) : null }))
  const secIds = secs.map(({ sec }) => sec.id)

  // Раскрытое одним набором: поля — теги, секции — id. Своё состояние хранит только отступления секций от умолчания схемы,
  // поэтому смена схемы без перемонтирования берёт умолчания новой — как в 2a.
  const keys = expanded ?? [...open, ...secs.filter(({ sec }) => sections[sec.id] ?? !(sec.collapsed ?? true)).map(({ sec }) => sec.id)]
  const isOpen = (key: string) => keys.includes(key)
  const commit = (next: string[], inner: () => void) => {
    if (expanded === undefined) inner()
    onExpandedChange?.(next)
  }
  const allOpen = allTags.length > 0 && allTags.every(isOpen)
  const anyShut = secs.some(({ sec, content }) => content !== null && !isOpen(sec.id))

  const toggle = (tag: string) => {
    const mates = groups.find((g) => g.includes(tag)) ?? [tag]
    const flip = (cur: string[]) => (cur.includes(tag)
      ? cur.filter((t) => !mates.includes(t))
      : [...cur.filter((t) => !mates.includes(t)), ...mates.filter(filled)])
    commit(flip(keys), () => setOpen(flip))
  }
  const toggleFields = () => commit(
    [...keys.filter((k) => !allTags.includes(k)), ...(allOpen ? [] : allTags)],
    () => setOpen(allOpen ? [] : allTags),
  )
  const toggleSections = () => commit(
    [...keys.filter((k) => !secIds.includes(k)), ...(anyShut ? secIds : [])],
    () => setSections(Object.fromEntries(secIds.map((id) => [id, anyShut]))),
  )
  const setSection = (id: string, o: boolean) => commit(
    o ? [...keys.filter((k) => k !== id), id] : keys.filter((k) => k !== id),
    () => setSections((cur) => ({ ...cur, [id]: o })),
  )

  const cell = (ref: FieldRef, wide: boolean) => {
    const tag = tagOf(ref)
    return (
      <FieldRow key={tag} tag={tag} def={fields[baseOf(tag)]} value={value(tag)} present={present} optionLabels={optionLabels}
        open={isOpen(tag)} onToggle={() => toggle(tag)} wide={wide} />
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
              <button type="button" className={s.link} onClick={toggleFields}>
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
              <button type="button" className={s.link} onClick={toggleSections}>
                {anyShut ? 'Развернуть все' : 'Свернуть все'}
              </button>
            )}
          </div>
          {secs.map(({ sec, content }) => (
            <Disclosure key={sec.id} title={sec.title} empty={content === null} count={content?.count}
              open={isOpen(sec.id)} onOpenChange={(o) => setSection(sec.id, o)}>
              {content?.body}
            </Disclosure>
          ))}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 7: `Disclosure` — `mono` и `emptyText` (тесты, затем код).** В `packages/ui/src/form/Disclosure.test.tsx` перед тестом «без нарушений axe» вставить:

```tsx
  it('mono — класс моноширинного заголовка; без него заголовок прежний', () => {
    renderK(<><Disclosure title="commonSection" mono aside={<span>12 ключей</span>}><p>{'{}'}</p></Disclosure><Disclosure title="Транзакции"><p>x</p></Disclosure></>)
    const monoBtn = screen.getByRole('button', { name: 'commonSection' })
    expect(monoBtn.closest('.blk')).toHaveClass('mono')
    expect(screen.getByText('12 ключей')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Транзакции' }).closest('.blk')).not.toHaveClass('mono')
  })

  it('emptyText — текст пустого блока вместо «нет данных»; aside у пустого не показывается; mono действует и на пустой', () => {
    renderK(<Disclosure title="ED244" empty emptyText="нет" mono aside={<span>0 симв.</span>} />)
    expect(screen.getByText('нет')).toBeInTheDocument()
    expect(screen.queryByText('нет данных')).toBeNull()
    expect(screen.queryByText('0 симв.')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('heading', { name: 'ED244' }).closest('.blk')).toHaveClass('mono')
  })

  it('без emptyText пустой блок — по-прежнему «нет данных»', () => {
    renderK(<Disclosure title="Посредник" empty mono />)
    expect(screen.getByText('нет данных')).toBeInTheDocument()
  })
```

  Там же в тесте «без нарушений axe» заменить рендер на:

```tsx
    const { container } = renderK(<><Disclosure title="Транзакции" count={2}><p>x</p></Disclosure><Disclosure title="Посредник" empty /><Disclosure title="audit" mono defaultOpen><p>y</p></Disclosure><Disclosure title="ED244" mono empty emptyText="нет" /></>)
```

  Run: `pnpm --filter @katran/ui test -- src/form/Disclosure`
  Expected: FAIL — 2 из 3 новых («mono — …», «emptyText — …»); «без emptyText…», axe и прежние 5 — PASS.

  Заменить `packages/ui/src/form/Disclosure.tsx` целиком (изменения против 2a: два пропса, класс `mono` на корне в обоих состояниях, текст пустого блока):

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
  /** Заголовок моноширинным, без капители: ключ секции аудита, имя исходника (эталон .au .ah, index.html:329–333). */
  mono?: boolean | undefined
  /** Текст справа у пустого блока вместо «нет данных» (исходники эталона — «нет»); aside у пустого не показывается. */
  emptyText?: string | undefined
  children?: ReactNode
}

/** Сворачиваемый блок (эталон .blk/.bh/.bb, index.html:167–174): кнопка заголовка с aria-expanded и панель. */
export function Disclosure({ title, aside, count, open, defaultOpen = false, onOpenChange, empty, level = 'block', mono, emptyText, children }: DisclosureProps) {
  const [inner, setInner] = useState(defaultOpen)
  const panel = useStableId()
  const isOpen = open ?? inner
  const set = (v: boolean) => { if (open === undefined) setInner(v); onOpenChange?.(v) }
  const H = level === 'sub' ? 'h4' : 'h3'
  const lv = level === 'sub' ? s.lvSub : s.lvBlock
  const face = mono ? s.mono : ''
  if (empty) {
    return (
      <div className={[s.blk, lv, face, s.empty].filter(Boolean).join(' ')}>
        <div className={s.bh}>
          <H className={s.bhTitle}>{title}</H>
          <span className={s.hint}>{emptyText ?? 'нет данных'}</span>
        </div>
      </div>
    )
  }
  return (
    <div className={[s.blk, lv, face, isOpen ? '' : s.shut].filter(Boolean).join(' ')}>
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

  Дописать в конец `packages/ui/src/form/Form.module.css` (после правил Step 4; специфичность `.mono .bhBtn.bhBtn` — 0,3,0 — выше сброса `.bhBtn.bhBtn`, `.mono .bhTitle` стоит позже `.lvSub .bhTitle` и `.empty .bhTitle` при равной 0,2,0 — пустой моно-блок, как на эталоне, пишет имя цветом `ink`):

```css
/* моноширинный заголовок блока (эталон .au .ah, index.html:329–333): 500 12 моно, строка 25, без капители; правила ниже .bhBtn.bhBtn и .lvSub */
.mono > .bh {
  min-height: var(--k-ah-row);
}

.mono .bhTitle {
  font: 500 var(--k-fs-kvs) / var(--k-lh-1) var(--k-mono);
  letter-spacing: 0;
  text-transform: none;
  color: var(--k-ink);
}

.mono .bhBtn.bhBtn {
  letter-spacing: 0;
  text-transform: none;
}
```

  Run: `pnpm --filter @katran/ui test -- src/form/Disclosure`
  Expected: PASS (9).

- [ ] **Step 8: запуск.**

  Run: `pnpm --filter @katran/ui test -- src/form/`
  Expected: PASS — 4 файла, 41 тест (`ConfigForm` 16, `KeyValueList` 9, `Disclosure` 9, `FieldRow` 7).

  Run: `pnpm --filter @katran/ui build && pnpm lint` (`build` кита — `vite build && tsc --noEmit`, типы проверяются и в тестах)
  Expected: без ошибок (в частности `exactOptionalPropertyTypes` для `expanded={keys ?? undefined}` в тесте, `unit-disallowed-list` stylelint — голых `px` в новых правилах нет).

  Run: `pnpm check`
  Expected: зелёный (приложения `apps/pi`/`apps/demo` не передают новые пропсы `ConfigForm` и `Disclosure` — поведение «Общих» прежнее).

- [ ] **Step 9: commit.**

```bash
git add packages/tokens/src/tokens.src.ts packages/tokens/src/tokens.css packages/tokens/src/tokens.ts packages/tokens/src/generate.test.ts \
  packages/ui/src/form/KeyValueList.tsx packages/ui/src/form/KeyValueList.test.tsx packages/ui/src/form/Form.module.css \
  packages/ui/src/form/ConfigForm.tsx packages/ui/src/form/ConfigForm.test.tsx packages/ui/src/form/Disclosure.tsx packages/ui/src/form/Disclosure.test.tsx packages/ui/src/form/index.ts
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "ui: KeyValueList — список «ключ–значение» вкладок деталки; ConfigForm — управляемое раскрытие expanded/onExpandedChange (техдолг M-g); Disclosure — mono и emptyText"
```

---

### Task 5: Кит — `CodeView` (JSON, SWIFT, XML)

**Files:**
- Create: `packages/ui/src/code/types.ts`, `packages/ui/src/code/json.ts`, `packages/ui/src/code/swift.ts`, `packages/ui/src/code/xml.ts`, `packages/ui/src/code/CodeView.tsx`, `packages/ui/src/code/CodeView.module.css`, `packages/ui/src/code/index.ts`
- Test: `packages/ui/src/code/json.test.ts`, `packages/ui/src/code/swift.test.ts`, `packages/ui/src/code/xml.test.ts`, `packages/ui/src/code/CodeView.test.tsx`, `packages/tokens/src/generate.test.ts` (одна проверка)
- Modify: `packages/ui/src/index.ts`, `packages/tokens/src/tokens.src.ts` (+ `pnpm gen`: `tokens.css`, `tokens.ts`)

**Interfaces:**
- Consumes: `DOMParser` (есть в Chromium 88 и jsdom); токены цвета `sunk`, `ink`, `ink2`, `muted`, `faint`, `val`, `ok`, `bad`, `hover`; `fs-pre` (11.5 — уже есть с 2a, заводить `fs-code` не нужно), `fs-3`, `sp-2`, `mono`. От задач 2–4 не зависит.
- Produces (экспорт `@katran/ui` через `code/index.ts` и `src/index.ts`), ровно по сквозному контракту:

```ts
type CodeLanguage = 'json' | 'xml' | 'swift' | 'text'
type CodeViewProps = { code: string; language: CodeLanguage; label: string }
CodeView(props: CodeViewProps): JSX.Element
type CodeToken = { kind: string; text: string }
type CodeLine = { depth: number; tokens: CodeToken[]; align?: number | undefined }
// внутренние, из index.ts не экспортируются (только тесты модуля):
tokenizeJson(src: string): CodeToken[]          // code/json.ts
tokenizeSwift(src: string): CodeToken[]         // code/swift.ts
layoutXml(src: string): CodeLine[] | null       // code/xml.ts; null — не разобралось; XML_LINE = 92
```

  Виды кусков (`kind`): JSON — `key`, `str`, `num`, `lit` (true/false/null), `punct`; SWIFT — `blk` (`{1:` … `{S:`), `tag` (`:20:`, `:32A:` в начале строки), `uetr`; XML — `xp` (пунктуация), `xt` (имя тега), `xns` (префикс тега), `xa` (имя атрибута), `xans` (префикс атрибута), `xv` (значение), `xx` (текст); `''` — без подсветки.
- Produces (разметка): область — `div[role=region][aria-label][tabindex=0][data-lang]`; JSON/SWIFT/text — `pre` внутри; XML — `div` строк с классом `xl` и `style="--k-d: <глубина>; --k-a: <выравнивание>"`, номер строки — `::before` с CSS-счётчиком (в `textContent` его нет).
- Produces (токены, эталон `pre.sw` / `.sw.xml`, `index.html:347–361`): `code-pt` 6, `code-px` 10, `code-pl` 28, `code-gutter` 46, `code-num` 30. Межстрочный 1.45 — безразмерный, в CSS числом.
- Уточнения против эталона (класс C в `detail-drift.md` заводит Task 13, если сочтёт нужным): битый XML — сырой текст **по строкам** с номерами (на эталоне один блок с номером 1); элемент без атрибутов, чья «голова» длиннее 92 (глубина ≥ 45), выводится строкой тега (на эталоне строка тега терялась); подсветка JSON — лексером по проверенному `JSON.parse` тексту, а не регулярками эталона (регулярки эталона красят числа внутри строк вида `"1250000,00"` и слово `true` внутри строки — тест «число в строке и true в ключе»).

- [ ] **Step 1: токены.** В `packages/tokens/src/tokens.src.ts` в конец объекта `sizes` (после строки Task 4) добавить:

```ts
  // просмотр кода вкладок деталки (спека 2b §2, эталон pre.sw / .sw.xml, index.html:347–361): отступы блока 6 / 10 / 28,
  // поле номеров строк XML 46 (ширина номера 30 + зазор 16)
  'code-pt': 6, 'code-px': 10, 'code-pl': 28, 'code-gutter': 46, 'code-num': 30,
```

  В `packages/tokens/src/generate.test.ts` после проверки Task 4 добавить:

```ts
  it('просмотр кода: поле номеров строк 46, номер 30, отступ SWIFT 28 (спека 2b)', () => {
    expect(css).toMatch(/--k-code-gutter: calc\(46px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-code-num: calc\(30px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-code-pl: calc\(28px \* var\(--k-density\)\)/)
  })
```

  Run: `pnpm gen && pnpm --filter @katran/tokens test`
  Expected: пять новых `--k-code-*` в `tokens.css`; тесты токенов PASS.

- [ ] **Step 2: тесты разборщиков (падают).** Создать `packages/ui/src/code/json.test.ts`:

```ts
import { tokenizeJson } from './json'

describe('tokenizeJson (эталон jsonHtml)', () => {
  it('ключи, строки, числа, литералы и пунктуация; пробелы и переводы строк — без подсветки', () => {
    const src = JSON.stringify({ id: 'FX1', n: -1.5, e: 2e-7, ok: true, z: null, arr: [1, 'a'] }, null, 2)
    expect(tokenizeJson(src)).toEqual([
      { kind: 'punct', text: '{' }, { kind: '', text: '\n  ' },
      { kind: 'key', text: '"id"' }, { kind: 'punct', text: ':' }, { kind: '', text: ' ' }, { kind: 'str', text: '"FX1"' }, { kind: 'punct', text: ',' }, { kind: '', text: '\n  ' },
      { kind: 'key', text: '"n"' }, { kind: 'punct', text: ':' }, { kind: '', text: ' ' }, { kind: 'num', text: '-1.5' }, { kind: 'punct', text: ',' }, { kind: '', text: '\n  ' },
      { kind: 'key', text: '"e"' }, { kind: 'punct', text: ':' }, { kind: '', text: ' ' }, { kind: 'num', text: '2e-7' }, { kind: 'punct', text: ',' }, { kind: '', text: '\n  ' },
      { kind: 'key', text: '"ok"' }, { kind: 'punct', text: ':' }, { kind: '', text: ' ' }, { kind: 'lit', text: 'true' }, { kind: 'punct', text: ',' }, { kind: '', text: '\n  ' },
      { kind: 'key', text: '"z"' }, { kind: 'punct', text: ':' }, { kind: '', text: ' ' }, { kind: 'lit', text: 'null' }, { kind: 'punct', text: ',' }, { kind: '', text: '\n  ' },
      { kind: 'key', text: '"arr"' }, { kind: 'punct', text: ':' }, { kind: '', text: ' ' }, { kind: 'punct', text: '[' }, { kind: '', text: '\n    ' },
      { kind: 'num', text: '1' }, { kind: 'punct', text: ',' }, { kind: '', text: '\n    ' }, { kind: 'str', text: '"a"' }, { kind: '', text: '\n  ' },
      { kind: 'punct', text: ']' }, { kind: '', text: '\n' }, { kind: 'punct', text: '}' },
    ])
  })

  it('экранированные кавычки и двоеточие внутри строки не путают ключ и значение', () => {
    expect(tokenizeJson('{"a\\"b":"x: \\"y\\""}')).toEqual([
      { kind: 'punct', text: '{' }, { kind: 'key', text: '"a\\"b"' }, { kind: 'punct', text: ':' }, { kind: 'str', text: '"x: \\"y\\""' }, { kind: 'punct', text: '}' },
    ])
  })

  it('число в строке и true в ключе — строки, а не число и литерал', () => {
    expect(tokenizeJson('{"true":"42"}').map((t) => t.kind)).toEqual(['punct', 'key', 'punct', 'str', 'punct'])
  })

  it('не JSON — один кусок без подсветки', () => {
    expect(tokenizeJson('{id: 1,}')).toEqual([{ kind: '', text: '{id: 1,}' }])
    expect(tokenizeJson('')).toEqual([{ kind: '', text: '' }])
  })

  it('текст сохраняется дословно: склейка кусков равна исходнику', () => {
    const src = JSON.stringify({ a: { b: [true, false, null, 0, -0.25, 'с кириллицей'] } }, null, 2)
    expect(tokenizeJson(src).map((t) => t.text).join('')).toBe(src)
  })
})
```

  Создать `packages/ui/src/code/swift.test.ts`:

```ts
import { tokenizeSwift } from './swift'

const UETR = '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b'

describe('tokenizeSwift (эталон swiftHtml)', () => {
  it('заголовки блоков, UETR в {121:}, теги полей в начале строки', () => {
    const src = `{1:F01NRDIRUMMAXXX0000000000}{2:I103VKRBRU8KXXXXN}{3:{121:${UETR}}}{4:\n:20:FX2609220000417\n:32A:260922USD1250000,00\n-}{S:{CHK:1A2B}}`
    expect(tokenizeSwift(src)).toEqual([
      { kind: 'blk', text: '{1:' }, { kind: '', text: 'F01NRDIRUMMAXXX0000000000}' },
      { kind: 'blk', text: '{2:' }, { kind: '', text: 'I103VKRBRU8KXXXXN}' },
      { kind: 'blk', text: '{3:' }, { kind: '', text: '{121:' }, { kind: 'uetr', text: UETR }, { kind: '', text: '}}' },
      { kind: 'blk', text: '{4:' }, { kind: '', text: '\n' },
      { kind: 'tag', text: ':20:' }, { kind: '', text: 'FX2609220000417\n' },
      { kind: 'tag', text: ':32A:' }, { kind: '', text: '260922USD1250000,00\n-}' },
      { kind: 'blk', text: '{S:' }, { kind: '', text: '{CHK:1A2B}}' },
    ])
  })

  it('тег не в начале строки и UETR не той формы не подсвечиваются', () => {
    expect(tokenizeSwift('X :20:ABC\n{121:NOT-A-UETR}')).toEqual([{ kind: '', text: 'X :20:ABC\n{121:NOT-A-UETR}' }])
  })

  it('буква опции — одна заглавная: :50K: — тег, :50KX: — нет', () => {
    expect(tokenizeSwift(':50K:/40817\n:50KX:y').map((t) => [t.kind, t.text])).toEqual([['tag', ':50K:'], ['', '/40817\n:50KX:y']])
  })

  it('пустой текст — пустой список', () => {
    expect(tokenizeSwift('')).toEqual([])
  })
})
```

  Создать `packages/ui/src/code/xml.test.ts` (порог: «голова» тега `<r a="…" b="…"/>` на глубине 0 — `13 + |a| + |b|`, ровно 92 — в строку, 93 — столбиком):

```ts
import { layoutXml, XML_LINE } from './xml'
import type { CodeLine } from './types'

// строка как текст — для компактных ожиданий; вид кусков проверяется отдельно
const text = (l: CodeLine) => l.tokens.map((t) => t.text).join('')
const shape = (lines: CodeLine[] | null) => (lines ?? []).map((l) => ({ depth: l.depth, align: l.align, text: text(l) }))

describe('layoutXml (эталон xmlHtml, XML_LINE=92)', () => {
  it('порог — 92 знака', () => {
    expect(XML_LINE).toBe(92)
  })

  it('вложенность — глубина строки; пустой элемент — самозакрывающийся; короткий текст — в строке тега', () => {
    expect(shape(layoutXml('<a><b x="1"/><c>t</c><d><e/></d></a>'))).toEqual([
      { depth: 0, align: undefined, text: '<a>' },
      { depth: 1, align: undefined, text: '<b x="1"/>' },
      { depth: 1, align: undefined, text: '<c>t</c>' },
      { depth: 1, align: undefined, text: '<d>' },
      { depth: 2, align: undefined, text: '<e/>' },
      { depth: 1, align: undefined, text: '</d>' },
      { depth: 0, align: undefined, text: '</a>' },
    ])
  })

  it('виды кусков: пунктуация, имя, префикс, атрибут, значение, текст', () => {
    const lines = layoutXml('<ed:ED244 xmlns:ed="urn:cbr-ru:ed:v2.0" EDNo="1"><ed:A>t</ed:A></ed:ED244>')!
    expect(lines[0]!.tokens).toEqual([
      { kind: 'xp', text: '<' }, { kind: 'xns', text: 'ed:' }, { kind: 'xt', text: 'ED244' },
      { kind: '', text: ' ' }, { kind: 'xans', text: 'xmlns:' }, { kind: 'xa', text: 'ed' }, { kind: 'xp', text: '="' }, { kind: 'xv', text: 'urn:cbr-ru:ed:v2.0' }, { kind: 'xp', text: '"' },
      { kind: '', text: ' ' }, { kind: 'xa', text: 'EDNo' }, { kind: 'xp', text: '="' }, { kind: 'xv', text: '1' }, { kind: 'xp', text: '"' },
      { kind: 'xp', text: '>' },
    ])
    expect(lines[1]!.tokens).toEqual([
      { kind: 'xp', text: '<' }, { kind: 'xns', text: 'ed:' }, { kind: 'xt', text: 'A' }, { kind: 'xp', text: '>' },
      { kind: 'xx', text: 't' },
      { kind: 'xp', text: '</' }, { kind: 'xns', text: 'ed:' }, { kind: 'xt', text: 'A' }, { kind: 'xp', text: '>' },
    ])
  })

  it('объявление <?xml?> — первой строкой с атрибутами', () => {
    const lines = layoutXml('<?xml version="1.0" encoding="UTF-8"?>\n<a/>')!
    expect(lines[0]!.tokens).toEqual([
      { kind: 'xp', text: '<?xml' },
      { kind: '', text: ' ' }, { kind: 'xa', text: 'version' }, { kind: 'xp', text: '="' }, { kind: 'xv', text: '1.0' }, { kind: 'xp', text: '"' },
      { kind: '', text: ' ' }, { kind: 'xa', text: 'encoding' }, { kind: 'xp', text: '="' }, { kind: 'xv', text: 'UTF-8' }, { kind: 'xp', text: '"' },
      { kind: 'xp', text: '?>' },
    ])
    expect(shape(lines).slice(1)).toEqual([{ depth: 0, align: undefined, text: '<a/>' }])
  })

  // «голова» тега: 2 × глубина + имя + 2 + Σ(имя атрибута + значение + 4); у <r a="…" b="…"/> на глубине 0 — 13 + |a| + |b|
  it('92 знака — атрибуты в строке тега', () => {
    const a = 'A'.repeat(40)
    const b = 'B'.repeat(39)
    expect(shape(layoutXml(`<r a="${a}" b="${b}"/>`))).toEqual([{ depth: 0, align: undefined, text: `<r a="${a}" b="${b}"/>` }])
  })

  it('93 знака — атрибуты столбиком, выравнивание под первым атрибутом (имя + 2 ch)', () => {
    const a = 'A'.repeat(40)
    const b = 'B'.repeat(40)
    expect(shape(layoutXml(`<r a="${a}" b="${b}"/>`))).toEqual([
      { depth: 0, align: undefined, text: `<r a="${a}"` },
      { depth: 0, align: 3, text: `b="${b}"/>` },
    ])
  })

  it('глубина входит в длину: тот же тег на глубине 1 уходит в столбик на 2 знака раньше', () => {
    const a = 'A'.repeat(40)
    const b = 'B'.repeat(38)
    expect(layoutXml(`<p><r a="${a}" b="${b}"/></p>`)).toHaveLength(4)
    expect(layoutXml(`<p><r a="${a}" b="${'B'.repeat(37)}"/></p>`)).toHaveLength(3)
  })

  it('длинный единственный текст — отдельной строкой глубже тега', () => {
    const long = 'Т'.repeat(90)
    expect(shape(layoutXml(`<a><Purp>${long}</Purp></a>`))).toEqual([
      { depth: 0, align: undefined, text: '<a>' },
      { depth: 1, align: undefined, text: '<Purp>' },
      { depth: 2, align: undefined, text: long },
      { depth: 1, align: undefined, text: '</Purp>' },
      { depth: 0, align: undefined, text: '</a>' },
    ])
  })

  it('смешанное содержимое: текст между элементами — своей строкой; комментарии и инструкции пропускаются; CDATA — текст', () => {
    expect(shape(layoutXml('<!-- до --><a>до<b/><!-- c --><?pi x?><![CDATA[1 < 2]]></a>'))).toEqual([
      { depth: 0, align: undefined, text: '<a>' },
      { depth: 1, align: undefined, text: 'до' },
      { depth: 1, align: undefined, text: '<b/>' },
      { depth: 1, align: undefined, text: '1 < 2' },
      { depth: 0, align: undefined, text: '</a>' },
    ])
  })

  it('значения атрибутов и текст — дословно, сущности раскрыты', () => {
    expect(shape(layoutXml('<a t="&lt;img src=x onerror=1&gt;">&amp;&lt;b&gt;</a>'))).toEqual([
      { depth: 0, align: undefined, text: '<a t="<img src=x onerror=1>">&<b></a>' },
    ])
  })

  it('битый XML и пустая строка — null', () => {
    expect(layoutXml('<a><b></a>')).toBeNull()
    expect(layoutXml('<a>')).toBeNull()
    expect(layoutXml('')).toBeNull()
    expect(layoutXml('{1:F01NRDIRUMMAXXX}')).toBeNull()
  })
})
```

  Run: `pnpm --filter @katran/ui test -- src/code/`
  Expected: FAIL — `Failed to resolve import "./json"` (`./swift`, `./xml`).

- [ ] **Step 3: типы и разборщики.** Создать `packages/ui/src/code/types.ts`:

```ts
/** Кусок подсвеченного текста: kind — класс подсветки, '' — без подсветки. Рендер — только React-элементы, текст экранирует React. */
export type CodeToken = { kind: string; text: string }
/** Строка разобранного XML: глубина (отступ 2ch на уровень) и выравнивание атрибута столбиком (в ch). */
export type CodeLine = { depth: number; tokens: CodeToken[]; align?: number | undefined }
```

  Создать `packages/ui/src/code/json.ts`:

```ts
import type { CodeToken } from './types'

// Лексемы JSON; строка проверена JSON.parse, поэтому лексер разбирает только корректный текст
const LEX = /("(?:[^"\\]|\\.)*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(true|false|null)|([{}[\],:])|(\s+)/g

/**
 * Подсветка JSON (эталон jsonHtml, index.html:1187): ключи, строки, числа, литералы true/false/null, пунктуация.
 * На входе — текст JSON (потребитель делает JSON.stringify(x, null, 2)); не JSON — один кусок без подсветки.
 */
export function tokenizeJson(src: string): CodeToken[] {
  try {
    JSON.parse(src)
  } catch {
    return [{ kind: '', text: src }]
  }
  const out: CodeToken[] = []
  LEX.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = LEX.exec(src)) !== null) {
    const [text, str, num, lit, punct] = m
    if (str !== undefined) {
      // ключ — строка, за которой (через пробелы) идёт двоеточие
      const rest = src.slice(LEX.lastIndex)
      out.push({ kind: /^\s*:/.test(rest) ? 'key' : 'str', text })
    } else if (num !== undefined) out.push({ kind: 'num', text })
    else if (lit !== undefined) out.push({ kind: 'lit', text })
    else if (punct !== undefined) out.push({ kind: 'punct', text })
    else out.push({ kind: '', text })
  }
  return out
}
```

  Создать `packages/ui/src/code/swift.ts` (одно регулярное выражение из трёх веток эталона: `\{(\d|S):`, `^(:\d{2}[A-Z]?:)` с флагом `m`, `\{121:([0-9a-f-]{36})\}`):

```ts
import type { CodeToken } from './types'

// Эталон swiftHtml (index.html:1207): заголовки блоков {1: … {S:, теги полей в начале строки :20: / :32A:, UETR в {121:…}
const SWIFT = /\{(?:\d|S):|^:\d{2}[A-Z]?:|\{121:([0-9a-f-]{36})\}/gm

const push = (out: CodeToken[], kind: string, text: string) => {
  if (text === '') return
  const last = out[out.length - 1]
  if (kind === '' && last !== undefined && last.kind === '') last.text += text
  else out.push({ kind, text })
}

/** Подсветка сообщения SWIFT MT: blk — заголовок блока, tag — тег поля, uetr — UETR; соседние куски без подсветки склеены. */
export function tokenizeSwift(src: string): CodeToken[] {
  const out: CodeToken[] = []
  SWIFT.lastIndex = 0
  let at = 0
  let m: RegExpExecArray | null
  while ((m = SWIFT.exec(src)) !== null) {
    push(out, '', src.slice(at, m.index))
    const [text, uetr] = m
    if (uetr !== undefined) {
      push(out, '', '{121:')
      push(out, 'uetr', uetr)
      push(out, '', '}')
    } else push(out, text.charAt(0) === '{' ? 'blk' : 'tag', text)
    at = SWIFT.lastIndex
  }
  push(out, '', src.slice(at))
  return out
}
```

  Создать `packages/ui/src/code/xml.ts` (формулы эталона `xmlHtml` без изменений: `headLen = 2d + |имя| + 2 + Σ(|атрибут| + |значение| + 4)`, текст в строке тега при `headLen + |текст| + |имя| + 3 ≤ 92`, выравнивание столбика — `|имя| + 2`):

```ts
import type { CodeLine, CodeToken } from './types'

/** Ширина строки в знаках, до которой атрибуты остаются в строке тега (эталон XML_LINE, index.html:1206). */
export const XML_LINE = 92

const P = (text: string): CodeToken => ({ kind: 'xp', text })
const X = (text: string): CodeToken => ({ kind: 'xx', text })
const SP: CodeToken = { kind: '', text: ' ' }

// Имя с префиксом пространства имён: префикс с двоеточием приглушён
const name = (n: string, kind: string, nsKind: string): CodeToken[] => {
  const i = n.indexOf(':')
  return i > 0 ? [{ kind: nsKind, text: n.slice(0, i + 1) }, { kind, text: n.slice(i + 1) }] : [{ kind, text: n }]
}
const attr = (a: { name: string; value: string }): CodeToken[] => [...name(a.name, 'xa', 'xans'), P('="'), { kind: 'xv', text: a.value }, P('"')]

// Объявление <?xml …?> DOMParser не отдаёт узлом — берём из текста, как эталон
function declaration(src: string): CodeToken[] | null {
  const decl = /^\s*<\?xml([^?]*)\?>/.exec(src)
  if (decl === null) return null
  const body = decl[1] ?? ''
  const out: CodeToken[] = [P('<?xml')]
  const re = /([\w:.-]+)="([^"]*)"/g
  let at = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    if (m.index > at) out.push({ kind: '', text: body.slice(at, m.index) })
    out.push({ kind: 'xa', text: m[1] ?? '' }, P('="'), { kind: 'xv', text: m[2] ?? '' }, P('"'))
    at = re.lastIndex
  }
  if (at < body.length) out.push({ kind: '', text: body.slice(at) })
  out.push(P('?>'))
  return out
}

/**
 * Раскладка XML по строкам (эталон xmlHtml, index.html:1208–1245): разбор DOMParser, отступ по глубине,
 * атрибуты в строку тега, если «голова» ≤ XML_LINE знаков, иначе столбиком под первым атрибутом;
 * единственный короткий текст — в строке тега; комментарии и инструкции обработки пропускаются, CDATA — как текст.
 * Не разобралось — null: вызывающий показывает сырой текст.
 */
export function layoutXml(src: string): CodeLine[] | null {
  let doc: Document | null = null
  try {
    doc = new DOMParser().parseFromString(src, 'application/xml')
  } catch {
    doc = null
  }
  if (doc === null || doc.getElementsByTagName('parsererror').length > 0 || doc.documentElement === null) return null
  const out: CodeLine[] = []
  const line = (depth: number, tokens: CodeToken[], align?: number) => {
    out.push(align === undefined ? { depth, tokens } : { depth, tokens, align })
  }
  const decl = declaration(src)
  if (decl !== null) line(0, decl)

  const walk = (el: Element, d: number) => {
    const kids = Array.from(el.childNodes).filter((n) => n.nodeType === 1 || ((n.nodeType === 3 || n.nodeType === 4) && (n.nodeValue ?? '').trim() !== ''))
    const attrs = Array.from(el.attributes)
    const tag = el.nodeName
    const open = [P('<'), ...name(tag, 'xt', 'xns')]
    const end = kids.length > 0 ? P('>') : P('/>')
    const close = [P('</'), ...name(tag, 'xt', 'xns'), P('>')]
    const only = kids.length === 1 ? kids[0] : undefined
    const text = only !== undefined && only.nodeType !== 1 ? (only.nodeValue ?? '').trim() : null
    const headLen = d * 2 + tag.length + 2 + attrs.reduce((sum, a) => sum + a.name.length + a.value.length + 4, 0)
    if (headLen <= XML_LINE || attrs.length === 0) {
      const head = [...open, ...attrs.flatMap((a) => [SP, ...attr(a)]), end]
      if (text !== null && headLen + text.length + tag.length + 3 <= XML_LINE) {
        line(d, [...head, X(text), ...close])
        return
      }
      line(d, head)
    } else {
      // столбиком: выравнивание под первым атрибутом — «<» + имя + пробел, в ch моноширинного шрифта
      attrs.forEach((a, k) => {
        const tail = k === attrs.length - 1 ? [end] : []
        if (k === 0) line(d, [...open, SP, ...attr(a), ...tail])
        else line(d, [...attr(a), ...tail], tag.length + 2)
      })
    }
    if (kids.length === 0) return
    if (text !== null) line(d + 1, [X(text)])
    else {
      for (const n of kids) {
        if (n.nodeType === 1) walk(n as Element, d + 1)
        else line(d + 1, [X((n.nodeValue ?? '').trim())])
      }
    }
    line(d, close)
  }
  walk(doc.documentElement, 0)
  return out
}
```

  Run: `pnpm --filter @katran/ui test -- src/code/`
  Expected: PASS — `json` 5, `swift` 4, `xml` 11.

- [ ] **Step 4: тесты `CodeView` (падают).** Создать `packages/ui/src/code/CodeView.test.tsx` (отсутствие `innerHTML` проверяется дважды: поведенчески — `<img onerror>` и `<script>` из данных остаются текстом на всех языках, — и шпионом на сеттере `Element.prototype.innerHTML`: через него React 17 применяет `dangerouslySetInnerHTML`; проверено — шпион ловит `dangerouslySetInnerHTML`):

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { CodeView } from './CodeView'

const HOSTILE = '<img src="x" onerror="window.__kPwned=1"><script>window.__kPwned=1</script>'
const SWIFT = '{1:F01NRDIRUMMAXXX0000000000}{3:{121:3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b}}{4:\n:20:FX2609220000417\n:32A:260922USD1250000,00\n-}'
// без цифр: номера строк — только CSS-счётчиком, в тексте их быть не должно
const XML = '<Document xmlns="urn:iso:std"><Hdr><Id>ABC</Id></Hdr><Purp>оплата по договору</Purp></Document>'

describe('CodeView (спека 2b §2)', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>)['__kPwned']
  })

  it('область: role=region с именем, в порядке Tab', async () => {
    renderK(<CodeView code="{}" language="json" label="audit · commonSection" />)
    const region = screen.getByRole('region', { name: 'audit · commonSection' })
    expect(region).toHaveAttribute('tabindex', '0')
    await userEvent.tab()
    expect(region).toHaveFocus()
  })

  it('JSON: ключи, строки, числа и литералы — своими классами', () => {
    renderK(<CodeView code={JSON.stringify({ id: 'FX1', n: 12, ok: null }, null, 2)} language="json" label="JSON" />)
    expect(screen.getByText('"id"')).toHaveClass('key')
    expect(screen.getByText('"FX1"')).toHaveClass('str')
    expect(screen.getByText('12')).toHaveClass('num')
    expect(screen.getByText('null')).toHaveClass('lit')
    expect(screen.getByRole('region').querySelector('pre')).toHaveTextContent('"id": "FX1"')
  })

  it('не JSON — текст без подсветки', () => {
    renderK(<CodeView code="{id: 1,}" language="json" label="JSON" />)
    const region = screen.getByRole('region')
    expect(region.querySelectorAll('span')).toHaveLength(0)
    expect(region).toHaveTextContent('{id: 1,}')
  })

  it('SWIFT: блоки, теги и UETR', () => {
    renderK(<CodeView code={SWIFT} language="swift" label="SWIFT" />)
    expect(screen.getByText('{1:')).toHaveClass('blk')
    expect(screen.getByText(':20:')).toHaveClass('tag')
    expect(screen.getByText(':32A:')).toHaveClass('tag')
    expect(screen.getByText('3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b')).toHaveClass('uetr')
    expect(screen.getByRole('region').textContent).toBe(SWIFT)
  })

  it('XML: строки с глубиной в --k-d, выравнивание в --k-a; номера строк не входят в текст', () => {
    renderK(<CodeView code={XML} language="xml" label="ED244 · XML" />)
    const region = screen.getByRole('region', { name: 'ED244 · XML' })
    const lines = region.querySelectorAll('.xl')
    expect(Array.from(lines).map((l) => l.textContent)).toEqual([
      '<Document xmlns="urn:iso:std">', '<Hdr>', '<Id>ABC</Id>', '</Hdr>', '<Purp>оплата по договору</Purp>', '</Document>',
    ])
    expect(lines[2]).toHaveStyle({ '--k-d': '2', '--k-a': '0' })
    expect(region.textContent).not.toMatch(/\d/)
  })

  it('XML столбиком: у строк атрибутов --k-a — длина имени + 2', () => {
    const v = 'V'.repeat(45)
    renderK(<CodeView code={`<Tx a="${v}" b="${v}"/>`} language="xml" label="XML" />)
    const lines = screen.getByRole('region').querySelectorAll('.xl')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toHaveStyle({ '--k-d': '0', '--k-a': '4' })
  })

  it('битый XML — сырой текст по строкам, без подсветки', () => {
    renderK(<CodeView code={'<a>\n<b></a>'} language="xml" label="XML" />)
    const lines = screen.getByRole('region').querySelectorAll('.xl')
    expect(Array.from(lines).map((l) => l.textContent)).toEqual(['<a>', '<b></a>'])
    expect(screen.getByRole('region').querySelectorAll('span')).toHaveLength(0)
  })

  it('text — как есть', () => {
    renderK(<CodeView code={'строка 1\nстрока 2'} language="text" label="Текст" />)
    expect(screen.getByRole('region').querySelector('pre')!.textContent).toBe('строка 1\nстрока 2')
  })

  it('разметка в данных — текст на всех языках: ни элементов, ни исполнения', () => {
    renderK(
      <>
        <CodeView code={HOSTILE} language="text" label="text" />
        <CodeView code={JSON.stringify({ h: HOSTILE })} language="json" label="json" />
        <CodeView code={`{4:\n:70:${HOSTILE}\n-}`} language="swift" label="swift" />
        <CodeView code={`<a t="${HOSTILE.replace(/[<>"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)}"/>`} language="xml" label="xml" />
        <CodeView code={HOSTILE} language="xml" label="xml битый" />
      </>,
    )
    expect(document.querySelector('img')).toBeNull()
    expect(document.querySelector('script')).toBeNull()
    expect((window as unknown as Record<string, unknown>)['__kPwned']).toBeUndefined()
    for (const name of ['text', 'swift', 'xml', 'xml битый']) {
      expect(screen.getByRole('region', { name }).textContent).toContain('<img src="x" onerror="window.__kPwned=1">')
    }
  })

  it('innerHTML не используется ни на одном языке', () => {
    const set = vi.spyOn(Element.prototype, 'innerHTML', 'set')
    try {
      renderK(
        <>
          <CodeView code={JSON.stringify({ a: [1, 'b'] })} language="json" label="json" />
          <CodeView code={SWIFT} language="swift" label="swift" />
          <CodeView code={XML} language="xml" label="xml" />
          <CodeView code="<a>" language="xml" label="xml битый" />
        </>,
      )
      expect(set).not.toHaveBeenCalled()
    } finally {
      set.mockRestore()
    }
  })

  it('без нарушений axe', async () => {
    const { container } = renderK(
      <>
        <CodeView code={JSON.stringify({ id: 'FX1' }, null, 2)} language="json" label="JSON" />
        <CodeView code={SWIFT} language="swift" label="SWIFT" />
        <CodeView code={XML} language="xml" label="XML" />
      </>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

  Run: `pnpm --filter @katran/ui test -- src/code/CodeView`
  Expected: FAIL — `Failed to resolve import "./CodeView"`.

- [ ] **Step 5: `CodeView`.** Создать `packages/ui/src/code/CodeView.tsx`. Роль области задана константой `REGION`: правило `jsx-a11y/no-noninteractive-tabindex` (recommended, `allowExpressionValues: true`) пропускает роль-выражение, а `role="region"` литералом с `tabIndex={0}` — ошибка; `eslint-disable` запрещён Global Constraints, а фокусируемость прокручиваемой области требуется спекой и axe (`scrollable-region-focusable`).

```tsx
import { useMemo, type CSSProperties } from 'react'
import { tokenizeJson } from './json'
import { tokenizeSwift } from './swift'
import { layoutXml } from './xml'
import type { CodeLine, CodeToken } from './types'
import s from './CodeView.module.css'

export type CodeLanguage = 'json' | 'xml' | 'swift' | 'text'
export type CodeViewProps = {
  code: string
  language: CodeLanguage
  /** Доступное имя области: «ED244 · XML», «audit · commonSection». */
  label: string
}

// Роль выражением: jsx-a11y (no-noninteractive-tabindex) не считает region интерактивным, а прокручиваемая
// область обязана быть доступна с клавиатуры (WCAG 2.1.1, axe scrollable-region-focusable) — фокус нужен ради прокрутки стрелками.
const REGION = 'region'

// Класс подсветки по виду куска; неизвестный вид — без подсветки
const KIND: Record<string, string | undefined> = {
  key: s.key, str: s.str, num: s.num, lit: s.lit, punct: s.punct,
  blk: s.blk, tag: s.tag, uetr: s.uetr,
  xp: s.xp, xt: s.xt, xns: s.xns, xa: s.xa, xans: s.xans, xv: s.xv, xx: s.xx,
}

// Только React-элементы: текст бека попадает в DOM текстовыми узлами, разметка в нём не исполняется
const tokens = (list: CodeToken[]) => list.map((t, i) => {
  const cls = KIND[t.kind]
  return cls === undefined ? t.text : <span key={i} className={cls}>{t.text}</span>
})

const rawLines = (code: string): CodeLine[] => code.split('\n').map((text) => ({ depth: 0, tokens: [{ kind: '', text }] }))

/**
 * Просмотр кода вкладок деталки (спека 2b §2, эталон pre.sw / .sw.xml, index.html:347–361; jsonHtml, swiftHtml, xmlHtml).
 * JSON и SWIFT — подсветка в pre; XML — строки с отступом по глубине и номером строки CSS-счётчиком
 * (номера не попадают в текст: копирование и скринридер их не видят); битый XML — сырой текст по строкам.
 */
export function CodeView({ code, language, label }: CodeViewProps) {
  const body = useMemo(() => {
    if (language === 'xml') {
      const lines = layoutXml(code) ?? rawLines(code)
      return (
        <div className={s.xml}>
          {lines.map((l, i) => (
            <div key={i} className={s.xl} style={{ '--k-d': String(l.depth), '--k-a': String(l.align ?? 0) } as CSSProperties}>
              {tokens(l.tokens)}
            </div>
          ))}
        </div>
      )
    }
    const list = language === 'json' ? tokenizeJson(code) : language === 'swift' ? tokenizeSwift(code) : [{ kind: '', text: code }]
    return <pre className={s.pre}>{tokens(list)}</pre>
  }, [code, language])
  return (
    <div role={REGION} aria-label={label} tabIndex={0} className={s.code} data-lang={language}>
      {body}
    </div>
  )
}
```

  Создать `packages/ui/src/code/CodeView.module.css` (`ch` — не запрещённая единица stylelint; отступ строки XML — `--k-code-gutter + 2ch × глубина + 1ch × выравнивание + 2ch` с висячим отступом `-2ch`, как `.sw.xml .xl` эталона):

```css
/* просмотр кода (спека 2b §2, эталон pre.sw / .sw.xml, index.html:347–361): моно 11.5 / 1.45 на фоне sunk */
.code {
  box-sizing: border-box;
  overflow: auto;
  background: var(--k-sunk);
  font: var(--k-fs-pre) / 1.45 var(--k-mono);
  color: var(--k-ink2);
}

.code:focus-visible {
  outline: 2px solid var(--k-val);
  outline-offset: -2px;
}

.pre {
  margin: 0;
  padding: var(--k-code-pt) var(--k-code-px) var(--k-sp-2) var(--k-code-pl);
  font: inherit;
  white-space: pre-wrap;
  word-break: break-all;
}

/* JSON (эталон .au pre .k/.s/.num/.nul); пунктуация — цветом текста */
.punct {
  color: var(--k-ink2);
}

.key {
  color: var(--k-bad);
}

.str {
  color: var(--k-ok);
}

.num {
  color: var(--k-val);
}

.lit {
  color: var(--k-muted);
}

/* SWIFT (эталон .sw .blk/.tag4/.uetr) */
.blk {
  color: var(--k-muted);
}

.tag {
  font-weight: 600;
  color: var(--k-bad);
}

.uetr {
  color: var(--k-val);
}

/* XML: строка — блок с отступом по глубине (--k-d) и выравниванием атрибута (--k-a) в ch;
   перенос длинной строки уходит под начало её содержимого (висячий отступ 2ch), номер строки — в поле слева */
.xml {
  padding: var(--k-code-pt) var(--k-code-px) var(--k-sp-2) 0;
  counter-reset: xl;
}

.xl {
  position: relative;
  padding-left: calc(var(--k-code-gutter) + var(--k-d, 0) * 2ch + var(--k-a, 0) * 1ch + 2ch);
  overflow-wrap: anywhere;
  text-indent: -2ch;
  white-space: pre-wrap;
  counter-increment: xl;
}

.xl::before {
  content: counter(xl);
  position: absolute;
  left: 0;
  width: var(--k-code-num);
  font-size: var(--k-fs-3);
  color: var(--k-faint);
  text-align: right;
  text-indent: 0;
  user-select: none;
}

.xl:hover {
  background: var(--k-hover);
}

.xp {
  color: var(--k-faint);
}

.xt {
  font-weight: 600;
  color: var(--k-ink);
}

.xns {
  color: var(--k-muted);
}

.xa {
  color: var(--k-muted);
}

.xans {
  color: var(--k-faint);
}

.xv {
  color: var(--k-val);
}

.xx {
  color: var(--k-ink);
}
```

  Создать `packages/ui/src/code/index.ts`:

```ts
export { CodeView, type CodeLanguage, type CodeViewProps } from './CodeView'
export type { CodeLine, CodeToken } from './types'
```

  В `packages/ui/src/index.ts` дописать последней строкой (если Task 3 уже добавил `export * from './table'` — после неё):

```ts
export * from './code'
```

- [ ] **Step 6: запуск.**

  Run: `pnpm --filter @katran/ui test -- src/code/`
  Expected: PASS — 4 файла, 31 тест (`CodeView` 11, `json` 5, `swift` 4, `xml` 11).

  Run: `pnpm --filter @katran/ui test`
  Expected: PASS — весь кит.

  Run: `pnpm --filter @katran/ui build && pnpm lint` (`build` кита — `vite build && tsc --noEmit`, типы проверяются и в тестах)
  Expected: без ошибок (`noUncheckedIndexedAccess` — индексы через `?? ''` / `!` только в тестах; stylelint — без голых `px`, цвета только `var(--k-*)`).

  Run: `pnpm check`
  Expected: зелёный, включая `check:target`: `es-check` Chromium 88 по `packages/ui/dist/ui.js` (в коде нет `.at`, `replaceAll`, `Object.hasOwn`; `flatMap`, `Array.from`, `catch` без параметра — есть в 88) и `check-css-target` по `ui.css` (`counter-*`, `user-select`, `overflow-wrap: anywhere`, единица `ch` — есть в 88).

- [ ] **Step 7: commit.**

```bash
git add packages/tokens/src/tokens.src.ts packages/tokens/src/tokens.css packages/tokens/src/tokens.ts packages/tokens/src/generate.test.ts \
  packages/ui/src/code/types.ts packages/ui/src/code/json.ts packages/ui/src/code/swift.ts packages/ui/src/code/xml.ts \
  packages/ui/src/code/CodeView.tsx packages/ui/src/code/CodeView.module.css packages/ui/src/code/index.ts \
  packages/ui/src/code/json.test.ts packages/ui/src/code/swift.test.ts packages/ui/src/code/xml.test.ts packages/ui/src/code/CodeView.test.tsx \
  packages/ui/src/index.ts
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "ui: CodeView — подсветка JSON и SWIFT, разобранный XML с номерами строк CSS-счётчиком; только React-элементы, без innerHTML"
```

### Task 6: `shared`: `tabFx` и `parseTab` в `createGridPorts`, виды вкладок в `shared/lib/detail`; фейк — `GET …/documents/{id}/tabs/{tab}`

**Files:**
- Create: `apps/pi/src/shared/lib/detail/remoteTab.ts`, `apps/pi/src/shared/lib/detail/remoteTab.test.ts`, `apps/pi/src/app/fake/fx-docs.trail.ts`, `apps/pi/src/app/fake/rub-docs.trail.ts`
- Modify: `apps/pi/src/shared/api/ports.ts`, `apps/pi/src/shared/api/ports.test.ts`, `apps/pi/src/shared/api/index.ts`, `apps/pi/src/shared/lib/detail/types.ts`, `apps/pi/src/shared/lib/detail/index.ts`, `apps/pi/src/app/fake/grid.ts`, `apps/pi/src/app/fake/server.ts`, `apps/pi/src/app/fake/server.test.ts`, `apps/pi/src/app/fake/params.ts`, `apps/pi/src/app/fake/grids.ts`

**Interfaces:**
- Produces (`shared/api`), дословно по сквозному контракту:

```ts
type TabQuery = { id: string; tab: string }
type TabParser = (raw: unknown, path: string) => unknown
type TabPort = { tabFx: Effect<TabQuery, unknown, ApiError> }
createGridPorts<Row, D>(cfg: GridPortsConfig<Row> & { parseDetail: DetailParser<D>; parseTab: Record<string, TabParser> }): GridPorts<Row> & DetailPort<D> & TabPort
// перегрузки 2a (только parseDetail; только parseRow) — без изменений
```

  `tabFx({ id, tab })` — `GET /grids/{gridId}/documents/{encodeURIComponent(id)}/tabs/{encodeURIComponent(tab)}`. Вкладка без парсера (в том числе ключи прототипа — `toString`) → `contractError('вкладка «<tab>»: нет парсера')` **до** запроса. Ответ — `obj(body, 'ответ')`, затем `parseTab[tab](o, 'ответ')` (как `detailFx`): форма ответа любой вкладки — объект.
  Перегрузки: `parseTab` необязателен при `parseDetail` — существующие `fxDocPorts`/`rubDocPorts` (`{ gridId, parseRow, parseDetail }`) компилируются без изменений и остаются `GridPorts & DetailPort` (без `tabFx`) до Task 10; `tabFx` появляется только при переданном `parseTab`.
- Produces (`shared/lib/detail`): `TabContext`, `LocalTabView<D>`, `RemoteTabView`, `TabView<D>`, `remoteTab<T>(…)` (`remoteTab.ts`), `DetailDomain<D, Row>.tabViews?: Record<string, TabView<D>> | undefined` — по контракту, **плюс** `TabContext.docId: string` (id открытого документа — строка «ID платёжной инструкции» в «Комплаенсе»; уточнение координатора к сквозному контракту, Task 11 заполняет его id слота).
- Produces (фейк):

```ts
// grid.ts
type FakeGrid = { …; tabs?: { ids: readonly string[]; get: (id: string, tab: string) => unknown } | undefined }
type FakeGridOptions<Row> = {
  …
  detail?: ((row: Row, index: number, rows: Row[]) => unknown) | undefined          // + rows: Task 7 строит tabsOff по данным вкладок
  tabs?: { ids: readonly string[]; data: (row: Row, index: number, rows: Row[]) => Record<string, unknown> } | undefined
}
// fx-docs.trail.ts / rub-docs.trail.ts — заглушки, Task 7 наполняет данными, не трогая grids.ts
FX_TRAIL_TABS = ['statuses', 'compliance', 'linked', 'tasks', 'notif', 'source', 'stream', 'mpu', 'audit'] as const
RUB_TRAIL_TABS = ['statuses', 'compliance', 'linked', 'tasks', 'notif', 'ed244', 'stream', 'mpu', 'audit'] as const
fxDocTrail(row, i, rows): Record<FxTrailTab, unknown>;  rubDocTrail(row, i, rows): Record<RubTrailTab, unknown>
```

  Маршрут `GET /grids/{gridId}/documents/{id}/tabs/{tab}`: неизвестный грид → 404 «Неизвестный грид»; у грида нет вкладок или `tab` не из его набора → 404 «Неизвестная вкладка»; регулятор `?fail=tab` → 500 на любой вкладке, `?fail=tab:<id>` → 500 только на вкладке `<id>`; неизвестный документ → 404 «Документ не найден». `id` и `tab` в пути декодируются. `?fail=detail` вкладки не трогает, `?fail=tab` не трогает деталь (регулятор — та же строка `?fail=…`, `params.ts` не меняется, кроме комментария).

- [ ] **Step 1: тесты портов и `remoteTab` (падают).** В `apps/pi/src/shared/api/ports.test.ts` в конец `describe('createGridPorts')` (перед закрывающей `})`) добавить:

```ts
  const noteTab = (raw: unknown, path: string) => ({ text: str(obj(raw, path), 'text', path) })
  const withTabs = createGridPorts({
    gridId: 'docs',
    parseRow: (raw, path) => ({ id: str(obj(raw, path), 'id', path) }),
    parseDetail: (raw, path) => ({ id: str(obj(raw, path), 'id', path) }),
    parseTab: { notes: noteTab, 'x/y': noteTab },
  })
  it('tabFx: GET /grids/docs/documents/{id}/tabs/{tab}, id и tab кодируются; ответ — парсером вкладки', async () => {
    const seen: HttpRequest[] = []
    const scope = fork({ handlers: [[requestFx, async (r: HttpRequest) => { seen.push(r); return { text: 'ок' } }]] })
    const r = await allSettled(withTabs.tabFx, { scope, params: { id: 'a/1', tab: 'x/y' } })
    expect(r).toEqual({ status: 'done', value: { text: 'ок' } })
    expect(seen).toEqual([{ method: 'GET', url: '/grids/docs/documents/a%2F1/tabs/x%2Fy' }])
  })
  it('tabFx: вкладка без парсера — contractError до запроса (и для ключей прототипа)', async () => {
    const seen: HttpRequest[] = []
    const scope = fork({ handlers: [[requestFx, async (r: HttpRequest) => { seen.push(r); return { text: 'ок' } }]] })
    const nope = await allSettled(withTabs.tabFx, { scope, params: { id: 'x', tab: 'nope' } })
    expect(nope.status).toBe('fail')
    expect((nope.value as ApiError).message).toBe(contractError('вкладка «nope»: нет парсера').message)
    const proto = await allSettled(withTabs.tabFx, { scope, params: { id: 'x', tab: 'toString' } })
    expect((proto.value as ApiError).message).toBe(contractError('вкладка «toString»: нет парсера').message)
    expect(seen).toEqual([])
  })
  it('tabFx: ответ не объект или без поля — contractError с путём; отказ транспорта — ApiError со статусом', async () => {
    const notObj = await allSettled(withTabs.tabFx, { scope: fork({ handlers: [[requestFx, async () => [1]]] }), params: { id: 'x', tab: 'notes' } })
    expect((notObj.value as ApiError).message).toBe(contractError('ответ: ожидался объект').message)
    const noField = await allSettled(withTabs.tabFx, { scope: fork({ handlers: [[requestFx, async () => ({})]] }), params: { id: 'x', tab: 'notes' } })
    expect((noField.value as ApiError).message).toContain('ответ.text: ожидалась строка')
    const gone = await allSettled(withTabs.tabFx, { scope: fork({ handlers: [[requestFx, async () => { throw toApiError(404, { type: 't', title: 'Неизвестная вкладка' }) }]] }), params: { id: 'x', tab: 'notes' } })
    expect((gone.value as ApiError).status).toBe(404)
  })
  it('без parseTab порта вкладок нет', () => {
    expect('tabFx' in withDetail).toBe(false)
    expect('detailFx' in withTabs).toBe(true)
  })
```

  Создать `apps/pi/src/shared/lib/detail/remoteTab.test.ts`:

```ts
import { remoteTab } from './remoteTab'
import type { TabContext } from './types'

const ctx: TabContext = { docId: 'doc-1', openDocument: vi.fn(), announce: vi.fn(), expanded: null, setExpanded: vi.fn() }

describe('remoteTab', () => {
  it('вид удалённой вкладки: kind remote, render получает данные и контекст как есть', () => {
    const seen: unknown[] = []
    const view = remoteTab<{ n: number }[]>({ render: (data, c) => { seen.push(data, c); return `строк: ${data.length}` } })
    expect(view.kind).toBe('remote')
    expect(view.render([{ n: 1 }, { n: 2 }], ctx)).toBe('строк: 2')
    expect(seen).toEqual([[{ n: 1 }, { n: 2 }], ctx])
    expect((seen[1] as TabContext).docId).toBe('doc-1')
    expect('skeletonRows' in view).toBe(false)
  })
  it('skeletonRows — только если задан (у «Задач» — 5)', () => {
    expect(remoteTab({ render: () => null, skeletonRows: 5 }).skeletonRows).toBe(5)
  })
})
```

  Run: `pnpm --filter pi test -- ports remoteTab` — FAIL (`tabFx` нет, `./remoteTab` не найден).

- [ ] **Step 2: порты.** Заменить `apps/pi/src/shared/api/ports.ts` целиком:

```ts
import { createEffect, type Effect } from 'effector'
import type { Facet, FacetsQuery, FilterMeta, GridPage, GridQuery } from '@katran/effector'
import { fromFacetsResponse, fromFilterMetaResponse, fromSearchResponse, toFacetsBody, toSearchBody, type RowParser } from './grid-contract'
import { obj } from './guards'
import { contractError, type ApiError } from './problem'
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
/** Запрос одной вкладки деталки (спека 2b §3.1): id документа и id вкладки из FX_TABS / RUB_TABS. */
export type TabQuery = { id: string; tab: string }
/** Парсер данных вкладки: получает объект ответа, бросает contractError. Тип данных знают сущность и её вид вкладки. */
export type TabParser = (raw: unknown, path: string) => unknown
/** Порт вкладок: GET /grids/{gridId}/documents/{id}/tabs/{tab} — предложение в контракт vtb-filters (docs/reference/pi-api.md). */
export type TabPort = { tabFx: Effect<TabQuery, unknown, ApiError> }
export type GridPortsConfig<Row> = { gridId: string; parseRow: RowParser<Row> }

const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

// перегрузки — от полной к простой: TS примеряет первую, и параметры парсеров в литерале остаются неявным any,
// если в первой перегрузке их нет (parseRow и parseDetail есть во всех, где встречаются)
export function createGridPorts<Row, D>(cfg: GridPortsConfig<Row> & { parseDetail: DetailParser<D>; parseTab: Record<string, TabParser> }): GridPorts<Row> & DetailPort<D> & TabPort
export function createGridPorts<Row, D>(cfg: GridPortsConfig<Row> & { parseDetail: DetailParser<D> }): GridPorts<Row> & DetailPort<D>
export function createGridPorts<Row>(cfg: GridPortsConfig<Row>): GridPorts<Row>
export function createGridPorts<Row, D>(
  { gridId, parseRow, parseDetail, parseTab }: GridPortsConfig<Row> & { parseDetail?: DetailParser<D> | undefined; parseTab?: Record<string, TabParser> | undefined },
): GridPorts<Row> | (GridPorts<Row> & DetailPort<D>) | (GridPorts<Row> & DetailPort<D> & TabPort) {
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
  const doc = (id: string) => `${base}/documents/${encodeURIComponent(id)}`
  const detailFx = createEffect<string, D, ApiError>(async (id) =>
    parseDetail(obj(await requestFx({ method: 'GET', url: doc(id) }), 'ответ'), 'ответ'))
  if (!parseTab) return { searchFx, facetsFx, filterMetaFx, detailFx }
  const tabFx = createEffect<TabQuery, unknown, ApiError>(async ({ id, tab }) => {
    // вкладка без парсера — ошибка контракта сущности, запрос не уходит; hasOwn — чтобы «toString» не нашёлся в прототипе
    const parse = hasOwn(parseTab, tab) ? parseTab[tab] : undefined
    if (!parse) throw contractError(`вкладка «${tab}»: нет парсера`)
    return parse(obj(await requestFx({ method: 'GET', url: `${doc(id)}/tabs/${encodeURIComponent(tab)}` }), 'ответ'), 'ответ')
  })
  return { searchFx, facetsFx, filterMetaFx, detailFx, tabFx }
}
```

  В `apps/pi/src/shared/api/index.ts` строку портов заменить на:

```ts
export { createGridPorts, type DetailParser, type DetailPort, type GridPorts, type GridPortsConfig, type TabParser, type TabPort, type TabQuery } from './ports'
```

- [ ] **Step 3: виды вкладок в `shared/lib/detail`.** В `apps/pi/src/shared/lib/detail/types.ts` перед `/** Всё доменное, что виджет деталки получает от сущности …` вставить:

```ts
/** Контекст вида вкладки (спека 2b §3.3): что вкладка может сделать, не зная о виджете. */
export type TabContext = {
  /** id открытого документа — «ID платёжной инструкции» в «Комплаенсе». */
  docId: string
  /** Открыть документ в B (DrawerOpen { id, secondary: true }) — ID связанного документа. */
  openDocument: (id: string) => void
  announce: (message: string) => void
  /** Раскрытые ключи вкладки этого документа; null — пользователь не трогал: вид берёт свои умолчания. */
  expanded: string[] | null
  setExpanded: (keys: string[]) => void
}
/** Вкладка на данных детали («Общие», «Доп. поля») — без запроса. */
export type LocalTabView<D> = { kind: 'local'; render: (detail: D, ctx: TabContext) => ReactNode }
/** Вкладка со своим запросом (tabFx): data — результат parseTab того же id. */
export type RemoteTabView = {
  kind: 'remote'
  render: (data: unknown, ctx: TabContext) => ReactNode
  /** Строк скелетона: по умолчанию 4, у «Задач» 5 (эталон SK.tabBody). */
  skeletonRows?: number | undefined
}
export type TabView<D> = LocalTabView<D> | RemoteTabView
```

  В `DetailDomain<D, Row>` после `renderSection?: …` добавить:

```ts
  /** Виды вкладок по id (спека 2b §3.3); нет вида — вкладка показывает заглушку 2a. */
  tabViews?: Record<string, TabView<D>> | undefined
```

  Создать `apps/pi/src/shared/lib/detail/remoteTab.ts`:

```ts
import type { ReactNode } from 'react'
import type { RemoteTabView, TabContext } from './types'

/**
 * Вид удалённой вкладки с типом данных T. Инвариант: data пришли через parseTab того же id вкладки —
 * сущность держит парсеры и виды одной таблицей ключей (контрактный тест), поэтому приведение здесь безопасно.
 */
export function remoteTab<T>(v: { render: (data: T, ctx: TabContext) => ReactNode; skeletonRows?: number | undefined }): RemoteTabView {
  return {
    kind: 'remote',
    render: (data, ctx) => v.render(data as T, ctx),
    ...(v.skeletonRows !== undefined ? { skeletonRows: v.skeletonRows } : {}),
  }
}
```

  Заменить `apps/pi/src/shared/lib/detail/index.ts` целиком:

```ts
export type { ActionIcon, DetailAction, DetailDomain, DetailSummary, DetailTab, LocalTabView, RemoteTabView, TabContext, TabView } from './types'
export { remoteTab } from './remoteTab'
```

  Run: `pnpm --filter pi test -- ports remoteTab` — PASS.

- [ ] **Step 4: тесты фейка (падают).** В `apps/pi/src/app/fake/server.test.ts` после `const search = …` добавить:

```ts
const get = (url: string): HttpRequest => ({ method: 'GET', url })
const tabbed = (failing?: string) => createFakeServer(
  { docs: fakeGrid(rows, columns, meta, { detail: (r) => r, tabs: { ids: ['notes', 'a/b'], data: (r, i) => ({ notes: { items: [r.name, i] }, 'a/b': { id: r.id } }) } }) },
  failing ? { failing: () => failing } : {},
)
```

  и в конец `describe('фейковый сервер')`:

```ts
  it('GET documents/{id}/tabs/{tab}: данные вкладки документа; id и tab декодируются', async () => {
    const s = tabbed()
    expect(await s(get('/grids/docs/documents/2/tabs/notes'))).toEqual({ items: ['Бета', 1] })
    expect(await s(get('/grids/docs/documents/1/tabs/a%2Fb'))).toEqual({ id: '1' })
  })
  it('вкладки: 404 — неизвестный грид, документ, вкладка не из набора; грид без вкладок', async () => {
    const s = tabbed()
    await expect(s(get('/grids/nope/documents/1/tabs/notes'))).rejects.toMatchObject({ status: 404, problem: { title: 'Неизвестный грид' } })
    await expect(s(get('/grids/docs/documents/nope/tabs/notes'))).rejects.toMatchObject({ status: 404, problem: { title: 'Документ не найден' } })
    await expect(s(get('/grids/docs/documents/1/tabs/audit'))).rejects.toMatchObject({ status: 404, problem: { title: 'Неизвестная вкладка' } })
    await expect(server(get('/grids/docs/documents/1/tabs/notes'))).rejects.toMatchObject({ status: 404, problem: { title: 'Неизвестная вкладка' } })
  })
  it('?fail=tab — 500 на любой вкладке; ?fail=tab:<id> — только на ней; регуляторы детали и вкладок не пересекаются', async () => {
    const any = tabbed('tab')
    await expect(any(get('/grids/docs/documents/1/tabs/notes'))).rejects.toMatchObject({ status: 500 })
    await expect(any(get('/grids/docs/documents/1/tabs/a%2Fb'))).rejects.toMatchObject({ status: 500 })
    await expect(any(get('/grids/docs/documents/1'))).resolves.toEqual(rows[0])
    const one = tabbed('tab:notes')
    await expect(one(get('/grids/docs/documents/1/tabs/notes'))).rejects.toMatchObject({ status: 500, problem: { detail: 'Регулятор ?fail=tab:notes' } })
    await expect(one(get('/grids/docs/documents/1/tabs/a%2Fb'))).resolves.toEqual({ id: '1' })
    const detail = tabbed('detail')
    await expect(detail(get('/grids/docs/documents/1'))).rejects.toMatchObject({ status: 500 })
    await expect(detail(get('/grids/docs/documents/1/tabs/notes'))).resolves.toEqual({ items: ['Альфа', 0] })
  })
  it('деталь получает весь набор строк третьим аргументом (Task 7: tabsOff по данным вкладок)', async () => {
    const s = createFakeServer({ docs: fakeGrid(rows, columns, meta, { detail: (r, i, all) => ({ id: r.id, i, n: all.length }) }) })
    expect(await s(get('/grids/docs/documents/3'))).toEqual({ id: '3', i: 2, n: 3 })
  })
```

  Run: `pnpm --filter pi test -- server` — FAIL (нет маршрута вкладок, опции `tabs`).

- [ ] **Step 5: фейк — грид и маршрут.** В `apps/pi/src/app/fake/grid.ts` заменить типы `FakeGrid`, `FakeGridOptions` и хвост `fakeGrid` (от `const toDetail = opts.detail` до конца функции):

```ts
/** Один грид фейкового сервера: данные, колонки (ключи сортировки) и каталог. Наружу — только JSON контракта. */
export type FakeGrid = {
  meta: FilterMetaDto
  search: (b: SearchBody) => unknown
  facets: (b: FacetsBody) => unknown
  /** Документ по id; null — такого нет (404). Нет поля — у грида нет детали. */
  detail?: ((id: string) => unknown) | undefined
  /** Вкладки деталки (спека 2b §3.5): набор id вкладок грида и данные вкладки документа; null — документа нет (404). */
  tabs?: { ids: readonly string[]; get: (id: string, tab: string) => unknown } | undefined
}

/** Опции фейкового грида. sortLabels — как у createFakeBackend демо (сверка S3): перечисленные ключи сортируются по подписи, а не по коду. */
export type FakeGridOptions<Row> = {
  sortLabels?: Record<string, Record<string, string>> | undefined
  /** Деталь из строки реестра (спека 2a §4.4): index — номер строки в наборе, rows — весь набор (tabsOff считается по данным вкладок, спека 2b §3.5). */
  detail?: ((row: Row, index: number, rows: Row[]) => unknown) | undefined
  /** Вкладки: ids — набор грида (вкладка не из набора — 404), data — ответы всех вкладок документа по id вкладки. */
  tabs?: { ids: readonly string[]; data: (row: Row, index: number, rows: Row[]) => Record<string, unknown> } | undefined
}
```

```ts
  const toDetail = opts.detail
  if (toDetail) {
    grid.detail = (id) => {
      const i = rows.findIndex((r) => r.id === id)
      return i < 0 ? null : toDetail(rows[i]!, i, rows)
    }
  }
  const toTabs = opts.tabs
  if (toTabs) {
    grid.tabs = {
      ids: toTabs.ids,
      get: (id, tab) => {
        const i = rows.findIndex((r) => r.id === id)
        return i < 0 ? null : (toTabs.data(rows[i]!, i, rows)[tab] ?? null)
      },
    }
  }
  return grid
}
```

  В `apps/pi/src/app/fake/server.ts` после `const DOCUMENT = …` добавить:

```ts
const TAB = /^\/grids\/([^/]+)\/documents\/([^/]+)\/tabs\/([^/]+)$/
```

  и в обработчике сразу после задержки (`if (delay > 0) …`), **перед** `const doc = DOCUMENT.exec(req.url)`, вставить:

```ts
    const tabRoute = TAB.exec(req.url)
    if (tabRoute) {
      const [, gridId = '', rawId = '', rawTab = ''] = tabRoute
      const grid = grids[gridId]
      if (!grid) return fail(404, 'Неизвестный грид', gridId)
      const id = decodeURIComponent(rawId)
      const tab = decodeURIComponent(rawTab)
      if (!grid.tabs || !grid.tabs.ids.includes(tab)) return fail(404, 'Неизвестная вкладка', `${gridId}: ${tab}`)
      // ?fail=tab — любая вкладка, ?fail=tab:<id> — одна; ?fail=detail сюда не доходит
      const failing = opts.failing?.() ?? null
      if (failing === 'tab' || failing === `tab:${tab}`) return fail(500, 'Сбой сервера', `Регулятор ?fail=${failing}`)
      const body = grid.tabs.get(id, tab)
      if (body === null || body === undefined) return fail(404, 'Документ не найден', `${gridId}/${id}`)
      return body
    }
```

  В `apps/pi/src/app/fake/params.ts` комментарий заменить на:

```ts
/** Регуляторы стенда в адресе: ?slow=N — задержка ровно N мс (иначе 0,25–0,65 с); ?fail=search|facets|meta|detail — отказ 500; ?fail=tab — 500 на любой вкладке деталки, ?fail=tab:<id> — только на вкладке <id>. */
```

- [ ] **Step 6: фейк — наборы вкладок реестров (заглушки данных).** Создать `apps/pi/src/app/fake/fx-docs.trail.ts`:

```ts
/** Нелокальные вкладки валютного реестра — набор GET …/tabs/{tab} (FX_TABS без main и extra, спека 2b §3.1). */
export const FX_TRAIL_TABS = ['statuses', 'compliance', 'linked', 'tasks', 'notif', 'source', 'stream', 'mpu', 'audit'] as const
export type FxTrailTab = (typeof FX_TRAIL_TABS)[number]

/** Ответы вкладок документа. Заглушка маршрута: данные по эталону — Task 7 (сигнатура станет (row, i, rows)). */
export function fxDocTrail(): Record<FxTrailTab, unknown> {
  return Object.fromEntries(FX_TRAIL_TABS.map((t) => [t, {}])) as Record<FxTrailTab, unknown>
}
```

  Создать `apps/pi/src/app/fake/rub-docs.trail.ts`:

```ts
/** Нелокальные вкладки рублёвого реестра — набор GET …/tabs/{tab} (RUB_TABS без main, спека 2b §3.1). */
export const RUB_TRAIL_TABS = ['statuses', 'compliance', 'linked', 'tasks', 'notif', 'ed244', 'stream', 'mpu', 'audit'] as const
export type RubTrailTab = (typeof RUB_TRAIL_TABS)[number]

/** Ответы вкладок документа. Заглушка маршрута: данные — Task 7 (сигнатура станет (row, i, rows)). */
export function rubDocTrail(): Record<RubTrailTab, unknown> {
  return Object.fromEntries(RUB_TRAIL_TABS.map((t) => [t, {}])) as Record<RubTrailTab, unknown>
}
```

  Заменить `apps/pi/src/app/fake/grids.ts` целиком:

```ts
import { fxDocLayout } from '../../entities/fx-doc'
import { rubDocLayout } from '../../entities/rub-doc'
import { STATUS_LABEL } from '../../entities/doc-status'
import { fakeGrid, type FakeGrid } from './grid'
import { fxDocsMeta, makeFxDocs } from './fx-docs.data'
import { makeFxDocDetail } from './fx-docs.detail'
import { FX_TRAIL_TABS, fxDocTrail } from './fx-docs.trail'
import { rubDocsMeta, makeRubDocs } from './rub-docs.data'
import { makeRubDocDetail } from './rub-docs.detail'
import { RUB_TRAIL_TABS, rubDocTrail } from './rub-docs.trail'

export const fakeGrids: Record<string, FakeGrid> = {
  'fx-docs': fakeGrid(makeFxDocs(), fxDocLayout.columns, fxDocsMeta, {
    sortLabels: { status: STATUS_LABEL }, detail: makeFxDocDetail, tabs: { ids: FX_TRAIL_TABS, data: fxDocTrail },
  }),
  'rub-docs': fakeGrid(makeRubDocs(), rubDocLayout.columns, rubDocsMeta, {
    sortLabels: { status: STATUS_LABEL }, detail: makeRubDocDetail, tabs: { ids: RUB_TRAIL_TABS, data: rubDocTrail },
  }),
}
```

- [ ] **Step 7: запуск.** `pnpm --filter pi test -- ports remoteTab server` — PASS (+4 портов, +2 `remoteTab`, +4 сервера). `pnpm --filter pi test` — PASS целиком (фейк 2a не изменился: `detail` с двумя параметрами совместим с новой сигнатурой). `pnpm check` — зелёный.
- [ ] **Step 8: commit.**

```bash
git add apps/pi/src/shared/api/ports.ts apps/pi/src/shared/api/ports.test.ts apps/pi/src/shared/api/index.ts apps/pi/src/shared/lib/detail/types.ts apps/pi/src/shared/lib/detail/remoteTab.ts apps/pi/src/shared/lib/detail/remoteTab.test.ts apps/pi/src/shared/lib/detail/index.ts apps/pi/src/app/fake/grid.ts apps/pi/src/app/fake/server.ts apps/pi/src/app/fake/server.test.ts apps/pi/src/app/fake/params.ts apps/pi/src/app/fake/grids.ts apps/pi/src/app/fake/fx-docs.trail.ts apps/pi/src/app/fake/rub-docs.trail.ts
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "apps/pi: порт вкладок tabFx с parseTab, виды вкладок деталки (remoteTab, tabViews), фейк GET …/documents/{id}/tabs/{tab} и ?fail=tab"
```

---

### Task 7: `entities/doc-trail` — типы, `toneOf`, мапперы и примеры; данные вкладок фейка, `tabsOff` по данным

Зависит от Task 2 (`BadgeTone` в `@katran/ui`) и Task 6.

**Files:**
- Create: `apps/pi/src/entities/doc-trail/{index.ts, @x/fx-doc.ts, @x/rub-doc.ts, model/types.ts, model/tone.ts, model/tone.test.ts, api/trail.mapper.ts, api/trail.mapper.test.ts, api/trail.example.ts}`
- Create: `apps/pi/src/app/fake/trail.data.ts`
- Modify (заменить целиком): `apps/pi/src/app/fake/fx-docs.trail.ts`, `apps/pi/src/app/fake/rub-docs.trail.ts`
- Modify: `apps/pi/src/app/fake/fx-docs.data.ts` (экспорт `rng`), `apps/pi/src/app/fake/fx-docs.detail.ts`, `apps/pi/src/app/fake/rub-docs.detail.ts`, `apps/pi/src/app/fake/contract.test.ts`, `apps/pi/src/app/details.a11y.test.tsx`
- ESLint: **без правки** `eslint.config.js` — зоны FSD строятся по каталогам (`slicesOf('entities')`), новая сущность получает их автоматически, как `posting` (проверка — Step 9).

**Interfaces:**
- Produces (`entities/doc-trail`, публичный API): типы `StatusEvent`, `Compliance`, `LinkedParty`, `LinkedPosting`, `LinkedDoc`, `DocTask`, `DocNotification`, `StreamEvent`, `MpuMessage`, `AuditSections`, `SourceTexts`, `TrailTabId` — дословно по контракту; `toneOf(code: string): BadgeTone`; `TRAIL_PARSERS: Record<TrailTabId, TabParser>`; `TRAIL_EXAMPLES: Record<TrailTabId, unknown>`. Парсеры по одному (`parseStatuses`, `parseCompliance`, `parseLinked`, `parseTasks`, `parseNotifications`, `parseSourceTexts`, `parseStream`, `parseMpu`, `parseAudit`) — экспорт только из `api/trail.mapper.ts` для тестов.
- Produces (`entities/doc-trail/@x/fx-doc.ts`, `@x/rub-doc.ts`) — для Task 10: `TRAIL_PARSERS` и тип `TrailTabId`. Подключение `parseTab: TRAIL_PARSERS` в `entities/fx-doc/api/ports.ts` и `entities/rub-doc/api/ports.ts` — **Task 10**, не здесь; до него порты сущностей без `tabFx`.
- Форма ответа бека каждой вкладки — объект (порт делает `obj`): списки — под своим ключом (`events`, `documents`, `tasks`, `notifications`, `messages`), `compliance` — объект групп, `audit` — объект секций, `source`/`ed244` — объект «ключ → текст | null». Имена полей бека — только в `trail.mapper.ts`; полная форма — раздел «Для pi-api.md (Task 13)» в конце части.
- Все отметки времени вкладок — ISO 8601 **без зоны**, с миллисекундами или без: `2026-09-22T07:31:45.241` (как `created` реестра; `formatTimestamp` Task 2 обязан разбирать эту форму без сдвига зоны).
- `toneOf`: `ALLOW`, `OK`, `SENT`, `DONE`, `EXPORTED`, `PASSED` → `ok`; `TIMEOUT`, `DENY`, `BLOCK`, `ERROR`, `FAILED`, `REJECTED`, `INVALID` → `bad`; прочее (`REVIEW`, `NEW`, `QUEUED`, `RETRY`, `IN_PROGRESS`, `''`, …) → `wait`; регистр не важен. `DONE`/`EXPORTED`/`PASSED` — сверх перечня контракта: статус связанного документа на эталоне (`DONE` → `.st.ok`).
- Фейк:

```ts
// trail.data.ts
type Step = [route: string | null, code: string, reason: string | null, offsetMs: number]
stamp(base: string, offsetMs: number): string                // ISO без зоны, с мс
isEmptyTab(body: unknown): boolean;  tabsOffOf(ids: readonly string[], trail: Record<string, unknown>): string[]
// fx-docs.trail.ts / rub-docs.trail.ts
fxDocTrail(row: FxDoc, i: number, rows: readonly FxDoc[]): Record<FxTrailTab, unknown>
rubDocTrail(row: RubDoc, i: number, rows: readonly RubDoc[]): Record<RubTrailTab, unknown>
fxTxId(i: number): string;  rubScenario(row: RubDoc): string;  rubCorrAcc(i: number): string   // общие с деталью
// детали: makeFxDocDetail(row, i, rows) / makeRubDocDetail(row, i, rows); tabsOff = tabsOffOf(<набор реестра>, <trail документа>)
```

  `tabsOff` в katran — **ключи** вкладок (`'notif'`, `'mpu'`), не подписи, как у стенда (`'Нотификации'`); сохраняется. Порядок — порядок набора реестра.

- [ ] **Step 1: `toneOf` (тест падает).** Создать `apps/pi/src/entities/doc-trail/model/tone.test.ts`:

```ts
import { toneOf } from './tone'

// Все коды, которые рисуются бейджем: из данных фейка (Task 7) и эталона (index.html:767–866). Новый код в данных — сюда.
const TONES: [string, 'ok' | 'bad' | 'wait'][] = [
  // решения комплаенса (мониторинг, подразделение, отрицательная нотификация)
  ['ALLOW', 'ok'], ['REVIEW', 'wait'], ['DENY', 'bad'],
  // нотификации
  ['OK', 'ok'], ['TIMEOUT', 'bad'],
  // стриминг и экспорт MPU
  ['SENT', 'ok'], ['RETRY', 'wait'], ['QUEUED', 'wait'],
  // статусы связанных документов: реестры (STATUSES) и эталон (NEW)
  ['DONE', 'ok'], ['EXPORTED', 'ok'], ['NEW', 'wait'], ['IN_PROGRESS', 'wait'], ['TO_EXPORT', 'wait'], ['PROCESSING', 'wait'],
  ['DEFERRED', 'wait'], ['ERROR', 'bad'], ['INVALID', 'bad'], ['REJECTED', 'bad'],
  // проверки аудита
  ['PASSED', 'ok'], ['PENDING', 'wait'],
]

describe('toneOf — одна таблица тонов на все вкладки', () => {
  it('каждый код данных фейка и эталона — свой тон', () => {
    for (const [code, tone] of TONES) expect(toneOf(code), code).toBe(tone)
  })
  it('bad: и коды отказа вне данных; прочее — wait', () => {
    for (const c of ['BLOCK', 'FAILED']) expect(toneOf(c), c).toBe('bad')
    for (const c of ['UNKNOWN', '']) expect(toneOf(c), c).toBe('wait')
  })
  it('регистр не важен', () => {
    expect(toneOf('allow')).toBe('ok')
    expect(toneOf('Timeout')).toBe('bad')
  })
})
```

  Run: `pnpm --filter pi test -- tone` — FAIL (`./tone` не найден).

  Создать `apps/pi/src/entities/doc-trail/model/tone.ts`:

```ts
import type { BadgeTone } from '@katran/ui'

// Эталон: решение комплаенса ALLOW → ok, REVIEW → wait (index.html:1290); нотификация OK → ok, иначе bad (1194);
// стриминг и MPU SENT → ok, иначе wait (1188, 1275); связанный документ DONE → ok (моки 767–770).
const OK = ['ALLOW', 'OK', 'SENT', 'DONE', 'EXPORTED', 'PASSED']
const BAD = ['TIMEOUT', 'DENY', 'BLOCK', 'ERROR', 'FAILED', 'REJECTED', 'INVALID']

/** Тон бейджа по коду решения или статуса — одна таблица на все вкладки doc-trail. */
export function toneOf(code: string): BadgeTone {
  const c = code.toUpperCase()
  if (OK.includes(c)) return 'ok'
  if (BAD.includes(c)) return 'bad'
  return 'wait'
}
```

  Run: `pnpm --filter pi test -- tone` — PASS (3).

- [ ] **Step 2: типы.** Создать `apps/pi/src/entities/doc-trail/model/types.ts`:

```ts
/** Данные вкладок деталки — история обработки документа, общая для валюты и рубля (спека 2b §3.2). Имена бека держит api/trail.mapper.ts. */

/** Строка вкладки «Статусы»: время, маршрут (null — «—»), код шага, причина. */
export type StatusEvent = { at: string; route: string | null; code: string; reason: string | null }

/** Вкладка «Комплаенс»: запись, отрицательная нотификация, мониторинг (ИС4021), подразделение (ОПС3308), история попаданий. */
export type Compliance = {
  record: { id: string; start: string | null; end: string | null; nzr: boolean | null }
  negative: { decision: string | null; direction: string | null; comment: string | null }
  monitoring: { start: string | null; end: string | null; decision: string | null; txId: string | null; requestAt: string | null; clientId: string | null }
  department: { start: string | null; end: string | null; decision: string | null }
  history: { at: string; system: string; department: string }[]
}

export type LinkedParty = { name: string | null; account: string | null; extra: string | null }
/** Сумма — десятичная строка бека без разрядки («1249965.00»); форматирует вид. */
export type LinkedPosting = { account: string | null; amount: string | null; currency: string | null; register: string | null }
/** Связанный документ того же реестра: docId открывается в B. */
export type LinkedDoc = {
  docId: string; date: string; type: string; relation: string; purpose: string | null
  status: string; processed: string | null; posted: string | null; kind: string | null
  debit: LinkedPosting; credit: LinkedPosting; from: LinkedParty; to: LinkedParty
}

/** Задача: state — открыта / закрыта; tone — точка открытой задачи; история — включая закрытие. */
export type DocTask = { id: string; state: 'open' | 'done'; tone: 'ok' | 'info' | 'warn'; type: string; at: string; text: string; who: string | null; history: { at: string; text: string }[] }
export type DocNotification = { at: string; attempts: number; status: string; code: string }
export type StreamEvent = { at: string; system: string; destination: string; event: string; status: string; tries: number }
export type MpuMessage = { id: string; type: string; created: string; exportStatus: string; exported: string | null; receiver: string; docReference: string; docId: string; swift: string }
/** Аудит: секция → объект как есть (показывается JSON). */
export type AuditSections = Record<string, Record<string, unknown>>
/** Исходники: ключ → текст; '' — нет (аккордеон не раскрывается, в заголовке «нет»). */
export type SourceTexts = Record<string, string>
export type TrailTabId = 'statuses' | 'compliance' | 'linked' | 'tasks' | 'notif' | 'source' | 'ed244' | 'stream' | 'mpu' | 'audit'
```

- [ ] **Step 3: тесты мапперов (падают).** Создать `apps/pi/src/entities/doc-trail/api/trail.mapper.test.ts`:

```ts
import { ApiError, type Obj } from '../../../shared/api'
import { TRAIL_EXAMPLES as ex } from './trail.example'
import {
  TRAIL_PARSERS, parseAudit, parseCompliance, parseLinked, parseMpu, parseNotifications, parseSourceTexts, parseStatuses, parseStream, parseTasks,
} from './trail.mapper'

const first = (tab: 'linked' | 'tasks' | 'mpu', key: string): Obj => ((ex[tab] as Obj)[key] as Obj[])[0]!

describe('мапперы doc-trail (примеры pi-api.md)', () => {
  it('statuses: события; пустые маршрут и причина — null', () => {
    const s = parseStatuses(ex.statuses, 'ответ')
    expect(s).toHaveLength(12)
    expect(s[0]).toEqual({ at: '2026-09-22T07:31:45.241', route: null, code: 'fx-dup-check.end', reason: null })
    expect(s[3]).toEqual({ at: '2026-09-22T07:31:48.141', route: 'RT_FX_IN', code: 'fx-in-routing.start', reason: 'Ожидание решения сотрудника' })
    expect(parseStatuses({ events: [{ at: 'x', route: '', statusCode: 'c', reason: '' }] }, 'ответ')).toEqual([{ at: 'x', route: null, code: 'c', reason: null }])
  })
  it('compliance: группы и история под доменными именами', () => {
    expect(parseCompliance(ex.compliance, 'ответ')).toEqual({
      record: { id: '3e854037-b84c-40ee-90e0-440734c1d5e3', start: '2026-09-22T07:31:48.126', end: '2026-09-22T07:31:52.601', nzr: false },
      negative: { decision: null, direction: null, comment: null },
      monitoring: { start: '2026-09-22T07:31:48.220', end: '2026-09-22T07:31:49.601', decision: 'ALLOW', txId: '97cae8c7162531f4093e1db5d7171bde', requestAt: '2026-09-22T07:31:49.354', clientId: 'CLT0000123456789' },
      department: { start: '2026-09-22T07:31:49.719', end: '2026-09-22T07:31:52.601', decision: 'ALLOW' },
      history: [{ at: '2026-09-22T07:31:51', system: '3308_CTRL', department: 'DEP 0417' }],
    })
  })
  it('linked: документ, проводки Дт/Кт, отправитель и получатель', () => {
    const l = parseLinked(ex.linked, 'ответ')
    expect(l).toHaveLength(2)
    expect(l[0]).toEqual({
      docId: 'a18d3c05-b393-4252-a3c1-c93791937ccc', date: '2026-09-23', type: 'InternalFXDOC', relation: 'CHILD',
      purpose: 'MT103 USD 1249965.00 23.09.2026 возврат (1.6.2.2.1.)', status: 'NEW', processed: '2026-09-23T09:02:11', posted: '2026-09-23', kind: 'SHA',
      debit: { account: '40817840100050017762', amount: '1249965.00', currency: 'USD', register: '00010_ClientCurrent' },
      credit: { account: '30110840700000001842', amount: '1249965.00', currency: 'USD', register: '00000_NostroUSD' },
      from: { name: 'SEMENOVA IRINA VLADIMIROVNA', account: '40817840100050017762', extra: null },
      to: { name: 'LAVRENTIEV DMITRY OLEGOVICH', account: '40817840500010042371', extra: 'RETURN OF FX2609220000417' },
    })
  })
  it('tasks: статус и важность бека → state и tone; история с закрытием', () => {
    const t = parseTasks(ex.tasks, 'ответ')
    expect(t.map((x) => [x.state, x.tone, x.who])).toEqual([['done', 'ok', 'Иванова М. П.'], ['open', 'info', null]])
    expect(t[0]!.history).toHaveLength(4)
    expect(t[0]!.history[0]).toEqual({ at: '2026-09-22T07:31:59', text: 'Создана: fx-in-routing' })
    expect(t[0]!.history[3]).toEqual({ at: '2026-09-22T07:33:20', text: 'Закрыта · Иванова М. П.' })
  })
  it('notif, stream, mpu: строки таблиц и сообщения', () => {
    expect(parseNotifications(ex.notif, 'ответ')).toEqual([
      { at: '2026-09-22T07:31:46.000', attempts: 3, status: 'TIMEOUT', code: 'accepted' },
      { at: '2026-09-22T07:33:25.000', attempts: 1, status: 'OK', code: 'confirmAck' },
      { at: '2026-09-22T07:35:02.000', attempts: 3, status: 'TIMEOUT', code: 'confirmCrd' },
    ])
    expect(parseStream(ex.stream, 'ответ')[2]).toEqual({ at: '2026-09-22T07:35:01.902', system: 'DWH', destination: 'Хранилище', event: 'fx_evt_finish', status: 'SENT', tries: 2 })
    const m = parseMpu(ex.mpu, 'ответ')
    expect(m).toHaveLength(1)
    expect(m[0]).toMatchObject({ id: 'ee8bf4eb-5545-4f07-9617-8a5e7106302f', type: 'MT199', exportStatus: 'SENT', exported: '2026-09-22T07:35:47.308', receiver: 'NRDIRUMMXXX', docReference: 'VK2609220000417', docId: '03e8b84b-d1c5-4f07-aa49-8be3e9e4c8e8' })
    expect(m[0]!.swift).toMatch(/^\{1:F01VKRBRU8KXXXX/)
  })
  it('audit: секции как есть; source и ed244: null → пустая строка («нет»)', () => {
    const a = parseAudit(ex.audit, 'ответ')
    expect(Object.keys(a)).toHaveLength(10)
    expect(a.commonSection).toEqual({ creationDate: '2026-09-22T04:31:45.051765Z', paymentServiceProvider: 'SUBOUL', paymentFlow: null, paymentInitiatorSystem: 'ERS.ERS_1', sourceSystem: 'SRC1', resending: false })
    expect(Object.keys(parseSourceTexts(ex.source, 'ответ'))).toEqual(['swiftMessage', 'outgoingSwiftMessage'])
    expect(parseSourceTexts({ swiftMessage: null, outgoingSwiftMessage: 'X' }, 'ответ')).toEqual({ swiftMessage: '', outgoingSwiftMessage: 'X' })
    expect(parseSourceTexts(ex.ed244, 'ответ').ED244).toMatch(/^<\?xml/)
  })
  it('TRAIL_PARSERS: source и ed244 — один парсер; каждый пример разбирается своим парсером', () => {
    expect(TRAIL_PARSERS.source).toBe(TRAIL_PARSERS.ed244)
    for (const [tab, parse] of Object.entries(TRAIL_PARSERS)) expect(() => parse(ex[tab as keyof typeof ex], 'ответ'), tab).not.toThrow()
  })
  it('битая форма — contractError с путём', () => {
    expect(() => parseStatuses({}, 'ответ')).toThrow('ответ.events: ожидался массив')
    expect(() => parseStatuses({ events: [{ at: 1, statusCode: 'c' }] }, 'ответ')).toThrow('ответ.events[0].at: ожидалась строка')
    expect(() => parseCompliance({ ...(ex.compliance as Obj), record: { id: 'r', nzr: 'Нет' } }, 'ответ')).toThrow('ответ.record.nzr: ожидалось true, false или null')
    expect(() => parseCompliance({ ...(ex.compliance as Obj), monitoring: null }, 'ответ')).toThrow('ответ.monitoring: ожидался объект')
    expect(() => parseLinked({ documents: [{ ...first('linked', 'documents'), debit: 'x' }] }, 'ответ')).toThrow('ответ.documents[0].debit: ожидался объект')
    expect(() => parseTasks({ tasks: [{ ...first('tasks', 'tasks'), status: 'CLOSED' }] }, 'ответ')).toThrow('ответ.tasks[0].status: недопустимое значение «CLOSED»')
    expect(() => parseNotifications({ notifications: [{ sentAt: 'x', attempts: '3', status: 'OK', responseCode: 'c' }] }, 'ответ')).toThrow('ответ.notifications[0].attempts: ожидалось число')
    expect(() => parseMpu({ messages: [{ ...first('mpu', 'messages'), swiftText: null }] }, 'ответ')).toThrow('ответ.messages[0].swiftText: ожидалась строка')
    expect(() => parseAudit({ commonSection: 'x' }, 'ответ')).toThrow('ответ.commonSection: ожидался объект')
    expect(() => parseSourceTexts({ ED244: 42 }, 'ответ')).toThrow('ответ.ED244: ожидалась строка или null')
    expect(() => parseStream([], 'ответ')).toThrow(ApiError)
  })
})
```

  Run: `pnpm --filter pi test -- trail.mapper` — FAIL (модулей нет).

- [ ] **Step 4: пример ответов.** Создать `apps/pi/src/entities/doc-trail/api/trail.example.ts` (значения — эталон `DOCS[0]`, `index.html:767–866`, и ED244 первого рублёвого документа, `index.html:895–906`; обезличены, вымышлены; время — без зоны):

```ts
import type { TrailTabId } from '../model/types'

const SWIFT_IN = "{1:F01VKRBRU8KXXXX0427047245}{2:O1030731260922NRDIRUMMXXXX04270806512609220731N}{3:{108:1IBSR00048090722}{111:001}{121:eb6305c9-1f8c-41e3-a3b2-6d7e9f2a4c10}}{4:\n:20:FX2609220000417\n:23B:CRED\n:32A:260922USD1250000,00\n:33B:EUR1148300,00\n:36:1,0886\n:50F:/40817840500010042371\n1/LAVRENTIEV DMITRY OLEGOVICH\n2/ULITSA PROFSOYUZNAYA 83-1-214\n3/RU/MOSCOW, 117279\n:52A:NRDIRUMMXXX\n:53A:BCLHLV22XXX\n:54A:HSTBDEHHXXX\n:56A:MRDNGB2LXXX\n:57A:VKRBRU8KXXX\n:59F:/40817840100050017762\n1/SEMENOVA IRINA VLADIMIROVNA\n2/PROSPEKT MIRA 101-2-45\n3/RU/MOSCOW, 129085\n:70:/INV/ 2026-0417 DD 15.09.2026\nPAYMENT FOR CONSULTING SERVICES\nUNDER CONTRACT 12-45 DD 01.03.2026\nVAT NOT APPLICABLE\n:71A:OUR\n:71F:USD35,00\n:72:/INS/NRDIRUMMXXX\n/ACC/PLEASE CREDIT WITHOUT DELAY\n/REC/REF FX2609220000417\n:77B:/ORDERRES/RU//CONTRACT 12-45 DD 01.03.2026\n-}{5:{MAC:00000000}{CHK:00009443BE30}}{S:{MDG:A35B7A2E46531D1AAD9937DB5DB4CA4F2E3EAEBEF323B6E8EED6769B454F0E91}}"
const SWIFT_OUT = "{1:F01VKRBRU8KXXXX0000000000}{2:I103BCLHLV22XXXXN}{3:{121:eb6305c9-1f8c-41e3-a3b2-6d7e9f2a4c10}}{4:\n:20:VK2609220000417\n:23B:CRED\n:32A:260922USD1250000,00\n:50F:/40817840500010042371\n1/LAVRENTIEV DMITRY OLEGOVICH\n2/ULITSA PROFSOYUZNAYA 83-1-214\n3/RU/MOSCOW, 117279\n:52A:NRDIRUMMXXX\n:57A:VKRBRU8KXXX\n:59F:/40817840100050017762\n1/SEMENOVA IRINA VLADIMIROVNA\n:70:/INV/ 2026-0417 DD 15.09.2026\n:71A:OUR\n-}"
const SWIFT_MPU = "{1:F01VKRBRU8KXXXX0000000000}{2:I199NRDIRUMMXXXXN}{3:{121:eb6305c9-1f8c-41e3-a3b2-6d7e9f2a4c10}}{4:\n:20:VK2609220000417\n:21:FX2609220000417\n:79:YOUR MT103 FX2609220000417 DD 22.09.2026\nUSD 1250000,00 HAS BEEN CREDITED TO\nBENEFICIARY ACCOUNT VALUE 22.09.2026.\nOUR CHARGES USD 35,00 DEDUCTED (71A OUR).\nBEST REGARDS. SETTLEMENTS CENTRE\n-}"
const ED244 = '<?xml version="1.0" encoding="UTF-8"?>\n<ed:ED244 xmlns:ed="urn:cbr-ru:ed:v2.0" EDNo="9818" EDDate="2026-09-24" EDAuthor="2072537694" EDReceiver="4971095821" Sum="7639481" PaymentPrecedence="5">\n  <ed:AccDoc AccDocNo="3741" AccDocDate="2026-09-24"/>\n  <ed:Payer PersonalAcc="40702810064578557830" INN="4340195751" KPP="473897776">\n    <ed:Name>ООО «ХУРЫГУПЯ»</ed:Name>\n    <ed:Bank BIC="049597373" CorrespAcc="30101810508469019375"/>\n  </ed:Payer>\n  <ed:Payee PersonalAcc="40802810820980451081" INN="394831189084">\n    <ed:Name>ИП ТЫСЫЛИОВ ГИБАС ЗУДЫОВИЧ</ed:Name>\n    <ed:Bank BIC="042993195" CorrespAcc="30101810664602335376"/>\n  </ed:Payee>\n  <ed:Purpose>Оплата по счёту № 6945-2101 от 18.07.2026 за оборудование по договору 65-89 от 27.02.2026. В том числе НДС 20% — 18 658.24 руб.</ed:Purpose>\n</ed:ED244>'

/** Примеры ответов GET /grids/{gridId}/documents/{id}/tabs/{tab} — источник примеров в pi-api.md и контрактных тестов. */
export const TRAIL_EXAMPLES: Record<TrailTabId, unknown> = {
  statuses: {
    events: [
      { at: '2026-09-22T07:31:45.241', route: null, statusCode: 'fx-dup-check.end', reason: null },
      { at: '2026-09-22T07:31:45.642', route: 'RT_FX_IN', statusCode: 'fx-in-checks.start', reason: null },
      { at: '2026-09-22T07:31:47.542', route: 'RT_FX_IN', statusCode: 'fx-in-checks.end', reason: null },
      { at: '2026-09-22T07:31:48.141', route: 'RT_FX_IN', statusCode: 'fx-in-routing.start', reason: 'Ожидание решения сотрудника' },
      { at: '2026-09-22T07:33:20.383', route: 'RT_FX_IN', statusCode: 'fx-in-routing.end', reason: null },
      { at: '2026-09-22T07:33:21.709', route: 'RT_FX_CREDIT', statusCode: 'fx-credit-client.start', reason: null },
      { at: '2026-09-22T07:33:22.957', route: 'RT_FX_CREDIT', statusCode: 'fx-credit-client.end', reason: null },
      { at: '2026-09-22T07:33:23.413', route: 'RT_FX_CREDIT', statusCode: 'fx-postprocess.start', reason: null },
      { at: '2026-09-22T07:33:24.312', route: 'RT_FX_CREDIT', statusCode: 'fx-postprocess.end', reason: null },
      { at: '2026-09-22T07:35:00.814', route: 'RT_FX_CREDIT', statusCode: 'fx-accounting.start', reason: null },
      { at: '2026-09-22T07:35:01.820', route: 'RT_FX_CREDIT', statusCode: 'fx-accounting.end', reason: null },
      { at: '2026-09-22T07:35:01.915', route: 'RT_FX_CREDIT', statusCode: 'fx.finish', reason: null },
    ],
  },
  compliance: {
    record: { id: '3e854037-b84c-40ee-90e0-440734c1d5e3', processingStart: '2026-09-22T07:31:48.126', processingEnd: '2026-09-22T07:31:52.601', nzr: false },
    negativeNotification: { decision: null, direction: null, comment: null },
    monitoring: { start: '2026-09-22T07:31:48.220', end: '2026-09-22T07:31:49.601', decision: 'ALLOW', transactionId: '97cae8c7162531f4093e1db5d7171bde', requestedAt: '2026-09-22T07:31:49.354', clientId: 'CLT0000123456789' },
    complianceControl: { start: '2026-09-22T07:31:49.719', end: '2026-09-22T07:31:52.601', decision: 'ALLOW' },
    history: [{ enteredAt: '2026-09-22T07:31:51', controlSystem: '3308_CTRL', departmentCode: 'DEP 0417' }],
  },
  linked: {
    documents: [
      {
        docId: 'a18d3c05-b393-4252-a3c1-c93791937ccc', date: '2026-09-23', docType: 'InternalFXDOC', relation: 'CHILD',
        purpose: 'MT103 USD 1249965.00 23.09.2026 возврат (1.6.2.2.1.)', status: 'NEW', processedAt: '2026-09-23T09:02:11', postingDate: '2026-09-23', kind: 'SHA',
        debit: { account: '40817840100050017762', amount: '1249965.00', currency: 'USD', register: '00010_ClientCurrent' },
        credit: { account: '30110840700000001842', amount: '1249965.00', currency: 'USD', register: '00000_NostroUSD' },
        sender: { name: 'SEMENOVA IRINA VLADIMIROVNA', account: '40817840100050017762', details: null },
        receiver: { name: 'LAVRENTIEV DMITRY OLEGOVICH', account: '40817840500010042371', details: 'RETURN OF FX2609220000417' },
      },
      {
        docId: '5e9b7255-c859-4786-b92a-5315c1b73227', date: '2026-09-22', docType: 'InternalFXFEE', relation: 'CHILD',
        purpose: 'Комиссия за входящий перевод по тарифу OUR', status: 'DONE', processedAt: '2026-09-22T07:35:01', postingDate: '2026-09-22', kind: 'OUR',
        debit: { account: '40817840100050017762', amount: '35.00', currency: 'USD', register: '00010_ClientCurrent' },
        credit: { account: '70601840100000000519', amount: '35.00', currency: 'USD', register: '00020_CommissionIncome' },
        sender: { name: 'SEMENOVA IRINA VLADIMIROVNA', account: '40817840100050017762', details: null },
        receiver: { name: 'VOSTOCHNY KREDIT BANK', account: '70601840100000000519', details: 'Тариф 4.2.1' },
      },
    ],
  },
  tasks: {
    tasks: [
      {
        id: 'task-5d1c0e7a9b20', status: 'DONE', severity: 'OK', taskType: 'PAYMENT_INSTRUCTION', createdAt: '2026-09-22T07:31:59',
        text: 'Требуется подтвердить маршрут; требуется утвердить зачисление по клиентскому счёту 40817840100050017762', assignee: 'Иванова М. П.',
        history: [
          { at: '2026-09-22T07:31:59', event: 'Создана: fx-in-routing' },
          { at: '2026-09-22T07:32:40', event: 'Взята в работу: Иванова М. П.' },
          { at: '2026-09-22T07:33:20', event: 'Решение: маршрут подтверждён, зачисление утверждено' },
          { at: '2026-09-22T07:33:20', event: 'Закрыта · Иванова М. П.' },
        ],
      },
      {
        id: 'task-8f3a61c2d4e7', status: 'OPEN', severity: 'INFO', taskType: 'PAYMENT_INSTRUCTION', createdAt: '2026-09-22T07:35:02',
        text: 'Комиссия USD 35,00 удержана по тарифу OUR; проверить корректность тарифного плана клиента', assignee: null,
        history: [{ at: '2026-09-22T07:35:02', event: 'Создана: fx-accounting' }],
      },
    ],
  },
  notif: {
    notifications: [
      { sentAt: '2026-09-22T07:31:46.000', attempts: 3, status: 'TIMEOUT', responseCode: 'accepted' },
      { sentAt: '2026-09-22T07:33:25.000', attempts: 1, status: 'OK', responseCode: 'confirmAck' },
      { sentAt: '2026-09-22T07:35:02.000', attempts: 3, status: 'TIMEOUT', responseCode: 'confirmCrd' },
    ],
  },
  source: { swiftMessage: SWIFT_IN, outgoingSwiftMessage: SWIFT_OUT },
  ed244: { ED244: ED244 },
  stream: {
    events: [
      { at: '2026-09-22T07:33:24.795', systemCode: 'MSB', systemName: 'Шина сообщений', event: 'fx_evt_credit_end', status: 'SENT', attempts: 1 },
      { at: '2026-09-22T07:35:01.866', systemCode: 'MSB', systemName: 'Шина сообщений', event: 'fx_evt_account_end', status: 'SENT', attempts: 1 },
      { at: '2026-09-22T07:35:01.902', systemCode: 'DWH', systemName: 'Хранилище', event: 'fx_evt_finish', status: 'SENT', attempts: 2 },
    ],
  },
  mpu: {
    messages: [
      {
        id: 'ee8bf4eb-5545-4f07-9617-8a5e7106302f', messageType: 'MT199', createdAt: '2026-09-22T07:35:02.121', exportStatus: 'SENT', exportedAt: '2026-09-22T07:35:47.308',
        receiver: 'NRDIRUMMXXX', docReference: 'VK2609220000417', docId: '03e8b84b-d1c5-4f07-aa49-8be3e9e4c8e8', swiftText: SWIFT_MPU,
      },
    ],
  },
  audit: {
    commonSection: { creationDate: '2026-09-22T04:31:45.051765Z', paymentServiceProvider: 'SUBOUL', paymentFlow: null, paymentInitiatorSystem: 'ERS.ERS_1', sourceSystem: 'SRC1', resending: false },
    documentSection: { docReferenceIn: 'FX2609220000417', docReferenceOut: 'VK2609220000417', messageType: 'MT103', amount: 1250000.0, currency: 'USD', valueDate: '2026-09-22', uetr: 'eb6305c9-1f8c-41e3-a3b2-6d7e9f2a4c10' },
    originalDocumentSection: { receivedAt: '2026-09-22T04:31:44Z', sender: 'NRDIRUMMXXX', receiver: 'VKRBRU8KXXX', rawLength: 612, hash: 'sha256:9f3c…a1e0' },
    statusSections: { count: 12, last: 'fx.finish', lastAt: '2026-09-22T04:35:01.915Z' },
    accountingSection: { debitAccount: '30110840700000001842', creditAccount: '40817840100050017762', postings: 6, executed: 4, canceled: 1, pending: 1 },
    paymentTransactionSections: { transactionId: 'ba5ac473-d0a4-40ea-b639-47326d3b8e45', registers: ['00000_NostroUSD', '00010_ClientCurrent', '00020_CommissionIncome', '00030_FxConversion'] },
    taskSections: { open: 1, closed: 1, lastAssignee: 'Иванова М. П.' },
    outgoingRoutingSections: { routeType: 'NOSTRO', nostroAccount: '30114840900000000517', receiver: 'BCLHLV22XXX', rule: 'USD_EU_COUNTERPARTIES_V3' },
    controlAttributesSection: { complianceCheck: 'PASSED', sanctionsCheck: 'PASSED', duplicateCheck: 'PASSED', manualReview: true },
    manualOperationRecordsSection: { records: 1, last: { at: '2026-09-22T07:42:00Z', user: 'Иванова М. П.', field: '57', action: 'EDIT' } },
  },
}
```

- [ ] **Step 5: мапперы и публичный API.** Создать `apps/pi/src/entities/doc-trail/api/trail.mapper.ts`:

```ts
import { arr, contractError, num, obj, oneOf, str, strOrNull, type Obj, type TabParser } from '../../../shared/api'
import type {
  AuditSections, Compliance, DocNotification, DocTask, LinkedDoc, LinkedParty, LinkedPosting, MpuMessage, SourceTexts, StatusEvent, StreamEvent, TrailTabId,
} from '../model/types'

/** Ответы GET …/documents/{id}/tabs/{tab} → данные вкладок. Если бек называет поля иначе — правится только этот файл. */

/** Необязательный текст: null, отсутствие ключа и '' — «нет значения». */
const text = (o: Obj, k: string, path: string): string | null => strOrNull(o, k, path) || null

function boolOrNull(o: Obj, k: string, path: string): boolean | null {
  const v = o[k]
  if (v === null || v === undefined) return null
  if (typeof v !== 'boolean') throw contractError(`${path}.${k}: ожидалось true, false или null`)
  return v
}
/** Вложенный объект под ключом k и его путь. */
function sub(o: Obj, k: string, path: string): [Obj, string] {
  const p = `${path}.${k}`
  return [obj(o[k], p), p]
}
/** Список объектов под ключом k: путь элемента — с индексом. */
function list<T>(o: Obj, k: string, path: string, item: (x: Obj, p: string) => T): T[] {
  return arr(o[k], `${path}.${k}`).map((x, i) => {
    const p = `${path}.${k}[${i}]`
    return item(obj(x, p), p)
  })
}

export const parseStatuses = (raw: unknown, path: string): StatusEvent[] =>
  list(obj(raw, path), 'events', path, (e, p): StatusEvent => ({ at: str(e, 'at', p), route: text(e, 'route', p), code: str(e, 'statusCode', p), reason: text(e, 'reason', p) }))

export function parseCompliance(raw: unknown, path: string): Compliance {
  const o = obj(raw, path)
  const [rec, pr] = sub(o, 'record', path)
  const [neg, pn] = sub(o, 'negativeNotification', path)
  const [mon, pm] = sub(o, 'monitoring', path)
  const [dep, pd] = sub(o, 'complianceControl', path)
  return {
    record: { id: str(rec, 'id', pr), start: text(rec, 'processingStart', pr), end: text(rec, 'processingEnd', pr), nzr: boolOrNull(rec, 'nzr', pr) },
    negative: { decision: text(neg, 'decision', pn), direction: text(neg, 'direction', pn), comment: text(neg, 'comment', pn) },
    monitoring: {
      start: text(mon, 'start', pm), end: text(mon, 'end', pm), decision: text(mon, 'decision', pm),
      txId: text(mon, 'transactionId', pm), requestAt: text(mon, 'requestedAt', pm), clientId: text(mon, 'clientId', pm),
    },
    department: { start: text(dep, 'start', pd), end: text(dep, 'end', pd), decision: text(dep, 'decision', pd) },
    history: list(o, 'history', path, (h, p) => ({ at: str(h, 'enteredAt', p), system: str(h, 'controlSystem', p), department: str(h, 'departmentCode', p) })),
  }
}

function posting(o: Obj, k: string, path: string): LinkedPosting {
  const [x, p] = sub(o, k, path)
  return { account: text(x, 'account', p), amount: text(x, 'amount', p), currency: text(x, 'currency', p), register: text(x, 'register', p) }
}
function party(o: Obj, k: string, path: string): LinkedParty {
  const [x, p] = sub(o, k, path)
  return { name: text(x, 'name', p), account: text(x, 'account', p), extra: text(x, 'details', p) }
}
export const parseLinked = (raw: unknown, path: string): LinkedDoc[] =>
  list(obj(raw, path), 'documents', path, (d, p): LinkedDoc => ({
    docId: str(d, 'docId', p), date: str(d, 'date', p), type: str(d, 'docType', p), relation: str(d, 'relation', p), purpose: text(d, 'purpose', p),
    status: str(d, 'status', p), processed: text(d, 'processedAt', p), posted: text(d, 'postingDate', p), kind: text(d, 'kind', p),
    debit: posting(d, 'debit', p), credit: posting(d, 'credit', p), from: party(d, 'sender', p), to: party(d, 'receiver', p),
  }))

const TASK_STATUS = ['OPEN', 'DONE'] as const
const TASK_SEVERITY = ['OK', 'INFO', 'WARN'] as const
const TASK_TONE: Record<(typeof TASK_SEVERITY)[number], DocTask['tone']> = { OK: 'ok', INFO: 'info', WARN: 'warn' }
export const parseTasks = (raw: unknown, path: string): DocTask[] =>
  list(obj(raw, path), 'tasks', path, (t, p): DocTask => ({
    id: str(t, 'id', p),
    state: oneOf(t, 'status', TASK_STATUS, p) === 'DONE' ? 'done' : 'open',
    tone: TASK_TONE[oneOf(t, 'severity', TASK_SEVERITY, p)],
    type: str(t, 'taskType', p), at: str(t, 'createdAt', p), text: str(t, 'text', p), who: text(t, 'assignee', p),
    history: list(t, 'history', p, (h, hp) => ({ at: str(h, 'at', hp), text: str(h, 'event', hp) })),
  }))

export const parseNotifications = (raw: unknown, path: string): DocNotification[] =>
  list(obj(raw, path), 'notifications', path, (n, p): DocNotification => ({ at: str(n, 'sentAt', p), attempts: num(n, 'attempts', p), status: str(n, 'status', p), code: str(n, 'responseCode', p) }))

export const parseStream = (raw: unknown, path: string): StreamEvent[] =>
  list(obj(raw, path), 'events', path, (e, p): StreamEvent => ({
    at: str(e, 'at', p), system: str(e, 'systemCode', p), destination: str(e, 'systemName', p),
    event: str(e, 'event', p), status: str(e, 'status', p), tries: num(e, 'attempts', p),
  }))

export const parseMpu = (raw: unknown, path: string): MpuMessage[] =>
  list(obj(raw, path), 'messages', path, (m, p): MpuMessage => ({
    id: str(m, 'id', p), type: str(m, 'messageType', p), created: str(m, 'createdAt', p), exportStatus: str(m, 'exportStatus', p),
    exported: text(m, 'exportedAt', p), receiver: str(m, 'receiver', p), docReference: str(m, 'docReference', p), docId: str(m, 'docId', p),
    swift: str(m, 'swiftText', p),
  }))

/** Аудит: каждая секция — объект, содержимое не проверяется (показывается JSON как есть). */
export function parseAudit(raw: unknown, path: string): AuditSections {
  const o = obj(raw, path)
  const out: AuditSections = {}
  for (const k of Object.keys(o)) out[k] = { ...obj(o[k], `${path}.${k}`) }
  return out
}

/** Исходники: ключ → текст; null — «нет» (пустая строка). Один парсер на source (SWIFT) и ed244 (XML). */
export function parseSourceTexts(raw: unknown, path: string): SourceTexts {
  const o = obj(raw, path)
  const out: SourceTexts = {}
  for (const k of Object.keys(o)) out[k] = strOrNull(o, k, path) ?? ''
  return out
}

/** Таблица parseTab для портов обоих реестров: ключи — ровно TrailTabId (контрактный тест в app/fake). */
export const TRAIL_PARSERS: Record<TrailTabId, TabParser> = {
  statuses: parseStatuses, compliance: parseCompliance, linked: parseLinked, tasks: parseTasks, notif: parseNotifications,
  source: parseSourceTexts, ed244: parseSourceTexts, stream: parseStream, mpu: parseMpu, audit: parseAudit,
}
```

  Создать `apps/pi/src/entities/doc-trail/index.ts`:

```ts
export type {
  AuditSections, Compliance, DocNotification, DocTask, LinkedDoc, LinkedParty, LinkedPosting, MpuMessage, SourceTexts, StatusEvent, StreamEvent, TrailTabId,
} from './model/types'
export { toneOf } from './model/tone'
export { TRAIL_PARSERS } from './api/trail.mapper'
export { TRAIL_EXAMPLES } from './api/trail.example'
```

  Создать `apps/pi/src/entities/doc-trail/@x/fx-doc.ts`:

```ts
/** Публичный API doc-trail для соседней сущности fx-doc (FSD @x): парсеры вкладок для порта (Task 10). */
export type { TrailTabId } from '../model/types'
export { TRAIL_PARSERS } from '../api/trail.mapper'
```

  Создать `apps/pi/src/entities/doc-trail/@x/rub-doc.ts`:

```ts
/** Публичный API doc-trail для соседней сущности rub-doc (FSD @x): парсеры вкладок для порта (Task 10). */
export type { TrailTabId } from '../model/types'
export { TRAIL_PARSERS } from '../api/trail.mapper'
```

  Run: `pnpm --filter pi test -- trail.mapper tone` — PASS (8 + 3).

- [ ] **Step 6: фейк — общие помощники.** В `apps/pi/src/app/fake/fx-docs.data.ts` строку `function rng(seed: number) {` заменить на `export function rng(seed: number) {` (ГПСЧ фейка — для идентификаторов вкладок). Создать `apps/pi/src/app/fake/trail.data.ts`:

```ts
import { rng } from './fx-docs.data'

/**
 * Общее для данных вкладок фейка (спека 2b §3.5). Цепочки, словари и смещения времени — со стенда pi-constructor
 * (index.html:767–920, обезличен); значения — из строки реестра и детерминированно по номеру строки i.
 */
export const pad = (n: number, w: number) => String(n).padStart(w, '0')
/** Исполнители задач — тот же словарь, что у блокировок реестров. */
export const WHO = ['Иванова М. П.', 'Кузнецов Д. А.', 'Смирнова Е. В.']

/** Время события: база (ISO без зоны, как created реестра) плюс смещение в мс → ISO без зоны с мс. */
export function stamp(base: string, offsetMs: number): string {
  return new Date(Date.parse(`${base}Z`) + offsetMs).toISOString().slice(0, 23)
}
/** «ДД.ММ.ГГГГ» и «ГГММДД» (поле 32A) из ISO. */
export const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`
export const yymmdd = (iso: string) => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10)
export const swiftAmount = (n: number) => n.toFixed(2).replace('.', ',')
/** Сумма в ответе вкладки — десятичная строка без разрядки. */
export const decimal = (n: number) => n.toFixed(2)
/** Строки по 35 знаков по границе слова — формат поля 70. */
export const by35 = (s: string) => (s.match(/.{1,35}(?=\s|$)|.{1,35}/g) ?? []).map((x) => x.trim()).filter(Boolean)
/** Адрес логического терминала: BIC8 + «X» + филиал (у 8-значного BIC — «XXX»). */
export const lt = (bic: string) => `${bic.slice(0, 8)}X${bic.slice(8) || 'XXX'}`

/** Шестнадцатеричная строка длины len — детерминированно по номеру строки и соли. */
export function hexOf(i: number, salt: number, len: number): string {
  const r = rng(i * 7919 + salt * 104729 + 1)
  return Array.from({ length: len }, () => Math.floor(r() * 16).toString(16)).join('')
}
export function uuidOf(i: number, salt: number): string {
  const h = hexOf(i, salt, 32)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20)}`
}

/** Шаг цепочки статусов: маршрут (null — «—»), код, причина, смещение от создания в мс. */
export type Step = [route: string | null, code: string, reason: string | null, offsetMs: number]
export const statusEvents = (base: string, steps: Step[]) =>
  ({ events: steps.map(([route, statusCode, reason, ms]) => ({ at: stamp(base, ms), route, statusCode, reason })) })

export type ComplianceOptions = { clientId: string; department: string; review: boolean; deny: string | null }
/** Комплаенс по эталону (DOCS[0] — ALLOW, DOCS[1] — REVIEW, окончание пусто); deny — отказ с отрицательной нотификацией. */
export function complianceOf(base: string, i: number, o: ComplianceOptions) {
  const open = o.review && !o.deny
  return {
    record: { id: uuidOf(i, 11), processingStart: stamp(base, 2885), processingEnd: open ? null : stamp(base, 7360), nzr: false },
    negativeNotification: o.deny ? { decision: 'DENY', direction: 'Комплаенс-контроль', comment: o.deny } : { decision: null, direction: null, comment: null },
    monitoring: { start: stamp(base, 2979), end: stamp(base, 4360), decision: 'ALLOW', transactionId: hexOf(i, 12, 32), requestedAt: stamp(base, 4113), clientId: o.clientId },
    complianceControl: { start: stamp(base, 4478), end: open ? null : stamp(base, 7360), decision: o.deny ? 'DENY' : o.review ? 'REVIEW' : 'ALLOW' },
    history: [{ enteredAt: stamp(base, 5759), controlSystem: '3308_CTRL', departmentCode: o.department }],
  }
}

const blank = (v: unknown) =>
  v === null || v === '' || (Array.isArray(v) ? v.length === 0 : typeof v === 'object' && Object.keys(v as object).length === 0)
/** Вкладка пуста ⇔ пусты все её поля верхнего уровня: список без строк, исходники без текста, аудит без секций. */
export const isEmptyTab = (body: unknown): boolean => Object.values(body as Record<string, unknown>).every(blank)
/** tabsOff детали — по тем же данным, что отдаёт GET …/tabs/{tab} (спека 2b §3.5); порядок — набор реестра. */
export const tabsOffOf = (ids: readonly string[], trail: Record<string, unknown>): string[] => ids.filter((t) => isEmptyTab(trail[t]))
```

- [ ] **Step 7: фейк — данные вкладок валюты и рубля.** Заменить `apps/pi/src/app/fake/fx-docs.trail.ts` целиком:

```ts
import type { FxDoc } from '../../entities/fx-doc'
import { by35, complianceOf, ddmmyyyy, decimal, hexOf, lt, pad, stamp, statusEvents, swiftAmount, uuidOf, WHO, yymmdd, type Step } from './trail.data'

/** Нелокальные вкладки валютного реестра — набор GET …/tabs/{tab} (FX_TABS без main и extra, спека 2b §3.1). */
export const FX_TRAIL_TABS = ['statuses', 'compliance', 'linked', 'tasks', 'notif', 'source', 'stream', 'mpu', 'audit'] as const
export type FxTrailTab = (typeof FX_TRAIL_TABS)[number]

/** Идентификатор транзакции — общий с деталью (блок проводок) и аудитом. */
export const fxTxId = (i: number) => `ba5ac4${pad(i % 100, 2)}-d0a4-40ea-b639-${pad((i * 7919) % 1e12, 12)}`

const OUR = 'VKRBRU8KXXX'
const ADDR50 = ['ULITSA PROFSOYUZNAYA 83-1-214', 'RU/MOSCOW, 117279']
const ADDR59 = ['PROSPEKT MIRA 101-2-45', 'RU/MOSCOW, 129085']

/** Дошёл до конца цепочки — вкладки как у эталона DOCS[0]; иначе стоит на маршрутизации — как у DOCS[1]. */
const finished = (row: FxDoc) => row.status === 'DONE' || row.status === 'EXPORTED'
const inboundOf = (row: FxDoc) => row.direction === 'IN' || row.direction === 'TRANSIT'
const refIn = (row: FxDoc) => row.refIn ?? `FX${yymmdd(row.created)}${pad(row.docNumber % 1e7, 7)}`
const refOut = (row: FxDoc) => row.refOut ?? `VK${yymmdd(row.created)}${pad(row.docNumber % 1e7, 7)}`
/** Тип в блоке 2: MT202COV → 202. */
const mtOf = (row: FxDoc) => row.type.slice(2, 5)

/** Цепочка статусов эталона: DOCS[0] — 12 шагов до fx.finish, DOCS[1] — 4 шага до маршрутизации; смещения — мс эталона. */
function chain(row: FxDoc): Step[] {
  const inbound = inboundOf(row)
  const d = inbound ? 'in' : 'out'
  const rt = inbound ? 'RT_FX_IN' : 'RT_FX_OUT'
  if (!finished(row)) {
    return [
      [null, 'fx-dup-check.end', null, 0],
      [rt, `fx-${d}-checks.start`, null, 426],
      [rt, `fx-${d}-checks.end`, null, 1904],
      [rt, `fx-${d}-routing.start`, row.reason ?? 'Ожидание решения сотрудника', 2338],
    ]
  }
  const post = inbound ? 'RT_FX_CREDIT' : 'RT_FX_DEBIT'
  const move = inbound ? 'fx-credit-client' : 'fx-debit-client'
  return [
    [null, 'fx-dup-check.end', null, 0],
    [rt, `fx-${d}-checks.start`, null, 401],
    [rt, `fx-${d}-checks.end`, null, 2301],
    [rt, `fx-${d}-routing.start`, 'Ожидание решения сотрудника', 2900],
    [rt, `fx-${d}-routing.end`, null, 95142],
    [post, `${move}.start`, null, 96468],
    [post, `${move}.end`, null, 97716],
    [post, 'fx-postprocess.start', null, 98172],
    [post, 'fx-postprocess.end', null, 99071],
    [post, 'fx-accounting.start', null, 195573],
    [post, 'fx-accounting.end', null, 196579],
    [post, 'fx.finish', null, 196674],
  ]
}

/** Связанный документ — существующая строка того же реестра (docId открывается в B). */
function linkedDoc(lr: FxDoc, relation: 'CHILD' | 'PARENT', kind: string, purpose: string) {
  const amount = decimal(lr.amount)
  return {
    docId: lr.id, date: lr.created.slice(0, 10), docType: lr.type, relation, purpose, status: lr.status,
    processedAt: lr.created, postingDate: finished(lr) ? lr.created.slice(0, 10) : null, kind,
    debit: { account: lr.f59acc, amount, currency: lr.currency, register: '00010_ClientCurrent' },
    credit: { account: lr.routeAcc, amount, currency: lr.currency, register: `00000_Nostro${lr.currency}` },
    sender: { name: lr.f59name, account: lr.f59acc, details: null },
    receiver: { name: lr.f50name, account: lr.f50acc, details: lr.refIn ? `RETURN OF ${lr.refIn}` : null },
  }
}
function linked(row: FxDoc, i: number, rows: readonly FxDoc[]) {
  const at = (k: number) => rows[(i + k) % rows.length]!
  const title = (lr: FxDoc, tail: string) => `${lr.type} ${lr.currency} ${decimal(lr.amount)} ${ddmmyyyy(lr.created)} ${tail}`
  if (!finished(row)) return [linkedDoc(at(5), 'PARENT', 'OUR', title(at(5), 'код (1.6.2.2.1.)'))]
  return [
    linkedDoc(at(7), 'CHILD', 'SHA', title(at(7), 'возврат (1.6.2.2.1.)')),
    linkedDoc(at(13), 'CHILD', 'OUR', 'Комиссия за входящий перевод по тарифу OUR'),
  ]
}

function tasks(row: FxDoc, i: number, b: string, who: string) {
  const inbound = inboundOf(row)
  const d = inbound ? 'in' : 'out'
  const act = inbound ? 'зачисление' : 'списание'
  if (!finished(row)) {
    return [{
      id: `task-${hexOf(i, 22, 12)}`, status: 'OPEN', severity: row.status === 'ERROR' || row.status === 'REJECTED' ? 'WARN' : 'INFO',
      taskType: 'PAYMENT_INSTRUCTION', createdAt: stamp(b, 2338),
      text: `Требуется подтвердить маршрут; требуется подтверждение контролёра на ${act}`, assignee: null,
      history: [{ at: stamp(b, 2338), event: `Создана: fx-${d}-routing` }],
    }]
  }
  return [
    {
      id: `task-${hexOf(i, 21, 12)}`, status: 'DONE', severity: 'OK', taskType: 'PAYMENT_INSTRUCTION', createdAt: stamp(b, 13759),
      text: `Требуется подтвердить маршрут; требуется утвердить ${inbound ? `зачисление по клиентскому счёту ${row.f59acc}` : `списание с клиентского счёта ${row.f50acc}`}`,
      assignee: who,
      history: [
        { at: stamp(b, 13759), event: `Создана: fx-${d}-routing` },
        { at: stamp(b, 54759), event: `Взята в работу: ${who}` },
        { at: stamp(b, 94759), event: `Решение: маршрут подтверждён, ${act} утверждено` },
        { at: stamp(b, 94759), event: `Закрыта · ${who}` },
      ],
    },
    {
      id: `task-${hexOf(i, 23, 12)}`, status: 'OPEN', severity: 'INFO', taskType: 'PAYMENT_INSTRUCTION', createdAt: stamp(b, 196759),
      text: `Комиссия ${row.currency} 35,00 удержана по тарифу OUR; проверить корректность тарифного плана клиента`, assignee: null,
      history: [{ at: stamp(b, 196759), event: 'Создана: fx-accounting' }],
    },
  ]
}

/** Входящее сообщение (эталон source.swiftMessage): блоки 1–5, тело — поля документа. */
function incoming(row: FxDoc, i: number): string {
  const day = yymmdd(row.created)
  const hhmm = row.created.slice(11, 13) + row.created.slice(14, 16)
  const purpose = row.purpose ? `:70:${by35(row.purpose).join('\n')}\n` : ''
  return `{1:F01${lt(OUR)}${pad((i * 7919) % 1e10, 10)}}{2:O${mtOf(row)}${hhmm}${day}${lt(row.sender)}${pad((i * 104729) % 1e10, 10)}${day}${hhmm}N}` +
    `{3:{108:MUR${pad(i, 13)}}{111:001}{121:${row.uetr}}}{4:\n` +
    `:20:${refIn(row)}\n:23B:CRED\n:32A:${day}${row.currency}${swiftAmount(row.amount)}\n` +
    `:50F:/${row.f50acc}\n1/${row.f50name}\n2/${ADDR50[0]}\n3/${ADDR50[1]}\n:52A:${row.f52}\n:57A:${row.f57}\n` +
    `:59F:/${row.f59acc}\n1/${row.f59name}\n2/${ADDR59[0]}\n3/${ADDR59[1]}\n${purpose}:71A:OUR\n-}{5:{MAC:00000000}{CHK:${hexOf(i, 3, 12).toUpperCase()}}}`
}
/** Исходящее сообщение (эталон source.outgoingSwiftMessage). */
function outgoing(row: FxDoc): string {
  const purpose = row.purpose ? `:70:${by35(row.purpose)[0] ?? ''}\n` : ''
  return `{1:F01${lt(OUR)}0000000000}{2:I${mtOf(row)}${lt(row.outReceiver)}N}{3:{121:${row.uetr}}}{4:\n` +
    `:20:${refOut(row)}\n:21:${refIn(row)}\n:23B:CRED\n:32A:${yymmdd(row.created)}${row.currency}${swiftAmount(row.amount)}\n` +
    `:50F:/${row.f50acc}\n1/${row.f50name}\n:52A:${row.f52}\n:57A:${row.f57}\n:59F:/${row.f59acc}\n1/${row.f59name}\n${purpose}:71A:OUR\n-}`
}
/** MPU (эталон DOCS[0].mpu): MT199 банку-отправителю — у каждого третьего завершённого документа. */
function mpu(row: FxDoc, i: number, b: string) {
  if (!finished(row) || i % 3 !== 0) return []
  const date = ddmmyyyy(row.created)
  const done = inboundOf(row) ? 'HAS BEEN CREDITED TO\nBENEFICIARY ACCOUNT' : 'HAS BEEN DEBITED FROM\nORDERING CUSTOMER ACCOUNT'
  return [{
    id: uuidOf(i, 31), messageType: 'MT199', createdAt: stamp(b, 196880), exportStatus: 'SENT', exportedAt: stamp(b, 242067),
    receiver: row.f52, docReference: refOut(row), docId: row.id,
    swiftText: `{1:F01${lt(OUR)}0000000000}{2:I199${lt(row.f52)}N}{3:{121:${row.uetr}}}{4:\n:20:${refOut(row)}\n:21:${refIn(row)}\n` +
      `:79:YOUR ${row.type} ${refIn(row)} DD ${date}\n${row.currency} ${swiftAmount(row.amount)} ${done} VALUE ${date}.\n` +
      `OUR CHARGES ${row.currency} 35,00 DEDUCTED (71A OUR).\nBEST REGARDS. SETTLEMENTS CENTRE\n-}`,
  }]
}

/** Аудит: 10 секций у завершённого (эталон DOCS[0]), 5 — у стоящего на маршрутизации (DOCS[1]). */
function audit(row: FxDoc, i: number, steps: Step[], swift: string, who: string, parentId: string | null) {
  const b = row.created
  const inbound = inboundOf(row)
  const last = steps[steps.length - 1]!
  const statusSections = { count: steps.length, last: last[1], lastAt: stamp(b, last[3]) }
  const controls = (compliance: string) => ({ complianceCheck: compliance, sanctionsCheck: 'PASSED', duplicateCheck: 'PASSED', manualReview: true })
  if (!finished(row)) {
    return {
      commonSection: { creationDate: stamp(b, 0), paymentServiceProvider: row.provS, paymentFlow: null, paymentInitiatorSystem: 'PMTS.MANUAL', sourceSystem: 'SRC1', resending: false, originalDocumentId: parentId },
      documentSection: { docReferenceIn: refIn(row), relatedReference: refOut(row), messageType: row.type, amount: row.amount, currency: row.currency, valueDate: row.vdDt },
      statusSections,
      taskSections: { open: 1, closed: 0 },
      controlAttributesSection: controls('PENDING'),
    }
  }
  const postings = 2 + (i % 3 === 0 ? 2 : 0)
  return {
    commonSection: { creationDate: stamp(b, 0), paymentServiceProvider: row.provS, paymentFlow: null, paymentInitiatorSystem: 'ERS.ERS_1', sourceSystem: 'SRC1', resending: false },
    documentSection: { docReferenceIn: refIn(row), docReferenceOut: refOut(row), messageType: row.type, amount: row.amount, currency: row.currency, valueDate: row.vdDt, uetr: row.uetr },
    originalDocumentSection: { receivedAt: stamp(b, -1000), sender: row.sender, receiver: row.receiver, rawLength: swift.length, hash: `sha256:${hexOf(i, 41, 4)}…${hexOf(i, 42, 4)}` },
    statusSections,
    accountingSection: { debitAccount: inbound ? row.routeAcc : row.f50acc, creditAccount: inbound ? row.f59acc : row.routeAcc, postings, executed: postings, canceled: 0, pending: 0 },
    paymentTransactionSections: { transactionId: fxTxId(i), registers: [`00000_Nostro${row.currency}`, '00010_ClientCurrent', '00020_CommissionIncome', '00030_FxConversion'] },
    taskSections: { open: 1, closed: 1, lastAssignee: who },
    outgoingRoutingSections: { routeType: row.routeType, nostroAccount: row.routeAcc, receiver: row.routeRecv, rule: `${row.currency}_EU_COUNTERPARTIES_V3` },
    controlAttributesSection: controls('PASSED'),
    manualOperationRecordsSection: { records: 1, last: { at: stamp(b, 614000), user: who, field: '57', action: 'EDIT' } },
  }
}

/**
 * Ответы всех вкладок валютного документа — форма GET …/tabs/{tab} (pi-api.md). Завершённый документ — как эталон DOCS[0]
 * (статусов 12, комплаенс ALLOW, связанных 2, задач 2, нотификаций 3, стриминга 3, MPU у каждого третьего, аудит 10 секций);
 * остальные — как DOCS[1] (статусов 4, REVIEW, связанный 1, задача 1, нотификаций, стриминга и MPU нет, аудит 5 секций,
 * входящего сообщения нет). Отказ — комплаенс DENY с отрицательной нотификацией.
 */
export function fxDocTrail(row: FxDoc, i: number, rows: readonly FxDoc[]): Record<FxTrailTab, unknown> {
  const b = row.created
  const done = finished(row)
  const inbound = inboundOf(row)
  const who = WHO[i % WHO.length]!
  const steps = chain(row)
  const documents = linked(row, i, rows)
  const swiftMessage = done ? incoming(row, i) : ''
  return {
    statuses: statusEvents(b, steps),
    compliance: complianceOf(b, i, {
      clientId: `CLT${pad((i * 104729) % 1e13, 13)}`, department: `DEP ${pad(400 + (i % 30), 4)}`,
      review: !done, deny: row.status === 'REJECTED' ? (row.reason ?? 'Отказ комплаенса') : null,
    }),
    linked: { documents },
    tasks: { tasks: tasks(row, i, b, who) },
    notif: {
      notifications: done ? [
        { sentAt: stamp(b, 759), attempts: 3, status: 'TIMEOUT', responseCode: 'accepted' },
        { sentAt: stamp(b, 99759), attempts: 1, status: 'OK', responseCode: 'confirmAck' },
        { sentAt: stamp(b, 196759), attempts: 3, status: 'TIMEOUT', responseCode: 'confirmCrd' },
      ] : [],
    },
    source: { swiftMessage, outgoingSwiftMessage: outgoing(row) },
    stream: {
      events: done ? [
        { at: stamp(b, 99554), systemCode: 'MSB', systemName: 'Шина сообщений', event: `fx_evt_${inbound ? 'credit' : 'debit'}_end`, status: 'SENT', attempts: 1 },
        { at: stamp(b, 196625), systemCode: 'MSB', systemName: 'Шина сообщений', event: 'fx_evt_account_end', status: 'SENT', attempts: 1 },
        { at: stamp(b, 196661), systemCode: 'DWH', systemName: 'Хранилище', event: 'fx_evt_finish', status: 'SENT', attempts: 2 },
      ] : [],
    },
    mpu: { messages: mpu(row, i, b) },
    audit: audit(row, i, steps, swiftMessage, who, documents[0]?.docId ?? null),
  }
}
```

  Заменить `apps/pi/src/app/fake/rub-docs.trail.ts` целиком:

```ts
import { RUB_OPERATION, type RubDoc } from '../../entities/rub-doc'
import { RBANKS } from './rub-docs.data'
import { complianceOf, ddmmyyyy, decimal, hexOf, lt, pad, stamp, statusEvents, swiftAmount, uuidOf, WHO, type Step } from './trail.data'

/** Нелокальные вкладки рублёвого реестра — набор GET …/tabs/{tab} (RUB_TABS без main, спека 2b §3.1). */
export const RUB_TRAIL_TABS = ['statuses', 'compliance', 'linked', 'tasks', 'notif', 'ed244', 'stream', 'mpu', 'audit'] as const
export type RubTrailTab = (typeof RUB_TRAIL_TABS)[number]

/** Сценарий обработки — общий с деталью (блок «Сценарий») и статусами. */
export const rubScenario = (row: RubDoc) => (row.direction === 'IN' ? 'SC_NCB_IN_CREDIT' : row.direction === 'OUT' ? 'SC_NCB_OUT_DEBIT' : 'SC_NCB_TRANSIT')
/** Корсчёт проводок — общий с деталью и аудитом. */
export const rubCorrAcc = (i: number) => `30102810${pad((i * 7919 + 17) % 1e12, 12)}`

// SWIFT-коды участников — из словаря ED107 рублёвого эталона (index.html:903, обезличен): свой — XEANRURA
const OUR_SWBIC = 'XEANRURA'
const RECEIVERS = ['KDHCRU2F', 'REFNRUAM', 'TEMGRU4U']

const finished = (row: RubDoc) => row.status === 'DONE' || row.status === 'EXPORTED'
const corrOf = (bic: string) => RBANKS.find((x) => x[1] === bic)?.[2] ?? ''
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const clientAcc = (row: RubDoc) => (row.direction === 'IN' ? row.toAcc : row.fromAcc)

/** Цепочка рубля — своя (сценарии SC_NCB_*), по форме эталона: завершённый — 10 шагов, стоящий на маршрутизации — 4. */
function chain(row: RubDoc): Step[] {
  const sc = rubScenario(row)
  if (!finished(row)) {
    return [
      [null, 'rub-dup-check.end', null, 0],
      [sc, 'rub-ncb-checks.start', null, 380],
      [sc, 'rub-ncb-checks.end', null, 1720],
      [sc, 'rub-routing.start', row.reason ?? 'Ожидание решения сотрудника', 2210],
    ]
  }
  const inbound = row.direction === 'IN'
  const move = inbound ? 'rub-credit-client' : 'rub-debit-client'
  const ed = inbound ? 'rub-ed-confirm' : 'rub-ed-export'
  return [
    [null, 'rub-dup-check.end', null, 0],
    [sc, 'rub-ncb-checks.start', null, 380],
    [sc, 'rub-ncb-checks.end', null, 1720],
    [sc, 'rub-routing.start', null, 2210],
    [sc, 'rub-routing.end', null, 3985],
    ['SC_NCB_POSTING', `${move}.start`, null, 4410],
    ['SC_NCB_POSTING', `${move}.end`, null, 5932],
    ['SC_NCB_EXPORT', `${ed}.start`, null, 6120],
    ['SC_NCB_EXPORT', `${ed}.end`, null, 8847],
    ['SC_NCB_EXPORT', 'rub.finish', null, 8903],
  ]
}

/** Связанный — у каждого третьего документа: существующая строка того же реестра. */
function linked(i: number, rows: readonly RubDoc[]) {
  if (i % 3 !== 0) return []
  const lr = rows[(i + 4) % rows.length]!
  const amount = decimal(lr.amount)
  return [{
    docId: lr.id, date: lr.created.slice(0, 10), docType: lr.type, relation: i % 2 ? 'PARENT' : 'CHILD', purpose: lr.purpose,
    status: lr.status, processedAt: lr.changed, postingDate: finished(lr) ? lr.changed.slice(0, 10) : null, kind: lr.edCode,
    debit: { account: lr.fromAcc, amount, currency: 'RUB', register: '00010_ClientCurrent' },
    credit: { account: corrOf(lr.toBic) || null, amount, currency: 'RUB', register: '00000_CorrCBR' },
    sender: { name: lr.fromName, account: lr.fromAcc, details: `ИНН ${lr.fromInn}` },
    receiver: { name: lr.toName, account: lr.toAcc, details: `ИНН ${lr.toInn}` },
  }]
}

function tasks(row: RubDoc, i: number, b: string, who: string) {
  const sc = rubScenario(row)
  if (!finished(row)) {
    return [{
      id: `task-${hexOf(i, 62, 12)}`, status: 'OPEN', severity: row.status === 'ERROR' || row.status === 'REJECTED' ? 'WARN' : 'INFO',
      taskType: 'PAYMENT_DOCUMENT', createdAt: stamp(b, 2210),
      text: `Требуется подтвердить сценарий ${sc}; ${row.reason ?? 'требуется решение сотрудника'}`, assignee: null,
      history: [{ at: stamp(b, 2210), event: 'Создана: rub-routing' }],
    }]
  }
  const act = row.direction === 'IN' ? `зачисление на счёт ${clientAcc(row)}` : `списание со счёта ${clientAcc(row)}`
  return [{
    id: `task-${hexOf(i, 61, 12)}`, status: 'DONE', severity: 'OK', taskType: 'PAYMENT_DOCUMENT', createdAt: stamp(b, 2210),
    text: `Требуется подтвердить сценарий ${sc}; требуется утвердить ${act}`, assignee: who,
    history: [
      { at: stamp(b, 2210), event: 'Создана: rub-routing' },
      { at: stamp(b, 2950), event: `Взята в работу: ${who}` },
      { at: stamp(b, 3985), event: 'Решение: сценарий подтверждён' },
      { at: stamp(b, 3985), event: `Закрыта · ${who}` },
    ],
  }]
}

/** ED244 по реквизитам строки (форма эталона, index.html:906); у исходящего, ещё не выгруженного в ЦБ, — нет (''). */
function ed244(row: RubDoc, i: number): string {
  if (!finished(row) && row.direction !== 'IN') return ''
  const date = row.created.slice(0, 10)
  const kpp = (k: string) => (k && k !== '0' ? ` KPP="${k}"` : '')
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<ed:ED244 xmlns:ed="urn:cbr-ru:ed:v2.0" EDNo="${1000 + ((i * 37) % 9000)}" EDDate="${date}" EDAuthor="${pad((i * 7919 + 2072537694) % 1e10, 10)}" EDReceiver="${pad((i * 104729 + 4971095821) % 1e10, 10)}" Sum="${Math.round(row.amount * 100)}" PaymentPrecedence="${row.queue}">\n` +
    `  <ed:AccDoc AccDocNo="${xml(row.docNumber)}" AccDocDate="${date}"/>\n` +
    `  <ed:Payer PersonalAcc="${row.fromAcc}" INN="${row.fromInn}"${kpp(row.fromKpp)}>\n    <ed:Name>${xml(row.fromName)}</ed:Name>\n` +
    `    <ed:Bank BIC="${row.fromBic}" CorrespAcc="${corrOf(row.fromBic)}"/>\n  </ed:Payer>\n` +
    `  <ed:Payee PersonalAcc="${row.toAcc}" INN="${row.toInn}"${kpp(row.toKpp)}>\n    <ed:Name>${xml(row.toName)}</ed:Name>\n` +
    `    <ed:Bank BIC="${row.toBic}" CorrespAcc="${corrOf(row.toBic)}"/>\n  </ed:Payee>\n` +
    `  <ed:Purpose>${xml(row.purpose)}</ed:Purpose>\n</ed:ED244>`
}

/** MPU — MT199 в рублях у каждого четвёртого завершённого; часть ещё в очереди экспорта. */
function mpu(row: RubDoc, i: number, b: string) {
  if (!finished(row) || i % 4 !== 0) return []
  const ref = row.docRef || row.docNumber
  const receiver = RECEIVERS[i % RECEIVERS.length]!
  const sent = i % 8 === 0
  const date = ddmmyyyy(row.created)
  return [{
    id: uuidOf(i, 71), messageType: 'MT199', createdAt: stamp(b, 9120), exportStatus: sent ? 'SENT' : 'QUEUED', exportedAt: sent ? stamp(b, 41250) : null,
    receiver, docReference: ref, docId: row.uuid,
    swiftText: `{1:F01${lt(OUR_SWBIC)}0000000000}{2:I199${lt(receiver)}N}{4:\n:20:${ref}\n:21:${row.docNumber}\n` +
      `:79:RE PAYMENT DOCUMENT NO ${row.docNumber} DD ${date}\nRUB ${swiftAmount(row.amount)} ${row.direction === 'IN' ? 'CREDITED TO' : 'DEBITED FROM'} ACCOUNT ${clientAcc(row)}\n` +
      `VALUE ${date}.\nBEST REGARDS. SETTLEMENTS CENTRE\n-}`,
  }]
}

/** Аудит рубля: 8 секций у завершённого, 5 — у стоящего на маршрутизации; без секций валюты (исходное SWIFT, маршрут ностро). */
function audit(row: RubDoc, i: number, steps: Step[], who: string) {
  const b = row.created
  const inbound = row.direction === 'IN'
  const last = steps[steps.length - 1]!
  const commonSection = { creationDate: stamp(b, 0), paymentServiceProvider: 'NCB', paymentFlow: null, paymentInitiatorSystem: row.initiator, sourceSystem: row.source, resending: false }
  const documentSection = {
    docNumber: row.docNumber, docDate: row.created.slice(0, 10), amount: row.amount, currency: 'RUB', scenario: rubScenario(row),
    operation: RUB_OPERATION[row.type] || null, queue: row.queue, docReference: row.docRef || null,
  }
  const statusSections = { count: steps.length, last: last[1], lastAt: stamp(b, last[3]) }
  const controls = (compliance: string) => ({ complianceCheck: compliance, sanctionsCheck: 'PASSED', duplicateCheck: 'PASSED', manualReview: !finished(row) })
  if (!finished(row)) return { commonSection, documentSection, statusSections, taskSections: { open: 1, closed: 0 }, controlAttributesSection: controls('PENDING') }
  const corr = rubCorrAcc(i)
  return {
    commonSection, documentSection, statusSections,
    accountingSection: { debitAccount: inbound ? corr : clientAcc(row), creditAccount: inbound ? clientAcc(row) : corr, postings: 2, executed: 2, canceled: 0, pending: 0 },
    paymentTransactionSections: { transactionId: row.txId, registers: ['00000_CorrCBR', '00010_ClientCurrent'] },
    taskSections: { open: 0, closed: 1, lastAssignee: who },
    edSection: { edType: row.edCode, direction: inbound ? 'FROM_CBR' : 'TO_CBR', packageId: `PKG${pad(i * 131, 8)}` },
    controlAttributesSection: controls('PASSED'),
  }
}

/**
 * Ответы всех вкладок рублёвого документа — свои данные рубля (спека 2b §3.5): RUB, рублёвые счета, сценарии SC_NCB_*,
 * события rub_evt_*, ED244; «Связанные» и MPU у части документов непусты. Вкладки без данных уходят в tabsOff детали.
 */
export function rubDocTrail(row: RubDoc, i: number, rows: readonly RubDoc[]): Record<RubTrailTab, unknown> {
  const b = row.created
  const done = finished(row)
  const who = WHO[i % WHO.length]!
  const steps = chain(row)
  const pair = done && i % 2 === 0
  return {
    statuses: statusEvents(b, steps),
    compliance: complianceOf(b, i, {
      clientId: `CLT${pad((i * 104729 + 7) % 1e13, 13)}`, department: `DEP ${pad(300 + (i % 40), 4)}`,
      review: !done, deny: row.status === 'REJECTED' ? (row.reason ?? 'Отказ комплаенса') : null,
    }),
    linked: { documents: linked(i, rows) },
    tasks: { tasks: tasks(row, i, b, who) },
    notif: {
      notifications: pair ? [
        { sentAt: stamp(b, 520), attempts: 1, status: 'OK', responseCode: 'accepted' },
        { sentAt: stamp(b, 8950), attempts: i % 4 === 0 ? 3 : 1, status: i % 4 === 0 ? 'TIMEOUT' : 'OK', responseCode: 'confirmCrd' },
      ] : [],
    },
    ed244: { ED244: ed244(row, i) },
    stream: {
      events: pair ? [
        { at: stamp(b, 5980), systemCode: 'MSB', systemName: 'Шина сообщений', event: 'rub_evt_posting_end', status: 'SENT', attempts: 1 },
        { at: stamp(b, 8931), systemCode: 'DWH', systemName: 'Хранилище', event: 'rub_evt_finish', status: i % 6 === 0 ? 'RETRY' : 'SENT', attempts: i % 6 === 0 ? 2 : 1 },
      ] : [],
    },
    mpu: { messages: mpu(row, i, b) },
    audit: audit(row, i, steps, who),
  }
}
```

- [ ] **Step 8: `tabsOff` детали — по данным вкладок.** В `apps/pi/src/app/fake/fx-docs.detail.ts`:
  - после строки `import type { FxDoc } from '../../entities/fx-doc'` добавить:

```ts
import { FX_TRAIL_TABS, fxDocTrail, fxTxId } from './fx-docs.trail'
import { tabsOffOf } from './trail.data'
```

  - удалить строку `const pad = (n: number, w: number) => String(n).padStart(w, '0')` (после замены `txId` не используется);
  - сигнатуру и комментарий функции заменить на:

```ts
/**
 * Деталь валютного документа (спека 2a §4.4): строка реестра как есть (номер, сумма, статус совпадают с реестром)
 * плюс поля по профилю, сообщения, маршрут и проводки — детерминированно по номеру строки i;
 * tabsOff — по данным вкладок того же документа (спека 2b §3.5), rows — для «Связанных».
 */
export function makeFxDocDetail(row: FxDoc, i: number, rows: readonly FxDoc[]): Record<string, unknown> {
```

  - строку `txId: \`ba5ac4${pad(i % 100, 2)}-d0a4-40ea-b639-${pad((i * 7919) % 1e12, 12)}\`,` заменить на `txId: fxTxId(i),`;
  - строку `tabsOff: i % 2 ? ['notif', 'stream', 'mpu'] : ['mpu'],` заменить на `tabsOff: tabsOffOf(FX_TRAIL_TABS, fxDocTrail(row, i, rows)),`.

  В `apps/pi/src/app/fake/rub-docs.detail.ts`:
  - после `import { RBANKS } from './rub-docs.data'` добавить:

```ts
import { RUB_TRAIL_TABS, rubCorrAcc, rubDocTrail, rubScenario } from './rub-docs.trail'
import { tabsOffOf } from './trail.data'
```

  - сигнатуру и комментарий функции заменить на:

```ts
/**
 * Деталь рублёвого документа (спека 2a §4.4): строка реестра как есть (номер, сумма, статус — из реестра),
 * стороны из реквизитов строки, секции и проводки — детерминированно по номеру строки i;
 * tabsOff — по данным вкладок того же документа (спека 2b §3.5), rows — для «Связанных».
 */
export function makeRubDocDetail(row: RubDoc, i: number, rows: readonly RubDoc[]): Record<string, unknown> {
```

  - `const corr = \`30102810${pad((i * 7919 + 17) % 1e12, 12)}\`` заменить на `const corr = rubCorrAcc(i)`;
  - строку `scenario: inbound ? 'SC_NCB_IN_CREDIT' : row.direction === 'OUT' ? 'SC_NCB_OUT_DEBIT' : 'SC_NCB_TRANSIT',` заменить на `scenario: rubScenario(row),`;
  - строку `tabsOff: i % 2 ? ['mpu'] : ['stream', 'mpu'],` заменить на `tabsOff: tabsOffOf(RUB_TRAIL_TABS, rubDocTrail(row, i, rows)),`.

  (`pad` в `rub-docs.detail.ts` остаётся — нужен УИП.) Вызовы с двумя аргументами поправить: в `apps/pi/src/app/fake/contract.test.ts` строку `const details = rows.map((row, i) => makeRubDocDetail(row, i))` заменить на `const details = rows.map((row, i) => makeRubDocDetail(row, i, rows))`; в `apps/pi/src/app/details.a11y.test.tsx` `makeFxDocDetail(rows[i]!, i)` → `makeFxDocDetail(rows[i]!, i, rows)` и `makeRubDocDetail(rows[i]!, i)` → `makeRubDocDetail(rows[i]!, i, rows)`.

- [ ] **Step 9: контрактные тесты вкладок.** В `apps/pi/src/app/fake/contract.test.ts` заменить блок импортов целиком:

```ts
import { allSettled, fork, type Effect } from 'effector'
import { STATUS_LABEL } from '../../entities/doc-status'
import { TRAIL_EXAMPLES, TRAIL_PARSERS, type TrailTabId } from '../../entities/doc-trail'
import { FX_TABS, FX_TYPES, fxDocPorts, parseFxDocDetail } from '../../entities/fx-doc'
import { RUB_TABS, RUB_TYPES, parseRubDocDetail, rubDocPorts } from '../../entities/rub-doc'
import { ApiError, createGridPorts, requestFx, type TabQuery } from '../../shared/api'
import { fakeGrids } from './grids'
import { makeFxDocs } from './fx-docs.data'
import { FX_TRAIL_TABS, fxDocTrail } from './fx-docs.trail'
import { makeRubDocs } from './rub-docs.data'
import { makeRubDocDetail } from './rub-docs.detail'
import { RUB_TRAIL_TABS, rubDocTrail } from './rub-docs.trail'
import { createFakeServer } from './server'
import { tabsOffOf } from './trail.data'
```

  и в конец файла добавить:

```ts
describe('контракт вкладок (спека 2b §3.1, §3.5): порт → requestFx → фейк', () => {
  // порты вкладок сущностей подключает Task 10; здесь — те же парсеры поверх того же фейка
  const fxTabPorts = createGridPorts({ gridId: 'fx-docs', parseRow: (x) => x, parseDetail: parseFxDocDetail, parseTab: TRAIL_PARSERS })
  const rubTabPorts = createGridPorts({ gridId: 'rub-docs', parseRow: (x) => x, parseDetail: parseRubDocDetail, parseTab: TRAIL_PARSERS })
  const remoteOf = (tabs: { id: string }[], local: string[]) => tabs.map((t) => t.id).filter((id) => !local.includes(id))
  /** Пустота в домене: список без строк, аудит без секций, исходники без текста; комплаенс пустым не бывает. */
  const isEmpty = (data: unknown) => (Array.isArray(data) ? data.length === 0 : Object.values(data as Record<string, unknown>).every((v) => v === ''))

  async function everyDoc<D extends { tabsOff: string[] }>(detailFx: Effect<string, D, ApiError>, tabFx: Effect<TabQuery, unknown, ApiError>, ids: string[], tabs: readonly string[]) {
    const sc = scope()
    for (const id of ids) {
      const d = await allSettled(detailFx, { scope: sc, params: id })
      if (d.status !== 'done') throw new Error(`${id}: деталь не пришла`)
      const off = d.value.tabsOff
      const got = await Promise.all(tabs.map((tab) => allSettled(tabFx, { scope: sc, params: { id, tab } })))
      tabs.forEach((tab, k) => {
        const r = got[k]!
        if (r.status !== 'done') throw new Error(`${id}/${tab}: ${r.value.message}`)
        expect(isEmpty(r.value), `${id}/${tab}: пусто ⇔ в tabsOff`).toBe(off.includes(tab))
      })
    }
  }

  it('TRAIL_PARSERS: ключи — ровно TrailTabId, это объединение нелокальных вкладок обоих реестров; наборы фейка — нелокальные вкладки реестра', () => {
    const fx = remoteOf(FX_TABS, ['main', 'extra'])
    const rub = remoteOf(RUB_TABS, ['main'])
    const keys = Object.keys(TRAIL_PARSERS).sort()
    expect(keys).toEqual(['audit', 'compliance', 'ed244', 'linked', 'mpu', 'notif', 'source', 'statuses', 'stream', 'tasks'])
    expect(keys).toEqual([...new Set([...fx, ...rub])].sort())
    expect([...FX_TRAIL_TABS]).toEqual(fx)
    expect([...RUB_TRAIL_TABS]).toEqual(rub)
  })
  it('TRAIL_EXAMPLES (форма pi-api.md) разбираются TRAIL_PARSERS', () => {
    expect(Object.keys(TRAIL_EXAMPLES).sort()).toEqual(Object.keys(TRAIL_PARSERS).sort())
    for (const tab of Object.keys(TRAIL_PARSERS) as TrailTabId[]) expect(() => TRAIL_PARSERS[tab](TRAIL_EXAMPLES[tab], 'ответ'), tab).not.toThrow()
  })
  it('fx-docs: каждая вкладка каждого документа разбирается; вкладка в tabsOff ⇔ её данные пусты', async () => {
    await everyDoc(fxTabPorts.detailFx, fxTabPorts.tabFx, makeFxDocs().map((r) => r.id), FX_TRAIL_TABS)
  }, 60_000)
  it('rub-docs: каждая вкладка каждого документа разбирается; вкладка в tabsOff ⇔ её данные пусты', async () => {
    await everyDoc(rubTabPorts.detailFx, rubTabPorts.tabFx, makeRubDocs().map((r) => r.id), RUB_TRAIL_TABS)
  }, 60_000)
  it('данные разнообразны: у части документов вкладка пуста, у части — нет', () => {
    const fx = makeFxDocs()
    const rub = makeRubDocs()
    const fxOff = fx.map((r, i) => tabsOffOf(FX_TRAIL_TABS, fxDocTrail(r, i, fx)))
    const rubOff = rub.map((r, i) => tabsOffOf(RUB_TRAIL_TABS, rubDocTrail(r, i, rub)))
    for (const tab of ['notif', 'stream', 'mpu']) {
      expect(fxOff.some((o) => o.includes(tab)), `fx ${tab} пуста`).toBe(true)
      expect(fxOff.some((o) => !o.includes(tab)), `fx ${tab} непуста`).toBe(true)
    }
    for (const tab of ['linked', 'notif', 'ed244', 'stream', 'mpu']) {
      expect(rubOff.some((o) => o.includes(tab)), `rub ${tab} пуста`).toBe(true)
      expect(rubOff.some((o) => !o.includes(tab)), `rub ${tab} непуста`).toBe(true)
    }
  })
  it('«Связанные» ссылаются на существующие документы того же реестра', () => {
    const fx = makeFxDocs()
    const fxIds = new Set(fx.map((r) => r.id))
    for (const [i, r] of fx.entries()) {
      for (const l of (fxDocTrail(r, i, fx).linked as { documents: { docId: string }[] }).documents) expect(fxIds.has(l.docId), l.docId).toBe(true)
    }
    const rub = makeRubDocs()
    const rubIds = new Set(rub.map((r) => r.id))
    for (const [i, r] of rub.entries()) {
      for (const l of (rubDocTrail(r, i, rub).linked as { documents: { docId: string }[] }).documents) expect(rubIds.has(l.docId), l.docId).toBe(true)
    }
  })
  it('рубль — свои данные: сценарии SC_NCB_*, события rub_evt_*, без артефактов валюты', () => {
    const rows = makeRubDocs()
    const trails = rows.map((r, i) => rubDocTrail(r, i, rows))
    expect(JSON.stringify(trails)).not.toMatch(/USD|EUR|CNY|fx[-_]|RT_FX|Nostro/)
    for (const t of trails) {
      for (const e of (t.statuses as { events: { route: string | null }[] }).events) if (e.route !== null) expect(e.route).toMatch(/^SC_NCB_/)
      for (const e of (t.stream as { events: { event: string }[] }).events) expect(e.event).toMatch(/^rub_evt_/)
    }
  })
  it('404 на вкладку не из набора реестра; ?fail=tab:<id> — 500 только на ней', async () => {
    const fxId = makeFxDocs()[0]!.id
    const rubId = makeRubDocs()[0]!.id
    const ed = await allSettled(fxTabPorts.tabFx, { scope: scope(), params: { id: fxId, tab: 'ed244' } })
    expect((ed.value as ApiError).status).toBe(404)
    const src = await allSettled(rubTabPorts.tabFx, { scope: scope(), params: { id: rubId, tab: 'source' } })
    expect((src.value as ApiError).status).toBe(404)
    const failing = fork({ handlers: [[requestFx, createFakeServer(fakeGrids, { failing: () => 'tab:statuses' })]] })
    const st = await allSettled(fxTabPorts.tabFx, { scope: failing, params: { id: fxId, tab: 'statuses' } })
    expect((st.value as ApiError).status).toBe(500)
    const au = await allSettled(fxTabPorts.tabFx, { scope: failing, params: { id: fxId, tab: 'audit' } })
    expect(au.status).toBe('done')
  })
})
```

- [ ] **Step 10: запуск и границы.** `pnpm --filter pi test -- tone trail.mapper contract server details.a11y` — PASS (+3 `toneOf`, +8 мапперов, +8 контрактных; a11y деталки — без изменений поведения). `pnpm --filter pi test` — PASS целиком. `pnpm lint` — чисто: зоны FSD для `entities/doc-trail` построены по каталогу автоматически (`doc-trail` импортирует только `shared/api` через `index.ts` и `@katran/ui`; `app/fake` — `entities/doc-trail/index.ts`; `@x/fx-doc.ts` и `@x/rub-doc.ts` пока никем не импортируются — это допустимо, `import-x` неиспользуемые модули не проверяет). Проверка зоны вручную (временная строка, не коммитить): добавить в `apps/pi/src/entities/doc-trail/model/tone.ts` строку `import '../../fx-doc/model/fxDoc'`, `pnpm lint` → ошибка `FSD: entities/doc-trail не импортирует соседа fx-doc (только через fx-doc/@x/doc-trail.ts)`; строку удалить. `pnpm check` — зелёный.
- [ ] **Step 11: commit.**

```bash
git add apps/pi/src/entities/doc-trail/index.ts apps/pi/src/entities/doc-trail/@x/fx-doc.ts apps/pi/src/entities/doc-trail/@x/rub-doc.ts apps/pi/src/entities/doc-trail/model/types.ts apps/pi/src/entities/doc-trail/model/tone.ts apps/pi/src/entities/doc-trail/model/tone.test.ts apps/pi/src/entities/doc-trail/api/trail.mapper.ts apps/pi/src/entities/doc-trail/api/trail.mapper.test.ts apps/pi/src/entities/doc-trail/api/trail.example.ts apps/pi/src/app/fake/trail.data.ts apps/pi/src/app/fake/fx-docs.trail.ts apps/pi/src/app/fake/rub-docs.trail.ts apps/pi/src/app/fake/fx-docs.data.ts apps/pi/src/app/fake/fx-docs.detail.ts apps/pi/src/app/fake/rub-docs.detail.ts apps/pi/src/app/fake/contract.test.ts apps/pi/src/app/details.a11y.test.tsx
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "apps/pi: сущность doc-trail (типы вкладок, toneOf, мапперы и примеры), данные вкладок фейка валюты и рубля, tabsOff по данным"
```

---

#### Для pi-api.md (Task 13)

Раздел «8. Вкладки деталки (предложение)». Ответ `GET /grids/{gridId}/documents/{id}/tabs/{tab}` — **всегда JSON-объект** (списки — под своим ключом). Общие правила:

- `tab` — ключ из таблицы 7.4 без локальных (`main`, `extra`): `fx-docs` — `statuses`, `compliance`, `linked`, `tasks`, `notif`, `source`, `stream`, `mpu`, `audit`; `rub-docs` — то же, но `ed244` вместо `source`. Неизвестный `id` или вкладка не из набора грида → `404` (Problem Details, раздел 2).
- Отметки времени — ISO 8601 **без зоны** (время банка, как `created` строки): `"2026-09-22T07:31:45.241"`, миллисекунды необязательны. Даты — `"YYYY-MM-DD"`.
- `T | null` — ключ присутствует всегда, `null` — «значения нет»; пустая строка читается так же, как `null`.
- Суммы связанных документов — десятичная строка без разрядки (`"1249965.00"`); в аудите — как есть (число).
- Пустая вкладка — пустой список (`[]`), объект исходников с пустыми/`null` текстами или аудит `{}`; такая вкладка обязана быть в `tabsOff` детали, и наоборот.
- Реализация на фронте: типы — `apps/pi/src/entities/doc-trail/model/types.ts`, мапперы — `entities/doc-trail/api/trail.mapper.ts` (`TRAIL_PARSERS`), примеры — `entities/doc-trail/api/trail.example.ts` (`TRAIL_EXAMPLES`).

```ts
// statuses → StatusEvent[]
{ events: { at: string; route: string | null; statusCode: string; reason: string | null }[] }

// compliance → Compliance (объект есть всегда; вкладка пустой не бывает)
{
  record: { id: string; processingStart: string | null; processingEnd: string | null; nzr: boolean | null }   // nzr — признак постановки на НЗР
  negativeNotification: { decision: string | null; direction: string | null; comment: string | null }
  monitoring: { start: string | null; end: string | null; decision: string | null /* ALLOW | REVIEW | DENY… */; transactionId: string | null; requestedAt: string | null; clientId: string | null }
  complianceControl: { start: string | null; end: string | null; decision: string | null }
  history: { enteredAt: string; controlSystem: string; departmentCode: string }[]
}

// linked → LinkedDoc[]; docId — id документа ТОГО ЖЕ грида (открывается GET …/documents/{docId})
{ documents: {
    docId: string; date: string; docType: string; relation: string /* CHILD | PARENT */; purpose: string | null
    status: string; processedAt: string | null; postingDate: string | null; kind: string | null
    debit:  { account: string | null; amount: string | null; currency: string | null; register: string | null }
    credit: { account: string | null; amount: string | null; currency: string | null; register: string | null }
    sender:   { name: string | null; account: string | null; details: string | null }
    receiver: { name: string | null; account: string | null; details: string | null }
  }[] }

// tasks → DocTask[]; закрытие — последним событием истории
{ tasks: {
    id: string; status: 'OPEN' | 'DONE'; severity: 'OK' | 'INFO' | 'WARN'; taskType: string; createdAt: string
    text: string; assignee: string | null; history: { at: string; event: string }[]
  }[] }

// notif → DocNotification[]
{ notifications: { sentAt: string; attempts: number; status: string /* OK | TIMEOUT… */; responseCode: string }[] }

// source (fx-docs) / ed244 (rub-docs) → SourceTexts: ключ → текст сообщения; null или "" — «нет»
{ swiftMessage: string | null; outgoingSwiftMessage: string | null }     // fx-docs: SWIFT MT, блоки {1:}…{5:}
{ ED244: string | null }                                                   // rub-docs: XML ЭС; текст с «<» показывается как XML
// ключи — открытый набор: фронт показывает каждый ключ отдельным аккордеоном в порядке ответа

// stream → StreamEvent[]
{ events: { at: string; systemCode: string; systemName: string; event: string; status: string /* SENT | RETRY… */; attempts: number }[] }

// mpu → MpuMessage[]
{ messages: {
    id: string; messageType: string; createdAt: string; exportStatus: string /* SENT | QUEUED… */; exportedAt: string | null
    receiver: string; docReference: string; docId: string; swiftText: string
  }[] }

// audit → AuditSections: секция → произвольный объект (показывается JSON как есть); {} — аудит пуст
{ [section: string]: { [key: string]: unknown } }
```

Пример каждой вкладки — `TRAIL_EXAMPLES` (валютный документ эталона `DOCS[0]`, для `ed244` — первый рублёвый документ эталона). Фейк: данные детерминированы по номеру строки (`apps/pi/src/app/fake/fx-docs.trail.ts`, `rub-docs.trail.ts`, общее — `trail.data.ts`); регуляторы `?fail=tab` (500 на любой вкладке) и `?fail=tab:<id>` (500 только на вкладке `<id>`) есть только у фейка.

### Task 8: `entities/doc-trail/ui` — Статусы, Комплаенс, Задачи, Нотификации, Стриминг

**Files:**
- Create: `apps/pi/src/entities/doc-trail/ui/{lib.ts, parts.tsx, testing.tsx, trail.module.css, StatusesTab.tsx, ComplianceTab.tsx, TasksTab.tsx, NotificationsTab.tsx, StreamTab.tsx, tabs1.test.tsx}`
- Modify: `apps/pi/src/entities/doc-trail/index.ts`, `packages/tokens/src/tokens.src.ts` (+ сгенерированные `packages/tokens/src/tokens.css`, `packages/tokens/src/tokens.ts`)

Сверх карты файлов: `ui/lib.ts` (чистые помощники вкладок — время, раскрытие, склонение, язык кода), `ui/parts.tsx` (общие мелкие блоки: «—», ссылка-кнопка, пустое состояние без таблицы), `ui/testing.tsx` (обвязка тестов: контекст вкладки со шпионами и живым раскрытием; в сборку не попадает — его импортируют только `*.test.tsx`). Токен `dt-hist` — колонка времени в истории задачи (эталон `.tk .hist` 70 px).

**Interfaces:**
- Produces (`entities/doc-trail`, публичный API через `index.ts`):

```ts
type TrailTabProps<T> = { data: T; ctx: TabContext }
StatusesTab(props: TrailTabProps<StatusEvent[]>): JSX.Element
ComplianceTab(props: TrailTabProps<Compliance | null>): JSX.Element   // null — «Комплаенс-проверок нет»
TasksTab(props: TrailTabProps<DocTask[]>): JSX.Element
NotificationsTab(props: TrailTabProps<DocNotification[]>): JSX.Element
StreamTab(props: TrailTabProps<StreamEvent[]>): JSX.Element
```

- Produces (внутри слайса, `ui/lib.ts`): `STUB = 'Действие будет в 2d'`, `SLOW_MS = 30000`, `toggleKey(keys, key, open)`, `keysLabel(n)`, `codeLanguage(text)`; `ui/parts.tsx`: `Nil`, `LinkButton`, `TrailEmpty`; `ui/testing.tsx`: `TEST_DOC_ID`, `renderTab(view, init?)`, `shown(text)`, `toggles()`.
- Consumes: `MiniTable`, `MiniColumn` (Task 3; ожидается `role="table"` с доступным именем `label`, строки — `role="row"`, шапка — строка таблицы, при всех `header === ''` шапки нет; раскрываемая строка — не кнопка: переключатель — кнопка-шеврон в последней ячейке с `aria-expanded`/`aria-controls` и именем «Раскрыть {rowLabel}»/«Свернуть {rowLabel}» (`rowLabel?: (row, index) => string`; без него — «Раскрыть строку N»); клик по свободному месту строки тоже переключает, по `a`/`button` внутри — нет; `onExpandedChange` отдаёт новый полный список ключей, новый ключ — в конце), `StatusBadge`, `Timestamp`, `formatTimestamp`, `formatDuration` (Task 2), `KeyValueList`, `KeyValueItem` (Task 4; пустое значение — «—» и «не заполнено» для скринридера), `Tag`, `StatusDot`, `Button` (кит 2a); `TabContext` с `docId` (Task 6, `shared/lib/detail`); типы `StatusEvent`, `Compliance`, `DocTask`, `DocNotification`, `StreamEvent` (`model/types.ts`) и `toneOf` (`model/tone.ts`) — Task 7.

- [ ] **Step 1: токен колонки времени истории задачи.** В `packages/tokens/src/tokens.src.ts` в объекте `sizes` после строки с `'dt-dir': 62, …` добавить строку:

```ts
  // вкладки истории документа (эталон .tk .hist, index.html:336): колонка времени в истории задачи
  'dt-hist': 70,
```

  Run: `pnpm gen && pnpm --filter @katran/tokens test`
  Expected: PASS; в `packages/tokens/src/tokens.css` появилась строка `--k-dt-hist: calc(70px * var(--k-density));`.

- [ ] **Step 2: обвязка тестов вкладок.** Создать `apps/pi/src/entities/doc-trail/ui/testing.tsx`:

```tsx
import { screen } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { vi, type Mock } from 'vitest'
import type { TabContext } from '../../../shared/lib/detail'
import { renderK } from '../../../shared/lib/test'

export type CtxSpies = {
  openDocument: Mock<(id: string) => void>
  announce: Mock<(message: string) => void>
  setExpanded: Mock<(keys: string[]) => void>
}

/** id открытого документа в контексте вкладки (TabContext.docId). */
export const TEST_DOC_ID = '03e8b84b-d1c5-4f07-aa49-8be3e9e4c8e8'

function Stateful({ spies, init, view }: { spies: CtxSpies; init: string[] | null; view: (ctx: TabContext) => ReactNode }) {
  const [expanded, setState] = useState<string[] | null>(init)
  const ctx: TabContext = {
    docId: TEST_DOC_ID,
    openDocument: spies.openDocument,
    announce: spies.announce,
    expanded,
    setExpanded: (keys) => { spies.setExpanded(keys); setState(keys) },
  }
  return <>{view(ctx)}</>
}

/** Вкладка под провайдером кита: контекст со шпионами и живым раскрытием (как $expanded виджета, Task 11). */
export function renderTab(view: (ctx: TabContext) => ReactNode, init: string[] | null = null) {
  const spies: CtxSpies = {
    openDocument: vi.fn<(id: string) => void>(),
    announce: vi.fn<(message: string) => void>(),
    setExpanded: vi.fn<(keys: string[]) => void>(),
  }
  const result = renderK(<Stateful spies={spies} init={init} view={view} />)
  return { ...result, spies }
}

/** Текст есть в документе и не внутри скрытой панели (свёрнутое тело строки или аккордеона). */
export const shown = (text: string | RegExp): boolean => {
  const el = screen.queryByText(text)
  return el !== null && el.closest('[hidden]') === null
}

/** Переключатели раскрываемых строк MiniTable (кнопка-шеврон в последней ячейке), по порядку строк. */
export const toggles = (): HTMLElement[] => screen.getAllByRole('button', { name: /^(Раскрыть|Свернуть)/ })
```

- [ ] **Step 3: тесты вкладок (падают).** Создать `apps/pi/src/entities/doc-trail/ui/tabs1.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { formatDuration } from '@katran/ui'
import type { Compliance, DocNotification, DocTask, StatusEvent, StreamEvent } from '../model/types'
import { ComplianceTab } from './ComplianceTab'
import { STUB, codeLanguage, keysLabel, toggleKey } from './lib'
import { NotificationsTab } from './NotificationsTab'
import { StatusesTab } from './StatusesTab'
import { StreamTab } from './StreamTab'
import { TasksTab } from './TasksTab'
import { TEST_DOC_ID, renderTab, shown, toggles } from './testing'

// Данные — со стенда (index.html:767–871, обезличен), в доменных типах Task 7
const STATUSES: StatusEvent[] = [
  { at: '2026-09-22T07:31:45.241', route: null, code: 'fx-dup-check.end', reason: null },
  { at: '2026-09-22T07:31:45.642', route: 'RT_FX_IN', code: 'fx-in-checks.start', reason: null },
  { at: '2026-09-22T07:31:48.141', route: 'RT_FX_IN', code: 'fx-in-routing.start', reason: 'Ожидание решения сотрудника' },
  { at: '2026-09-22T07:33:20.383', route: 'RT_FX_IN', code: 'fx-in-routing.end', reason: null },
  { at: '2026-09-22T07:35:01.915', route: 'RT_FX_CREDIT', code: 'fx.finish', reason: null },
]
const COMPLIANCE: Compliance = {
  record: { id: '3e854037-b84c-40ee-90e0-440734c1d5e3', start: '2026-09-22T07:31:48.126', end: '2026-09-22T07:31:52.601', nzr: false },
  negative: { decision: null, direction: null, comment: null },
  monitoring: {
    start: '2026-09-22T07:31:48.220', end: '2026-09-22T07:31:49.601', decision: 'ALLOW',
    txId: '97cae8c7162531f4093e1db5d7171bde', requestAt: '2026-09-22T07:31:49.354', clientId: 'CLT0000123456789',
  },
  department: { start: '2026-09-22T07:31:49.719', end: null, decision: 'REVIEW' },
  history: [{ at: '2026-09-22T07:31:51', system: '3308_CTRL', department: 'DEP 0417' }],
}
const TASKS: DocTask[] = [
  {
    id: 't1', state: 'done', tone: 'ok', type: 'PAYMENT_INSTRUCTION', at: '2026-09-22T07:31:59',
    text: 'Требуется подтвердить маршрут; требуется утвердить зачисление по клиентскому счёту 40817840100050017762', who: 'Иванова М. П.',
    history: [
      { at: '2026-09-22T07:31:59', text: 'Создана: fx-in-routing' },
      { at: '2026-09-22T07:32:40', text: 'Взята в работу: Иванова М. П.' },
      { at: '2026-09-22T07:33:20', text: 'Решение: маршрут подтверждён, зачисление утверждено' },
      { at: '2026-09-22T07:33:20', text: 'Закрыта · Иванова М. П.' },
    ],
  },
  {
    id: 't2', state: 'open', tone: 'info', type: 'PAYMENT_INSTRUCTION', at: '2026-09-22T07:35:02',
    text: 'Комиссия USD 35,00 удержана по тарифу OUR; проверить корректность тарифного плана клиента', who: null,
    history: [{ at: '2026-09-22T07:35:02', text: 'Создана: fx-accounting' }],
  },
]
const NOTIF: DocNotification[] = [
  { at: '2026-09-22T07:31:46.000', attempts: 3, status: 'TIMEOUT', code: 'accepted' },
  { at: '2026-09-22T07:33:25.000', attempts: 1, status: 'OK', code: 'confirmAck' },
  { at: '2026-09-22T07:35:02.000', attempts: 3, status: 'TIMEOUT', code: 'confirmCrd' },
]
const STREAM: StreamEvent[] = [
  { at: '2026-09-22T07:33:24.795', system: 'MSB', destination: 'Шина сообщений', event: 'fx_evt_credit_end', status: 'SENT', tries: 1 },
  { at: '2026-09-22T07:35:01.866', system: 'MSB', destination: 'Шина сообщений', event: 'fx_evt_account_end', status: 'SENT', tries: 1 },
  { at: '2026-09-22T07:35:01.902', system: 'DWH', destination: 'Хранилище', event: 'fx_evt_finish', status: 'SENT', tries: 2 },
]
const HOSTILE = '<img src=x onerror=alert(1)>'

describe('помощники вкладок (ui/lib.ts)', () => {
  it('toggleKey: добавляет в конец без дублей, убирает', () => {
    expect(toggleKey(['a'], 'b', true)).toEqual(['a', 'b'])
    expect(toggleKey(['a', 'b'], 'b', true)).toEqual(['a', 'b'])
    expect(toggleKey(['a', 'b'], 'a', false)).toEqual(['b'])
  })
  it('keysLabel: 1 ключ, 2–4 ключа, 5–20 ключей, 21 ключ, 111–114 ключей', () => {
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111, 112].map(keysLabel)).toEqual([
      '1 ключ', '2 ключа', '4 ключа', '5 ключей', '11 ключей', '12 ключей', '14 ключей', '21 ключ', '22 ключа', '25 ключей', '101 ключ', '111 ключей', '112 ключей',
    ])
  })
  it('codeLanguage: начинается с «<» (после пробелов) — XML, иначе SWIFT', () => {
    expect(codeLanguage('<?xml version="1.0"?><ED244/>')).toBe('xml')
    expect(codeLanguage('  \n<ED244/>')).toBe('xml')
    expect(codeLanguage('{1:F01VKRBRU8KXXXX0427047245}')).toBe('swift')
  })
})

describe('StatusesTab (эталон statusesHtml)', () => {
  it('нумерация, маршрут тегом или «—», код с суффиксом, финальный шаг, причина с тултипом', () => {
    renderTab((ctx) => <StatusesTab data={STATUSES} ctx={ctx} />)
    const table = screen.getByRole('table', { name: 'Статусы' })
    expect(within(table).getAllByRole('row')).toHaveLength(STATUSES.length + 1)
    expect(within(table).getByRole('columnheader', { name: 'Причина' })).toBeInTheDocument()
    expect(within(table).getAllByText('RT_FX_IN')).toHaveLength(3)
    expect(within(table).getByText('не заполнено')).toBeInTheDocument()
    expect(within(table).getByText('.start')).toHaveClass('start')
    expect(within(table).getAllByText('.end')).toHaveLength(2)
    expect(within(table).getAllByText('.end')[0]).toHaveClass('end')
    expect(within(table).getByText('fx.finish')).toHaveClass('fin')
    const reason = within(table).getByText('Ожидание решения сотрудника')
    expect(reason).toHaveAttribute('data-k-tip', 'Ожидание решения сотрудника')
    expect(reason).toHaveAttribute('data-k-tip-if', 'truncated')
  })
  it('Δ — от предыдущей строки; больше 30 с — «медленно»; у первой строки Δ нет', () => {
    renderTab((ctx) => <StatusesTab data={STATUSES} ctx={ctx} />)
    expect(screen.getByText(formatDuration(401))).not.toHaveClass('slow')
    expect(screen.getByText(formatDuration(2499))).not.toHaveClass('slow')
    expect(screen.getByText(formatDuration(92242))).toHaveClass('slow')
    expect(screen.getByText(formatDuration(101532))).toHaveClass('slow')
    expect(document.querySelectorAll('.dur')).toHaveLength(STATUSES.length - 1)
  })
  it('пусто — «Статусов нет»; разметка из данных бека не исполняется', () => {
    const { unmount } = renderTab((ctx) => <StatusesTab data={[]} ctx={ctx} />)
    expect(screen.getByText('Статусов нет')).toBeInTheDocument()
    unmount()
    const { container } = renderTab((ctx) => <StatusesTab data={[{ ...STATUSES[0]!, reason: HOSTILE }]} ctx={ctx} />)
    expect(screen.getByText(HOSTILE)).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })
  it('без нарушений axe', async () => {
    const { container } = renderTab((ctx) => <StatusesTab data={STATUSES} ctx={ctx} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('ComplianceTab (эталон complianceHtml)', () => {
  it('четыре группы, решения бейджами, пустое — «не заполнено», НЗР «Нет»', () => {
    renderTab((ctx) => <ComplianceTab data={COMPLIANCE} ctx={ctx} />)
    for (const t of ['Отрицательная нотификация в источник', 'Контроль в системе мониторинга (ИС4021)', 'Контроль подразделения комплаенс (ОПС3308)']) {
      expect(screen.getByText(t)).toBeInTheDocument()
    }
    expect(screen.getByText('ID записи')).toBeInTheDocument()
    expect(screen.getByText('3e854037-b84c-40ee-90e0-440734c1d5e3')).toBeInTheDocument()
    expect(screen.getByText('ID платёжной инструкции')).toBeInTheDocument()
    expect(screen.getByText(TEST_DOC_ID)).toBeInTheDocument()
    expect(screen.getByText('ALLOW')).toBeInTheDocument()
    expect(screen.getByText('REVIEW')).toBeInTheDocument()
    expect(screen.getByText('Нет')).toBeInTheDocument()
    // отрицательная нотификация — три пустых, окончание контроля подразделения — одно
    expect(screen.getAllByText('не заполнено')).toHaveLength(4)
  })
  it('вложенная история: время, система, подразделение', () => {
    renderTab((ctx) => <ComplianceTab data={COMPLIANCE} ctx={ctx} />)
    const hist = screen.getByRole('table', { name: 'История попадания в подразделение комплаенс' })
    expect(within(hist).getByRole('columnheader', { name: 'Система контроля' })).toBeInTheDocument()
    expect(within(hist).getByText('3308_CTRL')).toBeInTheDocument()
    expect(within(hist).getByText('DEP 0417')).toBeInTheDocument()
  })
  it('истории нет — таблицы нет; проверок нет — «Комплаенс-проверок нет»', () => {
    const { unmount } = renderTab((ctx) => <ComplianceTab data={{ ...COMPLIANCE, history: [] }} ctx={ctx} />)
    expect(screen.queryByRole('table', { name: 'История попадания в подразделение комплаенс' })).toBeNull()
    unmount()
    renderTab((ctx) => <ComplianceTab data={null} ctx={ctx} />)
    expect(screen.getByText('Комплаенс-проверок нет')).toBeInTheDocument()
  })
  it('без нарушений axe', async () => {
    const { container } = renderTab((ctx) => <ComplianceTab data={COMPLIANCE} ctx={ctx} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('TasksTab (эталон tasksHtml)', () => {
  it('счётчик «N задач, открытых M»; кнопка раздела — заглушка 2d', async () => {
    const { spies } = renderTab((ctx) => <TasksTab data={TASKS} ctx={ctx} />)
    expect(screen.getByText('2 задач, открытых 1')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Перейти в блок «Ручные отклонения»' }))
    expect(spies.announce).toHaveBeenCalledWith(STUB)
  })
  it('по умолчанию свёрнуты; точка — состояние; клик по строке раскрывает историю и «Закрыта · кто»', async () => {
    const { spies } = renderTab((ctx) => <TasksTab data={TASKS} ctx={ctx} />)
    expect(screen.getByRole('img', { name: 'Выполнена' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Открыта' })).toBeInTheDocument()
    expect(toggles()).toHaveLength(2)
    expect(toggles()[0]).toHaveAttribute('aria-expanded', 'false')
    expect(shown('Взята в работу: Иванова М. П.')).toBe(false)
    await userEvent.click(toggles()[0]!)
    expect(spies.setExpanded).toHaveBeenLastCalledWith(['t1'])
    expect(toggles()[0]).toHaveAttribute('aria-expanded', 'true')
    expect(toggles()[0]).toHaveAccessibleName(`Свернуть ${TASKS[0]!.text}`)
    expect(toggles()[1]).toHaveAccessibleName(`Раскрыть ${TASKS[1]!.text}`)
    expect(shown('Взята в работу: Иванова М. П.')).toBe(true)
    expect(shown('Закрыта · Иванова М. П.')).toBe(true)
  })
  it('клик по свободному месту строки (тег типа) тоже раскрывает, новый ключ — в конец', async () => {
    const { spies } = renderTab((ctx) => <TasksTab data={TASKS} ctx={ctx} />, ['t1'])
    await userEvent.click(screen.getAllByText('PAYMENT_INSTRUCTION')[1]!)
    expect(spies.setExpanded).toHaveBeenLastCalledWith(['t1', 't2'])
    expect(toggles()[1]).toHaveAttribute('aria-expanded', 'true')
  })
  it('«История» — заглушка 2d и строку не раскрывает', async () => {
    const { spies } = renderTab((ctx) => <TasksTab data={TASKS} ctx={ctx} />)
    await userEvent.click(screen.getAllByRole('button', { name: 'История' })[0]!)
    expect(spies.announce).toHaveBeenCalledWith(STUB)
    expect(spies.setExpanded).not.toHaveBeenCalled()
    expect(toggles()[0]).toHaveAttribute('aria-expanded', 'false')
  })
  it('раскрытое из контекста переживает перемонтирование; у открытой задачи нет «Закрыта»', () => {
    renderTab((ctx) => <TasksTab data={TASKS} ctx={ctx} />, ['t2'])
    expect(shown('Создана: fx-accounting')).toBe(true)
    expect(shown(/^Закрыта/)).toBe(false)
  })
  it('пусто — счётчик и кнопка остаются, «Задач нет»', () => {
    renderTab((ctx) => <TasksTab data={[]} ctx={ctx} />)
    expect(screen.getByText('0 задач')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Перейти в блок «Ручные отклонения»' })).toBeInTheDocument()
    expect(screen.getByText('Задач нет')).toBeInTheDocument()
  })
  it('все заголовки пустые — шапки нет (как на эталоне .tk)', () => {
    renderTab((ctx) => <TasksTab data={TASKS} ctx={ctx} />)
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0)
  })
  it('без нарушений axe (строка раскрыта)', async () => {
    const { container } = renderTab((ctx) => <TasksTab data={TASKS} ctx={ctx} />, ['t1'])
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('NotificationsTab (эталон notifHtml)', () => {
  it('счётчик «N отправок, с ошибкой M», статус бейджем, код ответа тегом', () => {
    renderTab((ctx) => <NotificationsTab data={NOTIF} ctx={ctx} />)
    expect(screen.getByText('3 отправок, с ошибкой 2')).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Нотификации' })
    expect(within(table).getAllByRole('row')).toHaveLength(NOTIF.length + 1)
    expect(within(table).getAllByText('TIMEOUT')).toHaveLength(2)
    expect(within(table).getByText('confirmAck')).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Код ответа' })).toBeInTheDocument()
  })
  it('«Переотправить» и «Исходное сообщение» — заглушки 2d', async () => {
    const { spies } = renderTab((ctx) => <NotificationsTab data={NOTIF} ctx={ctx} />)
    await userEvent.click(screen.getByRole('button', { name: 'Переотправить' }))
    await userEvent.click(screen.getByRole('button', { name: 'Исходное сообщение, отправка 2' }))
    expect(spies.announce).toHaveBeenCalledTimes(2)
    expect(spies.announce).toHaveBeenLastCalledWith(STUB)
  })
  it('пусто — счётчик и «Переотправить» остаются, «Нотификаций нет»', () => {
    renderTab((ctx) => <NotificationsTab data={[]} ctx={ctx} />)
    expect(screen.getByText('0 отправок')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Переотправить' })).toBeInTheDocument()
    expect(screen.getByText('Нотификаций нет')).toBeInTheDocument()
  })
  it('без нарушений axe', async () => {
    const { container } = renderTab((ctx) => <NotificationsTab data={NOTIF} ctx={ctx} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('StreamTab (эталон streamHtml)', () => {
  it('код ИС тегом, ИС куда, событие, статус бейджем, попытки', () => {
    renderTab((ctx) => <StreamTab data={STREAM} ctx={ctx} />)
    const table = screen.getByRole('table', { name: 'Стриминг' })
    expect(within(table).getAllByRole('row')).toHaveLength(STREAM.length + 1)
    expect(within(table).getAllByText('MSB')).toHaveLength(2)
    expect(within(table).getByText('Хранилище')).toBeInTheDocument()
    expect(within(table).getByText('fx_evt_finish')).toBeInTheDocument()
    expect(within(table).getAllByText('SENT')).toHaveLength(3)
    expect(within(table).getByRole('columnheader', { name: 'ИС куда' })).toBeInTheDocument()
  })
  it('пусто — «Событий стриминга нет»', () => {
    renderTab((ctx) => <StreamTab data={[]} ctx={ctx} />)
    expect(screen.getByText('Событий стриминга нет')).toBeInTheDocument()
  })
  it('без нарушений axe', async () => {
    const { container } = renderTab((ctx) => <StreamTab data={STREAM} ctx={ctx} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

  Run: `pnpm --filter pi test -- doc-trail/ui/tabs1`
  Expected: FAIL — `Failed to resolve import "./ComplianceTab"` (модулей вкладок ещё нет).

- [ ] **Step 4: помощники, общие блоки, стили.** Создать `apps/pi/src/entities/doc-trail/ui/lib.ts`:

```ts
import type { CodeLanguage } from '@katran/ui'
import type { TabContext } from '../../../shared/lib/detail'

/** Пропсы вида вкладки: данные, разобранные парсером той же вкладки (TRAIL_PARSERS), и контекст деталки. */
export type TrailTabProps<T> = { data: T; ctx: TabContext }

/** Заглушки кнопок вкладок до среза 2d (как у лейна 2a). */
export const STUB = 'Действие будет в 2d'

/** Порог «медленно» для Δ статусов (эталон statusesHtml: > 30 с). */
export const SLOW_MS = 30000

/** Новый список раскрытых ключей: открыть — в конец без дублей, закрыть — убрать. */
export const toggleKey = (keys: string[], key: string, open: boolean): string[] =>
  open ? (keys.includes(key) ? keys : [...keys, key]) : keys.filter((k) => k !== key)

/** «N ключ / ключа / ключей» — склонение по правилам русского (эталон auditHtml ошибался на 21, 22…). */
export function keysLabel(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return `${n} ключ`
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ключа`
  return `${n} ключей`
}

/** Язык исходника (эталон sourceHtml): начинается с «<» — XML, иначе SWIFT. */
export const codeLanguage = (text: string): CodeLanguage => (/^\s*</.test(text) ? 'xml' : 'swift')
```

  Создать `apps/pi/src/entities/doc-trail/ui/parts.tsx`:

```tsx
import type { ReactNode } from 'react'
import s from './trail.module.css'

/** Пустое значение: «—» глазами, «не заполнено» скринридером (как FieldRow и KeyValueList кита). */
export function Nil() {
  return <span className={s.nil}><span aria-hidden="true">—</span><span className={s.sr}>не заполнено</span></span>
}

export type LinkButtonProps = {
  children: ReactNode
  onClick: () => void
  /** Доступное имя, если видимого текста мало («Исходное сообщение, отправка 2»); видимый текст — его начало. */
  label?: string | undefined
  mono?: boolean | undefined
}

/** Ссылка-кнопка вкладки (эталон a.lnk): заглушки 2d и переход к связанному документу. */
export function LinkButton({ children, onClick, label, mono }: LinkButtonProps) {
  return (
    <button type="button" className={[s.lnk, mono ? s.lnkMono : ''].filter(Boolean).join(' ')} aria-label={label} onClick={onClick}>
      {children}
    </button>
  )
}

/** Пустое состояние вкладки без таблицы (эталон .tt .empty): «Аудит пуст», «Комплаенс-проверок нет». */
export function TrailEmpty({ text }: { text: string }) {
  return <div className={s.box}><p className={s.empty}>{text}</p></div>
}
```

  Создать `apps/pi/src/entities/doc-trail/ui/trail.module.css`:

```css
/* Вкладки истории документа (эталон .tt/.tbar/.tk/.xg, index.html:282–345): содержимое ячеек и тел строк.
   Сетку, высоту строк, шапку, «№» и пустое состояние таблиц рисует MiniTable кита. */

.stack {
  display: flex;
  flex-direction: column;
  gap: var(--k-sp-2);
}

.box {
  border: 1px solid var(--k-line);
  border-radius: var(--k-r-s);
}

.empty {
  margin: 0;
  padding: var(--k-sp-3) var(--k-sp-2);
  font-size: var(--k-fs-1);
  color: var(--k-muted);
  text-align: center;
}

.count {
  margin-right: auto;
  font-size: var(--k-fs-2);
  color: var(--k-muted);
}

.cut {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.muted {
  font-size: var(--k-fs-2);
  color: var(--k-muted);
}

.nil {
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

.lnk {
  padding: 0;
  border: 0;
  background: none;
  font: 500 var(--k-fs-2) / var(--k-lh-2) var(--k-sans);
  color: var(--k-val);
  white-space: nowrap;
  cursor: pointer;
}

.lnk:hover {
  text-decoration: underline;
}

.lnk:focus-visible {
  outline: 2px solid var(--k-val);
  outline-offset: 1px;
}

.lnkMono {
  font-family: var(--k-mono);
  font-weight: 400;
}

/* Статусы (эталон .tt .code/.suf/.fin/.reason/.dur) */
.code {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: var(--k-fs-1) / var(--k-lh-1) var(--k-mono);
  color: var(--k-val);
}

.start {
  color: var(--k-muted);
}

.end {
  color: var(--k-ok);
}

.fin {
  font-weight: 600;
  color: var(--k-ok);
}

.reason {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--k-fs-1);
  color: var(--k-warn);
}

.dur {
  font: var(--k-fs-3) / var(--k-lh-3) var(--k-mono);
  color: var(--k-faint);
}

.slow {
  color: var(--k-warn);
}

/* Комплаенс: вложенная таблица истории (эталон .cp-kv .tt, margin 6 10 8) */
.nested {
  margin: var(--k-sp-1) var(--k-sp-2) var(--k-sp-2);
}

/* Задачи: тело раскрытой строки (эталон .tk.open .txt, .tk .hist) */
.task {
  display: flex;
  flex-direction: column;
  gap: var(--k-sp-1);
}

.taskText {
  margin: 0;
  color: var(--k-ink);
}

.hist {
  display: grid;
  grid-template-columns: var(--k-dt-hist) minmax(0, 1fr);
  gap: 0 var(--k-sp-2);
  padding-top: var(--k-sp-1);
  border-top: 1px dashed var(--k-line);
  font-size: var(--k-fs-2);
}

.histAt {
  font: var(--k-fs-2) / var(--k-lh-2) var(--k-mono);
  color: var(--k-muted);
}

.closed {
  color: var(--k-val);
}
```

- [ ] **Step 5: Статусы.** Создать `apps/pi/src/entities/doc-trail/ui/StatusesTab.tsx`:

```tsx
import { MiniTable, Tag, Timestamp, formatDuration, timestampDiff, type MiniColumn } from '@katran/ui'
import type { StatusEvent } from '../model/types'
import { SLOW_MS, type TrailTabProps } from './lib'
import { Nil } from './parts'
import s from './trail.module.css'

/** Код статуса (эталон codeHtml): суффикс .start серым, .end зелёным; финальный шаг процесса (….finish) — зелёным жирным. */
function StatusCode({ code }: { code: string }) {
  if (/\.finish$/.test(code)) return <span className={[s.code, s.fin].join(' ')}>{code}</span>
  const m = /^(.*)\.(start|end)$/.exec(code)
  if (!m) return <span className={s.code}>{code}</span>
  return <span className={s.code}>{m[1]}<span className={m[2] === 'end' ? s.end : s.start}>.{m[2]}</span></span>
}

/** Δ от предыдущей строки; не дата или время назад — пусто. */
function delta(rows: StatusEvent[], i: number): { text: string; slow: boolean } | null {
  const prev = rows[i - 1]
  const cur = rows[i]
  if (!prev || !cur) return null
  // настенное время бека, без сдвига зоны (кит, Task 2)
  const d = timestampDiff(prev.at, cur.at)
  if (d === null || d < 0) return null
  return { text: formatDuration(d), slow: d > SLOW_MS }
}

/** Вкладка «Статусы» (эталон statusesHtml, index.html:1165): № · дата/время · маршрут · статус · причина · Δ. */
export function StatusesTab({ data }: TrailTabProps<StatusEvent[]>) {
  const columns: MiniColumn<StatusEvent>[] = [
    { id: 'at', header: 'Дата/время', width: 118, render: (r) => <Timestamp iso={r.at} /> },
    { id: 'route', header: 'Маршрут', width: 150, render: (r) => (r.route && r.route !== '—' ? <Tag>{r.route}</Tag> : <Nil />) },
    { id: 'code', header: 'Статус', width: 262, render: (r) => <StatusCode code={r.code} /> },
    {
      id: 'reason', header: 'Причина',
      render: (r) => (r.reason ? <span className={s.reason} data-k-tip={r.reason} data-k-tip-if="truncated">{r.reason}</span> : null),
    },
    {
      id: 'delta', header: 'Δ', width: 50, align: 'end',
      render: (_r, i) => {
        const d = delta(data, i)
        return d ? <span className={[s.dur, d.slow ? s.slow : ''].filter(Boolean).join(' ')}>{d.text}</span> : null
      },
    },
  ]
  return <MiniTable label="Статусы" columns={columns} rows={data} rowKey={(r, i) => `${i}:${r.at}`} empty="Статусов нет" numbered />
}
```

- [ ] **Step 6: Комплаенс.** Создать `apps/pi/src/entities/doc-trail/ui/ComplianceTab.tsx`:

```tsx
import { KeyValueList, MiniTable, StatusBadge, Timestamp, type KeyValueItem, type MiniColumn } from '@katran/ui'
import { toneOf } from '../model/tone'
import type { Compliance } from '../model/types'
import type { TrailTabProps } from './lib'
import { TrailEmpty } from './parts'
import s from './trail.module.css'

/** Подпись 230 px — эталон .cp-kv .xr (index.html:362). */
const LABEL_W = 230

type HistRow = Compliance['history'][number]
const HIST: MiniColumn<HistRow>[] = [
  { id: 'at', header: 'Время попадания', width: 150, render: (h) => <Timestamp iso={h.at} /> },
  { id: 'system', header: 'Система контроля', mono: true, render: (h) => h.system },
  { id: 'department', header: 'Код подразделения', render: (h) => h.department },
]

const decision = (v: string | null) => (v ? <StatusBadge tone={toneOf(v)}>{v}</StatusBadge> : null)
/** Отметки времени — ISO без зоны (маппер Task 7); Timestamp кита: «ДД.ММ ЧЧ:ММ:СС», полное — тултипом. */
const time = (v: string | null) => (v ? <Timestamp iso={v} /> : null)
const yesNo = (v: boolean | null) => (v === null ? null : v ? 'Да' : 'Нет')

/**
 * Вкладка «Комплаенс» (эталон complianceHtml, index.html:1261): запись (ID платёжной инструкции — id открытого документа
 * из контекста), отрицательная нотификация, мониторинг (ИС4021), подразделение (ОПС3308) с историей попадания.
 */
export function ComplianceTab({ data, ctx }: TrailTabProps<Compliance | null>) {
  if (!data) return <TrailEmpty text="Комплаенс-проверок нет" />
  const { record: r, negative: n, monitoring: m, department: d } = data
  const record: KeyValueItem[] = [
    { key: 'id', label: 'ID записи', value: r.id, mono: true },
    { key: 'docId', label: 'ID платёжной инструкции', value: ctx.docId, mono: true },
    { key: 'start', label: 'Начало обработки', value: time(r.start) },
    { key: 'end', label: 'Окончание обработки', value: time(r.end) },
    { key: 'nzr', label: 'Признак постановки на НЗР', value: yesNo(r.nzr) },
  ]
  const negative: KeyValueItem[] = [
    { key: 'decision', label: 'Переданное решение', value: n.decision },
    { key: 'direction', label: 'Направление проверки', value: n.direction },
    { key: 'comment', label: 'Комментарий', value: n.comment },
  ]
  const monitoring: KeyValueItem[] = [
    { key: 'start', label: 'Начало', value: time(m.start) },
    { key: 'end', label: 'Окончание', value: time(m.end) },
    { key: 'decision', label: 'Решение мониторинга', value: decision(m.decision) },
    { key: 'txId', label: 'Идентификатор транзакции', value: m.txId, mono: true },
    { key: 'requestAt', label: 'Создание запроса', value: time(m.requestAt) },
    { key: 'clientId', label: 'Идентификатор клиента', value: m.clientId, mono: true },
  ]
  const department: KeyValueItem[] = [
    { key: 'start', label: 'Начало', value: time(d.start) },
    { key: 'end', label: 'Окончание', value: time(d.end) },
    { key: 'decision', label: 'Решение комплаенс', value: decision(d.decision) },
  ]
  return (
    <div className={s.stack}>
      <KeyValueList items={record} labelWidth={LABEL_W} />
      <KeyValueList title="Отрицательная нотификация в источник" items={negative} labelWidth={LABEL_W} />
      <KeyValueList title="Контроль в системе мониторинга (ИС4021)" items={monitoring} labelWidth={LABEL_W} />
      <div>
        <KeyValueList title="Контроль подразделения комплаенс (ОПС3308)" items={department} labelWidth={LABEL_W} />
        {data.history.length > 0 && (
          <div className={s.nested}>
            <MiniTable
              label="История попадания в подразделение комплаенс"
              columns={HIST}
              rows={data.history}
              rowKey={(h, i) => `${i}:${h.at}`}
              empty="Истории нет"
            />
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Задачи.** Создать `apps/pi/src/entities/doc-trail/ui/TasksTab.tsx`:

```tsx
import { Fragment } from 'react'
import { Button, MiniTable, StatusDot, Tag, Timestamp, formatTimestamp, type MiniColumn, type StatusTone } from '@katran/ui'
import type { DocTask } from '../model/types'
import { STUB, type TrailTabProps } from './lib'
import { LinkButton } from './parts'
import s from './trail.module.css'

/** Точка открытой задачи по тону (эталон .tk .dot.ok/.info/.warn); выполненная — всегда ok. */
const DOT: Record<DocTask['tone'], StatusTone> = { ok: 'ok', info: 'flow', warn: 'warn' }
/** Время в истории — только часы (эталон: '07:31:59'); не ISO — как есть. */
const clock = (at: string) => formatTimestamp(at)?.time ?? at

/** Тело задачи: полный текст и история. Закрытие («Закрыта · кто») — последняя запись истории от маппера (Task 7). */
function TaskBody({ t }: { t: DocTask }) {
  return (
    <div className={s.task}>
      <p className={s.taskText}>{t.text}</p>
      <div className={s.hist}>
        {t.history.map((h, i) => (
          <Fragment key={i}>
            <span className={s.histAt}>{clock(h.at)}</span>
            <span className={/^Закрыта/.test(h.text) ? s.closed : undefined}>{h.text}</span>
          </Fragment>
        ))}
      </div>
    </div>
  )
}

/**
 * Вкладка «Задачи» (эталон tasksHtml, index.html:1167): счётчик и переход в «Ручные отклонения»; строка — точка, время,
 * тип, текст, «История»; раскрытие — полный текст и история. По умолчанию свёрнуты (mkui: tasks — пустое множество).
 */
export function TasksTab({ data, ctx }: TrailTabProps<DocTask[]>) {
  const open = data.filter((t) => t.state === 'open').length
  const columns: MiniColumn<DocTask>[] = [
    {
      id: 'dot', header: '', width: 14,
      render: (t) => (t.state === 'done'
        ? <StatusDot tone="ok" size="s" label="Выполнена" />
        : <StatusDot tone={DOT[t.tone]} size="s" label="Открыта" />),
    },
    { id: 'at', header: '', width: 100, render: (t) => <Timestamp iso={t.at} /> },
    { id: 'type', header: '', width: 170, render: (t) => <Tag>{t.type}</Tag> },
    { id: 'text', header: '', render: (t) => <span className={s.cut} data-k-tip={t.text} data-k-tip-if="truncated">{t.text}</span> },
    { id: 'history', header: '', width: 64, align: 'end', render: () => <LinkButton onClick={() => ctx.announce(STUB)}>История</LinkButton> },
  ]
  return (
    <MiniTable
      label="Задачи"
      columns={columns}
      rows={data}
      rowKey={(t) => t.id}
      rowLabel={(t) => t.text}
      empty="Задач нет"
      toolbar={(
        <>
          <span className={s.count}>{`${data.length} задач${open ? `, открытых ${open}` : ''}`}</span>
          <Button size="s" onClick={() => ctx.announce(STUB)}>Перейти в блок «Ручные отклонения»</Button>
        </>
      )}
      renderExpanded={(t) => <TaskBody t={t} />}
      expanded={ctx.expanded ?? []}
      onExpandedChange={ctx.setExpanded}
    />
  )
}
```

- [ ] **Step 8: Нотификации и Стриминг.** Создать `apps/pi/src/entities/doc-trail/ui/NotificationsTab.tsx`:

```tsx
import { Button, MiniTable, StatusBadge, Tag, Timestamp, type MiniColumn } from '@katran/ui'
import { toneOf } from '../model/tone'
import type { DocNotification } from '../model/types'
import { STUB, type TrailTabProps } from './lib'
import { LinkButton } from './parts'
import s from './trail.module.css'

/** Вкладка «Нотификации» (эталон notifHtml, index.html:1180): счётчик и «Переотправить»; № · время · попытки · статус · код ответа · исходное. */
export function NotificationsTab({ data, ctx }: TrailTabProps<DocNotification[]>) {
  const failed = data.filter((n) => n.status !== 'OK').length
  const columns: MiniColumn<DocNotification>[] = [
    { id: 'at', header: 'Дата/время', width: 120, render: (n) => <Timestamp iso={n.at} /> },
    { id: 'attempts', header: 'Попытки', width: 70, mono: true, render: (n) => n.attempts },
    { id: 'status', header: 'Статус', width: 90, render: (n) => <StatusBadge tone={toneOf(n.status)}>{n.status}</StatusBadge> },
    { id: 'code', header: 'Код ответа', width: 120, render: (n) => <Tag tone="mt">{n.code}</Tag> },
    {
      id: 'source', header: '', align: 'end',
      render: (_n, i) => (
        <LinkButton label={`Исходное сообщение, отправка ${i + 1}`} onClick={() => ctx.announce(STUB)}>Исходное сообщение</LinkButton>
      ),
    },
  ]
  return (
    <MiniTable
      label="Нотификации"
      columns={columns}
      rows={data}
      rowKey={(n, i) => `${i}:${n.at}`}
      empty="Нотификаций нет"
      numbered
      toolbar={(
        <>
          <span className={s.count}>{`${data.length} отправок${failed ? `, с ошибкой ${failed}` : ''}`}</span>
          <Button size="s" onClick={() => ctx.announce(STUB)}>Переотправить</Button>
        </>
      )}
    />
  )
}
```

  Создать `apps/pi/src/entities/doc-trail/ui/StreamTab.tsx`:

```tsx
import { MiniTable, StatusBadge, Tag, Timestamp, type MiniColumn } from '@katran/ui'
import { toneOf } from '../model/tone'
import type { StreamEvent } from '../model/types'
import type { TrailTabProps } from './lib'
import s from './trail.module.css'

const COLUMNS: MiniColumn<StreamEvent>[] = [
  { id: 'at', header: 'Дата/время', width: 120, render: (e) => <Timestamp iso={e.at} /> },
  { id: 'system', header: 'Код ИС', width: 60, render: (e) => <Tag tone="mt">{e.system}</Tag> },
  { id: 'destination', header: 'ИС куда', width: 90, render: (e) => <span className={[s.muted, s.cut].join(' ')}>{e.destination}</span> },
  { id: 'event', header: 'Событие', mono: true, render: (e) => <span className={s.code}>{e.event}</span> },
  { id: 'status', header: 'Статус', width: 70, render: (e) => <StatusBadge tone={toneOf(e.status)}>{e.status}</StatusBadge> },
  { id: 'tries', header: 'Попытки', width: 60, align: 'end', mono: true, render: (e) => e.tries },
]

/** Вкладка «Стриминг» (эталон streamHtml, index.html:1174): № · время · код ИС · ИС куда · событие · статус · попытки. */
export function StreamTab({ data }: TrailTabProps<StreamEvent[]>) {
  return <MiniTable label="Стриминг" columns={COLUMNS} rows={data} rowKey={(e, i) => `${i}:${e.at}`} empty="Событий стриминга нет" numbered />
}
```

- [ ] **Step 9: публичный API.** В конец `apps/pi/src/entities/doc-trail/index.ts` (создан в Task 7) дописать:

```ts
export type { TrailTabProps } from './ui/lib'
export { StatusesTab } from './ui/StatusesTab'
export { ComplianceTab } from './ui/ComplianceTab'
export { TasksTab } from './ui/TasksTab'
export { NotificationsTab } from './ui/NotificationsTab'
export { StreamTab } from './ui/StreamTab'
```

- [ ] **Step 10: запуск.**

  Run: `pnpm --filter pi test -- doc-trail`
  Expected: PASS — `tabs1.test.tsx` 27 тестов, плюс тесты Task 7 (`tone`, `trail.mapper`).

  Run: `pnpm check`
  Expected: зелёный (stylelint: в `trail.module.css` только `var(--k-*)`, `px` — в `border*`/`outline*`; eslint: `ui` импортирует кит, `shared/lib/detail`, `shared/lib/test` (только `testing.tsx`) и свою `model`; `gen:check` — `tokens.css`/`tokens.ts` закоммичены вместе с `tokens.src.ts`).

- [ ] **Step 11: commit.**

```bash
git add packages/tokens/src/tokens.src.ts packages/tokens/src/tokens.css packages/tokens/src/tokens.ts apps/pi/src/entities/doc-trail/index.ts apps/pi/src/entities/doc-trail/ui/lib.ts apps/pi/src/entities/doc-trail/ui/parts.tsx apps/pi/src/entities/doc-trail/ui/testing.tsx apps/pi/src/entities/doc-trail/ui/trail.module.css apps/pi/src/entities/doc-trail/ui/StatusesTab.tsx apps/pi/src/entities/doc-trail/ui/ComplianceTab.tsx apps/pi/src/entities/doc-trail/ui/TasksTab.tsx apps/pi/src/entities/doc-trail/ui/NotificationsTab.tsx apps/pi/src/entities/doc-trail/ui/StreamTab.tsx apps/pi/src/entities/doc-trail/ui/tabs1.test.tsx
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "apps/pi: doc-trail — вкладки Статусы, Комплаенс, Задачи, Нотификации, Стриминг на MiniTable, KeyValueList и StatusBadge кита"
```

---

### Task 9: `entities/doc-trail/ui` — Связанные, MPU, Аудит, Исходный текст / ED244; `TRAIL_VIEWS`

**Files:**
- Create: `apps/pi/src/entities/doc-trail/ui/{LinkedTab.tsx, MpuTab.tsx, AuditTab.tsx, SourceTab.tsx, views.ts, tabs2.test.tsx}`
- Modify: `apps/pi/src/entities/doc-trail/ui/trail.module.css` (дописать), `apps/pi/src/entities/doc-trail/index.ts`

**Interfaces:**
- Produces (`entities/doc-trail`, `index.ts`):

```ts
LinkedTab(props: TrailTabProps<LinkedDoc[]>): JSX.Element       // умолчание раскрытия (ctx.expanded === null) — первая запись
MpuTab(props: TrailTabProps<MpuMessage[]>): JSX.Element         // умолчание — swiftText первого сообщения
AuditTab(props: TrailTabProps<AuditSections>): JSX.Element      // умолчание — commonSection
SourceTab(props: TrailTabProps<SourceTexts>): JSX.Element       // умолчание — все непустые; один вид на source и ed244
TRAIL_VIEWS: Record<TrailTabId, RemoteTabView>                  // ui/views.ts; tasks — skeletonRows 5
```

- Ключи раскрытия в `ctx.expanded`: «Связанные» — `docId`; MPU — `id` сообщения; «Аудит» — имя секции; «Исходный текст» — ключ исходника. Аккордеоны — управляемый `Disclosure` (`open` + `onOpenChange`), новый ключ — в конец (`toggleKey`).
- Consumes: всё из Task 8 (`lib.ts`, `parts.tsx`, `testing.tsx`, `trail.module.css`); `CodeView` (Task 5; `role="region"` с именем `label`), `Disclosure` с `mono` и `emptyText` (Task 4), `CopyValue` (кит 2a); `toneOf` с `DONE → ok` (Task 7); `remoteTab`, `RemoteTabView` (Task 6); `LinkedDoc`, `LinkedParty`, `LinkedPosting`, `MpuMessage`, `AuditSections`, `SourceTexts`, `TrailTabId`, `TRAIL_PARSERS`, `TRAIL_EXAMPLES` (Task 7; последние два — только в тесте).

- [ ] **Step 1: тесты (падают).** Создать `apps/pi/src/entities/doc-trail/ui/tabs2.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { formatAmount } from '@katran/ui'
import { TRAIL_EXAMPLES } from '../api/trail.example'
import { TRAIL_PARSERS } from '../api/trail.mapper'
import type { AuditSections, LinkedDoc, MpuMessage, SourceTexts, TrailTabId } from '../model/types'
import { AuditTab } from './AuditTab'
import { LinkedTab } from './LinkedTab'
import { MpuTab } from './MpuTab'
import { SourceTab } from './SourceTab'
import { renderTab, shown, toggles } from './testing'
import { TRAIL_VIEWS } from './views'

// Данные — со стенда (index.html:767–871, обезличен), в доменных типах Task 7
const ID1 = 'a18d3c05-b393-4252-a3c1-c93791937ccc'
const ID2 = '5e9b7255-c859-4786-b92a-5315c1b73227'
const LINKED: LinkedDoc[] = [
  {
    docId: ID1, date: '2026-09-23', type: 'InternalFXDOC', relation: 'CHILD', purpose: 'MT103 USD 1249965.00 23.09.2026 возврат (1.6.2.2.1.)',
    status: 'NEW', processed: '2026-09-23T09:02:11', posted: '2026-09-23', kind: 'SHA',
    debit: { account: '40817840100050017762', amount: '1249965.00', currency: 'USD', register: '00010_ClientCurrent' },
    credit: { account: '30110840700000001842', amount: '1249965.00', currency: 'USD', register: '00000_NostroUSD' },
    from: { name: 'SEMENOVA IRINA VLADIMIROVNA', account: '40817840100050017762', extra: null },
    to: { name: 'LAVRENTIEV DMITRY OLEGOVICH', account: '40817840500010042371', extra: 'RETURN OF FX2609220000417' },
  },
  {
    docId: ID2, date: '2026-09-22', type: 'InternalFXFEE', relation: 'CHILD', purpose: 'Комиссия за входящий перевод по тарифу OUR',
    status: 'DONE', processed: '2026-09-22T07:35:01', posted: '2026-09-22', kind: 'OUR',
    debit: { account: '40817840100050017762', amount: '35.00', currency: 'USD', register: '00010_ClientCurrent' },
    credit: { account: '70601840100000000519', amount: '35.00', currency: 'USD', register: '00020_CommissionIncome' },
    from: { name: 'SEMENOVA IRINA VLADIMIROVNA', account: '40817840100050017762', extra: null },
    to: { name: 'VOSTOCHNY KREDIT BANK', account: '70601840100000000519', extra: 'Тариф 4.2.1' },
  },
]
const SWIFT_199 = '{1:F01VKRBRU8KXXXX0000000000}{2:I199NRDIRUMMXXXXN}{3:{121:eb6305c9-1f8c-41e3-a3b2-6d7e9f2a4c10}}{4:\n:20:VK2609220000417\n:21:FX2609220000417\n:79:YOUR MT103 FX2609220000417 DD 22.09.2026\n-}'
const MPU: MpuMessage[] = [
  {
    id: 'ee8bf4eb-5545-4f07-9617-8a5e7106302f', type: 'MT199', created: '2026-09-22T04:35:02.121', exportStatus: 'SENT',
    exported: '2026-09-22T04:35:47.308', receiver: 'NRDIRUMMXXX', docReference: 'VK2609220000417', docId: '03e8b84b-d1c5-4f07-aa49-8be3e9e4c8e8', swift: SWIFT_199,
  },
  {
    id: 'f1c2a7d0-3b4e-4a51-9c86-2e7d5b9a0c14', type: 'MT199', created: '2026-09-22T04:36:10.004', exportStatus: 'NEW',
    exported: null, receiver: 'NRDIRUMMXXX', docReference: 'VK2609220000418', docId: '03e8b84b-d1c5-4f07-aa49-8be3e9e4c8e8', swift: SWIFT_199,
  },
]
const AUDIT: AuditSections = {
  commonSection: { creationDate: '2026-09-22T04:31:45.051765Z', paymentServiceProvider: 'SUBOUL', paymentFlow: null, paymentInitiatorSystem: 'ERS.ERS_1', sourceSystem: 'SRC1', resending: false },
  documentSection: { docReferenceIn: 'FX2609220000417', messageType: 'MT103', amount: 1250000, currency: 'USD' },
  taskSections: { open: 1 },
}
const SOURCE: SourceTexts = {
  swiftMessage: '{1:F01VKRBRU8KXXXX0427047245}{4:\n:20:FX2609220000417\n:23B:CRED\n-}',
  outgoingSwiftMessage: '',
  ED244: '<?xml version="1.0" encoding="UTF-8"?><ED244 xmlns="urn:cbr-ru:ed:v2.0" EDNo="1" EDDate="2026-09-23"><Annotation>ОТВЕТ</Annotation></ED244>',
}
const HOSTILE = '<img src=x onerror=alert(1)>'

describe('LinkedTab (эталон linkedHtml)', () => {
  it('по умолчанию раскрыта первая запись: ID ссылкой-кнопкой и копированием, карточка, Дт/Кт, отправитель/получатель', () => {
    renderTab((ctx) => <LinkedTab data={LINKED} ctx={ctx} />)
    // имя переключателя — «Свернуть/Раскрыть» + rowLabel «дата · тип»
    expect(screen.getByRole('button', { name: 'Свернуть 2026-09-23 · InternalFXDOC' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Раскрыть 2026-09-22 · InternalFXFEE' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryAllByRole('columnheader', { name: '' })).toHaveLength(0)
    expect(screen.getByRole('button', { name: `Открыть InternalFXDOC ${ID1} в соседней панели` })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Скопировать ID' })).toBeInTheDocument()
    expect(screen.getByText('23.09.2026')).toBeInTheDocument()
    const postings = screen.getByRole('table', { name: `Проводки ${ID1}` })
    expect(within(postings).getByRole('columnheader', { name: 'Дт' })).toBeInTheDocument()
    expect(within(postings).getByText('00000_NostroUSD')).toBeInTheDocument()
    // сумма бека — десятичная строка без группировки, показ — formatAmount кита
    expect(within(postings).getAllByText(formatAmount(1249965))).toHaveLength(2)
    expect(within(postings).queryByText('1249965.00')).toBeNull()
    const parties = screen.getByRole('table', { name: `Отправитель и получатель ${ID1}` })
    expect(within(parties).getByText('RETURN OF FX2609220000417')).toBeInTheDocument()
    expect(within(parties).getByText('не заполнено')).toBeInTheDocument()
    expect(shown('00020_CommissionIncome')).toBe(false)
  })
  it('ID открывает документ в B и строку не сворачивает', async () => {
    const { spies } = renderTab((ctx) => <LinkedTab data={LINKED} ctx={ctx} />)
    await userEvent.click(screen.getByRole('button', { name: `Открыть InternalFXDOC ${ID1} в соседней панели` }))
    expect(spies.openDocument).toHaveBeenCalledWith(ID1)
    expect(spies.setExpanded).not.toHaveBeenCalled()
  })
  it('клик по второй строке — раскрыты обе; раскрытие [] из контекста — все свёрнуты', async () => {
    const { spies, unmount } = renderTab((ctx) => <LinkedTab data={LINKED} ctx={ctx} />)
    await userEvent.click(screen.getByRole('button', { name: 'Раскрыть 2026-09-22 · InternalFXFEE' }))
    expect(spies.setExpanded).toHaveBeenLastCalledWith([ID1, ID2])
    expect(shown('00020_CommissionIncome')).toBe(true)
    unmount()
    renderTab((ctx) => <LinkedTab data={LINKED} ctx={ctx} />, [])
    expect(toggles().map((b) => b.getAttribute('aria-expanded'))).toEqual(['false', 'false'])
  })
  it('пусто — «Связанных документов нет»; назначение из бека — текст, не разметка', () => {
    const { unmount } = renderTab((ctx) => <LinkedTab data={[]} ctx={ctx} />)
    expect(screen.getByText('Связанных документов нет')).toBeInTheDocument()
    unmount()
    const { container } = renderTab((ctx) => <LinkedTab data={[{ ...LINKED[0]!, purpose: HOSTILE }]} ctx={ctx} />)
    expect(screen.getAllByText(HOSTILE).length).toBeGreaterThan(0)
    expect(container.querySelector('img')).toBeNull()
  })
  it('без нарушений axe (первая запись раскрыта)', async () => {
    const { container } = renderTab((ctx) => <LinkedTab data={LINKED} ctx={ctx} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('MpuTab (эталон mpuHtml)', () => {
  it('карточка сообщения: ID с копированием, статус бейджем, тип, получатель, время, docReference, docId', () => {
    renderTab((ctx) => <MpuTab data={MPU} ctx={ctx} />)
    const card = screen.getByRole('region', { name: `Сообщение MPU MT199 ${MPU[0]!.id}` })
    expect(within(card).getByRole('button', { name: MPU[0]!.id })).toBeInTheDocument()
    expect(within(card).getByText('Статус на экспорте')).toBeInTheDocument()
    expect(within(card).getByText('SENT')).toBeInTheDocument()
    expect(within(card).getByText('VK2609220000417')).toBeInTheDocument()
    const second = screen.getByRole('region', { name: `Сообщение MPU MT199 ${MPU[1]!.id}` })
    expect(within(second).getByText('не заполнено')).toBeInTheDocument()
  })
  it('swiftText: у первого раскрыт по умолчанию, длина в заголовке; раскрытие второго — в контекст', async () => {
    const { spies } = renderTab((ctx) => <MpuTab data={MPU} ctx={ctx} />)
    const [first, second] = screen.getAllByRole('button', { name: 'swiftText' })
    expect(first).toHaveAttribute('aria-expanded', 'true')
    expect(second).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getAllByText(`${SWIFT_199.length} симв.`)).toHaveLength(2)
    expect(screen.getByRole('region', { name: `swiftText сообщения ${MPU[0]!.id}` })).toHaveTextContent(':20:VK2609220000417')
    await userEvent.click(second!)
    expect(spies.setExpanded).toHaveBeenLastCalledWith([MPU[0]!.id, MPU[1]!.id])
    expect(second).toHaveAttribute('aria-expanded', 'true')
  })
  it('пусто — «Сообщений MPU нет»', () => {
    renderTab((ctx) => <MpuTab data={[]} ctx={ctx} />)
    expect(screen.getByText('Сообщений MPU нет')).toBeInTheDocument()
  })
  it('без нарушений axe', async () => {
    const { container } = renderTab((ctx) => <MpuTab data={MPU} ctx={ctx} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('AuditTab (эталон auditHtml)', () => {
  it('секция — аккордеон с числом ключей; по умолчанию раскрыта commonSection с JSON', () => {
    renderTab((ctx) => <AuditTab data={AUDIT} ctx={ctx} />)
    expect(screen.getByRole('button', { name: 'commonSection' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'documentSection' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('6 ключей')).toBeInTheDocument()
    expect(screen.getByText('4 ключа')).toBeInTheDocument()
    expect(screen.getByText('1 ключ')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Секция аудита commonSection' })).toHaveTextContent('paymentServiceProvider')
    expect(screen.getByRole('region', { name: 'Секция аудита commonSection' })).toHaveTextContent('SUBOUL')
  })
  it('открыть и закрыть секцию — в контекст', async () => {
    const { spies } = renderTab((ctx) => <AuditTab data={AUDIT} ctx={ctx} />)
    await userEvent.click(screen.getByRole('button', { name: 'documentSection' }))
    expect(spies.setExpanded).toHaveBeenLastCalledWith(['commonSection', 'documentSection'])
    await userEvent.click(screen.getByRole('button', { name: 'commonSection' }))
    expect(spies.setExpanded).toHaveBeenLastCalledWith(['documentSection'])
    expect(screen.getByRole('button', { name: 'commonSection' })).toHaveAttribute('aria-expanded', 'false')
  })
  it('пусто — «Аудит пуст»', () => {
    renderTab((ctx) => <AuditTab data={{}} ctx={ctx} />)
    expect(screen.getByText('Аудит пуст')).toBeInTheDocument()
  })
  it('без нарушений axe', async () => {
    const { container } = renderTab((ctx) => <AuditTab data={AUDIT} ctx={ctx} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('SourceTab (эталон sourceHtml)', () => {
  it('по умолчанию раскрыты все непустые; длина в заголовке; пустой ключ не раскрывается', () => {
    renderTab((ctx) => <SourceTab data={SOURCE} ctx={ctx} />)
    expect(screen.getByRole('button', { name: 'swiftMessage' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'ED244' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(`${SOURCE.swiftMessage!.length} симв.`)).toBeInTheDocument()
    const empty = screen.getByRole('heading', { name: 'outgoingSwiftMessage' })
    expect(empty.parentElement).toHaveTextContent('нет')
    expect(empty.parentElement).not.toHaveTextContent('нет данных')
    expect(screen.queryByRole('button', { name: 'outgoingSwiftMessage' })).toBeNull()
    expect(screen.getByRole('region', { name: 'swiftMessage' })).toHaveTextContent(':20:FX2609220000417')
    expect(screen.getByRole('region', { name: 'ED244' })).toHaveTextContent('ОТВЕТ')
  })
  it('свернуть исходник — в контекст; раскрытие из контекста важнее умолчания', async () => {
    const { spies, unmount } = renderTab((ctx) => <SourceTab data={SOURCE} ctx={ctx} />)
    await userEvent.click(screen.getByRole('button', { name: 'swiftMessage' }))
    expect(spies.setExpanded).toHaveBeenLastCalledWith(['ED244'])
    unmount()
    renderTab((ctx) => <SourceTab data={SOURCE} ctx={ctx} />, [])
    expect(screen.getByRole('button', { name: 'ED244' })).toHaveAttribute('aria-expanded', 'false')
  })
  it('пусто — «Исходного текста нет»; исходник из бека — текст, не разметка', () => {
    const { unmount } = renderTab((ctx) => <SourceTab data={{}} ctx={ctx} />)
    expect(screen.getByText('Исходного текста нет')).toBeInTheDocument()
    unmount()
    const { container } = renderTab((ctx) => <SourceTab data={{ ED244: HOSTILE, swiftMessage: `{4:\n:70:${HOSTILE}\n-}` }} ctx={ctx} />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByRole('region', { name: 'swiftMessage' })).toHaveTextContent(HOSTILE)
  })
  it('без нарушений axe', async () => {
    const { container } = renderTab((ctx) => <SourceTab data={SOURCE} ctx={ctx} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('TRAIL_VIEWS — контракт с TRAIL_PARSERS', () => {
  const ids = Object.keys(TRAIL_PARSERS) as TrailTabId[]
  it('ключи видов и парсеров совпадают; все удалённые; скелетон «Задач» — 5 строк', () => {
    expect(Object.keys(TRAIL_VIEWS).sort()).toEqual([...ids].sort())
    for (const id of ids) expect(TRAIL_VIEWS[id].kind, id).toBe('remote')
    expect(TRAIL_VIEWS.tasks.skeletonRows).toBe(5)
  })
  it('каждый вид рисует пример своей вкладки после своего парсера — без нарушений axe', async () => {
    for (const id of ids) {
      const data = TRAIL_PARSERS[id](TRAIL_EXAMPLES[id], id)
      const { container, unmount } = renderTab((ctx) => TRAIL_VIEWS[id].render(data, ctx))
      expect(container.textContent, id).not.toBe('')
      expect(await axe(container), id).toHaveNoViolations()
      unmount()
    }
  })
})
```

  Run: `pnpm --filter pi test -- doc-trail/ui/tabs2`
  Expected: FAIL — `Failed to resolve import "./AuditTab"`.

- [ ] **Step 2: стили.** В конец `apps/pi/src/entities/doc-trail/ui/trail.module.css` дописать:

```css
/* Связанные (эталон .ld/.ldb/.kvs/.two-t, index.html:325–333) и MPU (карточка .ldb + .ah swiftText) */
.date {
  font: var(--k-fs-2) / var(--k-lh-2) var(--k-mono);
  color: var(--k-ink2);
}

.lbl {
  font-size: var(--k-fs-2);
  color: var(--k-muted);
}

.val {
  color: var(--k-val);
}

.monoVal {
  font: var(--k-fs-2) / var(--k-lh-2) var(--k-mono);
  color: var(--k-val);
}

.idLine {
  display: inline-flex;
  align-items: baseline;
  gap: var(--k-sp-2);
  min-width: 0;
}

.linkedBody {
  display: flex;
  flex-direction: column;
  gap: var(--k-sp-2);
}

.twoT {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--k-sp-2);
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--k-sp-1);
}

/* длина исходника и число ключей в заголовке аккордеона (эталон .au .ah .lbl) */
.len {
  margin-left: auto;
  font: var(--k-fs-3) / var(--k-lh-3) var(--k-mono);
  color: var(--k-muted);
  white-space: nowrap;
}
```

- [ ] **Step 3: Связанные.** Создать `apps/pi/src/entities/doc-trail/ui/LinkedTab.tsx`:

```tsx
import { CopyValue, KeyValueList, MiniTable, StatusBadge, Tag, Timestamp, formatAmount, formatDate, type KeyValueItem, type MiniColumn } from '@katran/ui'
import type { TabContext } from '../../../shared/lib/detail'
import { toneOf } from '../model/tone'
import type { LinkedDoc, LinkedParty, LinkedPosting } from '../model/types'
import type { TrailTabProps } from './lib'
import { LinkButton, Nil } from './parts'
import s from './trail.module.css'

type PairRow = { key: string; label: string; mono: boolean; a: string | null; b: string | null }

/** Сумма бека — десятичная строка без группировки ('1249965.00', маппер Task 7) → formatAmount кита; не число — как есть. */
const amountText = (v: string | null): string | null => {
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? formatAmount(n) : v
}

const POSTING: { key: keyof LinkedPosting; label: string; mono: boolean }[] = [
  { key: 'account', label: 'Счёт', mono: true }, { key: 'amount', label: 'Сумма', mono: false },
  { key: 'currency', label: 'Валюта', mono: false }, { key: 'register', label: 'Регистр', mono: false },
]
const PARTY: { key: keyof LinkedParty; label: string; mono: boolean }[] = [
  { key: 'name', label: 'Наимен.', mono: false }, { key: 'account', label: 'Счёт', mono: true }, { key: 'extra', label: 'Доп.', mono: false },
]

const pairCell = (v: string | null, mono: boolean) => (v
  ? <span className={[s.cut, mono ? s.monoVal : s.val].join(' ')} data-k-tip={v} data-k-tip-if="truncated">{v}</span>
  : <Nil />)

/** Мини-таблица 64 / 1fr / 1fr (эталон .two-t .tt): Дт/Кт или отправитель/получатель. */
function PairTable({ label, heads, rows }: { label: string; heads: [string, string]; rows: PairRow[] }) {
  const columns: MiniColumn<PairRow>[] = [
    { id: 'label', header: '', width: 64, render: (r) => <span className={s.lbl}>{r.label}</span> },
    { id: 'a', header: heads[0], render: (r) => pairCell(r.a, r.mono) },
    { id: 'b', header: heads[1], render: (r) => pairCell(r.b, r.mono) },
  ]
  return <MiniTable label={label} columns={columns} rows={rows} rowKey={(r) => r.key} empty="—" />
}

function LinkedBody({ doc, ctx }: { doc: LinkedDoc; ctx: TabContext }) {
  const items: KeyValueItem[] = [
    {
      key: 'id', label: 'ID',
      value: (
        <span className={s.idLine}>
          <LinkButton mono label={`Открыть ${doc.type} ${doc.docId} в соседней панели`} onClick={() => ctx.openDocument(doc.docId)}>{doc.docId}</LinkButton>
          <CopyValue value={doc.docId} tone="muted" display={<><span aria-hidden="true">⧉</span><span className={s.sr}>Скопировать ID</span></>} />
        </span>
      ),
    },
    { key: 'processed', label: 'Обработка', value: doc.processed ? <Timestamp iso={doc.processed} /> : null },
    { key: 'posted', label: 'Проводка', value: doc.posted ? formatDate(doc.posted) : null },
    { key: 'kind', label: 'Вид', value: doc.kind ? <Tag>{doc.kind}</Tag> : null },
    {
      key: 'purpose', label: 'Назначение',
      value: doc.purpose ? <span className={s.cut} data-k-tip={doc.purpose} data-k-tip-if="truncated">{doc.purpose}</span> : null,
    },
  ]
  return (
    <div className={s.linkedBody}>
      <KeyValueList columns={2} labelWidth={80} items={items} />
      <div className={s.twoT}>
        <PairTable
          label={`Проводки ${doc.docId}`}
          heads={['Дт', 'Кт']}
          rows={POSTING.map((p) => {
            const fmt = p.key === 'amount' ? amountText : (v: string | null) => v
            return { key: p.key, label: p.label, mono: p.mono, a: fmt(doc.debit[p.key]), b: fmt(doc.credit[p.key]) }
          })}
        />
        <PairTable
          label={`Отправитель и получатель ${doc.docId}`}
          heads={['Отправитель', 'Получатель']}
          rows={PARTY.map((p) => ({ key: p.key, label: p.label, mono: p.mono, a: doc.from[p.key], b: doc.to[p.key] }))}
        />
      </div>
    </div>
  )
}

/**
 * Вкладка «Связанные документы» (эталон linkedHtml, index.html:1193): строка — дата, тип, связь, назначение, статус;
 * раскрытие — карточка и две мини-таблицы. ID открывает документ в соседней панели (B). По умолчанию раскрыта первая запись (mkui).
 */
export function LinkedTab({ data, ctx }: TrailTabProps<LinkedDoc[]>) {
  const first = data[0]
  const columns: MiniColumn<LinkedDoc>[] = [
    { id: 'date', header: '', width: 84, render: (d) => <span className={s.date}>{d.date}</span> },
    { id: 'type', header: '', width: 130, render: (d) => <Tag tone="mt">{d.type}</Tag> },
    { id: 'relation', header: '', width: 70, render: (d) => <Tag>{d.relation}</Tag> },
    {
      id: 'purpose', header: '',
      render: (d) => (d.purpose ? <span className={[s.cut, s.muted].join(' ')} data-k-tip={d.purpose} data-k-tip-if="truncated">{d.purpose}</span> : <Nil />),
    },
    { id: 'status', header: '', width: 90, align: 'end', render: (d) => <StatusBadge tone={toneOf(d.status)}>{d.status}</StatusBadge> },
  ]
  return (
    <MiniTable
      label="Связанные документы"
      columns={columns}
      rows={data}
      rowKey={(d) => d.docId}
      rowLabel={(d) => `${d.date} · ${d.type}`}
      empty="Связанных документов нет"
      renderExpanded={(d) => <LinkedBody doc={d} ctx={ctx} />}
      expanded={ctx.expanded ?? (first ? [first.docId] : [])}
      onExpandedChange={ctx.setExpanded}
    />
  )
}
```

- [ ] **Step 4: MPU, Аудит, Исходный текст.** Создать `apps/pi/src/entities/doc-trail/ui/MpuTab.tsx`:

```tsx
import { CodeView, CopyValue, Disclosure, KeyValueList, StatusBadge, Tag, Timestamp, type KeyValueItem } from '@katran/ui'
import { toneOf } from '../model/tone'
import type { MpuMessage } from '../model/types'
import { toggleKey, type TrailTabProps } from './lib'
import { TrailEmpty } from './parts'
import s from './trail.module.css'

const itemsOf = (m: MpuMessage): KeyValueItem[] => [
  { key: 'id', label: 'ID', value: <CopyValue value={m.id} tone="mono" /> },
  { key: 'exportStatus', label: 'Статус на экспорте', value: <StatusBadge tone={toneOf(m.exportStatus)}>{m.exportStatus}</StatusBadge> },
  { key: 'type', label: 'Тип', value: <Tag tone="mt">{m.type}</Tag> },
  { key: 'receiver', label: 'Получатель', value: m.receiver, mono: true },
  { key: 'created', label: 'Создано', value: <Timestamp iso={m.created} /> },
  { key: 'exported', label: 'Экспорт', value: m.exported ? <Timestamp iso={m.exported} /> : null },
  { key: 'docReference', label: 'docReference', value: m.docReference, mono: true },
  { key: 'docId', label: 'docId', value: m.docId, mono: true },
]

/**
 * Вкладка «MPU» (эталон mpuHtml, index.html:1251): карточка на сообщение и аккордеон swiftText с длиной.
 * По умолчанию раскрыт swiftText первого сообщения (mkui).
 */
export function MpuTab({ data, ctx }: TrailTabProps<MpuMessage[]>) {
  const first = data[0]
  if (!first) return <TrailEmpty text="Сообщений MPU нет" />
  const keys = ctx.expanded ?? [first.id]
  return (
    <div className={s.stack}>
      {data.map((m) => (
        <section key={m.id} className={s.card} aria-label={`Сообщение MPU ${m.type} ${m.id}`}>
          <KeyValueList columns={2} labelWidth={130} items={itemsOf(m)} />
          <Disclosure
            title="swiftText"
            mono
            empty={!m.swift}
            emptyText="нет"
            aside={<span className={s.len}>{`${m.swift.length} симв.`}</span>}
            open={keys.includes(m.id)}
            onOpenChange={(open) => ctx.setExpanded(toggleKey(keys, m.id, open))}
          >
            <CodeView code={m.swift} language="swift" label={`swiftText сообщения ${m.id}`} />
          </Disclosure>
        </section>
      ))}
    </div>
  )
}
```

  Создать `apps/pi/src/entities/doc-trail/ui/AuditTab.tsx`:

```tsx
import { CodeView, Disclosure } from '@katran/ui'
import type { AuditSections } from '../model/types'
import { keysLabel, toggleKey, type TrailTabProps } from './lib'
import { TrailEmpty } from './parts'
import s from './trail.module.css'

/** Вкладка «Аудит» (эталон auditHtml, index.html:1188): секция — аккордеон с числом ключей, JSON с подсветкой. По умолчанию — commonSection. */
export function AuditTab({ data, ctx }: TrailTabProps<AuditSections>) {
  const names = Object.keys(data)
  if (!names.length) return <TrailEmpty text="Аудит пуст" />
  const keys = ctx.expanded ?? ['commonSection']
  return (
    <div className={s.stack}>
      {names.map((name) => {
        const section = data[name] ?? {}
        return (
          <Disclosure
            key={name}
            title={name}
            mono
            aside={<span className={s.len}>{keysLabel(Object.keys(section).length)}</span>}
            open={keys.includes(name)}
            onOpenChange={(open) => ctx.setExpanded(toggleKey(keys, name, open))}
          >
            <CodeView code={JSON.stringify(section, null, 2)} language="json" label={`Секция аудита ${name}`} />
          </Disclosure>
        )
      })}
    </div>
  )
}
```

  Создать `apps/pi/src/entities/doc-trail/ui/SourceTab.tsx`:

```tsx
import { CodeView, Disclosure } from '@katran/ui'
import type { SourceTexts } from '../model/types'
import { codeLanguage, toggleKey, type TrailTabProps } from './lib'
import { TrailEmpty } from './parts'
import s from './trail.module.css'

/**
 * Вкладки «Исходный текст» (валюта) и «ED244» (рубль) — эталон sourceHtml, index.html:1246: аккордеон на ключ,
 * длина в заголовке; XML, если текст начинается с «<», иначе SWIFT. Пустой ключ не раскрывается.
 * По умолчанию раскрыты все непустые (спека 2b §3.3).
 */
export function SourceTab({ data, ctx }: TrailTabProps<SourceTexts>) {
  const names = Object.keys(data)
  if (!names.length) return <TrailEmpty text="Исходного текста нет" />
  const keys = ctx.expanded ?? names.filter((k) => Boolean(data[k]))
  return (
    <div className={s.stack}>
      {names.map((name) => {
        const text = data[name] ?? ''
        if (!text) return <Disclosure key={name} title={name} mono empty emptyText="нет" />
        return (
          <Disclosure
            key={name}
            title={name}
            mono
            aside={<span className={s.len}>{`${text.length} симв.`}</span>}
            open={keys.includes(name)}
            onOpenChange={(open) => ctx.setExpanded(toggleKey(keys, name, open))}
          >
            <CodeView code={text} language={codeLanguage(text)} label={name} />
          </Disclosure>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: таблица видов.** Создать `apps/pi/src/entities/doc-trail/ui/views.ts`:

```ts
import { createElement } from 'react'
import { remoteTab, type RemoteTabView } from '../../../shared/lib/detail'
import type {
  AuditSections, Compliance, DocNotification, DocTask, LinkedDoc, MpuMessage, SourceTexts, StatusEvent, StreamEvent, TrailTabId,
} from '../model/types'
import { AuditTab } from './AuditTab'
import { ComplianceTab } from './ComplianceTab'
import { LinkedTab } from './LinkedTab'
import { MpuTab } from './MpuTab'
import { NotificationsTab } from './NotificationsTab'
import { SourceTab } from './SourceTab'
import { StatusesTab } from './StatusesTab'
import { StreamTab } from './StreamTab'
import { TasksTab } from './TasksTab'

/**
 * Виды удалённых вкладок — те же ключи, что TRAIL_PARSERS (контрактный тест tabs2): данные вида пришли через парсер
 * той же вкладки (инвариант remoteTab, Task 6). source и ed244 — один вид.
 */
export const TRAIL_VIEWS: Record<TrailTabId, RemoteTabView> = {
  statuses: remoteTab<StatusEvent[]>({ render: (data, ctx) => createElement(StatusesTab, { data, ctx }) }),
  compliance: remoteTab<Compliance | null>({ render: (data, ctx) => createElement(ComplianceTab, { data, ctx }) }),
  linked: remoteTab<LinkedDoc[]>({ render: (data, ctx) => createElement(LinkedTab, { data, ctx }) }),
  tasks: remoteTab<DocTask[]>({ render: (data, ctx) => createElement(TasksTab, { data, ctx }), skeletonRows: 5 }),
  notif: remoteTab<DocNotification[]>({ render: (data, ctx) => createElement(NotificationsTab, { data, ctx }) }),
  source: remoteTab<SourceTexts>({ render: (data, ctx) => createElement(SourceTab, { data, ctx }) }),
  ed244: remoteTab<SourceTexts>({ render: (data, ctx) => createElement(SourceTab, { data, ctx }) }),
  stream: remoteTab<StreamEvent[]>({ render: (data, ctx) => createElement(StreamTab, { data, ctx }) }),
  mpu: remoteTab<MpuMessage[]>({ render: (data, ctx) => createElement(MpuTab, { data, ctx }) }),
  audit: remoteTab<AuditSections>({ render: (data, ctx) => createElement(AuditTab, { data, ctx }) }),
}
```

- [ ] **Step 6: публичный API.** В конец `apps/pi/src/entities/doc-trail/index.ts` дописать:

```ts
export { LinkedTab } from './ui/LinkedTab'
export { MpuTab } from './ui/MpuTab'
export { AuditTab } from './ui/AuditTab'
export { SourceTab } from './ui/SourceTab'
export { TRAIL_VIEWS } from './ui/views'
```

- [ ] **Step 7: запуск.**

  Run: `pnpm --filter pi test -- doc-trail`
  Expected: PASS — `tabs2.test.tsx` 19 тестов, `tabs1.test.tsx` 27, тесты Task 7.

  Run: `pnpm check`
  Expected: зелёный; `check:target` не находит `.at`/`Object.hasOwn`/`replaceAll` в `apps/pi/dist/assets/*.js`.

  Run: `grep -rn "innerHTML" apps/pi/src/entities/doc-trail`
  Expected: пусто.

- [ ] **Step 8: commit.**

```bash
git add apps/pi/src/entities/doc-trail/index.ts apps/pi/src/entities/doc-trail/ui/trail.module.css apps/pi/src/entities/doc-trail/ui/LinkedTab.tsx apps/pi/src/entities/doc-trail/ui/MpuTab.tsx apps/pi/src/entities/doc-trail/ui/AuditTab.tsx apps/pi/src/entities/doc-trail/ui/SourceTab.tsx apps/pi/src/entities/doc-trail/ui/views.ts apps/pi/src/entities/doc-trail/ui/tabs2.test.tsx
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "apps/pi: doc-trail — вкладки Связанные (ID в соседней панели), MPU, Аудит, Исходный текст/ED244; TRAIL_VIEWS с контрактом по TRAIL_PARSERS"
```

---

### Task 10: `entities/fx-doc` — «Доп. поля» (`ExtraTab`), парсеры вкладок в портах реестров

**Files:**
- Create: `apps/pi/src/entities/fx-doc/{model/extra.ts, ui/ExtraTab.tsx, ui/extra.module.css, ui/ExtraTab.test.tsx}`
- Modify: `apps/pi/src/entities/fx-doc/index.ts`, `apps/pi/src/entities/fx-doc/api/ports.ts`, `apps/pi/src/entities/rub-doc/api/ports.ts`, `apps/pi/src/app/fake/contract.test.ts`

**Проверка детали (выполнена при написании плана, код `main` @ `f08e522`).** Расширять `FxDocDetail`, маппер, пример и фейк **не нужно**: всё, что берёт `XTAB` эталона, уже приходит в детали — docReference Вх = `fields['20']` (эталон `f.20`), docReference Исх = `refOut` (эталон `d.r20out`, поле строки реестра `FxDoc`), связанный reference = `fields['21']`, UETR = `uetr` (`FxDoc`), даты валютирования = `valueDates` (4 шт., маппер проверяет длину), 33B/36/71A/71B/71F/71G/77B = `fields[tag]` (нет ключа — «—»). Фейк (`fx-docs.detail.ts`) уже даёт `valueDates: [vdDt, vdDt, vdDt, vdKt]` — у части документов дата по Кт отличается, выделение видно в dev. `detail.mapper.ts`, `detail.example.ts`, `fx-docs.detail.ts` в этой задаче не меняются.

**Interfaces:**
- Produces (`entities/fx-doc`, `index.ts`):

```ts
type ExtraPart = { label: string; hint: string | null; value: string; kind: 'text' | 'date' | 'amount'; diff: boolean }
type ExtraRow = { key: string; tag: string | null; name: string; parts: ExtraPart[]; len: number | null; copy: boolean }
type ExtraGroup = { title: string; byName: boolean; rows: ExtraRow[] }
fxExtraGroups(d: FxDocDetail): ExtraGroup[]        // XTAB эталона (index.html:650–667), значения уже отформатированы
isCode(v: string): boolean                         // /^[A-Z0-9-]{8,}$/ — моноширинно
ExtraTab(props: { detail: FxDocDetail }): JSX.Element
fxExtraView: LocalTabView<FxDocDetail>
```

- Consumes (`entities/doc-trail/@x/fx-doc.ts`, `@x/rub-doc.ts` — созданы в Task 7): `TRAIL_PARSERS`, `type TrailTabId`; в этой задаче не меняются.
- Produces (порты): `fxDocPorts.tabFx` / `rubDocPorts.tabFx` с `parseTab` — парсеры `doc-trail` ровно по нелокальным вкладкам `FX_TABS` / `RUB_TABS` (валюта без `ed244`, рубль без `source`; вкладка без парсера → `contractError` до запроса, Task 6).
- Consumes: `KeyValueList`, `KeyValueItem` (Task 4), `FieldTag`, `CopyValue`, `formatDate`, `formatAmount` (кит 2a); `LocalTabView` (Task 6); `createGridPorts` с `parseTab`, `TabParser` (Task 6, `shared/api`); `TRAIL_PARSERS`, `TrailTabId` (Task 7).

- [ ] **Step 1: тест (падает).** Создать `apps/pi/src/entities/fx-doc/ui/ExtraTab.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { formatAmount } from '@katran/ui'
import type { TabContext } from '../../../shared/lib/detail'
import { renderK } from '../../../shared/lib/test'
import { FX_DETAIL_EXAMPLE } from '../api/detail.example'
import { parseFxDocDetail } from '../api/detail.mapper'
import { fxExtraGroups, isCode } from '../model/extra'
import { ExtraTab, fxExtraView } from './ExtraTab'

const d = parseFxDocDetail(FX_DETAIL_EXAMPLE, 'ответ')
const shifted = parseFxDocDetail({ ...FX_DETAIL_EXAMPLE, valueDates: ['2026-09-23', '2026-09-23', '2026-09-23', '2026-09-24'] }, 'ответ')

describe('fxExtraGroups (XTAB эталона)', () => {
  it('три группы и строки в порядке эталона', () => {
    const g = fxExtraGroups(d)
    expect(g.map((x) => x.title)).toEqual(['SWIFT-поля', 'Референсы', 'Даты валютирования'])
    expect(g.map((x) => x.byName)).toEqual([false, true, true])
    expect(g[0]!.rows.map((r) => r.key)).toEqual(['32A', '33B', '36', '71', '77B'])
    expect(g[1]!.rows.map((r) => r.name)).toEqual(['docReference Вх', 'docReference Исх', 'Связанный reference', 'UETR'])
    expect(g[1]!.rows.map((r) => r.len)).toEqual([16, 16, 16, 36])
    expect(g[2]!.rows.map((r) => r.name)).toEqual(['Вх', 'Исх', 'по Дт', 'по Кт'])
  })
  it('значения: 32A из даты, валюты и суммы детали; 33B по частям строки; 71 — четыре подполя', () => {
    const [swift] = fxExtraGroups(d)
    const row = (k: string) => swift!.rows.find((r) => r.key === k)!
    expect(row('32A').parts.map((p) => [p.label, p.value])).toEqual([['Дата', '23.09.2026'], ['Валюта', 'USD'], ['Сумма', formatAmount(1500.5)]])
    expect(row('33B').parts.map((p) => p.value)).toEqual(['EUR', '1148300,00'])
    expect(row('36').parts[0]!.value).toBe('1,0886')
    expect(row('71').parts.map((p) => [p.label, p.value])).toEqual([['71A', 'OUR'], ['71B', ''], ['71F', 'USD 35,00'], ['71G', '']])
    expect(row('71').parts[0]!.hint).toBe('71A · Детали расходов')
    expect(row('77B').parts[0]!.value).toBe('')
  })
  it('референсы: Вх — поле 20, Исх — refOut, связанный — 21, UETR копируется', () => {
    const refs = fxExtraGroups({ ...d, refOut: 'VK2609220000417' })[1]!.rows
    expect(refs.map((r) => r.parts[0]!.value)).toEqual(['FX2609220000417', 'VK2609220000417', 'NONREF', 'eb6305c9-1f8c-41e3-a3b2-6d7e9f2a4c10'])
    expect(refs.map((r) => r.copy)).toEqual([false, false, false, true])
  })
  it('даты: отличные от «Вх» помечены; совпадающие — нет', () => {
    expect(fxExtraGroups(d)[2]!.rows.some((r) => r.parts[0]!.diff)).toBe(false)
    expect(fxExtraGroups(shifted)[2]!.rows.map((r) => r.parts[0]!.diff)).toEqual([false, false, false, true])
  })
  it('isCode: коды от 8 знаков из A–Z, 0–9 и «-»', () => {
    expect(isCode('FX2609220000417')).toBe(true)
    expect(isCode('OUR')).toBe(false)
    expect(isCode('1148300,00')).toBe(false)
    expect(isCode('eb6305c9-1f8c')).toBe(false)
  })
})

describe('ExtraTab', () => {
  it('SWIFT-поля: номер поля с названием в подсказке, подписи частей, пустое — «не заполнено»', () => {
    renderK(<ExtraTab detail={d} />)
    expect(screen.getByText('SWIFT-поля')).toBeInTheDocument()
    expect(screen.getByText('32A')).toBeInTheDocument()
    expect(screen.getByText('1148300,00')).toBeInTheDocument()
    expect(screen.getByText('71A')).toHaveAttribute('data-k-tip', '71A · Детали расходов')
    expect(screen.getByText('OUR')).toBeInTheDocument()
    // 71B, 71G, 77B, docReference Исх (refOut null)
    expect(screen.getAllByText('не заполнено')).toHaveLength(4)
  })
  it('референсы: коды моноширинно, длина поля справа, UETR — копирование', () => {
    renderK(<ExtraTab detail={d} />)
    expect(screen.getByText('FX2609220000417')).toHaveClass('mono')
    expect(screen.getByText('NONREF')).not.toHaveClass('mono')
    expect(screen.getAllByText('16 симв.')).toHaveLength(3)
    expect(screen.getByText('36 симв.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'eb6305c9-1f8c-41e3-a3b2-6d7e9f2a4c10' })).toBeInTheDocument()
  })
  it('даты валютирования: отличная от «Вх» — выделена и озвучена', () => {
    const { unmount } = renderK(<ExtraTab detail={d} />)
    expect(document.querySelector('.diff')).toBeNull()
    unmount()
    renderK(<ExtraTab detail={shifted} />)
    expect(screen.getByText('24.09.2026')).toHaveClass('diff')
    expect(screen.getByText('— отличается от даты «Вх»')).toBeInTheDocument()
  })
  it('fxExtraView — локальный вид, рисует ExtraTab', () => {
    const ctx: TabContext = { docId: 'u1', openDocument: () => undefined, announce: () => undefined, expanded: null, setExpanded: () => undefined }
    expect(fxExtraView.kind).toBe('local')
    renderK(<>{fxExtraView.render(d, ctx)}</>)
    expect(screen.getByText('Даты валютирования')).toBeInTheDocument()
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<ExtraTab detail={shifted} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

  Run: `pnpm --filter pi test -- ExtraTab`
  Expected: FAIL — `Failed to resolve import "../model/extra"`.

- [ ] **Step 2: модель «Доп. полей».** Создать `apps/pi/src/entities/fx-doc/model/extra.ts`:

```ts
import { formatAmount, formatDate } from '@katran/ui'
import type { FxDocDetail } from './detail'
import { FX_FIELDS } from './swift'

/** Часть значения строки: подпись (71A — с названием поля в подсказке), готовый текст, вид; diff — дата отличается от «Вх». */
export type ExtraPart = { label: string; hint: string | null; value: string; kind: 'text' | 'date' | 'amount'; diff: boolean }
/** Строка группы: номер поля (или null), название, части, длина поля по SWIFT (эталон len) и копирование (UETR). */
export type ExtraRow = { key: string; tag: string | null; name: string; parts: ExtraPart[]; len: number | null; copy: boolean }
/** Группа: byName — слева название (эталон cols:'name'), иначе номер поля (cols:'tag'). */
export type ExtraGroup = { title: string; byName: boolean; rows: ExtraRow[] }

/** Моноширинно — коды и референсы (эталон xtabHtml: /^[A-Z0-9-]{8,}$/, кроме дат). */
export const isCode = (v: string): boolean => /^[A-Z0-9-]{8,}$/.test(v)

const fieldName = (tag: string) => FX_FIELDS[tag]?.label ?? ''
/** Значение поля (эталон resolve 'f.<tag>'): строки через пробел. */
const fieldText = (d: FxDocDetail, tag: string) => (d.fields[tag]?.lines ?? []).join(' ').trim()
/** n-я часть значения по пробелам (эталон 'f.<tag>.<n>'): «EUR 1148300,00» → EUR / 1148300,00. */
const fieldPart = (d: FxDocDetail, tag: string, n: number) => fieldText(d, tag).split(/\s+/)[n] ?? ''

function text(label: string, value: string): ExtraPart {
  const f = FX_FIELDS[label]
  return { label, hint: f ? `${label} · ${f.label}` : null, value, kind: 'text', diff: false }
}

const row = (key: string, tag: string | null, name: string, parts: ExtraPart[], len: number | null = null, copy = false): ExtraRow =>
  ({ key, tag, name, parts, len, copy })

/** Вкладка «Доп. поля» — XTAB эталона (index.html:650–667); данные — только из детали (TAB_LOCAL). */
export function fxExtraGroups(d: FxDocDetail): ExtraGroup[] {
  const vd = d.valueDates
  const date = (i: 0 | 1 | 2 | 3, label = ''): ExtraPart =>
    ({ label, hint: null, value: formatDate(vd[i]), kind: 'date', diff: vd[i] !== vd[0] })
  return [
    {
      title: 'SWIFT-поля', byName: false,
      rows: [
        row('32A', '32A', fieldName('32A'), [date(0, 'Дата'), text('Валюта', d.currency), { ...text('Сумма', formatAmount(d.amount)), kind: 'amount' }]),
        row('33B', '33B', fieldName('33B'), [text('Валюта', fieldPart(d, '33B', 0)), text('Сумма', fieldPart(d, '33B', 1))]),
        row('36', '36', fieldName('36'), [text('Курс', fieldText(d, '36'))]),
        row('71', '71', 'Комиссии', ['71A', '71B', '71F', '71G'].map((t) => text(t, fieldText(d, t)))),
        row('77B', '77B', fieldName('77B'), [text('', fieldText(d, '77B'))]),
      ],
    },
    {
      title: 'Референсы', byName: true,
      rows: [
        row('refIn', '20', 'docReference Вх', [text('', fieldText(d, '20'))], 16),
        row('refOut', '20', 'docReference Исх', [text('', d.refOut ?? '')], 16),
        row('related', '21', 'Связанный reference', [text('', fieldText(d, '21'))], 16),
        row('uetr', '121', 'UETR', [text('', d.uetr)], 36, true),
      ],
    },
    {
      title: 'Даты валютирования', byName: true,
      rows: [row('vdIn', null, 'Вх', [date(0)]), row('vdOut', null, 'Исх', [date(1)]), row('vdDt', null, 'по Дт', [date(2)]), row('vdKt', null, 'по Кт', [date(3)])],
    },
  ]
}
```

- [ ] **Step 3: вид.** Создать `apps/pi/src/entities/fx-doc/ui/extra.module.css`:

```css
/* «Доп. поля» валюты (эталон .xr .kv/.lbl/.diffd, index.html:283–295): части значения в строке */
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--k-sp-2);
}

.kv {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 var(--k-sp-3);
  min-width: 0;
}

.part {
  white-space: nowrap;
}

.lbl {
  margin-right: var(--k-sp-1);
  font-size: var(--k-fs-2);
  color: var(--k-muted);
}

.v {
  color: var(--k-val);
}

.mono {
  font: var(--k-fs-2) / var(--k-lh-2) var(--k-mono);
}

.diff {
  font-weight: 600;
  color: var(--k-warn);
}

.nil {
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
```

  Создать `apps/pi/src/entities/fx-doc/ui/ExtraTab.tsx`:

```tsx
import type { ReactNode } from 'react'
import { CopyValue, FieldTag, KeyValueList, type KeyValueItem } from '@katran/ui'
import type { LocalTabView } from '../../../shared/lib/detail'
import type { FxDocDetail } from '../model/detail'
import { fxExtraGroups, isCode, type ExtraPart, type ExtraRow } from '../model/extra'
import s from './extra.module.css'

function Part({ p }: { p: ExtraPart }) {
  const cls = [s.v, p.kind === 'text' && isCode(p.value) ? s.mono : '', p.diff ? s.diff : ''].filter(Boolean).join(' ')
  return (
    <span className={s.part}>
      {p.label && <span className={s.lbl} data-k-tip={p.hint ?? undefined}>{p.label}</span>}
      {p.value
        ? <span className={cls}>{p.value}{p.diff && <span className={s.sr}>— отличается от даты «Вх»</span>}</span>
        : <span className={s.nil}><span aria-hidden="true">—</span><span className={s.sr}>не заполнено</span></span>}
    </span>
  )
}

/** Значение строки: одна часть без подписи — сама (пусто → «—» от KeyValueList, UETR — копированием), иначе части в строку. */
function valueOf(r: ExtraRow): ReactNode {
  const only = r.parts.length === 1 && !r.parts[0]!.label ? r.parts[0]! : null
  if (only && !only.value) return null
  if (only && r.copy) return <CopyValue value={only.value} tone="mono" />
  return <span className={s.kv}>{r.parts.map((p, i) => <Part key={i} p={p} />)}</span>
}

const itemOf = (r: ExtraRow, byName: boolean): KeyValueItem => ({
  key: r.key,
  label: byName || !r.tag ? r.name : <FieldTag tag={r.tag} />,
  // номер поля — подпись, название — подсказкой (FieldTag кита: операторы знают номера)
  hint: byName ? undefined : r.name,
  value: valueOf(r),
  aside: r.len ? `${r.len} симв.` : undefined,
})

/** Вкладка «Доп. поля» валюты (эталон xtabHtml, index.html:1072): SWIFT-поля, референсы, даты валютирования. */
export function ExtraTab({ detail }: { detail: FxDocDetail }) {
  return (
    <div className={s.stack}>
      {fxExtraGroups(detail).map((g) => (
        <KeyValueList key={g.title} title={g.title} labelWidth={g.byName ? 150 : 40} items={g.rows.map((r) => itemOf(r, g.byName))} />
      ))}
    </div>
  )
}

/** Локальная вкладка: данные — в детали (эталон TAB_LOCAL.extra). */
export const fxExtraView: LocalTabView<FxDocDetail> = { kind: 'local', render: (d) => <ExtraTab detail={d} /> }
```

  В `apps/pi/src/entities/fx-doc/index.ts` дописать:

```ts
export { fxExtraGroups, isCode, type ExtraGroup, type ExtraPart, type ExtraRow } from './model/extra'
export { ExtraTab, fxExtraView } from './ui/ExtraTab'
```

  Run: `pnpm --filter pi test -- ExtraTab`
  Expected: PASS — 10 тестов.

- [ ] **Step 4: парсеры вкладок в портах реестров.** Соседние парсеры берутся только через `doc-trail/@x/fx-doc.ts` и `doc-trail/@x/rub-doc.ts` (созданы в Task 7: `TRAIL_PARSERS`, `TrailTabId`).

  Заменить содержимое `apps/pi/src/entities/fx-doc/api/ports.ts`:

```ts
import { createGridPorts, type TabParser } from '../../../shared/api'
import { TRAIL_PARSERS } from '../../doc-trail/@x/fx-doc'
import { FX_TABS } from '../model/swift'
import { parseFxDocDetail } from './detail.mapper'
import { parseFxDoc } from './fxDoc.mapper'

/** Парсеры нелокальных вкладок валюты: ключи FX_TABS, у которых есть парсер doc-trail (main и extra — в детали, ed244 — не валюта). */
const parseTab: Record<string, TabParser> = {}
for (const { id } of FX_TABS) {
  const p = (TRAIL_PARSERS as Record<string, TabParser | undefined>)[id]
  if (p) parseTab[id] = p
}

export const fxDocPorts = createGridPorts({ gridId: 'fx-docs', parseRow: parseFxDoc, parseDetail: parseFxDocDetail, parseTab })
```

  Заменить содержимое `apps/pi/src/entities/rub-doc/api/ports.ts`:

```ts
import { createGridPorts, type TabParser } from '../../../shared/api'
import { TRAIL_PARSERS } from '../../doc-trail/@x/rub-doc'
import { RUB_TABS } from '../model/profiles'
import { parseRubDocDetail } from './detail.mapper'
import { parseRubDoc } from './rubDoc.mapper'

/** Парсеры нелокальных вкладок рубля: ключи RUB_TABS, у которых есть парсер doc-trail (main — в детали, source — не рубль). */
const parseTab: Record<string, TabParser> = {}
for (const { id } of RUB_TABS) {
  const p = (TRAIL_PARSERS as Record<string, TabParser | undefined>)[id]
  if (p) parseTab[id] = p
}

export const rubDocPorts = createGridPorts({ gridId: 'rub-docs', parseRow: parseRubDoc, parseDetail: parseRubDocDetail, parseTab })
```

- [ ] **Step 5: контрактная цепочка вкладок.** В `apps/pi/src/app/fake/contract.test.ts` импорты сущностей заменить на

```ts
import { FX_TABS, FX_TYPES, fxDocPorts } from '../../entities/fx-doc'
import { RUB_TABS, RUB_TYPES, rubDocPorts } from '../../entities/rub-doc'
```

  и в конец файла добавить:

```ts
describe('контракт вкладок (спека 2b §3.1): порт реестра → requestFx → фейк → парсер doc-trail', () => {
  const remote = (tabs: { id: string }[]) => tabs.map((t) => t.id).filter((id) => id !== 'main' && id !== 'extra')
  it('fx-docs: каждая нелокальная вкладка первого документа разбирается; ed244 — не вкладка валюты', async () => {
    const sc = scope()
    const page = await allSettled(fxDocPorts.searchFx, { scope: sc, params: { filter: [], sort: [], page: 0, size: 1 } })
    if (page.status !== 'done') throw new Error('search не прошёл')
    const id = page.value.rows[0]!.id
    for (const tab of remote(FX_TABS)) {
      const r = await allSettled(fxDocPorts.tabFx, { scope: sc, params: { id, tab } })
      expect(r.status, tab).toBe('done')
    }
    const alien = await allSettled(fxDocPorts.tabFx, { scope: sc, params: { id, tab: 'ed244' } })
    expect(alien.status).toBe('fail')
  })
  it('rub-docs: каждая нелокальная вкладка первого документа разбирается; source — не вкладка рубля', async () => {
    const sc = scope()
    const page = await allSettled(rubDocPorts.searchFx, { scope: sc, params: { filter: [], sort: [], page: 0, size: 1 } })
    if (page.status !== 'done') throw new Error('search не прошёл')
    const id = page.value.rows[0]!.id
    for (const tab of remote(RUB_TABS)) {
      const r = await allSettled(rubDocPorts.tabFx, { scope: sc, params: { id, tab } })
      expect(r.status, tab).toBe('done')
    }
    const alien = await allSettled(rubDocPorts.tabFx, { scope: sc, params: { id, tab: 'source' } })
    expect(alien.status).toBe('fail')
  })
})
```

- [ ] **Step 6: запуск.**

  Run: `pnpm --filter pi test -- ExtraTab contract fx-doc rub-doc`
  Expected: PASS — `ExtraTab.test.tsx` 10, новый блок `contract.test.ts` 2, прежние тесты `fx-doc` / `rub-doc` / `contract` без изменений.

  Run: `pnpm check`
  Expected: зелёный (eslint: `fx-doc` и `rub-doc` берут `doc-trail` только через `@x/fx-doc.ts` / `@x/rub-doc.ts`; stylelint: `extra.module.css` — только токены).

- [ ] **Step 7: commit.**

```bash
git add apps/pi/src/entities/fx-doc/model/extra.ts apps/pi/src/entities/fx-doc/ui/ExtraTab.tsx apps/pi/src/entities/fx-doc/ui/extra.module.css apps/pi/src/entities/fx-doc/ui/ExtraTab.test.tsx apps/pi/src/entities/fx-doc/index.ts apps/pi/src/entities/fx-doc/api/ports.ts apps/pi/src/entities/rub-doc/api/ports.ts apps/pi/src/app/fake/contract.test.ts
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "apps/pi: «Доп. поля» валюты по XTAB эталона; парсеры вкладок doc-trail в портах обоих реестров"
```

---

### Task 11: `widgets/doc-detail` — ленивые вкладки, раскрытие по документу, `tabViews`

**Files:**
- Modify: `apps/pi/src/widgets/doc-detail/lib/createDetail.ts` (целиком), `apps/pi/src/widgets/doc-detail/lib/createDetail.test.ts` (импорт + новый блок в конец), `apps/pi/src/widgets/doc-detail/ui/DocDetail.tsx` (целиком), `apps/pi/src/widgets/doc-detail/ui/DocDetail.test.tsx` (целиком), `apps/pi/src/widgets/doc-detail/index.ts`
- `ui/DocDetail.module.css` не меняется: скелетон вкладки берёт классы `.skeleton` и `.sr`, заглушка — `.stub`.

**Interfaces:**
- Produces (`widgets/doc-detail`, дополнение к публичному API 2a — ровно по сквозному контракту):

```ts
type DetailConfig<D> = { detailFx; lifecycle; firstTab?; tabFx?: Effect<TabQuery, unknown, ApiError> | undefined; localTabs?: string[] | undefined /* по умолчанию ['main'] */ }
type TabSlot = { state: DetailSlotState; data: unknown; error: string | null }
type DetailSlot<D> = { slot; id; tab; state; data; error; tabView: TabSlot | null }   // null — активная вкладка локальная или tabFx нет
type Detail<D> = { …2a…; retryTab: EventCallable<DrawerSlot>; $expanded: Store<Record<string, string[]>> /* `${id}:${tab}` */; setExpanded: EventCallable<{ id: string; tab: string; keys: string[] }> }
```

  Разметка для e2e: скелетон вкладки — `[data-part="tab-skeleton"]` с `data-rows="N"` (число строк); ошибка вкладки — `role="alert"` внутри активной `tabpanel` с заголовком «Не удалось загрузить вкладку»; заглушка вкладки без вида — «Вкладка «…» не подключена».
- Consumes: `TabQuery` (`shared/api`, Task 6); `TabContext` (в том числе `docId` — `DocDetail` передаёт `view.id`), `TabView`, `LocalTabView`, `RemoteTabView`, `remoteTab`, `DetailDomain.tabViews` (`shared/lib/detail`, Task 6); `ConfigFormProps.expanded` / `onExpandedChange` (Task 4); `useLoadingGate`, `Skeleton`, `ErrorState`, `useKatran` (кит, уже есть); `DrawerOpen`, `DrawerEntry`, `stack.$a`/`$b` (`@katran/effector`, 2a).

**Решения задачи (обоснование — в комментариях кода и здесь):**
1. **Вкладка не ждёт детали.** Запрос вкладки уходит сразу, как нелокальная вкладка стала активной, независимо от состояния детали: эндпоинт вкладки самостоятелен (§3.1 — `GET …/tabs/{tab}` не требует ничего из детали), ожидание детали только удлинило бы путь до содержимого. Единственное, что вкладке нужно от детали, — `tabsOff`; вкладку, выбранную до загрузки и оказавшуюся без данных, закрывает M-f (п. 5), лишний запрос в этом случае безвреден (фейк и бек отдают пустые данные, 200).
2. **Когда грузить.** Триггер — обновления `stack.$a` и `stack.$b`: производный стор слота меняется, только когда меняется его запись (`setTab`, открытие, сдвиг B в A — запись B переезжает в A вместе с вкладкой). Открытие документа всегда ставит `firstTab` (`'main'`, локальная) — запроса при открытии нет; «открытие с запомненной вкладкой» в стеке 2a — это сдвиг B в A, и его закрывает кэш. Кэш — по `${id}:${tab}` до `pageClosed`; повтор поверх висящего запроса не уходит (карта загрузок).
3. **Ошибка.** Вкладка с ошибкой держит её до `retryTab(slot)`; повторный выбор такой вкладки — новый запрос (как повторное открытие детали после ошибки в 2a). `retryTab` готовой, уже грузящейся, локальной вкладки и пустого слота — без запроса.
4. **Гонки.** Счётчик визитов — тот же `$visit`, что у детали (номер входа на экран): ответ, пришедший после ухода или от прошлого визита, не пишет ни в кэш, ни в ошибки, ни в карту загрузок. Внутри визита дубли исключает карта загрузок, а ответ «чужой» вкладки при быстром переключении — не чужой: он ложится в кэш своего ключа, слот показывает только свою активную вкладку. Отдельный счётчик на ключ не нужен.
5. **M-f — в `DocDetail`, не в модели.** `tabsOff` — доменное знание (`domain.summary(d).tabsOff`); модель деталки домена не получает, и заводить ей `tabsOff: (d) => string[]` в `DetailConfig` значило бы дублировать `DetailDomain` и менять контракт. `DetailPane` уже вычисляет `off` для полосы вкладок: эффект после загрузки детали переводит слот на первую вкладку домена (`'main'`), если активная попала в `tabsOff`.
6. **M-g.** `ConfigForm` «Общих» получает `expanded = $expanded[`${id}:main`]` и `onExpandedChange` → `setExpanded`. До первого изменения ключа нет → `expanded={undefined}` — форма берёт свои умолчания (семантика Task 4: без `expanded` — внутреннее состояние, `onExpandedChange` отдаёт полный список раскрытых). То же правило у `TabContext.expanded`: `null` — вид берёт свои умолчания.
7. **Заглушка** для вкладки без вида — нейтральная «Вкладка «…» не подключена»: для `fx`/`rub` недостижима (Task 12 проверяет полноту `tabViews`), но виджет общий.

- [ ] **Step 1: модель — тесты (падают).** В `apps/pi/src/widgets/doc-detail/lib/createDetail.test.ts` заменить строку импорта

```ts
import { ApiError } from '../../../shared/api'
```

  на

```ts
import { ApiError, type TabQuery } from '../../../shared/api'
```

  и дописать в конец файла:

```ts
/** Деталь отвечает сразу (или висит), вкладки — ручным ответом на каждый вызов: гонки вкладок в явном порядке (спека 2b §3.3). */
function setupTabs(opts: { localTabs?: string[]; holdDetail?: boolean } = {}) {
  const tabCalls: { id: string; tab: string; ok: (data?: unknown) => void; fail: (message?: string) => void }[] = []
  const detailFx = createEffect<string, Doc, ApiError>((id) => (opts.holdDetail ? new Promise<Doc>(() => {}) : Promise.resolve({ id, n: 0 })))
  const tabFx = createEffect<TabQuery, unknown, ApiError>((q) => new Promise<unknown>((res, rej) => {
    tabCalls.push({
      id: q.id,
      tab: q.tab,
      ok: (data: unknown = { rows: [] }) => res(data),
      fail: (message = 'Сбой сервера: вкладка') => rej(new ApiError(500, null, message)),
    })
  }))
  const lifecycle = createPageLifecycle()
  const d = createDetail({ detailFx, tabFx, lifecycle, ...(opts.localTabs ? { localTabs: opts.localTabs } : {}) })
  const scope = fork()
  // allSettled ждёт все эффекты скоупа — с висящими запросами не дожидаемся: события применяются синхронно
  const open = (id: string, secondary = false) => { void allSettled(d.open, { scope, params: { id, secondary } }) }
  const tab = (slot: 'a' | 'b', t: string) => { void allSettled(d.setTab, { scope, params: { slot, tab: t } }) }
  const a = () => scope.getState(d.$slots).a
  const calls = () => tabCalls.map((c) => `${c.id}:${c.tab}`)
  const tick = () => new Promise<void>((r) => setTimeout(r, 0))
  return { d, lifecycle, scope, tabCalls, calls, open, tab, a, tick }
}

describe('createDetail: ленивые вкладки (спека 2b §3.3)', () => {
  it('локальная вкладка не запрашивается; нелокальная — при активации: loading → ready', async () => {
    const { scope, lifecycle, tabCalls, calls, open, tab, a, tick } = setupTabs()
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    await tick()
    expect(a()).toMatchObject({ tab: 'main', state: 'ready', tabView: null })
    expect(calls()).toEqual([])
    tab('a', 'statuses')
    expect(calls()).toEqual(['d1:statuses'])
    expect(a()).toMatchObject({ tab: 'statuses', state: 'ready', tabView: { state: 'loading', data: null, error: null } })
    tabCalls[0]!.ok({ rows: ['s1'] })
    await tick()
    expect(a()?.tabView).toEqual({ state: 'ready', data: { rows: ['s1'] }, error: null })
  })

  it('localTabs: перечисленные вкладки — из детали, без запроса; по умолчанию локальна только main', async () => {
    const own = setupTabs({ localTabs: ['main', 'extra'] })
    await allSettled(own.lifecycle.pageOpened, { scope: own.scope })
    own.open('d1')
    own.tab('a', 'extra')
    expect(own.calls()).toEqual([])
    expect(own.a()).toMatchObject({ tab: 'extra', tabView: null })
    const def = setupTabs()
    await allSettled(def.lifecycle.pageOpened, { scope: def.scope })
    def.open('d1')
    def.tab('a', 'extra')
    expect(def.calls()).toEqual(['d1:extra'])
  })

  it('без tabFx вкладки не грузятся: tabView — null', async () => {
    const { d, scope, lifecycle, open } = setup()
    await allSettled(lifecycle.pageOpened, { scope })
    await open('d1')
    await allSettled(d.setTab, { scope, params: { slot: 'a', tab: 'statuses' } })
    expect(scope.getState(d.$slots).a).toMatchObject({ tab: 'statuses', state: 'ready', tabView: null })
  })

  it('кэш id:tab — возврат на вкладку, B, сдвиг B в A и повторное открытие не перезапрашивают', async () => {
    const { d, scope, lifecycle, tabCalls, calls, open, tab, a, tick } = setupTabs()
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    tabCalls[0]!.ok()
    tab('a', 'audit')
    tabCalls[1]!.ok()
    await tick()
    tab('a', 'statuses')
    expect(a()?.tabView?.state).toBe('ready')
    open('d2', true)
    tab('b', 'statuses')
    tabCalls[2]!.ok()
    await tick()
    expect(calls()).toEqual(['d1:statuses', 'd1:audit', 'd2:statuses'])
    // закрытие A сдвигает B (d2 на «Статусах») в A — из кэша
    void allSettled(d.close, { scope, params: 'a' })
    expect(a()).toMatchObject({ id: 'd2', tab: 'statuses', tabView: { state: 'ready' } })
    // d1 снова открыт — на «Общих»; его «Аудит» — из кэша
    open('d1')
    tab('a', 'audit')
    expect(a()).toMatchObject({ id: 'd1', tab: 'audit', tabView: { state: 'ready' } })
    expect(calls()).toHaveLength(3)
  })

  it('гонка: быстрое переключение — слот показывает активную вкладку; ответ другой вкладки ложится в её кэш', async () => {
    const { scope, lifecycle, tabCalls, calls, open, tab, a, tick } = setupTabs()
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    tab('a', 'audit')
    tab('a', 'statuses')
    // «Статусы» уже грузятся — второй запрос поверх висящего не уходит
    expect(calls()).toEqual(['d1:statuses', 'd1:audit'])
    tabCalls[1]!.ok({ rows: ['audit'] })
    await tick()
    expect(a()).toMatchObject({ tab: 'statuses', tabView: { state: 'loading', data: null } })
    tabCalls[0]!.ok({ rows: ['statuses'] })
    await tick()
    expect(a()).toMatchObject({ tab: 'statuses', tabView: { state: 'ready', data: { rows: ['statuses'] } } })
    tab('a', 'audit')
    expect(a()).toMatchObject({ tab: 'audit', tabView: { state: 'ready', data: { rows: ['audit'] } } })
    expect(calls()).toHaveLength(2)
  })

  it('счётчик визитов: отказ, висевший при уходе с экрана, новый визит не трогает; его finally не снимает новую загрузку', async () => {
    const { d, scope, lifecycle, tabCalls, calls, open, tab, a, tick } = setupTabs()
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    void allSettled(lifecycle.pageClosed, { scope })
    void allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    expect(calls()).toEqual(['d1:statuses', 'd1:statuses'])
    tabCalls[0]!.fail()
    await tick()
    expect(a()?.tabView).toEqual({ state: 'loading', data: null, error: null })
    void allSettled(d.retryTab, { scope, params: 'a' })
    expect(calls()).toHaveLength(2)
    tabCalls[1]!.ok({ rows: ['new'] })
    await tick()
    expect(a()?.tabView).toEqual({ state: 'ready', data: { rows: ['new'] }, error: null })
  })

  it('счётчик визитов: успешный ответ прошлого визита в кэш нового не кладётся', async () => {
    const { scope, lifecycle, tabCalls, open, tab, a, tick } = setupTabs()
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    void allSettled(lifecycle.pageClosed, { scope })
    void allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    tabCalls[0]!.ok({ rows: ['old'] })
    await tick()
    expect(a()?.tabView).toEqual({ state: 'loading', data: null, error: null })
    tabCalls[1]!.ok({ rows: ['new'] })
    await tick()
    expect(a()?.tabView).toEqual({ state: 'ready', data: { rows: ['new'] }, error: null })
  })

  it('ошибка вкладки — своё состояние с текстом, деталь не тронута; retryTab — новый запрос', async () => {
    const { d, scope, lifecycle, tabCalls, calls, open, tab, a, tick } = setupTabs()
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    await tick()
    tab('a', 'audit')
    tabCalls[0]!.fail('Сбой сервера: Регулятор ?fail=tab:audit')
    await tick()
    expect(a()).toMatchObject({
      state: 'ready', data: { id: 'd1' }, error: null,
      tabView: { state: 'error', data: null, error: 'Сбой сервера: Регулятор ?fail=tab:audit' },
    })
    void allSettled(d.retryTab, { scope, params: 'a' })
    expect(a()?.tabView).toEqual({ state: 'loading', data: null, error: null })
    tabCalls[1]!.ok({ rows: [] })
    await tick()
    expect(a()?.tabView).toEqual({ state: 'ready', data: { rows: [] }, error: null })
    // готовая вкладка, пустой слот и локальная вкладка — без запроса
    void allSettled(d.retryTab, { scope, params: 'a' })
    void allSettled(d.retryTab, { scope, params: 'b' })
    tab('a', 'main')
    void allSettled(d.retryTab, { scope, params: 'a' })
    expect(calls()).toEqual(['d1:audit', 'd1:audit'])
  })

  it('возврат на вкладку с ошибкой — новый запрос (как повторное открытие детали после ошибки)', async () => {
    const { scope, lifecycle, tabCalls, calls, open, tab, a, tick } = setupTabs()
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    tabCalls[0]!.fail()
    await tick()
    expect(a()?.tabView?.state).toBe('error')
    tab('a', 'main')
    tab('a', 'statuses')
    expect(calls()).toEqual(['d1:statuses', 'd1:statuses'])
    expect(a()?.tabView).toEqual({ state: 'loading', data: null, error: null })
  })

  it('вкладка не ждёт детали: деталь ещё грузится — вкладка запрошена и готова', async () => {
    const { scope, lifecycle, tabCalls, calls, open, tab, a, tick } = setupTabs({ holdDetail: true })
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    expect(calls()).toEqual(['d1:statuses'])
    tabCalls[0]!.ok({ rows: ['s'] })
    await tick()
    expect(a()).toMatchObject({ state: 'loading', data: null, tabView: { state: 'ready', data: { rows: ['s'] } } })
  })

  it('$expanded: ключ id:tab; переживает переключение вкладки и закрытие drawer; pageClosed очищает', async () => {
    const { d, scope, lifecycle, open, tab } = setupTabs()
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    void allSettled(d.setExpanded, { scope, params: { id: 'd1', tab: 'linked', keys: ['L2'] } })
    void allSettled(d.setExpanded, { scope, params: { id: 'd1', tab: 'main', keys: ['50'] } })
    tab('a', 'statuses')
    void allSettled(d.close, { scope, params: 'a' })
    expect(scope.getState(d.$expanded)).toEqual({ 'd1:linked': ['L2'], 'd1:main': ['50'] })
    void allSettled(lifecycle.pageClosed, { scope })
    expect(scope.getState(d.$expanded)).toEqual({})
  })

  it('pageClosed чистит кэш вкладок: при возврате — новый запрос', async () => {
    const { scope, lifecycle, tabCalls, calls, open, tab, tick } = setupTabs()
    await allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    tabCalls[0]!.ok()
    await tick()
    void allSettled(lifecycle.pageClosed, { scope })
    void allSettled(lifecycle.pageOpened, { scope })
    open('d1')
    tab('a', 'statuses')
    expect(calls()).toEqual(['d1:statuses', 'd1:statuses'])
  })
})
```

  Run: `pnpm --filter pi test -- createDetail`
  Expected: FAIL — `tabFx`/`localTabs` не входят в `DetailConfig`, у слота нет `tabView`, нет `retryTab`, `$expanded`, `setExpanded`.

- [ ] **Step 2: модель — реализация.** Заменить `apps/pi/src/widgets/doc-detail/lib/createDetail.ts` целиком:

```ts
import { attach, combine, createEvent, createStore, merge, sample, type Effect, type EventCallable, type Store } from 'effector'
import { createDrawerStackModel, type DrawerEntry, type DrawerOpen, type DrawerSlot, type DrawerStackModel, type DrawerStackState } from '@katran/effector'
import type { ApiError, TabQuery } from '../../../shared/api'
import type { PageLifecycle } from '../../../shared/lib/lifecycle'

export type DetailSlotState = 'loading' | 'ready' | 'error'
/** Нелокальная вкладка слота (спека 2b §3.3): свои загрузка, данные и ошибка — шапку, лейн и другие вкладки не трогают. */
export type TabSlot = { state: DetailSlotState; data: unknown; error: string | null }
export type DetailSlot<D> = {
  slot: DrawerSlot
  id: string
  tab: string
  state: DetailSlotState
  data: D | null
  error: string | null
  /** Активная вкладка, если она грузится своим запросом; null — локальная (данные в детали) или порта вкладок нет. */
  tabView: TabSlot | null
}
export type DetailConfig<D> = {
  detailFx: Effect<string, D, ApiError>
  /** Порт вкладок (спека 2b §3.1, GET …/documents/{id}/tabs/{tab}); нет — нелокальные вкладки не грузятся (tabView null). */
  tabFx?: Effect<TabQuery, unknown, ApiError> | undefined
  /** Вкладки, чьи данные приходят в детали, — без своего запроса; по умолчанию ['main']. */
  localTabs?: string[] | undefined
  lifecycle: PageLifecycle
  /** Вкладка только что открытого документа; по умолчанию 'main'. */
  firstTab?: string | undefined
}
export type Detail<D> = {
  stack: DrawerStackModel
  $slots: Store<{ a: DetailSlot<D> | null; b: DetailSlot<D> | null }>
  /** Метки записей реестра: id → слот (DataGrid marked). */
  $marks: Store<Record<string, DrawerSlot>>
  /**
   * Запросы фокуса по id документа (Drawer focusKey): растут при повторном открытии уже открытого пользователем
   * и у документа, оставшегося после закрытия A при открытом B (он сдвинут в A, R11).
   */
  $focus: Store<Record<string, number>>
  /** Открытые не пользователем (quiet, автооткрытие В-Д4): drawer не забирает фокус при монтировании (R10). Снимается закрытием слота. */
  $quiet: Store<Record<string, true>>
  /** quiet — открытие не пользователем: фокус остаётся, где был. */
  open: EventCallable<DrawerOpen>
  close: EventCallable<DrawerSlot>
  closeTop: EventCallable<void>
  setTab: EventCallable<{ slot: DrawerSlot; tab: string }>
  retry: EventCallable<DrawerSlot>
  /** Повтор загрузки активной нелокальной вкладки слота; готовая, уже грузящаяся, локальная вкладка и пустой слот — без запроса. */
  retryTab: EventCallable<DrawerSlot>
  /**
   * Раскрытое во вкладках по ключу `${id}:${tab}` (строки, аккордеоны, поля «Общих данных»): TabPanel размонтирует
   * неактивную вкладку, а раскрытое переживает переключение и закрытие drawer — до pageClosed (спека 2b §3.3, техдолг M-g).
   */
  $expanded: Store<Record<string, string[]>>
  setExpanded: EventCallable<{ id: string; tab: string; keys: string[] }>
}

const without = <T,>(o: Record<string, T>, k: string): Record<string, T> => {
  const next = { ...o }
  delete next[k]
  return next
}

type Load = { id: string; visit: number }
type TabLoad = TabQuery & { visit: number }
type Visit = { opened: boolean; visit: number }
const tabKey = (id: string, tab: string) => `${id}:${tab}`
/** Ответ своего визита экрана: пришедший после ухода или от прошлого визита не принимается. */
const mine = (cur: Visit, { params }: { params: { visit: number } }) => cur.opened && params.visit === cur.visit

/**
 * Деталка экрана (спека 2a §4.3, 2b §3.3): стек A/B кита, загрузка документа по слоту и кэш по id, ленивая загрузка
 * нелокальной вкладки с кэшем по id:tab, раскрытое во вкладках — всё на время открытого экрана.
 * Модель статична после импорта; ответы портов принимаются только пока экран открыт и только своего визита:
 * запрос, висевший при уходе, после возврата не пишет ни в кэш, ни в ошибки, ни в загрузку нового визита.
 */
export function createDetail<D>(cfg: DetailConfig<D>): Detail<D> {
  const { lifecycle } = cfg
  const stack = createDrawerStackModel({ firstTab: cfg.firstTab ?? 'main' })
  // своя копия эффекта: pending и отказы этой деталки не смешиваются с другими потребителями порта;
  // в параметрах — номер визита экрана, порту уходит только id
  const loadFx = attach({ effect: cfg.detailFx, mapParams: (p: Load) => p.id })
  const retry = createEvent<DrawerSlot>()
  // номер визита: растёт при каждом входе на экран
  const $visit = createStore(0).on(lifecycle.pageOpened, (v) => v + 1)
  const current = { opened: lifecycle.$opened, visit: $visit }

  const $cache = createStore<Record<string, D>>({})
  const $errors = createStore<Record<string, string>>({})
  const $loading = createStore<Record<string, true>>({})
  const $focus = createStore<Record<string, number>>({})
  const $quiet = createStore<Record<string, true>>({})

  sample({
    clock: stack.opened,
    source: { cache: $cache, loading: $loading, visit: $visit },
    filter: ({ cache, loading }, { id }) => !(id in cache) && !(id in loading),
    fn: ({ visit }, { id }): Load => ({ id, visit }),
    target: loadFx,
  })
  sample({
    clock: retry,
    source: { st: stack.$stack, loading: $loading, visit: $visit },
    filter: ({ st, loading }, slot) => { const e = st[slot]; return e !== null && !(e.id in loading) },
    fn: ({ st, visit }, slot): Load => ({ id: st[slot]?.id ?? '', visit }),
    target: loadFx,
  })

  // ответ после ухода с экрана и ответ прошлого визита не принимаются: при возврате деталь запросится заново
  const done = sample({ clock: loadFx.done, source: current, filter: mine, fn: (_, x) => x })
  const failed = sample({ clock: loadFx.fail, source: current, filter: mine, fn: (_, x) => x })
  const settled = sample({ clock: loadFx.finally, source: current, filter: mine, fn: (_, x) => x })
  $loading.on(loadFx, (l, { id }) => ({ ...l, [id]: true })).on(settled, (l, { params }) => without(l, params.id))
  $errors.on(loadFx, (e, { id }) => without(e, id))
  $cache.on(done, (c, { params, result }) => ({ ...c, [params.id]: result }))
  $errors.on(failed, (e, { params, error }) => ({ ...e, [params.id]: error.message }))

  // --- вкладки (спека 2b §3.3) ---
  const localTabs = cfg.localTabs ?? ['main']
  const tabFx = cfg.tabFx
  const remote = (tab: string) => tabFx !== undefined && !localTabs.includes(tab)
  const retryTab = createEvent<DrawerSlot>()
  const setExpanded = createEvent<{ id: string; tab: string; keys: string[] }>()
  const $tabCache = createStore<Record<string, unknown>>({})
  const $tabErrors = createStore<Record<string, string>>({})
  const $tabLoading = createStore<Record<string, true>>({})
  const $expanded = createStore<Record<string, string[]>>({})
  $expanded.on(setExpanded, (m, { id, tab, keys }) => ({ ...m, [tabKey(id, tab)]: keys }))

  if (tabFx) {
    // своя копия порта, как у детали; порту уходит только { id, tab }
    const loadTabFx = attach({ effect: tabFx, mapParams: (p: TabLoad): TabQuery => ({ id: p.id, tab: p.tab }) })
    type Need = { cache: Record<string, unknown>; loading: Record<string, true> }
    // вкладку грузим, если она нелокальная, её нет в кэше и она уже не грузится (ошибка — не препятствие: повторный выбор = повтор)
    const need = ({ cache, loading }: Need, e: DrawerEntry | null): boolean => {
      if (e === null || !remote(e.tab)) return false
      const k = tabKey(e.id, e.tab)
      return !(k in cache) && !(k in loading)
    }
    const load = (e: DrawerEntry | null, visit: number): TabLoad => ({ id: e?.id ?? '', tab: e?.tab ?? '', visit })
    // вкладка стала активной в слоте: setTab, открытие, сдвиг B в A. $a/$b обновляются только при смене своей записи —
    // открытие B и переключение вкладки в B запись A не трогают. Деталь не ждём: эндпоинт вкладки самостоятелен (§3.1)
    sample({
      clock: merge([stack.$a.updates, stack.$b.updates]),
      source: { cache: $tabCache, loading: $tabLoading, visit: $visit },
      filter: need,
      fn: ({ visit }, e) => load(e, visit),
      target: loadTabFx,
    })
    sample({
      clock: retryTab,
      source: { st: stack.$stack, cache: $tabCache, loading: $tabLoading, visit: $visit },
      filter: (src, slot) => need(src, src.st[slot]),
      fn: ({ st, visit }, slot) => load(st[slot], visit),
      target: loadTabFx,
    })
    // счётчик визитов — тот же, что у детали; внутри визита дубли исключает карта загрузок,
    // а ответ другой вкладки при быстром переключении ложится в кэш своего ключа
    const tabDone = sample({ clock: loadTabFx.done, source: current, filter: mine, fn: (_, x) => x })
    const tabFailed = sample({ clock: loadTabFx.fail, source: current, filter: mine, fn: (_, x) => x })
    const tabSettled = sample({ clock: loadTabFx.finally, source: current, filter: mine, fn: (_, x) => x })
    $tabLoading
      .on(loadTabFx, (l, p) => ({ ...l, [tabKey(p.id, p.tab)]: true }))
      .on(tabSettled, (l, { params }) => without(l, tabKey(params.id, params.tab)))
    $tabErrors
      .on(loadTabFx, (e, p) => without(e, tabKey(p.id, p.tab)))
      .on(tabFailed, (e, { params, error }) => ({ ...e, [tabKey(params.id, params.tab)]: error.message }))
    $tabCache.on(tabDone, (c, { params, result }) => ({ ...c, [tabKey(params.id, params.tab)]: result }))
  }

  const bump = (f: Record<string, number>, id: string) => ({ ...f, [id]: (f[id] ?? 0) + 1 })
  // повторное открытие уже открытого пользователем — фокус в его drawer; quiet-открытие фокус не трогает
  $focus.on(sample({ clock: stack.alreadyOpen, filter: (h) => !h.quiet }), (f, { id }) => bump(f, id))
  // R11: закрытие A при открытом B — B сдвигается в A, фокус в его заголовок (а не в грид)
  // сдвиг распознаётся по переходу состояния: прежний B стал A, B пуст (так меняет стек только close('a') при открытом B);
  // прежнее состояние — в своём сторе, source у sample читал бы уже новое
  const $shift = createStore<{ prev: DrawerStackState; id: string | null }>({ prev: { a: null, b: null }, id: null })
    .on(stack.$stack.updates, ({ prev }, st) => ({ prev: st, id: prev.b !== null && st.b === null && st.a?.id === prev.b.id ? prev.b.id : null }))
  const shifted = sample({ clock: $shift.updates, filter: (x) => x.id !== null, fn: (x) => x.id ?? '' })
  $focus.on(shifted, bump)
  $quiet.on(stack.opened, (q, { id, quiet }) => (quiet ? { ...q, [id]: true } : without(q, id)))
  // закрытый слот — метка снимается (повторное открытие того же id пользователем — уже не тихое)
  $quiet.on(stack.$stack.updates, (q, st) => {
    const keep: Record<string, true> = {}
    for (const id of Object.keys(q)) if (st.a?.id === id || st.b?.id === id) keep[id] = true
    return Object.keys(keep).length === Object.keys(q).length ? q : keep
  })

  sample({ clock: lifecycle.pageClosed, target: stack.closeAll })
  $cache.reset(lifecycle.pageClosed)
  $errors.reset(lifecycle.pageClosed)
  $loading.reset(lifecycle.pageClosed)
  $focus.reset(lifecycle.pageClosed)
  $quiet.reset(lifecycle.pageClosed)
  $shift.reset(lifecycle.pageClosed)
  $tabCache.reset(lifecycle.pageClosed)
  $tabErrors.reset(lifecycle.pageClosed)
  $tabLoading.reset(lifecycle.pageClosed)
  $expanded.reset(lifecycle.pageClosed)

  type Maps = { cache: Record<string, D>; errors: Record<string, string>; tabCache: Record<string, unknown>; tabErrors: Record<string, string> }
  const tabViewOf = (e: DrawerEntry, m: Maps): TabSlot | null => {
    if (!remote(e.tab)) return null
    const k = tabKey(e.id, e.tab)
    if (k in m.tabCache) return { state: 'ready', data: m.tabCache[k], error: null }
    const error = m.tabErrors[k] ?? null
    return { state: error !== null ? 'error' : 'loading', data: null, error }
  }
  const view = (slot: DrawerSlot, e: DrawerEntry | null, m: Maps): DetailSlot<D> | null => {
    if (!e) return null
    const has = e.id in m.cache
    const error = m.errors[e.id] ?? null
    return {
      slot, id: e.id, tab: e.tab,
      state: has ? 'ready' : error !== null ? 'error' : 'loading',
      data: has ? (m.cache[e.id] as D) : null,
      error,
      tabView: tabViewOf(e, m),
    }
  }
  const $slots = combine(
    { a: stack.$a, b: stack.$b, cache: $cache, errors: $errors, tabCache: $tabCache, tabErrors: $tabErrors },
    (m) => ({ a: view('a', m.a, m), b: view('b', m.b, m) }),
  )
  const $marks = combine(stack.$a, stack.$b, (a, b) => {
    const m: Record<string, DrawerSlot> = {}
    if (a) m[a.id] = 'a'
    if (b) m[b.id] = 'b'
    return m
  })

  return {
    stack, $slots, $marks, $focus, $quiet,
    open: stack.open, close: stack.close, closeTop: stack.closeTop, setTab: stack.setTab, retry,
    retryTab, $expanded, setExpanded,
  }
}
```

  Заменить `apps/pi/src/widgets/doc-detail/index.ts`:

```ts
export { createDetail, type Detail, type DetailConfig, type DetailSlot, type DetailSlotState, type TabSlot } from './lib/createDetail'
export { DocDetail, type DocDetailProps } from './ui/DocDetail'
```

  Run: `pnpm --filter pi test -- createDetail`
  Expected: PASS — 27 (15 из 2a + 12 новых).

- [ ] **Step 3: компонент — тесты (падают).** Заменить `apps/pi/src/widgets/doc-detail/ui/DocDetail.test.tsx` целиком (тесты 2a сохранены; тест «будет в срезе 2b» заменён — заглушки больше нет):

```tsx
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { createEffect } from 'effector'
import { ApiError, type TabQuery } from '../../../shared/api'
import { remoteTab, type DetailDomain, type DetailSummary, type LocalTabView } from '../../../shared/lib/detail'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { renderK } from '../../../shared/lib/test'
import { createDetail } from '../lib/createDetail'
import { DocDetail } from './DocDetail'

// Синтетический домен: виджет не знает сущностей — всё доменное приходит объектом DetailDomain
type Doc = { id: string; num: string; ref: string }
type Rows = { rows: string[] }
const rows: Doc[] = [{ id: 'd1', num: '417', ref: 'FX2609220000417' }, { id: 'd2', num: '418', ref: 'FX2609220000418' }]
const sum = (d: Doc, tabsOff: string[]): DetailSummary => ({
  label: `Платёжная инструкция № ${d.num}`, uuid: `uuid-${d.id}`, created: '22.09.2026 07:31:45', type: 'MT103',
  status: { tone: 'ok', label: 'Обработан' }, kind: 'Клиентский перевод · входящий', tabsOff,
})
// виды вкладок: локальная «Доп. поля» из детали; нелокальные — список (Статусы, Аудит) и «Связанные» с ctx
const extraView: LocalTabView<Doc> = { kind: 'local', render: (d) => <div>Доп. поля документа {d.ref}</div> }
const listView = (label: string) => remoteTab<Rows>({
  render: (data) => <ul aria-label={label}>{data.rows.map((r) => <li key={r}>{r}</li>)}</ul>,
  skeletonRows: 3,
})
const linkedView = remoteTab<Rows>({
  render: (data, ctx) => {
    const open = (ctx.expanded ?? []).includes('card')
    return (
      <div data-doc={ctx.docId}>
        {data.rows.map((r) => <button key={r} type="button" onClick={() => ctx.openDocument('d2')}>Открыть {r} в соседней панели</button>)}
        <button type="button" aria-expanded={open} onClick={() => ctx.setExpanded(open ? [] : ['card'])}>Раскрыть</button>
        <button type="button" onClick={() => ctx.announce('Действие будет в 2d')}>Переотправить</button>
      </div>
    )
  },
})
const domain: DetailDomain<Doc, Doc> = {
  title: 'Платёжная инструкция',
  tabs: [
    { id: 'main', label: 'Общие данные' }, { id: 'extra', label: 'Доп. поля' }, { id: 'statuses', label: 'Статусы' },
    { id: 'linked', label: 'Связанные документы' }, { id: 'mpu', label: 'MPU' }, { id: 'audit', label: 'Аудит' },
  ],
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
  // у «MPU» вида нет — нейтральная заглушка
  tabViews: { extra: extraView, statuses: listView('Статусы'), linked: linkedView, audit: listView('Аудит') },
}

function setup(
  handler: (id: string) => Promise<Doc> = async (id) => rows.find((r) => r.id === id)!,
  tabHandler: (q: TabQuery) => Promise<unknown> = async (q) => ({ rows: [`${q.tab} ${q.id}`] }),
) {
  const detailFx = createEffect<string, Doc, ApiError>(handler)
  const tabFx = createEffect<TabQuery, unknown, ApiError>(tabHandler)
  const lifecycle = createPageLifecycle()
  const detail = createDetail({ detailFx, tabFx, localTabs: ['main', 'extra'], lifecycle })
  const utils = renderK(
    <>
      <button type="button">Кнопка открытия</button>
      <DocDetail detail={detail} domain={domain} rowOf={(id) => rows.find((r) => r.id === id) ?? null} returnFocus={() => screen.queryByText('Кнопка открытия')} />
    </>,
  )
  act(() => { lifecycle.pageOpened() })
  const open = (id: string, secondary = false, quiet?: boolean) => act(() => { detail.open(quiet ? { id, secondary, quiet } : { id, secondary }) })
  return { ...utils, open }
}
const names = () => screen.queryAllByRole('dialog').map((d) => d.getAttribute('aria-label'))
const tabSkeleton = () => document.querySelector('[data-part="tab-skeleton"]')

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

  it('вкладки: без данных — недоступна; «Доп. поля» — локальный вид из детали без запроса; без вида — нейтральная заглушка', async () => {
    const asked: string[] = []
    const { open } = setup(undefined, async (q) => { asked.push(q.tab); return { rows: [] } })
    open('d1')
    await screen.findByText('Блок b1')
    expect(screen.getByRole('tab', { name: 'Аудит' })).toBeDisabled()
    await userEvent.click(screen.getByRole('tab', { name: 'Доп. поля' }))
    expect(screen.getByRole('tab', { name: 'Доп. поля' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Доп. поля документа FX2609220000417')).toBeInTheDocument()
    expect(asked).toEqual([])
    await userEvent.click(screen.getByRole('tab', { name: 'MPU' }))
    expect(screen.getByText('Вкладка «MPU» не подключена')).toBeInTheDocument()
    expect(screen.queryByText(/будет в срезе 2b/)).toBeNull()
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

  it('R10: открытие не пользователем (quiet) фокус не забирает; открытие пользователем — забирает', async () => {
    const { open } = setup()
    screen.getByText('Кнопка открытия').focus()
    open('d1', false, true)
    await screen.findByText('Блок b1')
    expect(names()).toEqual(['Платёжная инструкция № 417'])
    expect(screen.getByText('Кнопка открытия')).toHaveFocus()
    open('d2')
    expect(names()).toEqual(['Платёжная инструкция № 418'])
    expect(screen.getByRole('heading', { name: 'Платёжная инструкция' })).toHaveFocus()
  })

  it('R11: «Закрыть» у A при открытом B — фокус в заголовок оставшегося drawer (он теперь A)', async () => {
    const { open } = setup()
    open('d1')
    open('d2', true)
    await waitFor(() => expect(screen.getAllByText('Блок b1')).toHaveLength(2))
    const a = screen.getByRole('dialog', { name: 'Платёжная инструкция № 417' })
    await userEvent.click(within(a).getByRole('button', { name: 'Закрыть' }))
    expect(names()).toEqual(['Платёжная инструкция № 418'])
    const left = screen.getByRole('dialog', { name: 'Платёжная инструкция № 418' })
    expect(within(left).getByRole('heading', { name: 'Платёжная инструкция' })).toHaveFocus()
    expect(within(left).getByText('A')).toBeInTheDocument()
  })

  it('без нарушений axe', async () => {
    const { container, open } = setup()
    open('d1')
    await screen.findByText('Блок b1')
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('DocDetail: вкладки 2b (спека 2b §3.3, §4)', () => {
  it('нелокальная вкладка — запрос при выборе; скелетон не короче 400 мс, затем вид вкладки', async () => {
    const asked: string[] = []
    const { open } = setup(undefined, (q) => {
      asked.push(`${q.id}:${q.tab}`)
      return new Promise((r) => setTimeout(() => r({ rows: [`${q.tab} ${q.id}`] }), 250))
    })
    open('d1')
    await screen.findByText('Блок b1')
    expect(asked).toEqual([])
    await userEvent.click(screen.getByRole('tab', { name: 'Статусы' }))
    expect(asked).toEqual(['d1:statuses'])
    await waitFor(() => expect(tabSkeleton()).not.toBeNull())
    expect(tabSkeleton()).toHaveAttribute('data-rows', '3')
    // скелетон показан на 200 мс, ответ — на 250: ворота держат скелетон до 600 мс
    await act(async () => { await new Promise<void>((r) => setTimeout(r, 150)) })
    expect(tabSkeleton()).not.toBeNull()
    expect(screen.queryByRole('list', { name: 'Статусы' })).toBeNull()
    expect(await screen.findByRole('list', { name: 'Статусы' })).toHaveTextContent('statuses d1')
    expect(tabSkeleton()).toBeNull()
  })

  it('возврат на загруженную вкладку — без запроса и без скелетона', async () => {
    const asked: string[] = []
    const { open } = setup(undefined, async (q) => { asked.push(q.tab); return { rows: [`${q.tab} ${q.id}`] } })
    open('d1')
    await screen.findByText('Блок b1')
    await userEvent.click(screen.getByRole('tab', { name: 'Статусы' }))
    await screen.findByRole('list', { name: 'Статусы' })
    await userEvent.click(screen.getByRole('tab', { name: 'Общие данные' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Статусы' }))
    expect(screen.getByRole('list', { name: 'Статусы' })).toHaveTextContent('statuses d1')
    expect(tabSkeleton()).toBeNull()
    expect(asked).toEqual(['statuses'])
  })

  it('ошибка вкладки — alert с текстом ApiError и «Повторить»; шапка, лейн и «Общие» живы; повтор загружает', async () => {
    let fail = true
    const { open } = setup(undefined, async (q) => {
      if (fail) throw new ApiError(500, null, 'Сбой сервера: Регулятор ?fail=tab:statuses')
      return { rows: [`${q.tab} ${q.id}`] }
    })
    open('d1')
    await screen.findByText('Блок b1')
    await userEvent.click(screen.getByRole('tab', { name: 'Статусы' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Не удалось загрузить вкладку')
    expect(alert).toHaveTextContent('Сбой сервера: Регулятор ?fail=tab:statuses')
    expect(names()).toEqual(['Платёжная инструкция № 417'])
    expect(screen.getByText('Обработан')).toBeInTheDocument()
    fail = false
    await userEvent.click(within(alert).getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByRole('list', { name: 'Статусы' })).toHaveTextContent('statuses d1')
    await userEvent.click(screen.getByRole('tab', { name: 'Общие данные' }))
    expect(screen.getByText('Блок b1')).toBeInTheDocument()
  })

  it('ctx: docId — документ слота; openDocument открывает документ в B; announce — в живой регион', async () => {
    const { open } = setup()
    open('d1')
    await screen.findByText('Блок b1')
    await userEvent.click(screen.getByRole('tab', { name: 'Связанные документы' }))
    await screen.findByRole('button', { name: 'Раскрыть' })
    expect(document.querySelector('[data-doc="d1"]')).not.toBeNull()
    await userEvent.click(await screen.findByRole('button', { name: 'Открыть linked d1 в соседней панели' }))
    await waitFor(() => expect(names()).toEqual(['Платёжная инструкция № 418', 'Платёжная инструкция № 417']))
    expect(screen.getByText('B · сравнение')).toBeInTheDocument()
    const a = screen.getByRole('dialog', { name: 'Платёжная инструкция № 417' })
    await userEvent.click(within(a).getByRole('button', { name: 'Переотправить' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Действие будет в 2d'))
  })

  it('раскрытое во вкладке переживает переключение вкладок (модель, ключ id:tab)', async () => {
    const { open } = setup()
    open('d1')
    await screen.findByText('Блок b1')
    await userEvent.click(screen.getByRole('tab', { name: 'Связанные документы' }))
    const toggle = await screen.findByRole('button', { name: 'Раскрыть' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle)
    await userEvent.click(screen.getByRole('tab', { name: 'Статусы' }))
    await screen.findByRole('list', { name: 'Статусы' })
    await userEvent.click(screen.getByRole('tab', { name: 'Связанные документы' }))
    expect(await screen.findByRole('button', { name: 'Раскрыть' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('M-g: раскрытое поле «Общих данных» переживает переключение вкладок', async () => {
    const { open } = setup()
    open('d1')
    await screen.findByText('Блок b1')
    const toggle = () => document.querySelector<HTMLButtonElement>('[data-field="20"] > button')!
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(screen.getByRole('tab', { name: 'Доп. поля' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Общие данные' }))
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
  })

  it('M-f: вкладка, выбранная до загрузки и оказавшаяся без данных, — после загрузки выбрана первая', async () => {
    let release = () => {}
    const { open } = setup((id) => new Promise<Doc>((r) => { release = () => r(rows.find((x) => x.id === id)!) }))
    open('d1')
    // до загрузки tabsOff — из строки реестра (пуст): «Аудит» доступна
    await userEvent.click(screen.getByRole('tab', { name: 'Аудит' }))
    expect(screen.getByRole('tab', { name: 'Аудит' })).toHaveAttribute('aria-selected', 'true')
    await act(async () => { release() })
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Общие данные' })).toHaveAttribute('aria-selected', 'true'))
    expect(screen.getByRole('tab', { name: 'Аудит' })).toBeDisabled()
    expect(await screen.findByText('Блок b1')).toBeInTheDocument()
  })

  it('без нарушений axe на нелокальной вкладке', async () => {
    const { container, open } = setup()
    open('d1')
    await screen.findByText('Блок b1')
    await userEvent.click(screen.getByRole('tab', { name: 'Связанные документы' }))
    await screen.findByRole('button', { name: 'Раскрыть' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

  Run: `pnpm --filter pi test -- DocDetail`
  Expected: FAIL — нет «Доп. поля документа …», нет `tab-skeleton`, заглушка прежняя.

- [ ] **Step 4: компонент — реализация.** Заменить `apps/pi/src/widgets/doc-detail/ui/DocDetail.tsx` целиком:

```tsx
import { useEffect, useRef, useState } from 'react'
import { useUnit } from 'effector-react'
import {
  ConfigForm, Drawer, DrawerStack, ErrorState, IconButton, LinkValue, Menu, Skeleton, StatusDot, TabPanel, Tabs, Tag,
  useKatran, useLoadingGate, type DrawerStackItem,
} from '@katran/ui'
import type { DetailAction, DetailDomain, DetailSummary, RemoteTabView, TabContext } from '../../../shared/lib/detail'
import type { Detail, DetailSlot, TabSlot } from '../lib/createDetail'
import { ActionGlyph } from './icons'
import s from './DocDetail.module.css'

export type DocDetailProps<D, Row> = {
  detail: Detail<D>
  /** Всё доменное — схема, поля, вкладки и их виды, действия, блоки (спека 2a §4.3, 2b §3.3): виджет не импортирует сущности. */
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

/** Скелетон нелокальной вкладки (эталон skeleton.js): полоса шапки таблицы и rows строк (у вида — skeletonRows, по умолчанию 4). */
function TabSkeleton({ rows }: { rows: number }) {
  return (
    <div className={s.skeleton} data-part="tab-skeleton" data-rows={rows} aria-busy="true">
      <span className={s.sr}>Загрузка вкладки</span>
      <Skeleton.Block height={22} />
      {Array.from({ length: rows }, (_, i) => <Skeleton.Block key={i} height={24} />)}
    </div>
  )
}

/** Вкладка без вида в домене: для fx/rub недостижимо (полноту tabViews проверяет страница), виджет — общий. */
function Stub({ label }: { label: string }) {
  return <div className={s.stub}>Вкладка «{label}» не подключена</div>
}

/**
 * Нелокальная вкладка (спека 2b §3.3): свои скелетон (порог и минимум — ворота кита, как у грида: не короче 400 мс),
 * ошибка с текстом ApiError и «Повторить», вид домена на готовых данных. Детали не касается.
 */
function RemoteBody({ tab, view, ctx, onRetry }: { tab: TabSlot; view: RemoteTabView; ctx: TabContext; onRetry: () => void }) {
  const skeleton = useLoadingGate(tab.state === 'loading')
  if (skeleton) return <TabSkeleton rows={view.skeletonRows ?? 4} />
  if (tab.state === 'error') return <ErrorState title="Не удалось загрузить вкладку" text={tab.error ?? undefined} retry={onRetry} />
  if (tab.state === 'loading') return null
  return <>{view.render(tab.data, ctx)}</>
}

type BodyProps<D, Row> = {
  view: DetailSlot<D>
  domain: DetailDomain<D, Row>
  tabId: string
  tabLabel: string
  skeleton: boolean
  ctx: TabContext
  mainExpanded: string[] | undefined
  onMainExpanded: (keys: string[]) => void
  onRetry: () => void
  onRetryTab: () => void
}

/** Содержимое панели. Монтируется только у активной вкладки (TabPanel), поэтому view.tabView — её состояние. */
function Body<D, Row>({ view, domain, tabId, tabLabel, skeleton, ctx, mainExpanded, onMainExpanded, onRetry, onRetryTab }: BodyProps<D, Row>) {
  const first = tabId === domain.tabs[0]?.id
  const tv = first ? undefined : domain.tabViews?.[tabId]
  // нелокальная вкладка не зависит от загрузки детали: свой запрос, свои скелетон и ошибка
  if (tv?.kind === 'remote') return view.tabView ? <RemoteBody tab={view.tabView} view={tv} ctx={ctx} onRetry={onRetryTab} /> : <Stub label={tabLabel} />
  // ворота скелетона держат его минимум sk-min (400 мс, как у грида) — данные и ошибка до этого не показываются
  if (skeleton) return <FormSkeleton />
  if (view.state === 'error') return <ErrorState title="Не удалось загрузить документ" text={view.error ?? undefined} retry={onRetry} />
  const d = view.data
  if (d === null) return null
  if (tv?.kind === 'local') return <>{tv.render(d, ctx)}</>
  if (!first) return <Stub label={tabLabel} />
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
      // M-g: раскрытое — в модели по `${id}:main`; до первого изменения undefined — форма берёт свои умолчания
      expanded={mainExpanded}
      onExpandedChange={onMainExpanded}
    />
  )
}

type PaneProps<D, Row> = Omit<DocDetailProps<D, Row>, 'detail'> & { detail: Detail<D>; view: DetailSlot<D>; focusKey: number; quiet: boolean }

function DetailPane<D, Row>({ view, detail, domain, rowOf, returnFocus, focusKey, quiet }: PaneProps<D, Row>) {
  const [close, setTab, retry, retryTab, open, setExpanded, expanded] = useUnit([
    detail.close, detail.setTab, detail.retry, detail.retryTab, detail.open, detail.setExpanded, detail.$expanded,
  ])
  const { announce } = useKatran()
  const skeleton = useLoadingGate(view.state === 'loading')
  const row = view.data === null && rowOf ? rowOf(view.id) : null
  const summary = view.data !== null ? domain.summary(view.data) : row !== null ? domain.rowSummary(row) : null
  const label = summary?.label ?? domain.title
  const off = summary?.tabsOff ?? []
  const tabsId = `doc-detail-${view.slot}`
  const onAction: OnAction = (a, form) => announce(form ? `${a.label}: ${form} · ${label}` : `${a.label} · ${label}`)
  const firstTab = domain.tabs[0]?.id ?? 'main'
  // M-f: вкладка, выбранная до загрузки (tabsOff строки реестра пуст), оказалась без данных — слот возвращается на первую.
  // Здесь, а не в модели: tabsOff — знание домена (summary), модель деталки домена не получает (решение Task 11, п. 5)
  const offActive = view.data !== null && off.includes(view.tab)
  useEffect(() => {
    if (offActive) setTab({ slot: view.slot, tab: firstTab })
  }, [offActive, view.slot, firstTab, setTab])
  const keyOf = (tab: string) => `${view.id}:${tab}`
  const ctxOf = (tab: string): TabContext => ({
    docId: view.id,
    // связанный документ — в B; уже открытый в любом слоте повторно не открывается, фокус в его drawer (правило 2a)
    openDocument: (id) => open({ id, secondary: true }),
    announce,
    expanded: expanded[keyOf(tab)] ?? null,
    setExpanded: (keys) => setExpanded({ id: view.id, tab, keys }),
  })
  return (
    <Drawer
      label={label}
      title={domain.title}
      meta={summary ? <><LinkValue name={summary.uuid} value={summary.uuid} /><span>{summary.created}</span></> : undefined}
      badge={view.slot === 'b' ? { text: 'B · сравнение', tone: 'b' } : { text: 'A', tone: 'a' }}
      onClose={() => close(view.slot)}
      returnFocus={returnFocus ? () => returnFocus(view.id) : undefined}
      focusKey={focusKey}
      // R10: автооткрытие (quiet) фокус не забирает — он остаётся в реестре, как на стенде
      initialFocus={!quiet}
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
          <Body
            view={view}
            domain={domain}
            tabId={t.id}
            tabLabel={t.label}
            skeleton={skeleton}
            ctx={ctxOf(t.id)}
            mainExpanded={expanded[keyOf(t.id)]}
            onMainExpanded={(keys) => setExpanded({ id: view.id, tab: t.id, keys })}
            onRetry={() => retry(view.slot)}
            onRetryTab={() => retryTab(view.slot)}
          />
        </TabPanel>
      ))}
    </Drawer>
  )
}

/** Деталка документа (спека 2a §4.3, 2b §3.3): DrawerStack кита, в слоте — шапка, лейн, вкладки с переполнением и их виды. */
export function DocDetail<D, Row>({ detail, domain, rowOf, returnFocus }: DocDetailProps<D, Row>) {
  const [slots, focus, quiet, closeTop] = useUnit([detail.$slots, detail.$focus, detail.$quiet, detail.closeTop])
  const items: DrawerStackItem[] = []
  for (const slot of ['a', 'b'] as const) {
    const view = slots[slot]
    if (view) {
      items.push({
        key: view.id,
        slot,
        node: <DetailPane view={view} detail={detail} domain={domain} rowOf={rowOf} returnFocus={returnFocus} focusKey={focus[view.id] ?? 0} quiet={quiet[view.id] === true} />,
      })
    }
  }
  return <DrawerStack items={items} onEscape={closeTop} />
}
```

  Run: `pnpm --filter pi test -- doc-detail`
  Expected: PASS — `createDetail.test.ts` 27, `DocDetail.test.tsx` 19.

- [ ] **Step 5: запуск и граница.**
  Run: `pnpm --filter pi test` — PASS (все файлы `apps/pi`; `app/details.a11y.test.tsx` 2a проходит без изменений — вкладка «Общие» и `tabFx` не передан).
  Run: `grep -rn "entities" apps/pi/src/widgets/doc-detail` — пусто (виджет сущностей не знает; eslint-зона `doc-detail → entities` это же проверяет в `pnpm lint`).
  Run: `pnpm check` — зелёный.
  e2e в этой задаче не запускается: сценарий 2a «Статусы — будет в срезе 2b» в `apps/pi/e2e/detail.spec.ts` правит Task 12 вместе с новым `detail-tabs.spec.ts`.

- [ ] **Step 6: commit.**

```bash
git add apps/pi/src/widgets/doc-detail/lib/createDetail.ts apps/pi/src/widgets/doc-detail/lib/createDetail.test.ts apps/pi/src/widgets/doc-detail/ui/DocDetail.tsx apps/pi/src/widgets/doc-detail/ui/DocDetail.test.tsx apps/pi/src/widgets/doc-detail/index.ts
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "apps/pi: doc-detail — ленивая загрузка вкладок (кэш id:tab, визиты, retryTab), раскрытие по документу, виды вкладок из домена; M-f, M-g"
```

---
### Task 12: Страницы — `tabViews`, «Связанный» → B; Д28 в ките; e2e вкладок

**Files:**
- Create: `apps/pi/src/pages/fx-docs/ui/detailDomain.ts`, `apps/pi/src/pages/rub-docs/ui/detailDomain.ts`, `apps/pi/e2e/detail-tabs.spec.ts`
- Modify: `apps/pi/src/pages/fx-docs/model/registry.model.ts`, `apps/pi/src/pages/fx-docs/model/registry.model.test.ts`, `apps/pi/src/pages/fx-docs/ui/FxDocsPage.tsx`, `apps/pi/src/pages/fx-docs/index.ts`, те же четыре файла `apps/pi/src/pages/rub-docs/…` (`RubDocsPage.tsx`), `apps/pi/src/app/details.a11y.test.tsx`, `packages/ui/src/grid/Grid.module.css`, `apps/pi/e2e/detail.spec.ts`, `apps/pi/e2e/registry.spec.ts`
- Порты сущностей (`entities/fx-doc/api/ports.ts`, `entities/rub-doc/api/ports.ts`) **не правятся**: `parseTab` из `TRAIL_PARSERS` подключает Task 10, здесь только `fxDocPorts.tabFx` / `rubDocPorts.tabFx`.

**Interfaces:**
- Produces: `FX_LOCAL_TABS = ['main', 'extra']`, `RUB_LOCAL_TABS = ['main']` (модели страниц, экспорт из `pages/*/index.ts`); `fxDetailDomain: DetailDomain<FxDocDetail, FxDoc>`, `rubDetailDomain: DetailDomain<RubDocDetail, RubDoc>` — домен сущности плюс `tabViews` (`pages/*/ui/detailDomain.ts`, экспорт из `pages/*/index.ts` — для `app/details.a11y.test.tsx`); модели страниц передают `createDetail` `tabFx` и `localTabs`. Кит: Д28 — `:not([data-mark])` у переопределения `--k-val` записи-состояния и у штриховки/наведения неактивной записи.
- Consumes: `createDetail` (`tabFx`, `localTabs`, `tabView`, `$expanded`), `data-part="tab-skeleton"` (Task 11); `TRAIL_VIEWS`, `TrailTabId` (`entities/doc-trail`, Task 7–9); `fxExtraView` (Task 10); `fxDocPorts.tabFx`, `rubDocPorts.tabFx` с `parseTab` по набору реестра (Task 10); `FX_TABS`, `RUB_TABS` (2a); фейк `…/tabs/{tab}`, `?fail=tab`, `?fail=tab:<id>`, `tabsOff` по данным (Task 6–7); высоты строк `MiniTable` 24/22, раскрываемой 26 (роли `table`/`row`/`columnheader`/`cell`, переключатель с `aria-expanded`), `KeyValueList` 24 (строка — `[data-kv]`) (Task 3–4); числа замера эталона (Task 1, `detail-drift.md`, раздел «2b»); `requestFx`, `HttpRequest`, `TabQuery` (`shared/api`).

**Решения задачи:**
- **Сборка `tabViews` — в `pages/*/ui/detailDomain.ts`**, а не в сущности: страница — единственный слой, который видит и `fx-doc`, и `doc-trail` через их `index.ts` (соседние сущности импортируют друг друга только через `@x`, а виды — не контракт соседства). Набор берётся из `FX_TABS`/`RUB_TABS`: у валюты `source`, у рубля `ed244`.
- **`localTabs` — явной константой в модели** (`FX_LOCAL_TABS`, `RUB_LOCAL_TABS`); согласованность с `tabViews` и с `parseTab` портов проверяют тесты страницы (Step 1): каждая вкладка набора либо локальная с локальным видом (или `main` — `ConfigForm`), либо нелокальная с видом `remote` и парсером в порту.
- **e2e без сети.** Фейк работает внутри страницы (`requestFx.use(createFakeServer(...))`, `app/transport.ts`), сетевых запросов нет — перехватывать Playwright'ом нечего. Поэтому: «переключение не перезапрашивает» проверяется **взведённым регулятором**: после загрузки вкладки в адрес ставится `?fail=tab` (`history.replaceState`, без перезагрузки — `failing()` фейка читает `location.search` на каждом запросе); любой новый запрос вкладки дал бы ошибку, её нет — запроса не было; контроль — вкладка не из кэша при том же регуляторе падает. «Повтор после снятия регулятора» — тем же `replaceState` без `fail`, затем «Повторить».
- **Д28 в jsdom не проверяется** (каскад CSS-модулей jsdom не видит, Global Constraints) — только вычисленные стили в e2e. Попутно `registry.spec.ts` B1 смотрит приглушение на записи **без** метки: после Д28 метка сильнее состояния, а автооткрытие (В-Д4) может пометить первую заблокированную запись.

- [ ] **Step 1: тесты страниц и a11y (падают).** В `apps/pi/src/pages/fx-docs/model/registry.model.test.ts` заменить импорты:

```ts
import { allSettled, fork } from 'effector'
import { FX_DETAIL_EXAMPLE, FX_TABS, fxDocPorts, parseFxDocDetail, type FxDoc } from '../../../entities/fx-doc'
import { requestFx, type HttpRequest, type TabQuery } from '../../../shared/api'
import { fxDetailDomain } from '../ui/detailDomain'
import { detail, FX_LOCAL_TABS, lifecycle, registry } from './registry.model'
```

  и дописать в конец файла:

```ts
describe('страница fx-docs: вкладки деталки (спека 2b §3.4)', () => {
  it('нелокальная вкладка грузится портом при выборе; «Доп. поля» — локальная, без запроса', async () => {
    const doc = parseFxDocDetail(FX_DETAIL_EXAMPLE, 'ответ')
    const asked: TabQuery[] = []
    const scope = fork({
      handlers: [
        [fxDocPorts.detailFx, async (id: string) => ({ ...doc, id })],
        [fxDocPorts.tabFx, async (q: TabQuery) => { asked.push(q); return [] }],
        [fxDocPorts.searchFx, async () => ({ rows: [], total: 0 })],
        [fxDocPorts.facetsFx, async () => []],
        [fxDocPorts.filterMetaFx, async () => ({ fields: [] })],
      ],
    })
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(registry.openRequested, { scope, params: { id: 'u1', secondary: false } })
    await allSettled(detail.setTab, { scope, params: { slot: 'a', tab: 'extra' } })
    await allSettled(detail.setTab, { scope, params: { slot: 'a', tab: 'statuses' } })
    expect(asked).toEqual([{ id: 'u1', tab: 'statuses' }])
    expect(scope.getState(detail.$slots).a).toMatchObject({ tab: 'statuses', tabView: { state: 'ready', data: [] } })
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('каждая вкладка FX_TABS — «Общие» (ConfigForm), локальная с локальным видом или нелокальная с видом remote', () => {
    const views = fxDetailDomain.tabViews ?? {}
    expect(Object.keys(views).sort()).toEqual(FX_TABS.map((t) => t.id).filter((id) => id !== 'main').sort())
    expect(FX_LOCAL_TABS).toContain('main')
    for (const t of FX_TABS.filter((x) => x.id !== 'main')) {
      expect(views[t.id]?.kind, t.id).toBe(FX_LOCAL_TABS.includes(t.id) ? 'local' : 'remote')
    }
  })

  it('порт вкладок знает ровно нелокальные вкладки валюты: остальные — отказ до запроса (parseTab, Task 10)', async () => {
    const urls: string[] = []
    const scope = fork({ handlers: [[requestFx, async (req: HttpRequest) => { urls.push(req.url); return {} }]] })
    for (const t of FX_TABS) await allSettled(fxDocPorts.tabFx, { scope, params: { id: 'u1', tab: t.id } })
    expect(urls).toEqual(FX_TABS.filter((t) => !FX_LOCAL_TABS.includes(t.id)).map((t) => `/grids/fx-docs/documents/u1/tabs/${t.id}`))
    const foreign = await allSettled(fxDocPorts.tabFx, { scope, params: { id: 'u1', tab: 'ed244' } })
    expect(foreign.status).toBe('fail')
    expect(urls).toHaveLength(FX_TABS.length - FX_LOCAL_TABS.length)
  })
})
```

  В `apps/pi/src/pages/rub-docs/model/registry.model.test.ts` заменить импорты:

```ts
import { allSettled, fork } from 'effector'
import { RUB_DETAIL_EXAMPLE, RUB_TABS, parseRubDocDetail, rubDocPorts, type RubDoc } from '../../../entities/rub-doc'
import { requestFx, type HttpRequest, type TabQuery } from '../../../shared/api'
import { rubDetailDomain } from '../ui/detailDomain'
import { detail, lifecycle, registry, RUB_LOCAL_TABS } from './registry.model'
```

  и дописать в конец файла:

```ts
describe('страница rub-docs: вкладки деталки (спека 2b §3.4)', () => {
  it('нелокальная вкладка грузится портом при выборе', async () => {
    const doc = parseRubDocDetail(RUB_DETAIL_EXAMPLE, 'ответ')
    const asked: TabQuery[] = []
    const scope = fork({
      handlers: [
        [rubDocPorts.detailFx, async (id: string) => ({ ...doc, id })],
        [rubDocPorts.tabFx, async (q: TabQuery) => { asked.push(q); return [] }],
        [rubDocPorts.searchFx, async () => ({ rows: [], total: 0 })],
        [rubDocPorts.facetsFx, async () => []],
        [rubDocPorts.filterMetaFx, async () => ({ fields: [] })],
      ],
    })
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(registry.openRequested, { scope, params: { id: 'r1', secondary: false } })
    await allSettled(detail.setTab, { scope, params: { slot: 'a', tab: 'ed244' } })
    expect(asked).toEqual([{ id: 'r1', tab: 'ed244' }])
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('каждая вкладка RUB_TABS кроме «Общих» — вид remote; локальна только main', () => {
    const views = rubDetailDomain.tabViews ?? {}
    expect(RUB_LOCAL_TABS).toEqual(['main'])
    expect(Object.keys(views).sort()).toEqual(RUB_TABS.map((t) => t.id).filter((id) => id !== 'main').sort())
    for (const t of RUB_TABS.filter((x) => x.id !== 'main')) expect(views[t.id]?.kind, t.id).toBe('remote')
  })

  it('порт вкладок знает ровно нелокальные вкладки рубля: source и extra — отказ до запроса', async () => {
    const urls: string[] = []
    const scope = fork({ handlers: [[requestFx, async (req: HttpRequest) => { urls.push(req.url); return {} }]] })
    for (const t of RUB_TABS) await allSettled(rubDocPorts.tabFx, { scope, params: { id: 'r1', tab: t.id } })
    expect(urls).toEqual(RUB_TABS.filter((t) => !RUB_LOCAL_TABS.includes(t.id)).map((t) => `/grids/rub-docs/documents/r1/tabs/${t.id}`))
    for (const tab of ['source', 'extra']) {
      expect((await allSettled(rubDocPorts.tabFx, { scope, params: { id: 'r1', tab } })).status).toBe('fail')
    }
    expect(urls).toHaveLength(RUB_TABS.length - RUB_LOCAL_TABS.length)
  })
})
```

  Заменить `apps/pi/src/app/details.a11y.test.tsx` целиком (блок 2a сохранён — с третьим аргументом `rows` у `makeFxDocDetail`/`makeRubDocDetail`, как его оставил Task 7; добавлен блок 2b — каждая вкладка обоих реестров через настоящие порты на фейке):

```tsx
import { act, screen, waitFor, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { createEffect, type Effect } from 'effector'
import { FX_TYPES, fxDocDetailDomain, fxDocLayout, fxDocPorts, parseFxDocDetail } from '../entities/fx-doc'
import { RUB_TYPES, parseRubDocDetail, rubDocDetailDomain, rubDocLayout, rubDocPorts } from '../entities/rub-doc'
import { FX_LOCAL_TABS, fxDetailDomain } from '../pages/fx-docs'
import { RUB_LOCAL_TABS, rubDetailDomain } from '../pages/rub-docs'
import { requestFx, type ApiError, type TabQuery } from '../shared/api'
import type { DetailDomain } from '../shared/lib/detail'
import { createPageLifecycle } from '../shared/lib/lifecycle'
import { renderK } from '../shared/lib/test'
import { createDetail, DocDetail } from '../widgets/doc-detail'
import { makeFxDocs } from './fake/fx-docs.data'
import { makeFxDocDetail } from './fake/fx-docs.detail'
import { fakeGrids } from './fake/grids'
import { makeRubDocs } from './fake/rub-docs.data'
import { makeRubDocDetail } from './fake/rub-docs.detail'
import { createFakeServer } from './fake/server'

// Вкладки 2b — через настоящие порты сущностей на фейке без задержек и регуляторов:
// цепочка «порт → requestFx → фейк → parseTab» та же, что в приложении (vitest изолирует модули по файлам)
requestFx.use(createFakeServer(fakeGrids))

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

type Ports<D> = { detailFx: Effect<string, D, ApiError>; tabFx: Effect<TabQuery, unknown, ApiError> }

/** Первый документ фейка, у которого вкладка с данными (её нет в tabsOff детали). */
async function docWithTab<D, Row>(ids: string[], ports: Ports<D>, domain: DetailDomain<D, Row>, tab: string): Promise<string> {
  for (const id of ids) if (!domain.summary(await ports.detailFx(id)).tabsOff.includes(tab)) return id
  throw new Error(`В фейке нет документа с вкладкой ${tab}`)
}

/** Вкладка документа под axe (спека 2b §5): домен страницы с tabViews, настоящие порты, фейк, виды doc-trail и fx-doc. */
async function checkTab<D, Row>(domain: DetailDomain<D, Row>, ports: Ports<D>, localTabs: string[], id: string, tab: string) {
  const lifecycle = createPageLifecycle()
  const detail = createDetail({ detailFx: ports.detailFx, tabFx: ports.tabFx, localTabs, lifecycle })
  const { container, unmount } = renderK(<DocDetail detail={detail} domain={domain} />)
  act(() => {
    lifecycle.pageOpened()
    detail.open({ id, secondary: false })
  })
  await waitFor(() => expect(document.querySelector('[data-part="hero"]')).not.toBeNull())
  act(() => { detail.setTab({ slot: 'a', tab }) })
  await waitFor(() => expect(detail.$slots.getState().a?.tabView?.state ?? 'ready').toBe('ready'))
  const panel = screen.getByRole('tabpanel')
  await waitFor(() => expect(panel).not.toBeEmptyDOMElement())
  expect(within(panel).queryByRole('alert')).toBeNull()
  expect(await axe(container)).toHaveNoViolations()
  unmount()
}

describe('a11y деталки на реальных профилях обоих реестров (спека 2a §6)', () => {
  it('валюта: каждый тип MT', async () => {
    const rows = makeFxDocs()
    for (const t of FX_TYPES) {
      const i = rows.findIndex((r) => r.type === t)
      if (i < 0) continue
      await check(fxDocDetailDomain, parseFxDocDetail(makeFxDocDetail(rows[i]!, i, rows), 'ответ'), new RegExp(`^Поля ${t}$`))
    }
  }, 60_000)
  it('рубль: каждый вид документа', async () => {
    const rows = makeRubDocs()
    for (const t of RUB_TYPES) {
      const i = rows.findIndex((r) => r.type === t)
      await check(rubDocDetailDomain, parseRubDocDetail(makeRubDocDetail(rows[i]!, i, rows), 'ответ'), /^Отправитель \/ Получатель$/)
    }
  }, 60_000)
})

describe('a11y вкладок деталки на данных фейка (спека 2b §5)', () => {
  it('валюта: каждая вкладка кроме «Общих»', async () => {
    const ids = makeFxDocs().map((r) => fxDocLayout.rowKey(r))
    for (const t of fxDetailDomain.tabs.filter((x) => x.id !== 'main')) {
      await checkTab(fxDetailDomain, fxDocPorts, FX_LOCAL_TABS, await docWithTab(ids, fxDocPorts, fxDetailDomain, t.id), t.id)
    }
  }, 120_000)
  it('рубль: каждая вкладка кроме «Общих»', async () => {
    const ids = makeRubDocs().map((r) => rubDocLayout.rowKey(r))
    for (const t of rubDetailDomain.tabs.filter((x) => x.id !== 'main')) {
      await checkTab(rubDetailDomain, rubDocPorts, RUB_LOCAL_TABS, await docWithTab(ids, rubDocPorts, rubDetailDomain, t.id), t.id)
    }
  }, 120_000)
})
```

  Run: `pnpm --filter pi test -- registry.model details.a11y`
  Expected: FAIL — нет `FX_LOCAL_TABS`/`RUB_LOCAL_TABS`, `ui/detailDomain.ts`, экспортов страниц.

- [ ] **Step 2: домены страниц.** Создать `apps/pi/src/pages/fx-docs/ui/detailDomain.ts`:

```ts
import { TRAIL_VIEWS, type TrailTabId } from '../../../entities/doc-trail'
import { FX_TABS, fxDocDetailDomain, fxExtraView, type FxDoc, type FxDocDetail } from '../../../entities/fx-doc'
import type { DetailDomain, TabView } from '../../../shared/lib/detail'

const isTrail = (id: string): id is TrailTabId => id in TRAIL_VIEWS

/**
 * Виды вкладок валюты (спека 2b §3.4): «Доп. поля» — локальная, из детали (fx-doc); общие вкладки истории обработки —
 * виды doc-trail по набору FX_TABS (у валюты «Исходный текст» — source, ED244 нет). «Общие данные» рисует ConfigForm виджета.
 * Собирается здесь: соседние сущности друг друга не видят (FSD), а страница видит обе через index.ts.
 */
const tabViews: Record<string, TabView<FxDocDetail>> = { extra: fxExtraView }
for (const t of FX_TABS) if (isTrail(t.id)) tabViews[t.id] = TRAIL_VIEWS[t.id]

export const fxDetailDomain: DetailDomain<FxDocDetail, FxDoc> = { ...fxDocDetailDomain, tabViews }
```

  Создать `apps/pi/src/pages/rub-docs/ui/detailDomain.ts`:

```ts
import { TRAIL_VIEWS, type TrailTabId } from '../../../entities/doc-trail'
import { RUB_TABS, rubDocDetailDomain, type RubDoc, type RubDocDetail } from '../../../entities/rub-doc'
import type { DetailDomain, TabView } from '../../../shared/lib/detail'

const isTrail = (id: string): id is TrailTabId => id in TRAIL_VIEWS

/** Виды вкладок рубля (спека 2b §3.4): все, кроме «Общих», — виды doc-trail по набору RUB_TABS (ED244 вместо исходного текста). */
const tabViews: Record<string, TabView<RubDocDetail>> = {}
for (const t of RUB_TABS) if (isTrail(t.id)) tabViews[t.id] = TRAIL_VIEWS[t.id]

export const rubDetailDomain: DetailDomain<RubDocDetail, RubDoc> = { ...rubDocDetailDomain, tabViews }
```

- [ ] **Step 3: модели и экраны страниц.** В `apps/pi/src/pages/fx-docs/model/registry.model.ts` заменить строки

```ts
/** Деталка экрана — на том же жизненном цикле: уход с экрана закрывает оба drawer'а и чистит кэш (спека 2a §5). */
export const detail = createDetail({ detailFx: fxDocPorts.detailFx, lifecycle })
```

  на

```ts
/** Вкладки валюты с данными в детали — без своего запроса (спека 2b §3.1): «Общие данные» и «Доп. поля». */
export const FX_LOCAL_TABS = ['main', 'extra']
/**
 * Деталка экрана — на том же жизненном цикле: уход с экрана закрывает оба drawer'а, чистит кэш детали и вкладок
 * и раскрытое (спека 2a §5, 2b §3.3). Остальные вкладки — лениво через tabFx.
 */
export const detail = createDetail({ detailFx: fxDocPorts.detailFx, tabFx: fxDocPorts.tabFx, localTabs: FX_LOCAL_TABS, lifecycle })
```

  В `apps/pi/src/pages/rub-docs/model/registry.model.ts` заменить строки

```ts
/** Деталка экрана — на том же жизненном цикле (спека 2a §5). */
export const detail = createDetail({ detailFx: rubDocPorts.detailFx, lifecycle })
```

  на

```ts
/** Вкладки рубля с данными в детали — только «Общие данные» (спека 2b §3.1); «Доп. полей» у рубля нет. */
export const RUB_LOCAL_TABS = ['main']
/** Деталка экрана — на том же жизненном цикле (спека 2a §5, 2b §3.3); вкладки кроме «Общих» — лениво через tabFx. */
export const detail = createDetail({ detailFx: rubDocPorts.detailFx, tabFx: rubDocPorts.tabFx, localTabs: RUB_LOCAL_TABS, lifecycle })
```

  В `apps/pi/src/pages/fx-docs/ui/FxDocsPage.tsx`: строку `import { fxDocDetailDomain, fxDocLayout } from '../../../entities/fx-doc'` заменить на `import { fxDocLayout } from '../../../entities/fx-doc'`; после строки `import { detail, registry } from '../model/registry.model'` добавить `import { fxDetailDomain } from './detailDomain'`; в `<DocDetail …>` проп `domain={fxDocDetailDomain}` заменить на `domain={fxDetailDomain}`.

  В `apps/pi/src/pages/rub-docs/ui/RubDocsPage.tsx`: строку `import { rubDocDetailDomain, rubDocLayout } from '../../../entities/rub-doc'` заменить на `import { rubDocLayout } from '../../../entities/rub-doc'`; после `import { detail, registry } from '../model/registry.model'` добавить `import { rubDetailDomain } from './detailDomain'`; `domain={rubDocDetailDomain}` → `domain={rubDetailDomain}`.

  Заменить `apps/pi/src/pages/fx-docs/index.ts`:

```ts
export { FxDocsPage } from './ui/FxDocsPage'
export { FX_LOCAL_TABS, lifecycle } from './model/registry.model'
export { fxDetailDomain } from './ui/detailDomain'
```

  Заменить `apps/pi/src/pages/rub-docs/index.ts`:

```ts
export { RubDocsPage } from './ui/RubDocsPage'
export { lifecycle, RUB_LOCAL_TABS } from './model/registry.model'
export { rubDetailDomain } from './ui/detailDomain'
```

  Run: `pnpm --filter pi test -- registry.model details.a11y`
  Expected: PASS — `registry.model.test.ts` fx 5 (2 + 3), rub 5 (2 + 3); `details.a11y.test.tsx` 4 (2 из 2a + 2 новых).
  Run: `pnpm --filter pi test` — PASS.

- [ ] **Step 4: Д28 в ките.** В `packages/ui/src/grid/Grid.module.css` заменить блок

```css
/* состояния записи (эталон 1d57ded): значения приглушены переопределением тонов внутри записи — классы значений не адресуются */
.record[data-state] {
  --k-ink: var(--k-muted);
  --k-ink2: var(--k-muted);
  --k-val: var(--k-muted);
}
```

  на

```css
/* состояния записи (эталон 1d57ded): значения приглушены переопределением тонов внутри записи — классы значений не адресуются */
.record[data-state] {
  --k-ink: var(--k-muted);
  --k-ink2: var(--k-muted);
}

/* акцент val не приглушается у записи, открытой в деталке: метка (полоса слева — var(--k-val)) сильнее состояния (Д28) */
.record[data-state]:not([data-mark]) {
  --k-val: var(--k-muted);
}
```

  и блок

```css
.record[data-state='inactive'] .cell,
.record[data-state='inactive'] .filler {
  background: repeating-linear-gradient(135deg, transparent 0 calc(var(--k-hatch) * 0.9), var(--k-sunk) calc(var(--k-hatch) * 0.9) var(--k-hatch));
}

.record[data-state='inactive']:hover .cell,
.record[data-state='inactive']:hover .filler {
  background: var(--k-hover);
}
```

  на

```css
/* штриховка и наведение неактивной записи — только без метки: у открытой в деталке виден фон метки (Д28) */
.record[data-state='inactive']:not([data-mark]) .cell,
.record[data-state='inactive']:not([data-mark]) .filler {
  background: repeating-linear-gradient(135deg, transparent 0 calc(var(--k-hatch) * 0.9), var(--k-sunk) calc(var(--k-hatch) * 0.9) var(--k-hatch));
}

.record[data-state='inactive']:not([data-mark]):hover .cell,
.record[data-state='inactive']:not([data-mark]):hover .filler {
  background: var(--k-hover);
}
```

  В `apps/pi/e2e/registry.spec.ts`, тест «B1: заблокированная запись …», в `page.evaluate` заменить селектор `'tbody[data-state="locked"] [class*="copy"]'` на `'tbody[data-state="locked"]:not([data-mark]) [class*="copy"]'` и комментарий над `const { valueColor, mutedColor }` дополнить: `// запись без метки деталки: у открытой (автооткрытие В-Д4) акцент не приглушается — Д28`.

  Run: `pnpm lint` — зелёный (stylelint `no-descending-specificity` не срабатывает: новые селекторы специфичнее прежних и стоят на их местах).
  Run: `pnpm --filter @katran/ui test` — PASS (поведенческих изменений в jsdom нет).

- [ ] **Step 5: сценарий 2a про заглушку.** В `apps/pi/e2e/detail.spec.ts`, тест «вкладки: в полосе 800 px не помещаются все …», заменить последние две строки

```ts
  await dw.getByRole('tab', { name: 'Статусы' }).click()
  await expect(dw.getByText('Вкладка «Статусы» — будет в срезе 2b')).toBeVisible()
```

  на

```ts
  // с 2b вкладка показывает содержимое, заглушки «будет в срезе 2b» нет (сами вкладки — detail-tabs.spec.ts)
  const statuses = dw.getByRole('tab', { name: 'Статусы' })
  if (await statuses.isEnabled()) {
    await statuses.click()
    await expect(dw.getByRole('tabpanel').getByRole('table').first()).toBeVisible()
  }
  await expect(dw.getByText(/будет в срезе 2b/)).toHaveCount(0)
```

- [ ] **Step 6: e2e вкладок.**
  1. **Разметка для замера.** Строка «ключ–значение» — `[data-kv]` (элемент строки `KeyValueList` в одну колонку, Task 4; «Комплаенс» никогда не в `tabsOff`, его группы — в одну колонку); таблицы и раскрываемые строки `MiniTable` — по ролям (`table`, `row`, `columnheader`, `cell`; переключатель раскрытия — кнопка с `aria-expanded` в последней ячейке, высота — у её строки). Своей разметки задача не добавляет.
  2. Создать `apps/pi/e2e/detail-tabs.spec.ts` (числа `REF` — из Task 1, `detail-drift.md` раздел «2b», «Замер эталона»; если замер дал другие — подставить их):

```ts
import { expect, test, type Locator, type Page } from '@playwright/test'

// Замер эталона e065bfb (Task 1, detail-drift.md «2b»): Chromium 1600×1000, масштаб 100 %
// head — шапка мини-таблицы (.tt th), row — строка (.tt td), kv — строка «ключ–значение» (.xr), expand — раскрываемая строка (.tk/.ld)
const REF = { head: 22, row: 24, kv: 24, expand: 26 }
const TOL = 2
const ROUTES = ['fx-docs', 'rub-docs'] as const
type Route = (typeof ROUTES)[number]
// вкладки кроме «Общих»: id — для имён скриншотов, подпись — как в полосе
const TABS: Record<Route, [string, string][]> = {
  'fx-docs': [
    ['extra', 'Доп. поля'], ['statuses', 'Статусы'], ['compliance', 'Комплаенс'], ['linked', 'Связанные документы'], ['tasks', 'Задачи'],
    ['notif', 'Нотификации'], ['source', 'Исходный текст'], ['stream', 'Стриминг'], ['mpu', 'MPU'], ['audit', 'Аудит'],
  ],
  'rub-docs': [
    ['statuses', 'Статусы'], ['compliance', 'Комплаенс'], ['linked', 'Связанные документы'], ['tasks', 'Задачи'],
    ['notif', 'Нотификации'], ['ed244', 'ED244'], ['stream', 'Стриминг'], ['mpu', 'MPU'], ['audit', 'Аудит'],
  ],
}

test.use({ viewport: { width: 1600, height: 1000 } })
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.clear()) })

const dialogs = (page: Page) => page.getByRole('dialog', { name: /^Платёжная инструкция/ })
const openBtn = (page: Page, n: number) => page.getByRole('button', { name: new RegExp(`^Открыть запись ${n}(\\D|$)`) })
/** Въезд drawer закончен — иначе boundingBox ловит промежуточный transform. */
const still = (page: Page, i = 0) =>
  dialogs(page).nth(i).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)).then(() => undefined))
const ready = async (page: Page, i = 0) => {
  await dialogs(page).nth(i).locator('[data-part="hero"]').waitFor()
  await still(page, i)
}
/** Высота строки: сам элемент-строка или ближайшая строка-предок (role="row" или tr). */
const rowHeight = (loc: Locator) => loc.evaluate((el) => (el.closest('[role="row"], tr') ?? el).getBoundingClientRect().height)
/** Регуляторы фейка читаются из location.search на каждом запросе: меняем адрес без перезагрузки и без hashchange. */
const setQuery = (page: Page, query: string) =>
  page.evaluate((q) => history.replaceState(null, '', `${location.pathname}?${q}${location.hash}`), query)

/** Экран на 100 % без открытых деталок (автооткрытие первой записи, В-Д4, закрываем Esc). */
async function start(page: Page, route: Route, query = 'slow=0') {
  await page.goto(`/?${query}#/${route}`)
  await page.getByRole('button', { name: '100 %' }).click()
  await page.locator('tbody[data-key]').first().waitFor()
  while (await dialogs(page).count() > 0) await page.keyboard.press('Escape')
}
/** Содержимое активной вкладки готово: скелетона нет, панель не пуста. */
async function settled(dw: Locator) {
  await expect(dw.locator('[data-part="tab-skeleton"]')).toHaveCount(0)
  await expect(dw.getByRole('tabpanel')).not.toBeEmpty()
}
/** Выбрать вкладку: видимую — кликом, из переполнения — через «••• N». false — вкладка недоступна (нет данных, tabsOff). */
async function pickTab(page: Page, dw: Locator, name: string): Promise<boolean> {
  const tab = dw.getByRole('tab', { name, exact: true })
  if (await tab.count() > 0) {
    if (await tab.isDisabled()) return false
    await tab.click()
    return true
  }
  await dw.getByRole('button', { name: /^Ещё вкладки: \d+$/ }).click()
  const item = page.getByRole('menu', { name: 'Вкладки' }).getByRole('menuitem', { name: new RegExp(`^${name}`) })
  if (await item.isDisabled()) {
    await page.keyboard.press('Escape')
    return false
  }
  await item.click()
  return true
}
/** Открыть в A первую запись (по порядку реестра), у которой вкладка есть, и выбрать её. */
async function openWithTab(page: Page, name: string): Promise<{ dw: Locator; n: number }> {
  while (await dialogs(page).count() > 0) await page.keyboard.press('Escape')
  let prev: string | null = null
  for (let n = 1; n <= 20; n++) {
    await openBtn(page, n).click()
    // открытие — через 220 мс (open-delay): ждём смены документа, иначе ready поймал бы прежний
    if (prev !== null) await expect(dialogs(page).first()).not.toHaveAttribute('aria-label', prev)
    await ready(page)
    const dw = dialogs(page).first()
    if (await pickTab(page, dw, name)) return { dw, n }
    prev = await dw.getAttribute('aria-label')
  }
  throw new Error(`Нет документа с вкладкой «${name}» среди первых 20 записей`)
}

/** Шапка и строка мини-таблицы «Статусов» первого документа, где они есть. */
async function tableRows(page: Page): Promise<{ head: number; row: number }> {
  const { dw } = await openWithTab(page, 'Статусы')
  await settled(dw)
  const table = dw.getByRole('tabpanel').getByRole('table').first()
  return {
    head: await rowHeight(table.getByRole('row').filter({ has: page.getByRole('columnheader') }).first()),
    row: await rowHeight(table.getByRole('row').filter({ has: page.getByRole('cell') }).first()),
  }
}
/** Строка «ключ–значение» «Комплаенса» первого документа, где он есть. */
async function kvRow(page: Page): Promise<number> {
  const { dw } = await openWithTab(page, 'Комплаенс')
  await settled(dw)
  return rowHeight(dw.getByRole('tabpanel').locator('[data-kv]').first())
}

for (const route of ROUTES) {
  test(`высоты вкладок против эталона ± ${TOL} (${route})`, async ({ page }) => {
    test.setTimeout(90_000)
    await start(page, route)
    const { head, row } = await tableRows(page)
    const kv = await kvRow(page)
    const { dw } = await openWithTab(page, 'Задачи')
    await settled(dw)
    const expand = await rowHeight(dw.getByRole('tabpanel').getByRole('table').first().locator('[aria-expanded]').first())
    const geo = { head, row, kv, expand }
    test.info().annotations.push({ type: 'geometry', description: `${route}: ${JSON.stringify(geo)}` })
    expect(Math.abs(geo.head - REF.head)).toBeLessThanOrEqual(TOL)
    expect(Math.abs(geo.row - REF.row)).toBeLessThanOrEqual(TOL)
    expect(Math.abs(geo.kv - REF.kv)).toBeLessThanOrEqual(TOL)
    expect(Math.abs(geo.expand - REF.expand)).toBeLessThanOrEqual(TOL)
  })

  test(`«Связанные документы»: ID связанного открывает его в B (${route})`, async ({ page }) => {
    test.setTimeout(60_000)
    await start(page, route)
    const { dw } = await openWithTab(page, 'Связанные документы')
    await settled(dw)
    const nameA = await dw.getAttribute('aria-label')
    await dw.getByRole('tabpanel').getByRole('button', { name: /^Открыть .+ в соседней панели$/ }).first().click()
    await expect(dialogs(page)).toHaveCount(2)
    const b = dialogs(page).nth(0)
    await expect(b.getByText('B · сравнение')).toBeVisible()
    expect(await b.getAttribute('aria-label')).not.toBe(nameA)
    await expect(dialogs(page).nth(1)).toHaveAttribute('aria-label', nameA ?? '')
    await ready(page, 0)
    await expect(b.getByRole('heading', { name: 'Платёжная инструкция' })).toBeFocused()
  })

  test(`скриншоты вкладок для сверки с эталоном (${route})`, async ({ page }) => {
    test.setTimeout(180_000)
    await start(page, route)
    const shot: string[] = []
    for (const [id, name] of TABS[route]) {
      const { dw } = await openWithTab(page, name)
      await settled(dw)
      await expect(dw.getByRole('alert')).toHaveCount(0)
      await page.screenshot({ path: test.info().outputPath(`tab-${route}-${id}.png`) })
      shot.push(id)
    }
    test.info().annotations.push({ type: 'screenshots', description: `${route}: ${shot.join(', ')}` })
    expect(shot).toHaveLength(TABS[route].length)
  })
}

test('?fail=tab:audit — ошибка вкладки с «Повторить»; шапка, лейн и «Общие» живы; после снятия регулятора повтор успешен', async ({ page }) => {
  test.setTimeout(60_000)
  await start(page, 'fx-docs', 'slow=0&fail=tab:audit')
  const { dw } = await openWithTab(page, 'Аудит')
  const alert = dw.getByRole('tabpanel').getByRole('alert')
  await expect(alert).toContainText('Не удалось загрузить вкладку')
  await expect(alert).toContainText('Регулятор ?fail=tab:audit')
  await expect(dw).toHaveAttribute('aria-label', /№ \d+/)
  await expect(dw.locator('[data-part="lane"]')).toBeVisible()
  expect(await pickTab(page, dw, 'Общие данные')).toBe(true)
  await expect(dw.locator('[data-part="hero"]')).toBeVisible()
  // регулятор взведён: повторный выбор вкладки с ошибкой — новый запрос и снова ошибка
  expect(await pickTab(page, dw, 'Аудит')).toBe(true)
  await expect(alert).toContainText('Не удалось загрузить вкладку')
  await setQuery(page, 'slow=0')
  await alert.getByRole('button', { name: 'Повторить' }).click()
  await expect(dw.getByRole('alert')).toHaveCount(0)
  await settled(dw)
})

test('кэш вкладок: возврат на вкладку и повторное открытие документа без запроса (взведённый ?fail=tab не срабатывает)', async ({ page }) => {
  test.setTimeout(60_000)
  await start(page, 'fx-docs')
  const { dw, n } = await openWithTab(page, 'Статусы')
  await settled(dw)
  const name = await dw.getAttribute('aria-label')
  // с этого момента любой новый запрос вкладки — 500: ошибки нет ⇔ запроса не было
  await setQuery(page, 'slow=0&fail=tab')
  expect(await pickTab(page, dw, 'Общие данные')).toBe(true)
  await expect(dw.locator('[data-part="hero"]')).toBeVisible()
  expect(await pickTab(page, dw, 'Статусы')).toBe(true)
  await settled(dw)
  await expect(dw.getByRole('alert')).toHaveCount(0)
  // другой документ в A, затем снова тот же — «Статусы» из кэша id:tab
  await openBtn(page, n + 1).click()
  await expect(dialogs(page).first()).not.toHaveAttribute('aria-label', name ?? '')
  await ready(page)
  await openBtn(page, n).click()
  await expect(dialogs(page).first()).toHaveAttribute('aria-label', name ?? '')
  await ready(page)
  const again = dialogs(page).first()
  expect(await pickTab(page, again, 'Статусы')).toBe(true)
  await settled(again)
  await expect(again.getByRole('alert')).toHaveCount(0)
  // контроль: регулятор действительно взведён — вкладка не из кэша падает
  let control = false
  for (const other of ['Комплаенс', 'Задачи', 'Нотификации', 'Стриминг', 'Аудит']) {
    if (await pickTab(page, again, other)) { control = true; break }
  }
  expect(control).toBe(true)
  await expect(again.getByRole('tabpanel').getByRole('alert')).toContainText('Не удалось загрузить вкладку')
})

test('враждебный хост (?hostile): строки вкладок той же высоты', async ({ page }) => {
  test.setTimeout(60_000)
  await start(page, 'fx-docs', 'hostile&slow=0')
  await page.waitForFunction(() => getComputedStyle(document.body).fontFamily.includes('Georgia'))
  const { head, row } = await tableRows(page)
  const kv = await kvRow(page)
  test.info().annotations.push({ type: 'geometry', description: `hostile: ${JSON.stringify({ head, row, kv })}` })
  expect(Math.abs(head - REF.head)).toBeLessThanOrEqual(TOL)
  expect(Math.abs(row - REF.row)).toBeLessThanOrEqual(TOL)
  expect(Math.abs(kv - REF.kv)).toBeLessThanOrEqual(TOL)
})

test('Д28: метка открытой записи сильнее состояния — полоса val у заблокированной и неактивной, фон метки без штриховки', async ({ page }) => {
  await start(page, 'fx-docs')
  for (const state of ['locked', 'inactive'] as const) {
    const rec = page.locator(`tbody[data-key][data-state="${state}"]`).first()
    await rec.locator('[data-k-open]').click()
    await expect(rec).toHaveAttribute('data-mark', 'a')
    await page.mouse.move(1, 1)
    const st = await rec.evaluate((el) => {
      const probe = (value: string) => {
        const p = document.createElement('div')
        p.style.color = value
        document.body.appendChild(p)
        const c = getComputedStyle(p).color
        p.remove()
        return c
      }
      const cells = el.querySelectorAll<HTMLElement>('td[role="gridcell"]')
      const lead = getComputedStyle(cells[0]!)
      const value = getComputedStyle(cells[1]!)
      return { stripe: lead.boxShadow, image: value.backgroundImage, bg: value.backgroundColor, val: probe('var(--k-val)'), soft: probe('var(--k-val-soft)') }
    })
    test.info().annotations.push({ type: 'Д28', description: `${state}: ${JSON.stringify(st)}` })
    expect(st.stripe.startsWith(st.val)).toBe(true)
    expect(st.image).toBe('none')
    expect(st.bg).toBe(st.soft)
  }
})
```

- [ ] **Step 7: e2e — запуск (передний план, дождаться).**
  Run: `pnpm --filter pi e2e -- detail-tabs`
  Expected: PASS — 10 (высоты ×2, «Связанные» → B ×2, скриншоты ×2, `?fail=tab:audit`, кэш, `?hostile`, Д28).
  Run: `pnpm --filter pi e2e`
  Expected: PASS — 50 (прежние 40 с правками Step 4–5 + 10 новых).
  Аннотации `geometry` (высоты, в том числе `?hostile`) и `Д28` — записать в леджер: они идут в `detail-drift.md` (Task 13). Скриншоты `tab-<route>-<id>.png` (в `apps/pi/test-results/…`) положить рядом со скриншотами эталона Task 1 и сравнить глазами; расхождения вида — новые пункты класса D в `detail-drift.md` (Task 13). Если высота вне допуска — сначала сверить токен строки в ките (Task 3–4) с замером Task 1, `REF` не подгонять.
- [ ] **Step 8: проверка в браузере — делает контроллер.** `pnpm --filter pi dev` (5185): `#/fx-docs` — открыть документ, пройти все вкладки: скелетон на медленном `?slow=1500`, данные; «Связанные» — клик по ID открывает B; раскрыть строку «Задач», уйти на «Статусы» и вернуться — раскрыто; раскрыть поле в «Общих», уйти и вернуться — раскрыто (M-g); `?fail=tab:audit` — ошибка во вкладке, шапка жива; `#/rub-docs` — ED244 (XML), рублёвые счета и `SC_NCB_*` в статусах; тёмная тема — бейджи статусов, подсветка кода; заблокированная и неактивная записи, открытые в деталке, — полоса и фон метки (Д28); консоль без ошибок. Исполнитель этот шаг пропускает (правило контроллера, R14 плана `apps/pi`).
- [ ] **Step 9: проверка и commit.** `pnpm check` — зелёный.

```bash
git add apps/pi/src/pages/fx-docs/ui/detailDomain.ts apps/pi/src/pages/fx-docs/model/registry.model.ts apps/pi/src/pages/fx-docs/model/registry.model.test.ts apps/pi/src/pages/fx-docs/ui/FxDocsPage.tsx apps/pi/src/pages/fx-docs/index.ts apps/pi/src/pages/rub-docs/ui/detailDomain.ts apps/pi/src/pages/rub-docs/model/registry.model.ts apps/pi/src/pages/rub-docs/model/registry.model.test.ts apps/pi/src/pages/rub-docs/ui/RubDocsPage.tsx apps/pi/src/pages/rub-docs/index.ts apps/pi/src/app/details.a11y.test.tsx packages/ui/src/grid/Grid.module.css apps/pi/e2e/detail-tabs.spec.ts apps/pi/e2e/detail.spec.ts apps/pi/e2e/registry.spec.ts
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "apps/pi: вкладки деталки на страницах — виды doc-trail и «Доп. поля», ленивый tabFx, связанный документ в B; кит: метка открытой записи сильнее состояния (Д28); e2e вкладок против замера эталона"
```

---
### Task 13: Документы — `pi-api`, `pi-usage`, `detail-drift`, спеки, STATE, CHANGELOG

**Files:**
- Modify: `docs/reference/pi-api.md`, `docs/guides/pi-usage.md`, `docs/reference/detail-drift.md`, `apps/pi/README.md`, `docs/STATE.md`, `CHANGELOG.md`, `docs/superpowers/specs/2026-09-30-katran-detail-tabs-design.md`, `docs/superpowers/specs/2026-09-29-katran-detail-view-design.md`, `docs/superpowers/specs/2026-09-23-katran-design.md` (§3.1, §5.2, §11), `docs/superpowers/specs/2026-09-28-katran-pi-app-design.md` (§4, §5.2, §5.3, §9)
- Пути сверены с репо: `pi-usage.md` лежит в `docs/guides/`, а не в `docs/reference/`; журнал изменений кита — корневой `CHANGELOG.md` (раздел «0.1.0 — в работе»), отдельного `packages/ui/CHANGELOG.md` нет.

**Interfaces:**
- Consumes: подраздел `#### Для pi-api.md` из Task 7 этого плана (состав ответа каждой вкладки и примеры — из `TRAIL_EXAMPLES`); `FX_DETAIL_EXAMPLE` после Task 10 (если деталь валюты расширена референсами и `vd`); аннотации e2e Task 12 (`geometry`, `Д28`, `screenshots`) и сравнение скриншотов; раздел «2b» `detail-drift.md` (Task 1); ответы В-Д6 и R13 (спека 2b §1.3); итоговые решения Task 11 (п. 1–7) и Task 12.

- [ ] **Step 1: `docs/reference/pi-api.md`.**
  1. В §1 после 1.4 — новый подраздел:

```markdown
### 1.5. `GET /grids/{gridId}/documents/{id}/tabs/{tab}` (предложение)

В контракте `vtb-filters` не описан. Нужен деталке (срез 2b): данные одной вкладки документа. Фронт запрашивает вкладку лениво — когда пользователь её выбирает; повторный выбор, переключение между drawer'ами A и B и повторное открытие документа на том же экране не перезапрашивают (кэш по паре `id` + `tab` до ухода с экрана).

- `id` — как в 1.4 (кодируется в пути). `tab` — ключ вкладки из таблицы 7.4, кроме локальных `main` и `extra` (их данные приходят в детали, раздел 7): `statuses`, `compliance`, `linked`, `tasks`, `notif`, `source` (только `fx-docs`), `ed244` (только `rub-docs`), `stream`, `mpu`, `audit`. Тела запроса и query-параметров нет.
- `200` — данные вкладки, состав — раздел 8. Вкладка без данных — пустой массив или объект по форме раздела 8, и её ключ должен быть в `tabsOff` детали: фронт такую вкладку не показывает и не запрашивает.
- `404` — Problem Details: документа нет («Документ не найден») или вкладка не из набора этого грида — `source` у `rub-docs`, `ed244` у `fx-docs`, локальные `main`/`extra` («Неизвестная вкладка»); неизвестный `gridId` — тоже `404` («Неизвестный грид»). Заголовки — как у фейка; бек волен выбрать свои.
- Ошибки транспорта и `5xx` — фронт показывает текст ошибки внутри вкладки с кнопкой «Повторить»; шапка, лейн и другие вкладки документа работают.
```

  2. §7.1, пункт про `tabsOff` — дописать: «Вкладка в `tabsOff` ⇔ ответ раздела 8 для неё пуст; фейк считает `tabsOff` по тем же данным, что отдаёт на `…/tabs/{tab}`».
  3. §7.2 — если Task 10 расширил `FxDocDetail` (референсы Вх/Исх, связанный reference, UETR, даты валютирования `vd`), добавить строки новых полей в таблицу «Поле · Тип · Обязательно · Пример» по `apps/pi/src/entities/fx-doc/model/detail.ts`, пример — из `FX_DETAIL_EXAMPLE`; пример §7.5 `fx-docs` заменить на актуальный `FX_DETAIL_EXAMPLE` дословно в JSON.
  4. §7.4 — первый абзац («В срезе 2a содержимое есть только у «Общих данных»…») заменить на: «С среза 2b содержимое есть у всех вкладок. `main` и `extra` — локальные: их данные — в детали (разделы 7.2–7.3). Остальные грузятся по одной запросом 1.5, состав — раздел 8.» В таблицу — колонка «Откуда данные»: `main`, `extra` — «деталь (раздел 7)»; остальные — «`…/tabs/{tab}` (раздел 8)».
  5. Новый раздел **«8. Вкладки документа (предложение)»** в конец файла. Вводный абзац:

```markdown
## 8. Вкладки документа (предложение)

Ответ `GET /grids/{gridId}/documents/{id}/tabs/{tab}` (раздел 1.5). Состав общий для `fx-docs` и `rub-docs` — история обработки документа (сущность `apps/pi/src/entities/doc-trail`); различаются данные: у рубля суммы в `RUB`, рублёвые счета, сценарии `SC_NCB_*`, ED244 вместо исходного SWIFT. Имена полей бека живут только в мапперах `apps/pi/src/entities/doc-trail/api/trail.mapper.ts` (`TRAIL_PARSERS`): бек отдаёт вкладку иначе — правится маппер, виды не трогаются. Примеры ниже — `TRAIL_EXAMPLES` (`api/trail.example.ts`) дословно; разбор проверяется тестом `api/trail.mapper.test.ts`.
```

     Далее — подраздел `#### Для pi-api.md` из Task 7 плана `docs/superpowers/plans/2026-09-30-katran-detail-tabs.md` **дословно**, с заменой уровней заголовков на `### 8.K. …` (по одному подразделу на вкладку: `statuses`, `compliance`, `linked`, `tasks`, `notif`, `source` / `ed244`, `stream`, `mpu`, `audit`, в этом порядке) и с таблицами полей и JSON-примерами как там. Если Task 7 при исполнении поменял форму (ревью, фикс-раунды) — источник истины `apps/pi/src/entities/doc-trail/model/types.ts` и `api/trail.example.ts`: таблицы и примеры сверяются с ними, а не с текстом плана.
  6. §6 «Что не проверяет фейковый сервер» — пункт: «Вкладки (`…/tabs/{tab}`, раздел 8) строятся детерминированно по `id` документа из общих словарей стенда (`apps/pi/src/app/fake/trail.data.ts`, `fx-docs.trail.ts`, `rub-docs.trail.ts`); `tabsOff` детали считается по тем же генераторам; метод запроса не проверяется. Регуляторы `?fail=tab` (500 на любой вкладке) и `?fail=tab:<id>` (только на одной) — только у фейка».
  Run: `for t in statuses compliance linked tasks notif source ed244 stream mpu audit; do grep -q "### 8\..*\`$t\`" docs/reference/pi-api.md || echo "нет раздела 8 для $t"; done`
  Expected: пусто (у каждой нелокальной вкладки — свой подраздел 8.K с ключом в заголовке).
- [ ] **Step 2: `docs/guides/pi-usage.md`.**
  1. §13, второй абзац («В 2a содержимое есть только у вкладки «Общие данные»…») заменить: «С среза 2b все вкладки показывают содержимое: «Общие данные» и «Доп. поля» (валюта) — из детали, остальные грузятся лениво отдельным запросом (`GET …/documents/{id}/tabs/{tab}`, `pi-api.md` §1.5 и §8). Связанный документ открывается по клику на его ID в drawer B. Кнопки вкладок и действия лейна — заглушки до 2d (раздел 13.5)». Ссылку на спеку дополнить: «2b — `docs/superpowers/specs/2026-09-30-katran-detail-tabs-design.md`».
  2. §13.0 — таблица «Файл · Что поменялось» дополняется строками 2b: `shared/api/ports.ts` — `parseTab` в `createGridPorts`, порт `tabFx`, типы `TabQuery`, `TabParser`, `TabPort`; `shared/lib/detail/*` — `TabContext`, `TabView`, `LocalTabView`, `RemoteTabView`, `remoteTab`, `DetailDomain.tabViews`; `entities/fx-doc/api/ports.ts`, `entities/rub-doc/api/ports.ts` — `parseTab` из `TRAIL_PARSERS` по набору вкладок реестра; `entities/fx-doc` — `ExtraTab`, `fxExtraView` (и поля детали, если расширялась); `widgets/doc-detail/*` — `tabFx`, `localTabs`, `retryTab`, `$expanded`, `setExpanded`, виды вкладок; `pages/*/model/registry.model.ts` — `FX_LOCAL_TABS`/`RUB_LOCAL_TABS`, `tabFx` в `createDetail`; `pages/*/ui/detailDomain.ts` (новый) и `pages/*/ui/*Page.tsx` — домен с `tabViews`. Абзац «Новые папки — целиком» — `entities/doc-trail/` (с `@x/fx-doc.ts`, `@x/rub-doc.ts`); «Кит нужен свежий» — дополнить новыми компонентами 2b: `MiniTable`, `StatusBadge`, `Timestamp`, `KeyValueList`, `CodeView`, `formatTimestamp`, `formatDuration`, `Tag` `mono`, `ConfigForm` `expanded`/`onExpandedChange`.
  3. §13.1 — таблица «Где · Что»: строка `widgets/doc-detail` дополняется ленивыми вкладками (кэш `id:tab`, свои скелетон/ошибка/«Повторить», раскрытие по документу в `$expanded`); новая строка `entities/doc-trail` — «история обработки документа, общая для обоих реестров: типы вкладок, `toneOf`, мапперы `TRAIL_PARSERS`, примеры `TRAIL_EXAMPLES`, виды `TRAIL_VIEWS` (Статусы, Комплаенс, Связанные, Задачи, Нотификации, Исходный текст / ED244, Стриминг, MPU, Аудит); соседям — `TRAIL_PARSERS` через `@x`»; строка `shared/lib/detail` — `TabContext`, `TabView`, `remoteTab`. Блок кода `DetailConfig`/`DetailSlot`/`Detail` заменить на актуальный из `apps/pi/src/widgets/doc-detail/lib/createDetail.ts` (поля `tabFx`, `localTabs`, `tabView`, `retryTab`, `$expanded`, `setExpanded`, `$quiet`, `open: EventCallable<DrawerOpen>`). Список компонентов кита — дополнить блоками 2b.
  4. §13.2 — код модели страницы заменить на актуальный из `apps/pi/src/pages/fx-docs/model/registry.model.ts` (с `FX_LOCAL_TABS` и `tabFx`), код экрана — на актуальный `FxDocsPage.tsx`, плюс код `apps/pi/src/pages/fx-docs/ui/detailDomain.ts` целиком с одной фразой: «Виды вкладок собирает страница: она видит и `fx-doc`, и `doc-trail`».
  5. Новый подраздел **«13.7. Как добавить вкладку»** перед «Зависимости»:

````markdown
### 13.7. Как добавить вкладку

1. **Данные.** Общая для обоих реестров (история обработки) — в `entities/doc-trail`: тип в `model/types.ts`, маппер в `api/trail.mapper.ts` и ключ в `TRAIL_PARSERS`, пример ответа в `api/trail.example.ts` (`TRAIL_EXAMPLES`) и тест маппера на нём. Своя для одного реестра — те же три файла в его сущности. Локальная вкладка (данные в детали) — поля в типе детали и её маппере, парсер вкладки не нужен.
2. **Вид.** Нелокальная — `remoteTab<T>({ render: (data, ctx) => …, skeletonRows })` (`shared/lib/detail`): `data` — уже разобранный маппером ответ, `ctx` — `docId`, `openDocument(id)` (открыть в B), `announce(text)`, `expanded`/`setExpanded` (раскрытое переживает переключение вкладок; `null` — ещё не трогали, берите свои умолчания). Локальная — `{ kind: 'local', render: (detail, ctx) => … }`. Блоки — из кита: `MiniTable`, `KeyValueList`, `CodeView`, `StatusBadge`, `Timestamp`, `Disclosure`, `EmptyState`.
3. **Набор вкладок.** Ключ и подпись — в `FX_TABS` / `RUB_TABS` (порядок полосы фиксированный); ключ — в `tabsOff` детали, когда данных нет.
4. **Подключение.** Парсер — в `parseTab` порта сущности (`entities/*/api/ports.ts`); вид — в `tabViews` домена страницы (`pages/*/ui/detailDomain.ts`); локальная — ещё и в `FX_LOCAL_TABS` / `RUB_LOCAL_TABS` модели страницы. Тесты страницы (`pages/*/model/registry.model.test.ts`) проверяют, что у каждой вкладки набора есть вид нужного вида и парсер в порту.
5. **Проверка.** Тест маппера на примере; `app/details.a11y.test.tsx` сам проходит новую вкладку под axe; контрактный тест `…/tabs/{tab}` своего бека — по образцу блоков вкладок в `apps/pi/src/app/fake/contract.test.ts`.

```ts
// entities/doc-trail/ui/views.ts — так устроены готовые виды
export const TRAIL_VIEWS: Record<TrailTabId, RemoteTabView> = {
  statuses: remoteTab<StatusEvent[]>({ render: (data) => <StatusesTab events={data} /> }),
  // …
}
```
````

     Пример кода в пункте — сверить с фактическим `apps/pi/src/entities/doc-trail/ui/views.ts` (Task 9) и взять оттуда одну строку дословно.
  6. §13.6 — пункт e2e дополнить: «`apps/pi/e2e/detail-tabs.spec.ts` — высоты строк вкладок против эталона ± 2 (таблица 24, шапка 22, «ключ–значение» 24, раскрываемая строка 26), «Связанный» → B, ошибка вкладки и «Повторить», кэш вкладок, `?hostile`». Пункт «Контрактный тест» — блоки вкладок (`…/tabs/{tab}`: 200, 404, 500 по `?fail=tab` и `?fail=tab:<id>`).
  7. §10, чек-лист — пункт: «[ ] Вкладки деталки открываются, `GET …/documents/{id}/tabs/{tab}` вашего бека проходит контрактный тест; `tabsOff` детали совпадает с пустотой вкладок»; в пункте про регуляторы — `?fail=tab` и `?fail=tab:<id>`.
- [ ] **Step 3: `apps/pi/README.md`.** В таблицу регуляторов после `?fail=detail` — строки: «`?fail=tab` | любая вкладка деталки (`GET …/documents/{id}/tabs/{tab}`) отвечает `500` — ошибка внутри вкладки с «Повторить», шапка и другие вкладки работают» и «`?fail=tab:<id>` | `500` только на вкладке `<id>` (`?fail=tab:audit`)».
- [ ] **Step 4: `docs/reference/detail-drift.md`.** Раздел «2b» (создан Task 1):
  1. Таблица сверки — у каждого пункта колонка «katran» из плана в факт: «сделано в Task N (`<коммит>`)» или класс с описанием; итоговые классы — A (совпадает), B (решение владельца — В-Д6 «а», R13 «закрывает деталку»), C (намеренное: чистые данные рубля; `tabsOff` по данным; задержка с воротами 400 мс вместо 700; состояние ошибки вкладки; «Связанный» открывается в B; вкладка из `tabsOff` не рендерится ни при каких условиях — спека 2b §6), D (расхождение вида с предложением) — для каждого пункта ровно один класс.
  2. «Замер эталона» 2b — колонка «кит (e2e Task 12)» с числами аннотаций `geometry` обоих реестров и `?hostile` (шапка таблицы, строка, «ключ–значение», раскрываемая строка); разница с эталоном — отдельной колонкой.
  3. Скриншоты Task 12 Step 7 против скриншотов эталона Task 1 — расхождения вида новыми строками класса D с предложением; совпавшие вкладки перечислить одной строкой «сверено глазами: …».
  4. Д28 (раздел 2a) — класс D → «сделано в Task 12 (`<коммит>`), e2e `detail-tabs.spec.ts` «Д28»: полоса `val`, фон `val-soft`, без штриховки» с вычисленными значениями из аннотации `Д28`.
  5. «Вопросы владельцу» — В-Д6 и R13: ответы с датой 30.09.2026 (спека 2b §1.3); Д29 — класс C по В-Д6 «а».
- [ ] **Step 5: спеки.**
  - `docs/superpowers/specs/2026-09-30-katran-detail-tabs-design.md`: в шапке «Статус: …» заменить на «Статус: **исполнено** планом `docs/superpowers/plans/2026-09-30-katran-detail-tabs.md` (<дата слияния>); согласовано с владельцем по разделам 30.09 (…прежний текст решений…)». В §3.3 — абзац «Уточнено при исполнении (план 2b, Task 11)»: вкладка грузится независимо от детали (эндпоинт самостоятелен; вкладку, выбранную до загрузки и оказавшуюся в `tabsOff`, `DocDetail` переводит на «Общие» — техдолг M-f закрыт); триггер — смена записи слота (`setTab`, сдвиг B в A), открытие всегда на «Общих»; `retryTab(slot)` вместо `retryTab({ slot, tab })` — повторяется активная вкладка слота; `tabViews` — объекты `TabView` (`local`/`remote`, `remoteTab`) вместо функций, `ctx` — `docId`, `openDocument`, `announce`, `expanded`, `setExpanded`; повторный выбор вкладки с ошибкой — новый запрос; раскрытие — `$expanded` по ключу `id:tab`, у «Общих» — управляемый `ConfigForm` (техдолг M-g закрыт). В §3.4 — «виды собирает страница (`pages/*/ui/detailDomain.ts`), `localTabs` — константы моделей страниц». В §5 — «e2e без сети: фейк внутри страницы, отсутствие перезапроса проверяется взведённым `?fail=tab`».
  - `docs/superpowers/specs/2026-09-29-katran-detail-view-design.md`: §1.1, пункт вкладок — «остальные — срез 2b (исполнен, спека `2026-09-30-katran-detail-tabs-design.md`)»; §4.3 — после описания `createDetail` одна фраза «расширен в 2b: `tabFx`, `localTabs`, `tabView`, `retryTab`, `$expanded`».
  - `docs/superpowers/specs/2026-09-23-katran-design.md`: §3.1 (перечень модулей `@katran/ui`) — модули `table` (`MiniTable`), `code` (`CodeView`); в `value` — `StatusBadge`, `Timestamp` (`Tag mono` спеки — существующий `Tag tone="mt"`); в `form` — `KeyValueList`, `ConfigForm` с управляемым раскрытием; в `format` — `formatTimestamp`, `formatDuration`. §5.2 — после абзаца про 2a: «**2b исполнен** (вкладки): `MiniTable` (строка 24, шапка 22, раскрываемая 26), `StatusBadge`, `Timestamp`, `KeyValueList` (строка 24), `CodeView` (JSON, SWIFT, XML — подсветка React-элементами, без `innerHTML`), форматтеры времени; в `apps/pi` — сущность `doc-trail`, ленивый эндпоинт вкладок (предложение)». §11 — строка «2b–2d»: «2b — исполнен (спека `2026-09-30-katran-detail-tabs-design.md`, план `2026-09-30-katran-detail-tabs.md`); 2c, 2d — впереди».
  - `docs/superpowers/specs/2026-09-28-katran-pi-app-design.md`: §4 (раскладка) — `entities/doc-trail` (соседям — `@x/fx-doc.ts`, `@x/rub-doc.ts`), `pages/*/ui/detailDomain.ts`; §5.2 — порты сущностей получают `parseTab` и `tabFx`; §5.3 — маршрут `…/tabs/{tab}` фейка, регуляторы `?fail=tab`, `?fail=tab:<id>`, `tabsOff` по данным; §9 — `pi-usage.md` §13.7 и `pi-api.md` §1.5, §8.
- [ ] **Step 6: `docs/STATE.md`.**
  - §1 — строка о возможностях `apps/pi`: деталка на просмотр со всеми вкладками (срезы 2a, 2b).
  - §5 «Карта проекта»: `packages/ui/src` — `value/` + `StatusBadge`, `Timestamp`; `form/` + `KeyValueList`, `ConfigForm` с `expanded`; новые `table/ (MiniTable — срез 2b)`, `code/ (CodeView, токенизаторы json/swift/xml — срез 2b)`; `format/` — `formatTimestamp`, `formatDuration`. `apps/pi/src` — `widgets/doc-detail` (… + ленивые вкладки, кэш `id:tab`, раскрытие по документу; срез 2b), `entities/doc-trail` (история обработки: типы, `toneOf`, `TRAIL_PARSERS`, `TRAIL_EXAMPLES`, `TRAIL_VIEWS`; соседям через `@x`; срез 2b), `entities/fx-doc` — `ExtraTab`, `pages/*/ui/detailDomain.ts`, `shared/api` — `createGridPorts` с `parseTab`, `shared/lib/detail` — `TabContext`, `TabView`, `remoteTab`, фейк — `trail.data.ts`, `fx-docs.trail.ts`, `rub-docs.trail.ts`. `apps/pi/e2e` — `detail-tabs.spec.ts` (высоты вкладок против эталона, «Связанный» → B, `?fail=tab:audit`, кэш, `?hostile`, Д28, скриншоты; срез 2b). `docs/reference` — `pi-api.md` §1.5, §8; `detail-drift.md` раздел «2b». Список исполненных планов — + «2b «вкладки деталки»».
  - §6 «Состояние»: новый пункт «**План 2b «Остальные вкладки деталки» исполнен целиком**, ветка `feat/detail-tabs` (worktree `katran/.worktrees/detail-tabs`, от `main` `f08e522`), спека — `docs/superpowers/specs/2026-09-30-katran-detail-tabs-design.md`, план — `docs/superpowers/plans/2026-09-30-katran-detail-tabs.md`, 14 задач (0–13). Проверки: `pnpm check` зелёный, тестов <число из вывода `pnpm test` по пакетам: tokens, ui, effector, pi>, e2e 50/50.» Пункт «Открытые решения владельца (30.09): В-Д6 … R13 …» — удалить (решения приняты, спека 2b §1.3; фиксируются в §7 и `detail-drift.md`).
  - §7 «Техдолг»: заголовок — «Техдолг (после плана 2b)». Удалить: из пункта «Объём среза, не дефекты» — «вкладки кроме «Общих данных» — состояние «будет в срезе 2b»»; из пункта «Сверка, класс D» — Д28; из пункта «Esc и наложения» — фразу про Esc в гриде при открытой деталке (R13): решение владельца «закрывает деталку, как сейчас» переносится одной строкой в §3 «Архитектурные решения» или в `detail-drift.md` «Вопросы владельцу» (уже сделано Step 4.5); из пункта «`Tabs` с переполнением» — «вкладка из `tabsOff`, выбранная до загрузки, остаётся выбранной после (финальное ревью M-f)» и «`TabPanel` сбрасывает раскрытие полей при переключении вкладок (M-g)»; из пункта «`createDetail`» — «нет теста минимальной длительности скелетона в виджете (M4)» (закрыт тестом скелетона вкладки, Task 11). Добавить: «Кнопки вкладок («Переотправить», «Перейти в блок «Ручные отклонения»», «История», «Исходное сообщение») — заглушки с `announce` до 2d»; «Связанный документ другого реестра не открывается — межреестровая навигация вне 2b (спека 2b §8)»; «Эндпоинт вкладок — предложение владельцу контракта `vtb-filters`, форма ответа — черновик до согласования»; «Вкладка без вида, но не в `localTabs`, запрашивается впустую (виджет не знает видов в модели; для `fx`/`rub` недостижимо — полноту проверяют тесты страниц)»; техдолг из ревью задач 2–12 (леджер SDD) — по пункту на находку уровня M.
  - §9 «Следующий шаг»: «**Срез 2b «Остальные вкладки деталки» слит в `main`** (`<коммит слияния>`, <дата>). Следующий — **срез 2c: правка** (правка полей, аудит поля, саджест, `Prompt`, `DateInput`, перезапрос реестра после действий): brainstorming → спека-дельта → план → subagent-driven-development; первая задача плана — сверка правки против того же замороженного эталона `e065bfb` (`detail-drift.md`, раздел «2c»). Готово для него: раскрытие и состояние вкладок в модели (`$expanded`), `ConfigForm` с управляемым раскрытием, `FieldDef.kind` `party`/`bank` и `FieldDef.width` ждут правки (§7).»
  - §10 — ссылка на `detail-drift.md` раздел «2b» с итогом сверки (число пунктов по классам).
- [ ] **Step 7: `CHANGELOG.md`.** В «0.1.0 — в работе» — пункт:

```markdown
- Срез 2b «Остальные вкладки деталки» (`@katran/ui`): **добавлено** — модуль `table`: `MiniTable` (колонки с шириной в px при плотности 1, `numbered`, пустое состояние, раскрываемые строки мышью и Enter/Space с `aria-expanded`, клик по ссылке или кнопке внутри строки её не раскрывает, управляемое `expanded`/`onExpandedChange` или `defaultExpanded`, полоса `toolbar`); модуль `code`: `CodeView` (JSON, SWIFT, XML; подсветка — React-элементы из токенов, без `innerHTML`; XML — отступ по глубине, атрибуты в строку до 92 символов, номера строк вне копирования и скринридера, битый XML — сырой текст; фокусируемая область с прокруткой клавиатурой); `StatusBadge` (`ok`/`bad`/`wait`/`neutral`), `Timestamp` (время с приглушёнными миллисекундами, полное — тултипом), `KeyValueList` (группа «ключ–значение», пустое — «—», для скринридера «не заполнено», одна или две колонки); форматтеры `formatTimestamp`, `formatDuration`; `Tag` — вариант `mono`; новые токены высот строк и шрифта кода. **Изменено** — `ConfigForm`: управляемое раскрытие `expanded`/`onExpandedChange` (без пропсов — как раньше); `DataGrid`: метка открытой в деталке записи сильнее состояния — у заблокированной и неактивной записи полоса и фон метки не приглушаются и не штрихуются (Д28). `apps/pi`: все вкладки деталки валюты и рубля с ленивой загрузкой по вкладке (`GET /grids/{gridId}/documents/{id}/tabs/{tab}` — предложение в контракт), сущность `doc-trail`, связанный документ открывается в B, фейк вкладок и `?fail=tab`, `?fail=tab:<id>`.
```

  Названия и составы сверить с фактическими экспортами `packages/ui/src/index.ts` (Task 2–5): чего нет в экспорте — в пункт не писать.
- [ ] **Step 8: проверка `pi-usage.md` «с нуля» — делает контроллер.** Свежий субагент получает только `docs/guides/pi-usage.md` и репозиторий и отвечает: как добавить вкладку, что править, если бек отдаёт вкладку иначе, как проверить. Неясности — фикс-раундом этой задачи. Исполнитель субагентов не запускает (правило контроллера, R18 плана `apps/pi`).
- [ ] **Step 9: проверка и commit.**
  Run: `grep -rn "будет в срезе 2b" docs apps/pi/src apps/pi/e2e` — пусто (кроме исторических планов 2a в `docs/superpowers/plans/`, их не править).
  Run: `pnpm check` — зелёный.

```bash
git add docs/reference/pi-api.md docs/guides/pi-usage.md docs/reference/detail-drift.md apps/pi/README.md docs/STATE.md CHANGELOG.md docs/superpowers/specs/2026-09-30-katran-detail-tabs-design.md docs/superpowers/specs/2026-09-29-katran-detail-view-design.md docs/superpowers/specs/2026-09-23-katran-design.md docs/superpowers/specs/2026-09-28-katran-pi-app-design.md
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "Документы среза 2b: эндпоинт и состав вкладок в pi-api (предложение), «как добавить вкладку» в pi-usage, итог сверки 2b, спеки, состояние, CHANGELOG"
```

---

## Порядок и зависимости

Task 0 → 1 → (2, 3, 4, 5 — кит) и (6 → 7 — шов данных) → 8 → 9 → 10 → 11 → 12 → 13. Нумерация — порядок спеки §7; фактические зависимости:

| Задача | Ждёт | Почему |
|---|---|---|
| 0 | — | предусловия: 2a в `main`, `pnpm check` зелёный, worktree `feat/detail-tabs` |
| 1 | 0 | замер эталона и раздел «2b» `detail-drift.md` — числа для `REF` Task 12 и токенов 3–5 |
| 2, 3, 4, 5 | 0–1 | блоки кита друг от друга не зависят; высоты строк — из замера Task 1. Общий `packages/ui/src/index.ts` и `tokens.src.ts` (3, 4, 5) — выполнять по очереди, не параллельно, чтобы не конфликтовать |
| 6 | 0 | `tabFx`, `parseTab`, типы `TabContext`/`TabView`, маршрут фейка — кита не требуют |
| 7 | 6 | мапперы на `TabParser`, данные фейка на маршруте Task 6, `BadgeTone` — тип (Task 2 желательна раньше; если нет — `toneOf` ждёт Task 2) |
| 8 | 2, 3, 4, 7 | виды «Статусы», «Комплаенс», «Задачи», «Нотификации», «Стриминг» — на `MiniTable`, `KeyValueList`, `StatusBadge`, `Timestamp` и типах Task 7 |
| 9 | 5, 8 | «Связанные», MPU, «Аудит», «Исходный текст» — на `CodeView`; `TRAIL_VIEWS` собирается из видов 8 и 9 |
| 10 | 4, 6 | `ExtraTab` на `KeyValueList`; `fxExtraView` — `LocalTabView` Task 6; `parseTab` в портах сущностей — `TRAIL_PARSERS` Task 7 (значит, фактически и после 7) |
| 11 | 4, 6 | модель и `DocDetail` — на типах Task 6; `ConfigForm` `expanded`/`onExpandedChange` (M-g) — Task 4. Сущностей не импортирует — от 7–10 не зависит |
| 12 | 8, 9, 10, 11 | страницы собирают `TRAIL_VIEWS` и `fxExtraView`, `tabFx` портов (Task 10) и `createDetail` Task 11; e2e — на данных фейка Task 7 и числах Task 1 |
| 13 | все | примеры `pi-api` из Task 7 (и 10), числа и скриншоты e2e из Task 12, итоговые решения 11–12 |

- Стоп-точек владельца нет: В-Д6 и R13 решены 30.09 (спека 2b §1.3).
- `pnpm check` зелёный после каждой задачи; e2e (`pnpm --filter pi e2e`) — только в Task 12 и только на переднем плане. Task 11 меняет заглушку «будет в срезе 2b», на которую смотрит e2e 2a (`detail.spec.ts`), — правка сценария в Task 12 Step 5; между 11 и 12 e2e не запускать.
- Пока идёт кит (2–5), шов данных (6–7) можно вести параллельно в отдельной сессии: общих файлов у них нет.

## Сквозные имена (самопроверка плана)

| Имя | Вводит | Потребляют |
|---|---|---|
| `formatTimestamp`, `formatDuration`, `TimestampParts` (`format`) | Task 2 | Task 8, 9 |
| `Timestamp`, `TimestampProps`, `StatusBadge`, `StatusBadgeProps`, `BadgeTone`, `Tag` `mono` (`value`) | Task 2 | Task 7 (`toneOf` → `BadgeTone`), 8, 9, 13 (CHANGELOG) |
| `MiniTable`, `MiniTableProps`, `MiniColumn` (модуль `table`), роли `table`/`row`/`columnheader`/`cell`, `aria-expanded` у раскрываемой строки; токены строки 24, шапки 22, раскрываемой 26 | Task 3 | Task 8, 9, 12 (e2e по ролям), 13 |
| `KeyValueList`, `KeyValueListProps`, `KeyValueItem` (`form`); токен строки 24; строка — `[data-kv]` | Task 4 | Task 8, 9, 10, 12 (e2e) |
| `ConfigFormProps.expanded`, `ConfigFormProps.onExpandedChange` | Task 4 | Task 11 (M-g) |
| `Disclosure` `mono`, `emptyText` | Task 4 | Task 9 (аккордеоны «Исходного текста», «Аудита») |
| `CodeView`, `CodeViewProps`, `CodeLanguage` (модуль `code`); внутренние `tokenizeJson`, `tokenizeSwift`, `layoutXml`, `CodeToken`, `CodeLine` | Task 5 | Task 9 (`CodeView`); внутренние — только тесты Task 5 |
| `TabQuery`, `TabParser`, `TabPort`, `createGridPorts({ …, parseTab })`, `tabFx` | Task 6 | Task 7 (`TRAIL_PARSERS: Record<TrailTabId, TabParser>`), 10 (порты сущностей), 11 (`DetailConfig.tabFx`), 12 (`fxDocPorts.tabFx`, `rubDocPorts.tabFx`, тесты портов) |
| `TabContext` (`docId`, `openDocument`, `announce`, `expanded`, `setExpanded`), `LocalTabView`, `RemoteTabView`, `TabView`, `remoteTab`, `DetailDomain.tabViews` | Task 6 | Task 8, 9 (виды), 10 (`fxExtraView`), 11 (`DocDetail` строит `ctx`), 12 (домены страниц) |
| маршрут фейка `GET /grids/{gridId}/documents/{id}/tabs/{tab}`, `?fail=tab`, `?fail=tab:<id>` | Task 6 | Task 7 (данные), 12 (e2e), 13 (`pi-api`, README) |
| `StatusEvent`, `Compliance`, `LinkedDoc`, `LinkedParty`, `LinkedPosting`, `DocTask`, `DocNotification`, `StreamEvent`, `MpuMessage`, `AuditSections`, `SourceTexts`, `TrailTabId`, `toneOf` | Task 7 | Task 8, 9, 12 (`TrailTabId` в `detailDomain.ts`) |
| `TRAIL_PARSERS` (`api/trail.mapper.ts`), `@x/fx-doc.ts`, `@x/rub-doc.ts` сущности `doc-trail` | Task 7 | Task 10 (`parseTab` портов), 12 (проверка портов тестами страниц) |
| `TRAIL_EXAMPLES`, подраздел `#### Для pi-api.md` | Task 7 | Task 7 (тесты мапперов, контрактные), 13 (`pi-api.md` §8) |
| `trail.data.ts`, `fx-docs.trail.ts`, `rub-docs.trail.ts`; `tabsOff` ⇔ пустые данные | Task 7 | Task 12 (a11y на данных фейка, e2e) |
| `StatusesTab`, `ComplianceTab`, `TasksTab`, `NotificationsTab`, `StreamTab` | Task 8 | Task 9 (`TRAIL_VIEWS`) |
| `LinkedTab`, `MpuTab`, `AuditTab`, `SourceTab`, `TRAIL_VIEWS`; кнопка «Открыть … в соседней панели» | Task 9 | Task 12 (домены страниц, e2e «Связанный» → B) |
| `ExtraTab`, `fxExtraView` | Task 10 | Task 12 |
| `DetailConfig.tabFx`, `DetailConfig.localTabs`, `TabSlot`, `DetailSlot.tabView`, `Detail.retryTab`, `Detail.$expanded`, `Detail.setExpanded`; `data-part="tab-skeleton"` (`data-rows`), «Не удалось загрузить вкладку», «Вкладка «…» не подключена» | Task 11 | Task 12 (модели страниц, a11y, e2e), 13 (`pi-usage`, спека) |
| `FX_LOCAL_TABS`, `RUB_LOCAL_TABS`, `fxDetailDomain`, `rubDetailDomain` (`pages/*/index.ts`) | Task 12 | Task 12 (`app/details.a11y.test.tsx`), 13 (`pi-usage` §13.2, §13.7) |
| Д28: `.record[data-state]:not([data-mark])`, `.record[data-state='inactive']:not([data-mark])` | Task 12 | Task 13 (`detail-drift.md`, CHANGELOG) |
| `REF` вкладок (шапка 22, строка 24, «ключ–значение» 24, раскрываемая 26) | Task 1 (замер) | Task 3, 4 (токены), 12 (e2e), 13 (`detail-drift.md`) |

## Покрытие спеки

| Спека 2b | Задачи |
|---|---|
| §1.1 все вкладки валюты и рубля (Доп. поля, Статусы, Комплаенс, Связанные, Задачи, Нотификации, Исходный текст / ED244, Стриминг, MPU, Аудит), порядок и наборы `FX_TABS`/`RUB_TABS`, без сортировки и поиска | 8, 9, 10 (виды), 12 (сборка `tabViews`, полнота — тесты страниц, a11y каждой вкладки, скриншоты) |
| §1.2 вне среза (правка, настоящие действия, межреестровые ссылки) | 13 (STATE §7 — техдолг, §9 — следующий 2c) |
| §1.3 решения владельца: В-Д6 «а», R13, ленивая загрузка, чистые данные, заглушки кнопок и ID → B | 1 (`detail-drift.md`), 7 (данные), 8–9 (заглушки, ID), 11 (ленивая загрузка), 12 (B, e2e), 13 (STATE, спеки) |
| §2 кит: `MiniTable` | 3 |
| §2 `StatusBadge`, `Timestamp`, `Tag mono` (= `Tag tone="mt"`), `formatTimestamp`, `formatDuration`, `timestampDiff` | 2 |
| §2 `KeyValueList` (и управляемое раскрытие `ConfigForm`) | 4 |
| §2 `CodeView` (JSON, SWIFT, XML, без `innerHTML`) | 5 |
| §2 Д28 — `:not([data-mark])` в `Grid.module.css` | 12 |
| §3.1 эндпоинт — предложение, локальные `main`/`extra`, `tabsOff` в детали, порт `tabFx` с `parseTab` | 6 (порт, фейк), 10 (порты сущностей, расширение детали), 12 (тесты портов), 13 (`pi-api.md` §1.5, §8) |
| §3.2 сущность `doc-trail` (model, api, ui), `SourceTab` на `source`/`ed244`, пустые состояния эталона; `ExtraTab` в `fx-doc` | 7, 8, 9, 10 |
| §3.3 `createDetail` (`tabFx`, `localTabs`, кэш `id:tab`, счётчик визитов, `retryTab`, `pageClosed`), раскрытие в модели (M-g), `DocDetail` с `tabViews`, `ctx`, скелетон ≥ 400 мс, ошибка с «Повторить», без импорта `entities` | 11 (и M-f там же) |
| §3.4 страницы: `tabViews`, `tabFx`, «Связанный» → B, уже открытый — фокус | 12 |
| §3.5 фейк: детерминированно по `id`, рубль со своими данными, «Связанные» — на документы того же реестра, `tabsOff` по данным, `?fail=tab`, `?fail=tab:<id>` | 6, 7 |
| §4 поведение: раскрываемые строки мышью и клавиатурой, аккордеоны, заглушки `announce`, ID → B + `CopyValue`, обрезка длинного текста с тултипом, Esc не перехватывается в `CodeView`, геометрия 2a | 3, 4, 5 (кит), 8, 9 (виды), 11 (`ctx.announce`, `openDocument`), 12 (e2e) |
| §5 проверки: кит (тесты, axe), `apps/pi` (мапперы на примерах, порт → фейк 200/404/500, `createDetail`, axe каждого вида на данных валюты и рубля, `tabsOff` ⇔ пустота), e2e (высоты ± 2, B, ошибка и «Повторить», без перезапроса, `?hostile`, скриншоты), `check:target`, React 17 | 2–5, 6, 7, 8, 9, 10, 11, 12 (`pnpm check` в каждой) |
| §6 сверка: раздел «2b» `detail-drift.md`, известные классы C | 1 (замер, пункты), 13 (итоговые классы, числа e2e, скриншоты) |
| §7 порядок 0–13 | весь план |
| §8 открытые вопросы (эндпоинт — предложение; межреестровые ссылки) | 13 (`pi-api.md` — пометка «предложение», STATE §7) |
