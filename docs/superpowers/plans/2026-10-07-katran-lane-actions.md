# Срез 2d «Действия лейна и вторая рука» в `apps/pi`: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** кнопки лейна деталки работают по-настоящему: «Обновить» (и F5), «Скопировать ссылку» (и открытие по `?doc=`), «Скачать» сообщение, «Печать» формы в PDF во вкладке; «вторая рука» утверждает или отклоняет (с причиной) чужую ожидающую правку валютного документа; «Редактировать» из лейна убран.

**Architecture:** кит получает расширения `Prompt` (тело, блокировка, занятость, ошибка), `EditHistory`/`EditMark`/`EditStatus` (`rejected`, кнопки решения) и `Drawer.onKeyDown`. В `apps/pi`: файловый транспорт `requestFileFx` и порты в `shared/api`; «вторая рука» — расширение `features/doc-edit` (тот же `docEdited`/`conflict`, что у правки); новая фича `features/doc-actions` (Обновить, ссылка, скачать, печать) с видом `ActionsView` в `shared/lib/detail` — виджет фичу не импортирует; `createDetail.refreshDoc`; страницы связывают всё и принимают `docLinkOpened`. Фейк отвечает на решения, отдаёт текст сообщения и минимальный PDF.

**Tech Stack:** pnpm-монорепо, React 17.0.2, effector 23.4, effector-react, Vite 8, Vitest 5 + jsdom + Testing Library 12 + jest-axe, Playwright 1.63, eslint (`import-x`, `jsx-a11y`, `react-hooks`), stylelint.

**Spec:** `docs/superpowers/specs/2026-10-07-katran-lane-actions-design.md` (утверждена владельцем 07.10; решение по §8 п. 1 — поле `reason` остаётся). Эталон — `/Users/shaman/_CODE/VTB/pi-constructor`, коммит `e065bfb` (`grid.html`: `ACTIONS` 919–928, клик по `.dw` 1598–1640, печать 1602–1608, история правки 1160–1170; то же в `rub-grid.html` около 907). Образец плана — `docs/superpowers/plans/2026-10-06-katran-detail-edit.md` (2c).

## Global Constraints

- Предусловие: `main` содержит `ed60d29` (спека 2d); `pnpm check` зелёный (Task 0). Работа — в worktree `katran/.worktrees/lane-actions`, ветка `feat/lane-actions` от `main`.
- Среда внутри: **React 17.0.2**, effector 23.4, **Chromium 88**. Legacy `render`, без `createRoot`, `useId` (замена — `useStableId`), `useSyncExternalStore`; без `.at`, `Object.hasOwn`, `findLast`, `toSorted`, `structuredClone`, `replaceAll`, CSS `:has`, `inert`, `dialog.showModal`.
- Никакого `dangerouslySetInnerHTML` / `innerHTML` (в том числе в окне печати: строка «Формируется…» — через `win.document.title` и `textContent`).
- Тесты: Testing Library 12, `user-event` 14, `jest-axe`; effector — `fork`/`allSettled`; публичные события — `EventCallable<T>`; редьюсеры `.on` — раньше `sample`, читающего тот же стор; побочные эффекты (буфер, `window.open`, `URL.createObjectURL`, клик по `<a>`) — только в эффектах.
- jsdom не видит каскад CSS, раскладку и контраст — это только e2e (Chromium).
- CSS — только `var(--k-*)`; новые размеры/цвета — токенами (`packages/tokens/src/tokens.src.ts` → `pnpm gen` → `git add` токенов → `pnpm check`).
- Опциональные поля публичных типов — `?: T | undefined`. Импорты относительные. FSD: `app → pages → widgets → features → entities → shared` только вниз; чужой слайс — через `index.ts`; `widgets/doc-detail` не импортирует ни `entities`, ни `features`. Без `eslint-disable`/`stylelint-disable`.
- Данные — только вымышленные. Тексты интерфейса — дословно из спеки и «Сквозного контракта имён» ниже.
- Русский язык интерфейса, комментариев и коммитов. Коммит — обычный `git commit -m "…"` (identity репо уже Иван; `git -c user.name=…` не использовать), **без** `Co-Authored-By` и «Generated with»; файлы — поимённо.
- Порты: dev — 5185, e2e preview — 5186.
- e2e — только на переднем плане, дождаться результата. Точечно: `pnpm --filter pi exec playwright test e2e/<файл>`; юнит: `pnpm --filter <пакет> exec vitest run <файлы>`.
- `pnpm check` зелёный после каждой задачи. Числа тестов — приращение к базе Task 0; фактические — в леджер `.superpowers/sdd/2026-10-07-katran-lane-actions/progress.md`.

## Review Focus

