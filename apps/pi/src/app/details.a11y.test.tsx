import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { createEffect, type Effect } from 'effector'
import { FX_TYPES, fxCommitView, fxDocDetailDomain, fxDocLayout, fxDocPorts, parseFxDocDetail } from '../entities/fx-doc'
import { useEditContexts } from '../features/doc-edit'
import { RUB_TYPES, parseRubDocDetail, rubDocDetailDomain, rubDocLayout, rubDocPorts } from '../entities/rub-doc'
import { FX_LOCAL_TABS, detail as fxDetail, docEdit, fxDetailDomain, lifecycle as fxLifecycle } from '../pages/fx-docs'
import { RUB_LOCAL_TABS, rubDetailDomain } from '../pages/rub-docs'
import { requestFx, type ApiError, type TabQuery } from '../shared/api'
import type { DetailDomain } from '../shared/lib/detail'
import { createPageLifecycle } from '../shared/lib/lifecycle'
import { renderK } from '../shared/lib/test'
import { createDetail, DocDetail } from '../widgets/doc-detail'
import { makeFxDocs } from './fake/fx-docs.data'
import { makeFxDocDetail } from './fake/fx-docs.detail'
import { fakeGrids } from './fake/grids'
import { makeRubDocs } from './fake/rub-docs.data'
import { makeRubDocDetail } from './fake/rub-docs.detail'
import { createFakeServer } from './fake/server'

// Вкладки 2b — через настоящие порты сущностей на фейке без задержек и регуляторов:
// цепочка «порт → requestFx → фейк → parseTab» та же, что в приложении (vitest изолирует модули по файлам)
requestFx.use(createFakeServer(fakeGrids))

/** Деталка с загруженным документом под axe (спека 2a §6): реальные домен, данные фейка и маппер. */
async function check<D extends { id: string }, Row>(domain: DetailDomain<D, Row>, doc: D, ready: RegExp) {
  const detailFx = createEffect<string, D, ApiError>(async () => doc)
  const lifecycle = createPageLifecycle()
  const detail = createDetail({ detailFx, lifecycle })
  const { container, unmount } = renderK(<DocDetail detail={detail} domain={domain} />)
  act(() => {
    lifecycle.pageOpened()
    detail.open({ id: doc.id, secondary: false })
  })
  await screen.findByRole('heading', { name: ready })
  expect(await axe(container)).toHaveNoViolations()
  unmount()
}

type Ports<D> = { detailFx: Effect<string, D, ApiError>; tabFx: Effect<TabQuery, unknown, ApiError> }

/** Первый документ фейка, у которого вкладка с данными (её нет в tabsOff детали). */
async function docWithTab<D, Row>(ids: string[], ports: Ports<D>, domain: DetailDomain<D, Row>, tab: string): Promise<string> {
  for (const id of ids) if (!domain.summary(await ports.detailFx(id)).tabsOff.includes(tab)) return id
  throw new Error(`В фейке нет документа с вкладкой ${tab}`)
}

/** Вкладка документа под axe (спека 2b §5): домен страницы с tabViews, настоящие порты, фейк, виды doc-trail и fx-doc. */
async function checkTab<D, Row>(domain: DetailDomain<D, Row>, ports: Ports<D>, localTabs: string[], id: string, tab: string) {
  const lifecycle = createPageLifecycle()
  const detail = createDetail({ detailFx: ports.detailFx, tabFx: ports.tabFx, localTabs, lifecycle })
  const { container, unmount } = renderK(<DocDetail detail={detail} domain={domain} />)
  act(() => {
    lifecycle.pageOpened()
    detail.open({ id, secondary: false })
  })
  await waitFor(() => expect(document.querySelector('[data-part="hero"]')).not.toBeNull())
  act(() => { detail.setTab({ slot: 'a', tab }) })
  await waitFor(() => expect(detail.$slots.getState().a?.tabView?.state ?? 'ready').toBe('ready'))
  const panel = screen.getByRole('tabpanel')
  await waitFor(() => expect(panel).not.toBeEmptyDOMElement())
  expect(within(panel).queryByRole('alert')).toBeNull()
  expect(await axe(container)).toHaveNoViolations()
  unmount()
}

describe('a11y деталки на реальных профилях обоих реестров (спека 2a §6)', () => {
  it('валюта: каждый тип MT', async () => {
    const rows = makeFxDocs()
    for (const t of FX_TYPES) {
      const i = rows.findIndex((r) => r.type === t)
      if (i < 0) continue
      await check(fxDocDetailDomain, parseFxDocDetail(makeFxDocDetail(rows[i]!, i, rows), 'ответ'), new RegExp(`^Поля ${t}$`))
    }
  }, 60_000)
  it('рубль: каждый вид документа', async () => {
    const rows = makeRubDocs()
    for (const t of RUB_TYPES) {
      const i = rows.findIndex((r) => r.type === t)
      await check(rubDocDetailDomain, parseRubDocDetail(makeRubDocDetail(rows[i]!, i, rows), 'ответ'), /^Отправитель \/ Получатель$/)
    }
  }, 60_000)
})

