# Срез 2e «Операции деталки» в `apps/pi`: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** оставшиеся заглушки деталки работают по-настоящему: «Аннулировать» (команда прикладному уровню и перезапрос детали; итог — сразу, через утверждение второй рукой или без изменений — по данным бека, с плашкой под лейном), «Курс» и «Проверить баланс» (поповеры), «Переотправить все», «Переотправить» (одну) и «Исходное сообщение» во вкладке «Нотификации», переход к ручным отклонениям в новой вкладке; «Создать служебный документ» остаётся заглушкой.

**Architecture:** кит получает `Dialog` (на нём теперь `Prompt`) и `Banner`. В `apps/pi`: разборщики и порты в `shared/api`, `host-links` в `shared/lib`; три новые фичи — `features/doc-annul` (аннулирование и решения, вид `annulOf`), `features/doc-lookups` (`createLookup` — кэш справочных запросов по документу), `features/doc-notif` (переотправка, окно сообщения); `createDetail.replaceTab`; сущности рисуют «Курс», «Проверить баланс», кнопки вкладок через контексты из `shared/lib/detail` — виджет фичи не импортирует; страницы связывают всё, включая взаимную блокировку аннулирования и правки. Фейк аннулирует, отдаёт курсы, остатки, тела сообщений и переотправляет.

**Tech Stack:** pnpm-монорепо, React 17.0.2, effector 23.4, effector-react, Vite 8, Vitest 5 + jsdom + Testing Library 12 + jest-axe, Playwright 1.63, eslint (`import-x`, `jsx-a11y`, `react-hooks`), stylelint.

**Spec:** `docs/superpowers/specs/2026-10-07-katran-detail-ops-design.md` (утверждена владельцем 07.10, ответы на открытые вопросы — г7–г11 в §1.3). Эталон — `/Users/shaman/_CODE/VTB/pi-constructor`, коммит `e065bfb` (`grid.html`: «Курс» ~1250, «Проверить баланс» ~1342, `tasksHtml` ~1359, `notifHtml` ~1373, `ACTIONS` 919–928; `rub-grid.html` — те же места выше на ~13 строк). Образец плана — `docs/superpowers/plans/2026-10-07-katran-lane-actions.md` (2d).

## Global Constraints

- Предусловие: `main` содержит `44242d5` (спека 2e); `pnpm check` зелёный (Task 0). Работа — в worktree `katran/.worktrees/detail-ops`, ветка `feat/detail-ops` от `main`.
- Среда внутри: **React 17.0.2**, effector 23.4, **Chromium 88**. Legacy `render`, без `createRoot`, `useId` (замена — `useStableId`), `useSyncExternalStore`; без `.at`, `Object.hasOwn`, `findLast`, `toSorted`, `structuredClone`, `replaceAll`, CSS `:has`, `inert`, `dialog.showModal`.
- Никакого `dangerouslySetInnerHTML` / `innerHTML`; тело исходного сообщения — только через `CodeView`.
- Тесты: Testing Library 12, `user-event` 14, `jest-axe`; effector — `fork`/`allSettled`; публичные события — `EventCallable<T>`; редьюсеры `.on` — раньше `sample`, читающего тот же стор; побочные эффекты (буфер обмена) — только в эффектах.
- jsdom не видит каскад CSS, раскладку и контраст — это только e2e (Chromium).
- CSS — только `var(--k-*)`; новые размеры/цвета — токенами (`packages/tokens/src/tokens.src.ts` → `pnpm gen` → `git add` токенов → `pnpm check`).
- Опциональные поля публичных типов — `?: T | undefined`. Импорты относительные. FSD: `app → pages → widgets → features → entities → shared` только вниз; чужой слайс — через `index.ts`; `widgets/doc-detail` не импортирует ни `entities`, ни `features`. Без `eslint-disable`/`stylelint-disable`.
- Данные — только вымышленные. Тексты интерфейса — дословно из спеки §4 и «Сквозного контракта имён» ниже.
- Русский язык интерфейса, комментариев и коммитов. Коммит — обычный `git commit -m "…"` (identity репо уже Иван; `git -c user.name=…` не использовать), **без** `Co-Authored-By` и «Generated with»; файлы — поимённо; **без `git push`**.
- Порты: dev — 5185, e2e preview — 5186.
- e2e — **только на переднем плане**, дождаться результата, не уводить в фон. Точечно: `pnpm --filter pi exec playwright test e2e/<файл>`; юнит: `pnpm --filter <пакет> exec vitest run <файлы>`.
- `pnpm check` зелёный после каждой задачи. Числа тестов — приращение к базе Task 0; фактические — в леджер `.superpowers/sdd/2026-10-07-katran-detail-ops/progress.md`.

## Review Focus

1. **Поздний ответ аннулирования.** «Аннулировать» ушло, пользователь закрыл деталку или ушёл с экрана до ответа. Ожидание: `Prompt` не всплывает снова, объявления на закрытом экране нет; в том же визите деталь ложится в кэш через `replaceDetail` (он сам отсекает закрытое). Тест: Task 7 «поздний ответ после pageClosed».
2. **Блокировка — только своего документа.** В A открыт редактор документа X, в B — документ Y. Ожидание: «Аннулировать» у X недоступна с подсказкой «Завершите текущую операцию с документом», у Y — доступна; открытый `Prompt` аннулирования Y не мешает карандашам X. Тесты: Task 7 (модель), Task 8 (вид).
3. **Неудачное «Обновить» остатков.** Данные были, перезапрос упал. Ожидание: старая таблица видна, под ней текст ошибки и «Повторить»; кэш не сброшен в `error` без значения. Тест: Task 6.
4. **Гонка вкладки и переотправки.** Вкладка «Нотификации» перезапрашивается (переключили вкладку туда и обратно), в это время приходит ответ `resend` → `replaceTab`; затем приходит старый ответ GET. Ожидание: в кэше остаются данные `replaceTab`. Тест: Task 9.
5. **Esc в слоях поверх деталки.** Esc в поповере «Курс»/«Проверить баланс», в окне «Исходное сообщение», в `Prompt` аннулирования закрывает только верхний слой; деталь открыта, фокус возвращается на вызвавший элемент. Тесты: Task 5 (`Dialog`), Task 6 (поповер), Task 10 (окно), e2e Task 13.

---

## Сквозной контракт имён (все задачи пользуются только им)

### Кит `@katran/ui`

```ts
// overlay/Dialog.tsx (новый), экспорт из overlay/index.ts и корня
export type DialogTone = 'neutral' | 'danger'
export type DialogProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode | undefined
  tone?: DialogTone | undefined                 // danger — акцент заголовка токеном bad
  busy?: boolean | undefined                    // aria-busy; Esc и mousedown по подложке не вызывают onClose
  size?: 'm' | 'l' | undefined                  // m — ширина Prompt 2d, l — окно сообщения (токен)
  role?: 'dialog' | 'alertdialog' | undefined   // Prompt передаёт alertdialog
  initialFocus?: (() => HTMLElement | null | undefined) | undefined
  fallbackFocus?: (() => HTMLElement | null | undefined) | undefined
}
// aria-modal="true", aria-labelledby → заголовок; ловушка Tab по всем фокусируемым; keydown Esc → stopPropagation (drawer не закрывается);
// возврат фокуса — на активный элемент до открытия, его нет в DOM — fallbackFocus

// state/Banner.tsx (новый)
export type BannerTone = 'neutral' | 'warn' | 'bad' | 'ok'
export type BannerProps = {
  tone: BannerTone
  children: ReactNode                           // в <div role="status">
  actions?: ReactNode | undefined               // вне role="status"
  onClose?: (() => void) | undefined            // IconButton «Закрыть»
  closeLabel?: string | undefined               // по умолчанию 'Закрыть'
}
```