1. **Ссылка `?doc=` против автооткрытия первой записи (В-Д4).** Открыли `#/fx-docs?doc=<id третьей записи>`. Ожидание: в A — документ из ссылки с фокусом в drawer; первая запись реестра в A **не** открывается и не вытесняет его. Тест: Task 11 «docLinkOpened отменяет автооткрытие».
2. **Поздний ответ решения.** «Утвердить» ушло, пользователь ушёл с экрана (или закрыл документ) до ответа. Ожидание: `$decision` сброшен при `pageClosed`, ответ не открывает `Prompt`, не объявляет «Правка утверждена»; при том же визите деталь ложится в кэш (через `docEdited` → `replaceDetail`, который сам фильтрует `opened`). Тест: Task 7 «поздний ответ решения после pageClosed».
3. **Печать: блокировка окна, ошибка, двойной клик.** `window.open` вернул `null` → PDF скачан файлом и объявлено «Браузер заблокировал вкладку — форма скачана»; `404` → открытая вкладка закрыта, объявлен текст; второй клик по той же форме, пока первый в полёте, — окно не открывается, запроса нет. Тесты: Task 9.
4. **F5 в поле ввода.** F5 в поле «Причина» `Prompt` отклонения, в `SuggestInput` счёта, в редакторе поля — не перехватывается (браузер). F5 на кнопке лейна — «Обновить». Ctrl+F5/Shift+F5 — не перехватываются. Тесты: Task 10.
5. **Цель с `:` и `.` в пути и причина из пробелов.** `field:B.57` уходит как `field%3AB.57` и фейк её находит; причина `"   "` — «Отклонить» недоступна, запроса нет; 141 символ — ввод обрезается `maxLength`, фейк на 141 отвечает `400` по пути `reason`. Тесты: Task 5 (порты), Task 4 (фейк), Task 10 (вид).

---

## Сквозной контракт имён (все задачи пользуются только им)

### Кит `@katran/ui`

```ts
// value/EditMark.tsx
export type EditStatus = 'pending' | 'confirmed' | 'rejected'
// EditMarkProps: + rejectedTip не нужен — tip задаёт вызывающий; status 'rejected' → data-status="rejected", цвет — токен bad

// form/EditHistory.tsx
export type EditHistoryEntry = { /* как в 2c */ ; reason?: string | undefined }
export type EditHistoryProps = {
  entries: EditHistoryEntry[]
  label: string
  /** Кнопки решения у последней записи со статусом pending; оба не заданы — кнопок нет. */
  onConfirm?: (() => void) | undefined
  onReject?: (() => void) | undefined
  confirmLabel?: string | undefined   // 'Утвердить'
  rejectLabel?: string | undefined    // 'Отклонить'
}
// rejected: StatusBadge tone="bad" «отклонено», data-k-tip «Отклонил(а) {by}, {at}» (by/at — что есть); reason — строкой под note: «Причина: {reason}»

// overlay/Prompt.tsx — новые необязательные свойства
children?: ReactNode | undefined        // тело между note и кнопками
okDisabled?: boolean | undefined
busy?: boolean | undefined              // обе кнопки disabled, aria-busy на коробке, Esc и mousedown по подложке — без onResult
error?: string | undefined              // <div role="alert"> над кнопками
// ловушка Tab — по всем фокусируемым в коробке (input, textarea, select, button, [tabindex]:not([tabindex="-1"]), не disabled);
// при открытии с children фокус — на первом поле (input/textarea/select) тела; без children — как в 2c

// drawer/Drawer.tsx
onKeyDown?: ((e: KeyboardEvent<HTMLElement>) => void) | undefined   // на корневом элементе панели
```

### `apps/pi/src/shared/api`

```ts
// request.ts
export type FileRequest = { url: string }
export type FileResponse = { blob: Blob; name: string | null }
export const requestFileFx: Effect<FileRequest, FileResponse, ApiError>   // «Транспорт файлов не подключён: вызовите requestFileFx.use(…) в слое app»
export function fileNameOf(header: string | null): string | null          // filename*=UTF-8''… приоритетнее filename="…"; нет — null

// edit-ports.ts
export type DecisionQuery = { id: string; target: string; when: string }
export type RejectQuery = DecisionQuery & { reason: string }
export type EditPorts<D> = {
  saveEditFx; accountsFx                                   // как в 2c
  confirmEditFx: Effect<DecisionQuery, D, ApiError>        // POST {doc}/edits/{encodeURIComponent(target)}/confirm, body { when }
  rejectEditFx: Effect<RejectQuery, D, ApiError>           // POST …/reject, body { when, reason }
}

// action-ports.ts (новый), экспорт из index.ts
export type PrintQuery = { id: string; form: string }
export type ActionPorts = {
  messageFx: Effect<string, FileResponse, ApiError>        // GET /grids/{gridId}/documents/{id}/message
  printFx: Effect<PrintQuery, FileResponse, ApiError>      // GET …/print/{encodeURIComponent(form)}
}
export function createActionPorts(gridId: string): ActionPorts
```

### `apps/pi/src/shared/lib/detail/types.ts`

```ts
export type LeaveIntent = { kind: 'close'; slot: DrawerSlot } | { kind: 'open'; open: DrawerOpen } | { kind: 'refresh'; id: string }
export type PrintFormItem = { label: string; form: string }
export type DetailAction = { id; label; icon; hotkey?; menu?: PrintFormItem[] | undefined; danger? }   // menu — пункты с кодом формы
export type ActionIcon = 'refresh' | 'doc' | 'download' | 'print' | 'link' | 'ban'                     // 'edit' уходит, если больше не нужен

export type DecisionKind = 'confirm' | 'reject'
export type DecisionState = { kind: DecisionKind; target: string; when: string; reason: string; busy: boolean; error: string | null }
// EditContext — новые поля
decision: DecisionState | null
/** Можно ли сейчас решать по цели: canConfirm цели && нет открытого редактора документа && нет decision && не saving. */
canDecide: (target: string, canConfirm: boolean) => boolean
confirmEdit: (target: string, when: string) => void
rejectEdit: (target: string, when: string) => void
changeReason: (text: string) => void
onDecision: (ok: boolean) => void

// DetailDomain — новое необязательное поле
/** Тело Prompt решения: подпись цели, «было → стало» (PromptChange), автор и время записи. */
decisionNote?: ((d: D, target: string, when: string) => ReactNode) | undefined

export type ActionsView = {
  run: (action: DetailAction, form?: PrintFormItem | undefined) => void
  pending: (actionId: string) => boolean
  /** Буфер обмена недоступен — ссылку показать для ручного копирования. */
  linkFallback: string | null
  closeLinkFallback: () => void
}
```

