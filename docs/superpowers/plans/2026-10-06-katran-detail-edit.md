# Срез 2c «Правка деталки валютного ПИ» в `apps/pi`: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** валютная деталка правит поля 50/52/56/57/59/70/72 (и `B.*` у MT202COV), 20 исх, счета Дт/Кт и дату валютирования — с маркерами «изменено», блоком аудита поля, подтверждением `Prompt`, сохранением на бек (ответ — новая деталь) и перезапросом реестра; рубль — только просмотр.

**Architecture:** механизмы — в ките: `@katran/ui` получает `Prompt` (слой `Drawer.overlay`), `EditMark`, `EditHistory` с диффом, `SuggestInput` (комбобокс «только из списка» на `Listbox`), `FieldEditor`, правку в `ConfigForm`/`FieldRow` и `OWN_ESCAPE` для `[role=alertdialog]`/`[data-k-edit]`; `@katran/effector` — `createEditModel` (один редактор, черновики, валидация, сохранение через `attach`, `Prompt` «Отменить правку?» / «Утвердить…», `requestLeave`, отсечение поздних ответов). Домен — в `apps/pi` по FSD: порты `saveEditFx`/`accountsFx` в `shared/api`, контекст правки `EditContext` в `shared/lib/detail`, правила SWIFT X и виды «изменено» в `entities/fx-doc`, новый слой `features` со слайсом `features/doc-edit`, виджет деталки — `replaceDetail`, `reloadDetail`, сброс кэша вкладок и «охрана ухода» (`guard`) без импорта фичи; страница связывает фичу, деталку и реестр. Фейк хранит правки в памяти и накладывает их на деталь.

**Tech Stack:** pnpm-монорепо, React 17.0.2, effector 23.4, effector-react, Vite 8, Vitest 5 + jsdom + Testing Library 12 + jest-axe, Playwright 1.63, eslint (`import-x`, `jsx-a11y`, `react-hooks`), stylelint.

**Spec:** `docs/superpowers/specs/2026-10-06-katran-detail-edit-design.md` (утверждена владельцем 06.10; §7 — порядок задач 0–13, сохранён). Исследование с дословными текстами и адресами эталона — `.superpowers/sdd/2026-10-06-katran-detail-edit/research.md` (git-ignored, читать вместе с планом). Эталон — стенд `/Users/shaman/_CODE/VTB/pi-constructor`, коммит `e065bfb` (`index.html`: FIELDS 597–620, правимые профили 625, счета 668–684, ROUTES 740–746, сид 825–829, `editor()` 981–994, `validate()` 1480–1489, сохранение 1456–1471, 20 исх 1326–1340, счета 1302–1352, дата валютирования 1037–1065 и 1380–1400; CSS 138–153, 202–245, 365–443; `prompt.js`, `prompt.css`). Предыдущие планы-образцы — `docs/superpowers/plans/2026-09-30-katran-detail-tabs.md` (2b), `docs/superpowers/plans/2026-09-30-katran-filter-inputs.md` (план 7).

## Global Constraints

- Предусловие: `main` содержит `33269e4` (спека 2c) и слияние 2b `358b2d3`; `pnpm check` зелёный (Task 0). Работа — в worktree `katran/.worktrees/detail-edit`, ветка `feat/detail-edit` от `main`.
- Среда внутри: **React 17.0.2** (shared singleton хоста), effector 23.4, **Chromium 88**. Во всём коде (кит и `apps/pi`): legacy `render` из `react-dom`, без `createRoot`, `useId`, `useSyncExternalStore` и прочих API React 18+ (замена `useId` — `useStableId`, `packages/ui/src/compat/useStableId.ts`); без `.at`, `Object.hasOwn`, `findLast`, `toSorted`, `structuredClone`, `String.prototype.replaceAll`, CSS `:has`, `inert`, `dialog.showModal`. Даты — строки `ГГГГ-ММ-ДД`; ISO-строки дат без времени не разбирать через `new Date(string)`.
- **Никакого `dangerouslySetInnerHTML` / `innerHTML`**: «было → стало» в `Prompt` собирает вызывающий React-элементами (`PromptChange`).
- Тесты: `@testing-library/react` 12 + `@testing-library/dom` 8, `@testing-library/user-event` 14, `jest-axe`; `renderHook` — локальный (`packages/ui/src/test/renderHook.tsx`); под `renderK` искать по ролям и атрибутам, не `container.firstElementChild`. effector — `fork`/`allSettled`, журналы событий — сторами; публичные события — `EventCallable<T>`; `.reset(ev)` откатывает к initial; редьюсеры `.on` объявляются раньше `sample`, читающего тот же стор; побочные эффекты — только эффектами-таргетами.
- jsdom не видит каскад CSS-модулей, раскладку и контраст: геометрия, высоты и цвета — только e2e в Chromium.
- CSS — только `var(--k-*)`; голые `px` только в `border*`/`outline*`/`box-shadow`/`letter-spacing`; без hex/rgba/named-цветов; безразмерный `line-height` допустим. Новые размеры и цвета — токенами в `packages/tokens/src/tokens.src.ts` (генератор оборачивает размеры в `calc(Npx * var(--k-density))`), затем `pnpm gen`; `gen:check` сравнивает с **индексом** git: после `pnpm gen` сначала `git add packages/tokens/src/tokens.css packages/tokens/src/tokens.ts`, потом `pnpm check`. Блоки, чья высота сверяется с эталоном, задают `box-sizing: border-box` явно.
- Опциональные поля публичных типов — `?: T | undefined` (`exactOptionalPropertyTypes`).
- Импорты относительные, без алиасов. `ui` не импортирует `effector`; `effector` берёт из `@katran/ui` только `import type`. FSD-зоны eslint: слои `app → pages → widgets → features → entities → shared` только вниз; чужой слайс — только через `index.ts`; соседние сущности — только через `@x/<потребитель>.ts`; `widgets/doc-detail` не импортирует ни `entities`, ни `features`. Никаких `eslint-disable` / `stylelint-disable`.
- Данные — только вымышленные; словари счетов и маршрутов — с замороженного стенда (он обезличен). Рубль в 2c не правится: `entities/rub-doc`, `pages/rub-docs` не меняются.
- Тексты интерфейса — дословно с эталона (адреса — research.md), если спека или «Сквозной контракт имён» не говорят иначе.
- Русский язык интерфейса, комментариев, JSDoc и коммитов. Коммиты: `git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "…"`, **без** трейлеров `Co-Authored-By` и подписей «Generated with»; файлы добавлять поимённо (`git add <файлы>`, не `-A`).
- Порты: `apps/pi` dev — 5185, e2e preview — 5186, временный сервер стенда (Task 1) — 5187.
- e2e (`pnpm --filter pi e2e`) — только на переднем плане, дождаться результата; в фоне не запускать. Точечно — `pnpm --filter pi exec playwright test e2e/<файл>`; юнит точечно — `pnpm --filter <пакет> exec vitest run <файлы>` (фильтр через `--` у pnpm не работает, STATE §8).
- `pnpm check` зелёный после каждой задачи. Числа тестов в задачах — **приращение** к базе Task 0 (`tokens` 20, `ui` 622, `effector` 58, `apps/pi` 258; e2e `apps/pi` 59); фактические — в леджер.

## Review Focus

1. **Поздний ответ сохранения.** Сохранение поля документа X ушло, пользователь закрыл деталку X (или ушёл с экрана) до ответа. Ожидание: ответ не открывает и не закрывает чужой редактор, не пишет ошибку в редактор другого ключа; при том же визите экрана деталь X в кэше заменяется (бек правку принял), после ухода с экрана ответ не делает ничего. Тесты: Task 7 «поздний ответ…», Task 11 «replaceDetail после ухода с экрана не пишет в кэш».
2. **409 при сохранении.** `was` не совпал с текущим на беке. Ожидание: редактор остаётся открытым с черновиком и строкой «Документ изменили — откройте заново», деталь перезапрашивается (кэш не очищается до ответа, «Как есть» показывает новое исходное), другие редакторы и вкладки не трогаются. Тесты: Task 8 (фейк 409 по `was` и по `?conflict=edit`), Task 10 «409 → conflict и текст», Task 11 «reloadDetail не сбрасывает готовую деталь до ответа», e2e Task 12.
3. **Esc в слоях.** Esc в открытом списке `SuggestInput` отменяет правку счёта и не закрывает деталку; Esc на кнопке внутри `FieldEditor` (опция, «Отмена») — «Отмена» редактора, деталка открыта; Esc в `Prompt` — отказ, редактор и деталка остаются; следующий Esc вне правки закрывает деталку (с `requestLeave`). Тесты: Task 4, Task 5, Task 2, Task 6 (`OWN_ESCAPE`), e2e Task 12.
4. **Грязный черновик и уход.** Черновик в A; пользователь закрывает A при открытом B (сдвиг B→A), открывает другой документ в A из реестра или жмёт Esc. Ожидание: `Prompt` «Отменить правку?» в drawer A; «Продолжить правку» — всё на месте; «Отменить правку» — уход выполняется. Черновик в B и закрытие A — без вопроса, B сдвигается в A с редактором. Сохранение в полёте — уход без вопроса. Тесты: Task 7 (`requestLeave`), Task 11 (`guard`), Task 12 (страница и e2e).
5. **Нормализация и набор SWIFT X.** Кириллица («ПРИВЕТ», «С» вместо латинской «C»), `ß`, строчные латинские, пробелы по краям, хвостовые пустые строки, «/» в начале/конце и «//» в 20 исх, счёт стороны с пробелами и кириллицей. Ожидание: кириллица и `ß` — ошибка набора с номером строки; строчные допустимы и сохраняются прописными; черновик, равный текущему после нормализации, закрывает редактор без запроса; ↺ «стало = исходное» — запрос уходит. Тесты: Task 9 (правила), Task 7 («стало = текущее после normalize — без запроса»).

---

## Сквозной контракт имён (все задачи пользуются только им)

### Кит `@katran/ui`

```ts
// overlay/Prompt.tsx (Task 2), экспорт из overlay/index.ts
export type PromptTone = 'neutral' | 'danger'
export type PromptProps = {
  open: boolean
  title?: string | undefined          // по умолчанию 'Подтвердите действие' (prompt.js)
  note?: ReactNode | undefined
  okLabel?: string | undefined        // 'Подтвердить'
  cancelLabel?: string | undefined    // 'Отмена'
  tone?: PromptTone | undefined       // 'neutral'
  onResult: (ok: boolean) => void
}
export function Prompt(props: PromptProps): JSX.Element | null
// подложка [data-k-prompt] position:absolute; inset:0 (в Drawer.overlay); коробка role="alertdialog" aria-modal="true",
// aria-labelledby → h4 заголовка, aria-describedby → note; кнопки: «Отмена», затем основная; фокус: neutral — основная, danger — «Отмена»;
// Tab/Shift+Tab — только между двумя кнопками; Esc (onKeyDown коробки) → preventDefault + stopPropagation + onResult(false);
// mousedown по подложке вне коробки → onResult(false); закрытие (open → false или размонтирование) возвращает фокус на элемент, бывший в фокусе при открытии
export function PromptChange(props: { was: string; now: string }): JSX.Element   // .was (зачёркнуто, моно, muted) .arr «→» (faint) .now (600, моно, ink)

// drawer/Drawer.tsx (Task 2)
// DrawerProps += { overlay?: ReactNode | undefined }
// корень .drawer больше не прокручивается (overflow: hidden); прокрутка — внутренний <div data-part="scroll">, в нём метка слота, шапка, children;
// overlay рисуется после scroll — поверх панели, не уезжает при прокрутке

// value/EditMark.tsx (Task 3), экспорт из value/index.ts
export type EditStatus = 'pending' | 'confirmed'
export type EditMarkProps = { tip: string; status?: EditStatus | undefined }
export function EditMark(props: EditMarkProps): JSX.Element
// <span role="img" aria-label={tip} data-k-tip={tip} data-status={status}>: точка warn (mark-dot); со status — под ней галочка «✓»,
// видимая и цвета ok только при 'confirmed' (pending — visibility: hidden, как .mark b эталона)

// form/diff.ts (Task 3), экспорт из form/index.ts
export type EditDiffLine = { label: string; was: string; now: string }   // label: 'опция' | 'счёт' | '1/'…'N/' | ''
export function diffFieldValues(was: FieldValue, now: FieldValue): EditDiffLine[]   // diffLines эталона :960–966; равные — []
export function diffText(was: string, now: string): EditDiffLine[]                  // [{ label: '', was, now }] | []
export function editCountLabel(n: number): string   // '1 изменение' | '3 изменения' | '5 изменений' | '21 изменение' | '12 изменений'

// form/EditHistory.tsx (Task 3)
export type EditHistoryEntry = {
  who: string; when: string            // when — уже отформатировано вызывающим
  status: EditStatus
  by?: string | undefined; at?: string | undefined   // кто и когда утвердил — тултип бейджа «Утвердил(а) {by}, {at}»
  note?: string | undefined
  diff: EditDiffLine[]                 // [] — «без изменений»
}
export type EditHistoryProps = { entries: EditHistoryEntry[]; label: string /* 'поля 57' → кнопка aria-controls, список «История изменений поля 57» */ }
export function EditHistory(props: EditHistoryProps): JSX.Element | null   // entries [] → null
// сводка: editCountLabel(n) · уникальные who через ', ' · StatusBadge последней записи ('wait' «ожидает утверждения» | 'ok' «утверждено») ·
// кнопка «История» / «Свернуть историю» (aria-expanded); <ol>: кто, when, бейдж «ожидает»/«утверждено», примечание, строки диффа
// («{label} » + <s>was</s> + « → » + <b>now</b>); точка таймлайна ok, у pending — warn. Раскрытие — своё состояние, свёрнуто по умолчанию

// select/options.ts (Task 4): Option += { tag?: string | undefined }   // Listbox рисует <Tag tone="mt"> между подписью и hint
// select/SuggestInput.tsx (Task 4), экспорт из select/index.ts
export type SuggestInputProps = {
  options: Option[]
  value: string                                   // текст поля (управляемый)
  onChange: (text: string) => void
  onCommit: (option: Option) => void
  onCancel: () => void
  'aria-label': string
  emptyText: (query: string) => string            // строка списка, если совпадений нет
  notInListText: string                           // ошибка Enter без совпадения
  match?: ((option: Option, query: string) => boolean) | undefined   // по умолчанию — вхождение без регистра (filterOptions)
  sanitize?: ((text: string) => string) | undefined                 // применяется к вводу до onChange
  max?: number | undefined                        // по умолчанию 5 (SUGGEST_MAX)
  moreText?: ((rest: number) => string) | undefined   // по умолчанию (n) => `ещё ${n} — уточните номер`
  hint?: ReactNode | undefined                    // под полем слева; при ошибке вместо него — ошибка (bad)
  keysHint?: string | undefined                   // под полем справа: '↑↓ Enter · Esc'
  status?: ReactNode | undefined                  // вместо списка: загрузка / ошибка с «Повторить»
  placeholder?: string | undefined
  autoFocus?: boolean | undefined                 // по умолчанию true: фокус в поле при монтировании
}
export function SuggestInput(props: SuggestInputProps): JSX.Element
// список открыт всё время правки (Popover role="presentation", якорь — рамка поля); ↑↓ — по кругу; Enter: активный → единственный в выдаче →
// точное совпадение sanitize(value) с String(option.value) → иначе ошибка notInListText (aria-invalid, onCommit не зовётся);
// Esc и mousedown вне поля и списка (onClose поповера) → onCancel; Tab → onCancel; хвост «ещё N» — вне <ul role="listbox">

// form/FieldEditor.tsx (Task 5), экспорт из form/index.ts
export type FieldEditorProps = {
  tag: string                       // заголовок «Поле {tag без B.} · {name} — правка» (как base(tag) эталона)
  name: string
  original: FieldValue              // «Как есть» — исходное с бека
  value: FieldValue                 // черновик
  onChange: (next: FieldValue) => void
  lines: number; width: number
  opts?: string[] | undefined       // буквы опции; '' — «без буквы» (подпись «—»)
  account?: boolean | undefined     // сторона: поле «Счёт / IBAN»
  error: string | null              // первая ошибка валидации
  rule: string                      // подвал слева: «4 строк по 35 символов, набор SWIFT X, счёт до 34»
  busy?: boolean | undefined        // сохранение: кнопки недоступны, ввод сохраняется
  saveError?: string | null | undefined
  onCancel: () => void
  onSave: () => void
}
export function FieldEditor(props: FieldEditorProps): JSX.Element
// <section data-k-edit aria-label="Поле 57 · Банк получателя — правка">; Esc в любом месте секции → onCancel; фокус при монтировании —
// «Счёт» у стороны, иначе «Строка 1»; «Сохранить» disabled при error !== null || busy; «Отмена» disabled при busy;
// строка ошибки — error ?? saveError, aria-live="polite"; счётчики: «Как есть» — сумма длин original.lines / N·W, «Редактирование» — живой, bad при > N·W

// form/types.ts (Task 6)
// FieldDef += { editable?: boolean | undefined }
export type FieldEdit = {
  changed: boolean                  // текущее ≠ исходному: warn-row, рамка warn, точка в углу, главное значение warn, «Было / Стало» в раскрытии
  was: FieldValue                   // исходное
  tip: string                       // «Изменено: {who}, {when}» — тултип ячейки и скрытый текст строки
  audit?: ReactNode | undefined     // EditHistory — в раскрытии, если есть история (в т. ч. после отката, changed = false)
}
export type FormEdit = {
  can: (tag: string) => boolean     // карандаш у поля (тег из схемы, с 'B.')
  editing: string | null            // тег открытого редактора
  onEdit: (tag: string) => void
  renderEditor: (tag: string) => ReactNode
  state: (tag: string) => FieldEdit | null
}
// ConfigFormProps += { edit?: FormEdit | undefined }
// FieldRowProps += { editable?: boolean | undefined; editing?: boolean | undefined; onEdit?: (() => void) | undefined; edit?: FieldEdit | null | undefined }
// карандаш — IconButton-сосед строки-кнопки: label `Редактировать поле ${tag}` (тег с 'B.'), data-k-tip 'Редактировать'; виден при наведении на ячейку и в фокусе;
// есть и у пустой строки; у текстового поля — в правом верхнем углу; ячейка с открытым редактором — data-editing (рамка val);
// редактор: у поля сетки — после обеих ячеек его строки, у текстового — сразу после поля; обёртка редактора grid-column: 1 / -1;
// раскрытие правимого поля: «Было:» / «Стало:» (если changed), audit, кнопка «✎ Изменить» (onEdit); закрытие редактора возвращает фокус на карандаш

// drawer/DrawerStack.tsx (Task 6)
// OWN_ESCAPE += ', [role="alertdialog"], [data-k-edit]'
```

