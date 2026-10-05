import { attach, combine, createEvent, createStore, sample, type Effect, type Event, type EventCallable, type Store } from 'effector'

/** Запрос сохранения: draft — уже после normalize, initial — значение, от которого шла правка (бек сверяет его с текущим). */
export type SaveQuery<Draft> = { key: string; draft: Draft; initial: Draft }
/** Вопрос Prompt: discard — «Отменить правку?» перед уходом от грязного черновика, commit — подтверждение перед запросом. */
export type EditConfirm = { kind: 'discard' | 'commit'; key: string }
/** Просьба уйти: scope — префикс ключа (редактор с таким ключом уход затрагивает), next — что сделать после ухода. */
export type LeaveRequest<Next> = { scope: string; next: Next }
export type EditSaved<Result> = { key: string; result: Result }
export type EditFailed<Fail> = { key: string; error: Fail }

export type EditModelConfig<Draft, Result, Fail extends Error> = {
  saveFx: Effect<SaveQuery<Draft>, Result, Fail>
  /** Первая ошибка черновика или null. */
  validate: (key: string, draft: Draft) => string | null
  /** По умолчанию — как есть. */
  normalize?: ((key: string, draft: Draft) => Draft) | undefined
  /** По умолчанию — JSON.stringify(a) === JSON.stringify(b) (чувствительно к порядку ключей — приложению лучше дать своё). */
  same?: ((a: Draft, b: Draft) => boolean) | undefined
  /** Ключи с Prompt «commit» перед запросом. */
  confirmSave?: ((key: string) => boolean) | undefined
  /** По умолчанию error.message. */
  errorText?: ((error: Fail) => string) | undefined
}

export type EditModel<Draft, Result, Next, Fail extends Error> = {
  /** Один редактор на экран (A и B вместе). */
  $editing: Store<{ key: string; initial: Draft } | null>
  $drafts: Store<Record<string, Draft>>
  /** Ключ → первая ошибка validate(key, черновик); без ошибки — ключа нет. */
  $errors: Store<Record<string, string>>
  /** Редактор открыт и !same(normalize(черновик), initial). */
  $dirty: Store<boolean>
  $saving: Store<boolean>
  /** Ошибка сохранения открытого редактора. */
  $saveError: Store<string | null>
  $confirm: Store<EditConfirm | null>
  open: EventCallable<{ key: string; initial: Draft }>
  change: EventCallable<{ key: string; draft: Draft }>
  cancel: EventCallable<void>
  save: EventCallable<void>
  /** Сохранение без редактора (↺). */
  submit: EventCallable<{ key: string; initial: Draft; draft: Draft }>
  confirmResult: EventCallable<boolean>
  requestLeave: EventCallable<LeaveRequest<Next>>
  leave: Event<Next>
  reset: EventCallable<void>
  saved: Event<EditSaved<Result>>
  failed: Event<EditFailed<Fail>>
}

type Editing<Draft> = { key: string; initial: Draft }
/** Действие, которое ждёт ответа Prompt. */
type Pending<Draft, Next> = { kind: 'open'; key: string; initial: Draft } | { kind: 'leave'; next: Next } | { kind: 'commit' }
type Request<Draft> = SaveQuery<Draft> & { visit: number }

const byJson = <T>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b)
const asIs = <T>(_key: string, d: T) => d
const messageOf = (e: Error) => e.message

/**
 * Правка значений по ключам (спека 2c §2.2, «Правила модели» контракта имён): один редактор, черновик, проверка и нормализация
 * приложения, сохранение одним запросом на модель, Prompt перед потерей черновика и перед запросом, охрана ухода.
 * Ответы принимаются только своего визита (визит растёт на reset); редактор меняется только для того же ключа.
 */
