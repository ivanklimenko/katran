import { attach, createEvent, createStore, sample, type Event, type EventCallable, type Store } from 'effector'
import { createEditModel, type EditModel, type SaveQuery } from '@katran/effector'
import type { ApiError, AccountSide, AccountsQuery, EditPorts, EditQuery, EditValue } from '../../../shared/api'
import type { AccountsSlot, EditConfirmView, LeaveIntent } from '../../../shared/lib/detail'
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
  /** Бек принял правку: деталь целиком из ответа (= model.saved, id — detail.id). */
  docEdited: Event<{ id: string; detail: D }>
  /** Отказ 409: документ изменили — деталь нужно перезапросить. */
  conflict: Event<{ id: string }>
  /** Растёт на docEdited — объявление «Изменения сохранены». */
  $savedCount: Store<number>
  /**
   * Отказ сохранения, которому негде показаться строкой: ↺ (редактора нет) или редактор этого ключа уже закрыт (уход во время
   * сохранения). count растёт — объявление text «Изменения не сохранены: {текст отказа}».
   */
  $unsaved: Store<{ count: number; text: string }>
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

/** Отказ без текста — общий текст, не пустая строка под редактором. */
const SAVE_FAILED = 'Не удалось сохранить изменения'
/** Текст отказа сохранения: 409 — CONFLICT_TEXT, иначе первая ошибка problem.errors (без префикса «Правка отклонена: …»), иначе message. */
const errorText = (e: ApiError): string => (e.status === 409 ? CONFLICT_TEXT : e.problem?.errors?.[0]?.message || e.message || SAVE_FAILED)
/** Сторона справочника счетов по цели правки; не счёт — null. */
const sideOf = (target: string): AccountSide | null => (target === 'accDt' ? 'dt' : target === 'accKt' ? 'kt' : null)
const accKey = (q: AccountsQuery) => `${q.id}:${q.side}`

type AccLoad = AccountsQuery & { visit: number }
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

  const docEdited = sample({ clock: inner.saved, fn: ({ result }) => ({ id: result.id, detail: result }) })
  const conflict = sample({ clock: inner.failed, filter: ({ error }) => error.status === 409, fn: ({ key }) => ({ id: idOf(key) }) })
  const $savedCount = createStore(0).on(docEdited, (n) => n + 1)
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
  const $visit = createStore(0).on(lifecycle.pageOpened, (v) => v + 1)
  const current = { opened: lifecycle.$opened, visit: $visit }
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

  return { model, $accounts, loadAccounts, docEdited, conflict, $savedCount, $unsaved }
}
