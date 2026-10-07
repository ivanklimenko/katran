import { attach, createEvent, createStore, merge, sample, type Event, type EventCallable, type Store } from 'effector'
import type { AnnulDecisionQuery, AnnulPorts, AnnulQuery, AnnulRejectQuery, ApiError } from '../../../shared/api'
import type { AnnulState } from '../../../shared/lib/detail'
import type { PageLifecycle } from '../../../shared/lib/lifecycle'

export type AnnulPromptKind = 'annul' | 'confirm' | 'reject'
/** Prompt аннулирования или решения по запросу на аннулирование документа: when — метка запроса (у annul — null). */
export type AnnulPromptState = { kind: AnnulPromptKind; when: string | null; reason: string; busy: boolean; error: string | null }

export type DocAnnulConfig<D extends { id: string }> = {
  ports: AnnulPorts<D>
  lifecycle: PageLifecycle
  /** Документы с операцией правки (открыт редактор, решение, сохранение); нет — блокировки нет (рубль). */
  blockedDocs?: Store<Record<string, true>> | undefined
  /** Подпись статуса свежей детали — для «пока в статусе «…»». */
  statusLabelOf: (d: D) => string
}

export type DocAnnul<D> = {
  /** «Аннулировать» — Prompt с причиной; игнорируется на закрытом экране, при открытом Prompt документа и для документа из blockedDocs. */
  annulRequested: EventCallable<string>
  /** «Утвердить» запрос на аннулирование (when — метка запроса) — те же условия, что у annulRequested. */
  confirmRequested: EventCallable<{ docId: string; when: string }>
  /** «Отклонить» запрос на аннулирование — те же условия; причина обязательна. */
  rejectRequested: EventCallable<{ docId: string; when: string }>
  /** Причина как введена (trim — при запросе); при busy игнорируется, снимает ошибку. */
  reasonChanged: EventCallable<{ docId: string; reason: string }>
  /** true — команда (у annul и reject — только с непустой причиной), false — закрыть; при busy оба игнорируются. */
  promptResult: EventCallable<{ docId: string; ok: boolean }>
  $prompt: Store<Record<string, AnnulPromptState>>
  /** Ключи $prompt: открытый Prompt или команда/перезапрос в полёте — правке документа недоступно. */
  $busyDocs: Store<Record<string, true>>
  /** Переданный blockedDocs или пустой. */
  $blockedDocs: Store<Record<string, true>>
  /**
   * Свежая деталь после принятой команды. Ответ прошлого визита экрана не выпускается; пришедший после ухода с экрана того же
   * визита — выпускается (кэш детали и реестр сами не принимают его на закрытом).
   */
  docAnnulled: Event<{ id: string; detail: D; kind: AnnulPromptKind }>
  /** 409 команды или сбой перезапроса после принятой команды — деталь и реестр нужно перезапросить. */
  refreshNeeded: Event<{ id: string }>
  /** count растёт на итоге команды (по свежим данным), 409 и сбое перезапроса — объявление text. */
  $done: Store<{ count: number; text: string }>
}

/** Объявления итога аннулирования (спека 2e §3.3, §4 п. 2–5). */
export const ANNUL_TEXT = {
  done: 'Документ аннулирован',
  pending: 'Запрос на аннулирование отправлен на утверждение',
  confirmed: 'Аннулирование утверждено',
  rejected: 'Аннулирование отклонено',
  unchanged: (label: string) => `Команда отправлена — документ пока в статусе «${label}»`,
  refreshFailed: 'Команда отправлена — не удалось обновить данные',
  conflict: 'Документ изменили — данные обновлены',
}

/** Подсказки недоступной «Аннулировать» (спека 2e §4 п. 1) — для вида. */
export const ANNUL_HINT = {
  locked: (who: string) => `Документ заблокирован: ${who}`,
  pending: 'Запрос на аннулирование ожидает утверждения',
  done: 'Документ аннулирован',
  status: (label: string) => `Аннулирование недоступно для документа в статусе «${label}»`,
  busy: 'Завершите текущую операцию с документом',
}

/**
 * Текст итога по свежей детали (спека §3.3, г8): фронт не управляет статусами — показывает то, что вернул бек.
 * annul + done — «аннулирован», annul + pending — «на утверждение», confirm + done — «утверждено», reject + rejected — «отклонено»;
 * иначе итог не наступил — «пока в статусе «{statusLabel}»».
 */
