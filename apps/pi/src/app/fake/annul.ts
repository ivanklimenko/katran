import { toApiError, type Problem } from '../../shared/api'
import { REASON_MAX } from '../../shared/lib/detail'

/**
 * Аннулирование документа в фейке (спека 2e §3.7, контракт pi-api.md §1.11). Команды `annul`, `annul/confirm`, `annul/reject`
 * принимаются (202 без тела), итог бек применяет сразу и отражает в детали (`annul`, `canAnnul`, статус `REJECTED` у `done`).
 *
 * Правило бека — пример на CEL (спека §3.1 п. 4; не контракт, фейк исполняет его кодом ниже):
 * ```
 * canAnnul:      doc.status in ['IN_PROGRESS', 'TO_EXPORT', 'ERROR', 'DEFERRED'] && doc.lock == null && (doc.annul == null || doc.annul.status == 'rejected')
 * needsApproval: doc.amount > 1000000
 * ```
 *
 * Сид (выбор детерминирован по данным; номера и id — в `annulSeedsOf`, итоги — в отчёте Task 3):
 * - валюта, чужой `pending`: первый документ реестра, который можно аннулировать (`canAnnulBase`), с суммой 32A больше 1 000 000
 *   и не из сидов правок (поле 57, Кт); запрос Кузнецова Д. А., `canConfirm: true`;
 * - валюта, уже `done`: первый документ в статусе `REJECTED` без блокировки (запрос Ивановой М. П., утвердила Смирнова Е. В.);
 * - рубль, чужой `pending`: первый документ реестра, который можно аннулировать (суммы рублёвых документов стенда — до 7 000, порога нет);
 *   запрос Кузнецова Д. А.; рублёвое аннулирование через утверждение вызывается регулятором ?annul=pending.
 * Состояние сида строится лениво при первом обращении к документу; записанные пользователем итоги живут в памяти хранилища
 * (на сессию стенда, свежее — на тест, как у правок).
 */

type Detail = Record<string, unknown>
type AnnulDto = { status: 'pending' | 'done' | 'rejected'; who: string; when: string; reason: string; by: string | null; at: string | null; rejectReason: string | null }
/** Режим регулятора ?annul=: instant — сразу, pending — через утверждение, fail — команда принята, документ не меняется. */
export type AnnulMode = 'instant' | 'pending' | 'fail'

/** Порог суммы 32A (у рубля — суммы документа), выше которого нужно утверждение. */
export const APPROVAL_THRESHOLD = 1_000_000
/** Статусы, в которых документ можно аннулировать. */
const ANNULABLE = ['IN_PROGRESS', 'TO_EXPORT', 'ERROR', 'DEFERRED']
/** Автор действий пользователя фейка. */
const ME = 'Вы'

/** Базовый canAnnul строки реестра: статус допускает, нет блокировки (аннулирований ещё не было). */
export const canAnnulBase = (row: { status: string; lock: unknown }): boolean => ANNULABLE.includes(row.status) && row.lock === null

type SeedRow = { id: string; status: string; lock: unknown; amount: number }
/**
 * Документы сида аннулирования реестра: `pending` — первый, который можно аннулировать, с суммой > minAmount (не из `exclude`);
 * `done` — первый в статусе REJECTED без блокировки (не из `exclude`). Нет подходящего — null.
 */
export function annulSeedsOf(rows: readonly SeedRow[], exclude: readonly (string | null)[] = [], minAmount = APPROVAL_THRESHOLD): { pending: string | null; done: string | null } {
  const free = rows.filter((r) => !exclude.includes(r.id))
  return {
    pending: free.find((r) => canAnnulBase(r) && r.amount > minAmount)?.id ?? null,
    done: free.find((r) => r.status === 'REJECTED' && r.lock === null)?.id ?? null,
  }
}

export type FakeAnnulStore = {
  /** Деталь с итогом аннулирования: annul, canAnnul и (у done) статус REJECTED; документ без аннулирования — деталь как есть. */
  overlay: (id: string, detail: Detail) => Detail
  /**
   * Команда: annul { reason } / confirm { when } / reject { when, reason }. Бросает ApiError 400 (тело, причина), 403 (блокировка, свой запрос),
   * 409 (нельзя аннулировать, нет ожидающего запроса или when не совпал). Успех — ничего (ответ 202 без тела).
   */
  command: (id: string, detail: Detail, kind: 'annul' | 'confirm' | 'reject', body: unknown, when: string, mode: string | null) => void
}
export type FakeAnnulStoreConfig = {
  /** Документ с сидом чужого ожидающего запроса (Кузнецов Д. А.). */
  pendingId: string | null
  /** Документ с сидом уже аннулированного (done). */
  doneId?: string | null | undefined
}

