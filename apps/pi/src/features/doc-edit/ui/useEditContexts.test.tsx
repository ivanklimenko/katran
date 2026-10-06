import { act, screen, waitFor } from '@testing-library/react'
import { createEffect } from 'effector'
import { ApiError, type AccountItem, type AccountsQuery, type EditQuery, type EditValue } from '../../../shared/api'
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

// UI-тесты apps/pi идут на глобальном scope (как DocDetail.test.tsx): модель — новая в каждом тесте
function setup(save: (q: EditQuery) => Promise<Doc> = async (q) => ({ id: q.id, rev: 2 })) {
  const saveEditFx = createEffect<EditQuery, Doc, ApiError>(save)
  const accountsFx = createEffect<AccountsQuery, AccountItem[], ApiError>(async () => [])
  const lifecycle = createPageLifecycle()
  const edit = createDocEdit<Doc>({
    ports: { saveEditFx, accountsFx },
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
})
