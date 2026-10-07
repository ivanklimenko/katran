import { act, screen, waitFor } from '@testing-library/react'
import { createEffect } from 'effector'
import { ApiError, type AccountItem, type AccountsQuery, type DecisionQuery, type EditQuery, type RejectQuery, type EditValue } from '../../../shared/api'
import type { EditConfirmView, EditContext } from '../../../shared/lib/detail'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { renderK } from '../../../shared/lib/test'
import { createDocEdit, DISCARD_VIEW, type DocEdit } from '../model/createDocEdit'
import { useEditContexts } from './useEditContexts'

type Doc = { id: string; rev: number }
const text = (v: EditValue | null) => (v === null ? '—' : typeof v === 'string' ? v : v.lines.join('/'))
const commitView = (target: string, was: EditValue, now: EditValue): EditConfirmView => ({
  title: `Подтвердить ${target}`, note: `${text(was)} → ${text(now)}`, okLabel: 'Подтвердить', cancelLabel: 'Отмена', tone: 'neutral',
})

/** Порт-заглушка: по умолчанию отвечает деталью { id, rev: 2 }; impl — свой ответ (отказ, запись запросов). */
const port = <P extends { id: string }>(impl?: ((q: P) => Promise<Doc>) | undefined) =>
  createEffect<P, Doc, ApiError>(impl ?? (async (q) => ({ id: q.id, rev: 2 })))

// UI-тесты apps/pi идут на глобальном scope (как DocDetail.test.tsx): модель — новая в каждом тесте
function setup(save?: (q: EditQuery) => Promise<Doc>, decide: { confirm?: (q: DecisionQuery) => Promise<Doc>; reject?: (q: RejectQuery) => Promise<Doc> } = {}) {
  const saveEditFx = port<EditQuery>(save)
  const accountsFx = createEffect<AccountsQuery, AccountItem[], ApiError>(async () => [])
  const lifecycle = createPageLifecycle()
  const edit = createDocEdit<Doc>({
    ports: { saveEditFx, accountsFx, confirmEditFx: port<DecisionQuery>(decide.confirm), rejectEditFx: port<RejectQuery>(decide.reject) },
    validate: (_t, v) => (typeof v === 'string' && v.includes('!') ? 'Недопустимый символ' : null),
    normalize: (_t, v) => (typeof v === 'string' ? v.trim() : v),
    confirmTargets: ['valueDate'],
    lifecycle,
  })
  const ctx: Record<string, EditContext> = {}
  /** Проба: контексты двух документов, как их получат drawer A и B. */
  function Probe({ e }: { e: DocEdit<Doc> }) {
    const of = useEditContexts(e, commitView)
    ctx.d1 = of('d1')
    ctx.d2 = of('d2')
    return null
  }
  renderK(<Probe e={edit} />)
  act(() => { lifecycle.pageOpened() })
  return { edit, ctx }
}