### `apps/pi/src/shared/lib/detail/types.ts`

```ts
export type AnnulStatus = 'pending' | 'done' | 'rejected'
export type AnnulState = {
  status: AnnulStatus; who: string; when: string; reason: string
  by: string | null; at: string | null; rejectReason: string | null; canConfirm: boolean
}
/** Доменное для аннулирования — из детали (DetailDomain.annulInfo). */
export type AnnulInfo = {
  canAnnul: boolean
  annul: AnnulState | null
  lockedBy: string | null      // lock?.who
  statusLabel: string          // подпись статуса документа («Обработан»)
  subject: string              // «№ {номер} · {сумма} {валюта}» — пояснение Prompt
}
export type AnnulLane = { disabled: boolean; hint: string | null; busy: boolean; run: () => void }
export type AnnulView = {
  lane: (info: AnnulInfo | null) => AnnulLane
  /** Плашка под лейном (Banner кита) или null; dismissed — локальное состояние drawer (rejected закрыта). */
  banner: (info: AnnulInfo | null, dismissed: boolean, onDismiss: () => void) => ReactNode
  /** Prompt аннулирования/решения этого документа или null. */
  prompt: (info: AnnulInfo | null) => ReactNode
}
// DetailDomain — новое необязательное поле
annulInfo?: ((d: D) => AnnulInfo) | undefined

export type LookupState = 'idle' | 'loading' | 'ready' | 'error'
export type LookupView<T> = {
  state: LookupState; value: T | null; error: string | null
  load: () => void; retry: () => void; refresh: () => void
}
export type DetailLookups = { rates?: LookupView<Rates> | undefined; balances?: LookupView<Balances> | undefined }
// DetailDomain.renderHero / renderBlock — четвёртый необязательный параметр lookups?: DetailLookups | null

// TabContext — новые необязательные поля
resend?: ((nid?: string, n?: number) => void) | undefined   // без nid — все
resendBusy?: boolean | undefined
openMessage?: ((nid: string, n: number) => void) | undefined

export type NotifView = { resend: (nid?: string, n?: number) => void; resendBusy: boolean; openMessage: (nid: string, n: number) => void }
```

### `apps/pi/src/shared/api`

```ts
// annul.ts (новый) — разбор для мапперов обеих сущностей
export function parseAnnul(v: unknown, path: string): AnnulState | null   // null → null; битое → contractError(path…)
export function parseCanAnnul(o: Record<string, unknown>, path: string): boolean   // нет ключа → false; не boolean → ошибка

// annul-ports.ts (новый)
export type AnnulQuery = { id: string; reason: string }
export type AnnulDecisionQuery = { id: string; when: string }
export type AnnulRejectQuery = AnnulDecisionQuery & { reason: string }
export type AnnulPorts<D> = {
  annulFx: Effect<AnnulQuery, void, ApiError>                 // POST /grids/{gridId}/documents/{id}/annul  { reason } → 202 (любой 2xx — принято)
  confirmAnnulFx: Effect<AnnulDecisionQuery, void, ApiError>  // POST …/annul/confirm  { when } → 202
  rejectAnnulFx: Effect<AnnulRejectQuery, void, ApiError>     // POST …/annul/reject   { when, reason } → 202
  detailFx: Effect<string, D, ApiError>                       // GET /grids/{gridId}/documents/{id} — перезапрос после команды
}
export function createAnnulPorts<D>(gridId: string, parseDetail: (v: unknown) => D): AnnulPorts<D>

// lookup-ports.ts (новый)
export type Rates = { cb: { rate: string; date: string; rub: string }; deal: { rate: string; from: string; to: string; amount: string } | null }
export type BalanceItem = { acc: string; ccy: string; balance: string; available: string | null } | { acc: string; ccy: string; error: string }
export type Balances = { asOf: string; items: BalanceItem[] }
export function parseRates(v: unknown): Rates
export function parseBalances(v: unknown): Balances
export const ratesFx: Effect<string, Rates, ApiError>                         // GET /grids/fx-docs/documents/{id}/rates
export function createBalancesFx(gridId: string): Effect<string, Balances, ApiError>  // GET /grids/{gridId}/documents/{id}/balances

// notif-ports.ts (новый)
export type NotifMessage = { contentType: 'application/json' | 'application/xml' | 'text/plain'; body: string }
export type ResendQuery = { id: string; nid?: string | undefined }
export type NotifPorts = {
  resendFx: Effect<ResendQuery, unknown, ApiError>                         // без nid: POST …/notifications/resend; с nid: …/notifications/{encodeURIComponent(nid)}/resend; тело {} → сырое тело вкладки notif
  messageFx: Effect<{ id: string; nid: string }, NotifMessage, ApiError>   // GET …/notifications/{encodeURIComponent(nid)}/message
}
export function createNotifPorts(gridId: string): NotifPorts
```

`Rates`, `Balances` в `types.ts` деталей — `import type` из `shared/api`.

### `shared/lib/host-links.ts`

```ts
export type HostLinks = { manualDeviations?: ((docId: string) => string) | undefined }
export function configureHostLinks(links: HostLinks): void      // заменяет набор целиком
export function hostLink(kind: keyof HostLinks, docId: string): string | null
export const HOST_LINK_MISSING = 'Переход не настроен для этого стенда'
```

### `features/doc-annul`

```ts
export type AnnulPromptKind = 'annul' | 'confirm' | 'reject'
export type AnnulPromptState = { kind: AnnulPromptKind; when: string | null; reason: string; busy: boolean; error: string | null }
export type DocAnnulConfig<D extends { id: string }> = {
  ports: AnnulPorts<D>
  lifecycle: PageLifecycle
  blockedDocs?: Store<Record<string, true>> | undefined    // документы с операцией правки; нет — блокировки нет (рубль)
  statusLabelOf: (d: D) => string                           // подпись статуса свежей детали — для «пока в статусе «…»»
}
export type DocAnnul<D> = {
  annulRequested: EventCallable<string>
  confirmRequested: EventCallable<{ docId: string; when: string }>
  rejectRequested: EventCallable<{ docId: string; when: string }>
  reasonChanged: EventCallable<{ docId: string; reason: string }>
  promptResult: EventCallable<{ docId: string; ok: boolean }>
  $prompt: Store<Record<string, AnnulPromptState>>
  $busyDocs: Store<Record<string, true>>                  // ключи $prompt
  $blockedDocs: Store<Record<string, true>>               // переданный blockedDocs или пустой
  docAnnulled: Event<{ id: string; detail: D; kind: AnnulPromptKind }>   // свежая деталь после принятой команды
  refreshNeeded: Event<{ id: string }>                                   // 409 или сбой перезапроса после 202
  $done: Store<{ count: number; text: string }>
}
export function createDocAnnul<D extends { id: string; annul: AnnulState | null }>(cfg: DocAnnulConfig<D>): DocAnnul<D>
export function useAnnulOf<D>(model: DocAnnul<D>): (docId: string) => AnnulView   // ui/useAnnulOf.tsx; объявляет $done через useKatran().announce
export const ANNUL_TEXT = {
  done: 'Документ аннулирован', pending: 'Запрос на аннулирование отправлен на утверждение',
  confirmed: 'Аннулирование утверждено', rejected: 'Аннулирование отклонено',
  unchanged: (label: string) => `Команда отправлена — документ пока в статусе «${label}»`,
  refreshFailed: 'Команда отправлена — не удалось обновить данные',
  conflict: 'Документ изменили — данные обновлены',
}
/** Текст итога по свежей детали (спека §3.3, г8). */
export function annulOutcome(kind: AnnulPromptKind, annul: AnnulState | null, statusLabel: string): string
export const ANNUL_HINT = {
  locked: (who: string) => `Документ заблокирован: ${who}`,
  pending: 'Запрос на аннулирование ожидает утверждения',
  done: 'Документ аннулирован',
  status: (label: string) => `Аннулирование недоступно для документа в статусе «${label}»`,
  busy: 'Завершите текущую операцию с документом',
}
```

