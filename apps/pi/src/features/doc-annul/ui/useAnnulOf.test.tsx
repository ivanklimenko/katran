import { useState } from 'react'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { createEffect, createEvent, createStore, type Store } from 'effector'
import { useUnit } from 'effector-react'
import { ApiError, type AnnulDecisionQuery, type AnnulQuery, type AnnulRejectQuery } from '../../../shared/api'
import type { AnnulInfo, AnnulState, AnnulView } from '../../../shared/lib/detail'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { renderK } from '../../../shared/lib/test'
import { ANNUL_HINT, createDocAnnul, type DocAnnul } from '../model/createDocAnnul'
import { useAnnulOf } from './useAnnulOf'

type Doc = { id: string; annul: AnnulState | null }
type Pending<P, R> = { params: P; ok: (r: R) => void; fail: (e: ApiError) => void }

/** Отложенный порт: вызовы копятся в calls, ответ отпускается вручную. */
function deferred<P, R>() {
  const calls: Pending<P, R>[] = []
  const fx = createEffect<P, R, ApiError>((params) => new Promise<R>((ok, fail) => { calls.push({ params, ok, fail }) }))
  return { calls, fx }
}

const request = (over: Partial<AnnulState> = {}): AnnulState => ({
  status: 'pending', who: 'Кузнецов Д. А.', when: '2026-09-23T10:00:00', reason: 'Дубликат платежа',
  by: null, at: null, rejectReason: null, canConfirm: true, ...over,
})
const infoOf = (over: Partial<AnnulInfo> = {}): AnnulInfo => ({
  canAnnul: true, annul: null, lockedBy: null, statusLabel: 'Обработан', subject: '№ 417 · 1 250 000.00 USD', ...over,
})

// UI-тесты apps/pi идут на глобальном scope: модель — новая в каждом тесте; порты — отложенные, вызовы в журнале
function setup(o: { blocked?: Store<Record<string, true>> } = {}) {
  const annuls = deferred<AnnulQuery, void>()
  const confirms = deferred<AnnulDecisionQuery, void>()
  const rejects = deferred<AnnulRejectQuery, void>()
  const details = deferred<string, Doc>()
  const lifecycle = createPageLifecycle()
  const model = createDocAnnul<Doc>({
    ports: { annulFx: annuls.fx, confirmAnnulFx: confirms.fx, rejectAnnulFx: rejects.fx, detailFx: details.fx },
    lifecycle,
    blockedDocs: o.blocked,
    statusLabelOf: () => 'В работе',
  })
  // деталь документа d1 как у страницы: свежая деталь после команды ложится тем же тактом, что снимается Prompt
  const show = createEvent<AnnulInfo | null>()
  const $info = createStore<AnnulInfo | null>(null)
    .on(show, (_, info) => info)
    .on(model.docAnnulled, (info, { detail }) => (info === null ? null : { ...info, canAnnul: false, annul: detail.annul }))
  const views: Record<string, AnnulView> = {}
  const dismissals: string[] = []
  /** Как drawer деталки: заголовок с tabindex, лейн-кнопка, плашка и слой Prompt своего документа. */
  function Harness({ m }: { m: DocAnnul<Doc> }) {
    const info = useUnit($info)
    const of = useAnnulOf(m)
    views.d1 = of('d1')
    views.d2 = of('d2')
    const [dismissed, setDismissed] = useState(false)
    const v = views.d1
    return (
      <div role="dialog" aria-label="Деталь" data-k-drawer="">
        <h2 tabIndex={-1}>Платёжная инструкция</h2>
        <div data-part="banner">{v.banner(info, dismissed, () => { dismissals.push('d1'); setDismissed(true) })}</div>
        <div data-part="overlay" style={{ position: 'relative' }}>{v.prompt(info)}</div>
      </div>
    )
  }
  const r = renderK(<Harness m={model} />)
  act(() => { lifecycle.pageOpened() })
  return { model, views, dismissals, show: (info: AnnulInfo | null) => act(() => { show(info) }), lifecycle, annuls, confirms, rejects, details, ...r }
}