describe('a11y вкладок деталки на данных фейка (спека 2b §5)', () => {
  it('валюта: каждая вкладка кроме «Общих»', async () => {
    const ids = makeFxDocs().map((r) => fxDocLayout.rowKey(r))
    for (const t of fxDetailDomain.tabs.filter((x) => x.id !== 'main')) {
      await checkTab(fxDetailDomain, fxDocPorts, FX_LOCAL_TABS, await docWithTab(ids, fxDocPorts, fxDetailDomain, t.id), t.id)
    }
  }, 120_000)
  it('рубль: каждая вкладка кроме «Общих»', async () => {
    const ids = makeRubDocs().map((r) => rubDocLayout.rowKey(r))
    for (const t of rubDetailDomain.tabs.filter((x) => x.id !== 'main')) {
      await checkTab(rubDetailDomain, rubDocPorts, RUB_LOCAL_TABS, await docWithTab(ids, rubDocPorts, rubDetailDomain, t.id), t.id)
    }
  }, 120_000)
})

/** Деталка экрана валюты с правкой — модели страницы (охрана ухода, связи edit.model), как в FxDocsPage. */
function FxEditDetail() {
  const editOf = useEditContexts(docEdit, fxCommitView)
  return <DocDetail detail={fxDetail} domain={fxDetailDomain} editOf={editOf} />
}

describe('a11y правки деталки (план 2c, Task 12)', () => {
  it('валюта: открытый редактор поля 57 и Prompt даты валютирования — axe без нарушений', async () => {
    // сид правки поля 57 — второй документ фейка (MT202, preflight D1)
    const seed = makeFxDocs()[1]!
    const id = fxDocLayout.rowKey(seed)
    const { container, unmount } = renderK(<FxEditDetail />)
    // вход на экран: реестр отвечает, первая запись открывается в A (В-Д4); seed заменяет её через охрану ухода
    act(() => { fxLifecycle.pageOpened() })
    await waitFor(() => expect(fxDetail.$slots.getState().a?.state).toBe('ready'))
    act(() => { fxDetail.open({ id, secondary: false }) })
    await waitFor(() => expect(fxDetail.$slots.getState().a).toMatchObject({ id, state: 'ready' }))
    await screen.findByRole('heading', { name: `Поля ${seed.type}` })

    await userEvent.click(screen.getByRole('button', { name: 'Редактировать поле 57' }))
    const editor = await screen.findByRole('region', { name: /^Поле 57 · .+ — правка$/ })
    expect(await axe(container)).toHaveNoViolations()
    await userEvent.click(within(editor).getByRole('button', { name: 'Отмена' }))
    expect(screen.queryByRole('region', { name: /^Поле 57 · .+ — правка$/ })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Изменить дату валютирования' }))
    await screen.findByRole('textbox', { name: 'Дата валютирования' })
    const key = `${id}:valueDate`
    act(() => {
      docEdit.model.change({ key, draft: '2026-12-31' })
      docEdit.model.save()
    })
    const prompt = await screen.findByRole('alertdialog', { name: 'Утвердить новую дату валютирования?' })
    expect(within(prompt).getByRole('button', { name: 'Утвердить' })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()

    act(() => {
      docEdit.model.confirmResult(false)
      fxLifecycle.pageClosed()
    })
    unmount()
  }, 60_000)
})

describe('охрана ухода с черновиком правки на деталке валюты (план 2c, Р6; Task 11 M4)', () => {
  const EDITOR = /^Поле 57 · .+ — правка$/
  it('«Закрыть» и Esc с черновиком — Prompt «Отменить правку?» в drawer; «Продолжить правку» — редактор на месте; «Отменить правку» — деталка закрыта', async () => {
    const id = fxDocLayout.rowKey(makeFxDocs()[1]!)
    const { unmount } = renderK(<FxEditDetail />)
    act(() => { fxLifecycle.pageOpened() })
    await waitFor(() => expect(fxDetail.$slots.getState().a?.state).toBe('ready'))
    act(() => { fxDetail.open({ id, secondary: false }) })
    await waitFor(() => expect(fxDetail.$slots.getState().a).toMatchObject({ id, state: 'ready' }))
    const drawer = screen.getByRole('dialog', { name: /^Платёжная инструкция/ })

    await userEvent.click(within(drawer).getByRole('button', { name: 'Редактировать поле 57' }))
    const editor = await within(drawer).findByRole('region', { name: EDITOR })
    await userEvent.type(within(editor).getByRole('textbox', { name: 'Строка 1' }), 'X')

    // кнопка закрытия drawer (Drawer.onClose → close) — вопрос; деталка и редактор на месте
    await userEvent.click(within(drawer).getByRole('button', { name: 'Закрыть' }))
    const ask = await within(drawer).findByRole('alertdialog', { name: 'Отменить правку?' })
    await userEvent.click(within(ask).getByRole('button', { name: 'Продолжить правку' }))
    expect(within(drawer).queryByRole('alertdialog')).toBeNull()
    expect(within(drawer).getByRole('region', { name: EDITOR })).toBeInTheDocument()
    expect(fxDetail.$slots.getState().a).toMatchObject({ id })

    // Esc вне редактора (фокус вернулся на «Закрыть»): DrawerStack.onEscape → closeTop → тот же вопрос
    expect(document.activeElement).toBe(within(drawer).getByRole('button', { name: 'Закрыть' }))
    await userEvent.keyboard('{Escape}')
    const again = await within(drawer).findByRole('alertdialog', { name: 'Отменить правку?' })
    await userEvent.click(within(again).getByRole('button', { name: 'Отменить правку' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /^Платёжная инструкция/ })).toBeNull())
    expect(fxDetail.$slots.getState()).toEqual({ a: null, b: null })

    act(() => { fxLifecycle.pageClosed() })
    unmount()
  }, 30_000)
})