export function createEditModel<Draft, Result, Next = void, Fail extends Error = Error>(
  cfg: EditModelConfig<Draft, Result, Fail>,
): EditModel<Draft, Result, Next, Fail> {
  const normalize = cfg.normalize ?? asIs
  const same = cfg.same ?? byJson
  const confirmSave = cfg.confirmSave ?? (() => false)
  const errorText = cfg.errorText ?? messageOf

  const open = createEvent<{ key: string; initial: Draft }>()
  const change = createEvent<{ key: string; draft: Draft }>()
  const cancel = createEvent<void>()
  const save = createEvent<void>()
  const submit = createEvent<{ key: string; initial: Draft; draft: Draft }>()
  const confirmResult = createEvent<boolean>()
  const requestLeave = createEvent<LeaveRequest<Next>>()
  const leave = createEvent<Next>()
  const reset = createEvent<void>()

  // внутренние шаги: открыть редактор (prev — ключ заменяемого), закрыть редактор по ключу, задать вопрос Prompt
  const opened = createEvent<{ key: string; initial: Draft; prev: string | null }>()
  const closed = createEvent<string>()
  const asked = createEvent<{ confirm: EditConfirm; pending: Pending<Draft, Next> }>()

  // Своя копия транспорта: saveFx приложения может быть общим, done/fail копии — только от запросов этой модели.
  // Визит уходит в параметры копии и возвращается в done/fail — по нему отсекаются ответы прошлого визита.
  const requestFx = attach({
    effect: cfg.saveFx,
    mapParams: (p: Request<Draft>): SaveQuery<Draft> => ({ key: p.key, draft: p.draft, initial: p.initial }),
  })

  const $visit = createStore(0)
  const $editing = createStore<Editing<Draft> | null>(null)
  const $drafts = createStore<Record<string, Draft>>({})
  const $saving = createStore(false)
  /** Ключ летящего запроса. */
  const $inFlight = createStore<string | null>(null)
  const $saveError = createStore<string | null>(null)
  const $confirm = createStore<EditConfirm | null>(null)
  const $pending = createStore<Pending<Draft, Next> | null>(null)

  const $errors = $drafts.map((drafts) => {
    const out: Record<string, string> = {}
    for (const key of Object.keys(drafts)) {
      const e = cfg.validate(key, drafts[key] as Draft)
      if (e !== null) out[key] = e
    }
    return out
  })
  const $dirty = combine($editing, $drafts, (e, drafts) => {
    if (e === null || !(e.key in drafts)) return false
    return !same(normalize(e.key, drafts[e.key] as Draft), e.initial)
  })

  // --- ответы: только своего визита ---
  const doneOwn = sample({ clock: requestFx.done, source: $visit, filter: (v, { params }) => params.visit === v, fn: (_, d) => d })
  const failOwn = sample({ clock: requestFx.fail, source: $visit, filter: (v, { params }) => params.visit === v, fn: (_, f) => f })
  const saved = sample({ clock: doneOwn, fn: ({ params, result }): EditSaved<Result> => ({ key: params.key, result }) })
  const failed = sample({ clock: failOwn, fn: ({ params, error }): EditFailed<Fail> => ({ key: params.key, error }) })

  // change — только для ключа открытого редактора; источник $editing ещё не меняется на change, порядок не важен
  const changed = sample({ clock: change, source: $editing, filter: (e, { key }) => e !== null && e.key === key, fn: (_, c) => c })

  // --- редьюсеры (раньше sample, читающих те же сторы) ---
  $visit.on(reset, (v) => v + 1)
  $editing
    .on(opened, (_, { key, initial }) => ({ key, initial }))
    .on(closed, (e, key) => (e !== null && e.key === key ? null : e))
    .reset(reset)
  $drafts
    .on(opened, (d, { key, initial, prev }) => {
      const next = { ...d }
      if (prev !== null) delete next[prev]
      next[key] = initial
      return next
    })
    .on(changed, (d, { key, draft }) => ({ ...d, [key]: draft }))
    .on(closed, (d, key) => {
      if (!(key in d)) return d
      const next = { ...d }
      delete next[key]
      return next
    })
    .reset(reset)
  $saving.on(requestFx, () => true).on([doneOwn, failOwn], () => false).reset(reset)
  $inFlight.on(requestFx, (_, p) => p.key).on([doneOwn, failOwn], () => null).reset(reset)
  // значение ошибки ставит sample по failOwn ниже — только для открытого редактора того же ключа
  $saveError.reset(opened, closed, changed, reset)
  $confirm.on(asked, (_, a) => a.confirm).reset(opened, closed, reset)
  $pending.on(asked, (_, a) => a.pending).reset(opened, closed, reset)

  // --- open ---
  const openDecision = sample({
    clock: open,
    source: { editing: $editing, inFlight: $inFlight, dirty: $dirty, confirm: $confirm },
    // пока летит запрос открытого редактора или открыт Prompt — игнор; тот же ключ — ничего
    filter: ({ editing, inFlight, confirm }, { key }) =>
      confirm === null && !(editing !== null && inFlight === editing.key) && (editing === null || editing.key !== key),
    fn: (src, req) => ({ ...src, req }),
  })
  sample({
    clock: openDecision,
    filter: ({ editing, dirty }) => editing === null || !dirty,
    fn: ({ editing, req }) => ({ key: req.key, initial: req.initial, prev: editing === null ? null : editing.key }),
    target: opened,
  })
  sample({
    clock: openDecision,
    filter: ({ editing, dirty }) => editing !== null && dirty,
    fn: ({ editing, req }) => ({
      confirm: { kind: 'discard' as const, key: (editing as Editing<Draft>).key },
      pending: { kind: 'open' as const, key: req.key, initial: req.initial },
    }),
    target: asked,
  })

  // --- cancel: во время сохранения открытого редактора — игнор ---
  sample({
    clock: cancel,
    source: { editing: $editing, inFlight: $inFlight },
    filter: ({ editing, inFlight }) => editing !== null && inFlight !== editing.key,
    fn: ({ editing }) => (editing as Editing<Draft>).key,
    target: closed,
  })

  // --- save ---
  const saveDecision = sample({
    clock: save,
    source: { editing: $editing, drafts: $drafts, errors: $errors, saving: $saving, confirm: $confirm, visit: $visit },
    filter: ({ editing, drafts, errors, saving, confirm }) =>
      editing !== null && editing.key in drafts && !saving && confirm === null && !(editing.key in errors),
    fn: ({ editing, drafts, visit }) => {
      const { key, initial } = editing as Editing<Draft>
      return { key, initial, draft: normalize(key, drafts[key] as Draft), visit }
    },
  })
  sample({ clock: saveDecision, filter: (q) => same(q.draft, q.initial), fn: (q) => q.key, target: closed })
  sample({
    clock: saveDecision,
    filter: (q) => !same(q.draft, q.initial) && confirmSave(q.key),
    fn: (q) => ({ confirm: { kind: 'commit' as const, key: q.key }, pending: { kind: 'commit' as const } }),
    target: asked,
  })
  sample({ clock: saveDecision, filter: (q) => !same(q.draft, q.initial) && !confirmSave(q.key), target: requestFx })

  // --- submit (↺): без редактора и без Prompt ---
  const submitted = sample({
    clock: submit,
    source: { saving: $saving, visit: $visit },
    filter: ({ saving }) => !saving,
    fn: ({ visit }, { key, initial, draft }): Request<Draft> => ({ key, initial, draft: normalize(key, draft), visit }),
  })
  sample({ clock: submitted, filter: (q) => !same(q.draft, q.initial), target: requestFx })

  // --- ответ Prompt: решение читается до сброса $confirm/$pending (сброс — на resolved) ---
  const resolved = sample({
    clock: confirmResult,
    source: { confirm: $confirm, pending: $pending },
    filter: ({ confirm, pending }) => confirm !== null && pending !== null,
    fn: ({ confirm, pending }, ok) => ({ confirm: confirm as EditConfirm, pending: pending as Pending<Draft, Next>, ok }),
  })
  $confirm.reset(resolved)
  $pending.reset(resolved)
  const accepted = sample({ clock: resolved, filter: (r) => r.ok, fn: (r) => r })
  sample({
    clock: accepted,
    source: $editing,
    filter: (_, r) => r.pending.kind === 'open',
    fn: (editing, r) => {
      const p = r.pending as Extract<Pending<Draft, Next>, { kind: 'open' }>
      return { key: p.key, initial: p.initial, prev: editing === null ? null : editing.key }
    },
    target: opened,
  })
  const leaveAccepted = sample({
    clock: accepted,
    filter: (r) => r.pending.kind === 'leave',
    fn: (r) => ({ key: r.confirm.key, next: (r.pending as Extract<Pending<Draft, Next>, { kind: 'leave' }>).next }),
  })
  sample({ clock: leaveAccepted, fn: (r) => r.key, target: closed })
  sample({ clock: leaveAccepted, fn: (r) => r.next, target: leave })
  sample({
    clock: accepted,
    source: { editing: $editing, drafts: $drafts, saving: $saving, visit: $visit },
    filter: ({ editing, drafts, saving }, r) => r.pending.kind === 'commit' && !saving && editing !== null && editing.key === r.confirm.key && editing.key in drafts,
    fn: ({ editing, drafts, visit }): Request<Draft> => {
      const { key, initial } = editing as Editing<Draft>
      return { key, initial, draft: normalize(key, drafts[key] as Draft), visit }
    },
    target: requestFx,
  })

  // --- requestLeave ---
  const leaveDecision = sample({
    clock: requestLeave,
    source: { editing: $editing, inFlight: $inFlight, dirty: $dirty, confirm: $confirm },
    filter: ({ confirm }) => confirm === null,
    fn: (src, req) => ({ ...src, req, inScope: src.editing !== null && src.editing.key.startsWith(req.scope) }),
  })
  // вне scope или редактора нет — сразу; в scope, но запрос этого ключа в полёте или черновик чистый — закрыть и уйти
  const leaveNow = sample({
    clock: leaveDecision,
    filter: ({ inScope, editing, inFlight, dirty }) => !inScope || inFlight === (editing as Editing<Draft>).key || !dirty,
  })
  sample({ clock: leaveNow, filter: (d) => d.inScope, fn: (d) => (d.editing as Editing<Draft>).key, target: closed })
  sample({ clock: leaveNow, fn: (d) => d.req.next, target: leave })
  sample({
    clock: leaveDecision,
    filter: ({ inScope, editing, inFlight, dirty }) => inScope && inFlight !== (editing as Editing<Draft>).key && dirty,
    fn: (d) => ({ confirm: { kind: 'discard' as const, key: (d.editing as Editing<Draft>).key }, pending: { kind: 'leave' as const, next: d.req.next } }),
    target: asked,
  })

  // --- ответ своего визита: редактор меняется, только если открыт тот же ключ ---
  sample({
    clock: doneOwn,
    source: $editing,
    filter: (e, { params }) => e !== null && e.key === params.key,
    fn: (_, { params }) => params.key,
    target: closed,
  })
  sample({
    clock: failOwn,
    source: $editing,
    filter: (e, { params }) => e !== null && e.key === params.key,
    fn: (_, { error }) => errorText(error),
    target: $saveError,
  })

  return {
    $editing, $drafts, $errors, $dirty, $saving, $saveError, $confirm,
    open, change, cancel, save, submit, confirmResult, requestLeave, leave, reset, saved, failed,
  }
}