`annulOutcome`: `annul` + `done` → `done`; `annul` + `pending` → `pending`; `confirm` + `done` → `confirmed`; `reject` + `rejected` → `rejected`; иначе → `unchanged(statusLabel)`. Причина — `REASON_MAX` из `shared/lib/detail`.

### `features/doc-edit` (расширение)

```ts
// DocEditConfig += blockedDocs?: Store<Record<string, true>> | undefined
// DocEdit<D> += $busyDocs: Store<Record<string, true>>    // открыт редактор (editScope), решение ($decision), сохранение ($savingDoc)
//              $blockedDocs: Store<Record<string, true>>
// confirmRequested/rejectRequested документа из blockedDocs игнорируются;
// useEditContexts: open, revert и canDecide документа из blockedDocs не действуют (как при decision !== null)
```

### `features/doc-lookups`

```ts
export type LookupEntry<T> = { state: 'loading' | 'ready' | 'error'; value: T | null; error: string | null }
export type Lookup<T> = {
  load: EventCallable<string>; retry: EventCallable<string>; refresh: EventCallable<string>; reset: EventCallable<string>
  $data: Store<Record<string, LookupEntry<T>>>
}
export function createLookup<T>(cfg: { fx: Effect<string, T, ApiError>; lifecycle: PageLifecycle }): Lookup<T>
export function useLookupOf<T>(lookup: Lookup<T>): (docId: string) => LookupView<T>
```

### `features/doc-notif`

```ts
export type NotifMessageState = { docId: string; nid: string; n: number; state: 'loading' | 'ready' | 'error'; message: NotifMessage | null; error: string | null }
export type DocNotif = {
  resendRequested: EventCallable<{ docId: string; nid?: string | undefined; n?: number | undefined }>   // без nid — все
  resendResult: EventCallable<{ docId: string; ok: boolean }>
  $resendPrompt: Store<{ docId: string; nid: string | null; n: number | null } | null>
  $resendBusy: Store<Record<string, string>>              // docId → nid в полёте или '*' (все); одна переотправка документа за раз
  resent: Event<{ id: string; data: unknown }>
  resendConflict: Event<{ id: string }>
  openMessage: EventCallable<{ docId: string; nid: string; n: number }>
  closeMessage: EventCallable<void>
  retryMessage: EventCallable<void>
  $message: Store<NotifMessageState | null>
  $notice: Store<{ count: number; text: string }>         // 'Нотификация переотправлена', тексты ошибок, 'Скопировано', COPY_FAILED
}
export function createDocNotif(cfg: { ports: NotifPorts; lifecycle: PageLifecycle }): DocNotif
export function useNotifOf(model: DocNotif): (docId: string) => NotifView
export function NotifOverlay({ model }: { model: DocNotif }): JSX.Element   // Prompt переотправки + MessageDialog, один на страницу
export const RESEND_TEXT = 'Нотификация переотправлена'
export const RESEND_PROMPT = { all: 'Переотправить все нотификации?', one: (n: number) => `Переотправить нотификацию № ${n}?`, note: 'Будет создана новая попытка отправки' }
export const COPIED_TEXT = 'Скопировано'
export const COPY_FAILED = 'Не удалось скопировать — выделите текст'
```

### `widgets/doc-detail`

```ts
// createDetail: Detail<D> += replaceTab: EventCallable<{ id: string; tab: string; data: unknown }>
// DocDetailProps += annulOf?: ((docId: string) => AnnulView) | undefined
//                   lookupsOf?: ((docId: string) => DetailLookups) | undefined
//                   notifOf?: ((docId: string) => NotifView) | undefined
```

### Регуляторы фейка (дополняют `params.ts`)

`?annul=instant|pending|fail` (`fail` — `202`, документ не меняется); `?fail=annul|rates|balances|resend|notifmsg` — `500`; `?hostlinks=1` — стенд (`app`, не фейк) вызывает `configureHostLinks({ manualDeviations: (id) => \`${origin}${pathname}#/manual-deviations?doc=${encodeURIComponent(id)}\` })`.

---

### Task 0: Worktree и база

**Files:** — (только леджер, git-ignored)

- [ ] **Step 1:** `git worktree add .worktrees/detail-ops -b feat/detail-ops main` в `katran`; `pnpm install`.
- [ ] **Step 2:** `pnpm check` — зелёный. Записать в леджер числа тестов по пакетам (`tokens`, `ui`, `effector`, `apps/pi`) и e2e (`pnpm --filter pi e2e`, передний план) — база для приращений.
- [ ] **Step 3:** записать в `/Users/shaman/_CODE/VTB/.claude/launch.json` **и** его `.bak` конфигурацию `katran-ops` (`--dir katran/.worktrees/detail-ops`, порт 5185) — удалить после слияния.

### Task 1: Сверка 2e

**Files:**
- Modify: `docs/reference/detail-drift.md` (новый раздел «2e — операции деталки» после «2d»; строки Д15, Д75; заголовок файла — «срезы 2a–2e»)

- [ ] **Step 1:** по `pi-constructor@e065bfb` (`git show e065bfb:grid.html`, `rub-grid.html`) выписать с номерами строк: «Курс» в сводке 32A, «Проверить баланс» в блоке транзакций (у рубля и у валюты — есть ли), кнопки `tasksHtml` и `notifHtml`, кнопки `esid`/`ban` лейна — есть ли обработчики (по единому обработчику клика `.dw`), какой вид у ссылок.
- [ ] **Step 2:** раздел «2e» в формате раздела «2d» (паспорт сверки, «Что делают кнопки на эталоне», таблица, сводка, «Не проверено»); Д-номера продолжают 2d (Д76…). Класс D — аннулирование и плашка (г2), «Курс» (г4), «Проверить баланс», «Переотправить», «Исходное сообщение», «Ручные отклонения» (г5); класс C — «Создать служебный документ» (г3). Колонка katran — «план 2e, Task N»; факт по коду — в Task 14.
- [ ] **Step 3:** Д15 и Д75 — ссылки на новые строки.
- [ ] **Step 4:** коммит `Сверка 2e: аннулирование, курс, баланс, кнопки вкладок против e065bfb`.

### Task 2: Контракт — разборщики и `pi-api.md`

