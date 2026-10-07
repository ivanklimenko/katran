import { attach, createEvent, createStore, merge, sample, type Event, type EventCallable, type Store } from 'effector'
import { createEditModel, type EditModel, type SaveQuery } from '@katran/effector'
import type { ApiError, AccountSide, AccountsQuery, DecisionQuery, EditPorts, EditQuery, EditValue, RejectQuery } from '../../../shared/api'
import type { AccountsSlot, DecisionKind, DecisionState, EditConfirmView, LeaveIntent } from '../../../shared/lib/detail'
import type { PageLifecycle } from '../../../shared/lib/lifecycle'

export type DocEditConfig<D extends { id: string }> = {
  ports: EditPorts<D>
  /** Первая ошибка значения цели или null (правила сущности). */
  validate: (target: string, v: EditValue) => string | null
  /** Значение цели в виде для бека (правила сущности). */
  normalize: (target: string, v: EditValue) => EditValue
  /** Равенство значений правки; по умолчанию модель сравнивает JSON (чувствительно к порядку ключей — передайте правило сущности). */
  same?: ((a: EditValue, b: EditValue) => boolean) | undefined
  /** Цели с Prompt «commit» перед запросом (дата валютирования). */
  confirmTargets: string[]
  lifecycle: PageLifecycle
}

export type DocEdit<D> = {
  model: EditModel<EditValue, D, LeaveIntent, ApiError>
  /** Справочники счетов по ключу `${id}:${side}`. */
  $accounts: Store<Record<string, AccountsSlot>>
  loadAccounts: EventCallable<AccountsQuery>
  /**
   * Бек принял правку или решение по ней: деталь целиком из ответа (id — detail.id). Ответ решения прошлого визита экрана не
   * выпускается; пришедший после ухода с экрана того же визита — выпускается (кэш детали и реестр сами не принимают его на закрытом).
   */
  docEdited: Event<{ id: string; detail: D }>
  /** Отказ 409 сохранения или решения: документ изменили — деталь нужно перезапросить. */
  conflict: Event<{ id: string }>
  /** Растёт на принятом сохранении (не на решении) — объявление «Изменения сохранены». */
  $savedCount: Store<number>
  /**
   * Отказ сохранения, которому негде показаться строкой: ↺ (редактора нет) или редактор этого ключа уже закрыт (уход во время
   * сохранения). count растёт — объявление text «Изменения не сохранены: {текст отказа}».
   */
  $unsaved: Store<{ count: number; text: string }>
  /** Prompt решения по документам (ключ — docId; одна операция на документ); сброс при уходе с экрана. */
  $decision: Store<Record<string, DecisionState>>
  /** «Утвердить» чужую правку цели; игнорируется при открытом редакторе документа, сохранении в полёте, открытом решении документа. */
  confirmRequested: EventCallable<{ docId: string; target: string; when: string }>
  /** «Отклонить» чужую правку цели — те же условия, что у confirmRequested. */
  rejectRequested: EventCallable<{ docId: string; target: string; when: string }>
  /** Причина отклонения как введена (trim — при запросе); при запросе в полёте игнорируется. */
  reasonChanged: EventCallable<{ docId: string; text: string }>
  /** true — запрос (у отклонения — только с непустой причиной), false — закрыть; при запросе в полёте оба игнорируются. */
  decisionResult: EventCallable<{ docId: string; ok: boolean }>
  /** count растёт на успехе и на 409 решения; text — 'Правка утверждена' | 'Правка отклонена' | 'Правку уже обработали — данные обновлены'. */
  $decided: Store<{ count: number; text: string }>
}

/** Ключ правки: `${id}:${target}`; id без ':' (UUID контракта), цель может содержать ':' ('field:57'). */
export const editKey = (id: string, target: string): string => `${id}:${target}`
/** Префикс ключей правки документа — scope для requestLeave и выбора контекста документа. */
export const editScope = (id: string): string => `${id}:`
/** id документа — до первого ':' ключа. */
export const idOf = (key: string): string => key.slice(0, key.indexOf(':'))
/** Цель — после первого ':' ключа. */
export const targetOf = (key: string): string => key.slice(key.indexOf(':') + 1)