Уже есть и используется как есть: `Listbox`, `Popover` (`role="presentation"`), `DateInput` (`DateValue = IsoDay | IsoMinute | ''`, `min`), `StatusBadge` (`'ok' | 'wait'`), `Tag` (`tone="mt"`), `Button`, `IconButton`, `Input`, `useKatran().announce`, `formatDate`, `formatDateTimeMinutes` («дд.мм.гггг чч:мм» — время правки как на эталоне: «22.09.2026 10:42»).

### Кит `@katran/effector`

```ts
// createEditModel.ts (Task 7), экспорт из index.ts
export type SaveQuery<Draft> = { key: string; draft: Draft /* после normalize */; initial: Draft }
export type EditConfirm = { kind: 'discard' | 'commit'; key: string }
export type LeaveRequest<Next> = { scope: string /* префикс ключа */; next: Next }
export type EditSaved<Result> = { key: string; result: Result }
export type EditFailed<Fail> = { key: string; error: Fail }
export type EditModelConfig<Draft, Result, Fail extends Error> = {
  saveFx: Effect<SaveQuery<Draft>, Result, Fail>
  validate: (key: string, draft: Draft) => string | null
  normalize?: ((key: string, draft: Draft) => Draft) | undefined     // по умолчанию — как есть
  same?: ((a: Draft, b: Draft) => boolean) | undefined               // по умолчанию — JSON.stringify(a) === JSON.stringify(b)
  confirmSave?: ((key: string) => boolean) | undefined               // ключи с Prompt «commit» перед запросом
  errorText?: ((error: Fail) => string) | undefined                  // по умолчанию error.message
}
export type EditModel<Draft, Result, Next, Fail extends Error> = {
  $editing: Store<{ key: string; initial: Draft } | null>   // один редактор на экран (A и B вместе)
  $drafts: Store<Record<string, Draft>>
  $errors: Store<Record<string, string>>                    // ключ → первая ошибка validate(key, черновик); без ошибки — ключа нет
  $dirty: Store<boolean>                                    // редактор открыт и !same(normalize(черновик), initial)
  $saving: Store<boolean>
  $saveError: Store<string | null>                          // ошибка сохранения открытого редактора
  $confirm: Store<EditConfirm | null>
  open: EventCallable<{ key: string; initial: Draft }>
  change: EventCallable<{ key: string; draft: Draft }>
  cancel: EventCallable<void>
  save: EventCallable<void>
  submit: EventCallable<{ key: string; initial: Draft; draft: Draft }>   // сохранение без редактора (↺)
  confirmResult: EventCallable<boolean>
  requestLeave: EventCallable<LeaveRequest<Next>>
  leave: Event<Next>
  reset: EventCallable<void>
  saved: Event<EditSaved<Result>>
  failed: Event<EditFailed<Fail>>
}
export function createEditModel<Draft, Result, Next = void, Fail extends Error = Error>(cfg: EditModelConfig<Draft, Result, Fail>): EditModel<Draft, Result, Next, Fail>
```

Правила модели (тесты Task 7 — по ним):
- Запрос в полёте — один на модель (`$saving`); модель помнит его ключ (внутренний стор `$inFlight: string | null`).
- `open`: нет редактора — открыть (`$drafts[key] = initial`); тот же ключ — ничего; другой ключ без грязного черновика — заменить (черновик прежнего удаляется); другой ключ с грязным — `$confirm = { kind: 'discard', key: прежний }`, после `confirmResult(true)` — заменить, `false` — остаться; пока летит запрос **открытого** редактора (`$inFlight === $editing.key`) — игнор (редактор, закрытый уходом во время сохранения, новому `open` не мешает).
- `change` — только для ключа открытого редактора; сбрасывает `$saveError`. `cancel` — закрыть редактор, удалить черновик, сбросить `$saveError` и `$confirm`; во время `$saving` — игнор.
- `save`: нет редактора, `$saving`, ошибка в `$errors[key]` — игнор; `n = normalize(черновик)`; `same(n, initial)` — закрыть как `cancel` без запроса; `confirmSave(key)` — `$confirm = { kind: 'commit', key }`, запрос только после `confirmResult(true)`; иначе — запрос `{ key, draft: n, initial }`. `submit` — запрос `{ key, draft: normalize(draft), initial }` без `$confirm`; игнор во время `$saving` и при `same`.
- Ответ: модель держит счётчик визитов (растёт на `reset`) и шлёт его в параметрах своей `attach`-копии `saveFx`. Ответ прошлого визита — ничего. Ответ своего визита — `saved` / `failed` всегда; редактор (`$editing`, `$drafts[key]`, `$saveError`) меняется, только если открыт тот же ключ: успех — закрыть, отказ — `$saveError = errorText(error)`. `$saving` — `true` на запросе, `false` на завершении своего визита и на `reset`.
- `requestLeave({ scope, next })`: при `$confirm !== null` — игнор; редактора нет или его ключ не начинается с `scope` — сразу `leave(next)`; ключ в `scope` и (`$inFlight === ключ` или не `$dirty`) — закрыть редактор и `leave(next)` (летящий запрос доживёт и даст `saved`); ключ в `scope` и `$dirty` — `$confirm = { kind: 'discard', key }`, после `true` — закрыть редактор и `leave(next)`, после `false` — ничего.
- `reset` — визит + 1, все сторы к начальным.

### `apps/pi`

```ts
// shared/api/edit-ports.ts (Task 8), экспорт из shared/api/index.ts
export type EditValue = { opt?: string | undefined; acc?: string | undefined; lines: string[] } | string   // поля — объект, остальные цели — строка
export type EditQuery = { id: string; target: string; was: EditValue; now: EditValue }
export type AccountSide = 'dt' | 'kt'
export type AccountsQuery = { id: string; side: AccountSide }
export type AccountItem = { account: string; ccy: string; kind: string }
export type EditPorts<D> = {
  saveEditFx: Effect<EditQuery, D, ApiError>                     // POST `${doc}/edits`, тело { target, was, now } → parseDetail(obj(ответ), 'ответ')
  accountsFx: Effect<AccountsQuery, AccountItem[], ApiError>      // GET `${doc}/accounts`, query { side } → fromAccountsResponse
}
export function createEditPorts<D>(cfg: { gridId: string; parseDetail: DetailParser<D> }): EditPorts<D>
export function fromAccountsResponse(raw: unknown): AccountItem[]  // { items: [{ account, ccy, kind }] }, иначе contractError
// doc = `/grids/${gridId}/documents/${encodeURIComponent(id)}`

// shared/lib/detail/types.ts (Task 8), экспорт из shared/lib/detail/index.ts
export type LeaveIntent = { kind: 'close'; slot: DrawerSlot } | { kind: 'open'; open: DrawerOpen }
export type AccountsSlot = { state: 'loading' | 'ready' | 'error'; items: AccountItem[]; error: string | null }
export type EditConfirmView = { title: string; note?: ReactNode | undefined; okLabel: string; cancelLabel: string; tone: PromptTone }
export type EditContext = {
  docId: string
  editing: string | null            // цель открытого редактора в этом документе ('field:57', 'refOut', 'accKt', 'valueDate'), иначе null
  draft: EditValue | null
  error: string | null              // ошибка валидации черновика
  saving: boolean
  saveError: string | null
  confirm: EditConfirmView | null   // Prompt этого документа (его рисует DocDetail в Drawer.overlay)
  onConfirm: (ok: boolean) => void
  open: (target: string, current: EditValue) => void
  change: (draft: EditValue) => void
  cancel: () => void
  save: () => void
  revert: (target: string, current: EditValue, original: EditValue) => void   // ↺: submit «стало = исходное»
  accounts: (side: AccountSide) => AccountsSlot | null                        // null — ещё не запрашивались
  retryAccounts: (side: AccountSide) => void
}
// DetailDomain<D, Row>: renderHero: (d: D, id: string, edit: EditContext | null) => HeroCell
//                       renderBlock: (d: D, id: string, edit: EditContext | null) => ReactNode
//                       += formEdit?: ((d: D, edit: EditContext) => FormEdit) | undefined
// (функции с двумя параметрами — у рубля — совместимы без правок)

// entities/fx-doc (Task 8 — типы, разбор, порты; Task 9 — правила и виды), экспорт из index.ts
export type FxHistEntry = { who: string; when: string; was: EditValue; now: EditValue; note: string | null; status: EditStatus; by: string | null; at: string | null }
export type FxEdit = { now: EditValue | null /* null у 'route' */; hist: FxHistEntry[] }
// FxDocDetail += { edits: Record<string, FxEdit> }   // ключ — цель: 'field:<tag>' (с 'B.'), 'refOut', 'accDt', 'accKt', 'valueDate', 'route'; нет поля в ответе — {}
export const fieldTarget: (tag: string) => string                     // '57' → 'field:57'
export function currentOf(d: FxDocDetail, target: string): EditValue  // поле — SwiftValue ({ lines: [] } у пустого), refOut ?? '', accDt/accKt, valueDates[0]
export function originalOf(d: FxDocDetail, target: string): EditValue // edits[target].hist[0].was, иначе currentOf
export function isChanged(d: FxDocDetail, target: string): boolean    // !sameEditValue(currentOf, originalOf)
export function sameEditValue(a: EditValue, b: EditValue): boolean    // объекты — по opt || '', acc || '', lines
export const fxEditPorts: EditPorts<FxDocDetail>                      // createEditPorts({ gridId: 'fx-docs', parseDetail: parseFxDocDetail })
// Task 9
export function validateSwiftField(def: FieldDef, v: SwiftValue): string | null
export function validateRefOut(v: string): string | null
export function validateFxEdit(target: string, v: EditValue): string | null      // поля — validateSwiftField по FX_FIELDS[база тега]; refOut; остальные — null
export function normalizeFxEdit(target: string, v: EditValue): EditValue        // поля: строки trim+upper, хвостовые пустые прочь, acc trim, пустые opt/acc — без ключа; refOut trim+upper; счета — только цифры
export function fxEditRule(def: FieldDef): string                                // «{N} строк по {W} символов, набор SWIFT X[, счёт до 34]»
export function fxEditableTargets(d: FxDocDetail): string[]                     // поля схемы профиля с FX_FIELDS[база].editable (сетка, текст, seqB) + refOut, accDt, accKt + valueDate (кроме MT199)
export const FX_CONFIRM_TARGETS: string[]                                        // ['valueDate']
export function fxCommitView(target: string, was: EditValue, now: EditValue): EditConfirmView
export function fxFormEdit(d: FxDocDetail, edit: EditContext): FormEdit
// fxHero(d, id, edit), fxBlock(d, id, edit) — третий параметр; fxDocDetailDomain += formEdit: fxFormEdit

// features/doc-edit (Task 10), index.ts
export type DocEditConfig<D extends { id: string }> = {
  ports: EditPorts<D>
  validate: (target: string, v: EditValue) => string | null
  normalize: (target: string, v: EditValue) => EditValue
  confirmTargets: string[]
  lifecycle: PageLifecycle
}
export type DocEdit<D> = {
  model: EditModel<EditValue, D, LeaveIntent, ApiError>
  $accounts: Store<Record<string, AccountsSlot>>      // ключ `${id}:${side}`
  loadAccounts: EventCallable<AccountsQuery>
  docEdited: Event<{ id: string; detail: D }>          // = model.saved, id — detail.id
  conflict: Event<{ id: string }>                      // отказ 409
  $savedCount: Store<number>                           // растёт на docEdited — объявление «Изменения сохранены»
}
export function createDocEdit<D extends { id: string }>(cfg: DocEditConfig<D>): DocEdit<D>
export const editKey: (id: string, target: string) => string   // `${id}:${target}`; id без ':' (UUID контракта), цель может содержать ':' ('field:57')
export const editScope: (id: string) => string                 // `${id}:`
export const CONFLICT_TEXT = 'Документ изменили — откройте заново'
export const DISCARD_VIEW: EditConfirmView   // { title: 'Отменить правку?', note: 'Несохранённые изменения будут потеряны.', okLabel: 'Отменить правку', cancelLabel: 'Продолжить правку', tone: 'danger' }
export function useEditContexts<D extends { id: string }>(edit: DocEdit<D>, commitView: (target: string, was: EditValue, now: EditValue) => EditConfirmView): (docId: string) => EditContext

// widgets/doc-detail (Task 11)
// DetailConfig<D> += { guard?: boolean | undefined }   // true — close / closeTop / open, уводящие документ из слота, идут через leaveRequested
// Detail<D> += {
//   replaceDetail: EventCallable<{ id: string; detail: D }>   // в кэш без запроса (только при открытом экране); сброс кэша и ошибок вкладок `${id}:*`; активная нелокальная вкладка этого id перезапрашивается
//   reloadDetail: EventCallable<string>                         // перезапрос детали по id: кэш остаётся до ответа; уже грузящийся — без запроса
//   leaveRequested: Event<{ docId: string; intent: LeaveIntent }>
//   leave: EventCallable<LeaveIntent>                            // выполнить уход: close(slot) или open(…) стека
// }
// DocDetailProps += { editOf?: ((docId: string) => EditContext) | undefined }

// pages/fx-docs/model/edit.model.ts (Task 12)
export const docEdit: DocEdit<FxDocDetail>
```

Фейк (`apps/pi/src/app/fake`, Task 8–9): маршруты `POST /grids/{gridId}/documents/{id}/edits` и `GET /grids/{gridId}/documents/{id}/accounts?side=kt|dt` (`req.query.side`); правки — в памяти `FakeEditStore` на сессию; регуляторы `?fail=edit` (500 на правке), `?fail=accounts` (500 на счетах), `?conflict=edit` (409 на любой правке); `FakeServerOptions += { conflicting?: (() => string | null) | undefined; now?: (() => string) | undefined }` (`now` — ISO без зоны до минут, по умолчанию локальное «сейчас»).

```ts
// app/fake/edits.ts (Task 8)
export type FakeEditStore = {
  overlay: (id: string, detail: Record<string, unknown>) => Record<string, unknown>   // текущие значения и edits поверх детали
  save: (id: string, detail: Record<string, unknown>, body: unknown, when: string) => Record<string, unknown>   // бросает ApiError 400/409; возвращает overlay
  accounts: (detail: Record<string, unknown>, side: unknown) => unknown                // { items }; side не 'kt'|'dt' — 400
}
export function createFxEditStore(cfg: { seedId: string | null; validate?: ((target: string, now: unknown) => string | null) | undefined }): FakeEditStore
// FakeGrid += { edit?: ((id: string, body: unknown, when: string) => unknown) | undefined; accounts?: ((id: string, side: unknown) => unknown) | undefined }
// FakeGridOptions<Row> += { edits?: FakeEditStore | undefined }   // fakeGrid: detail(id) = overlay(id, toDetail(…)); edit, accounts — через store
```

---

## Карта файлов