**Files:**
- Create: `apps/pi/src/shared/api/annul.ts`, `annul.test.ts`
- Create: `apps/pi/src/shared/api/lookup-ports.ts` (пока только типы и `parseRates`/`parseBalances`), `lookup-ports.test.ts`
- Create: `apps/pi/src/shared/api/notif-ports.ts` (пока только `NotifMessage` и `parseNotifMessage`), `notif-ports.test.ts`
- Modify: `apps/pi/src/shared/lib/detail/types.ts` (`AnnulStatus`, `AnnulState`, `AnnulInfo`, `AnnulLane`, `AnnulView`, `LookupState`, `LookupView`, `DetailLookups`, `NotifView`, поля `TabContext`, `DetailDomain.annulInfo`, четвёртый параметр `renderHero`/`renderBlock`), `index.ts`
- Modify: `apps/pi/src/entities/fx-doc/model/detail.ts`, `api/detail.mapper.ts`, `detail.mapper.test.ts`, `detail.example.ts`; то же в `entities/rub-doc`
- Modify: `apps/pi/src/entities/doc-trail/model/types.ts` (`DocNotification.id`), `api/trail.mapper.ts`, `trail.mapper.test.ts`, `trail.example.ts`
- Modify: `apps/pi/src/shared/api/index.ts`
- Modify: `docs/reference/pi-api.md` — §1 новые §1.11 `annul` (+ confirm/reject), §1.12 `rates`, §1.13 `balances`, §1.14 нотификации; §7.2/§7.3 `canAnnul`, `annul`; §8.5 `id`; таблица ошибок спеки §3.1 п. 8; §1.x «Решения 2e» (г2, г8 — команда `202` и перезапрос, фронт статусами не управляет; г9 — пример условия на CEL из спеки §3.1 п. 4, помечен «не контракт»); у нотификаций — `resend` всех и одной

**Interfaces:** Produces — `parseAnnul`, `parseCanAnnul`, `parseRates`, `parseBalances`, `parseNotifMessage`, типы раздела «shared/lib/detail» сквозного контракта; `FxDocDetail`/`RubDocDetail` получают `canAnnul: boolean`, `annul: AnnulState | null`.

- [ ] **Step 1: падающие тесты `annul.test.ts`:** `parseAnnul(null)` → `null`; полный `pending` с `by: null, at: null, rejectReason: null, canConfirm: true` разбирается; `status: "cancelled"` → ошибка с путём `ответ.annul.status`; нет ключа `canConfirm` → ошибка с путём `ответ.annul.canConfirm` (ключи обязательны, спека §3.1 п. 2); `parseCanAnnul({})` → `false`; `{ canAnnul: "yes" }` → ошибка `ответ.canAnnul`.
- [ ] **Step 2: падающие тесты `lookup-ports.test.ts`:** `parseRates` с `deal: null` и с `deal`; число вместо строки в `cb.rate` → ошибка с путём; `parseBalances` — элемент с `balance`/`available: null` и элемент с `error` разбираются в два вида `BalanceItem`; элемент без `balance` и без `error` → ошибка `ответ.items[1]`.
- [ ] **Step 3: падающие тесты `notif-ports.test.ts`:** `parseNotifMessage` с тремя `contentType`; `"text/html"` → ошибка `ответ.contentType`.
- [ ] **Step 4: падающие тесты мапперов:** деталь без `canAnnul`/`annul` → `false`/`null` (обратная совместимость примеров 2d); пример с `annul` — разобран; нотификация без `id` → ошибка `ответ.notifications[0].id`.
- [ ] **Step 5:** реализовать; guard `bool` — в `guards.ts`, если его ещё нет (с тестом). Примеры `detail.example.ts`/`trail.example.ts` дополнить полями.
- [ ] **Step 6:** `pi-api.md` по спеке §3.1 дословно (тела, ответы, коды, тексты, примеры JSON — один `pending`, один ответ `rates` с `deal`, один `balances` с ошибкой счёта, одна нотификация с `id`, ответ `message`).
- [ ] **Step 7:** `pnpm check` — зелёный; коммит `Контракт 2e: canAnnul и annul у детали, курсы, остатки, id и сообщение нотификации; разборщики и pi-api`.

### Task 3: Фейк

**Files:**
- Create: `apps/pi/src/app/fake/annul.ts`, `apps/pi/src/app/fake/lookups.ts`, `apps/pi/src/app/fake/notif.ts`
- Modify: `apps/pi/src/app/fake/server.ts` (маршруты), `params.ts` (`annulMode`, JSDoc регуляторов), `fx-docs.detail.ts`, `rub-docs.detail.ts` (`canAnnul`, `annul`), `fx-docs.trail.ts`, `rub-docs.trail.ts` (`id`, дописанные попытки), `contract.test.ts`, `server.test.ts`

**Interfaces:** Consumes — разборщики Task 2 (через `contract.test.ts`). Produces — `FakeServerOptions.annulMode?: () => string | null`.

- [ ] **Step 1: падающие тесты `server.test.ts`** (по одному на правило спеки §3.7):
  - `canAnnul` — `true` у `IN_PROGRESS`/`TO_EXPORT`/`ERROR`/`DEFERRED` без `lock` и без открытого запроса; `false` у `DONE`;
  - `annul` → `202` без тела; последующий `GET …/documents/{id}`: суммы ≤ 1 000 000 — `annul.status: "done"`, статус `REJECTED`, `canAnnul: false`; > 1 000 000 — `pending`, `who: "Вы"`, `canConfirm: false`;
  - `annulMode: () => 'instant'` у суммы > 1 000 000 → `done`; `'pending'` у малой → `pending`; `'fail'` → `202`, деталь не изменилась;
  - причина `"   "` → `400`, `errors[0].path === "reason"`; 141 символ → `400`; документ `DONE` → `409`; заблокированный → `403`;
  - сид: чужой `pending` (Кузнецов Д. А., `canConfirm: true`) — `confirm` с его `when` → `202`, в детали `done`, `by: "Вы"`; `reject` с причиной → `202`, в детали `rejected`, `rejectReason`, статус прежний, `canAnnul: true`; чужой `when` → `409`; `confirm` своего запроса → `403`;
  - `rates` валюты — детерминирован (два вызова равны), `deal` есть у документа с полем 36, нет у прочих; `rates` рубля → `404`;
  - `balances` — счета уникальны и в порядке проводок; у счёта сида `error: "Счёт не найден в АБС"`;
  - вкладка `notif` — у каждой строки `id`; `message` валюты — `application/json`, рубля — `application/xml`, одна строка сида — `text/plain`; неизвестный `nid` → `404`;
  - `resend` всех → `200`, по новой попытке `OK` к каждой нотификации не в `OK` (все в `OK` — к последней); `resend` одной (`…/notifications/{nid}/resend`) — одна новая попытка; неизвестный `nid` → `404`; повтор в пределах задержки → `409`; `GET …/tabs/notif` после `resend` видит дописанные попытки;
  - `?fail=annul|rates|balances|resend|notifmsg` → `500` на своём запросе.
- [ ] **Step 2:** `contract.test.ts` — все новые ответы проходят разборщики Task 2 (как для 2d).
- [ ] **Step 3:** реализовать. Состояние аннулирований и дописанных попыток — модульные `Map` по `id`, сбрасываемые тем же способом, что состояние правок (`edits.ts`). Курсы — таблица `{ USD, EUR, CNY, … } × дата` от хеша даты (вымышленные числа, 4 знака), форматирование — функциями формата фейка (запятая, неразрывные пробелы). Сид — выбрать документы по существующим индексам данных и описать в JSDoc `annul.ts`; там же — правило в CEL из спеки §3.1 п. 4 (фейк его исполняет кодом).
- [ ] **Step 4:** `pnpm --filter pi exec vitest run src/app/fake` — PASS; `pnpm check` — зелёный.
- [ ] **Step 5:** коммит `Фейк 2e: аннулирование сразу и через утверждение, курсы, остатки, id и тела нотификаций, переотправка, регуляторы`.