export function annulOutcome(kind: AnnulPromptKind, annul: AnnulState | null, statusLabel: string): string {
  const status = annul?.status ?? null
  if (kind === 'annul' && status === 'done') return ANNUL_TEXT.done
  if (kind === 'annul' && status === 'pending') return ANNUL_TEXT.pending
  if (kind === 'confirm' && status === 'done') return ANNUL_TEXT.confirmed
  if (kind === 'reject' && status === 'rejected') return ANNUL_TEXT.rejected
  return ANNUL_TEXT.unchanged(statusLabel)
}

/** Команда в полёте: визит экрана, где её отправили, — один «полёт» с перезапросом детали. */
type Run = { id: string; kind: AnnulPromptKind; when: string; reason: string; visit: number }
type Refetch = { id: string; kind: AnnulPromptKind; visit: number }
type Ask = { docId: string; kind: AnnulPromptKind; when: string | null }
type Visit = { opened: boolean; visit: number }

/** Отказ без текста — общий текст, не пустая строка в Prompt (как у решений 2d). */
const FAILED = 'Не удалось выполнить действие'
/** Текст отказа команды (409 — отдельно): первая ошибка problem.errors (400), иначе message, иначе FAILED. */
const errorText = (e: ApiError): string => e.problem?.errors?.[0]?.message || e.message || FAILED
const without = <T>(m: Record<string, T>, key: string): Record<string, T> => {
  const next = { ...m }
  delete next[key]
  return next
}
/** Ответ своего визита на открытом экране: после ухода или от прошлого визита Prompt и объявления не трогаются. */
const mine = (cur: Visit, { params }: { params: { visit: number } }) => cur.opened && params.visit === cur.visit

/**
 * Аннулирование документа экрана (спека 2e §3.3): Prompt с причиной → команда (202) → перезапрос детали (Prompt занят) →
 * docAnnulled со свежей деталью и объявление итога по ней (annulOutcome); решения второй руки по запросу — так же. 409 и сбой
 * перезапроса — refreshNeeded. Одна операция над документом за раз: документ из blockedDocs (правка) аннулировать нельзя,
 * $busyDocs — обратная блокировка для правки. Ответы фильтруются по визиту экрана (Ruling R10 2d).
 */