```txt
packages/tokens/src/tokens.src.ts · tokens.css · tokens.ts · generate.test.ts                  — Task 2 (все токены 2c по замеру Task 1)
packages/ui/src/
  overlay/  Prompt.tsx · Prompt.module.css · Prompt.test.tsx · index.ts                      — Task 2
  drawer/   Drawer.tsx · Drawer.module.css · Drawer.test.tsx                                  — Task 2 (overlay), Task 6 (OWN_ESCAPE в DrawerStack.tsx)
  drawer/   DrawerStack.tsx                                                                    — Task 6
  value/    EditMark.tsx · Value.module.css · EditMark.test.tsx · index.ts                    — Task 3
  form/     diff.ts · diff.test.ts · EditHistory.tsx · EditHistory.test.tsx · Edit.module.css · index.ts — Task 3
  select/   options.ts · Listbox.tsx · SuggestInput.tsx · SuggestInput.test.tsx · Select.module.css · index.ts — Task 4
  form/     FieldEditor.tsx · FieldEditor.test.tsx · Edit.module.css                          — Task 5
  form/     types.ts · FieldRow.tsx · ConfigForm.tsx · Form.module.css · FieldRow.test.tsx · ConfigForm.test.tsx · index.ts — Task 6
packages/effector/src/  createEditModel.ts · createEditModel.test.ts · index.ts               — Task 7
apps/pi/src/
  shared/api/          edit-ports.ts · edit-ports.test.ts · index.ts                           — Task 8
  shared/lib/detail/   types.ts · index.ts                                                     — Task 8
  entities/fx-doc/     model/edit.ts · model/detail.ts · api/detail.mapper.ts · api/detail.mapper.test.ts · api/detail.example.ts · api/ports.ts · index.ts — Task 8
                       model/rules.ts · model/rules.test.ts · model/swift.ts · ui/edit.tsx · ui/edit.module.css · ui/detail.tsx · ui/edit.test.tsx — Task 9
  app/fake/            edits.ts · edits.data.ts · grid.ts · server.ts · params.ts · grids.ts · server.test.ts · contract.test.ts — Task 8 (валидация правилами — Task 9)
  features/doc-edit/   model/createDocEdit.ts · model/createDocEdit.test.ts · ui/useEditContexts.ts · ui/useEditContexts.test.tsx · index.ts — Task 10
  widgets/doc-detail/  lib/createDetail.ts · lib/createDetail.test.ts · ui/DocDetail.tsx · ui/DocDetail.test.tsx · index.ts — Task 11
  pages/fx-docs/       model/edit.model.ts · model/registry.model.ts · model/registry.model.test.ts · ui/FxDocsPage.tsx · index.ts — Task 12
  app/details.a11y.test.tsx                                                                    — Task 12
eslint.config.js                                                                               — Task 10 (слой features, зона doc-detail → features)
apps/pi/e2e/  detail-edit.spec.ts                                                             — Task 12
docs/reference/  detail-drift.md (раздел «2c») · pi-api.md                                    — Task 1, 13
docs/guides/  pi-usage.md · effector-fsd.md                                                   — Task 13
docs/STATE.md · CHANGELOG.md (корень) · docs/superpowers/specs/2026-10-06-katran-detail-edit-design.md — Task 1, 13
```

---

### Task 0: Проверка предусловий, worktree `detail-edit`

**Files:** только чтение; создаётся worktree `katran/.worktrees/detail-edit` (каталог `.worktrees/` в `.gitignore`).

**Interfaces:**
- Consumes: `main` с `33269e4` (спека 2c) и `358b2d3` (слияние 2b); этот план закоммичен контроллером в `main` до Step 2.
- Produces: ветка `feat/detail-edit`; база тестов в леджере (`tokens` 20, `ui` 622, `effector` 58, `apps/pi` 258 — всего 958; e2e 59); подтверждённые имена, на которые опираются задачи.

- [ ] **Step 1: `main` содержит спеку 2c и 2b.**

```bash
cd /Users/shaman/_CODE/VTB/katran
git merge-base --is-ancestor 33269e4 main && git merge-base --is-ancestor 358b2d3 main && echo OK
git status --short
```

Expected: `OK`; `git status --short` пуст, кроме этого плана, если контроллер ещё не закоммитил его (тогда — закоммитить до Step 2). Иначе — остановиться.

- [ ] **Step 2: worktree и ветка.**

```bash
cd /Users/shaman/_CODE/VTB/katran
git worktree add .worktrees/detail-edit -b feat/detail-edit main
cd .worktrees/detail-edit && git log --oneline -1
```

Expected: `Preparing worktree (new branch 'feat/detail-edit')`, вершина `main`. Дальше все задачи — в `/Users/shaman/_CODE/VTB/katran/.worktrees/detail-edit`.

- [ ] **Step 3: зависимости и проверка.** `pnpm install` (lockfile не меняется), `pnpm check`. Expected: `Tests 20 passed` (tokens), `622` (ui), `58` (effector), `258` (apps/pi), `ES-Check passed`, `CSS: синтаксиса новее chrome >= 88 нет`. Другие числа — записать фактические и считать от них; красный — остановиться.
- [ ] **Step 4: e2e на переднем плане.** `pnpm --filter pi e2e` — `59 passed`.
- [ ] **Step 5: сверка имён.** Открыть и убедиться (расхождение — фактическое имя в леджер и во все задачи):
  - `packages/ui/src/drawer/DrawerStack.tsx:19` — `OWN_ESCAPE = 'input, textarea, select, [contenteditable="true"], [role="menu"], [role="listbox"], [role="dialog"]:not([data-k-drawer])'`, слушатель Esc — `document` в фазе захвата; `Popover` ловит Esc тоже в захвате с `stopPropagation` (`overlay/Popover.tsx`);
  - `packages/ui/src/drawer/Drawer.module.css` — `.drawer { position: relative; overflow: hidden auto; … }`, `.badge { position: sticky }`; тесты стека — в `drawer/Drawer.test.tsx`;
  - `packages/ui/src/select/Listbox.tsx` — `ListboxProps.highlight`, `optionId`, выбор по делегированному `click`; `select/options.ts` — `Option = { value: Scalar; label: string; hint?: string | undefined }`, `filterOptions`;
  - `packages/ui/src/form/FieldRow.tsx` — вся строка значения одна `<button aria-expanded>`, пустая строка — `div` без кнопки; `form/ConfigForm.tsx` — `mateGroups`, `cell(ref, wide)`, сетка строк — `Fragment` на пару; `form/present.ts` — `FieldPresenter`, `isEmptyValue`;
  - `packages/ui/src/date/dateStr.ts` — `DateValue = IsoDay | IsoMinute | ''`; `format/date.ts` — `formatDateTimeMinutes`;
  - `packages/effector/src/createGridModel.ts:158` — образец `attach({ effect: cfg.fetchFx })`;
  - `apps/pi/src/widgets/doc-detail/lib/createDetail.ts` — `open`/`close`/`closeTop` возвращаются как события стека; визит `$visit` + `mine`; `$tabCache`/`$tabErrors`/`$tabLoading` по `${id}:${tab}`;
  - `apps/pi/src/shared/lib/detail/types.ts` — `renderHero: (d, id) => HeroCell`, `renderBlock: (d, id) => ReactNode`;
  - `apps/pi/src/shared/api/request.ts` — `HttpRequest.query?: Record<string, string>`; `problem.ts` — `ApiError.status`, `ApiError.problem.errors`;
  - `apps/pi/src/app/fake/server.ts` — регулятор `failing()` одним параметром `fail`; `app/fake/params.ts` — `browserFakeOptions`;
  - `apps/pi/src/app/fake/fx-docs.data.ts` — `makeFxDocs()[0]` первая запись реестра при пустой сортировке (`createGridModel` `$sort` = `[]`), её `type` — записать (Task 8 сидирует правку поля 57 на этот документ; MT199 — остановиться и спросить контроллера);
  - `eslint.config.js:10` — `LAYERS = ['app', 'pages', 'widgets', 'entities', 'shared']`, зона `widgets/doc-detail ← entities`;
  - `packages/tokens/src/tokens.src.ts` — нет имён `prompt-*`, `fe-*`, `sug-*`, `mark-dot`, `edit-dot`, `pen`, `h-inline`, `fs-edit`, `scrim`; генератор принимает цвет `#RRGGBBAA` (проверить `generate.ts`; не принимает — в леджер, Task 2 решает через контроллера).
- [ ] **Step 6: стенд.** `git -C /Users/shaman/_CODE/VTB/pi-constructor log --oneline -1` — `e065bfb Стенд: новый пароль заглушки`; `status --short` пуст. Иначе — остановиться.

---

### Task 1: Замер правки на эталоне, раздел «2c» в `detail-drift.md`

**Files:**
- Modify: `docs/reference/detail-drift.md` (раздел «2c–2d» → «2c» + «2d»)
- Modify: `docs/STATE.md` (§9 — 2c в работе, ссылка на план; §10 строка деталки — «2c сверяется»)
- Create (временно, удаляются в этой же задаче): `apps/pi/e2e-stand/playwright.config.ts`, `apps/pi/e2e-stand/stand.spec.ts`

**Interfaces:**
- Consumes: стенд на `e065bfb` (Task 0 Step 6); `@playwright/test` из `apps/pi`.
- Produces: числа эталона для токенов Task 2 и `REF` e2e Task 12. Ожидаемые по CSS эталона (Task 1 подтверждает или заменяет, расхождение > 0.5 px — фактическое число в леджер и в Task 2): **поле ввода редактора `.fe input` 21** (и строка `pre` «Как есть» 21), **кнопка опции `.opts button` 18 × мин. 22**, отступы `.fe` 7 / 9 / 8, `.box` 5 / 7, зазор колонок `.two` 10, **поле 20 исх / счёта / даты `.txted input`, `.acced input`, `.vdinp` 22**, **строка подсказки `.sug .si` 24**, ширина списка ≥ 320 (min 300), колонки строки 34 / 120, **коробка `Prompt` `.pr` 340**, отступы 16 / 16 / 12, радиус 8, **кнопка `Prompt` 30**, отступ кнопки 14, заголовок 600 14 / 1.35, note 12.5 / 1.45, **карандаш даты 17 × 17**, значок 12–13, **точка `.mark i` 6**, галочка 8 px, **точка угла `.cell.edited::after` 8**, точка таймлайна 8, кегль поля правки 12 моно.
- Produces: раздел «2c» сверки — пункты Д49–Д60 класса C, известные до кода.

