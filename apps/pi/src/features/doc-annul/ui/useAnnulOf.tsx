import { useCallback, useEffect, useRef, type ReactElement } from 'react'
import { useUnit } from 'effector-react'
import { Banner, Button, Prompt, formatDateTimeMinutes, useKatran, useStableId } from '@katran/ui'
import { REASON_MAX, type AnnulInfo, type AnnulLane, type AnnulState, type AnnulView } from '../../../shared/lib/detail'
import { ANNUL_HINT, type AnnulPromptState, type DocAnnul } from '../model/createDocAnnul'
import s from './useAnnulOf.module.css'

const noop = (): void => undefined

/** «{кто}, {когда}» — когда без секунд, как в истории правок 2d. */
const byAt = (who: string | null, when: string | null): string =>
  [who, when !== null ? formatDateTimeMinutes(when) : null].filter(Boolean).join(', ')
/** Запрос на аннулирование: автор, время и причина — текст плашки pending и пояснение Prompt решения. */
const requestNote = (a: AnnulState): string => `${byAt(a.who, a.when)} · Причина: ${a.reason}`

/** Подсказка недоступной «Аннулировать» по детали (спека 2e §4 п. 1): блокировка, запрос, итог, иначе статус. */
function laneHint(info: AnnulInfo): string {
  if (info.lockedBy !== null) return ANNUL_HINT.locked(info.lockedBy)
  if (info.annul?.status === 'pending') return ANNUL_HINT.pending
  if (info.annul?.status === 'done') return ANNUL_HINT.done
  return ANNUL_HINT.status(info.statusLabel)
}

const TITLE = { annul: 'Аннулировать документ?', confirm: 'Утвердить аннулирование?', reject: 'Отклонить аннулирование?' }
const OK = { annul: 'Аннулировать', confirm: 'Утвердить', reject: 'Отклонить' }

/**
 * Prompt аннулирования или решения по запросу (спека 2e §4 п. 2–3): у annul и reject — обязательное поле «Причина» (до 140,
 * счётчик в описании поля), основная кнопка недоступна, пока причина пуста после trim. busy и error — модели.
 * Кнопка, открывшая окно, пропала (решение убрало кнопки плашки) — фокус на заголовок drawer, а не в body (как fallbackFocus 2d,
 * Ruling R19): drawer запоминается при открытии по скрытой метке в слое overlay.
 */
function AnnulPrompt({ state, info, onResult, onReason }: {
  state: AnnulPromptState
  info: AnnulInfo | null
  onResult: (ok: boolean) => void
  onReason: (reason: string) => void
}): ReactElement {
  const reasonId = useStableId()
  const countId = useStableId()
  const mark = useRef<HTMLSpanElement>(null)
  const drawer = useRef<HTMLElement | null>(null)
  useEffect(() => {
    drawer.current = mark.current?.closest<HTMLElement>('[data-k-drawer]') ?? null
  }, [])
  const fallbackFocus = () => {
    const root = drawer.current
    return root !== null && root.isConnected ? root.querySelector<HTMLElement>('h2[tabindex]') : null
  }
  const { kind } = state
  const withReason = kind !== 'confirm'
  const note = kind === 'annul' ? info?.subject : info?.annul ? requestNote(info.annul) : undefined
  return (
    <>
      <span ref={mark} hidden />
      <Prompt
        open
        title={TITLE[kind]}
        note={note}
        okLabel={OK[kind]}
        cancelLabel="Отмена"
        tone={kind === 'confirm' ? 'neutral' : 'danger'}
        okDisabled={withReason && state.reason.trim() === ''}
        busy={state.busy}
        error={state.error ?? undefined}
        onResult={onResult}
        fallbackFocus={fallbackFocus}
      >
        {withReason ? (
          <div className={s.reason}>
            <label htmlFor={reasonId} className={s.reasonLabel}>Причина</label>
            <textarea
              id={reasonId}
              className={s.reasonField}
              rows={3}
              maxLength={REASON_MAX}
              required
              // команда в полёте — причину уже не меняют (модель тоже игнорирует ввод при busy)
              readOnly={state.busy}
              aria-describedby={countId}
              value={state.reason}
              onChange={(e) => onReason(e.target.value)}
            />
            <span id={countId} className={s.reasonCount}>{state.reason.length}/{REASON_MAX}</span>
          </div>
        ) : undefined}
      </Prompt>
    </>
  )
}