export function createDocAnnul<D extends { id: string; annul: AnnulState | null }>(cfg: DocAnnulConfig<D>): DocAnnul<D> {
  const { ports, lifecycle } = cfg
  // визит экрана: растёт на pageOpened — ответы прошлого визита не принимаются
  const $visit = createStore(0).on(lifecycle.pageOpened, (v) => v + 1)
  const current = { opened: lifecycle.$opened, visit: $visit }
  const $blockedDocs = cfg.blockedDocs ?? createStore<Record<string, true>>({})

  const annulRequested = createEvent<string>()
  const confirmRequested = createEvent<{ docId: string; when: string }>()
  const rejectRequested = createEvent<{ docId: string; when: string }>()
  const reasonChanged = createEvent<{ docId: string; reason: string }>()
  const promptResult = createEvent<{ docId: string; ok: boolean }>()
  const $prompt = createStore<Record<string, AnnulPromptState>>({})

  // свои копии портов: визит едет в параметрах до ответа
  const annulFx = attach({ effect: ports.annulFx, mapParams: ({ id, reason }: Run): AnnulQuery => ({ id, reason }) })
  const confirmFx = attach({ effect: ports.confirmAnnulFx, mapParams: ({ id, when }: Run): AnnulDecisionQuery => ({ id, when }) })
  const rejectFx = attach({ effect: ports.rejectAnnulFx, mapParams: ({ id, when, reason }: Run): AnnulRejectQuery => ({ id, when, reason }) })
  const refetchFx = attach({ effect: ports.detailFx, mapParams: ({ id }: Refetch) => id })

  // Prompt открывается на открытом экране, если у документа нет своего Prompt (не подменяется) и нет операции правки
  const asked = sample({
    clock: merge([
      annulRequested.map((docId): Ask => ({ docId, kind: 'annul', when: null })),
      confirmRequested.map(({ docId, when }): Ask => ({ docId, kind: 'confirm', when })),
      rejectRequested.map(({ docId, when }): Ask => ({ docId, kind: 'reject', when })),
    ]),
    source: { opened: lifecycle.$opened, prompt: $prompt, blocked: $blockedDocs },
    filter: ({ opened, prompt, blocked }, q) => opened && prompt[q.docId] === undefined && blocked[q.docId] !== true,
    fn: (_, q) => q,
  })
  // команда: Prompt не занят; у annul и reject — причина не пуста после trim
  const go = sample({
    clock: promptResult,
    source: { prompt: $prompt, visit: $visit },
    filter: ({ prompt }, { docId, ok }) => {
      const p = prompt[docId]
      return ok && p !== undefined && !p.busy && (p.kind === 'confirm' || p.reason.trim() !== '')
    },
    fn: ({ prompt, visit }, { docId }): Run => {
      const p = prompt[docId] as AnnulPromptState
      return { id: docId, kind: p.kind, when: p.when ?? '', reason: p.reason.trim(), visit }
    },
  })
  // отмена — только без запроса в полёте
  const dismissed = sample({
    clock: promptResult,
    source: $prompt,
    filter: (prompt, { docId, ok }) => !ok && prompt[docId] !== undefined && !(prompt[docId] as AnnulPromptState).busy,
    fn: (_, { docId }) => docId,
  })

  sample({ clock: go, filter: (r) => r.kind === 'annul', target: annulFx })
  sample({ clock: go, filter: (r) => r.kind === 'confirm', target: confirmFx })
  sample({ clock: go, filter: (r) => r.kind === 'reject', target: rejectFx })

  // команда принята — перезапрос детали тем же «полётом»: визит команды, даже если экран уже закрыт (деталь нужна кэшу того же визита)
  sample({
    clock: merge([annulFx.done, confirmFx.done, rejectFx.done]),
    source: $visit,
    filter: (visit, { params }) => params.visit === visit,
    fn: (_, { params }): Refetch => ({ id: params.id, kind: params.kind, visit: params.visit }),
    target: refetchFx,
  })
  const refused = sample({ clock: merge([annulFx.fail, confirmFx.fail, rejectFx.fail]), source: current, filter: mine, fn: (_, { params, error }) => ({ id: params.id, error }) })
  const conflicted = sample({ clock: refused, filter: ({ error }) => error.status === 409, fn: ({ id }) => ({ id }) })
  const declined = sample({ clock: refused, filter: ({ error }) => error.status !== 409, fn: ({ id, error }) => ({ id, text: errorText(error) }) })

  // свежая деталь: событие — по визиту (после ухода того же визита — тоже); Prompt и объявление — только на открытом экране
  const docAnnulled = sample({
    clock: refetchFx.done,
    source: $visit,
    filter: (visit, { params }) => params.visit === visit,
    fn: (_, { params, result }) => ({ id: params.id, detail: result, kind: params.kind }),
  })
  const settled = sample({
    clock: refetchFx.done,
    source: current,
    filter: mine,
    fn: (_, { params, result }) => ({ id: params.id, text: annulOutcome(params.kind, result.annul, cfg.statusLabelOf(result)) }),
  })
  const lost = sample({ clock: refetchFx.fail, source: current, filter: mine, fn: (_, { params }) => ({ id: params.id }) })

  $prompt
    .on(asked, (m, { docId, kind, when }) => ({ ...m, [docId]: { kind, when, reason: '', busy: false, error: null } }))
    .on(reasonChanged, (m, { docId, reason }) => {
      const p = m[docId]
      return p === undefined || p.busy ? m : { ...m, [docId]: { ...p, reason, error: null } }
    })
    .on(go, (m, { id }) => {
      const p = m[id]
      return p === undefined ? m : { ...m, [id]: { ...p, busy: true, error: null } }
    })
    .on(dismissed, (m, docId) => without(m, docId))
    .on([settled, lost, conflicted], (m, { id }) => without(m, id))
    .on(declined, (m, { id, text }) => {
      const p = m[id]
      return p === undefined ? m : { ...m, [id]: { ...p, busy: false, error: text } }
    })
    .reset(lifecycle.pageClosed)

  const $done = createStore({ count: 0, text: '' })
    .on(settled, ({ count }, { text }) => ({ count: count + 1, text }))
    .on(lost, ({ count }) => ({ count: count + 1, text: ANNUL_TEXT.refreshFailed }))
    .on(conflicted, ({ count }) => ({ count: count + 1, text: ANNUL_TEXT.conflict }))

  const $busyDocs = $prompt.map((m) => {
    const out: Record<string, true> = {}
    for (const id of Object.keys(m)) out[id] = true
    return out
  })
  const refreshNeeded = merge([conflicted, lost])

  return {
    annulRequested, confirmRequested, rejectRequested, reasonChanged, promptResult,
    $prompt, $busyDocs, $blockedDocs, docAnnulled, refreshNeeded, $done,
  }
}