describe('useAnnulOf: кнопка лейна (спека 2e §4 п. 1)', () => {
  it('canAnnul — доступна, без подсказки; run — annulRequested документа', () => {
    const t = setup()
    const lane = t.views.d1!.lane(infoOf())
    expect(lane).toMatchObject({ disabled: false, hint: null, busy: false })
    act(() => { lane.run() })
    expect(t.model.$prompt.getState().d1).toMatchObject({ kind: 'annul', reason: '', busy: false })
    expect(t.model.$prompt.getState().d2).toBeUndefined()
  })

  it('без canAnnul — недоступна с подсказкой по причине; run не действует', () => {
    const t = setup()
    const of = (over: Partial<AnnulInfo>) => t.views.d1!.lane(infoOf({ canAnnul: false, ...over }))
    expect(of({ lockedBy: 'Иванова М. П.' })).toMatchObject({ disabled: true, hint: 'Документ заблокирован: Иванова М. П.' })
    expect(of({ annul: request() })).toMatchObject({ disabled: true, hint: ANNUL_HINT.pending })
    expect(of({ annul: request({ status: 'done' }) })).toMatchObject({ disabled: true, hint: ANNUL_HINT.done })
    expect(of({})).toMatchObject({ disabled: true, hint: 'Аннулирование недоступно для документа в статусе «Обработан»' })
    expect(of({ annul: request({ status: 'rejected' }) })).toMatchObject({ disabled: true, hint: 'Аннулирование недоступно для документа в статусе «Обработан»' })
    act(() => { of({}).run() })
    expect(t.model.$prompt.getState()).toEqual({})
  })

  it('деталь не загружена (info null) — недоступна без подсказки', () => {
    const t = setup()
    expect(t.views.d1!.lane(null)).toMatchObject({ disabled: true, hint: null, busy: false })
  })

  it('документ в $blockedDocs (правка) — недоступна с подсказкой «Завершите текущую операцию»; другой документ — доступна', () => {
    const t = setup({ blocked: createStore<Record<string, true>>({ d1: true }) })
    expect(t.views.d1!.lane(infoOf())).toMatchObject({ disabled: true, hint: ANNUL_HINT.busy })
    expect(t.views.d2!.lane(infoOf())).toMatchObject({ disabled: false, hint: null })
  })

  it('документ в $busyDocs (свой Prompt, команда в полёте) — недоступна, busy — только в полёте', async () => {
    const t = setup()
    t.show(infoOf())
    act(() => { t.views.d1!.lane(infoOf()).run() })
    expect(t.views.d1!.lane(infoOf())).toMatchObject({ disabled: true, hint: ANNUL_HINT.busy, busy: false })
    expect(t.views.d2!.lane(infoOf())).toMatchObject({ disabled: false })
    await userEvent.type(screen.getByRole('textbox', { name: 'Причина' }), 'Дубликат')
    await userEvent.click(screen.getByRole('button', { name: 'Аннулировать' }))
    expect(t.annuls.calls).toHaveLength(1)
    expect(t.views.d1!.lane(infoOf())).toMatchObject({ disabled: true, hint: ANNUL_HINT.busy, busy: true })
  })
})