export const CONFLICT_TEXT = 'Документ изменили — откройте заново'
export const DISCARD_VIEW: EditConfirmView = {
  title: 'Отменить правку?',
  note: 'Несохранённые изменения будут потеряны.',
  okLabel: 'Отменить правку',
  cancelLabel: 'Продолжить правку',
  tone: 'danger',
}

/** Наибольшая длина причины отклонения (контракт: длиннее — 400 по пути reason). */
export const REJECT_MAX = 140
/** Объявления решения второй руки (спека 2d §4). */
export const DECISION_TEXT = { confirmed: 'Правка утверждена', rejected: 'Правка отклонена', conflict: 'Правку уже обработали — данные обновлены' }

/** Отказ без текста — общий текст, не пустая строка под редактором. */
const SAVE_FAILED = 'Не удалось сохранить изменения'
/** Текст отказа сохранения: 409 — CONFLICT_TEXT, иначе первая ошибка problem.errors (без префикса «Правка отклонена: …»), иначе message. */
const errorText = (e: ApiError): string => (e.status === 409 ? CONFLICT_TEXT : e.problem?.errors?.[0]?.message || e.message || SAVE_FAILED)
/** Сторона справочника счетов по цели правки; не счёт — null. */
const sideOf = (target: string): AccountSide | null => (target === 'accDt' ? 'dt' : target === 'accKt' ? 'kt' : null)
const accKey = (q: AccountsQuery) => `${q.id}:${q.side}`

type AccLoad = AccountsQuery & { visit: number }
type ConfirmRun = DecisionQuery & { visit: number }
type RejectRun = RejectQuery & { visit: number }
type DecisionAsk = { docId: string; target: string; when: string }
/** Отказ решения без текста — общий текст, не пустая строка в Prompt. */
const DECISION_FAILED = 'Не удалось выполнить действие'
/** Текст отказа решения (409 обрабатывается отдельно): первая ошибка problem.errors (400), иначе message, иначе DECISION_FAILED. */
const decisionErrorText = (e: ApiError): string => e.problem?.errors?.[0]?.message || e.message || DECISION_FAILED
const without = <T>(m: Record<string, T>, key: string): Record<string, T> => {
  const next = { ...m }
  delete next[key]
  return next
}
type Visit = { opened: boolean; visit: number }
/** Ответ своего визита экрана: пришедший после ухода или от прошлого визита не принимается. */
const mine = (cur: Visit, { params }: { params: { visit: number } }) => cur.opened && params.visit === cur.visit

/**
 * Правка документа экрана (план 2c §3.2): модель кита createEditModel с ключами `${id}:${target}`, порты saveEditFx/accountsFx,
 * правила сущности, факт docEdited (деталь из ответа) и conflict (409), справочники счетов на время открытого экрана.
 *
 * open и submit модели принимают текущее значение как пришло с бека: модель получает нормализованное (иначе только что открытый
 * редактор «грязный», D16), а в was запроса уходит исходное — бек сверяет was со своим текущим (иначе 409 на значениях,
 * которые нормализация меняет: строчные, кириллица, пробелы).
 */