### Task 4: Порты

**Files:**
- Modify: `apps/pi/src/shared/api/annul-ports.ts` (создать), `lookup-ports.ts`, `notif-ports.ts`, их тесты, `index.ts`
- Modify: `apps/pi/src/entities/fx-doc/api/ports.ts`, `entities/rub-doc/api/ports.ts` — `fxAnnulPorts`, `rubAnnulPorts` (через `createAnnulPorts` и маппер детали), экспорт из `index.ts` сущностей

**Interfaces:** Produces — `createAnnulPorts`, `ratesFx`, `createBalancesFx`, `createNotifPorts` (сквозной контракт); `fxAnnulPorts: AnnulPorts<FxDocDetail>`, `rubAnnulPorts: AnnulPorts<RubDocDetail>`.

- [ ] **Step 1: падающие тесты** (через `requestFx.use` в `fork`, как `edit-ports.test.ts`): `annulFx({ id: 'a/b', reason: 'x' })` → `POST /grids/fx-docs/documents/a%2Fb/annul`, тело `{ reason: 'x' }`, ответ `202` с пустым телом → `undefined` (и `204`, `200` — тоже успех); `confirmAnnulFx` → `…/annul/confirm` `{ when }`; `rejectAnnulFx` → `…/annul/reject` `{ when, reason }`; `detailFx('1')` → `GET /grids/fx-docs/documents/1` через `parseDetail`; `ratesFx('1')` → `GET /grids/fx-docs/documents/1/rates`; `createBalancesFx('rub-docs')('1')` → `GET /grids/rub-docs/documents/1/balances`; `resendFx({ id: '1' })` → `POST …/notifications/resend` с телом `{}`; `resendFx({ id: '1', nid: 'n:1' })` → `POST …/notifications/n%3A1/resend`; `messageFx({ id: '1', nid: 'n:1' })` → `GET …/notifications/n%3A1/message`; не-2xx → `ApiError` со статусом.
- [ ] **Step 2:** реализовать.
- [ ] **Step 3:** `pnpm check` — зелёный; коммит `Порты 2e: аннулирование, курсы, остатки, нотификации`.

### Task 5: Кит — `Dialog`, `Banner`, `Prompt` на `Dialog`

**Files:**
- Create: `packages/ui/src/overlay/Dialog.tsx`, `Dialog.module.css`, `Dialog.test.tsx`
- Create: `packages/ui/src/state/Banner.tsx`, `Banner.module.css`, `Banner.test.tsx`
- Modify: `packages/ui/src/overlay/Prompt.tsx`, `Prompt.module.css` (общее уходит в `Dialog`), `overlay/index.ts`, `state/index.ts`, `src/index.ts`
- Modify: `packages/tokens/src/tokens.src.ts` (ширина `l` окна, тона плашки — если существующих токенов не хватает) → `pnpm gen`
- Modify: `packages/ui/CHANGELOG.md`, демо кита (страницы `Dialog` и `Banner`, по примеру на каждое свойство)

**Interfaces:** Produces — раздел «Кит» сквозного контракта.

- [ ] **Step 1: падающие тесты `Dialog`:** `role="dialog"`, `aria-modal="true"`, имя — из `title`; Tab с последнего фокусируемого — на первый; Esc → `onClose` один раз, а обработчик `keydown` на родителе **не** вызван; mousedown по подложке → `onClose`; `busy` → Esc и подложка не вызывают `onClose`, `aria-busy="true"`; закрытие возвращает фокус на кнопку, открывшую окно; кнопки нет в DOM → `fallbackFocus`; `role="alertdialog"` передаётся; axe без нарушений.
- [ ] **Step 2: падающие тесты `Banner`:** текст в `role="status"`, кнопки `actions` — вне него (`within(status).queryByRole('button')` → `null`); `onClose` → кнопка «Закрыть» (или `closeLabel`), клик вызывает; без `onClose` кнопки нет; `data-tone` по тону; axe без нарушений.
- [ ] **Step 3:** `Prompt` переписать поверх `Dialog` (`role="alertdialog"`, `size="m"`, `footer` — кнопки), свойства и поведение — без изменений.
- [ ] **Step 4:** `pnpm --filter @katran/ui exec vitest run src/overlay src/state` — PASS, **тесты `Prompt.test.tsx` не правились**; `pnpm check` — зелёный.
- [ ] **Step 5:** коммит `Кит: Dialog и Banner; Prompt поверх Dialog без изменения поведения`.

### Task 6: Справочные запросы — `createLookup`, «Курс», «Проверить баланс»

**Files:**
- Create: `apps/pi/src/features/doc-lookups/index.ts`, `model/createLookup.ts`, `model/createLookup.test.ts`, `ui/useLookupOf.ts`, `ui/useLookupOf.test.tsx`
- Create: `apps/pi/src/entities/fx-doc/ui/RatesView.tsx` (+ тест), `apps/pi/src/entities/posting/ui/BalancesView.tsx` (+ тест), стили — в существующих модулях CSS сущностей
- Modify: `apps/pi/src/entities/fx-doc/ui/detail.tsx` (`fxHero` ячейка `32A` — кнопка-ссылка «Курс» при `lookups?.rates`), `entities/posting/ui/TxBlock.tsx` (`balances?: LookupView<Balances>` → «Проверить баланс» в `aside`), места вызова `TxBlock` в `fx-doc` и `rub-doc` (`renderBlock` получает `lookups`)
- Modify: `apps/pi/src/widgets/doc-detail/ui/DocDetail.tsx` (свойство `lookupsOf`, четвёртый аргумент `renderHero`/`renderBlock`), `DocDetail.test.tsx`

**Interfaces:** Consumes — `Rates`, `Balances`, `LookupView`, `DetailLookups` (Task 2). Produces — `createLookup`, `useLookupOf` (сквозной контракт).

- [ ] **Step 1: падающие тесты `createLookup`:** `load('1')` → `loading` → `ready` со значением; второй `load('1')` при `ready` — `fx` не вызван; ошибка → `error` с текстом Problem `detail` (или `message`); `retry` после ошибки — запрос; `refresh` при `ready` — запрос, во время запроса `state: 'loading'` и **прежнее `value`**; неудачный `refresh` → `state: 'error'`, `value` прежнее (Review Focus 3); `reset('1')` во время запроса — ответ отброшен, записи нет; `pageClosed` — `$data` пуст, ответ после него отброшен.
- [ ] **Step 2: падающие тесты видов:**
  - `RatesView` (`ready`, с `deal`): «Курс ЦБ на 22.09.2026 — 92,4517 RUB за 1 USD», «Рублёвый эквивалент — … RUB», «Курс сделки EUR→USD — 1,0886 · списано … EUR»; без `deal` — третьей строки нет;
  - `BalancesView`: заголовки «Счёт», «Валюта», «Остаток», «Доступно»; `available: null` → «—»; строка с `error` — текст ошибки, ячейка на всю ширину; «по состоянию на {asOf}»; «Обновить» вызывает `refresh`; при `refresh` старая таблица видна;
  - общее: `loading` — скелетон (`aria-busy`), `error` — текст и «Повторить» (`retry`);
  - `fxHero('32A')` с `lookups.rates` — кнопка «Курс», клик открывает `Popover` с подписью «Курс» и вызывает `load`; Esc закрывает, фокус на «Курс», `keydown` до drawer не дошёл; без `lookups` — кнопки нет;
  - `TxBlock` с `balances` — кнопка «Проверить баланс», клик не меняет `aria-expanded` блока.