/**
 * Виды аннулирования по документам (спека 2e §3.3): деталка получает AnnulView своего документа, не зная о модели —
 * состояние кнопки лейна, плашку запроса и Prompt. Подсказки и тексты — здесь, в ките и виджете их нет.
 *
 * Кнопка лейна: без детали — недоступна без подсказки; без canAnnul — подсказка по причине (laneHint); при canAnnul документ
 * с другой операцией (правка — $blockedDocs, свой Prompt или команда — $busyDocs) — «Завершите текущую операцию с документом».
 * Причина недоступности по детали важнее временной занятости: она не пройдёт, когда операция закончится.
 * Кнопки «Утвердить»/«Отклонить» плашки у занятого документа — aria-disabled с той же подсказкой (модель запрос и так отбросит).
 * Рост $done.count — объявление его текста в живой области (на монтировании — без объявления).
 */
export function useAnnulOf<D>(model: DocAnnul<D>): (docId: string) => AnnulView {
  const [prompts, busyDocs, blockedDocs, done] = useUnit([model.$prompt, model.$busyDocs, model.$blockedDocs, model.$done])
  const [annulRequested, confirmRequested, rejectRequested, reasonChanged, promptResult] = useUnit([
    model.annulRequested, model.confirmRequested, model.rejectRequested, model.reasonChanged, model.promptResult,
  ])
  const { announce } = useKatran()

  const seen = useRef(done.count)
  useEffect(() => {
    if (done.count > seen.current) announce(done.text)
    seen.current = done.count
  }, [done, announce])

  return useCallback((docId: string): AnnulView => {
    const state = prompts[docId] ?? null
    const occupied = busyDocs[docId] === true || blockedDocs[docId] === true
    const busy = state?.busy === true
    return {
      lane: (info): AnnulLane => {
        if (info === null) return { disabled: true, hint: null, busy, run: noop }
        const hint = !info.canAnnul ? laneHint(info) : occupied ? ANNUL_HINT.busy : null
        return hint !== null ? { disabled: true, hint, busy, run: noop } : { disabled: false, hint: null, busy, run: () => annulRequested(docId) }
      },
      banner: (info, dismissed, onDismiss) => {
        const a = info?.annul ?? null
        if (a === null) return null
        if (a.status === 'pending') {
          const decide = (go: typeof confirmRequested) => () => { if (!occupied) go({ docId, when: a.when }) }
          const off = { 'aria-disabled': occupied || undefined, 'data-k-tip': occupied ? ANNUL_HINT.busy : undefined }
          return (
            <Banner
              tone="warn"
              actions={a.canConfirm ? (
                <>
                  <Button size="s" {...off} onClick={decide(confirmRequested)}>Утвердить</Button>
                  <Button size="s" {...off} onClick={decide(rejectRequested)}>Отклонить</Button>
                </>
              ) : undefined}
            >
              Аннулирование ожидает утверждения · {requestNote(a)}
            </Banner>
          )
        }
        if (a.status === 'done') {
          return <Banner tone="bad">Документ аннулирован · {byAt(a.by ?? a.who, a.at ?? a.when)} · Причина: {a.reason}</Banner>
        }
        if (dismissed) return null
        return (
          <Banner tone="neutral" onClose={onDismiss}>
            {['Запрос на аннулирование отклонён', byAt(a.by, a.at), a.rejectReason].filter(Boolean).join(' · ')}
          </Banner>
        )
      },
      prompt: (info) => state === null ? null : (
        <AnnulPrompt
          state={state}
          info={info}
          onResult={(ok) => promptResult({ docId, ok })}
          onReason={(reason) => reasonChanged({ docId, reason })}
        />
      ),
    }
  }, [prompts, busyDocs, blockedDocs, annulRequested, confirmRequested, rejectRequested, reasonChanged, promptResult])
}