const problem = (status: number, type: string, title: string, detail: string, path?: string): never => {
  const p: Problem = { type, title, status, detail, ...(path ? { errors: [{ path, code: 'VALIDATION', message: detail }] } : {}) }
  throw toApiError(status, p)
}
const invalid = (path: string, message: string): never => problem(400, 'urn:katran:annul-validation', 'Аннулирование отклонено', message, path)
const conflict = (detail: string): never => problem(409, 'urn:katran:annul-conflict', 'Документ изменили', detail)
const forbidden = (detail: string): never => problem(403, 'urn:katran:fake', 'Нет прав', detail)

/** Причина после trim: 1–REASON_MAX знаков; иначе 400 по пути reason. */
function reasonOf(v: unknown): string {
  if (typeof v !== 'string') return invalid('reason', 'reason — строка')
  const t = v.trim()
  if (t.length < 1 || t.length > REASON_MAX) return invalid('reason', `Причина — от 1 до ${REASON_MAX} знаков`)
  return t
}

export function createAnnulStore(cfg: FakeAnnulStoreConfig): FakeAnnulStore {
  /** id → состояние аннулирования (сид — лениво). */
  const states = new Map<string, AnnulDto>()
  const seeded = new Set<string>()
  const seed = (id: string, detail: Detail) => {
    if (seeded.has(id)) return
    seeded.add(id)
    const day = String(detail.created).slice(0, 10)
    if (id === cfg.pendingId) {
      states.set(id, { status: 'pending', who: 'Кузнецов Д. А.', when: `${day}T09:15:00`, reason: 'Дубликат платежа', by: null, at: null, rejectReason: null })
    } else if (id === cfg.doneId) {
      states.set(id, { status: 'done', who: 'Иванова М. П.', when: `${day}T10:20:00`, reason: 'Ошибочный документ', by: 'Смирнова Е. В.', at: `${day}T10:45:00`, rejectReason: null })
    }
  }

  /** Статус документа с учётом аннулирования: у done бек ставит REJECTED. */
  const statusOf = (detail: Detail, st: AnnulDto | undefined) => (st?.status === 'done' ? 'REJECTED' : String(detail.status))
  const canAnnulOf = (detail: Detail, st: AnnulDto | undefined) =>
    ANNULABLE.includes(statusOf(detail, st)) && (detail.lock === null || detail.lock === undefined) && (!st || st.status === 'rejected')

  const overlay = (id: string, detail: Detail): Detail => {
    seed(id, detail)
    const st = states.get(id)
    if (!st) return detail
    return { ...detail, status: statusOf(detail, st), canAnnul: canAnnulOf(detail, st), annul: { ...st, canConfirm: st.status === 'pending' && st.who !== ME } }
  }

  const command: FakeAnnulStore['command'] = (id, detail, kind, body, when, mode) => {
    seed(id, detail)
    const st = states.get(id)
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return invalid('', kind === 'annul' ? 'Тело — объект { reason }' : kind === 'reject' ? 'Тело — объект { when, reason }' : 'Тело — объект { when }')
    const b = body as { reason?: unknown; when?: unknown }
    if (kind === 'annul') {
      const reason = reasonOf(b.reason)
      if (detail.lock !== null && detail.lock !== undefined) return forbidden('Документ заблокирован другим пользователем')
      if (!canAnnulOf(detail, st)) return conflict('Документ нельзя аннулировать в текущем состоянии')
      // fail — команда принята, итог не наступил (г8): документ не меняется
      if (mode === 'fail') return
      const amount = Number(detail.amount)
      const needsApproval = mode === 'pending' ? true : mode === 'instant' ? false : amount > APPROVAL_THRESHOLD
      states.set(id, needsApproval
        ? { status: 'pending', who: ME, when, reason, by: null, at: null, rejectReason: null }
        : { status: 'done', who: ME, when, reason, by: null, at: null, rejectReason: null })
      return
    }
    if (typeof b.when !== 'string') return invalid('when', 'when — строка')
    if (!st || st.status !== 'pending' || st.when !== b.when) return conflict('Запроса на аннулирование нет или он уже обработан')
    if (st.who === ME) return forbidden('Свой запрос утверждает или отклоняет другой пользователь')
    if (kind === 'reject') {
      states.set(id, { ...st, status: 'rejected', by: ME, at: when, rejectReason: reasonOf(b.reason) })
      return
    }
    states.set(id, { ...st, status: 'done', by: ME, at: when })
  }
  return { overlay, command }
}
