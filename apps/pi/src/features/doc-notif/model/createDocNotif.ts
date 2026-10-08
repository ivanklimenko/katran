import { attach, createEvent, createStore, merge, sample, type Event, type EventCallable, type Store } from 'effector'
import type { ApiError, NotifMessage, NotifPorts, ResendQuery } from '../../../shared/api'
import type { PageLifecycle } from '../../../shared/lib/lifecycle'

/** Окно «Исходное сообщение» (одно на экран): нотификация nid документа docId, n — номер отправки для заголовка. */
export type NotifMessageState = {
  docId: string
  nid: string
  n: number
  state: 'loading' | 'ready' | 'error'
  message: NotifMessage | null
  error: string | null
}

export type DocNotifConfig = { ports: NotifPorts; lifecycle: PageLifecycle }

export type DocNotif = {
  /** «Переотправить все» (без nid) или «Переотправить» строки — Prompt; игнор на закрытом экране, при открытом Prompt и в полёте документа. */
  resendRequested: EventCallable<{ docId: string; nid?: string | undefined; n?: number | undefined }>
  /** true — переотправка (Prompt занят до ответа), false — закрыть; в полёте оба игнорируются. */
  resendResult: EventCallable<{ docId: string; ok: boolean }>
  /** Prompt переотправки (один на страницу): nid и n — null у «все». */
  $resendPrompt: Store<{ docId: string; nid: string | null; n: number | null } | null>
  /** docId → nid в полёте или '*' (все); одна переотправка документа за раз. */
  $resendBusy: Store<Record<string, string>>
  /** Ответ переотправки — содержимое вкладки notif целиком (сырое): страница кладёт его в кэш через detail.replaceTab. */
  resent: Event<{ id: string; data: unknown }>
  /** 409 переотправки — вкладку нужно перезапросить (страница: detail.refreshDoc). */
  resendConflict: Event<{ id: string }>
  /** Окно исходного сообщения; открытое окно заменяется (одно на экран). На закрытом экране — игнор. */
  openMessage: EventCallable<{ docId: string; nid: string; n: number }>
  closeMessage: EventCallable<void>
  /** Повтор загрузки окна в состоянии error; в других состояниях — без запроса. */
  retryMessage: EventCallable<void>
  $message: Store<NotifMessageState | null>
  /**
   * Итог копирования тела сообщения — его объявляет модель: true — COPIED_TEXT, false — COPY_FAILED. Само копирование
   * (буфер обмена — побочный эффект) делает вид эффектом и сообщает сюда результат.
   */
  copied: EventCallable<boolean>
  /** Объявления: count растёт, text — RESEND_TEXT, текст ошибки переотправки (detail Problem, иначе message), COPIED_TEXT, COPY_FAILED. */
  $notice: Store<{ count: number; text: string }>
}

export const RESEND_TEXT = 'Нотификация переотправлена'
export const COPIED_TEXT = 'Скопировано'
export const COPY_FAILED = 'Не удалось скопировать — выделите текст'

/** Отказ без текста — на практике не встречается: ApiError всегда с message. */
const FAILED = 'Не удалось выполнить действие'
/** Текст отказа (как у действий лейна 2d): detail Problem, иначе message. */
const errorText = (e: ApiError): string => e.problem?.detail || e.message || FAILED
const without = <T>(m: Record<string, T>, key: string): Record<string, T> => {
  if (!(key in m)) return m
  const next = { ...m }
  delete next[key]
  return next
}

/** Переотправка в полёте: nid null — все; visit — визит экрана, где её отправили. */
type ResendRun = { id: string; nid: string | null; visit: number }
/** Загрузка окна: seq — номер открытия окна, ответ чужого открытия отбрасывается. */
type MessageRun = { id: string; nid: string; seq: number }
type Visit = { opened: boolean; visit: number }
/** Ответ своего визита на открытом экране: после ухода или от прошлого визита ничего не трогает. */
const mine = (cur: Visit, { params }: { params: { visit: number } }) => cur.opened && params.visit === cur.visit

/**
 * Нотификации документа (спека 2e §3.3, §4 п. 10–11, г11): переотправка всех или одной через Prompt (занят до ответа,
 * одна переотправка документа за раз), успех — resent с содержимым вкладки и объявление, 409 — resendConflict, ошибки —
 * объявление текста; окно исходного сообщения (одно на экран) с загрузкой, ошибкой и повтором. Ответы переотправки
 * фильтруются по визиту экрана, ответы окна — по номеру открытия; pageClosed сбрасывает Prompt, полёт и окно.
 */