describe('useAnnulOf: плашка (спека 2e §4 п. 4)', () => {
  it('pending + canConfirm — тон warn, текст, «Утвердить» и «Отклонить» открывают Prompt решения', async () => {
    const t = setup()
    t.show(infoOf({ canAnnul: false, annul: request() }))
    const box = document.querySelector('[data-part="banner"] [data-tone]')
    expect(box).toHaveAttribute('data-tone', 'warn')
    expect(within(box as HTMLElement).getByRole('status')).toHaveTextContent(
      'Аннулирование ожидает утверждения · Кузнецов Д. А., 23.09.2026 10:00 · Причина: Дубликат платежа',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Утвердить' }))
    expect(t.model.$prompt.getState().d1).toMatchObject({ kind: 'confirm', when: '2026-09-23T10:00:00' })
    act(() => { t.model.promptResult({ docId: 'd1', ok: false }) })
    await userEvent.click(screen.getByRole('button', { name: 'Отклонить' }))
    expect(t.model.$prompt.getState().d1).toMatchObject({ kind: 'reject', when: '2026-09-23T10:00:00' })
  })

  it('pending без canConfirm — без кнопок', () => {
    const t = setup()
    t.show(infoOf({ canAnnul: false, annul: request({ canConfirm: false }) }))
    expect(document.querySelector('[data-part="banner"] [data-tone="warn"]')).not.toBeNull()
    expect(within(document.querySelector('[data-part="banner"]') as HTMLElement).queryByRole('button')).toBeNull()
  })

  it('pending + canConfirm, документ занят правкой — кнопки aria-disabled с подсказкой, клик не открывает Prompt', async () => {
    const t = setup({ blocked: createStore<Record<string, true>>({ d1: true }) })
    t.show(infoOf({ canAnnul: false, annul: request() }))
    const ok = screen.getByRole('button', { name: 'Утвердить' })
    expect(ok).toHaveAttribute('aria-disabled', 'true')
    expect(ok).toHaveAttribute('data-k-tip', ANNUL_HINT.busy)
    await userEvent.click(ok)
    expect(t.model.$prompt.getState()).toEqual({})
  })

  it('done — тон bad, «by ?? who», «at ?? when»', () => {
    const t = setup()
    t.show(infoOf({ canAnnul: false, annul: request({ status: 'done', by: 'Петров С. В.', at: '2026-09-24T11:30:00', canConfirm: false }) }))
    const box = document.querySelector('[data-part="banner"] [data-tone]')
    expect(box).toHaveAttribute('data-tone', 'bad')
    expect(within(box as HTMLElement).getByRole('status')).toHaveTextContent('Документ аннулирован · Петров С. В., 24.09.2026 11:30 · Причина: Дубликат платежа')
    t.show(infoOf({ canAnnul: false, annul: request({ status: 'done', canConfirm: false }) }))
    expect(within(document.querySelector('[data-part="banner"]') as HTMLElement).getByRole('status')).toHaveTextContent('Документ аннулирован · Кузнецов Д. А., 23.09.2026 10:00 · Причина: Дубликат платежа')
    expect(within(document.querySelector('[data-part="banner"]') as HTMLElement).queryByRole('button')).toBeNull()
  })

  it('rejected — тон neutral, причина отклонения, «Закрыть» вызывает onDismiss и прячет плашку', async () => {
    const t = setup()
    t.show(infoOf({ annul: request({ status: 'rejected', by: 'Петров С. В.', at: '2026-09-24T11:30:00', rejectReason: 'Платёж корректен', canConfirm: false }) }))
    const box = document.querySelector('[data-part="banner"] [data-tone]')
    expect(box).toHaveAttribute('data-tone', 'neutral')
    expect(within(box as HTMLElement).getByRole('status')).toHaveTextContent('Запрос на аннулирование отклонён · Петров С. В., 24.09.2026 11:30 · Платёж корректен')
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(t.dismissals).toEqual(['d1'])
    expect(document.querySelector('[data-part="banner"]')).toBeEmptyDOMElement()
  })

  it('нет запроса или нет детали — плашки нет', () => {
    const t = setup()
    t.show(infoOf())
    expect(document.querySelector('[data-part="banner"]')).toBeEmptyDOMElement()
    t.show(null)
    expect(document.querySelector('[data-part="banner"]')).toBeEmptyDOMElement()
  })

  it('плашки трёх видов — без нарушений axe', async () => {
    const t = setup()
    for (const annul of [
      request(),
      request({ status: 'done', canConfirm: false }),
      request({ status: 'rejected', by: 'Петров С. В.', at: '2026-09-24T11:30:00', rejectReason: 'Платёж корректен', canConfirm: false }),
    ]) {
      t.show(infoOf({ annul }))
      expect(await axe(t.container)).toHaveNoViolations()
    }
  })
})

describe('useAnnulOf: Prompt (спека 2e §4 п. 2–3)', () => {
  it('annul — «Аннулировать документ?», пояснение subject, «Причина» до 140 со счётчиком, тон danger; пустая причина — «Аннулировать» недоступна', async () => {
    const t = setup()
    t.show(infoOf())
    act(() => { t.views.d1!.lane(infoOf()).run() })
    const dlg = screen.getByRole('alertdialog', { name: 'Аннулировать документ?' })
    expect(dlg).toHaveAccessibleDescription('№ 417 · 1 250 000.00 USD')
    const field = within(dlg).getByRole('textbox', { name: 'Причина' })
    expect(field).toBeRequired()
    expect(field).toHaveAttribute('maxLength', '140')
    expect(field).toHaveFocus()
    expect(within(dlg).getByText('0/140')).toBeInTheDocument()
    const ok = within(dlg).getByRole('button', { name: 'Аннулировать' })
    expect(ok).toHaveClass('danger')
    expect(ok).toBeDisabled()
    await userEvent.type(field, '   ')
    expect(ok).toBeDisabled()
    await userEvent.clear(field)
    await userEvent.type(field, 'Дубликат')
    expect(within(dlg).getByText('8/140')).toBeInTheDocument()
    expect(ok).toBeEnabled()
    await userEvent.click(ok)
    expect(t.annuls.calls.map((c) => c.params)).toEqual([{ id: 'd1', reason: 'Дубликат' }])
    // в полёте — обе кнопки недоступны, причина только для чтения
    expect(within(dlg).getByRole('button', { name: 'Аннулировать' })).toBeDisabled()
    expect(within(dlg).getByRole('button', { name: 'Отмена' })).toBeDisabled()
    expect(field).toHaveAttribute('readonly')
    expect(dlg).toHaveAttribute('aria-busy', 'true')
  })

  it('«Отмена» закрывает Prompt без команды', async () => {
    const t = setup()
    t.show(infoOf())
    act(() => { t.views.d1!.lane(infoOf()).run() })
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(t.annuls.calls).toHaveLength(0)
  })

  it('ошибка команды — role="alert" в Prompt, кнопки снова доступны', async () => {
    const t = setup()
    t.show(infoOf())
    act(() => { t.views.d1!.lane(infoOf()).run() })
    await userEvent.type(screen.getByRole('textbox', { name: 'Причина' }), 'Дубликат')
    await userEvent.click(screen.getByRole('button', { name: 'Аннулировать' }))
    await act(async () => { t.annuls.calls[0]!.fail(new ApiError(500, null, 'Сбой сервера')) })
    expect(await screen.findByRole('alert')).toHaveTextContent('Сбой сервера')
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeEnabled()
  })

  it('confirm — «Утвердить аннулирование?» с автором, временем и причиной запроса; «Утвердить» — команда confirm', async () => {
    const t = setup()
    t.show(infoOf({ canAnnul: false, annul: request() }))
    await userEvent.click(screen.getByRole('button', { name: 'Утвердить' }))
    const dlg = screen.getByRole('alertdialog', { name: 'Утвердить аннулирование?' })
    expect(dlg).toHaveAccessibleDescription('Кузнецов Д. А., 23.09.2026 10:00 · Причина: Дубликат платежа')
    expect(within(dlg).queryByRole('textbox')).toBeNull()
    expect(within(dlg).getByRole('button', { name: 'Отмена' })).toBeInTheDocument()
    expect(within(dlg).getByRole('button', { name: 'Утвердить' })).not.toHaveClass('danger')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Утвердить' }))
    expect(t.confirms.calls.map((c) => c.params)).toEqual([{ id: 'd1', when: '2026-09-23T10:00:00' }])
  })

  it('reject — «Отклонить аннулирование?», обязательная причина, тон danger; «Отклонить» — команда reject', async () => {
    const t = setup()
    t.show(infoOf({ canAnnul: false, annul: request() }))
    await userEvent.click(screen.getByRole('button', { name: 'Отклонить' }))
    const dlg = screen.getByRole('alertdialog', { name: 'Отклонить аннулирование?' })
    expect(dlg).toHaveAccessibleDescription('Кузнецов Д. А., 23.09.2026 10:00 · Причина: Дубликат платежа')
    const ok = within(dlg).getByRole('button', { name: 'Отклонить' })
    expect(ok).toHaveClass('danger')
    expect(ok).toBeDisabled()
    await userEvent.type(within(dlg).getByRole('textbox', { name: 'Причина' }), 'Платёж корректен')
    await userEvent.click(ok)
    expect(t.rejects.calls.map((c) => c.params)).toEqual([{ id: 'd1', when: '2026-09-23T10:00:00', reason: 'Платёж корректен' }])
  })

  it('после решения кнопка плашки пропала — фокус на заголовке drawer; объявление итога', async () => {
    const t = setup()
    t.show(infoOf({ canAnnul: false, annul: request() }))
    await userEvent.click(screen.getByRole('button', { name: 'Утвердить' }))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Утвердить' }))
    await act(async () => { t.confirms.calls[0]!.ok(undefined) })
    await waitFor(() => expect(t.details.calls).toHaveLength(1))
    // как страница: свежая деталь ложится в кэш (docAnnulled) тем же тактом, что снимается Prompt
    await act(async () => { t.details.calls[0]!.ok({ id: 'd1', annul: request({ status: 'done', by: 'Вы', at: '2026-09-24T11:30:00', canConfirm: false }) }) })
    expect(within(document.querySelector('[data-part="banner"]') as HTMLElement).getByRole('status')).toHaveTextContent('Документ аннулирован · Вы, 24.09.2026 11:30')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Платёжная инструкция' })).toHaveFocus()
    await waitFor(() => expect(screen.getByText('Аннулирование утверждено')).toBeInTheDocument())
  })

  it('Prompt — только своего документа: у d2 его нет', () => {
    const t = setup()
    t.show(infoOf())
    act(() => { t.views.d1!.lane(infoOf()).run() })
    expect(t.views.d2!.prompt(infoOf())).toBeNull()
    expect(t.views.d1!.prompt(infoOf())).not.toBeNull()
  })
})