export function createDocEdit<D extends { id: string }>(cfg: DocEditConfig<D>): DocEdit<D> {
  const { ports, lifecycle } = cfg
  // визит экрана: растёт на pageOpened — ответы справочников и решений прошлого визита не принимаются
  const $visit = createStore(0).on(lifecycle.pageOpened, (v) => v + 1)
  const current = { opened: lifecycle.$opened, visit: $visit }
  const open = createEvent<{ key: string; initial: EditValue }>()
  const submit = createEvent<{ key: string; initial: EditValue; draft: EditValue }>()
  // текущее как пришло с бека, по ключу правки — для was запроса. Пишется только для принятого моделью действия:
  // повторный open того же ключа, open при Prompt или при запросе в полёте was не подменяет (иначе обход 409)
  const $was = createStore<Record<string, EditValue>>({})
  // сырое значение последнего open — ждёт, пока модель откроет этот ключ (сразу или после «Отменить правку» в Prompt)
  const $openRaw = createStore<{ key: string; raw: EditValue } | null>(null)

  const saveFx = attach({
    source: $was,
    effect: ports.saveEditFx,
    mapParams: (q: SaveQuery<EditValue>, was): EditQuery => ({ id: idOf(q.key), target: targetOf(q.key), was: was[q.key] ?? q.initial, now: q.draft }),
  })
  const inner = createEditModel<EditValue, D, LeaveIntent, ApiError>({
    saveFx,
    validate: (k, v) => cfg.validate(targetOf(k), v),
    normalize: (k, v) => cfg.normalize(targetOf(k), v),
    same: cfg.same,
    confirmSave: (k) => cfg.confirmTargets.includes(targetOf(k)),
    errorText,
  })
  // open при открытом Prompt модель игнорирует — ждущее ответа Prompt открытие не подменяется (условие модели confirm === null);
  // объявлено раньше пересылки в inner.open: $confirm читается до того, как модель задаст вопрос Prompt этим же open
  $openRaw.on(
    sample({ clock: open, source: inner.$confirm, filter: (c) => c === null, fn: (_, o) => o }),
    (_, { key, initial }) => ({ key, raw: initial }),
  )
  sample({ clock: open, fn: ({ key, initial }) => ({ key, initial: cfg.normalize(targetOf(key), initial) }), target: inner.open })
  const accepted = sample({
    clock: inner.$editing.updates,
    source: $openRaw,
    filter: (pending, editing) => pending !== null && editing !== null && editing.key === pending.key,
    fn: (pending) => pending as { key: string; raw: EditValue },
  })
  $was.on(accepted, (m, { key, raw }) => ({ ...m, [key]: raw }))
  $openRaw.reset(accepted)
  // ↺: модель примет submit, только если запроса в полёте нет и Prompt не открыт; ключ открытого редактора хранит was своего открытия
  const submitted = sample({
    clock: submit,
    source: { saving: inner.$saving, editing: inner.$editing, confirm: inner.$confirm },
    filter: ({ saving, editing, confirm }, { key }) => !saving && confirm === null && (editing === null || editing.key !== key),
    fn: (_, x) => x,
  })
  $was.on(submitted, (m, { key, initial }) => ({ ...m, [key]: initial }))
  sample({ clock: submit, fn: ({ key, initial, draft }) => ({ key, initial: cfg.normalize(targetOf(key), initial), draft }), target: inner.submit })
  const model: EditModel<EditValue, D, LeaveIntent, ApiError> = { ...inner, open, submit }

  const savedDoc = sample({ clock: inner.saved, fn: ({ result }) => ({ id: result.id, detail: result }) })
  const savedConflict = sample({ clock: inner.failed, filter: ({ error }) => error.status === 409, fn: ({ key }) => ({ id: idOf(key) }) })
  const $savedCount = createStore(0).on(savedDoc, (n) => n + 1)
  // отказ без своего открытого редактора — объявлением (строки под редактором нет)
  const unseen = sample({
    clock: inner.failed,
    source: inner.$editing,
    filter: (editing, { key }) => editing === null || editing.key !== key,
    fn: (_, { error }) => `Изменения не сохранены: ${errorText(error)}`,
  })
  const $unsaved = createStore({ count: 0, text: '' }).on(unseen, ({ count }, text) => ({ count: count + 1, text }))

  // --- справочники счетов: своя копия порта, ответы только своего визита экрана (как у createDetail) ---
  const loadAccounts = createEvent<AccountsQuery>()
  const loadFx = attach({ effect: ports.accountsFx, mapParams: (p: AccLoad): AccountsQuery => ({ id: p.id, side: p.side }) })
  const $accounts = createStore<Record<string, AccountsSlot>>({})

  const done = sample({ clock: loadFx.done, source: current, filter: mine, fn: (_, x) => x })
  const failed = sample({ clock: loadFx.fail, source: current, filter: mine, fn: (_, x) => x })
  $accounts
    .on(loadFx, (m, p) => ({ ...m, [accKey(p)]: { state: 'loading', items: [], error: null } }))
    .on(done, (m, { params, result }) => ({ ...m, [accKey(params)]: { state: 'ready', items: result, error: null } }))
    .on(failed, (m, { params, error }) => ({ ...m, [accKey(params)]: { state: 'error', items: [], error: error.message } }))
    .reset(lifecycle.pageClosed)

  // грузим, если справочника нет или он с ошибкой (повтор); готовый и грузящийся — без запроса
  sample({
    clock: loadAccounts,
    source: { accounts: $accounts, visit: $visit, opened: lifecycle.$opened },
    // экран закрыт — не грузим: ответ всё равно не был бы принят
    filter: ({ accounts, opened }, q) => opened && (accounts[accKey(q)] === undefined || accounts[accKey(q)]?.state === 'error'),
    fn: ({ visit }, q): AccLoad => ({ id: q.id, side: q.side, visit }),
    target: loadFx,
  })
  // открытие правки счёта стороны — справочник этой стороны
  sample({
    clock: open,
    filter: ({ key }) => sideOf(targetOf(key)) !== null,
    fn: ({ key }): AccountsQuery => ({ id: idOf(key), side: sideOf(targetOf(key)) as AccountSide }),
    target: loadAccounts,
  })

  // уход с экрана — редактор, черновики и справочники сбрасываются; ответы прошлого визита модель не примет
  sample({ clock: lifecycle.pageClosed, target: inner.reset })
  $was.reset(lifecycle.pageClosed)
  $openRaw.reset(lifecycle.pageClosed)

  // --- вторая рука: утвердить/отклонить чужую правку (план 2d §3.3); одна операция над документом за раз ---
  const confirmRequested = createEvent<DecisionAsk>()
  const rejectRequested = createEvent<DecisionAsk>()
  const reasonChanged = createEvent<{ docId: string; text: string }>()
  const decisionResult = createEvent<{ docId: string; ok: boolean }>()
  const $decision = createStore<Record<string, DecisionState>>({})
  const confirmFx = attach({ effect: ports.confirmEditFx, mapParams: ({ id, target, when }: ConfirmRun): DecisionQuery => ({ id, target, when }) })
  const rejectFx = attach({ effect: ports.rejectEditFx, mapParams: ({ id, target, when, reason }: RejectRun): RejectQuery => ({ id, target, when, reason }) })

  const kindOf = (kind: DecisionKind) => (q: DecisionAsk) => ({ ...q, kind })
  // решение начинается только на открытом экране, без своего открытого редактора документа, без сохранения в полёте и
  // без уже открытого решения этого документа (оно не подменяется)
  const asked = sample({
    clock: merge([confirmRequested.map(kindOf('confirm')), rejectRequested.map(kindOf('reject'))]),
    source: { opened: lifecycle.$opened, decision: $decision, editing: inner.$editing, saving: inner.$saving },
    filter: ({ opened, decision, editing, saving }, q) =>
      opened && !saving && decision[q.docId] === undefined && (editing === null || !editing.key.startsWith(editScope(q.docId))),
    fn: (_, q) => q,
  })
  // запрос: решение не в полёте; у отклонения — причина не пуста после trim
  const go = sample({
    clock: decisionResult,
    source: { decision: $decision, visit: $visit },
    filter: ({ decision }, { docId, ok }) => {
      const d = decision[docId]
      return ok && d !== undefined && !d.busy && (d.kind === 'confirm' || d.reason.trim() !== '')
    },
    fn: ({ decision, visit }, { docId }) => ({ docId, visit, d: decision[docId] as DecisionState }),
  })
  // отмена — только без запроса в полёте
  const dismissed = sample({
    clock: decisionResult,
    source: $decision,
    filter: (decision, { docId, ok }) => !ok && decision[docId] !== undefined && !(decision[docId] as DecisionState).busy,
    fn: (_, { docId }) => docId,
  })

  // ответы своего визита; после ухода с экрана решения уже сброшены, ответ их не трогает и не объявляется
  const confirmed = sample({ clock: confirmFx.done, source: current, filter: mine, fn: (_, { params }) => params.id })
  const rejected = sample({ clock: rejectFx.done, source: current, filter: mine, fn: (_, { params }) => params.id })
  const refused = sample({ clock: merge([confirmFx.fail, rejectFx.fail]), source: current, filter: mine, fn: (_, { params, error }) => ({ docId: params.id, error }) })
  const decisionConflict = sample({ clock: refused, filter: ({ error }) => error.status === 409, fn: ({ docId }) => ({ id: docId }) })
  const declined = sample({ clock: refused, filter: ({ error }) => error.status !== 409, fn: ({ docId, error }) => ({ docId, text: decisionErrorText(error) }) })

  $decision
    .on(asked, (m, { docId, kind, target, when }) => ({ ...m, [docId]: { kind, target, when, reason: '', busy: false, error: null } }))
    .on(reasonChanged, (m, { docId, text }) => {
      const d = m[docId]
      return d === undefined || d.busy ? m : { ...m, [docId]: { ...d, reason: text, error: null } }
    })
    .on(go, (m, { docId, d }) => ({ ...m, [docId]: { ...d, busy: true, error: null } }))
    .on(dismissed, (m, docId) => without(m, docId))
    .on([confirmed, rejected], (m, docId) => without(m, docId))
    .on(decisionConflict, (m, { id }) => without(m, id))
    .on(declined, (m, { docId, text }) => {
      const d = m[docId]
      return d === undefined ? m : { ...m, [docId]: { ...d, busy: false, error: text } }
    })
    .reset(lifecycle.pageClosed)

  sample({
    clock: go,
    filter: ({ d }) => d.kind === 'confirm',
    fn: ({ docId, visit, d }): ConfirmRun => ({ id: docId, target: d.target, when: d.when, visit }),
    target: confirmFx,
  })
  sample({
    clock: go,
    filter: ({ d }) => d.kind === 'reject',
    fn: ({ docId, visit, d }): RejectRun => ({ id: docId, target: d.target, when: d.when, reason: d.reason.trim(), visit }),
    target: rejectFx,
  })

  const $decided = createStore({ count: 0, text: '' })
    .on(confirmed, ({ count }) => ({ count: count + 1, text: DECISION_TEXT.confirmed }))
    .on(rejected, ({ count }) => ({ count: count + 1, text: DECISION_TEXT.rejected }))
    .on(decisionConflict, ({ count }) => ({ count: count + 1, text: DECISION_TEXT.conflict }))

  // деталь ответа решения — фильтр визита экрана: прошлый визит не принимается; ответ после ухода того же визита выпускается —
  // кэш детали и реестр сами не принимают его на закрытом экране
  const decidedDoc = sample({
    clock: merge([confirmFx.done, rejectFx.done]),
    source: $visit,
    filter: (visit, { params }) => params.visit === visit,
    fn: (_, { result }) => ({ id: result.id, detail: result }),
  })
  const docEdited = merge([savedDoc, decidedDoc])
  const conflict = merge([savedConflict, decisionConflict])

  return {
    model, $accounts, loadAccounts, docEdited, conflict, $savedCount, $unsaved,
    $decision, confirmRequested, rejectRequested, reasonChanged, decisionResult, $decided,
  }
}