- [ ] **Step 3:** реализовать. Поповер — `Popover` кита (`role="dialog"`, `returnFocus` — кнопка-ссылка); кнопка-ссылка — существующий `LinkButton`-вид сущностей или `Button variant="link"` кита (что есть).
- [ ] **Step 4:** `pnpm check` — зелёный; коммит `Курс и Проверить баланс: createLookup, поповеры в сводке 32A и блоке транзакций`.

### Task 7: Модель аннулирования и блокировка с правкой

**Files:**
- Create: `apps/pi/src/features/doc-annul/index.ts`, `model/createDocAnnul.ts`, `model/createDocAnnul.test.ts`
- Modify: `apps/pi/src/features/doc-edit/model/createDocEdit.ts` (`blockedDocs`, `$busyDocs`, `$blockedDocs`), `createDocEdit.test.ts`, `ui/useEditContexts.ts`, `useEditContexts.test.tsx`
- Modify: `apps/pi/src/entities/fx-doc/model/rules.ts` (цели правки пусты при `annul?.status` `pending`/`done`), `rules.test.ts`, `apps/pi/src/app/fake/server.test.ts`

**Interfaces:** Consumes — `AnnulPorts` (Task 4), `AnnulState` (Task 2), `REASON_MAX`. Produces — `createDocAnnul`, `DocAnnul`, `ANNUL_TEXT`, `ANNUL_HINT`, `annulOutcome` (сквозной контракт), расширение `DocEdit`.

- [ ] **Step 1: падающие тесты `createDocAnnul`:**
  - `annulRequested('1')` → `$prompt['1'] = { kind: 'annul', when: null, reason: '', busy: false, error: null }`; `reasonChanged`; `promptResult({ ok: true })` с причиной `"  "` — запроса нет;
  - `annulFx` принят → `detailFx('1')` (пока он идёт, `$prompt['1'].busy === true`) → `docAnnulled({ id, detail, kind: 'annul' })` со свежей деталью, `$prompt` без `'1'`; текст по свежей детали: `done` → «Документ аннулирован», `pending` → «Запрос на аннулирование отправлен на утверждение», `annul: null` → «Команда отправлена — документ пока в статусе «В работе»» (`statusLabelOf`);
  - `detailFx` упал после принятой команды → `$prompt` без `'1'`, `refreshNeeded({ id })`, `$done.text === ANNUL_TEXT.refreshFailed`, `docAnnulled` не выпущен;
  - `confirmRequested({ docId, when })` → `kind: 'confirm'`, запрос `{ id, when }`, затем `detailFx`; `done` → «Аннулирование утверждено»; `rejectRequested` → причина обязательна, запрос `{ id, when, reason }`; `rejected` → «Аннулирование отклонено»; итог не наступил → `unchanged`;
  - `annulOutcome` — таблица всех сочетаний `kind` × `annul.status` (+ `null`);
  - `400` → `error` из `errors[0].message`, `busy: false`, `Prompt` открыт; `403`/`5xx` команды → `error` текста; `409` → `$prompt` без документа, `refreshNeeded({ id })`, `$done.text === ANNUL_TEXT.conflict`;
  - `promptResult({ ok: false })` при `busy` — игнор; без `busy` — закрыть;
  - документ в `blockedDocs` → `annulRequested`/`confirmRequested`/`rejectRequested` игнорируются; **другой** документ — нет (Review Focus 2);
  - второй `annulRequested` того же документа при открытом `Prompt` — игнор;
  - поздний ответ после `pageClosed` того же визита — `docAnnulled` выпущен, `$prompt` и `$done` не меняются; ответ прошлого визита — отброшен (как R10 2d) (Review Focus 1);
  - `$busyDocs` — ключи `$prompt`.
- [ ] **Step 2: падающие тесты `createDocEdit`/`useEditContexts`:** `$busyDocs` содержит документ при открытом редакторе, решении, сохранении и не содержит после; при `blockedDocs = { '1': true }` — `confirmRequested` документа `'1'` игнорируется, `open`/`revert` контекста `'1'` не действуют, `canDecide` → `false`; документ `'2'` не затронут; без `blockedDocs` — тесты 2d зелёные без правок.
- [ ] **Step 3: падающие тесты `rules.ts` и фейка:** деталь с `annul.status: 'pending'` и `'done'` → целей нет; `'rejected'` → цели как без `annul`. Фейк проверяет цель правки теми же правилами — `server.test.ts`: после `annul` валютного документа `POST …/edits` отвечает так же, как сейчас на цель вне правил (код и путь — по факту `edits.ts`).
- [ ] **Step 4:** реализовать; при открытом `Prompt` аннулирования открытый редактор того же документа невозможен (блокировка взаимна), отдельного закрытия не нужно.
- [ ] **Step 5:** `pnpm check` — зелёный; коммит `Модель аннулирования: команда и перезапрос детали, итог по свежим данным, решения второй руки, 409, поздний ответ; взаимная блокировка с правкой`.

### Task 8: Вид аннулирования — кнопка лейна, плашка, `Prompt`

**Files:**
- Create: `apps/pi/src/features/doc-annul/ui/useAnnulOf.tsx`, `useAnnulOf.test.tsx`
- Modify: `apps/pi/src/widgets/doc-detail/ui/DocDetail.tsx` (свойство `annulOf`; кнопка `ban` через `lane`; плашка между лейном и сводкой; `prompt` — в `Drawer.overlay`; `LATER` — только `esid`), `DocDetail.module.css`, `DocDetail.test.tsx`
- Modify: `apps/pi/src/pages/fx-docs/ui/detailDomain.ts`, `pages/rub-docs/ui/detailDomain.ts` — `annulInfo` (подпись статуса — из `entities/doc-status`, `subject` — номер, сумма и валюта из детали); та же подпись статуса — функция `statusLabelOf` сущностей для `createDocAnnul` (экспорт из `index.ts` сущностей)
- Modify: `apps/pi/src/entities/doc-trail/ui/lib.ts` — `STUB = 'Действие пока недоступно'`; тот же текст у заглушки лейна виджета

**Interfaces:** Consumes — `DocAnnul`, `ANNUL_TEXT`, `ANNUL_HINT` (Task 7), `Banner`, `Prompt` (Task 5), `AnnulInfo`/`AnnulView` (Task 2). Produces — `useAnnulOf`.

- [ ] **Step 1: падающие тесты `useAnnulOf`** (рендер `lane`/`banner`/`prompt` с фикстурами `AnnulInfo`):
  - `lane`: `canAnnul` → доступна, `hint: null`; `lockedBy` → `ANNUL_HINT.locked('Иванова М. П.')`; `annul.status: 'pending'` → `ANNUL_HINT.pending`; `'done'` → `ANNUL_HINT.done`; иначе без `canAnnul` → «Аннулирование недоступно для документа в статусе «Обработан»»; документ в `$blockedDocs` или `$busyDocs` → `ANNUL_HINT.busy`; `run` вызывает `annulRequested`;
  - `banner`: `pending` + `canConfirm` → тон warn, текст «Аннулирование ожидает утверждения · Кузнецов Д. А., 23.09.2026 10:00 · Причина: …», кнопки «Утвердить», «Отклонить»; без `canConfirm` — без кнопок; `done` → тон bad, «Документ аннулирован · {by ?? who}, {at ?? when} · Причина: …»; `rejected` → тон neutral, «Запрос на аннулирование отклонён · {by}, {at} · {rejectReason}», кнопка «Закрыть» вызывает `onDismiss`; `dismissed: true` → `null`;
  - `prompt`: `annul` → «Аннулировать документ?», пояснение `subject`, поле «Причина» (обязательное, `maxLength` 140, счётчик «0/140»), «Аннулировать» недоступна при пустой причине, тон danger; `confirm` → «Утвердить аннулирование?» (автор, время, причина запроса), «Утвердить»/«Отмена»; `reject` → «Отклонить аннулирование?» с причиной, «Отклонить»/«Отмена», тон danger; `busy` → кнопки недоступны; `error` → `role="alert"`;
  - объявление `$done` через `announce`.