### `features/doc-edit` (расширение `DocEdit<D>`)

```ts
$decision: Store<Record<string, DecisionState>>        // ключ — docId; одна операция на документ
confirmRequested: EventCallable<{ docId: string; target: string; when: string }>
rejectRequested: EventCallable<{ docId: string; target: string; when: string }>
reasonChanged: EventCallable<{ docId: string; text: string }>
decisionResult: EventCallable<{ docId: string; ok: boolean }>
/** count растёт на успехе; text — 'Правка утверждена' | 'Правка отклонена' | 'Правку уже обработали — данные обновлены'. */
$decided: Store<{ count: number; text: string }>
// docEdited и conflict — теперь и от решений (merge)
export const REJECT_MAX = 140
export const DECISION_TEXT = { confirmed: 'Правка утверждена', rejected: 'Правка отклонена', conflict: 'Правку уже обработали — данные обновлены' }
```

### `features/doc-actions` (новый слайс)

```ts
export type DocActionsConfig = {
  gridId: string
  ports: ActionPorts
  lifecycle: PageLifecycle
  /** Ссылка на документ; по умолчанию defaultDocLink. */
  buildLink?: ((gridId: string, id: string) => string) | undefined
  /** Номер документа для запасного имени файла: '<номер>.txt' | '<номер>.xml'. */
  fallbackName: (id: string) => string
}
export type DocActions = {
  refreshRequested: EventCallable<string>    // из вида; страница решает: охрана правки или сразу refresh
  refresh: Event<string>                     // выполнить: страница → detail.refreshDoc + registry.refreshRequested
  copyLink: EventCallable<string>
  download: EventCallable<string>
  print: EventCallable<{ id: string; form: string; win: Window | null }>
  $pending: Store<Record<string, true>>      // ключ `${id}:${actionId}`; actionId: 'link' | 'down' | 'print'
  $linkFallback: Store<string | null>
  closeLinkFallback: EventCallable<void>
  $notice: Store<{ count: number; text: string }>   // объявления: 'Ссылка скопирована', тексты ошибок, текст про блокировку вкладки
}
export function createDocActions(cfg: DocActionsConfig): DocActions
export function defaultDocLink(gridId: string, id: string): string   // `${origin}${pathname}#/${gridId}?doc=${encodeURIComponent(id)}`
export function useActionsOf(actions: DocActions): (docId: string) => ActionsView   // ui/useActionsOf.ts; объявляет $notice через useKatran().announce
export const PRINT_PENDING_TEXT = 'Формируется…'
export const PRINT_BLOCKED_TEXT = 'Браузер заблокировал вкладку — форма скачана'
export const LINK_COPIED_TEXT = 'Ссылка скопирована'
```

### `widgets/doc-detail`

```ts
// createDetail: Detail<D> += refreshDoc: EventCallable<string>; leave игнорирует { kind: 'refresh' }
// DocDetailProps += actionsOf?: ((docId: string) => ActionsView) | undefined
```

### Страницы

```ts
// pages/fx-docs, pages/rub-docs — index.ts += docActions, docLinkOpened: EventCallable<string>
```

### Коды печатных форм

| Подпись | `form` |
|---|---|
| Платёжное поручение | `payment-order` |
| Мемориальный ордер | `memorial-order` |
| Форма SWIFT | `swift-form` |
| Инкассовое поручение | `collection-order` |
| Платёжный ордер | `payment-ordr` |

---

### Task 0: Worktree и база

**Files:** — (только леджер, git-ignored)

- [x] **Step 1:** `git worktree add .worktrees/lane-actions -b feat/lane-actions main` в `katran`; `pnpm install`.
- [x] **Step 2:** `pnpm check` — зелёный. Записать в леджер числа тестов по пакетам (`tokens`, `ui`, `effector`, `apps/pi`) и e2e (`pnpm --filter pi e2e`, передний план) — это база для приращений.
- [x] **Step 3:** записать в `/Users/shaman/_CODE/VTB/.claude/launch.json` **и** его `.bak` конфигурацию `katran-lane` (`--dir katran/.worktrees/lane-actions`, порт 5185) — удалить после слияния.

### Task 1: Сверка 2d

**Files:**
- Modify: `docs/reference/detail-drift.md` (раздел «2d — сверяется в начале своего подсреза», строки Д6, Д15)

- [x] **Step 1:** по `pi-constructor@e065bfb` (`git show e065bfb:grid.html`, `rub-grid.html`) выписать фактическое поведение каждой кнопки лейна (по обработчику клика `.dw`: отрабатывают только `.ib.hasmenu` → меню и `[data-print]` → тост «Печать: {форма} — формируется PDF»; остальные — без обработчика), горячих клавиш (нет обработчика F5/E — только подсказка), истории правки (статусы «ожидает»/«утверждено», кнопки утверждения нет).
- [x] **Step 2:** заменить заглушку раздела «2d» таблицей в формате раздела «2c» (Д-номера продолжают последний занятый): строки класса D — «Редактировать» убран (г7), печать — PDF во вкладке вместо тоста (г5), «Утвердить»/«Отклонить» и `rejected` (г2–г4), «Скачать» и «Ссылка» с действием (на эталоне — без действия), F5 обновляет деталь (г8); класс C — номера слотов (Д6, без изменений). В Д15 — «Действия — 2e».
- [x] **Step 3:** коммит `Сверка 2d: действия лейна и история правки против e065bfb`.

### Task 2: Кит — `Prompt`, `EditHistory`, `EditMark`, `EditStatus`, `Drawer.onKeyDown`

**Files:**
- Modify: `packages/ui/src/overlay/Prompt.tsx`, `Prompt.module.css`, `Prompt.test.tsx`
- Modify: `packages/ui/src/value/EditMark.tsx`, `packages/ui/src/form/EditHistory.tsx`, `Edit.module.css`, их тесты
- Modify: `packages/ui/src/drawer/Drawer.tsx`, его тест
- Modify: `packages/ui/CHANGELOG.md`, демо кита (страница `Prompt` и `EditHistory` — по одному примеру новых свойств)

**Interfaces:** Produces — раздел «Кит» сквозного контракта.

- [x] **Step 1: падающие тесты `Prompt`:**
  - `children` рисуется между note и кнопками; при открытии фокус на `textarea` тела;
  - Tab с последней кнопки возвращается к `textarea` (ловушка по всем фокусируемым);
  - `okDisabled` → основная кнопка `disabled`, клик не вызывает `onResult`;
  - `busy` → обе `disabled`, `aria-busy="true"` у `role=alertdialog`, Esc и mousedown по подложке **не** вызывают `onResult`;
  - `error="Нет прав"` → `getByRole('alert')` с этим текстом;
  - без новых свойств — все тесты 2c зелёные без правок.
- [x] **Step 2: падающие тесты `EditHistory`/`EditMark`:**
  - `onConfirm`+`onReject` и последняя запись `pending` → две кнопки «Утвердить», «Отклонить» только в последней записи; клик вызывает обработчик;
  - последняя запись `confirmed` → кнопок нет; обработчики не заданы → кнопок нет;
  - запись `rejected` → бейдж «отклонено», подсказка «Отклонил(а) Смирнова Е. В., 23.09.2026 10:00», строка «Причина: BIC не по справочнику»;
  - `EditMark status="rejected"` → `data-status="rejected"`;
  - axe без нарушений для истории с кнопками.
- [x] **Step 3: падающий тест `Drawer`:** `onKeyDown` вызывается на keydown из кнопки закрытия и из содержимого.
- [x] **Step 4:** реализовать. Кнопки решения — `Button size="s"`, «Отклонить» — тон danger существующего варианта `Button` (если такого нет — `variant="ghost"` + токен bad, без новых цветов вне токенов). Бейдж `rejected` — `StatusBadge tone="bad"`.
- [x] **Step 5:** `pnpm --filter @katran/ui exec vitest run src/overlay src/form src/value src/drawer` — PASS; `pnpm check` — зелёный.
- [x] **Step 6:** коммит `Кит: Prompt с телом/блокировкой/ошибкой, EditHistory с решением, статус rejected, Drawer.onKeyDown`.

### Task 3: Контракт сущности — `canConfirm`, `rejected`, `reason`

**Files:**
- Modify: `apps/pi/src/entities/fx-doc/model/edit.ts` (`FxEdit.canConfirm: boolean`, `FxHistEntry.reason: string | null`)
- Modify: `apps/pi/src/entities/fx-doc/api/detail.mapper.ts` (`parseEdits`), `detail.mapper.test.ts`, `detail.example.ts`
- Modify: `docs/reference/pi-api.md` — §1.7 (задел → утверждение и отклонение, тела, таблица ошибок спеки §3.1 п. 5), новые §1.9 `GET …/message`, §1.10 `GET …/print/{form}` (с таблицей кодов форм), §7.6 (`canConfirm`, `rejected`, `reason`)

- [x] **Step 1: падающие тесты маппера:** нет ключа `canConfirm` → `false`; `canConfirm: "yes"` → контрактная ошибка с путём `ответ.edits.field:57.canConfirm`; `status: "rejected"` разбирается; `status: "denied"` → ошибка с путём `…hist[0].status`; `reason` отсутствует → `null`, строка → строка.
- [x] **Step 2:** реализовать (`oneOf` статусов + `'rejected'`; `canConfirm` — boolean-guard рядом с `str`/`strOrNull` в `shared/api/guards.ts`, если его нет — `bool(o, key, path)` с тестом в `guards.test.ts`).
- [x] **Step 3:** обновить `pi-api.md` по спеке §3.1 дословно (тела, коды, тексты). Пример ответа отклонения `accKt` — фрагмент `edits.accKt.hist[0]` со `status: "rejected"`, `by`, `at`, `reason` и запись `edits.route` от «система».
- [x] **Step 4:** `pnpm check` — зелёный; коммит `Контракт 2d: canConfirm, статус rejected и reason у правки; эндпоинты решения, сообщения и печати в pi-api`.

### Task 4: Фейк — решения, сид «чужих» правок, сообщение, PDF

**Files:**
- Modify: `apps/pi/src/app/fake/edits.ts` (`FakeEditStore.decide`), `edits.data.ts` (сид), `grid.ts` (`FakeGrid.decide`, `message`, `print`), `server.ts` (маршруты)
- Create: `apps/pi/src/app/fake/files.ts` (`swiftMessage(detail)`, `edMessage(detail)`, `pdfForm(form, detail)`, `createFakeFileServer(grids, opts)`)
- Test: `apps/pi/src/app/fake/server.test.ts`, `contract.test.ts`, `files.test.ts` (новый)

**Interfaces:**
- Produces: `FakeEditStore.decide(id, detail, target, kind: 'confirm'|'reject', body, when): Detail`; `createFakeFileServer(grids, opts): (req: FileRequest) => Promise<FileResponse>`; в `overlay` у каждой цели — `canConfirm` по правилу «последняя `pending` и `who !== 'Вы'`», у `route`/`valueDate` — `false`.

- [x] **Step 1: падающие тесты фейка (server.test.ts):**
  - деталь второго документа: `edits['field:57'].canConfirm === true`; своя правка после `POST …/edits` — `false`;
  - `confirm` с `when` последней записи → 200, запись `confirmed`, `by: 'Вы'`, `at` = `now()` фейка, `canConfirm: false`;
  - `confirm` с чужим `when` → 409 `urn:katran:edit-conflict`; повторный `confirm` → 409;
  - `confirm` своей правки → 403;
  - `reject` с `reason: "  "` → 400 путь `reason`; 141 символ → 400 путь `reason`;
  - `reject` сид-правки `accKt` (Task 4 сид) → значение `accKt` = `was` записи, маршрут пересчитан, в `edits.route` новая запись от «система», запись `rejected` с `reason`;
  - `POST …/edits/field%3AB.57/confirm` у MT202COV без правок цели → 404;
  - `GET /grids/rub-docs/documents/{id}/edits/x/confirm` (нет `edit` у грида) → 404.
- [x] **Step 2: падающие тесты `files.test.ts`:**
  - `swiftMessage` начинается с `{1:F01`, содержит `{4:` и `:20:`, заканчивается `-}`;
  - `edMessage` начинается с `<?xml`, содержит `<ED101`;
  - `pdfForm` начинается с `%PDF-1.4`, заканчивается `%%EOF\n`, смещения в `xref` указывают на `N 0 obj` (проверка разбором строки);
  - файловый сервер: `message` fx → `name` `<номер>.txt`, `blob.type` `text/plain;charset=utf-8`; rub → `.xml`, `application/xml`; `print/swift-form` у рубля → 404 Problem; неизвестный документ → 404.
- [x] **Step 3:** реализовать. Сид: в `edits.data.ts` — ожидающая правка `accKt` от «Кузнецов Д. А.» у MT103 (взять документ сида, у которого `accKt` — счёт из `CLIENT_ACCOUNTS` той же валюты; `now` — другой счёт той же валюты). PDF — строкой: каталог, страницы, страница A4 (595×842), шрифт Helvetica, поток с `BT … Tj … ET` (латиница: `form`, номер, дата, сумма и валюта), `xref` по фактическим смещениям, `trailer`, `startxref`. Имя файла фейк отдаёт как `name` (транспорт стенда — без заголовков).
- [x] **Step 4:** обновить `contract.test.ts` — новые маршруты против `pi-api.md`.
- [x] **Step 5:** `pnpm --filter pi exec vitest run src/app/fake` — PASS; `pnpm check`; коммит `Фейк 2d: утверждение и отклонение правки, чужие правки в сиде, сообщение SWIFT/ED и PDF формы`.

### Task 5: Порты — файловый транспорт, решения, действия

**Files:**
- Modify: `apps/pi/src/shared/api/request.ts`, `request.test.ts`, `edit-ports.ts`, `edit-ports.test.ts`, `index.ts`
- Create: `apps/pi/src/shared/api/action-ports.ts`, `action-ports.test.ts`
- Modify: `apps/pi/src/app/transport.ts` (`requestFileFx.use(createFakeFileServer(fakeGrids, browserFakeOptions))`)
- Modify: `apps/pi/src/entities/fx-doc/api/ports.ts` (`fxEditPorts` получает новые эффекты из `createEditPorts`)

**Interfaces:** Produces — раздел `shared/api` сквозного контракта.

- [x] **Step 1: падающие тесты:**
  - `fileNameOf('attachment; filename="a b.txt"')` → `'a b.txt'`; `filename*=UTF-8''%D0%9F.xml` → `'П.xml'` (приоритет над `filename`); `null` и `'inline'` → `null`;
  - `requestFileFx` без обработчика → `ApiError` с текстом про `requestFileFx.use`;
  - `confirmEditFx({ id: 'x', target: 'field:B.57', when: 'w' })` → запрос `POST /grids/fx-docs/documents/x/edits/field%3AB.57/confirm`, тело `{ when: 'w' }`; ответ разобран `parseDetail`;
  - `rejectEditFx` → `…/reject`, тело `{ when, reason }`;
  - `createActionPorts('rub-docs').printFx({ id: 'a/b', form: 'payment-order' })` → `GET /grids/rub-docs/documents/a%2Fb/print/payment-order` через `requestFileFx`.
- [x] **Step 2:** реализовать; `requestFileFx` — `createEffect` с той же заглушкой-ошибкой, что `requestFx`.
- [x] **Step 3:** `pnpm check`; коммит `Порты 2d: файловый транспорт requestFileFx, утверждение и отклонение правки, сообщение и печать`.

### Task 6: Деталь — `refreshDoc` и намерение `refresh`

**Files:**
- Modify: `apps/pi/src/shared/lib/detail/types.ts` (`LeaveIntent` + `{ kind: 'refresh'; id }`)
- Modify: `apps/pi/src/widgets/doc-detail/lib/createDetail.ts`, его тест

- [x] **Step 1: падающие тесты `createDetail`:**
  - `refreshDoc(id)` при готовой детали и загруженной вкладке «Статусы» → `detailFx` вызван с `id`, кэш вкладок `id:*` очищен, активная нелокальная вкладка перезапрошена; кэш детали до ответа остаётся (слот `ready`, без скелетона);
  - `refreshDoc` при закрытом экране — без запросов;
  - `leave({ kind: 'refresh', id })` — слоты не меняются, запросов нет.
- [x] **Step 2:** реализовать: сброс вкладок — тем же `dropDoc`, что у `replaced`; перезапрос детали — через `reloadDetail`; перезапрос активной вкладки — тот же путь, что после `replaced`.
- [x] **Step 3:** `pnpm check`; коммит `Деталь: refreshDoc — перезапрос детали и вкладок документа; намерение ухода refresh`.

### Task 7: «Вторая рука» в `features/doc-edit`

**Files:**
- Modify: `apps/pi/src/features/doc-edit/model/createDocEdit.ts`, `createDocEdit.test.ts`, `ui/useEditContexts.ts`, `useEditContexts.test.tsx`, `index.ts`
- Modify: `apps/pi/src/shared/lib/detail/types.ts` (`DecisionState`, поля `EditContext`)

**Interfaces:**
- Consumes: `EditPorts.confirmEditFx`/`rejectEditFx` (Task 5).
- Produces: раздел `features/doc-edit` сквозного контракта; `EditContext.decision`, `canDecide`, `confirmEdit`, `rejectEdit`, `changeReason`, `onDecision`.

- [x] **Step 1: падающие тесты модели (`fork`, порты-заглушки):**
  - `confirmRequested` → `$decision[docId]` = `{ kind: 'confirm', target, when, reason: '', busy: false, error: null }`; `decisionResult(true)` → `confirmEditFx` вызван с `{ id, target, when }`, `busy: true`; успех → `$decision[docId]` нет, `docEdited` с деталью ответа, `$decided` `{ count: 1, text: 'Правка утверждена' }`;
  - `rejectRequested`, `reasonChanged('  BIC  ')`, `decisionResult(true)` → `rejectEditFx` с `reason: 'BIC'` (trim);
  - `reasonChanged('   ')` и `decisionResult(true)` → запроса нет;
  - 403 → `$decision[docId].error` — текст ошибки, `busy: false`, `Prompt` остаётся;
  - 400 → `error` = `problem.errors[0].message`;
  - 409 → `$decision[docId]` снят, `conflict({ id })`, `$decided.text` = `'Правку уже обработали — данные обновлены'`;
  - `decisionResult(false)` при `busy` — игнор; без `busy` — снят;
  - `confirmRequested` при открытом редакторе того же документа (`$editing` в `editScope(docId)`) или при сохранении в полёте — игнор; в другом документе — работает;
  - **поздний ответ:** решение в полёте, `lifecycle.pageClosed` → `$decision` пуст; ответ пришёл — `$decided` не растёт, `$decision` пуст (`docEdited` выпускается — `replaceDetail` сам фильтрует закрытый экран).
- [x] **Step 2: падающие тесты `useEditContexts`:** `canDecide('field:57', true)` — `true` без редактора; `false` при открытом редакторе документа, при `decision`, при `canConfirm=false`; рост `$decided.count` → `announce(text)`; на монтировании — без объявления.
- [x] **Step 3:** реализовать. `docEdited` = `merge([saved, confirmEditFx.done, rejectEditFx.done])` с фильтром визита экрана, как у сохранения; `conflict` — `merge` с 409 решений. `$decision.reset(lifecycle.pageClosed)`.
- [x] **Step 4:** `pnpm check`; коммит `Правка: утверждение и отклонение чужой правки — модель, контекст, объявления`.

### Task 8: Сущности — решение в видах, лейн без «Редактировать», формы печати

**Files:**
- Modify: `apps/pi/src/entities/fx-doc/ui/edit.tsx` (кнопки решения; `decisionNote`), `apps/pi/src/entities/fx-doc/model/swift.ts`, `apps/pi/src/entities/rub-doc/model/profiles.ts` (действия), `apps/pi/src/pages/fx-docs/ui/detailDomain.ts` (подключить `decisionNote` из `entities/fx-doc`)
- Modify: `apps/pi/src/widgets/doc-detail/ui/icons.tsx` (убрать `edit`, если не используется)
- Test: тесты видов `entities/fx-doc` (рядом с `edit.tsx`), `swift.test.ts`

- [x] **Step 1: падающие тесты:**
  - список действий fx и rub — 6 id в порядке `refresh, esid, down, print, link, ban`; у `print` fx — `[{ label: 'Платёжное поручение', form: 'payment-order' }, { label: 'Мемориальный ордер', form: 'memorial-order' }, { label: 'Форма SWIFT', form: 'swift-form' }]`; у rub — `payment-order`, `collection-order`, `payment-ordr`, `memorial-order` в порядке эталона;
  - поле 57 сида с `canConfirm` и `edit.canDecide` → в блоке аудита `EditHistory` с кнопками; клик «Утвердить» → `edit.confirmEdit('field:57', <when последней записи>)`;
  - строка счёта Кт с ожидающей чужой правкой: рядом с `EditMark` — `IconButton` «Утвердить правку счёта Кт» и «Отклонить правку счёта Кт» (то же для 20 исх: «… 20 исх», счёта Дт: «… счёта Дт») — у этих целей нет блока истории, кнопки стоят у маркера (уточнение к спеке §4.1, записать в спеку §9);
  - `decisionNote(d, 'accKt', when)` содержит подпись «Счёт Кт», `PromptChange` «было → стало» значениями записи и строку «{who}, {дд.мм.гггг чч:мм}»;
  - заблокированный документ — кнопок решения нет.
- [x] **Step 2:** реализовать; `historyOf` передаёт `reason`; маркер «изменено» — без изменений.
- [x] **Step 3:** дописать в спеку §9: «Кнопки решения у 20 исх и счетов — у маркера (блока истории у этих целей нет)».
- [x] **Step 4:** `pnpm check`; коммит `Виды правки: кнопки утверждения и отклонения, тело Prompt решения; лейн без «Редактировать», коды печатных форм`.

### Task 9: `features/doc-actions`

**Files:**
- Create: `apps/pi/src/features/doc-actions/index.ts`, `model/createDocActions.ts`, `model/createDocActions.test.ts`, `ui/useActionsOf.ts`, `ui/useActionsOf.test.tsx`

**Interfaces:**
- Consumes: `ActionPorts` (Task 5), `ActionsView`, `DetailAction`, `PrintFormItem` (сквозной контракт).
- Produces: раздел `features/doc-actions` сквозного контракта.

- [x] **Step 1: падающие тесты модели:**
  - `refreshRequested('x')` → `refresh` выпущен с `'x'` (охрану решает страница);
  - `copyLink('x')` при `clipboard.writeText` успехе → `$notice.text` `'Ссылка скопирована'`; при отказе или отсутствии `navigator.clipboard` → `$linkFallback` = `buildLink('fx-docs','x')`; `closeLinkFallback` → `null`;
  - `download('x')` → `messageFx('x')`, `<a download>` с именем ответа (нет имени → `fallbackName('x')`), `URL.revokeObjectURL` вызван; `$pending['x:down']` в полёте;
  - повторный `download('x')` в полёте — второго запроса нет;
  - `print({ id, form, win })` успех → `win.location.href` = blob URL; `win === null` → файл скачан, `$notice.text` = `PRINT_BLOCKED_TEXT`; ошибка 404 → `win.close()` вызван, `$notice.text` = `detail` Problem;
  - `lifecycle.pageClosed` → созданные для печати blob URL освобождены, `$pending` и `$linkFallback` сброшены.
- [x] **Step 2: падающие тесты `useActionsOf`:**
  - `run(refresh)` → `refreshRequested(docId)`; `run(link)` → `copyLink`; `run(down)` → `download`;
  - `run(print, form)` вызывает `window.open('', '_blank')` **синхронно** (шпион вызван до любого `await`), выставляет `win.opener = null`, `win.document.title` = `PRINT_PENDING_TEXT`, затем `print({ id, form: form.form, win })`;
  - `run(print)` при `pending('print')` — `window.open` не вызывается;
  - `run(esid)`, `run(ban)` — без действия (это 2e; объявление 2a для них делает виджет, Task 10);
  - рост `$notice.count` → `announce(text)`.
- [x] **Step 3:** реализовать. Побочные эффекты — эффекты `writeClipboardFx`, `saveFileFx({ blob, name })`, `showInWindowFx({ win, blob })`, `closeWindowFx`.
- [x] **Step 4:** `pnpm check`; коммит `Фича doc-actions: обновить, ссылка, скачать сообщение, печать формы во вкладке`.

### Task 10: Виджет — действия, `Prompt` решения, ссылка вручную, F5

**Files:**
- Modify: `apps/pi/src/widgets/doc-detail/ui/DocDetail.tsx`, `DocDetail.module.css`, тесты виджета, `apps/pi/src/app/details.a11y.test.tsx`

**Interfaces:**
- Consumes: `ActionsView`, `EditContext.decision`/`onDecision`/`changeReason`, `DetailDomain.decisionNote`, `Drawer.onKeyDown`, `Prompt` (`children`, `okDisabled`, `busy`, `error`).

- [x] **Step 1: падающие тесты:**
  - лейн: `actionsOf` задан → клик «Обновить» вызывает `run(refresh)`; `pending('down')` → кнопка «Скачать» `disabled` и `aria-busy`; меню «Печать» → пункт «Форма SWIFT» → `run(print, { label: 'Форма SWIFT', form: 'swift-form' })`; без `actionsOf` — объявление 2a (тесты 2c не меняются);
  - `esid`, `ban` — объявление 2a и при заданном `actionsOf`;
  - `edit.decision = { kind: 'confirm', … }` → `Prompt` «Утвердить правку?», кнопки «Утвердить»/«Отмена», тело — `decisionNote`; `kind: 'reject'` → «Отклонить правку?», tone danger, `textarea` с подписью «Причина», `maxLength=140`, счётчик «0/140»; пустая или из пробелов причина → «Отклонить» `disabled`; ввод → `changeReason`; `busy` → `Prompt busy`; `error` → `role=alert`;
  - `Prompt` правки 2c (`edit.confirm`) имеет приоритет — решения при нём не бывает (модель), но вид рисует только один `Prompt`: `confirm ?? decision`;
  - `linkFallback` → в drawer `role=status` с `input readonly` (значение — ссылка, выделено при появлении) и текстом «Скопируйте ссылку: Ctrl+C», кнопка «Закрыть» → `closeLinkFallback`;
  - **F5:** keydown `F5` на кнопке лейна → `run(refresh)` и `defaultPrevented`; `F5` в `textarea` причины, в `input` — нет; `Ctrl+F5`, `Shift+F5` — нет; при открытом редакторе (`edit.editing !== null`) или `Prompt` — нет;
  - axe: `Prompt` отклонения, лейн с `aria-busy`.
- [x] **Step 2:** реализовать; `textarea` причины — `useStableId` для подписи и счётчика (`aria-describedby`).
- [x] **Step 3:** `pnpm check`; коммит `Деталка: настоящие действия лейна, Prompt утверждения и отклонения, ссылка для ручного копирования, F5`.

### Task 11: Страницы и `app` — связи, `docLinkOpened`, роутер

**Files:**
- Create: `apps/pi/src/pages/fx-docs/model/actions.model.ts`, `apps/pi/src/pages/rub-docs/model/actions.model.ts`
- Modify: `pages/fx-docs/model/registry.model.ts`, `edit.model.ts`, `pages/fx-docs/ui/FxDocsPage.tsx`, `index.ts`; то же у `rub-docs`
- Modify: `apps/pi/src/app/routes.ts`, `routes.test.ts`, `App.tsx` (если подключение страницы требует)
- Test: `pages/*/model/*.test.ts`

- [x] **Step 1: падающие тесты:**
  - fx: `docActions.refreshRequested(id)` без черновика → `detail.refreshDoc(id)` и `registry.refreshRequested`; с грязным черновиком → `Prompt` «Отменить правку?»; «Отменить правку» → обновление; «Продолжить» → нет;
  - rub: `refreshRequested` → сразу `refreshDoc` и реестр;
  - `docEdit.model.leave` с `{ kind: 'refresh' }` идёт в `docActions` (выполнить обновление), а не в `detail.leave`; остальные — в `detail.leave`, как в 2c;
  - `docLinkOpened('id3')` → `detail.open({ id: 'id3', secondary: false })` (не quiet); **после него первый ответ реестра не открывает первую запись** (`$autoOpened` → `true`);
  - `parseDocParam()` для `#/fx-docs?doc=a%2Fb` → `'a/b'`; без `doc` → `null`; роутер после `pageOpened` вызывает `docLinkOpened` страницы маршрута, если `doc` есть.
- [x] **Step 2:** реализовать. `fallbackName` — номер документа из строки реестра или кэша детали, иначе `id`. `buildLink` — `defaultDocLink`; точка подмены хостом — `configureDocLinks({ build })` рядом с подключением транспорта в `app/transport.ts`; это имя описывает `pi-usage.md` (Task 13).
- [x] **Step 3:** `pnpm check`; коммит `Страницы: связи действий и решения правки, открытие документа по ссылке ?doc=`.

### Task 12: e2e

**Files:**
- Create: `apps/pi/e2e/lane-actions.spec.ts`
- Modify: `apps/pi/e2e/detail.spec.ts` (лейн: 6 кнопок, нет «Редактировать»), `detail-edit.spec.ts` (если опирался на число кнопок лейна)

- [x] **Step 1:** тесты (Chromium, контекст с `permissions: ['clipboard-read', 'clipboard-write']`):
  - утвердить поле 57 второго документа: `Prompt`, «Утвердить» → бейдж «утверждено», подсказка «Утвердил(а) Вы, …», кнопок решения нет;
  - отклонить `accKt` сида с причиной «Счёт не тот»: «Отклонить» недоступна до ввода; после — счёт и маршрут как до правки, плашка «отклонено», «Причина: Счёт не тот» в подсказке/истории;
  - скачать: `page.waitForEvent('download')`, `suggestedFilename()` оканчивается на `.txt`, содержимое начинается с `{1:F01`;
  - печать «Форма SWIFT»: `context.waitForEvent('page')`, новая вкладка, ответ blob с `%PDF-1.4` (проверка через `page.evaluate(fetch(location.href))` в новой вкладке);
  - F5 с фокусом на кнопке лейна: `detailFx` пришёл повторно (счётчик запросов транспорта стенда через `observe`), `page` не перезагружалась (метка в `window` сохранилась);
  - ссылка: «Скопировать ссылку» → `navigator.clipboard.readText()` содержит `?doc=`; `page.goto(ссылка)` → в A открыт этот документ, а не первая запись;
  - контраст плашки «отклонено» — существующей проверкой контраста e2e.
- [x] **Step 2:** `pnpm --filter pi e2e` — **на переднем плане**, все зелёные; число — в леджер.
- [x] **Step 3:** коммит `e2e 2d: утверждение и отклонение, скачать, печать, F5, ссылка`.

### Task 13: Документы

**Files:**
- Modify: `docs/guides/pi-usage.md` (новые разделы: действия лейна; утверждение и отклонение; ссылка и подключение хоста — `configureDocLinks`, `docLinkOpened`; файловый транспорт `requestFileFx.use`), `packages/ui/CHANGELOG.md` (проверить запись Task 2), `README.md` (состав деталки), `docs/STATE.md` (§6 состояние ветки, §7 техдолг 2d, §9 следующий шаг — 2e), спека 2c §8 п. 2 («Обновить» — сделано в 2d), спека 2d — статус «исполнена в `feat/lane-actions`», §9 уточнения из леджера

- [x] **Step 1:** обновить документы; каждое имя, путь и текст — сверить с кодом (`grep`).
- [x] **Step 2:** `pnpm check`; коммит `Документы 2d: pi-usage, CHANGELOG, README, STATE, спеки`.

### Task 14: Финальное ревью и фикс-волна

- [x] **Step 1:** ревью всей ветки против спеки 2d и Review Focus (Opus); замечания — в леджер.
- [x] **Step 2:** фикс-волна — по задаче на замечание, тест на каждое; повторное ревью волны.
- [x] **Step 3:** `pnpm check` и `pnpm --filter pi e2e` (передний план) — зелёные; итоговые числа — в STATE §6 и леджер. Слияние в `main` — **только по слову владельца**.