describe('useEditContexts (план 2c §3.2)', () => {
  it('контекст только своего документа: editing, draft, confirm; чужой — null', async () => {
    const { ctx } = setup()
    act(() => { ctx.d1!.open('refOut', 'REF1') })
    expect(ctx.d1).toMatchObject({ docId: 'd1', editing: 'refOut', draft: 'REF1', error: null, saving: false, saveError: null, confirm: null })
    expect(ctx.d2).toMatchObject({ docId: 'd2', editing: null, draft: null, error: null, confirm: null })
    act(() => { ctx.d1!.change('REF!') })
    expect(ctx.d1?.draft).toBe('REF!')
    expect(ctx.d1?.error).toBe('Недопустимый символ')
    expect(ctx.d2?.error).toBeNull()
    // change чужого документа (редактора нет) — черновик d1 не трогает
    act(() => { ctx.d2!.change('X') })
    expect(ctx.d1?.draft).toBe('REF!')
    act(() => { ctx.d1!.cancel() })
    expect(ctx.d1?.editing).toBeNull()
  })

  it('confirm: discard — DISCARD_VIEW, commit — commitView(target, initial, draft)', async () => {
    const { ctx } = setup()
    act(() => { ctx.d1!.open('valueDate', '2026-10-06') })
    act(() => { ctx.d1!.change('2026-10-07') })
    act(() => { ctx.d1!.save() })
    expect(ctx.d1?.confirm).toEqual(commitView('valueDate', '2026-10-06', '2026-10-07'))
    expect(ctx.d2?.confirm).toBeNull()
    act(() => { ctx.d1!.onConfirm(false) })
    expect(ctx.d1?.confirm).toBeNull()
    expect(ctx.d1?.editing).toBe('valueDate')
    // грязный черновик d1 и открытие правки в d2 — «Отменить правку?» в документе d1
    act(() => { ctx.d2!.open('refOut', 'REF2') })
    expect(ctx.d1?.confirm).toEqual(DISCARD_VIEW)
    expect(ctx.d2?.confirm).toBeNull()
    act(() => { ctx.d1!.onConfirm(true) })
    expect(ctx.d1?.editing).toBeNull()
    expect(ctx.d2?.editing).toBe('refOut')
  })

  it('cancel, save и onConfirm чужого документа не трогают редактор и Prompt другого', async () => {
    const saves: EditQuery[] = []
    const { ctx } = setup(async (q) => { saves.push(q); return { id: q.id, rev: 2 } })
    act(() => { ctx.d1!.open('valueDate', '2026-10-06') })
    act(() => { ctx.d1!.change('2026-10-07') })
    act(() => { ctx.d2!.save() })
    expect(ctx.d1?.confirm).toBeNull()
    act(() => { ctx.d2!.cancel() })
    expect(ctx.d1?.editing).toBe('valueDate')
    act(() => { ctx.d1!.save() })
    expect(ctx.d1?.confirm).not.toBeNull()
    act(() => { ctx.d2!.onConfirm(true) })
    expect(ctx.d1?.confirm).not.toBeNull()
    expect(saves).toHaveLength(0)
    act(() => { ctx.d1!.onConfirm(true) })
    await waitFor(() => expect(saves).toHaveLength(1))
  })

  it('после сохранения — объявление «Изменения сохранены» в живой области', async () => {
    let fail = true
    const { ctx } = setup(async (q) => {
      if (fail) throw new ApiError(400, { type: 'urn:katran:validation', title: 'Правка отклонена', errors: [{ path: 'now', code: 'VALIDATION', message: 'Не тот формат' }] }, 'Правка отклонена: Не тот формат')
      return { id: q.id, rev: 2 }
    })
    expect(screen.getByRole('status')).toHaveTextContent('')
    act(() => { ctx.d1!.open('refOut', 'REF1') })
    act(() => { ctx.d1!.change('REF2') })
    act(() => { ctx.d1!.save() })
    await waitFor(() => expect(ctx.d1?.saveError).toBe('Не тот формат'))
    expect(ctx.d2?.saveError).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('')
    fail = false
    act(() => { ctx.d1!.save() })
    // новое сохранение — прежний отказ не висит
    expect(ctx.d1?.saving).toBe(true)
    expect(ctx.d1?.saveError).toBeNull()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Изменения сохранены'))
    expect(ctx.d1?.editing).toBeNull()
  })

  it('отказ ↺ — объявление «Изменения не сохранены: …» в живой области', async () => {
    const { ctx } = setup(async () => {
      throw new ApiError(400, { type: 'urn:katran:validation', title: 'Правка отклонена', errors: [{ path: 'now', code: 'VALIDATION', message: 'Не тот формат' }] }, 'Правка отклонена: Не тот формат')
    })
    expect(screen.getByRole('status')).toHaveTextContent('')
    act(() => { ctx.d1!.revert('refOut', 'REF2', 'REF1') })
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Изменения не сохранены: Не тот формат'))
    expect(ctx.d1?.saveError).toBeNull()
  })

  it('canDecide: canConfirm цели и нет редактора документа, решения и сохранения', async () => {
    const { ctx } = setup()
    expect(ctx.d1?.canDecide('field:57', true)).toBe(true)
    expect(ctx.d1?.canDecide('field:57', false)).toBe(false)
    expect(ctx.d1?.decision).toBeNull()
    act(() => { ctx.d1!.open('refOut', 'REF1') })
    expect(ctx.d1?.canDecide('field:57', true)).toBe(false)
    // редактор чужого документа — решать в этом можно
    expect(ctx.d2?.canDecide('field:57', true)).toBe(true)
    act(() => { ctx.d1!.cancel() })
    act(() => { ctx.d1!.confirmEdit('field:57', 'w1') })
    expect(ctx.d1?.decision).toEqual({ kind: 'confirm', target: 'field:57', when: 'w1', reason: '', busy: false, error: null })
    expect(ctx.d2?.decision).toBeNull()
    expect(ctx.d1?.canDecide('accKt', true)).toBe(false)
    // пока открыт Prompt решения — карандаши документа недоступны (одна операция за раз)
    act(() => { ctx.d1!.open('refOut', 'REF1') })
    expect(ctx.d1?.editing).toBeNull()
    act(() => { ctx.d1!.onDecision(false) })
    expect(ctx.d1?.decision).toBeNull()
  })

  it('canDecide — false, пока сохраняется правка этого документа; сохранение другого документа решения не блокирует (финальное ревью 2d, M2)', async () => {
    let release: () => void = () => undefined
    const { ctx } = setup((q) => new Promise<Doc>((ok) => { release = () => ok({ id: q.id, rev: 2 }) }))
    act(() => { ctx.d1!.revert('refOut', 'REF2', 'REF1') })
    expect(ctx.d2?.saving).toBe(true)
    expect(ctx.d1?.canDecide('field:57', true)).toBe(false)
    expect(ctx.d2?.canDecide('field:57', true)).toBe(true)
    await act(async () => { release() })
    await waitFor(() => expect(ctx.d1?.canDecide('field:57', true)).toBe(true))
  })

  it('отклонение: changeReason → причина, onDecision(true) → запрос; успех — объявление «Правка отклонена»; на монтировании — без объявления', async () => {
    const rejects: RejectQuery[] = []
    const { ctx } = setup(undefined, { reject: async (q) => { rejects.push(q); return { id: q.id, rev: 3 } } })
    expect(screen.getByRole('status')).toHaveTextContent('')
    act(() => { ctx.d1!.rejectEdit('field:57', 'w1') })
    act(() => { ctx.d1!.changeReason('  BIC  ') })
    expect(ctx.d1?.decision?.reason).toBe('  BIC  ')
    // причина и решение чужого документа не трогают
    act(() => { ctx.d2!.changeReason('x') })
    act(() => { ctx.d2!.onDecision(true) })
    expect(rejects).toHaveLength(0)
    act(() => { ctx.d1!.onDecision(true) })
    expect(ctx.d1?.decision?.busy).toBe(true)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Правка отклонена'))
    expect(rejects).toEqual([{ id: 'd1', target: 'field:57', when: 'w1', reason: 'BIC' }])
    expect(ctx.d1?.decision).toBeNull()
  })

  it('утверждение: объявление «Правка утверждена»; 409 — «Правку уже обработали — данные обновлены»', async () => {
    let conflict = false
    const { ctx } = setup(undefined, {
      confirm: async (q) => {
        if (conflict) throw new ApiError(409, { type: 'urn:katran:edit-conflict', title: 'Документ изменили', status: 409 }, 'Документ изменили')
        return { id: q.id, rev: 3 }
      },
    })
    act(() => { ctx.d1!.confirmEdit('field:57', 'w1') })
    act(() => { ctx.d1!.onDecision(true) })
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Правка утверждена'))
    conflict = true
    act(() => { ctx.d2!.confirmEdit('accKt', 'w2') })
    act(() => { ctx.d2!.onDecision(true) })
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Правку уже обработали — данные обновлены'))
    expect(ctx.d2?.decision).toBeNull()
  })
})
