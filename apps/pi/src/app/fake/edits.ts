import { fieldTarget, sameEditValue } from '../../entities/fx-doc'
import { toApiError, type EditValue, type Problem } from '../../shared/api'
import { BANK_ACCOUNTS, CLIENT_ACCOUNTS, ROUTES, type FakeAccount, type FakeRoute } from './edits.data'

type Detail = Record<string, unknown>
/** Запись истории в форме контракта: note/by/at — только когда есть. */
type HistDto = { who: string; when: string; was: EditValue; now: EditValue; note?: string; status: 'pending' | 'confirmed' | 'rejected'; by?: string; at?: string; reason?: string }

/** Память правок фейка на сессию (спека 2c §3.6): правки ложатся на деталь, строки реестра не меняются (Р11). */
export type FakeEditStore = {
  /** Текущие значения и edits поверх детали; без правок — edits: {}. */
  overlay: (id: string, detail: Detail) => Detail
  /** Применить правку; бросает ApiError 400 (тело, цель, значение, счёт) и 409 (was ≠ текущему); возвращает overlay. */
  save: (id: string, detail: Detail, body: unknown, when: string) => Detail
  /** Справочник счетов стороны по валюте документа: { items }; side не 'kt'|'dt' — 400. */
  accounts: (detail: Detail, side: unknown) => unknown
  /**
   * Утвердить или отклонить последнюю ожидающую запись цели (срез 2d); бросает ApiError 400 (тело, причина), 404 (нет правок цели),
   * 409 (when не последней записи или она уже не pending), 403 (автор — «Вы»); возвращает overlay.
   */
  decide: (id: string, detail: Detail, target: string, kind: 'confirm' | 'reject', body: unknown, when: string) => Detail
}
export type FakeEditStoreConfig = {
  /** Документ с сидом правки поля 57 (как на эталоне, index.html:827–829); null — без сида. */
  seedId: string | null
  /** Документ с чужой ожидающей правкой accKt (для отклонения с пересчётом маршрута); без поля — без сида. */
  accKtSeedId?: string | null | undefined
  /** Бек повторяет правила фронта: текст первой ошибки → 400 VALIDATION по пути 'now'. */
  validate?: ((target: string, now: unknown) => string | null) | undefined
  /** Цели правки документа (правила домена — fxEditableTargets: поля профиля с editable, 20 исх, счета, дата валютирования). */
  targets: (detail: Detail) => string[]
}

const FIELD = 'field:'
const NOT_CLIENT = 'Счёт не из карточки клиента — выберите из списка'
const NOT_BANK = 'Счёт не из списка счетов банка — выберите из списка'
const REASON_MAX = 140
/** Автор правок пользователя фейка; чужие записи — любые другие. */
const ME = 'Вы'

const invalid = (path: string, message: string): never => {
  const p: Problem = { type: 'urn:katran:edit-validation', title: 'Правка отклонена', status: 400, detail: message, errors: [{ path, code: 'VALIDATION', message }] }
  throw toApiError(400, p)
}
const conflict = (): never => {
  throw toApiError(409, { type: 'urn:katran:edit-conflict', title: 'Документ изменили', status: 409 })
}

const problem = (status: number, title: string, detail: string): never => {
  throw toApiError(status, { type: 'urn:katran:fake', title, status, detail })
}

const isStr = (v: unknown): v is string => typeof v === 'string'
const isEditValue = (v: unknown): v is EditValue => {
  if (typeof v === 'string') return true
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
  const o = v as Record<string, unknown>
  return Array.isArray(o.lines) && o.lines.every(isStr) && (o.opt === undefined || isStr(o.opt)) && (o.acc === undefined || isStr(o.acc))
}

/** Значение цели в детали без правок. */
function rawValue(detail: Detail, target: string): EditValue {
  if (target.startsWith(FIELD)) return ((detail.fields ?? {}) as Record<string, EditValue | undefined>)[target.slice(FIELD.length)] ?? { lines: [] }
  if (target === 'valueDate') return (detail.valueDates as string[])[0] ?? ''
  const v = detail[target]
  return typeof v === 'string' ? v : ''
}

const routeOf = (d: Detail): FakeRoute => ({ type: String(d.routeType), acc: String(d.routeAcc), desc: String(d.routeDesc), recv: String(d.routeRecv), text: String(d.routeText) })
const routeLabel = (r: FakeRoute) => `${r.type} ${r.acc} → ${r.recv}`
/** Следующий по кругу в пуле за текущим счётом маршрута; нет в пуле — первый (Р11). */
const nextRoute = (r: FakeRoute): FakeRoute => {
  const i = ROUTES.findIndex((x) => x.acc === r.acc)
  return ROUTES[i < 0 ? 0 : (i + 1) % ROUTES.length]!
}
const accountsOf = (side: 'kt' | 'dt'): readonly FakeAccount[] => (side === 'kt' ? CLIENT_ACCOUNTS : BANK_ACCOUNTS)