export function createDocNotif(cfg: DocNotifConfig): DocNotif {
  const { ports, lifecycle } = cfg
  // визит экрана: растёт на pageOpened — ответы прошлого визита не принимаются
  const $visit = createStore(0).on(lifecycle.pageOpened, (v) => v + 1)
  const current = { opened: lifecycle.$opened, visit: $visit }

  // --- переотправка ---
  const resendRequested = createEvent<{ docId: string; nid?: string | undefined; n?: number | undefined }>()
  const resendResult = createEvent<{ docId: string; ok: boolean }>()
  const $resendPrompt = createStore<{ docId: string; nid: string | null; n: number | null } | null>(null)
  const $resendBusy = createStore<Record<string, string>>({})

  // своя копия порта: визит едет в параметрах до ответа; у «все» nid в запрос не попадает
  const resendFx = attach({
    effect: ports.resendFx,
    mapParams: ({ id, nid }: ResendRun): ResendQuery => (nid === null ? { id } : { id, nid }),
  })

  // Prompt открывается на открытом экране, если другого Prompt нет и у документа нет переотправки в полёте
  const asked = sample({
    clock: resendRequested,
    source: { opened: lifecycle.$opened, prompt: $resendPrompt, busy: $resendBusy },
    filter: ({ opened, prompt, busy }, { docId }) => opened && prompt === null && busy[docId] === undefined,
    fn: (_, { docId, nid, n }) => ({ docId, nid: nid ?? null, n: n ?? null }),
  })
  // переотправка: Prompt этого документа, не в полёте
  const go = sample({
    clock: resendResult,
    source: { prompt: $resendPrompt, busy: $resendBusy, visit: $visit },
    filter: ({ prompt, busy }, { docId, ok }) => ok && prompt !== null && prompt.docId === docId && busy[docId] === undefined,
    fn: ({ prompt, visit }, { docId }): ResendRun => ({ id: docId, nid: prompt?.nid ?? null, visit }),
  })
  // отмена — только без запроса в полёте
  const dismissed = sample({
    clock: resendResult,
    source: { prompt: $resendPrompt, busy: $resendBusy },
    filter: ({ prompt, busy }, { docId, ok }) => !ok && prompt !== null && prompt.docId === docId && busy[docId] === undefined,
    fn: () => null,
  })
  sample({ clock: go, target: resendFx })

  const resent = sample({ clock: resendFx.done, source: current, filter: mine, fn: (_, { params, result }) => ({ id: params.id, data: result }) })
  const refused = sample({ clock: resendFx.fail, source: current, filter: mine, fn: (_, { params, error }) => ({ id: params.id, error }) })
  const resendConflict = sample({ clock: refused, filter: ({ error }) => error.status === 409, fn: ({ id }) => ({ id }) })
  // finally своего визита: busy нового визита старый ответ не снимает
  const landed = sample({ clock: resendFx.finally, source: current, filter: mine, fn: (_, { params }) => params.id })

  $resendPrompt
    .on(asked, (_, p) => p)
    .on(dismissed, () => null)
    .on([resent, refused], (p, { id }) => (p !== null && p.docId === id ? null : p))
    .reset(lifecycle.pageClosed)
  $resendBusy
    .on(go, (m, { id, nid }) => ({ ...m, [id]: nid ?? '*' }))
    .on(landed, (m, id) => without(m, id))
    .reset(lifecycle.pageClosed)

  // --- окно исходного сообщения ---
  const openMessage = createEvent<{ docId: string; nid: string; n: number }>()
  const closeMessage = createEvent<void>()
  const retryMessage = createEvent<void>()
  const $message = createStore<NotifMessageState | null>(null)
  // номер открытия окна: не сбрасывается с уходом с экрана — ответ прошлого визита не совпадёт с открытием нового
  const $seq = createStore(0)

  const messageFx = attach({ effect: ports.messageFx, mapParams: ({ id, nid }: MessageRun) => ({ id, nid }) })

  const shown = sample({ clock: openMessage, source: lifecycle.$opened, filter: (opened) => opened, fn: (_, x) => x })
  const retried = sample({
    clock: retryMessage,
    source: $message,
    filter: (m) => m !== null && m.state === 'error',
    fn: (m) => {
      const { docId, nid, n } = m as NotifMessageState
      return { docId, nid, n }
    },
  })
  const asking = merge([shown, retried])
  // редьюсеры — раньше sample, читающего тот же стор
  $seq.on(asking, (s) => s + 1)
  $message.on(asking, (_, { docId, nid, n }) => ({ docId, nid, n, state: 'loading', message: null, error: null }))
  sample({ clock: asking, source: $seq, fn: (seq, { docId, nid }): MessageRun => ({ id: docId, nid, seq }), target: messageFx })

  // ответ своего открытия: окно закрыто или открыто заново (другой nid или то же) — отброшен
  const own = (src: { m: NotifMessageState | null; seq: number }, { params }: { params: MessageRun }) => src.m !== null && params.seq === src.seq
  const got = sample({ clock: messageFx.done, source: { m: $message, seq: $seq }, filter: own, fn: (_, { result }) => result })
  const missed = sample({ clock: messageFx.fail, source: { m: $message, seq: $seq }, filter: own, fn: (_, { error }) => errorText(error) })
  $message
    .on(got, (m, message) => (m === null ? m : { ...m, state: 'ready', message, error: null }))
    .on(missed, (m, error) => (m === null ? m : { ...m, state: 'error', message: null, error }))
    .reset([closeMessage, lifecycle.pageClosed])

  // --- объявления ---
  const copied = createEvent<boolean>()
  const copyNoted = sample({ clock: copied, source: lifecycle.$opened, filter: (opened) => opened, fn: (_, ok) => ok })
  const $notice = createStore({ count: 0, text: '' })
    .on(resent, ({ count }) => ({ count: count + 1, text: RESEND_TEXT }))
    .on(refused, ({ count }, { error }) => ({ count: count + 1, text: errorText(error) }))
    .on(copyNoted, ({ count }, ok) => ({ count: count + 1, text: ok ? COPIED_TEXT : COPY_FAILED }))

  return {
    resendRequested, resendResult, $resendPrompt, $resendBusy, resent, resendConflict,
    openMessage, closeMessage, retryMessage, $message, copied, $notice,
  }
}