- [ ] **Step 1: хеши.** `git -C /Users/shaman/_CODE/VTB/pi-constructor log -1 --format='%h %ci'` и `git log -1 --format='%h %ci'` в worktree — в шапку раздела и в леджер.
- [ ] **Step 2: замер.** Конфиг — копия конфига Task 1 плана 2b (`docs/superpowers/plans/2026-09-30-katran-detail-tabs.md`, Task 1 Step 2: `baseURL` `http://localhost:5187`, `python3 -m http.server 5187 --directory /Users/shaman/_CODE/VTB/pi-constructor`, 1600 × 1000, `deviceScaleFactor` 1), помощники `h(page, sel)` и `css(page, sel, props, pseudo?)` — оттуда же. Сценарий `замер правки деталки стенда (2c)` на `#dw0` (первый валютный документ, у него сид правки поля 57), каждый шаг — ключ в объекте вывода:
  1. `fe`: клик `#dw0 [data-no="57"] [data-act="edit"]` → `h('.fe input')`, `h('.fe pre')`, `h('.opts button')`, `css('.opts button', ['min-width'])`, `css('.fe', ['padding-top','padding-left','padding-bottom'])`, `css('.box', ['padding-top','padding-left'])`, `css('.fe .two', ['column-gap'])`, ширина `.fe` против ширины сетки `.fg`; ввести «ПРИВЕТ» в первую строку → текст `.fe [data-err]` (ожидается «Строка 1: недопустимые символы (только латиница, цифры и / - ? : ( ) . , ' +)»); скриншот `stand-editor.png`; «Отмена».
  2. `hist`: клик по ячейке 57 (раскрыть) → «История» `.hs-t` → `h('.hl li')`, `css('.hl li', ['width','height'], '::before')`, `css('.cell.edited', ['width','height'], '::after')`; скриншот `stand-history.png`.
  3. `ref`: клик первого `#dw0 [data-txtedit]` → `h('.txted input')`, `css('.txted input', ['font-size','font-family'])`; Esc.
  4. `sug`: клик `#dw0 [data-accedit="kt"]` → ввести «4» → `h('.sug .si')`, ширина `.sug`; скриншот `stand-suggest.png`; Esc.
  5. `vd` и `prompt`: `h('.hero .vd .pen')`; клик по нему → `.vdinp` `fill` другой датой + `dispatchEvent('change')` → `css('.pr', ['width','padding-top','padding-left','padding-bottom','border-top-left-radius'])`, `h('.pr button')`, `css('.pr button', ['padding-left'])`, `css('.pr h4', ['font-size','font-weight','line-height'])`, `css('.pr .note', ['font-size','line-height'])`; скриншот `stand-prompt.png`; «Утвердить» → `css('.hero .vd .mark i', ['width','height'])`, `css('.hero .vd .mark b', ['font-size','visibility','color'])`.
  Вывод — одна строка `STAND 2c: {json}`. Селектор не нашёлся — ключ `null`, найти верный по коду стенда (адреса — research.md) и перезапустить.

  Run: `cd apps/pi && pnpm exec playwright test -c e2e-stand/playwright.config.ts --reporter=line`
  Expected: `1 passed`, строка `STAND 2c:` без `null`; числа совпадают с «Interfaces» ± 0.5 (иначе — фактическое в леджер). Скриншоты — из `apps/pi/test-results/…` в `.superpowers/sdd/2026-10-06-katran-detail-edit/stand/` (git-ignored).
- [ ] **Step 3: убрать временное.** `rm -r apps/pi/e2e-stand`; `git status --short` не показывает `e2e-stand`.
- [ ] **Step 4: раздел «2c» в `detail-drift.md`.** Заменить раздел «2c–2d — сверяются…» двумя: «2c — правка» (шапка как у «2b»: эталон, katran до кода, дата, метод — адреса кода стенда, Playwright 1.63, 5187; «Сводка 2c»; «Замер эталона 2c» — таблица величин Step 2 с колонками «Токен кита» (Task 2) и «Кит (e2e Task 12)» = «—»; «Таблица сверки 2c»; «Не проверено (2c)») и «2d — сверяется в начале своего подсреза» (прежний текст про 2d). Пункты таблицы — класс C, колонка «katran» — «План: Task N»:
  - Д49 ↺ — новая правка «стало = исходное», история сохраняется (эталон удалял правку и историю) — в2, Task 7/9;
  - Д50 аудит 70/72 — блок аудита и «Было / Стало», как у остальных полей — в4, Task 9;
  - Д51 уход с несохранённым вводом (закрытие, сдвиг B→A, другой документ в слоте) — `Prompt` «Отменить правку?» — в3, Task 7/11;
  - Д52 дата валютирования — `DateInput` кита вместо нативного `type=date` — спека §1.3, Task 9;
  - Д53 ↺ маршрута убран, ↺ Кт возвращает и маршрут — спека §4, Task 8/9;
  - Д54 Esc в редакторе поля — «Отмена» (эталон: ничего) — спека §4, Task 5;
  - Д55 после сохранения реестр перезапрашивается сразу — спека §1.1, Task 12;
  - Д56 пустая выдача счетов Дт — «В счетах банка нет счетов {ccy}, содержащих «{q}»» (эталон показывал текст карточки клиента — ошибка) — research, Task 9;
  - Д57 карандаши — кнопки с именами «Редактировать поле {tag}» (тег с `B.`), «Изменить 20 исх», «Изменить счёт Дт|Кт», «Изменить дату валютирования» (эталон — `span role=button`, одно имя «Редактировать») — a11y кита, Task 6/9;
  - Д58 `Prompt` — слой `Drawer.overlay` с `role="alertdialog"` (эталон — `role="dialog"`, подложка `position:fixed` по прямоугольнику drawer'а) — спека §2.1, Task 2;
  - Д59 один редактор на экран (A и B вместе), а не на drawer — `createEditModel.$editing` (спека §2.2), Task 7;
  - Д60 после сохранения поле не раскрывается автоматически (эталон раскрывал строку) — решение плана: раскрытие — `$expanded` виджета, модель правки о нём не знает; аудит виден по раскрытию; Task 6.
  Сводка 2c: A 0, B 0, C 12, D 0. «Не проверено»: тёмная тема; ошибки сохранения и 409 (на эталоне нет).
- [ ] **Step 5: STATE.** §9 — «Срез 2c в работе: план `docs/superpowers/plans/2026-10-06-katran-detail-edit.md`, ветка `feat/detail-edit`»; §10, строка деталки — «2a, 2b исполнены; 2c — сверка `detail-drift.md` «2c»».
- [ ] **Step 6: проверка и коммит.** `pnpm check` зелёный (тесты не меняются).

```bash
git add docs/reference/detail-drift.md docs/STATE.md
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "Сверка 2c: замер правки эталона e065bfb, пункты Д49–Д60 до кода"
```

---

### Task 2: Токены правки, `Prompt`, слой `Drawer.overlay`

**Files:**
- Modify: `packages/tokens/src/tokens.src.ts`, `tokens.css`, `tokens.ts` (gen), `generate.test.ts`
- Create: `packages/ui/src/overlay/Prompt.tsx`, `Prompt.module.css`, `Prompt.test.tsx`
- Modify: `packages/ui/src/overlay/index.ts`, `packages/ui/src/drawer/Drawer.tsx`, `Drawer.module.css`, `Drawer.test.tsx`

**Interfaces:**
- Consumes: числа Task 1.
- Produces: `Prompt`, `PromptChange`, `PromptProps`, `PromptTone`; `DrawerProps.overlay`; токены (значения — Task 1):
  - цвет `scrim`: светлая `#141A2947` (rgba(20,26,41,.28) эталона), тёмная `#00000073`;
  - размеры `prompt-w` 340, `prompt-btn` 30, `prompt-btn-px` 14, `r-l` 8, `fs-prompt` 14;
  - `fe-line` 21, `fe-pt` 7, `fe-px` 9, `fe-pb` 8, `fe-box-py` 5, `fe-box-px` 7, `fe-gap` 10, `opt-btn` 18, `opt-min` 22;
  - `h-inline` 22, `fs-edit` 12, `sug-row` 24, `sug-w` 320, `sug-tag` 34, `sug-kind` 120;
  - `pen` 17, `mark-dot` 6, `fs-mark` 8, `edit-dot` 8.

- [ ] **Step 1: падающие тесты.** `generate.test.ts`:

```ts
it('правка деталки (спека 2c): Prompt 340 / 30, поле редактора 21, опция 18, поле на месте 22, подсказка 24, подложка', () => {
  expect(css).toMatch(/--k-prompt-w: calc\(340px \* var\(--k-density\)\)/)
  expect(css).toMatch(/--k-prompt-btn: calc\(30px \* var\(--k-density\)\)/)
  expect(css).toMatch(/--k-fe-line: calc\(21px \* var\(--k-density\)\)/)
  expect(css).toMatch(/--k-opt-btn: calc\(18px \* var\(--k-density\)\)/)
  expect(css).toMatch(/--k-h-inline: calc\(22px \* var\(--k-density\)\)/)
  expect(css).toMatch(/--k-sug-row: calc\(24px \* var\(--k-density\)\)/)
  expect(css).toMatch(/--k-scrim: #141A2947/i)
})
```

`Prompt.test.tsx` (под `renderK`; обёртка-родитель с `onKeyDown` — журнал всплытия):

```ts
it('open=false — ничего', () => { renderK(<Prompt open={false} onResult={vi.fn()} />); expect(screen.queryByRole('alertdialog')).toBeNull() })
it('alertdialog, aria-modal, имя — заголовок, описание — note; умолчания prompt.js; порядок кнопок', () => {
  renderK(<Prompt open note="Пояснение" onResult={vi.fn()} />)
  const d = screen.getByRole('alertdialog', { name: 'Подтвердите действие' })
  expect(d).toHaveAttribute('aria-modal', 'true')
  expect(d).toHaveAccessibleDescription('Пояснение')
  expect(within(d).getAllByRole('button').map((b) => b.textContent)).toEqual(['Отмена', 'Подтвердить'])
})
it('фокус: neutral — основная, danger — «Отмена»', () => {
  const { rerender } = renderK(<Prompt open okLabel="Утвердить" onResult={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Утвердить' })).toHaveFocus()
  rerender(<Prompt open={false} onResult={vi.fn()} />); rerender(<Prompt open tone="danger" onResult={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus()
})
it('Tab и Shift+Tab ходят только между двумя кнопками', async () => { /* Tab с основной → «Отмена», Tab с «Отмены» → основная, Shift+Tab обратно */ })
it('Esc → onResult(false), keydown не доходит до родителя', async () => {
  const onResult = vi.fn(); const parent = vi.fn()
  renderK(<div onKeyDown={parent}><Prompt open onResult={onResult} /></div>)
  await userEvent.keyboard('{Escape}')
  expect(onResult).toHaveBeenCalledWith(false); expect(parent).not.toHaveBeenCalled()
})
it('mousedown по подложке → false; по коробке — нет', () => { /* fireEvent.mouseDown(container.querySelector('[data-k-prompt]')) → false; по alertdialog — вызовов нет */ })
it('закрытие возвращает фокус туда, где он был до открытия', () => { /* кнопка «Сохранить» в фокусе → open → open=false → «Сохранить» в фокусе */ })
it('PromptChange: было → стало; axe без нарушений', async () => {
  const { container } = renderK(<Prompt open note={<PromptChange was="23.09.2026" now="24.09.2026" />} onResult={vi.fn()} />)
  expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription('23.09.2026 → 24.09.2026')
  expect(await axe(container)).toHaveNoViolations()
})
```

`Drawer.test.tsx`:

```ts
it('overlay — поверх панели вне прокручиваемого содержимого', () => {
  renderK(<Drawer label="Д" title="Т" onClose={vi.fn()} overlay={<div data-testid="ov" />}><p>тело</p></Drawer>)
  const scroll = screen.getByRole('dialog').querySelector('[data-part="scroll"]')
  expect(scroll).toContainElement(screen.getByText('тело'))
  expect(scroll).not.toContainElement(screen.getByTestId('ov'))
  expect(screen.getByRole('dialog')).toContainElement(screen.getByTestId('ov'))
})
```

- [ ] **Step 2: прогон — падают.** `pnpm --filter @katran/tokens exec vitest run src/generate.test.ts` — FAIL (нет `--k-prompt-w`); `pnpm --filter @katran/ui exec vitest run src/overlay/Prompt.test.tsx src/drawer/Drawer.test.tsx` — FAIL (`Prompt` не экспортируется, нет `[data-part="scroll"]`).
- [ ] **Step 3: токены.** Добавить в `tokens.src.ts` цвет `scrim` в `colorsLight`/`colorsDark` и размеры списка «Produces» одной группой с комментарием «правка деталки (спека 2c, эталон .fe/.opts/.txted/.acced/.sug/.pr/.mark, index.html:138–153, 202–245, 365–443; prompt.css)»; `pnpm gen`; `git add packages/tokens/src/tokens.css packages/tokens/src/tokens.ts`.
- [ ] **Step 4: `Prompt(props: PromptProps): JSX.Element | null` и `PromptChange` в `overlay/Prompt.tsx`.** Без портала — рисуется там, куда его положили (в `Drawer.overlay`). Подложка: `position: absolute; inset: 0; background: var(--k-scrim); display: grid; place-items: center; padding: var(--k-sp-4); z-index: 1`, появление `opacity` за `var(--k-t-fast)`; коробка `width: min(var(--k-prompt-w), 100%)`, `padding: var(--k-sp-4) var(--k-sp-4) var(--k-sp-3)`, `border-radius: var(--k-r-l)`, `box-shadow: var(--k-shadow)`, подъём 6 px → 0; `prefers-reduced-motion` — без анимации. Кнопки — `Button` кита (`variant="primary"` у основной, у `danger` — модификатор цвета `bad`), высота `prompt-btn`. Фокус при открытии — `useEffect` по `open`; сохранённый `document.activeElement` возвращается в очистке (только если он ещё в DOM).
- [ ] **Step 5: `DrawerProps.overlay` в `drawer/Drawer.tsx`.** Корень `.drawer`: `overflow: hidden`; новый `.scroll` (`height: 100%; overflow: hidden auto; box-sizing: border-box`) с меткой, шапкой и `children`, `data-part="scroll"`; `overlay` — после `.scroll`. Фокус, `returnFocus`, `focusKey` — без изменений.
- [ ] **Step 6: прогон — зелёные.** Те же команды — PASS; `pnpm check` зелёный: tokens **+1**, ui **≈ +9** (Prompt 8, Drawer 1).
- [ ] **Step 7: e2e деталки на переднем плане.** `pnpm --filter pi exec playwright test e2e/detail.spec.ts e2e/geometry.spec.ts` — всё зелёное (перенос прокрутки во внутренний блок геометрию не меняет).
- [ ] **Step 8: коммит.**

```bash
git add packages/tokens/src/tokens.src.ts packages/tokens/src/tokens.css packages/tokens/src/tokens.ts packages/tokens/src/generate.test.ts \
  packages/ui/src/overlay/Prompt.tsx packages/ui/src/overlay/Prompt.module.css packages/ui/src/overlay/Prompt.test.tsx packages/ui/src/overlay/index.ts \
  packages/ui/src/drawer/Drawer.tsx packages/ui/src/drawer/Drawer.module.css packages/ui/src/drawer/Drawer.test.tsx
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "Кит: токены правки, Prompt (alertdialog внутри drawer), слой Drawer.overlay"
```

---

### Task 3: `EditMark`, `EditHistory`, дифф значений

**Files:**
- Create: `packages/ui/src/value/EditMark.tsx`, `EditMark.test.tsx`; `packages/ui/src/form/diff.ts`, `diff.test.ts`, `EditHistory.tsx`, `EditHistory.test.tsx`, `Edit.module.css`
- Modify: `packages/ui/src/value/Value.module.css`, `value/index.ts`, `form/index.ts`

**Interfaces:**
- Consumes: `StatusBadge`, токены `mark-dot`, `fs-mark`, `edit-dot` (Task 2).
- Produces: `EditMark`, `EditMarkProps`, `EditStatus`; `diffFieldValues`, `diffText`, `editCountLabel`, `EditDiffLine`; `EditHistory`, `EditHistoryEntry`, `EditHistoryProps` — сигнатуры в контракте.

- [ ] **Step 1: падающие тесты.**

```ts
// diff.test.ts
it('diffFieldValues: опция, счёт, строки по номеру; равные — []', () => {
  expect(diffFieldValues({ opt: 'A', lines: ['BANK', 'VKRBRU8KXXX'] }, { opt: 'D', acc: '123', lines: ['BANK', 'VKRBRU8K2KD', 'X'] })).toEqual([
    { label: 'опция', was: 'A', now: 'D' }, { label: 'счёт', was: '', now: '123' },
    { label: '2/', was: 'VKRBRU8KXXX', now: 'VKRBRU8K2KD' }, { label: '3/', was: '', now: 'X' },
  ])
  expect(diffFieldValues({ lines: ['A'] }, { lines: ['A'] })).toEqual([])
})
it('diffText', () => { expect(diffText('A', 'B')).toEqual([{ label: '', was: 'A', now: 'B' }]); expect(diffText('A', 'A')).toEqual([]) })
it('editCountLabel — русское склонение', () => {
  expect([1, 2, 4, 5, 11, 12, 21, 22, 25].map(editCountLabel)).toEqual(
    ['1 изменение', '2 изменения', '4 изменения', '5 изменений', '11 изменений', '12 изменений', '21 изменение', '22 изменения', '25 изменений'])
})
// EditMark.test.tsx
it('без status — одна точка, имя и тултип — tip', () => { /* getByRole('img', { name: 'Было X · Вы, 22.09.2026 10:42' }), data-k-tip, галочки нет */ })
it('pending — галочка скрыта, confirmed — видна', () => { /* data-status, «✓» есть в DOM у обоих; у pending атрибут data-status="pending" */ })
it('axe без нарушений', async () => { /* … */ })
// EditHistory.test.tsx
const entries: EditHistoryEntry[] = [
  { who: 'Кузнецов Д. А.', when: '22.09.2026 09:15', status: 'confirmed', by: 'Смирнова Е. В.', at: '22.09.2026 09:40', note: 'BIC филиала по справочнику', diff: [{ label: '2/', was: 'VKRBRU8KXXX', now: 'VKRBRU8K2KD' }] },
  { who: 'Иванова М. П.', when: '22.09.2026 10:42', status: 'pending', note: 'Полное наименование филиала', diff: [] },
]
it('сводка: «2 изменения», люди, бейдж по последней записи', () => {
  renderK(<EditHistory entries={entries} label="поля 57" />)
  expect(screen.getByText('2 изменения')).toBeInTheDocument()
  expect(screen.getByText('Кузнецов Д. А., Иванова М. П.')).toBeInTheDocument()
  expect(screen.getByText('ожидает утверждения')).toBeInTheDocument()
})
it('«История» раскрывает список, «Свернуть историю» сворачивает; aria-expanded/aria-controls', async () => { /* getByRole('button', { name: 'История' }) → list «История изменений поля 57» с 2 listitem */ })
it('запись: кто, время, бейдж «утверждено» с тултипом «Утвердил(а) Смирнова Е. В., 22.09.2026 09:40», примечание, дифф было/стало', async () => { /* <s>VKRBRU8KXXX</s>, <b>VKRBRU8K2KD</b>, префикс «2/» */ })
it('пустой дифф — «без изменений»; пустой список — ничего', () => { /* … */ })
it('axe без нарушений в раскрытом виде', async () => { /* … */ })
```

- [ ] **Step 2: прогон — падают** (`pnpm --filter @katran/ui exec vitest run src/form/diff.test.ts src/value/EditMark.test.tsx src/form/EditHistory.test.tsx`) — модули не найдены.
- [ ] **Step 3: реализация.** `diffFieldValues(was, now)`: опция — если `(was.opt ?? '') !== (now.opt ?? '')` (пустая в выводе — `''`), счёт — так же по `acc`, строки — по `k < max(len)`, отличающиеся. `editCountLabel`: `n % 10 === 1 && n % 100 !== 11` → «изменение», `n % 10 ∈ 2..4 && n % 100 ∉ 12..14` → «изменения», иначе «изменений». `EditMark` и `EditHistory` — по контракту; CSS — `Edit.module.css`/`Value.module.css` по эталону `.hs/.hl/.mark` (index.html:138–153, 222–240) токенами; бейджи — `StatusBadge` (`ok` / `wait`), тултип бейджа записи — `data-k-tip` на обёртке.
- [ ] **Step 4: прогон — зелёные; `pnpm check`.** ui **≈ +11**.
- [ ] **Step 5: коммит.**

```bash
git add packages/ui/src/value/EditMark.tsx packages/ui/src/value/EditMark.test.tsx packages/ui/src/value/Value.module.css packages/ui/src/value/index.ts \
  packages/ui/src/form/diff.ts packages/ui/src/form/diff.test.ts packages/ui/src/form/EditHistory.tsx packages/ui/src/form/EditHistory.test.tsx \
  packages/ui/src/form/Edit.module.css packages/ui/src/form/index.ts
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "Кит: EditMark, EditHistory с диффом и склонением"
```

---

### Task 4: `SuggestInput` — одно значение только из списка

**Files:**
- Create: `packages/ui/src/select/SuggestInput.tsx`, `SuggestInput.test.tsx`
- Modify: `packages/ui/src/select/options.ts` (`Option.tag`), `Listbox.tsx` (рисует `tag`), `Select.module.css`, `select/index.ts`

**Interfaces:**
- Consumes: `Listbox`, `optionId`, `Popover` (`role="presentation"`), `Tag`, токены `h-inline`, `fs-edit`, `sug-*` (Task 2).
- Produces: `SuggestInput`, `SuggestInputProps`; `Option.tag` — контракт.

- [ ] **Step 1: падающие тесты.** Набор — 7 счетов `40817840100050017762`…, `match = (o, q) => String(o.value).includes(q)`, `sanitize = (t) => t.replace(/\D/g, '')`; обёртка с `onKeyDown`-журналом и `KatranProvider`.

```ts
it('до max строк и хвост «ещё N — уточните номер» вне listbox', () => {
  setup({ value: '' })
  expect(screen.getAllByRole('option')).toHaveLength(5)
  expect(screen.getByText('ещё 2 — уточните номер').closest('[role="listbox"]')).toBeNull()
})
it('фильтр match, совпадение жирным; sanitize до onChange', () => { /* fireEvent.change(поле, { target: { value: 'a1 7' } }) → onChange('17'); при value '17' — <b>17</b> в подписи */ })
it('нет совпадений — строка emptyText(query)', () => { /* value '999' → 'В карточке нет счетов USD, содержащих «999»' */ })
it('↑↓ по кругу, Enter — активный', async () => { /* ↑ с первого → последний показанный; Enter → onCommit(options[4]) */ })
it('Enter: единственный в выдаче; иначе точное совпадение введённого', async () => { /* value '17762' → один → onCommit; value полного номера при нескольких — onCommit этого */ })
it('Enter без совпадения — notInListText, aria-invalid, onCommit не зовётся', async () => {
  setup({ value: '4081' }); await userEvent.keyboard('{Enter}')
  expect(onCommit).not.toHaveBeenCalled()
  expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByText('Счёт не из карточки клиента — выберите из списка')).toBeInTheDocument()
})
it('Esc при открытом списке — onCancel; родитель keydown не получает (деталка не закроется)', async () => {
  setup({ value: '' }); await userEvent.keyboard('{Escape}')
  expect(onCancel).toHaveBeenCalledTimes(1); expect(parentKeydown).not.toHaveBeenCalled()
})
it('mousedown вне поля и списка — onCancel; клик по пункту — onCommit', async () => { /* … */ })
it('status вместо списка; hint и keysHint под полем; tag рисуется', () => { /* status='Загрузка счетов…' → нет role=listbox; 'USD' тегом у строки */ })
it('фокус в поле при монтировании; axe без нарушений', async () => { /* toHaveFocus(); axe */ })
```

- [ ] **Step 2: прогон — падает** (`pnpm --filter @katran/ui exec vitest run src/select/SuggestInput.test.tsx`).
- [ ] **Step 3: `SuggestInput(props: SuggestInputProps): JSX.Element`.** Каркас — как `SearchSelect` с полем (`role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`), но список открыт всё время, `active` по умолчанию `-1`; выдача `shown = options.filter((o) => match(o, sanitize(value)))`, в `Listbox` — `shown.slice(0, max)` с `highlight={sanitize(value)}`; хвост и `status` — внутри поповера после `Listbox`. `Popover.onClose` → `onCancel` (Esc в захвате со `stopPropagation` — до `DrawerStack` и до родителя). Поле — моно `fs-edit`, высота `h-inline`, рамка `val`, при ошибке — `bad`. Строка списка — сетка `minmax(0,1fr) var(--k-sug-tag) var(--k-sug-kind)`, `min-height: var(--k-sug-row)`, поповер `min-width: max(100%, var(--k-sug-w))`.
- [ ] **Step 4: прогон — зелёный; `pnpm check`.** ui **≈ +10**; `SearchSelect.test.tsx` и `MultiSelect.test.tsx` зелёные (у `Option` без `tag` вид прежний).
- [ ] **Step 5: коммит.**

```bash
git add packages/ui/src/select/SuggestInput.tsx packages/ui/src/select/SuggestInput.test.tsx packages/ui/src/select/options.ts \
  packages/ui/src/select/Listbox.tsx packages/ui/src/select/Select.module.css packages/ui/src/select/index.ts
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "Кит: SuggestInput — одно значение только из списка, до 5 строк и «ещё N»"
```

---

### Task 5: `FieldEditor`

**Files:**
- Create: `packages/ui/src/form/FieldEditor.tsx`, `FieldEditor.test.tsx`
- Modify: `packages/ui/src/form/Edit.module.css`, `form/index.ts`

**Interfaces:**
- Consumes: `FieldValue`, `Button`, токены `fe-*`, `opt-*`, `fs-edit` (Task 2).
- Produces: `FieldEditor`, `FieldEditorProps` — контракт.

- [ ] **Step 1: падающие тесты.** Пропсы-основа: `tag='57'`, `name='Банк получателя'`, `original={ opt: 'A', lines: ['VOSTOCHNY KREDIT BANK', 'VKRBRU8KXXX'] }`, `lines=4`, `width=35`, `opts=['A','B','C','D']`, `rule='4 строк по 35 символов, набор SWIFT X'`.

```ts
it('заголовок, две колонки, счётчики «Как есть» и живой', () => {
  setup({ value: { opt: 'A', lines: ['VOSTOCHNY KREDIT BANK', 'VKRBRU8K2KD'] } })
  expect(screen.getByRole('region', { name: 'Поле 57 · Банк получателя — правка' })).toHaveAttribute('data-k-edit')
  expect(screen.getAllByText('32/140')).toHaveLength(2)
})
it('B.57 — заголовок с тегом без префикса', () => { /* tag 'B.57' → 'Поле 57 · …' */ })
it('опции — кнопки aria-pressed, «—» с именем «Без буквы»; выбор зовёт onChange', async () => {
  setup({ opts: ['', 'A', 'F'], value: { lines: [] } })
  expect(screen.getByRole('button', { name: 'Без буквы' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: 'Опция F' }))
  expect(onChange).toHaveBeenLastCalledWith({ opt: 'F', lines: [] })
})
it('N полей «Строка k», ввод — onChange с полным массивом строк; сторона — поле «Счёт» и фокус в нём', async () => { /* account → getByRole('textbox', { name: 'Счёт' }) toHaveFocus; без account — 'Строка 1' в фокусе */ })
it('ошибка: строка ошибки, «Сохранить» недоступна', () => { /* error 'Строка 1: недопустимые символы (…)' → getByText; Сохранить disabled */ })
it('busy: обе кнопки недоступны, поля доступны; saveError показывается', () => { /* … */ })
it('Esc на кнопке опции внутри редактора — onCancel; Enter в поле не сохраняет', async () => { /* фокус на «Опция A», Escape → onCancel 1 раз */ })
it('подвал: rule, «Отмена», «Сохранить»', () => { /* … */ })
it('axe без нарушений', async () => { /* … */ })
```

- [ ] **Step 2: прогон — падает** (`pnpm --filter @katran/ui exec vitest run src/form/FieldEditor.test.tsx`).
- [ ] **Step 3: `FieldEditor(props: FieldEditorProps): JSX.Element`.** Разметка — `editor()` эталона (index.html:981–994) на `<section aria-label>` + `<h6>`; поля — нативные `<input>` (не `Input` кита: высота `fe-line`, нижняя граница `line2`, фокус — `val` и `hover`), `value.lines` дополняются `''` до `lines`; изменение строки k → `onChange({ ...value, lines: next })` без обрезки (нормализация — у модели); «Как есть» — `<pre>` строк `original.lines`, дополненных до N, чипы опций исходного (`span`, у исходной — `data-on`), у стороны — «Счёт / IBAN» + `original.acc ?? '—'` и «Наименование / адрес»; `aria-invalid` и `aria-describedby` (строка ошибки) у полей при `error`.
- [ ] **Step 4: прогон — зелёный; `pnpm check`.** ui **≈ +9**.
- [ ] **Step 5: коммит.**

```bash
git add packages/ui/src/form/FieldEditor.tsx packages/ui/src/form/FieldEditor.test.tsx packages/ui/src/form/Edit.module.css packages/ui/src/form/index.ts
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "Кит: FieldEditor — «Как есть | Редактирование», опции, счёт, строки, счётчики"
```

---

### Task 6: Правка в `ConfigForm` / `FieldRow`, `OWN_ESCAPE`

**Files:**
- Modify: `packages/ui/src/form/types.ts`, `FieldRow.tsx`, `ConfigForm.tsx`, `Form.module.css`, `FieldRow.test.tsx`, `ConfigForm.test.tsx`, `form/index.ts`
- Modify: `packages/ui/src/drawer/DrawerStack.tsx`, `packages/ui/src/drawer/Drawer.test.tsx`

**Interfaces:**
- Consumes: `IconButton`, `defaultPresent`, токены `pen`, `edit-dot`.
- Produces: `FieldDef.editable`, `FieldEdit`, `FormEdit`, `ConfigFormProps.edit`, `FieldRowProps.editable/editing/onEdit/edit`, `OWN_ESCAPE` с `[role="alertdialog"], [data-k-edit]` — контракт.

- [ ] **Step 1: падающие тесты.**

```ts
// FieldRow.test.tsx
it('editable: карандаш-сосед строки «Редактировать поле B.57», тултип «Редактировать»; есть и у пустой строки', async () => {
  const onEdit = vi.fn()
  renderK(<FieldRow tag="B.57" def={def57} value={null} editable onEdit={onEdit} />)
  const pen = screen.getByRole('button', { name: 'Редактировать поле B.57' })
  expect(pen).toHaveAttribute('data-k-tip', 'Редактировать')
  await userEvent.click(pen); expect(onEdit).toHaveBeenCalledTimes(1)
})
it('edit.changed: ячейка data-edited, тултип, скрытый текст «изменено»; раскрытие — «Было:» / «Стало:», аудит, «✎ Изменить»', async () => { /* … */ })
it('edit без changed (откат с историей): ни data-edited, ни «Было/Стало», аудит в раскрытии есть', async () => { /* … */ })
it('закрытие редактора возвращает фокус на карандаш', () => { /* editing true → фокус в поле редактора (renderEditor) → rerender editing false → pen toHaveFocus */ })
// ConfigForm.test.tsx (схема MT103-подобная: grid [['50','55'],['52','56'],['53','57'],['54','59']], text ['70','72'])
it('редактор поля сетки — после обеих ячеек его строки, на всю ширину', () => {
  // renderEditor: (tag) => <div data-testid={`editor-${tag}`} />; порядок в DOM: … 53, 57, [редактор], 54, 59 …
  const { container } = renderK(<ConfigForm {...base} edit={{ ...edit, editing: '57' }} />)
  const order = [...container.querySelectorAll('[data-field], [data-part="editor"]')].map((el) => el.getAttribute('data-field') ?? 'editor')
  expect(order.slice(order.indexOf('53'), order.indexOf('59') + 1)).toEqual(['53', '57', 'editor', '54', '59'])
  expect(screen.getByTestId('editor-57').parentElement).toHaveAttribute('data-part', 'editor')
})
it('редактор текстового поля — сразу после поля', () => { /* editing '70' → редактор между 70 и 72 */ })
it('can(tag) false — карандаша нет; один редактор: editing одно значение', () => { /* … */ })
it('ячейка с открытым редактором — data-editing', () => { /* … */ })
// Drawer.test.tsx
it('Esc внутри [data-k-edit] (на кнопке) и внутри alertdialog не закрывает drawer', async () => {
  const onEscape = vi.fn()
  renderK(<DrawerStack onEscape={onEscape} items={[{ key: 'a', slot: 'a', node: <div><section data-k-edit aria-label="р"><button>Опция A</button></section><div role="alertdialog" aria-label="п"><button>Отмена</button></div></div> }]} />)
  screen.getByRole('button', { name: 'Опция A' }).focus(); await userEvent.keyboard('{Escape}')
  screen.getByRole('button', { name: 'Отмена' }).focus(); await userEvent.keyboard('{Escape}')
  expect(onEscape).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: прогон — падают** (`pnpm --filter @katran/ui exec vitest run src/form/FieldRow.test.tsx src/form/ConfigForm.test.tsx src/drawer/Drawer.test.tsx`).
- [ ] **Step 3: реализация.** `FieldRow`: карандаш — `IconButton size="s"` соседом строки-кнопки внутри `.cell` (CSS: `opacity: 0`, видим при `.cell:hover` и `:focus-within`; у текстового поля — `position: absolute` в правом верхнем углу), `data-edited` при `edit?.changed` (фон `warn-row`, рамка `warn`, угловая точка `::after` `edit-dot`, `.main` — `warn`), `data-k-tip={edit.tip}` на ячейке, скрытый `<span class={s.sr}>изменено: {tip}</span>` в строке; раскрытие (`.full`): `Было:`/`Стало:` (`present(tag, edit.was).full` / `present(tag, value).full`), затем `edit.audit`, затем кнопка «✎ Изменить» при `editable`; правимое пустое поле раскрытия не имеет — только карандаш. Возврат фокуса — `useEffect` по переходу `editing` true → false: фокус на карандаш, если `document.activeElement` — `body` или внутри ячейки. `ConfigForm`: `edit.renderEditor(edit.editing)` в `<div data-part="editor" class={s.editor}>` (`grid-column: 1 / -1`) — в `grid()` после `Fragment` строки, содержащей тег, у текстового — после его ячейки; в `cell()` — `editable={edit?.can(tag)}`, `editing={edit?.editing === tag}`, `onEdit={() => edit?.onEdit(tag)}`, `edit={edit?.state(tag)}`. `DrawerStack`: `OWN_ESCAPE` + `, [role="alertdialog"], [data-k-edit]` и комментарий.
- [ ] **Step 4: прогон — зелёные; `pnpm check`.** ui **≈ +9**; e2e не нужен (без `edit` вид прежний — тесты 2a/2b зелёные).
- [ ] **Step 5: коммит.**

```bash
git add packages/ui/src/form/types.ts packages/ui/src/form/FieldRow.tsx packages/ui/src/form/ConfigForm.tsx packages/ui/src/form/Form.module.css \
  packages/ui/src/form/FieldRow.test.tsx packages/ui/src/form/ConfigForm.test.tsx packages/ui/src/form/index.ts \
  packages/ui/src/drawer/DrawerStack.tsx packages/ui/src/drawer/Drawer.test.tsx
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "Кит: правка в ConfigForm/FieldRow — карандаш, «изменено», слот редактора; Esc правки и Prompt не закрывает drawer"
```

---

### Task 7: `createEditModel`

**Files:**
- Create: `packages/effector/src/createEditModel.ts`, `createEditModel.test.ts`
- Modify: `packages/effector/src/index.ts`

**Interfaces:**
- Consumes: effector 23 (`attach`, `createStore`, `sample`, `combine`).
- Produces: `createEditModel` и типы контракта; правила — «Правила модели» контракта.

- [ ] **Step 1: падающие тесты.** Основа:

```ts
type D = { lines: string[] }
const saveFx = createEffect<SaveQuery<D>, string, Error>()
const make = () => createEditModel<D, string, string>({
  saveFx,
  validate: (_k, d) => (d.lines.some((l) => /[А-я]/.test(l)) ? 'кириллица' : null),
  normalize: (_k, d) => {
    const lines = d.lines.map((l) => l.trim().toUpperCase())
    while (lines.length && !lines[lines.length - 1]) lines.pop()
    return { lines }
  },
  confirmSave: (k) => k.endsWith(':vd'),
})
// журналы saved / failed / leave — сторами; ответы saveFx — отложенными промисами (resolve по ключу), чтобы проверять порядок
```

Тесты (`describe('createEditModel (спека 2c §2.2)')`):

```ts
it('open: черновик = initial, один редактор; тот же ключ — без изменений', async () => { /* $editing {key:'d1:57', initial}, $drafts['d1:57'] */ })
it('open другого ключа при чистом черновике заменяет редактор, черновик прежнего удаляется', async () => { /* … */ })
it('open другого ключа при грязном — $confirm discard; false — остаёмся, true — новый редактор', async () => {
  await open('d1:57', { lines: ['A'] }); await change('d1:57', { lines: ['B'] }); await open('d1:59', { lines: [] })
  expect(scope.getState(m.$confirm)).toEqual({ kind: 'discard', key: 'd1:57' })
  await allSettled(m.confirmResult, { scope, params: false })
  expect(scope.getState(m.$editing)?.key).toBe('d1:57'); expect(scope.getState(m.$confirm)).toBeNull()
  await open('d1:59', { lines: [] }); await allSettled(m.confirmResult, { scope, params: true })
  expect(scope.getState(m.$editing)?.key).toBe('d1:59'); expect(scope.getState(m.$drafts)).not.toHaveProperty('d1:57')
})
it('$errors и $dirty по validate/normalize: « a » против ["A"] — не грязный', async () => { /* change { lines: [' a ', ''] } при initial ['A'] → $dirty false; 'Ж' → $errors['d1:57'] 'кириллица' */ })
it('save с ошибкой — запроса нет', async () => { /* saveFx.handler не вызван */ })
it('save: стало = текущее после normalize — редактор закрыт без запроса', async () => { /* initial ['ABC'], draft [' abc ', ''] → $editing null, вызовов 0 */ })
it('save: запрос с нормализованным черновиком и initial; успех — saved, редактор закрыт', async () => {
  /* draft [' x ', ''] → saveFx получил { key, draft: { lines: ['X'] }, initial }; saved [{ key, result: 'ok' }]; $editing null; $saving false */
})
it('во время сохранения открытого редактора: cancel, open другого ключа, повторный save и submit — игнор', async () => { /* … */ })
it('отказ: $saveError = errorText, редактор и черновик на месте, failed; change сбрасывает ошибку', async () => { /* … */ })
it('confirmSave: save ставит $confirm commit, запрос только после confirmResult(true); false — остаёмся с черновиком', async () => { /* key 'd1:vd' */ })
it('submit: запрос без редактора и без confirm; игнор при same', async () => { /* ↺ */ })
it('поздний ответ: редактор ушёл на другой ключ — saved есть, чужой редактор и ошибка не тронуты', async () => {
  // Review Focus 1
  await open('d1:57', A); await change('d1:57', B); const p = allSettled(m.save, { scope })
  await allSettled(m.requestLeave, { scope, params: { scope: 'd1:', next: 'close-a' } })   // сохранение в полёте — уход без вопроса
  await open('d2:59', C)     // редактор d1 закрыт уходом — open не блокируется летящим запросом d1
  resolve('d1:57', 'deal')   // ответ пришёл после ухода
  await p
  expect(saved()).toEqual([{ key: 'd1:57', result: 'deal' }])
  expect(scope.getState(m.$editing)?.key).toBe('d2:59'); expect(scope.getState(m.$saveError)).toBeNull()
  expect(leaves()).toEqual(['close-a'])
})
it('поздний отказ после reset — ни failed, ни $saveError; $saving false', async () => { /* … */ })
it('requestLeave: ключ вне scope — leave сразу; в scope без грязи — редактор закрыт и leave', async () => { /* … */ })
it('requestLeave: в scope с грязным — $confirm discard; false — ничего; true — редактор закрыт и leave(next); повтор при открытом confirm — игнор', async () => { /* Review Focus 4 */ })
it('reset: всё к начальному', async () => { /* … */ })
```

- [ ] **Step 2: прогон — падает** (`pnpm --filter @katran/effector exec vitest run src/createEditModel.test.ts`) — модуля нет.
- [ ] **Step 3: `createEditModel<Draft, Result, Next = void, Fail extends Error = Error>(cfg): EditModel<…>` в `createEditModel.ts`.** Своя копия транспорта `attach({ effect: cfg.saveFx, mapParams: (p: SaveQuery<Draft> & { visit: number }) => ({ key: p.key, draft: p.draft, initial: p.initial }) })`; визит — стор, растёт на `reset`; ожидающее действие после `Prompt` — внутренний стор `$pending: { kind: 'open'; key; initial } | { kind: 'leave'; next } | { kind: 'commit' } | null`; `$errors` — `combine($drafts, …)` через `validate`; `$dirty` — `combine($editing, $drafts)`. Порядок: `.on` до `sample`, читающих те же сторы (Global Constraints). Экспорт из `index.ts` — функция и все типы контракта.
- [ ] **Step 4: прогон — зелёный; `pnpm check`.** effector **≈ +16**.
- [ ] **Step 5: коммит.**

```bash
git add packages/effector/src/createEditModel.ts packages/effector/src/createEditModel.test.ts packages/effector/src/index.ts
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "Кит effector: createEditModel — один редактор, черновики, сохранение, Prompt, requestLeave, поздние ответы"
```

---

### Task 8: Контракт правки: порты, `EditContext`, разбор `edits`, фейк с памятью

**Files:**
- Create: `apps/pi/src/shared/api/edit-ports.ts`, `edit-ports.test.ts`; `apps/pi/src/entities/fx-doc/model/edit.ts`; `apps/pi/src/app/fake/edits.ts`, `edits.data.ts`
- Modify: `apps/pi/src/shared/api/index.ts`; `apps/pi/src/shared/lib/detail/types.ts`, `index.ts`; `apps/pi/src/entities/fx-doc/model/detail.ts`, `api/detail.mapper.ts`, `api/detail.mapper.test.ts`, `api/detail.example.ts`, `api/ports.ts`, `index.ts`; `apps/pi/src/app/fake/grid.ts`, `server.ts`, `params.ts`, `grids.ts`, `server.test.ts`, `contract.test.ts`

**Interfaces:**
- Consumes: `requestFx`, `obj`, `arr`, `str`, `strOrNull`, `oneOf`, `contractError`, `toApiError`, `DetailParser`; `PromptTone`, `FormEdit` (кит, Task 2/6); `DrawerSlot`, `DrawerOpen`, `EditStatus`.
- Produces: `EditValue`, `EditQuery`, `AccountSide`, `AccountsQuery`, `AccountItem`, `EditPorts`, `createEditPorts`, `fromAccountsResponse`; `LeaveIntent`, `AccountsSlot`, `EditConfirmView`, `EditContext`, изменения `DetailDomain`; `FxHistEntry`, `FxEdit`, `FxDocDetail.edits`, `fieldTarget`, `currentOf`, `originalOf`, `isChanged`, `sameEditValue`, `fxEditPorts`; `FakeEditStore`, `createFxEditStore`, маршруты и регуляторы фейка — контракт.

Решения фейка (`edits.ts`, `edits.data.ts`):
- Память: `Map<id, Map<target, FxHistEntryDto[]>>` + исходный маршрут документа (первый `save` по `accKt`). Текущее значение цели — `now` последней записи; `overlay`: `field:<tag>` → `fields[tag]`, `refOut`, `accDt`, `accKt` (20 цифр), `valueDate` → `valueDates[0]` (остальные три даты не меняются), маршрут → `routeType`/`routeAcc`/`routeRecv`/`routeDesc`/`routeText`; `edits` — `{ [target]: { now, hist } }`, у `route` — `{ now: null, hist }`; без правок — `edits: {}`.
- `save(id, detail, body, when)`: тело — `{ target: string, was, now }` (иначе 400 `VALIDATION` с путём); цель не из `fxEditableTargets` документа — 400 (до Task 9 — список целей Task 8: поля профиля с `editable`, `refOut`, `accDt`, `accKt`, `valueDate` кроме MT199; правила Task 9 подключает там же); счёт не из `accounts(detail, side)` — 400 «Счёт не из карточки клиента — выберите из списка» / «Счёт не из списка счетов банка — выберите из списка»; `!sameEditValue(was, текущее)` — **409** `{ type: 'urn:katran:edit-conflict', title: 'Документ изменили', status: 409 }`; `now` равно текущему — 200 без новой записи; иначе запись `{ who: 'Вы', when, was, now, status: 'pending' }`, у `valueDate` — `status: 'confirmed', by: 'Вы', at: when`; `accKt` с `now ≠ исходного` → маршрут — следующий по кругу в `ROUTES` (index.html:742–746) за текущим `routeAcc` (нет в пуле — `ROUTES[0]`), запись `route`: `{ who: 'система', when, was: 'TYPE ACC → RECV' прежнего, now: … нового, status: 'confirmed', by: 'система', at: when }`; `accKt` с `now = исходному` → исходный маршрут и такая же запись `route`.
- Счета: `CLIENT_ACCOUNTS` (Кт) и `BANK_ACCOUNTS` (Дт) эталона (index.html:671–684) дословно, `acc` → `account`, фильтр по `currency` документа; `side` не `'kt'`/`'dt'` — 400.
- Сид: документ `seedId` (`grids.ts` передаёт `makeFxDocs()[0].id`), цель `field:57`, база — `{ opt: 'A', lines: [f57name, f57] }`: запись 1 — `Кузнецов Д. А.`, `${created[0..10]}T09:15:00`, `now` = `{ opt: 'A', lines: [f57name, f57.slice(0, 8) + '2KD'] }`, `note: 'BIC филиала по справочнику'`, `confirmed`, `by: 'Смирнова Е. В.'`, `at` — `T09:40:00`; запись 2 — `Иванова М. П.`, `T10:42:00`, `now` = `{ opt: 'A', lines: [(f57name + ' BRANCH').slice(0, 35), f57.slice(0, 8) + '2KD'] }`, `note: 'Полное наименование филиала'`, `pending` (index.html:827–829).
- `server.ts`: `EDITS = /^\/grids\/([^/]+)\/documents\/([^/]+)\/edits$/` (только `POST`), `ACCOUNTS = /…\/accounts$/` (только `GET`, `side` из `req.query?.side`); проверять **до** `DOCUMENT`; `failing() === 'edit'` / `'accounts'` — 500; `conflicting() === 'edit'` — 409 до проверки `was`; `when = opts.now?.() ?? локальное «ГГГГ-ММ-ДДTчч:мм:00»`. `params.ts`: `conflicting: () => new URLSearchParams(location.search).get('conflict')`, описание регуляторов в комментарии дополнить.

- [ ] **Step 1: падающие тесты.**

```ts
// edit-ports.test.ts
it('saveEditFx: POST …/documents/{id}/edits с { target, was, now }; ответ — через parseDetail', async () => {
  const reqs: HttpRequest[] = []
  const ports = createEditPorts({ gridId: 'g', parseDetail: (raw, path) => ({ ...(raw as object), path }) })
  const scope = fork({ handlers: [[requestFx, async (r: HttpRequest) => { reqs.push(r); return { id: 'a/b' } }]] })
  const r = await allSettled(ports.saveEditFx, { scope, params: { id: 'a/b', target: 'field:57', was: { lines: ['A'] }, now: { lines: ['B'] } } })
  expect(reqs[0]).toEqual({ method: 'POST', url: '/grids/g/documents/a%2Fb/edits', body: { target: 'field:57', was: { lines: ['A'] }, now: { lines: ['B'] } } })
  expect(r).toEqual({ status: 'done', value: { id: 'a/b', path: 'ответ' } })
})
it('accountsFx: GET …/accounts?side=kt → items', async () => { /* query { side: 'kt' }, value [{ account, ccy, kind }] */ })
it('fromAccountsResponse: не по контракту — contractError с путём', () => { /* { items: [{ account: 1 }] } → 'ответ.items[0].account' */ })
// detail.mapper.test.ts
it('edits: цели, история, статусы; нет поля — {}; чужой статус — contractError', () => {
  const d = parseFxDocDetail({ ...FX_DETAIL_EXAMPLE, edits: { 'field:57': { now: { opt: 'A', lines: ['X'] }, hist: [hist1] }, route: { now: null, hist: [histRoute] } } }, 'ответ')
  expect(d.edits['field:57']?.hist[0]).toEqual({ who: 'Кузнецов Д. А.', when: '2026-09-22T09:15:00', was: { opt: 'A', lines: ['A1'] }, now: { opt: 'A', lines: ['X'] }, note: 'BIC филиала по справочнику', status: 'confirmed', by: 'Смирнова Е. В.', at: '2026-09-22T09:40:00' })
  expect(parseFxDocDetail({ ...FX_DETAIL_EXAMPLE, edits: undefined }, 'ответ').edits).toEqual({})
  expect(() => parseFxDocDetail({ ...FX_DETAIL_EXAMPLE, edits: { refOut: { now: 'A', hist: [{ ...hist1, status: 'done' }] } } }, 'ответ')).toThrow(/edits\.refOut\.hist\[0\]\.status/)
})
it('currentOf / originalOf / isChanged: правка, откат с историей, без правки', () => { /* originalOf = hist[0].was; после отката isChanged false */ })
// server.test.ts (сервер с edits-хранилищем на тестовой строке)
it('POST edits: 200 — деталь с правкой и записью pending; GET detail после — та же правка', async () => { /* … */ })
it('409: was не совпал; ?conflict=edit — 409 всегда', async () => { /* Review Focus 2 */ })
it('400: цель не из профиля, тело без target', async () => { /* … */ })
it('?fail=edit и ?fail=accounts — 500 только у своего маршрута', async () => { /* … */ })
// contract.test.ts
it('правка fx-docs: порт → requestFx → фейк; сид поля 57 у первого документа реестра — 2 записи, confirmed и pending', async () => { /* type первого ≠ MT199 */ })
it('accKt из карточки клиента — маршрут сменился, запись route от «система»; ↺ accKt — маршрут исходный, история сохранена', async () => { /* … */ })
it('valueDate — запись сразу confirmed, by = who; меняется только valueDates[0]', async () => { /* … */ })
it('accounts kt — CLIENT_ACCOUNTS по валюте документа; dt — BANK_ACCOUNTS; side=x — 400', async () => { /* … */ })
```

- [ ] **Step 2: прогон — падают** (`pnpm --filter pi exec vitest run src/shared/api/edit-ports.test.ts src/entities/fx-doc/api/detail.mapper.test.ts src/app/fake/server.test.ts src/app/fake/contract.test.ts`).
- [ ] **Step 3: реализация.** `createEditPorts<D>(cfg): EditPorts<D>` и `fromAccountsResponse` — в `edit-ports.ts` по образцу `ports.ts` (вызов `requestFx` внутри обработчика, `encodeURIComponent(id)`). Типы `shared/lib/detail/types.ts` — по контракту (`PromptTone`, `FormEdit` — `import type` из `@katran/ui`; `DrawerSlot`, `DrawerOpen` — из `@katran/effector`; `AccountItem` — из `../../api`). `entities/fx-doc/model/edit.ts` — типы и `fieldTarget`/`currentOf`/`originalOf`/`isChanged`/`sameEditValue`; маппер — `parseEdits(raw, path)` (`EditValue`: строка или объект как `parseSwiftValue`; `status` — `oneOf(['pending','confirmed'])`; `note`/`by`/`at` — `strOrNull`); `detail.example.ts` — `edits` с одной правкой поля 57 (форма для pi-api). `api/ports.ts` — `fxEditPorts`. Фейк — по «Решениям фейка».
- [ ] **Step 4: прогон — зелёные; `pnpm check`.** pi **≈ +14**; `details.a11y.test.tsx` и тесты 2a/2b зелёные (`edits: {}` у всех документов, кроме сида).
- [ ] **Step 5: коммит.**

```bash
git add apps/pi/src/shared/api/edit-ports.ts apps/pi/src/shared/api/edit-ports.test.ts apps/pi/src/shared/api/index.ts \
  apps/pi/src/shared/lib/detail/types.ts apps/pi/src/shared/lib/detail/index.ts \
  apps/pi/src/entities/fx-doc/model/edit.ts apps/pi/src/entities/fx-doc/model/detail.ts apps/pi/src/entities/fx-doc/api/detail.mapper.ts \
  apps/pi/src/entities/fx-doc/api/detail.mapper.test.ts apps/pi/src/entities/fx-doc/api/detail.example.ts apps/pi/src/entities/fx-doc/api/ports.ts apps/pi/src/entities/fx-doc/index.ts \
  apps/pi/src/app/fake/edits.ts apps/pi/src/app/fake/edits.data.ts apps/pi/src/app/fake/grid.ts apps/pi/src/app/fake/server.ts apps/pi/src/app/fake/params.ts \
  apps/pi/src/app/fake/grids.ts apps/pi/src/app/fake/server.test.ts apps/pi/src/app/fake/contract.test.ts
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "apps/pi: контракт правки — порты saveEditFx/accountsFx, EditContext, edits в детали, фейк с памятью, 409 и пересчёт маршрута"
```

---

### Task 9: Правила и виды правки в `entities/fx-doc`

**Files:**
- Create: `apps/pi/src/entities/fx-doc/model/rules.ts`, `rules.test.ts`, `ui/edit.tsx`, `ui/edit.module.css`, `ui/edit.test.tsx`
- Modify: `apps/pi/src/entities/fx-doc/model/swift.ts` (`editable`), `ui/detail.tsx`, `ui/detail.module.css`, `index.ts`; `apps/pi/src/app/fake/grids.ts`, `server.test.ts` (валидация правилами)

**Interfaces:**
- Consumes: Task 3–6 (кит), Task 8 (`EditContext`, `EditValue`, `FxEdit`, `currentOf`, `originalOf`, `isChanged`, `fieldTarget`).
- Produces: `validateSwiftField`, `validateRefOut`, `validateFxEdit`, `normalizeFxEdit`, `fxEditRule`, `fxEditableTargets`, `FX_CONFIRM_TARGETS`, `fxCommitView`, `fxFormEdit`; `fxHero(d, id, edit)`, `fxBlock(d, id, edit)`; `fxDocDetailDomain.formEdit` — контракт.

Решения видов (`ui/edit.tsx`, тексты — research.md дословно):
- `fxFormEdit(d, edit)`: `can(tag)` — `FX_FIELDS[база].editable === true`; `editing` — тег из `edit.editing` вида `field:<tag>`; `onEdit(tag)` → `edit.open(fieldTarget(tag), currentOf(d, …))`; `state(tag)` — `null` без `d.edits[target]`, иначе `{ changed: isChanged, was: originalOf, tip: 'Изменено: {who}, {when}'` (последняя запись, `when` — `formatDateTimeMinutes`), `audit: <EditHistory label={'поля ' + база} entries=… />` (дифф — `diffFieldValues(was, now)`, `when`/`at` — `formatDateTimeMinutes`) `}`; `renderEditor(tag)` → `FieldEditor` (`original` — `originalOf`, `value` — `edit.draft`, `lines`/`width` — `def.lines ?? 4` / `def.width ?? 35`, `opts`, `account` — `def.kind === 'party'`, `rule` — `fxEditRule(def)`, `error`, `busy` — `edit.saving`, `saveError`, `onCancel` — `edit.cancel`, `onSave` — `edit.save`).
- 20 исх (`RefOutRow` в `FxMessages`): подпись «20 исх»; карандаш — `IconButton` «Изменить 20 исх» (виден при наведении на колонку и в фокусе); правка — `<div data-k-edit>` с `<input>` (`aria-label` «20 исх», `maxLength` 16, `placeholder` «до 16 символов», `text-transform: uppercase`, фокус и выделение при открытии), подсказка «SWIFT X, до 16 символов» / ошибка (`edit.error ?? edit.saveError`) слева, «Enter · Esc» справа; Enter → `edit.save()`, Esc → `edit.cancel()`, `mousedown` вне блока правки (`document`, фаза захвата) → `edit.cancel()`; изменённое — значение `warn`, `EditMark` с `tip` «Было {was || '—'} · {who}, {when}», ↺ — `IconButton` «Вернуть исходное» → `edit.revert('refOut', current, original)`.
- Счета (`AccountRow` side `'dt' | 'kt'`): карандаш «Изменить счёт Дт|Кт»; правка — `SuggestInput` (`aria-label` «Счёт Дт|Кт», `placeholder` «20 цифр», `options` — `accounts(side).items` → `{ value: account, label: account, tag: ccy, hint: kind }`, `match` — вхождение цифр, `sanitize` — `/\D/g` прочь, `emptyText` — Кт «В карточке нет счетов {ccy}, содержащих «{q}»», Дт «В счетах банка нет счетов {ccy}, содержащих «{q}»», `notInListText` — «Счёт не из карточки клиента — выберите из списка» / «Счёт не из списка счетов банка — выберите из списка», `hint` — «Только из карточки клиента · {ccy} · N сч.» / «Только из счетов банка · {ccy} · N сч.» (или `edit.saveError`), `keysHint` «↑↓ Enter · Esc», `status` — загрузка «Загрузка счетов…» / ошибка «Не удалось загрузить счета» + `Button` «Повторить» → `retryAccounts(side)`); текст запроса — локальное состояние вида (черновик модели — только выбранный счёт); `onCommit(o)` → `edit.change(String(o.value))` и `edit.save()`; `onCancel` → `edit.cancel()`; изменённое — значение `warn`, `EditMark` «Было {groupAccount(was)} · {who}, {when}», ↺ «Вернуть исходное». Значения счетов — группами 5-3-1-4-7.
- Маршрут (`FxRoute`): если `d.edits.route` и текущий маршрут ≠ `hist[0].was` — заголовок `warn`, `EditMark` «Маршрут пересчитан после смены счёта Кт · было: {hist[0].was} · система, {when}»; ↺ маршрута нет.
- Дата валютирования (`fxHero(d, 'vd', edit)`): карандаш (`pen` 17) «Изменить дату валютирования», прозрачен до наведения на сводку; правка — `<span data-k-edit>` с подписью «Валютирование», `DateInput` (`aria-label` «Дата валютирования», `min` — `d.created.slice(0, 10)`, `value` — черновик, `size="s"`) и кнопкой «Отмена»; `onChange(v)`: `''` — игнор; `v === current` — `edit.cancel()`; иначе `edit.change(v)` и `edit.save()` (модель ставит `Prompt` «commit»); изменённое — значение `warn` и `EditMark status` по последней записи, `tip` «Изменено: было {формат was} · {who}, {when} · утверждено {by}, {at}» / «… · ожидает утверждения». `✓` «совпадают» — только если все четыре даты равны.
- `fxCommitView('valueDate', was, now)` → `{ title: 'Утвердить новую дату валютирования?', note: <PromptChange was={formatDate(was)} now={formatDate(now)} />, okLabel: 'Утвердить', cancelLabel: 'Отмена', tone: 'neutral' }`.
- `edit === null` (рубль, тесты 2a/2b) — все виды как в 2b, без карандашей.

- [ ] **Step 1: падающие тесты.**

```ts
// rules.test.ts
const f57 = FX_FIELDS['57']!, f50 = FX_FIELDS['50']!
it('строка длиннее W — «Строка k: n символов, максимум W» раньше ошибки набора', () => {
  expect(validateSwiftField(f57, { lines: ['A', 'Ж'.repeat(36)] })).toBe('Строка 2: 36 символов, максимум 35')
})
it('кириллица, ß и «С» кириллическая — ошибка набора с номером строки; строчные латинские допустимы', () => {
  // Review Focus 5
  const X = "недопустимые символы (только латиница, цифры и / - ? : ( ) . , ' +)"
  expect(validateSwiftField(f57, { lines: ['ПРИВЕТ'] })).toBe(`Строка 1: ${X}`)
  expect(validateSwiftField(f57, { lines: ['OK', 'STRASSE ß'] })).toBe(`Строка 2: ${X}`)
  expect(validateSwiftField(f57, { lines: ['BANK С'] })).toBe(`Строка 1: ${X}`)
  expect(validateSwiftField(f57, { lines: ["abc /-?:().,'+ 09"] })).toBeNull()
})
it('счёт стороны: до 34, только латиница и цифры', () => {
  expect(validateSwiftField(f50, { acc: '40817 840', lines: [] })).toBe('Счёт: до 34 символов, только латиница и цифры')
  expect(validateSwiftField(f50, { acc: 'A'.repeat(35), lines: [] })).toBe('Счёт: до 34 символов, только латиница и цифры')
})
it('20 исх: пусто, «/» в начале и конце, «//», кириллица; 16 знаков', () => {
  const BAD = 'Недопустимый референс: латиница, цифры, / - ? : ( ) . , \' + ; не начинать и не заканчивать «/»'
  expect(validateRefOut('  ')).toBe('Референс не может быть пустым')
  expect(['/ABC', 'ABC/', 'A//B', 'РЕФ', 'A'.repeat(17)].map(validateRefOut)).toEqual([BAD, BAD, BAD, BAD, BAD])
  expect(validateRefOut(' fx2609220000417 ')).toBeNull()
})
it('normalizeFxEdit: поля — trim+upper, хвостовые пустые прочь, внутренние пустые остаются, acc trim без upper, пустые opt/acc — без ключа', () => {
  expect(normalizeFxEdit('field:57', { opt: '', acc: ' iban1 ', lines: [' bank ', '', ' x ', '', ' '] })).toEqual({ acc: 'iban1', lines: ['BANK', '', 'X'] })
  expect(normalizeFxEdit('refOut', ' fx1 ')).toBe('FX1')
  expect(normalizeFxEdit('accKt', '40817 840-1')).toBe('408178401')
})
it('fxEditRule', () => {
  expect(fxEditRule(f50)).toBe('4 строк по 35 символов, набор SWIFT X, счёт до 34')
  expect(fxEditRule(FX_FIELDS['72']!)).toBe('6 строк по 35 символов, набор SWIFT X')
})
it('fxEditableTargets по профилям: MT103, MT202, MT202COV с B.*, MT199 без полей и без даты', () => { /* сравнить множества */ })
// ui/edit.test.tsx (деталь из FX_DETAIL_EXAMPLE с edits; EditContext — заглушка с vi.fn())
it('«Общие»: карандаши у 50/52/56/57/59/70/72, нет у 53/54/55/71A/79; поле 57 с правкой — изменено, аудит «2 изменения»', () => { /* … */ })
it('открытый редактор 57: «Как есть» — исходное, черновик — edit.draft, правило подвала', () => { /* … */ })
it('20 исх: Enter — save, Esc — cancel, mousedown вне — cancel; ↺ — revert(refOut, текущее, исходное)', async () => { /* … */ })
it('счёт Кт: подсказка «Только из карточки клиента · USD · 6 сч.»; выбор — change(счёт) и save; ошибка загрузки — «Повторить»', async () => { /* … */ })
it('маршрут после смены Кт — помечен, тултип «Маршрут пересчитан после смены счёта Кт · было: …»; ↺ маршрута нет', () => { /* … */ })
it('дата валютирования: та же дата — cancel; другая — change и save; маркер утверждено/ожидает', async () => { /* … */ })
it('edit = null — карандашей нет (рубль и просмотр как в 2b)', () => { /* … */ })
it('axe без нарушений: открытый редактор поля и открытая правка счёта', async () => { /* … */ })
// server.test.ts
it('400 VALIDATION: бек повторяет правила — кириллица в поле 57', async () => { /* problem.errors[0] = { path: 'now', code: 'VALIDATION', message: 'Строка 1: недопустимые символы (…)' } */ })
```

- [ ] **Step 2: прогон — падают** (`pnpm --filter pi exec vitest run src/entities/fx-doc src/app/fake/server.test.ts`).
- [ ] **Step 3: реализация.** `swift.ts`: `editable: true` у `50`, `52`, `56`, `57`, `59`, `70`, `72` (комментарий «срез 2c» заменить на адрес FIELDS 597–620). Правила — `rules.ts` (`validateSwiftField` — по сырому черновику: набор X ASCII, поэтому прописные после нормализации той же длины; `validateRefOut` — по `trim().toUpperCase()` значения, регулярки txtCommit эталона `/^[A-Z0-9\/\-?:().,'+ ]{1,16}$/` и `/^\/|\/$|\/\//`; `X = /^[A-Z0-9\/\-\?:\(\)\.,'\+ ]*$/i` с проверкой по строке; порядок ошибок: по строкам — длина, затем набор; затем счёт; затем «Всего n символов, максимум N·W»; первая); `fxEditableTargets` — обход схемы профиля (`grid`, `text`, `seqB`) с `FX_FIELDS[база].editable`. Виды — `ui/edit.tsx` по «Решениям видов», стили — `ui/edit.module.css` токенами Task 2. `fxHero`/`fxBlock` получают `edit: EditContext | null` и рисуют виды правки только при `edit !== null`. `fxDocDetailDomain.formEdit = fxFormEdit`. Фейк: `grids.ts` передаёт `createFxEditStore({ seedId, validate: (target, now) => validateFxEdit(target, now as EditValue) })` и цели `fxEditableTargets` (app видит entities).
- [ ] **Step 4: прогон — зелёные; `pnpm check`.** pi **≈ +17**.
- [ ] **Step 5: коммит.**

```bash
git add apps/pi/src/entities/fx-doc/model/rules.ts apps/pi/src/entities/fx-doc/model/rules.test.ts apps/pi/src/entities/fx-doc/model/swift.ts \
  apps/pi/src/entities/fx-doc/ui/edit.tsx apps/pi/src/entities/fx-doc/ui/edit.module.css apps/pi/src/entities/fx-doc/ui/edit.test.tsx \
  apps/pi/src/entities/fx-doc/ui/detail.tsx apps/pi/src/entities/fx-doc/ui/detail.module.css apps/pi/src/entities/fx-doc/index.ts \
  apps/pi/src/app/fake/grids.ts apps/pi/src/app/fake/server.test.ts
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "fx-doc: правила SWIFT X и 20 исх, виды правки полей, 20 исх, счетов, маршрута и даты валютирования"
```

---

### Task 10: Слой `features`, `features/doc-edit`

**Files:**
- Modify: `eslint.config.js`
- Create: `apps/pi/src/features/doc-edit/model/createDocEdit.ts`, `createDocEdit.test.ts`, `ui/useEditContexts.ts`, `ui/useEditContexts.test.tsx`, `index.ts`

**Interfaces:**
- Consumes: `createEditModel` (Task 7), `EditPorts`, `ApiError`, `EditValue`, `AccountsQuery`, `AccountsSlot`, `EditContext`, `EditConfirmView`, `LeaveIntent` (Task 8), `PageLifecycle`.
- Produces: `createDocEdit`, `DocEdit`, `DocEditConfig`, `editKey`, `editScope`, `CONFLICT_TEXT`, `DISCARD_VIEW`, `useEditContexts` — контракт.

Решения:
- Модель: `createEditModel<EditValue, D, LeaveIntent, ApiError>({ saveFx: attach({ effect: ports.saveEditFx, mapParams: (q) => ({ id: idOf(q.key), target: targetOf(q.key), was: q.initial, now: q.draft }) }), validate: (k, v) => cfg.validate(targetOf(k), v), normalize: (k, v) => cfg.normalize(targetOf(k), v), confirmSave: (k) => cfg.confirmTargets.includes(targetOf(k)), errorText })`; `idOf(key)` — до первого `:`, `targetOf` — после; `errorText(e)` — `409` → `CONFLICT_TEXT`, иначе `e.problem?.errors?.[0]?.message ?? e.message`.
- `docEdited` — `model.saved` → `{ id: result.id, detail: result }`; `conflict` — `model.failed` со `status === 409` → `{ id: idOf(key) }`; `lifecycle.pageClosed` → `model.reset`.
- Счета: `loadAccounts({ id, side })` → своя `attach`-копия `accountsFx` с визитом экрана (как `createDetail`: ответ принимается только при `$opened` и своего визита); не грузит, если ключ готов или грузится; ошибка — повтор разрешён. Открытие редактора с целью `accDt`/`accKt` (`model.open`) → `loadAccounts`. `$accounts` сбрасывается на `pageClosed`.
- `useEditContexts(edit, commitView)`: `useUnit` по `$editing`, `$drafts`, `$errors`, `$saving`, `$saveError`, `$confirm`, `$accounts`, `$savedCount` и событиям; возвращает `(docId) => EditContext`: `editing`/`draft`/`error`/`saveError` — только если ключ открытого редактора начинается с `editScope(docId)`; `confirm` — `DISCARD_VIEW` для `discard`, `commitView(target, initial, draft)` для `commit` — только для своего документа; `open(target, current)` → `model.open({ key: editKey(docId, target), initial: current })`; `revert(target, current, original)` → `model.submit({ key, initial: current, draft: original })`. Рост `$savedCount` → `announce('Изменения сохранены')` (`useEffect`, без объявления на монтировании).
- Линт: `LAYERS = ['app', 'pages', 'widgets', 'features', 'entities', 'shared']`; зона «сверх слоёв» `{ target: widgets/doc-detail, from: features, message: 'FSD: doc-detail получает правку контекстом EditContext (спека 2c §3.2)' }`.

- [ ] **Step 1: падающие тесты.**

```ts
// createDocEdit.test.ts (порты — createEffect-заглушки, lifecycle — createPageLifecycle)
it('сохранение: запрос порта { id, target, was, now }, docEdited с деталью ответа, $savedCount + 1', async () => { /* key 'u1:field:57' → { id: 'u1', target: 'field:57', … } */ })
it('409 → $saveError CONFLICT_TEXT, conflict { id }, редактор и черновик на месте', async () => {
  // Review Focus 2
  expect(scope.getState(edit.model.$saveError)).toBe('Документ изменили — откройте заново')
  expect(conflicts()).toEqual([{ id: 'u1' }]); expect(scope.getState(edit.model.$editing)?.key).toBe('u1:field:57')
})
it('400 VALIDATION — текст первой ошибки problem.errors', async () => { /* … */ })
it('valueDate — Prompt commit перед запросом; refOut — без', async () => { /* … */ })
it('открытие правки accKt грузит счета один раз; ошибка — повтор loadAccounts', async () => { /* $accounts['u1:kt'] loading → ready / error */ })
it('ответ счетов после ухода с экрана не пишется; pageClosed — reset модели и счетов', async () => { /* … */ })
// useEditContexts.test.tsx (renderHook под KatranProvider и Provider effector scope)
it('контекст только своего документа: editing, draft, confirm; чужой — null', async () => { /* … */ })
it('confirm: discard — DISCARD_VIEW, commit — commitView(target, initial, draft)', async () => { /* … */ })
it('после сохранения — объявление «Изменения сохранены» в живой области', async () => { /* … */ })
```

- [ ] **Step 2: прогон — падают** (`pnpm --filter pi exec vitest run src/features`).
- [ ] **Step 3: реализация** по «Решениям». `index.ts` экспортирует всё из «Produces».
- [ ] **Step 4: проверка линта границ.** Временно добавить в `apps/pi/src/widgets/doc-detail/ui/DocDetail.tsx` строку `import { editKey } from '../../../features/doc-edit'` → `pnpm lint` падает с «FSD: doc-detail получает правку контекстом EditContext (спека 2c §3.2)»; временно в `apps/pi/src/entities/fx-doc/index.ts` — `export { editKey } from '../../features/doc-edit'` → «FSD: entities не импортирует features». Обе строки убрать; `pnpm lint` зелёный.
- [ ] **Step 5: прогон — зелёные; `pnpm check`.** pi **≈ +9**.
- [ ] **Step 6: коммит.**

```bash
git add eslint.config.js apps/pi/src/features/doc-edit/model/createDocEdit.ts apps/pi/src/features/doc-edit/model/createDocEdit.test.ts \
  apps/pi/src/features/doc-edit/ui/useEditContexts.ts apps/pi/src/features/doc-edit/ui/useEditContexts.test.tsx apps/pi/src/features/doc-edit/index.ts
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "apps/pi: слой features, features/doc-edit — модель правки документа, счета, контекст правки для деталки"
```

---

### Task 11: Виджет деталки: `replaceDetail`, `reloadDetail`, сброс вкладок, охрана ухода, `Prompt`

**Files:**
- Modify: `apps/pi/src/widgets/doc-detail/lib/createDetail.ts`, `lib/createDetail.test.ts`, `ui/DocDetail.tsx`, `ui/DocDetail.test.tsx`, `index.ts`

**Interfaces:**
- Consumes: `LeaveIntent`, `EditContext`, `DetailDomain.formEdit`, третий параметр `renderHero`/`renderBlock` (Task 8); `Prompt`, `Drawer.overlay` (Task 2); `ConfigForm.edit` (Task 6).
- Produces: `DetailConfig.guard`, `Detail.replaceDetail`, `Detail.reloadDetail`, `Detail.leaveRequested`, `Detail.leave`, `DocDetailProps.editOf` — контракт.

Решения:
- `guard: true`: `close(slot)` с документом в слоте → `leaveRequested({ docId: st[slot].id, intent: { kind: 'close', slot } })`, пустой слот — ничего; `closeTop` → то же для `$top`; `open(p)`: документ уже открыт (любой слот) — прямо в стек (`alreadyOpen`, фокус); иначе слот назначения — `p.secondary && st.a ? 'b' : 'a'`, занят другим документом → `leaveRequested({ docId: занявший, intent: { kind: 'open', open: p } })`, пуст — прямо в стек. `leave(intent)` → `stack.close(slot)` / `stack.open(open)`. Без `guard` — как в 2b (события стека напрямую). `pageClosed` → `closeAll` без охраны.
- `replaceDetail({ id, detail })`: только при `lifecycle.$opened`; `$cache[id] = detail`, `$errors` без `id`; из `$tabCache`/`$tabErrors` удаляются ключи `${id}:*`; для слотов с этим `id` и нелокальной активной вкладкой — `loadTabFx` (если не грузится).
- `reloadDetail(id)`: если `id` не грузится — `loadFx({ id, visit })`; кэш не трогается до ответа (слот остаётся `ready`, скелетона нет); ответ — тот же путь, что у обычной загрузки.
- `DocDetail`: `editOf?.(view.id) ?? null` → `edit`; `domain.renderHero(d, id, edit)`, `domain.renderBlock(d, id, edit)`, `ConfigForm edit={edit && domain.formEdit ? domain.formEdit(d, edit) : undefined}`; `Drawer overlay={edit?.confirm ? <Prompt open {...edit.confirm} onResult={edit.onConfirm} /> : undefined}`.

- [ ] **Step 1: падающие тесты.**

```ts
// createDetail.test.ts
it('guard: close(a) с документом — leaveRequested, стек не меняется; leave выполняет', async () => {
  await open('u1'); await open('u2', true)
  await allSettled(detail.close, { scope, params: 'a' })
  expect(requests()).toEqual([{ docId: 'u1', intent: { kind: 'close', slot: 'a' } }]); expect(ids()).toEqual({ a: 'u1', b: 'u2' })
  await allSettled(detail.leave, { scope, params: { kind: 'close', slot: 'a' } })
  expect(ids()).toEqual({ a: 'u2', b: null })   // сдвиг B→A — Review Focus 4
})
it('guard: closeTop — запрос для верхнего; open в занятый A — запрос с docId занявшего; в пустой слот и уже открытый — сразу', async () => { /* … */ })
it('без guard — как в 2b: close и open сразу, leaveRequested не бывает', async () => { /* … */ })
it('replaceDetail: деталь в кэше без запроса, ошибки вкладок и кэш вкладок документа сброшены, активная нелокальная вкладка перезапрошена', async () => { /* tabFx вызван второй раз для { id: 'u1', tab: 'statuses' } */ })
it('replaceDetail после ухода с экрана не пишет в кэш', async () => { /* Review Focus 1 */ })
it('reloadDetail: запрос порта, слот остаётся ready со старой деталью до ответа', async () => { /* Review Focus 2 */ })
// DocDetail.test.tsx
it('editOf: Prompt контекста — в drawer своего документа, поверх панели', async () => { /* editOf u1 → confirm DISCARD-подобный; alertdialog внутри dialog «… u1», в B — нет */ })
it('editOf: renderHero/renderBlock получают контекст, ConfigForm — formEdit; без editOf — null и без formEdit', () => { /* домен-заглушка с vi.fn() */ })
```

- [ ] **Step 2: прогон — падают** (`pnpm --filter pi exec vitest run src/widgets/doc-detail`).
- [ ] **Step 3: реализация** по «Решениям»; `index.ts` — без новых имён (типы `Detail`/`DetailConfig` уже экспортируются).
- [ ] **Step 4: прогон — зелёные; `pnpm check`.** pi **≈ +8**; страницы ещё без `guard` и `editOf` — тесты страниц и a11y зелёные.
- [ ] **Step 5: коммит.**

```bash
git add apps/pi/src/widgets/doc-detail/lib/createDetail.ts apps/pi/src/widgets/doc-detail/lib/createDetail.test.ts \
  apps/pi/src/widgets/doc-detail/ui/DocDetail.tsx apps/pi/src/widgets/doc-detail/ui/DocDetail.test.tsx apps/pi/src/widgets/doc-detail/index.ts
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "Деталка: replaceDetail и reloadDetail, сброс вкладок документа, охрана ухода, Prompt правки в drawer"
```

---

### Task 12: Страница `fx-docs` и e2e против замера эталона

**Files:**
- Create: `apps/pi/src/pages/fx-docs/model/edit.model.ts`, `apps/pi/e2e/detail-edit.spec.ts`
- Modify: `apps/pi/src/pages/fx-docs/model/registry.model.ts`, `model/registry.model.test.ts`, `ui/FxDocsPage.tsx`, `index.ts`; `apps/pi/src/app/details.a11y.test.tsx`

**Interfaces:**
- Consumes: `createDocEdit`, `useEditContexts` (Task 10); `fxEditPorts`, `validateFxEdit`, `normalizeFxEdit`, `FX_CONFIRM_TARGETS`, `fxCommitView` (Task 8–9); `guard`, `leaveRequested`, `leave`, `replaceDetail`, `reloadDetail`, `editOf` (Task 11).
- Produces: `docEdit` (`pages/fx-docs/model/edit.model.ts`); рабочая правка на экране; e2e `detail-edit.spec.ts`.

Связи (`edit.model.ts` импортирует `lifecycle`, `detail`, `registry` из `registry.model.ts` — без цикла):

```ts
export const docEdit = createDocEdit({ ports: fxEditPorts, validate: validateFxEdit, normalize: normalizeFxEdit, confirmTargets: FX_CONFIRM_TARGETS, lifecycle })
sample({ clock: detail.leaveRequested, fn: ({ docId, intent }) => ({ scope: editScope(docId), next: intent }), target: docEdit.model.requestLeave })
sample({ clock: docEdit.model.leave, target: detail.leave })
sample({ clock: docEdit.docEdited, target: detail.replaceDetail })
sample({ clock: docEdit.docEdited, target: registry.refreshRequested })
sample({ clock: docEdit.conflict, fn: ({ id }) => id, target: detail.reloadDetail })
```

`registry.model.ts`: `createDetail({ …, guard: true })`. `FxDocsPage`: `const editOf = useEditContexts(docEdit, fxCommitView)` → `<DocDetail editOf={editOf} … />`. `pages/rub-docs` не меняется.

- [ ] **Step 1: падающие тесты страницы.**

```ts
// registry.model.test.ts
it('правка: сохранение кладёт деталь ответа в кэш без запроса детали и перезапрашивает реестр', async () => { /* detailFx вызван 1 раз, searchFx — 2 раза, $slots.a.data = ответ */ })
it('грязный черновик в A: open другого документа из реестра — Prompt discard; false — A прежний; true — A новый', async () => { /* Review Focus 4 */ })
it('черновик в B: закрытие A без вопроса, B сдвигается в A, редактор B открыт', async () => { /* … */ })
it('409: деталь перезапрошена, редактор открыт с CONFLICT_TEXT', async () => { /* Review Focus 2 */ })
// details.a11y.test.tsx
it('валюта: открытый редактор поля 57 и Prompt даты валютирования — axe без нарушений', async () => { /* … */ })
```

- [ ] **Step 2: прогон — падают** (`pnpm --filter pi exec vitest run src/pages/fx-docs src/app/details.a11y.test.tsx`).
- [ ] **Step 3: реализация** по «Связям»; прогон — зелёные; `pnpm check` зелёный: pi **≈ +5**.
- [ ] **Step 4: e2e.** `apps/pi/e2e/detail-edit.spec.ts` — помощники `dialogs`, `openBtn`, `still`, `ready`, `setQuery`, `start` — как в `detail-tabs.spec.ts`; `REF` — числа Task 1:

```ts
// Замер эталона e065bfb (Task 1, detail-drift.md «2c»): Chromium 1600×1000, 100 %
const REF = { line: 21, opt: 18, inline: 22, sug: 24, promptW: 340, promptBtn: 30 }
const TOL = 2
```

Тесты (первый документ реестра — сид поля 57; запросы `/search` считаются `page.on('request')`):
1. `геометрия правки против эталона ± TOL`: редактор 57 — высота `Строка 1` = `line`, кнопка опции = `opt`, ширина редактора = ширина сетки полей; поле 20 исх и поле счёта = `inline`; строка подсказки = `sug`; коробка `Prompt` = `promptW`, кнопка = `promptBtn`; аннотация `geometry` с фактическими числами; скриншоты `edit-editor.png`, `edit-suggest.png`, `edit-prompt.png`.
2. `поле 57: сид — изменено и «2 изменения»; кириллица — ошибка и «Сохранить» недоступна; сохранение — маркер, «3 изменения», реестр перезапрошен, «Изменения сохранены»`.
3. `20 исх: Enter сохраняет (строчные → прописные), Esc отменяет без запроса, ↺ возвращает исходное`.
4. `счёт Кт из подсказки → маршрут помечен «пересчитан»; Esc в списке отменяет правку, деталка открыта; следующий Esc закрывает деталку` (Review Focus 3).
5. `дата валютирования: Prompt «Утвердить новую дату валютирования?» — «Отмена» оставляет правку с выбранной датой; «Утвердить» — значение warn, галочка утверждено`.
6. `грязный черновик: «Закрыть» и Esc — Prompt «Отменить правку?»; «Продолжить правку» — редактор на месте; «Отменить правку» — деталка закрыта` (Review Focus 4).
7. `?conflict=edit — «Документ изменили — откройте заново», деталь перезапрошена; ?fail=edit — ошибка строкой, повтор после снятия регулятора сохраняет` (Review Focus 2).
8. `рубль: карандашей нет`.

Run: `pnpm --filter pi exec playwright test e2e/detail-edit.spec.ts` на переднем плане — `8 passed`; затем полный `pnpm --filter pi e2e` — **59 + 8 = 67 passed**. Расхождение геометрии больше `TOL` — не править допуск: найти причину (токен Task 2 или CSS вида) и исправить; числа и скриншоты — в леджер для Task 13.
- [ ] **Step 5: коммит.**

```bash
git add apps/pi/src/pages/fx-docs/model/edit.model.ts apps/pi/src/pages/fx-docs/model/registry.model.ts apps/pi/src/pages/fx-docs/model/registry.model.test.ts \
  apps/pi/src/pages/fx-docs/ui/FxDocsPage.tsx apps/pi/src/pages/fx-docs/index.ts apps/pi/src/app/details.a11y.test.tsx apps/pi/e2e/detail-edit.spec.ts
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "fx-docs: правка деталки на экране — сохранение, реестр, Prompt при уходе, 409; e2e против замера эталона"
```

---

### Task 13: Документы

**Files:**
- Modify: `docs/reference/pi-api.md`, `docs/reference/detail-drift.md`, `docs/guides/pi-usage.md`, `docs/guides/effector-fsd.md`, `docs/STATE.md`, `CHANGELOG.md` (корень), `docs/superpowers/specs/2026-10-06-katran-detail-edit-design.md`

**Interfaces:**
- Consumes: факты Task 1–12 (хеши, числа e2e, скриншоты из леджера).
- Produces: документы среза 2c.

- [ ] **Step 1: `pi-api.md`.** §1.7 `POST /grids/{gridId}/documents/{id}/edits` (предложение): тело `{ target, was, now }`, цели и формы `EditValue`, ответ — деталь целиком, ошибки `400 VALIDATION` (бек повторяет правила — таблица ошибок дословно), `409 CONFLICT`, `403`, `404`; утверждение `POST …/edits/{target}/confirm` — задел 2d, только описание. §1.8 `GET /grids/{gridId}/documents/{id}/accounts?side=kt|dt` (предложение): `{ items: [{ account, ccy, kind }] }`, Кт — карточка клиента по валюте документа (10–15), Дт — счета банка; фронт фильтрует и показывает до 5. §2 — `409`. §6 — что фейк не проверяет (права `403`, конкурентные правки разных пользователей, память сбрасывается перезагрузкой). §7.2 — поле `edits`; новый §7.6 «Правки в детали» — `FxEdit`, `FxHistEntry`, статусы ставит бек, дата валютирования подтверждается автором (`confirmed`, `by = who`), пересчёт маршрута после `accKt` (`edits.route`, `who: 'система'`); примеры — из фейка (сид поля 57, ответ после `accKt`).
- [ ] **Step 2: `detail-drift.md` «2c».** Колонку «katran» пунктов Д49–Д60 перевести в факт (задача и коммит); «Замер эталона 2c» — колонка «Кит (e2e Task 12)» и Δ; новые расхождения по скриншотам Task 12 против `stand-*.png` — пункты Д61+ с классом; сводка — итоговые числа.
- [ ] **Step 3: гайды.** `pi-usage.md` — подключение правки во внутреннем приложении: `createEditPorts` сущности, `features/doc-edit` (`createDocEdit`), `createDetail({ guard: true })`, связи страницы (`edit.model.ts`), `DocDetail editOf`; регуляторы фейка `?fail=edit`, `?fail=accounts`, `?conflict=edit`. `effector-fsd.md` — слой `features` в `apps/pi` теперь есть: живой пример `features/doc-edit` вместо иллюстрации `features/pi-annul` (абзац про «в `apps/pi` такой фичи нет» — заменить), правило «виджет получает правку контекстом, фичу не импортирует».
- [ ] **Step 4: STATE, CHANGELOG, спека.** STATE: §5 карта (`features/doc-edit`, `createEditModel`, `Prompt`, `FieldEditor`, `SuggestInput`, `EditMark`, `EditHistory`), §6 (2c исполнен в ветке), §7 техдолг (что отложено: Д27 рубля остаётся, «Утвердить» — 2d, автораскрытие после сохранения — Д60), §8 грабли (новые из леджера), §9 следующий шаг — 2d, §10 строка деталки; итоговые числа тестов и e2e. `CHANGELOG.md` — раздел среза 2c: кит (`Prompt`, `Drawer.overlay`, `EditMark`, `EditHistory`, `diffFieldValues`, `SuggestInput`, `Option.tag`, `FieldEditor`, `ConfigForm.edit`, `OWN_ESCAPE`, `createEditModel`, токены) и `apps/pi`. Спека: статус «утверждена владельцем 06.10; исполнена в `feat/detail-edit`».
- [ ] **Step 5: проверка и коммит.** `pnpm check` зелёный.

```bash
git add docs/reference/pi-api.md docs/reference/detail-drift.md docs/guides/pi-usage.md docs/guides/effector-fsd.md docs/STATE.md CHANGELOG.md \
  docs/superpowers/specs/2026-10-06-katran-detail-edit-design.md
git -c user.name="Ivan Klimenko" -c user.email=ivan.klimenko@gmail.com commit -m "Документы 2c: контракт правки и счетов, сверка с эталоном, гайды, состояние"
```

---

## Самопроверка плана

**1. Покрытие спеки.** §1.1 таблица правимого — Task 9 (поля по `editable` и схеме профиля, 20 исх, счета, дата валютирования с `Prompt`), Task 8 (контракт и фейк); блок аудита и «Было/Стало» для 70/72 (в4) — Task 3, 6, 9; новая деталь в кэше, сброс вкладок, перезапрос реестра — Task 11, 12. §1.2 вне среза — не планируется; «Утвердить» — только описание в pi-api (Task 13). §1.3 в1 — статусы с бека показываются (Task 3, 9); в2 — Task 7 (`submit`, `same` против текущего, не исходного) и Task 8 (фейк пишет запись); в3 — Task 7, 11, 12; в4 — Task 9; решения по умолчанию — Esc = «Отмена» (Task 5, 9), клик вне `FieldEditor` не закрывает (Task 5: обработчика нет), `DateInput` (Task 9). §2.1 — Task 2–6, §2.2 — Task 7. §3.1 — Task 8, 13; §3.2 — Task 10; §3.3 — Task 8–9; §3.4 — Task 11; §3.5 — Task 12; §3.6 — Task 8–9. §4 — Task 5–12 (имена карандашей, фокус в первое поле, один редактор, валидация на лету, нормализация, кнопки при сохранении, 409, объявление, Esc, ↺, дата). §5 — юнит в каждой задаче, e2e — Task 12. §6 — Task 1, 13. §7 — порядок сохранён. §8 — открытые вопросы остаются за владельцем (п. 1 — принято «Esc = Отмена», п. 2 — 2d, п. 3 — техдолг, п. 4 — отдельный эндпоинт `/accounts`).

**2. Шаги.** Каждый шаг кода — файл, сигнатура из контракта и решения, которые тест не определяет (порядок ошибок, место редактора в сетке, пул маршрутов, сид, тексты); тела функций не выписаны. Строк «обработать краевые случаи» нет: краевые случаи — Review Focus с тестами в задачах 4, 5, 7, 8, 9, 10, 11, 12.

**3. Согласованность имён.** `EditValue` — одно имя для черновика, тела запроса и истории (Task 8–12); `EditContext.revert` → `model.submit` (Task 7, 10); `editKey`/`editScope` (Task 10, 12); `replaceDetail`/`reloadDetail`/`leaveRequested`/`leave` (Task 11, 12); `FormEdit`/`FieldEdit` (Task 6, 8, 9); `Prompt`/`PromptChange`/`PromptTone` (Task 2, 8, 9, 11); `fxCommitView`, `FX_CONFIRM_TARGETS` (Task 9, 12); `createFxEditStore` (Task 8, 9). Цель поля — `field:<tag>` везде, где цель, и тег — в `ConfigForm`.

**4. Review Focus.** Пять пунктов — каждый с тестом во владеющей задаче (ссылки в разделе). Проверены и сочтены покрытыми основными тестами: двойной клик «Сохранить» (Task 7, игнор при `$saving`), смена вкладки при открытом редакторе (модель хранит черновик, `TabPanel` размонтирует вид — Task 7/11), Esc в календаре `DateInput` (поповер кита, план 7).

**5. Пропорция.** План описывает 14 задач решениями и тестами; код — только для связей страницы и ключевых утверждений. Объём — около четверти плана 2b при большем числе новых механизмов.

**6. Решения плана, которых нет в спеке (в леджер как рулинги; владелец может переиграть).**
- Р1. `Prompt` внутри drawer: корень `Drawer` перестаёт прокручиваться, прокрутка — во внутреннем `[data-part="scroll"]`, новый проп `overlay` (иначе `inset: 0` в прокручиваемом drawer уезжает с содержимым).
- Р2. Один редактор на экран (A и B вместе) — следствие `$editing` спеки §2.2 (Д59).
- Р3. API модели шире спеки: `submit` (↺), `$dirty`, `failed`, `$editing.initial`, параметр `Fail`. Ответ своего визита даёт `saved` для любого ключа (деталь в кэше не устаревает), редактор меняется только для того же ключа; уход во время сохранения — без `Prompt`.
- Р4. Тексты `Prompt` «Отменить правку?»: note «Несохранённые изменения будут потеряны.», «Отменить правку» / «Продолжить правку», тон `danger` (фокус на «Продолжить правку»); спека даёт только заголовок.
- Р5. 409: редактор остаётся открытым, «Сохранить» доступна (повтор снова даст 409 — текст велит открыть заново); виджет получает `reloadDetail(id)` (в спеке нет).
- Р6. Охрана ухода — `createDetail({ guard: true })` + `leaveRequested`/`leave`, тип `LeaveIntent` в `shared/lib/detail`; уход с экрана (`pageClosed`) — без вопроса.
- Р7. Откат (в2) без маркера «изменено», но с блоком аудита: маркер — только когда текущее ≠ исходному.
- Р8. После сохранения поле не раскрывается автоматически (Д60).
- Р9. Правка счёта открывается с пустым запросом; черновик модели — только выбранный счёт (набор цифр — не «несохранённый ввод», `Prompt` при уходе не спрашивает); загрузка — «Загрузка счетов…», ошибка — «Не удалось загрузить счета» + «Повторить» (на эталоне нет).
- Р10. Склонение «изменение/изменения/изменений» — по правилам русского языка (эталон расходится с ним с 21).
- Р11. Фейк: правки не накладываются на строки реестра (спека §3.6 — только деталь); `who: 'Вы'`; маршрут после Кт — следующий по кругу в `ROUTES`; запись `route` — `confirmed` от «система»; дата валютирования меняет только `valueDates[0]`; регулятор `?conflict=edit` — новая опция `conflicting`; сид — `makeFxDocs()[0]`.
- Р12. Время правки — «дд.мм.гггг чч:мм» (`formatDateTimeMinutes`), как на эталоне.
- Р13. Подпись «Сохранить» при ошибке сохранения не меняется («Повторить» = та же кнопка).
- Р14. Имя карандаша — с тегом `B.` («Редактировать поле B.57»), заголовок редактора — без префикса, как у эталона.
- Р15. `SuggestInput`: Tab и клик вне — отмена (как у эталона); клик вне 20 исх — отмена; `FieldEditor` клик вне не закрывает (спека §1.3).
- Р16. Цвет подложки — токен `scrim` восьмизначным hex.