export function createFxEditStore(cfg: FakeEditStoreConfig): FakeEditStore {
  const targetsOf = cfg.targets
  /** id → цель → история (от первой записи); текущее значение цели — now последней записи. */
  const hists = new Map<string, Map<string, HistDto[]>>()
  /** id → исходный маршрут (снят при первой правке Кт) и текущий. */
  const routes = new Map<string, { original: FakeRoute; current: FakeRoute }>()
  const seeded = new Set<string>()

  const histOf = (id: string) => {
    let m = hists.get(id)
    if (!m) hists.set(id, (m = new Map()))
    return m
  }
  /** Сид строится лениво из детали: имя банка 57 есть только в ней (preflight D19). */
  const seed = (id: string, detail: Detail) => {
    if (seeded.has(id)) return
    if (id === cfg.seedId) seed57(id, detail)
    if (id === cfg.accKtSeedId) seedAccKt(id, detail)
  }
  const seed57 = (id: string, detail: Detail) => {
    seeded.add(id)
    const name = String(detail.f57name)
    const bic = String(detail.f57)
    const day = String(detail.created).slice(0, 10)
    const base: EditValue = { opt: 'A', lines: [name, bic] }
    const first: EditValue = { opt: 'A', lines: [name, `${bic.slice(0, 8)}2KD`] }
    const second: EditValue = { opt: 'A', lines: [`${name} BRANCH`.slice(0, 35), `${bic.slice(0, 8)}2KD`] }
    histOf(id).set(fieldTarget('57'), [
      { who: 'Кузнецов Д. А.', when: `${day}T09:15:00`, was: base, now: first, note: 'BIC филиала по справочнику', status: 'confirmed', by: 'Смирнова Е. В.', at: `${day}T09:40:00` },
      { who: 'Иванова М. П.', when: `${day}T10:42:00`, was: first, now: second, note: 'Полное наименование филиала', status: 'pending' },
    ])
  }
  /** Чужая ожидающая правка Кт на другой счёт той же валюты; маршрут уже пересчитан (как после правки, Р11). */
  const seedAccKt = (id: string, detail: Detail) => {
    seeded.add(id)
    const to = CLIENT_ACCOUNTS.find((a) => a.ccy === detail.currency && a.acc !== detail.accKt)
    if (!to) return
    const when = `${String(detail.created).slice(0, 10)}T11:05:00`
    const m = histOf(id)
    m.set('accKt', [{ who: 'Кузнецов Д. А.', when, was: String(detail.accKt), now: to.acc, note: 'Счёт по заявлению клиента', status: 'pending' }])
    const prev = routeOf(detail)
    const next = nextRoute(prev)
    routes.set(id, { original: prev, current: next })
    m.set('route', [{ who: 'система', when, was: routeLabel(prev), now: routeLabel(next), status: 'confirmed', by: 'система', at: when }])
  }
  // без Array#at: Chromium 88 (global-constraints)
  const last = (hist: HistDto[] | undefined) => (hist ? hist[hist.length - 1] : undefined)
  /** Значение цели после записи: у отклонённой цель вернулась к was записи. */
  const valueOf = (h: HistDto): EditValue => (h.status === 'rejected' ? h.was : h.now)
  const current = (id: string, detail: Detail, target: string): EditValue => {
    const l = last(hists.get(id)?.get(target))
    return l ? valueOf(l) : rawValue(detail, target)
  }
  /** «Последняя запись pending и автор не «Вы»»; route и valueDate — всегда false. */
  const canConfirmOf = (target: string, hist: HistDto[]): boolean => {
    const l = last(hist)
    return target !== 'route' && target !== 'valueDate' && l !== undefined && l.status === 'pending' && l.who !== ME
  }
  const original = (id: string, detail: Detail, target: string): EditValue => hists.get(id)?.get(target)?.[0]?.was ?? rawValue(detail, target)

  const overlay = (id: string, detail: Detail): Detail => {
    seed(id, detail)
    const out: Detail = { ...detail }
    const fields: Record<string, unknown> = { ...((detail.fields ?? {}) as Record<string, unknown>) }
    const edits: Record<string, { now: EditValue | null; canConfirm: boolean; hist: HistDto[] }> = {}
    for (const [target, hist] of hists.get(id) ?? []) {
      const copy = hist.map((h) => ({ ...h }))
      if (target === 'route') { edits.route = { now: null, canConfirm: false, hist: copy }; continue }
      const now = valueOf(last(hist)!)
      edits[target] = { now, canConfirm: canConfirmOf(target, hist), hist: copy }
      if (target.startsWith(FIELD)) fields[target.slice(FIELD.length)] = now
      else if (target === 'valueDate') out.valueDates = [now, ...(detail.valueDates as string[]).slice(1)]
      else out[target] = now
    }
    const route = routes.get(id)?.current
    if (route) Object.assign(out, { routeType: route.type, routeAcc: route.acc, routeRecv: route.recv, routeDesc: route.desc, routeText: route.text })
    return { ...out, fields, edits }
  }

  /** Пересчёт маршрута после смены Кт на value: откат к исходному Кт — исходный маршрут, иначе следующий по кругу; новая запись от «система». */
  const recalcRoute = (id: string, detail: Detail, value: EditValue, when: string) => {
    const m = histOf(id)
    const r = routes.get(id) ?? { original: routeOf(detail), current: routeOf(detail) }
    const prev = r.current
    const next = sameEditValue(value, original(id, detail, 'accKt')) ? r.original : nextRoute(prev)
    if (routeLabel(next) === routeLabel(prev)) return
    routes.set(id, { original: r.original, current: next })
    m.set('route', [...(m.get('route') ?? []), { who: 'система', when, was: routeLabel(prev), now: routeLabel(next), status: 'confirmed', by: 'система', at: when }])
  }

  const save = (id: string, detail: Detail, body: unknown, when: string): Detail => {
    seed(id, detail)
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return invalid('', 'Тело правки — объект { target, was, now }')
    const { target, was, now } = body as { target?: unknown; was?: unknown; now?: unknown }
    if (typeof target !== 'string') return invalid('target', 'target — строка')
    if (!targetsOf(detail).includes(target)) return invalid('target', `Цель «${target}» у этого документа не правится`)
    const isField = target.startsWith(FIELD)
    const shape = isField ? 'объект { opt?, acc?, lines }' : 'строка'
    if (!isEditValue(was) || (typeof was === 'string') === isField) return invalid('was', `was — ${shape}`)
    if (!isEditValue(now) || (typeof now === 'string') === isField) return invalid('now', `now — ${shape}`)
    // откат («стало = исходное», в2, спека §4) принимается всегда: исходное могло быть пустым (20 исх), вне правил или вне справочника
    const revert = sameEditValue(now, original(id, detail, target))
    const error = revert ? null : cfg.validate?.(target, now) ?? null
    if (error !== null) return invalid('now', error)
    if (!revert && (target === 'accDt' || target === 'accKt')) {
      const side = target === 'accKt' ? 'kt' : 'dt'
      const inList = accountsOf(side).some((a) => a.ccy === detail.currency && a.acc === now)
      if (!inList) return invalid('now', side === 'kt' ? NOT_CLIENT : NOT_BANK)
    }
    const cur = current(id, detail, target)
    if (!sameEditValue(was, cur)) return conflict()
    if (sameEditValue(now, cur)) return overlay(id, detail)
    const entry: HistDto = target === 'valueDate'
      ? { who: ME, when, was: cur, now, status: 'confirmed', by: ME, at: when }
      : { who: ME, when, was: cur, now, status: 'pending' }
    const m = histOf(id)
    m.set(target, [...(m.get(target) ?? []), entry])
    if (target === 'accKt') recalcRoute(id, detail, now, when)
    return overlay(id, detail)
  }

  const accounts = (detail: Detail, side: unknown): unknown => {
    if (side !== 'kt' && side !== 'dt') return invalid('side', 'side — kt или dt')
    return { items: accountsOf(side).filter((a) => a.ccy === detail.currency).map((a) => ({ account: a.acc, ccy: a.ccy, kind: a.kind })) }
  }

  const decide = (id: string, detail: Detail, target: string, kind: 'confirm' | 'reject', body: unknown, when: string): Detail => {
    seed(id, detail)
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return invalid('', kind === 'reject' ? 'Тело — объект { when, reason }' : 'Тело — объект { when }')
    const { when: at, reason } = body as { when?: unknown; reason?: unknown }
    if (typeof at !== 'string') return invalid('when', 'when — строка')
    if (kind === 'reject' && typeof reason !== 'string') return invalid('reason', 'reason — строка')
    const hist = hists.get(id)?.get(target)
    const entry = last(hist)
    if (!hist || !entry) return problem(404, 'Правок цели нет', `${id}: ${target}`)
    if (entry.status !== 'pending' || entry.when !== at) return conflict()
    if (entry.who === ME) return problem(403, 'Нет прав', 'Свою правку утверждает или отклоняет другой пользователь')
    const text = typeof reason === 'string' ? reason.trim() : ''
    if (kind === 'reject' && (text.length < 1 || text.length > REASON_MAX)) return invalid('reason', `Причина — от 1 до ${REASON_MAX} знаков`)
    const decided: HistDto = kind === 'confirm' ? { ...entry, status: 'confirmed', by: ME, at: when } : { ...entry, status: 'rejected', by: ME, at: when, reason: text }
    histOf(id).set(target, [...hist.slice(0, -1), decided])
    if (kind === 'reject' && target === 'accKt') recalcRoute(id, detail, entry.was, when)
    return overlay(id, detail)
  }

  return { overlay, save, accounts, decide }
}