- [ ] **Step 2: падающие тесты `DocDetail`:** с `annulOf` кнопка «Аннулировать» — `aria-disabled` и подсказка из `lane`, клик по доступной вызывает `run`; без `annulOf` — прежнее объявление; плашка — между лейном и сводкой; закрытие плашки `rejected` прячет её до закрытия деталки, при повторном открытии того же документа (тот же `annul.when`) — снова видна; `Prompt` в overlay drawer своего документа; после решения фокус — заголовок drawer.
- [ ] **Step 3:** реализовать.
- [ ] **Step 4:** `pnpm check` — зелёный; `details.a11y.test.tsx` — плашка трёх видов и `Prompt` аннулирования без нарушений; коммит `Аннулирование в деталке: кнопка лейна с подсказками, плашка запроса, Prompt аннулирования и решений`.

### Task 9: Модель нотификаций и `createDetail.replaceTab`

**Files:**
- Create: `apps/pi/src/features/doc-notif/index.ts`, `model/createDocNotif.ts`, `model/createDocNotif.test.ts`
- Modify: `apps/pi/src/widgets/doc-detail/lib/createDetail.ts`, `createDetail.test.ts`, `widgets/doc-detail/index.ts`

**Interfaces:** Consumes — `NotifPorts` (Task 4). Produces — `createDocNotif`, `DocNotif`, `RESEND_TEXT`, `COPIED_TEXT`, `COPY_FAILED`; `Detail<D>.replaceTab`.

- [ ] **Step 1: падающие тесты `replaceTab`:** после `replaceTab({ id, tab: 'notif', data })` вкладка документа — `{ state: 'ready', data, error: null }`, другие вкладки и деталь не тронуты; запрос вкладки `notif`, ушедший **до** `replaceTab`, по ответу кэш не перезаписывает (Review Focus 4); запрос после `replaceTab` — перезаписывает; `replaceTab` закрытого документа (нет в слотах) — кэш пишется, как у `replaceDetail` (решение исполнителя по образцу `replaceDetail`, записать в леджер).
- [ ] **Step 2: падающие тесты `createDocNotif`:** `resendRequested({ docId: '1' })` → `$resendPrompt` `{ docId: '1', nid: null, n: null }`; с `nid: 'n2', n: 2` — `{ docId: '1', nid: 'n2', n: 2 }`; `resendResult({ ok: false })` → `null`, запроса нет; `ok: true` → `$resendBusy['1'] === '*'` (или `'n2'`), `resendFx({ id: '1' })` (или `{ id: '1', nid: 'n2' })`; второй `resendRequested` документа при `busy` (любой `nid`) — игнор; успех → `resent({ id: '1', data })`, `$notice.text === RESEND_TEXT`, `$resendPrompt === null`; `409` → `resendConflict({ id })`, `$notice` — текст Problem; `5xx` → `$notice` — текст; `openMessage({ docId, nid, n: 2 })` → `$message.state === 'loading'`, затем `ready` с `message`; ошибка → `error`; `retryMessage` → запрос заново; `closeMessage` → `null`; ответ для закрытого окна или окна другого `nid` отброшен; `pageClosed` — всё сброшено.
- [ ] **Step 3:** реализовать. В `createDetail` — отметка вкладки (`${id}:${tab}`), растущая на `replaceTab`; ответ запроса с прежней отметкой отбрасывается.
- [ ] **Step 4:** `pnpm check` — зелёный; коммит `Нотификации: модель переотправки и исходного сообщения, createDetail.replaceTab`.

### Task 10: Вкладка «Нотификации» и окно сообщения

**Files:**
- Create: `apps/pi/src/features/doc-notif/ui/useNotifOf.ts`, `ui/NotifOverlay.tsx`, `ui/MessageDialog.tsx`, их тесты, стили
- Modify: `apps/pi/src/entities/doc-trail/ui/NotificationsTab.tsx`, `tabs2.test.tsx` (или тест вкладки)
- Modify: `apps/pi/src/widgets/doc-detail/ui/DocDetail.tsx` — свойство `notifOf`, поля `TabContext` из него; `DocDetail.test.tsx`

**Interfaces:** Consumes — `DocNotif` (Task 9), `Dialog`, `Prompt` (Task 5), `CodeView`, `NotifView`/`TabContext` (Task 2). Produces — `useNotifOf`, `NotifOverlay`.

- [ ] **Step 1: падающие тесты `NotificationsTab`:** с `ctx.resend` в панели «Переотправить все» → `resend()`; в строке 2 ссылка «Переотправить» (имя «Переотправить, отправка 2») → `resend(nid строки, 2)`; без `ctx.resend` в строке ссылки нет, в панели — прежняя «Переотправить» с объявлением `STUB`; `resendBusy` → все кнопки переотправки `aria-disabled="true"`, клик не вызывает; «Исходное сообщение» строки 2 → `openMessage(nid строки, 2)`; без `ctx.resend`/`ctx.openMessage` — объявление `STUB` (как в 2b).
- [ ] **Step 2: падающие тесты `NotifOverlay`/`MessageDialog`:** `$resendPrompt` всех → `Prompt` «Переотправить все нотификации?», одной (`n: 2`) → «Переотправить нотификацию № 2?»; пояснение «Будет создана новая попытка отправки», «Переотправить»/«Отмена»; `$message` `loading` → скелетон; `ready` `application/json` → `CodeView language="json"`, `application/xml` → `xml`, `text/plain` → `text`; заголовок «Исходное сообщение · отправка 2»; «Скопировать» → `navigator.clipboard.writeText(body)` (эффектом), объявление «Скопировано»; отказ буфера → «Не удалось скопировать — выделите текст»; «Закрыть» и Esc → `closeMessage`, `keydown` до drawer не дошёл, фокус — на ссылку строки (Review Focus 5); `error` → текст и «Повторить»; axe без нарушений; `$notice` объявляется.
- [ ] **Step 3:** реализовать.
- [ ] **Step 4:** `pnpm check` — зелёный; коммит `Вкладка «Нотификации»: Переотправить все и одну с подтверждением, окно исходного сообщения с подсветкой и копированием`.

### Task 11: Переход к ручным отклонениям

**Files:**
- Create: `apps/pi/src/shared/lib/host-links.ts`, `host-links.test.ts`
- Modify: `apps/pi/src/entities/doc-trail/ui/TasksTab.tsx`, его тест
- Modify: `apps/pi/src/app/transport.ts` (комментарий-пример для хоста), `apps/pi/src/app/entry.tsx` или место подключения стенда (`?hostlinks=1` → `configureHostLinks`, см. «Регуляторы»)

**Interfaces:** Produces — `configureHostLinks`, `hostLink`, `HOST_LINK_MISSING`.

- [ ] **Step 1: падающие тесты:** `hostLink('manualDeviations', '1')` без настройки → `null`; после `configureHostLinks({ manualDeviations: (id) => '/md?doc=' + id })` → `'/md?doc=1'`; повторный `configureHostLinks({})` → снова `null`. `TasksTab`: со ссылкой — `getByRole('link', { name: 'Перейти в блок «Ручные отклонения»' })` с `href`, `target="_blank"`, `rel="noopener"`; без — кнопка `aria-disabled="true"` с подсказкой `HOST_LINK_MISSING`, клик ничего не объявляет. Тесты восстанавливают настройку в `afterEach`.
- [ ] **Step 2:** реализовать; ссылка выглядит кнопкой `Button size="s"` кита (класс/вариант кита для `<a>` — если его нет, добавить в кит `Button` свойство `href` с тестом и записью в CHANGELOG).
- [ ] **Step 3:** `pnpm check` — зелёный; коммит `Переход к ручным отклонениям: ссылка хоста в новой вкладке, configureHostLinks, регулятор стенда`.

### Task 12: Страницы и связи

**Files:**
- Create: `apps/pi/src/pages/fx-docs/model/annul.model.ts`, `lookups.model.ts`, `notif.model.ts` (+ тесты связей); то же в `pages/rub-docs/model` (без `rates`)
- Modify: `apps/pi/src/pages/fx-docs/model/edit.model.ts` (`blockedDocs` — стор занятости аннулирования, см. Step 2), `pages/*/ui/*DocsPage.tsx` (`annulOf`, `lookupsOf`, `notifOf`, `NotifOverlay`), `pages/*/index.ts`

**Interfaces:** Consumes — всё выше.

- [ ] **Step 1: падающие тесты связей** (`fork`, порты подменены `fork({ handlers })`):
  - `docAnnulled` → `detail.replaceDetail` + `registry.refreshRequested` + `reset` остатков (и курсов) документа; `refreshNeeded` → `detail.refreshDoc(id)` + `registry.refreshRequested`;
  - `detail.refreshDoc(id)` и `replaceDetail` → `reset` lookup-ов документа;
  - `resent` → `detail.replaceTab({ id, tab: 'notif', data })`; `resendConflict` → `detail.refreshDoc`;
  - валюта: открыт редактор документа `'1'` → `annulRequested('1')` игнорируется; открыт `Prompt` аннулирования `'1'` → `open` правки `'1'` не действует;
  - R12-аналог: открытый не `busy` `Prompt` аннулирования документа, ушедшего из слотов, снимается (`promptResult({ ok: false })`).
- [ ] **Step 2:** реализовать. Цикл «правка ↔ аннулирование» разорвать промежуточным стором страницы: `$annulBusy = createStore<Record<string, true>>({})` объявлен до `docEdit` и передан ему как `blockedDocs`; `docAnnul` создаётся с `blockedDocs: docEdit.$busyDocs`; `sample({ clock: docAnnul.$busyDocs, target: $annulBusy })`. Рубль — `createDocAnnul` без `blockedDocs`.
- [ ] **Step 3:** ручная проверка на стенде (`katran-ops`, 5185): все действия спеки §4 по разу на обоих реестрах; найденное — в леджер и фикс в этой же задаче.
- [ ] **Step 4:** `pnpm check` — зелёный; коммит `Страницы 2e: связи аннулирования, справочных запросов и нотификаций с деталкой и реестром`.

### Task 13: e2e

**Files:**
- Create: `apps/pi/e2e/detail-ops.spec.ts`

- [ ] **Step 1:** сценарии спеки §5 (e2e), каждый — отдельный `test`:
  - `?annul=instant`: аннулировать документ `IN_PROGRESS` с причиной → плашка «Документ аннулирован», статус в шапке «Отказ», кнопка `aria-disabled` с подсказкой «Документ аннулирован», карандашей нет;
  - несостоявшееся (`?annul=fail`): объявление «Команда отправлена — документ пока в статусе «{статус}»», статус в шапке прежний, плашки нет, кнопка снова доступна;
  - через ожидание (`?annul=pending`): плашка warn без кнопок решения; сидовый чужой запрос — «Утвердить» → плашка `done`, объявление «Аннулирование утверждено»;
  - отклонение сидового запроса с причиной → плашка «Запрос на аннулирование отклонён · … · {причина}», «Закрыть» прячет, закрыть и открыть деталку — снова видна;
  - кнопка у документа `DONE` — подсказка «Аннулирование недоступно для документа в статусе «Обработан»»;
  - блокировка: открыт редактор поля → «Аннулировать» с подсказкой «Завершите текущую операцию с документом»;
  - «Курс»: три строки текста (документ с полем 36), Esc закрывает, деталь открыта, фокус на «Курс»;
  - «Проверить баланс» (валюта и рубль): таблица, строка «Счёт не найден в АБС», «Обновить» — запрос по `FAKE_REQUEST_EVENT`;
  - переотправка всех: «Переотправить все» → «Переотправить все нотификации?» → новые строки, объявление «Нотификация переотправлена»; одной: «Переотправить» в строке 2 → «Переотправить нотификацию № 2?» → строк на одну больше;
  - исходное сообщение: окно с подсветкой (`CodeView`), Esc закрывает окно, деталь открыта, фокус на ссылке строки;
  - «Ручные отклонения»: без регулятора — `aria-disabled`; `?hostlinks=1` — `context.waitForEvent('page')`, адрес содержит `manual-deviations?doc=<id>`;
  - `?fail=annul|rates|balances|resend|notifmsg` — текст ошибки на месте действия, повтор доступен;
  - контраст текста плашек warn/bad/neutral ≥ 4,5 (тем же помощником, что в `lane-actions.spec.ts`).
- [ ] **Step 2:** `pnpm --filter pi exec playwright test e2e/detail-ops.spec.ts` — **на переднем плане**, PASS; затем весь `pnpm --filter pi e2e` — PASS (прежние 81 + новые).
- [ ] **Step 3:** коммит `e2e 2e: аннулирование командой (сразу, через утверждение, без изменений), решения, курс, баланс, переотправка, исходное сообщение, ручные отклонения, отказы, контраст плашек`.

### Task 14: Документы

**Files:**
- Modify: `docs/reference/pi-usage.md` (подключение хостом: `configureHostLinks`, новые свойства `DocDetail`, связи страниц), `docs/reference/detail-drift.md` (колонка katran 2e — факт по коду, паспорт сверки — коммит ветки), `packages/ui/CHANGELOG.md` (сверка), `apps/pi` CHANGELOG/README (если ведутся), `docs/STATE.md` (§6 состояние, §7 техдолг — служебный документ, открытые вопросы спеки 2e §8, §9 следующий шаг), спека 2e §9 — уточнения исполнения с номерами Ruling из леджера

- [ ] **Step 1:** обновить; тексты — по факту кода, расхождения со спекой — в спеку §9.
- [ ] **Step 2:** `pnpm check` — зелёный; коммит `Документы 2e: pi-usage, сверка по факту, CHANGELOG, STATE, спека §9`.

### Task 15: Финальное ревью и фикс-волна

- [ ] **Step 1:** ревью всей ветки (`git diff main...feat/detail-ops`) отдельным ревьюером на Opus против спеки и Global Constraints; находки — в леджер с Ruling.
- [ ] **Step 2:** фиксы; после — `pnpm check` и `pnpm --filter pi e2e` (передний план) — зелёные; документы — по фиксам.
- [ ] **Step 3:** коммит `Финальная волна 2e: …` (перечислить); сообщить владельцу итог и ждать слова на слияние. Не сливать и не пушить без него.
